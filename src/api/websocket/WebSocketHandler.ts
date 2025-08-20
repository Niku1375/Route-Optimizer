import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import Logger from '../../utils/logger';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  clientId?: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  subscriptions?: Set<string>;
  lastPing?: Date;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // topic -> clientIds
  private heartbeatInterval: NodeJS.Timeout;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      Logger.info('New WebSocket connection attempt');

      // Extract token from query parameters or headers
      const token = this.extractToken(request);
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key') as any;
        ws.userId = decoded.id;
        ws.role = decoded.role;
        ws.subscriptions = new Set();
        ws.lastPing = new Date();

        const clientId = `${decoded.id}-${Date.now()}`;
        this.clients.set(clientId, ws);

        Logger.info('WebSocket client authenticated', { 
          clientId, 
          userId: decoded.id, 
          role: decoded.role 
        });

        // Send welcome message
        this.sendToClient(clientId, {
          type: 'connection_established',
          data: {
            clientId,
            serverTime: new Date().toISOString(),
            supportedEvents: [
              'vehicle_location_update',
              'route_update',
              'breakdown_alert',
              'traffic_update',
              'compliance_alert'
            ]
          },
          timestamp: new Date()
        });

        // Setup message handlers
        ws.on('message', (message: Buffer) => {
          this.handleMessage(clientId, message);
        });

        ws.on('close', (code, reason) => {
          Logger.info('WebSocket client disconnected', { clientId, code, reason: reason.toString() });
          this.handleDisconnection(clientId);
        });

        ws.on('error', (error) => {
          Logger.error('WebSocket error', { clientId, error: error.message });
          this.handleDisconnection(clientId);
        });

        ws.on('pong', () => {
          ws.lastPing = new Date();
        });

      } catch (error) {
        Logger.error('WebSocket authentication failed', { error: error.message });
        ws.close(1008, 'Invalid token');
      }
    });
  }

  private extractToken(request: any): string | null {
    // Try to get token from query parameters
    const url = new URL(request.url, 'http://localhost');
    const token = url.searchParams.get('token');
    
    if (token) {
      return token;
    }

    // Try to get token from headers
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  private handleMessage(clientId: string, message: Buffer): void {
    try {
      const parsedMessage = JSON.parse(message.toString()) as WebSocketMessage;
      const client = this.clients.get(clientId);

      if (!client) {
        return;
      }

      Logger.debug('WebSocket message received', { clientId, type: parsedMessage.type });

      switch (parsedMessage.type) {
        case 'subscribe':
          this.handleSubscription(clientId, parsedMessage.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, parsedMessage.data);
          break;
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date()
          });
          break;
        default:
          Logger.warn('Unknown WebSocket message type', { clientId, type: parsedMessage.type });
      }
    } catch (error) {
      Logger.error('Error handling WebSocket message', { clientId, error: error.message });
    }
  }

  private handleSubscription(clientId: string, subscriptionData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = subscriptionData;
    
    if (!Array.isArray(topics)) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Topics must be an array' },
        timestamp: new Date()
      });
      return;
    }

    topics.forEach((topic: string) => {
      // Check if client has permission for this topic
      if (this.hasTopicPermission(client, topic)) {
        client.subscriptions?.add(topic);
        
        if (!this.subscriptions.has(topic)) {
          this.subscriptions.set(topic, new Set());
        }
        this.subscriptions.get(topic)?.add(clientId);

        Logger.info('Client subscribed to topic', { clientId, topic });
      } else {
        Logger.warn('Client lacks permission for topic', { clientId, topic, role: client.role });
      }
    });

    this.sendToClient(clientId, {
      type: 'subscription_confirmed',
      data: { 
        topics: Array.from(client.subscriptions || []),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    });
  }

  private handleUnsubscription(clientId: string, unsubscriptionData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topics } = unsubscriptionData;
    
    topics.forEach((topic: string) => {
      client.subscriptions?.delete(topic);
      this.subscriptions.get(topic)?.delete(clientId);
      
      // Clean up empty topic subscriptions
      if (this.subscriptions.get(topic)?.size === 0) {
        this.subscriptions.delete(topic);
      }

      Logger.info('Client unsubscribed from topic', { clientId, topic });
    });

    this.sendToClient(clientId, {
      type: 'unsubscription_confirmed',
      data: { 
        topics,
        remainingTopics: Array.from(client.subscriptions || [])
      },
      timestamp: new Date()
    });
  }

  private hasTopicPermission(client: AuthenticatedWebSocket, topic: string): boolean {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      fleet_manager: [
        'vehicle_location_update',
        'route_update',
        'breakdown_alert',
        'traffic_update',
        'compliance_alert',
        'fleet_metrics'
      ],
      operator: [
        'vehicle_location_update',
        'route_update',
        'breakdown_alert'
      ],
      customer: [
        'route_update',
        'delivery_status'
      ]
    };

    const permissions = rolePermissions[client.role || 'customer'] || [];
    return permissions.includes('*') || permissions.includes(topic);
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    
    if (client?.subscriptions) {
      // Remove client from all topic subscriptions
      client.subscriptions.forEach(topic => {
        this.subscriptions.get(topic)?.delete(clientId);
        if (this.subscriptions.get(topic)?.size === 0) {
          this.subscriptions.delete(topic);
        }
      });
    }

    this.clients.delete(clientId);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      
      this.clients.forEach((client, _clientId) => { // eslint-disable-line @typescript-eslint/no-unused-vars
        if (client.readyState === WebSocket.OPEN) {
          const timeSinceLastPing = now.getTime() - (client.lastPing?.getTime() || 0);
          
          if (timeSinceLastPing > 60000) { // 60 seconds timeout
            Logger.warn('Client heartbeat timeout', { clientId: _clientId });
            client.terminate();
            this.handleDisconnection(_clientId);
          } else {
            client.ping();
          }
        } else {
          this.handleDisconnection(_clientId);
        }
      });
    }, 30000); // Check every 30 seconds
  }

  // Public methods for broadcasting events

  public broadcastVehicleLocationUpdate(vehicleId: string, location: any): void {
    this.broadcastToTopic('vehicle_location_update', {
      vehicleId,
      location,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastRouteUpdate(routeId: string, update: any): void {
    this.broadcastToTopic('route_update', {
      routeId,
      update,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastBreakdownAlert(vehicleId: string, breakdown: any): void {
    this.broadcastToTopic('breakdown_alert', {
      vehicleId,
      breakdown,
      severity: breakdown.severity || 'medium',
      timestamp: new Date().toISOString()
    });
  }

  public broadcastTrafficUpdate(area: string, trafficData: any): void {
    this.broadcastToTopic('traffic_update', {
      area,
      trafficData,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastComplianceAlert(vehicleId: string, violation: any): void {
    this.broadcastToTopic('compliance_alert', {
      vehicleId,
      violation,
      timestamp: new Date().toISOString()
    });
  }

  public broadcastFleetMetrics(metrics: any): void {
    this.broadcastToTopic('fleet_metrics', {
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  private broadcastToTopic(topic: string, data: any): void {
    const subscribedClients = this.subscriptions.get(topic);
    
    if (!subscribedClients || subscribedClients.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: topic,
      data,
      timestamp: new Date()
    };

    subscribedClients.forEach(clientId => {
      this.sendToClient(clientId, message);
    });

    Logger.debug('Broadcasted to topic', { topic, clientCount: subscribedClients.size });
  }

  private sendToClient(_clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(_clientId);
    
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        Logger.error('Error sending WebSocket message', { clientId: _clientId, error: error.message });
        this.handleDisconnection(_clientId);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getTopicSubscriptions(): Record<string, number> {
    const result: Record<string, number> = {};
    this.subscriptions.forEach((clients, topic) => {
      result[topic] = clients.size;
    });
    return result;
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((client, clientId) => {
      client.close(1001, 'Server shutting down');
    });

    this.clients.clear();
    this.subscriptions.clear();
    
    Logger.info('WebSocket handler shutdown complete');
  }
}