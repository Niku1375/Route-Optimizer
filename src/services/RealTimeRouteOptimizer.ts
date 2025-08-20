/**
 * Real-Time Route Optimization Service
 * Implements dynamic route re-optimization with traffic and vehicle status monitoring
 */

import { Route } from '../models/Route';
import { Vehicle } from '../models/Vehicle';
import { Delivery } from '../models/Delivery';
import { TrafficData } from '../models/Traffic';
import { GeoLocation, GeoArea } from '../models/GeoLocation';
import { RoutingService, RoutingRequest } from './RoutingService';
import { TrafficPredictionService } from './TrafficPredictionService';
import { FleetService } from './FleetService';
import Logger from '../utils/logger';
import { EventEmitter } from 'events';

export interface ReOptimizationTrigger {
  type: 'traffic_change' | 'vehicle_breakdown' | 'delivery_update' | 'compliance_change' | 'manual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedRoutes: string[];
  timestamp: Date;
  metadata?: any;
}

export interface ReOptimizationResult {
  success: boolean;
  triggerId: string;
  originalRoutes: Route[];
  optimizedRoutes: Route[];
  improvements: RouteImprovement[];
  processingTime: number;
  message?: string;
}

export interface RouteImprovement {
  routeId: string;
  timeSavingMinutes: number;
  distanceSavingKm: number;
  fuelSavingLiters: number;
  complianceImprovements: string[];
}

export interface RouteMonitoringConfig {
  trafficCheckInterval: number; // milliseconds
  vehicleStatusCheckInterval: number; // milliseconds
  significantTrafficChangeThreshold: number; // percentage
  significantDelayThreshold: number; // minutes
  maxReOptimizationFrequency: number; // per hour
  enableProactiveOptimization: boolean;
}

export interface RouteUpdateBroadcast {
  routeId: string;
  vehicleId: string;
  updateType: 'route_change' | 'stop_reorder' | 'time_adjustment' | 'alternative_route';
  newRoute: Route;
  reason: string;
  timestamp: Date;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Real-Time Route Optimizer with dynamic re-optimization capabilities
 */
export class RealTimeRouteOptimizer extends EventEmitter {
  private routingService: RoutingService;
  private trafficService: TrafficPredictionService;
  private fleetService: FleetService;
  private config: RouteMonitoringConfig;
  
  private activeRoutes: Map<string, Route> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reOptimizationHistory: Map<string, Date[]> = new Map();
  private lastTrafficData: Map<string, TrafficData> = new Map();

  constructor(
    routingService: RoutingService,
    trafficService: TrafficPredictionService,
    fleetService: FleetService,
    config: Partial<RouteMonitoringConfig> = {}
  ) {
    super();
    
    this.routingService = routingService;
    this.trafficService = trafficService;
    this.fleetService = fleetService;
    
    this.config = {
      trafficCheckInterval: 5 * 60 * 1000, // 5 minutes
      vehicleStatusCheckInterval: 2 * 60 * 1000, // 2 minutes
      significantTrafficChangeThreshold: 25, // 25% change
      significantDelayThreshold: 15, // 15 minutes
      maxReOptimizationFrequency: 3, // 3 times per hour
      enableProactiveOptimization: true,
      ...config
    };

    Logger.info('RealTimeRouteOptimizer initialized', { config: this.config });
  }

  /**
   * Starts monitoring active routes for optimization opportunities
   * @param routes - Routes to monitor
   */
  async startRouteMonitoring(routes: Route[]): Promise<void> {
    Logger.info('Starting route monitoring', { routeCount: routes.length });

    for (const route of routes) {
      if (route.status === 'active' || route.status === 'planned') {
        this.activeRoutes.set(route.id, route);
        await this.setupRouteMonitoring(route);
      }
    }

    this.emit('monitoring_started', { routeCount: routes.length });
  }

  /**
   * Stops monitoring for a specific route
   * @param routeId - Route ID to stop monitoring
   */
  stopRouteMonitoring(routeId: string): void {
    const interval = this.monitoringIntervals.get(routeId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(routeId);
    }
    
    this.activeRoutes.delete(routeId);
    this.lastTrafficData.delete(routeId);
    
    Logger.info('Stopped monitoring route', { routeId });
  }

  /**
   * Detects significant changes that trigger re-optimization
   * @param routeId - Route to check for changes
   * @returns Array of detected triggers
   */
  async detectSignificantChanges(routeId: string): Promise<ReOptimizationTrigger[]> {
    const route = this.activeRoutes.get(routeId);
    if (!route) return [];

    const triggers: ReOptimizationTrigger[] = [];

    try {
      // Check traffic changes
      const trafficTriggers = await this.detectTrafficChanges(route);
      triggers.push(...trafficTriggers);

      // Check vehicle status changes
      const vehicleTriggers = await this.detectVehicleStatusChanges(route);
      triggers.push(...vehicleTriggers);

      // Check delivery updates
      const deliveryTriggers = await this.detectDeliveryUpdates(route);
      triggers.push(...deliveryTriggers);

      // Check compliance changes
      const complianceTriggers = await this.detectComplianceChanges(route);
      triggers.push(...complianceTriggers);

    } catch (error) {
      Logger.error('Error detecting changes for route', { 
        routeId, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    return triggers;
  }

  /**
   * Performs incremental re-optimization using OR-Tools
   * @param trigger - Trigger that initiated re-optimization
   * @returns Re-optimization result
   */
  async performIncrementalReOptimization(trigger: ReOptimizationTrigger): Promise<ReOptimizationResult> {
    const startTime = Date.now();
    const triggerId = `reopt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    Logger.info('Starting incremental re-optimization', { 
      triggerId, 
      trigger: trigger.type,
      affectedRoutes: trigger.affectedRoutes.length 
    });

    try {
      // Check re-optimization frequency limits
      if (!this.canReOptimize(trigger.affectedRoutes)) {
        return {
          success: false,
          triggerId,
          originalRoutes: [],
          optimizedRoutes: [],
          improvements: [],
          processingTime: Date.now() - startTime,
          message: 'Re-optimization frequency limit exceeded'
        };
      }

      // Get affected routes
      const originalRoutes = trigger.affectedRoutes
        .map(routeId => this.activeRoutes.get(routeId))
        .filter((route): route is Route => route !== undefined);

      if (originalRoutes.length === 0) {
        return {
          success: false,
          triggerId,
          originalRoutes: [],
          optimizedRoutes: [],
          improvements: [],
          processingTime: Date.now() - startTime,
          message: 'No valid routes found for re-optimization'
        };
      }

      // Prepare routing request for re-optimization
      const routingRequest = await this.prepareReOptimizationRequest(originalRoutes, trigger);

      // Perform optimization
      const optimizationResult = await this.routingService.optimizeRoutes(routingRequest);

      if (!optimizationResult.success) {
        Logger.warn('Re-optimization failed, keeping original routes', { triggerId });
        return {
          success: false,
          triggerId,
          originalRoutes,
          optimizedRoutes: originalRoutes,
          improvements: [],
          processingTime: Date.now() - startTime,
          message: optimizationResult.message || 'Optimization failed'
        };
      }

      // Calculate improvements
      const improvements = this.calculateRouteImprovements(originalRoutes, optimizationResult.routes);

      // Update active routes
      for (const newRoute of optimizationResult.routes) {
        this.activeRoutes.set(newRoute.id, newRoute);
      }

      // Record re-optimization
      this.recordReOptimization(trigger.affectedRoutes);

      const processingTime = Date.now() - startTime;

      Logger.info('Incremental re-optimization completed', {
        triggerId,
        routesOptimized: optimizationResult.routes.length,
        totalImprovement: improvements.reduce((sum, imp) => sum + imp.timeSavingMinutes, 0),
        processingTime
      });

      // Broadcast updates
      await this.broadcastRouteUpdates(optimizationResult.routes, trigger);

      return {
        success: true,
        triggerId,
        originalRoutes,
        optimizedRoutes: optimizationResult.routes,
        improvements,
        processingTime
      };

    } catch (error) {
      Logger.error('Re-optimization failed', { 
        triggerId, 
        error: error instanceof Error ? error.message : String(error) 
      });

      return {
        success: false,
        triggerId,
        originalRoutes: [],
        optimizedRoutes: [],
        improvements: [],
        processingTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Broadcasts route updates to affected vehicles and dashboards
   * @param routes - Updated routes
   * @param trigger - Trigger that caused the update
   */
  async broadcastRouteUpdates(routes: Route[], trigger: ReOptimizationTrigger): Promise<void> {
    const broadcasts: RouteUpdateBroadcast[] = [];

    for (const route of routes) {
      const broadcast: RouteUpdateBroadcast = {
        routeId: route.id,
        vehicleId: route.vehicleId,
        updateType: this.determineUpdateType(trigger),
        newRoute: route,
        reason: trigger.description,
        timestamp: new Date(),
        urgency: this.mapSeverityToUrgency(trigger.severity)
      };

      broadcasts.push(broadcast);
    }

    // Emit events for real-time updates
    this.emit('route_updates', broadcasts);

    // Log broadcast
    Logger.info('Route updates broadcasted', {
      updateCount: broadcasts.length,
      triggerType: trigger.type,
      urgency: broadcasts[0]?.urgency
    });

    // In a real implementation, this would also:
    // - Send push notifications to mobile apps
    // - Update dashboard displays
    // - Send messages to vehicle telematics systems
    // - Update customer notifications
  }

  /**
   * Sets up monitoring for a specific route
   * @param route - Route to monitor
   */
  private async setupRouteMonitoring(route: Route): Promise<void> {
    // Set up periodic monitoring
    const monitoringInterval = setInterval(async () => {
      const triggers = await this.detectSignificantChanges(route.id);
      
      if (triggers.length > 0) {
        Logger.info('Detected optimization triggers', { 
          routeId: route.id, 
          triggerCount: triggers.length 
        });

        // Process high and critical severity triggers immediately
        const urgentTriggers = triggers.filter(t => t.severity === 'high' || t.severity === 'critical');
        
        for (const trigger of urgentTriggers) {
          const result = await this.performIncrementalReOptimization(trigger);
          this.emit('reoptimization_completed', result);
        }

        // Queue medium and low severity triggers for batch processing
        const nonUrgentTriggers = triggers.filter(t => t.severity === 'low' || t.severity === 'medium');
        if (nonUrgentTriggers.length > 0) {
          this.emit('triggers_detected', nonUrgentTriggers);
        }
      }
    }, this.config.trafficCheckInterval);

    this.monitoringIntervals.set(route.id, monitoringInterval);
  }

  /**
   * Detects traffic-related changes that may require re-optimization
   * @param route - Route to check
   * @returns Array of traffic-related triggers
   */
  private async detectTrafficChanges(route: Route): Promise<ReOptimizationTrigger[]> {
    const triggers: ReOptimizationTrigger[] = [];

    try {
      // Get current traffic data for route segments
      for (let i = 0; i < route.stops.length - 1; i++) {
        const fromStop = route.stops[i]!;
        const toStop = route.stops[i + 1]!;
        
        const area: GeoArea = {
          id: 'route-area',
          name: 'Route Area',
          boundaries: [fromStop.location],
          zoneType: 'commercial'
        };

        const currentTraffic = await this.trafficService.getCurrentTraffic(area);
        const cacheKey = `${route.id}_${i}`;
        const lastTraffic = this.lastTrafficData.get(cacheKey);

        if (lastTraffic) {
          // Check for significant traffic changes
          const trafficChange = this.calculateTrafficChange(lastTraffic, currentTraffic);
          
          if (trafficChange.isSignificant) {
            triggers.push({
              type: 'traffic_change',
              severity: trafficChange.severity,
              description: `Traffic congestion ${trafficChange.changeType} by ${trafficChange.changePercentage}% between ${fromStop.location.address} and ${toStop.location.address}`,
              affectedRoutes: [route.id],
              timestamp: new Date(),
              metadata: {
                segment: i,
                oldTraffic: lastTraffic,
                newTraffic: currentTraffic,
                changePercentage: trafficChange.changePercentage
              }
            });
          }
        }

        // Update cache
        this.lastTrafficData.set(cacheKey, currentTraffic);
      }

      // Check for traffic alerts
      const routeArea: GeoArea = {
        id: 'route-area',
        name: 'Route Area',
        boundaries: [route.stops[0]!.location],
        zoneType: 'commercial'
      };

      const alerts = await this.trafficService.getTrafficAlerts(routeArea);
      
      for (const alert of alerts) {
        if (this.isAlertRelevantToRoute(alert, route)) {
          triggers.push({
            type: 'traffic_change',
            severity: this.mapAlertSeverityToTriggerSeverity(alert.severity),
            description: `Traffic alert: ${alert.description}`,
            affectedRoutes: [route.id],
            timestamp: new Date(),
            metadata: { alert }
          });
        }
      }

    } catch (error) {
      Logger.error('Error detecting traffic changes', { 
        routeId: route.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    return triggers;
  }

  /**
   * Detects vehicle status changes that may require re-optimization
   * @param route - Route to check
   * @returns Array of vehicle status triggers
   */
  private async detectVehicleStatusChanges(_route: Route): Promise<ReOptimizationTrigger[]> {
    const triggers: ReOptimizationTrigger[] = [];

    try {
      const vehicle = await this.fleetService.getVehicle(_route.vehicleId);
      
      if (!vehicle) {
        triggers.push({
          type: 'vehicle_breakdown',
          severity: 'critical',
          description: `Vehicle ${_route.vehicleId} not found`,
          affectedRoutes: [_route.id],
          timestamp: new Date()
        });
        return triggers;
      }

      // Check for vehicle breakdown or maintenance
      if (vehicle.status === 'breakdown' || vehicle.status === 'maintenance') {
        triggers.push({
          type: 'vehicle_breakdown',
          severity: 'critical',
          description: `Vehicle ${vehicle.id} status changed to ${vehicle.status}`,
          affectedRoutes: [_route.id],
          timestamp: new Date(),
          metadata: { vehicle }
        });
      }

      // Check for significant location deviations
      const currentStop = _route.stops.find(stop => stop.status === 'pending') || _route.stops[0];
      if (currentStop && vehicle.location) {
        const distanceFromRoute = this.calculateDistanceFromRoute(vehicle.location, currentStop.location);
        
        if (distanceFromRoute > 2) { // More than 2km off route
          triggers.push({
            type: 'vehicle_breakdown',
            severity: 'medium',
            description: `Vehicle ${vehicle.id} is ${distanceFromRoute.toFixed(1)}km off planned route`,
            affectedRoutes: [_route.id],
            timestamp: new Date(),
            metadata: { 
              vehicle, 
              expectedLocation: currentStop.location,
              actualLocation: vehicle.location,
              deviation: distanceFromRoute
            }
          });
        }
      }

    } catch (error) {
      Logger.error('Error detecting vehicle status changes', { 
        routeId: _route.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }

    return triggers;
  }

  /**
   * Detects delivery updates that may require re-optimization
   * @param route - Route to check
   * @returns Array of delivery update triggers
   */
  private async detectDeliveryUpdates(_route: Route): Promise<ReOptimizationTrigger[]> {
    const triggers: ReOptimizationTrigger[] = [];

    // In a real implementation, this would check for:
    // - New urgent deliveries added
    // - Delivery cancellations
    // - Time window changes
    // - Address changes
    // - Priority changes

    // Placeholder implementation
    return triggers;
  }

  /**
   * Detects compliance changes that may require re-optimization
   * @param route - Route to check
   * @returns Array of compliance triggers
   */
  private async detectComplianceChanges(_route: Route): Promise<ReOptimizationTrigger[]> {
    const triggers: ReOptimizationTrigger[] = [];

    // In a real implementation, this would check for:
    // - New odd-even restrictions
    // - Pollution emergency declarations
    // - Zone access changes
    // - Time restriction updates

    // Placeholder implementation
    return triggers;
  }

  /**
   * Calculates traffic change between two traffic data points
   * @param oldTraffic - Previous traffic data
   * @param newTraffic - Current traffic data
   * @returns Traffic change analysis
   */
  private calculateTrafficChange(oldTraffic: TrafficData, newTraffic: TrafficData): {
    isSignificant: boolean;
    changePercentage: number;
    changeType: 'increased' | 'decreased';
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const oldMultiplier = oldTraffic.travelTimeMultiplier;
    const newMultiplier = newTraffic.travelTimeMultiplier;
    
    const changePercentage = Math.abs((newMultiplier - oldMultiplier) / oldMultiplier) * 100;
    const changeType = newMultiplier > oldMultiplier ? 'increased' : 'decreased';
    
    const isSignificant = changePercentage >= this.config.significantTrafficChangeThreshold;
    
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (changePercentage >= 50) severity = 'critical';
    else if (changePercentage >= 35) severity = 'high';
    else if (changePercentage >= 25) severity = 'medium';

    return {
      isSignificant,
      changePercentage,
      changeType,
      severity
    };
  }

  /**
   * Checks if re-optimization is allowed based on frequency limits
   * @param routeIds - Routes to check
   * @returns Boolean indicating if re-optimization is allowed
   */
  private canReOptimize(routeIds: string[]): boolean {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const routeId of routeIds) {
      const history = this.reOptimizationHistory.get(routeId) || [];
      const recentOptimizations = history.filter(date => date > oneHourAgo);
      
      if (recentOptimizations.length >= this.config.maxReOptimizationFrequency) {
        Logger.warn('Re-optimization frequency limit exceeded', { 
          routeId, 
          recentCount: recentOptimizations.length,
          limit: this.config.maxReOptimizationFrequency 
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Records re-optimization for frequency tracking
   * @param routeIds - Routes that were re-optimized
   */
  private recordReOptimization(routeIds: string[]): void {
    const now = new Date();
    
    for (const routeId of routeIds) {
      const history = this.reOptimizationHistory.get(routeId) || [];
      history.push(now);
      
      // Keep only last 24 hours of history
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const filteredHistory = history.filter(date => date > oneDayAgo);
      
      this.reOptimizationHistory.set(routeId, filteredHistory);
    }
  }

  /**
   * Prepares routing request for re-optimization
   * @param routes - Routes to re-optimize
   * @param trigger - Trigger that initiated re-optimization
   * @returns Routing request
   */
  private async prepareReOptimizationRequest(routes: Route[], _trigger: ReOptimizationTrigger): Promise<RoutingRequest> {
    // This is a simplified implementation
    // In practice, this would reconstruct the full routing request
    // with current vehicle positions, remaining deliveries, etc.
    
    const vehicles: Vehicle[] = [];
    const deliveries: Delivery[] = [];
    
    // Get current vehicle states
    for (const route of routes) {
      const vehicle = await this.fleetService.getVehicle(route.vehicleId);
      if (vehicle) {
        vehicles.push(vehicle);
      }
    }

    return {
      vehicles,
      deliveries,
      hubs: [],
      constraints: {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: true,
        hubSequencing: false
      },
      timeWindow: {
        earliest: new Date(),
        latest: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours from now
      }
    };
  }

  /**
   * Calculates improvements between original and optimized routes
   * @param originalRoutes - Original routes
   * @param optimizedRoutes - Optimized routes
   * @returns Array of route improvements
   */
  private calculateRouteImprovements(originalRoutes: Route[], optimizedRoutes: Route[]): RouteImprovement[] {
    const improvements: RouteImprovement[] = [];

    for (const optimizedRoute of optimizedRoutes) {
      const originalRoute = originalRoutes.find(r => r.id === optimizedRoute.id);
      
      if (originalRoute) {
        const timeSaving = originalRoute.estimatedDuration - optimizedRoute.estimatedDuration;
        const distanceSaving = originalRoute.estimatedDistance - optimizedRoute.estimatedDistance;
        const fuelSaving = originalRoute.estimatedFuelConsumption - optimizedRoute.estimatedFuelConsumption;

        improvements.push({
          routeId: optimizedRoute.id,
          timeSavingMinutes: Math.max(0, timeSaving),
          distanceSavingKm: Math.max(0, distanceSaving),
          fuelSavingLiters: Math.max(0, fuelSaving),
          complianceImprovements: [] // Would be calculated based on compliance validation
        });
      }
    }

    return improvements;
  }

  /**
   * Determines update type based on trigger
   * @param trigger - Re-optimization trigger
   * @returns Update type
   */
  private determineUpdateType(trigger: ReOptimizationTrigger): RouteUpdateBroadcast['updateType'] {
    switch (trigger.type) {
      case 'traffic_change':
        return 'alternative_route';
      case 'vehicle_breakdown':
        return 'route_change';
      case 'delivery_update':
        return 'stop_reorder';
      case 'compliance_change':
        return 'time_adjustment';
      default:
        return 'route_change';
    }
  }

  /**
   * Maps trigger severity to broadcast urgency
   * @param severity - Trigger severity
   * @returns Broadcast urgency
   */
  private mapSeverityToUrgency(severity: ReOptimizationTrigger['severity']): RouteUpdateBroadcast['urgency'] {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Checks if a traffic alert is relevant to a route
   * @param alert - Traffic alert
   * @param route - Route to check
   * @returns Boolean indicating relevance
   */
  private isAlertRelevantToRoute(_alert: any, _route: Route): boolean {
    // Simplified implementation - would use more sophisticated geo-matching
    return true;
  }

  /**
   * Maps alert severity to trigger severity
   * @param alertSeverity - Alert severity
   * @returns Trigger severity
   */
  private mapAlertSeverityToTriggerSeverity(alertSeverity: string): ReOptimizationTrigger['severity'] {
    switch (alertSeverity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Calculates distance from vehicle location to route
   * @param vehicleLocation - Current vehicle location
   * @param routeLocation - Expected route location
   * @returns Distance in kilometers
   */
  private calculateDistanceFromRoute(vehicleLocation: GeoLocation, routeLocation: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(routeLocation.latitude - vehicleLocation.latitude);
    const dLon = this.toRadians(routeLocation.longitude - vehicleLocation.longitude);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(vehicleLocation.latitude)) * Math.cos(this.toRadians(routeLocation.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts degrees to radians
   * @param degrees - Angle in degrees
   * @returns Angle in radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}