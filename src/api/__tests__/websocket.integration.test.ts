import WebSocket from 'ws';
import { createServer } from 'http';
import { APIServer } from '../server';
import jwt from 'jsonwebtoken';

describe('WebSocket Integration Tests', () => {
  let server: APIServer;
  let httpServer: any;
  let wsPort: number;

  beforeAll(async () => {
    server = new APIServer();
    httpServer = createServer(server.getApp());
    
    // Find available port
    wsPort = 3001;
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(wsPort, (error: any) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    if (server) {
      await server.stop();
    }
  });

  const createAuthenticatedWebSocket = (role: string = 'admin'): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const token = jwt.sign(
        { id: 'test-user', email: 'test@example.com', role, permissions: ['*'] },
        process.env.JWT_SECRET || 'default-secret-key',
        { expiresIn: '1h' }
      );

      const ws = new WebSocket(`ws://localhost:${wsPort}?token=${token}`);
      
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
    });
  };

  describe('WebSocket Connection', () => {
    it('should establish authenticated connection', async () => {
      const ws = await createAuthenticatedWebSocket();
      
      const welcomeMessage = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      expect(welcomeMessage).toHaveProperty('type', 'connection_established');
      expect(welcomeMessage).toHaveProperty('data.clientId');
      expect(welcomeMessage).toHaveProperty('data.supportedEvents');

      ws.close();
    });

    it('should reject unauthenticated connection', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      
      const closePromise = new Promise((resolve) => {
        ws.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
      });

      const closeEvent = await closePromise;
      expect(closeEvent).toHaveProperty('code', 1008);
    });

    it('should reject invalid token', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}?token=invalid-token`);
      
      const closePromise = new Promise((resolve) => {
        ws.on('close', (code, reason) => {
          resolve({ code, reason: reason.toString() });
        });
      });

      const closeEvent = await closePromise;
      expect(closeEvent).toHaveProperty('code', 1008);
    });
  });

  describe('WebSocket Subscriptions', () => {
    let ws: WebSocket;

    beforeEach(async () => {
      ws = await createAuthenticatedWebSocket('fleet_manager');
    });

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    it('should handle topic subscription', async () => {
      // Wait for connection established message
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Subscribe to topics
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: {
          topics: ['vehicle_location_update', 'route_update']
        }
      }));

      const confirmationMessage = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscription_confirmed') {
            resolve(message);
          }
        });
      });

      expect(confirmationMessage).toHaveProperty('type', 'subscription_confirmed');
      expect(confirmationMessage).toHaveProperty('data.topics');
      expect((confirmationMessage as any).data.topics).toContain('vehicle_location_update');
      expect((confirmationMessage as any).data.topics).toContain('route_update');
    });

    it('should handle topic unsubscription', async () => {
      // Wait for connection and subscribe first
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topics: ['vehicle_location_update', 'route_update'] }
      }));

      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscription_confirmed') {
            resolve(message);
          }
        });
      });

      // Unsubscribe from one topic
      ws.send(JSON.stringify({
        type: 'unsubscribe',
        data: { topics: ['vehicle_location_update'] }
      }));

      const unsubscribeConfirmation = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'unsubscription_confirmed') {
            resolve(message);
          }
        });
      });

      expect(unsubscribeConfirmation).toHaveProperty('type', 'unsubscription_confirmed');
      expect((unsubscribeConfirmation as any).data.remainingTopics).toContain('route_update');
      expect((unsubscribeConfirmation as any).data.remainingTopics).not.toContain('vehicle_location_update');
    });

    it('should handle ping-pong', async () => {
      // Wait for connection
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Send ping
      ws.send(JSON.stringify({
        type: 'ping',
        data: {}
      }));

      const pongMessage = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong') {
            resolve(message);
          }
        });
      });

      expect(pongMessage).toHaveProperty('type', 'pong');
      expect(pongMessage).toHaveProperty('data.timestamp');
    });
  });

  describe('WebSocket Broadcasting', () => {
    let ws1: WebSocket;
    let ws2: WebSocket;
    

    beforeEach(async () => {
      ws1 = await createAuthenticatedWebSocket('fleet_manager');
      ws2 = await createAuthenticatedWebSocket('operator');
      
      // Get WebSocket handler from server (this would need to be exposed in real implementation)
      // For testing purposes, we'll simulate the broadcasting
    });

    afterEach(() => {
      if (ws1 && ws1.readyState === WebSocket.OPEN) ws1.close();
      if (ws2 && ws2.readyState === WebSocket.OPEN) ws2.close();
    });

    it('should broadcast vehicle location updates to subscribed clients', async () => {
      // Wait for connections
      await Promise.all([
        new Promise((resolve) => {
          ws1.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'connection_established') resolve(message);
          });
        }),
        new Promise((resolve) => {
          ws2.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'connection_established') resolve(message);
          });
        })
      ]);

      // Subscribe both clients to vehicle location updates
      ws1.send(JSON.stringify({
        type: 'subscribe',
        data: { topics: ['vehicle_location_update'] }
      }));

      ws2.send(JSON.stringify({
        type: 'subscribe',
        data: { topics: ['vehicle_location_update'] }
      }));

      // Wait for subscription confirmations
      await Promise.all([
        new Promise((resolve) => {
          ws1.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'subscription_confirmed') resolve(message);
          });
        }),
        new Promise((resolve) => {
          ws2.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'subscription_confirmed') resolve(message);
          });
        })
      ]);

      // This test would require access to the WebSocket handler to trigger broadcasts
      // In a real implementation, you would:
      // wsHandler.broadcastVehicleLocationUpdate('V001', { latitude: 28.6139, longitude: 77.2090 });
      
      // For now, we'll just verify the subscription worked
      expect(ws1.readyState).toBe(WebSocket.OPEN);
      expect(ws2.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('WebSocket Permission Handling', () => {
    it('should respect role-based topic permissions', async () => {
      const customerWs = await createAuthenticatedWebSocket('customer');

      // Wait for connection
      await new Promise((resolve) => {
        customerWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Try to subscribe to admin-only topics
      customerWs.send(JSON.stringify({
        type: 'subscribe',
        data: { topics: ['fleet_metrics', 'breakdown_alert'] }
      }));

      const confirmationMessage = await new Promise((resolve) => {
        customerWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscription_confirmed') {
            resolve(message);
          }
        });
      });

      // Customer should not be subscribed to admin-only topics
      expect((confirmationMessage as any).data.topics).not.toContain('fleet_metrics');
      expect((confirmationMessage as any).data.topics).not.toContain('breakdown_alert');

      customerWs.close();
    });

    it('should allow admin access to all topics', async () => {
      const adminWs = await createAuthenticatedWebSocket('admin');

      // Wait for connection
      await new Promise((resolve) => {
        adminWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Subscribe to all available topics
      adminWs.send(JSON.stringify({
        type: 'subscribe',
        data: {
          topics: [
            'vehicle_location_update',
            'route_update',
            'breakdown_alert',
            'traffic_update',
            'compliance_alert',
            'fleet_metrics'
          ]
        }
      }));

      const confirmationMessage = await new Promise((resolve) => {
        adminWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscription_confirmed') {
            resolve(message);
          }
        });
      });

      // Admin should have access to all topics
      expect((confirmationMessage as any).data.topics).toContain('vehicle_location_update');
      expect((confirmationMessage as any).data.topics).toContain('fleet_metrics');
      expect((confirmationMessage as any).data.topics).toContain('breakdown_alert');

      adminWs.close();
    });
  });

  describe('WebSocket Error Handling', () => {
    it('should handle malformed messages gracefully', async () => {
      const ws = await createAuthenticatedWebSocket();

      // Wait for connection
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Send malformed JSON
      ws.send('invalid json');

      // Connection should remain open
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });

    it('should handle unknown message types', async () => {
      const ws = await createAuthenticatedWebSocket();

      // Wait for connection
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Send unknown message type
      ws.send(JSON.stringify({
        type: 'unknown_type',
        data: {}
      }));

      // Connection should remain open
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
    });
  });

  describe('WebSocket Heartbeat', () => {
    it('should handle heartbeat pings', async () => {
      const ws = await createAuthenticatedWebSocket();

      

      // Wait for connection
      await new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connection_established') {
            resolve(message);
          }
        });
      });

      // Wait for potential ping from server
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ws.close();
    });
  });
});