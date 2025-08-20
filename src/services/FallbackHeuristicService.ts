/**
 * Fallback Heuristic Algorithms Service
 * Implements nearest neighbor and greedy assignment algorithms as fallback for OR-Tools failures
 */

import { Vehicle } from '../models/Vehicle';
import { Delivery } from '../models/Delivery';
import { Route, RouteStop } from '../models/Route';
import { GeoLocation } from '../models/GeoLocation';
import { Capacity, TimeWindow } from '../models/Common';
import { RoutingRequest, RouteOptimizationResult, DistanceMatrix } from './RoutingService';
import { DelhiComplianceService } from './DelhiComplianceService';
import Logger from '../utils/logger';

export interface HeuristicAlgorithmResult {
  routes: Route[];
  totalDistance: number;
  totalDuration: number;
  algorithmUsed: string;
  processingTime: number;
  feasible: boolean;
  unassignedDeliveries: Delivery[];
}

export interface NearestNeighborConfig {
  startFromDepot: boolean;
  considerCapacityConstraints: boolean;
  considerTimeWindows: boolean;
  considerComplianceRules: boolean;
}

export interface GreedyAssignmentConfig {
  prioritizeByDistance: boolean;
  prioritizeByCapacity: boolean;
  prioritizeByTimeWindow: boolean;
  allowPartialAssignment: boolean;
}

export interface EmergencyRoutingConfig {
  maxRouteDistance: number; // km
  maxRouteDuration: number; // minutes
  ignoreNonCriticalConstraints: boolean;
  prioritizeUrgentDeliveries: boolean;
}

/**
 * Fallback Heuristic Service for emergency routing scenarios
 */
export class FallbackHeuristicService {
  private delhiComplianceService: DelhiComplianceService;

  constructor() {
    this.delhiComplianceService = new DelhiComplianceService();
  }

  /**
   * Implements nearest neighbor algorithm as fallback for OR-Tools failures
   * @param request - Routing request
   * @param distanceMatrix - Pre-calculated distance matrix
   * @param config - Algorithm configuration
   * @returns Heuristic algorithm result
   */
    async nearestNeighborAlgorithm(
    request: RoutingRequest,
    _distanceMatrix: DistanceMatrix,
    config: Partial<NearestNeighborConfig> = {}
  ): Promise<HeuristicAlgorithmResult> {
    const startTime = Date.now();
    
    const algorithmConfig: NearestNeighborConfig = {
      startFromDepot: true,
      considerCapacityConstraints: true,
      considerTimeWindows: true,
      considerComplianceRules: true,
      ...config
    };

    Logger.info('Starting nearest neighbor algorithm', {
      vehicleCount: request.vehicles.length,
      deliveryCount: request.deliveries.length,
      config: algorithmConfig
    });

    try {
      const routes: Route[] = [];
      const unassignedDeliveries: Delivery[] = [];
      const availableVehicles = request.vehicles.filter(v => v.status === 'available');

      // Filter compliant vehicles if compliance checking is enabled
      let workingVehicles = availableVehicles;
      if (algorithmConfig.considerComplianceRules) {
        workingVehicles = await this.filterCompliantVehicles(availableVehicles, request);
      }

      if (workingVehicles.length === 0) {
        Logger.warn('No compliant vehicles available for nearest neighbor algorithm');
        return {
          routes: [],
          totalDistance: 0,
          totalDuration: 0,
          algorithmUsed: 'NEAREST_NEIGHBOR',
          processingTime: Date.now() - startTime,
          feasible: false,
          unassignedDeliveries: [...request.deliveries]
        };
      }

      // Create a copy of deliveries to track assignments
      const remainingDeliveries = [...request.deliveries];

      // Assign deliveries to vehicles using nearest neighbor
      for (const vehicle of workingVehicles) {
        if (remainingDeliveries.length === 0) break;

        const route = await this.buildNearestNeighborRoute(
          vehicle,
          remainingDeliveries,
          _distanceMatrix,
          request,
          algorithmConfig
        );

        if (route.stops.length > 0) {
          routes.push(route);
          
          // Remove assigned deliveries
          const assignedDeliveryIds = route.deliveryIds || [];
          for (let i = remainingDeliveries.length - 1; i >= 0; i--) {
            if (assignedDeliveryIds.includes(remainingDeliveries[i]!.id)) {
              remainingDeliveries.splice(i, 1);
            }
          }
        }
      }

      // Add remaining deliveries to unassigned list
      unassignedDeliveries.push(...remainingDeliveries);

      const totalDistance = routes.reduce((sum, route) => sum + route.estimatedDistance, 0);
      const totalDuration = routes.reduce((sum, route) => sum + route.estimatedDuration, 0);
      const processingTime = Date.now() - startTime;

      Logger.info('Nearest neighbor algorithm completed', {
        routesCreated: routes.length,
        deliveriesAssigned: request.deliveries.length - unassignedDeliveries.length,
        unassignedCount: unassignedDeliveries.length,
        totalDistance,
        processingTime
      });

      return {
        routes,
        totalDistance,
        totalDuration,
        algorithmUsed: 'NEAREST_NEIGHBOR',
        processingTime,
        feasible: unassignedDeliveries.length === 0,
        unassignedDeliveries
      };

    } catch (error) {
      Logger.error('Nearest neighbor algorithm failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        algorithmUsed: 'NEAREST_NEIGHBOR',
        processingTime: Date.now() - startTime,
        feasible: false,
        unassignedDeliveries: [...request.deliveries]
      };
    }
  }

  /**
   * Implements greedy assignment heuristics with capacity constraints
   * @param request - Routing request
   * @param distanceMatrix - Pre-calculated distance matrix
   * @param config - Algorithm configuration
   * @returns Heuristic algorithm result
   */
  async greedyAssignmentHeuristic(
    request: RoutingRequest,
    _distanceMatrix: DistanceMatrix,
    config: Partial<GreedyAssignmentConfig> = {}
  ): Promise<HeuristicAlgorithmResult> {
    const startTime = Date.now();
    
    const algorithmConfig: GreedyAssignmentConfig = {
      prioritizeByDistance: true,
      prioritizeByCapacity: true,
      prioritizeByTimeWindow: true,
      allowPartialAssignment: true,
      ...config
    };

    Logger.info('Starting greedy assignment heuristic', {
      vehicleCount: request.vehicles.length,
      deliveryCount: request.deliveries.length,
      config: algorithmConfig
    });

    try {
      const routes: Route[] = [];
      const unassignedDeliveries: Delivery[] = [];
      const availableVehicles = request.vehicles.filter(v => v.status === 'available');

      // Initialize routes for each vehicle
      const vehicleRoutes = new Map<string, {
        vehicle: Vehicle;
        stops: RouteStop[];
        currentLoad: Capacity;
        currentLocation: GeoLocation;
        totalDistance: number;
        totalDuration: number;
      }>();

      for (const vehicle of availableVehicles) {
        vehicleRoutes.set(vehicle.id, {
          vehicle,
          stops: [],
          currentLoad: { weight: 0, volume: 0 },
          currentLocation: vehicle.location,
          totalDistance: 0,
          totalDuration: 0
        });
      }

      // Create delivery assignments with scores
      const deliveryAssignments = await this.calculateDeliveryAssignmentScores(
        request.deliveries,
        availableVehicles,
        _distanceMatrix,
        algorithmConfig
      );

      // Sort assignments by score (best first)
      deliveryAssignments.sort((a, b) => b.score - a.score);

      // Assign deliveries greedily
      for (const assignment of deliveryAssignments) {
        const vehicleRoute = vehicleRoutes.get(assignment.vehicleId);
        const delivery = assignment.delivery;

        if (!vehicleRoute) continue;

        // Check capacity constraints
        if (algorithmConfig.prioritizeByCapacity) {
          const newWeight = vehicleRoute.currentLoad.weight + delivery.shipment.weight;
          const newVolume = vehicleRoute.currentLoad.volume + delivery.shipment.volume;

          if (newWeight > vehicleRoute.vehicle.capacity.weight || 
              newVolume > vehicleRoute.vehicle.capacity.volume) {
            continue; // Skip this assignment
          }
        }

        // Check compliance constraints
        const canServe = await this.canVehicleServeDelivery(
          vehicleRoute.vehicle,
          delivery,
          request.timeWindow
        );

        if (!canServe) {
          continue; // Skip this assignment
        }

        // Add pickup and delivery stops
        const pickupStop = this.createRouteStop(
          delivery.pickupLocation,
          'pickup',
          delivery.id,
          vehicleRoute.stops.length
        );

        const deliveryStop = this.createRouteStop(
          delivery.deliveryLocation,
          'delivery',
          delivery.id,
          vehicleRoute.stops.length + 1
        );

        vehicleRoute.stops.push(pickupStop, deliveryStop);

        // Update load and location
        vehicleRoute.currentLoad.weight += delivery.shipment.weight;
        vehicleRoute.currentLoad.volume += delivery.shipment.volume;
        vehicleRoute.currentLocation = delivery.deliveryLocation;

        // Update distance and duration
        const additionalDistance = this.calculateAdditionalDistance(
          vehicleRoute.currentLocation,
          delivery.pickupLocation,
          delivery.deliveryLocation,
          _distanceMatrix
        );

        vehicleRoute.totalDistance += additionalDistance.distance;
        vehicleRoute.totalDuration += additionalDistance.duration;
      }

      // Convert vehicle routes to Route objects
      for (const [vehicleId, vehicleRoute] of vehicleRoutes) {
        if (vehicleRoute.stops.length > 0) {
          const route: Route = {
            id: `route_${vehicleId}_${Date.now()}`,
            vehicleId,
            stops: vehicleRoute.stops,
            estimatedDistance: vehicleRoute.totalDistance,
            estimatedDuration: vehicleRoute.totalDuration,
            estimatedFuelConsumption: this.calculateFuelConsumption(vehicleRoute.totalDistance),
            trafficFactors: [],
            status: 'planned',
            deliveryIds: vehicleRoute.stops
              .filter(stop => stop.deliveryId)
              .map(stop => stop.deliveryId!)
              .filter((id, index, arr) => arr.indexOf(id) === index), // Remove duplicates
            routeType: 'direct'
          };

          routes.push(route);
        }
      }

      // Find unassigned deliveries
      const assignedDeliveryIds = new Set(
        routes.flatMap(route => route.deliveryIds || [])
      );

      for (const delivery of request.deliveries) {
        if (!assignedDeliveryIds.has(delivery.id)) {
          unassignedDeliveries.push(delivery);
        }
      }

      const totalDistance = routes.reduce((sum, route) => sum + route.estimatedDistance, 0);
      const totalDuration = routes.reduce((sum, route) => sum + route.estimatedDuration, 0);
      const processingTime = Date.now() - startTime;

      Logger.info('Greedy assignment heuristic completed', {
        routesCreated: routes.length,
        deliveriesAssigned: request.deliveries.length - unassignedDeliveries.length,
        unassignedCount: unassignedDeliveries.length,
        totalDistance,
        processingTime
      });

      return {
        routes,
        totalDistance,
        totalDuration,
        algorithmUsed: 'GREEDY_ASSIGNMENT',
        processingTime,
        feasible: unassignedDeliveries.length === 0,
        unassignedDeliveries
      };

    } catch (error) {
      Logger.error('Greedy assignment heuristic failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        algorithmUsed: 'GREEDY_ASSIGNMENT',
        processingTime: Date.now() - startTime,
        feasible: false,
        unassignedDeliveries: [...request.deliveries]
      };
    }
  }

  /**
   * Implements simple route optimization methods for emergency scenarios
   * @param request - Routing request
   * @param distanceMatrix - Pre-calculated distance matrix
   * @param config - Emergency routing configuration
   * @returns Heuristic algorithm result
   */
  async emergencyRouteOptimization(
    request: RoutingRequest,
    _distanceMatrix: DistanceMatrix,
    config: Partial<EmergencyRoutingConfig> = {}
  ): Promise<HeuristicAlgorithmResult> {
    const startTime = Date.now();
    
    const emergencyConfig: EmergencyRoutingConfig = {
      maxRouteDistance: 200, // 200km max per route
      maxRouteDuration: 480, // 8 hours max per route
      ignoreNonCriticalConstraints: true,
      prioritizeUrgentDeliveries: true,
      ...config
    };

    Logger.info('Starting emergency route optimization', {
      vehicleCount: request.vehicles.length,
      deliveryCount: request.deliveries.length,
      config: emergencyConfig
    });

    try {
      const routes: Route[] = [];
      const availableVehicles = request.vehicles.filter(v => v.status === 'available');

      if (availableVehicles.length === 0) {
        return {
          routes: [],
          totalDistance: 0,
          totalDuration: 0,
          algorithmUsed: 'EMERGENCY_ROUTING',
          processingTime: Date.now() - startTime,
          feasible: false,
          unassignedDeliveries: [...request.deliveries]
        };
      }

      // Sort deliveries by priority if enabled
      const sortedDeliveries = [...request.deliveries];
      if (emergencyConfig.prioritizeUrgentDeliveries) {
        sortedDeliveries.sort((a, b) => {
          const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
          return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
        });
      }

      // Simple assignment: one delivery per vehicle, closest vehicle first
      const unassignedDeliveries: Delivery[] = [];
      let vehicleIndex = 0;

      for (const delivery of sortedDeliveries) {
        if (vehicleIndex >= availableVehicles.length) {
          // No more vehicles available
          unassignedDeliveries.push(delivery);
          continue;
        }

        const vehicle = availableVehicles[vehicleIndex]!;

        // Create simple route with pickup and delivery
        const pickupStop = this.createRouteStop(
          delivery.pickupLocation,
          'pickup',
          delivery.id,
          0
        );

        const deliveryStop = this.createRouteStop(
          delivery.deliveryLocation,
          'delivery',
          delivery.id,
          1
        );

        const distance = this.calculateDirectDistance(
          vehicle.location,
          delivery.pickupLocation,
          delivery.deliveryLocation
        );

        const duration = this.estimateTravelTime(distance);

        // Check emergency constraints
        if (distance > emergencyConfig.maxRouteDistance || 
            duration > emergencyConfig.maxRouteDuration) {
          unassignedDeliveries.push(delivery);
          continue;
        }

        const route: Route = {
          id: `emergency_route_${vehicle.id}_${Date.now()}`,
          vehicleId: vehicle.id,
          stops: [pickupStop, deliveryStop],
          estimatedDistance: distance,
          estimatedDuration: duration,
          estimatedFuelConsumption: this.calculateFuelConsumption(distance),
          trafficFactors: [],
          status: 'planned',
          deliveryIds: [delivery.id],
          routeType: 'direct'
        };

        routes.push(route);
        vehicleIndex++;
      }

      const totalDistance = routes.reduce((sum, route) => sum + route.estimatedDistance, 0);
      const totalDuration = routes.reduce((sum, route) => sum + route.estimatedDuration, 0);
      const processingTime = Date.now() - startTime;

      Logger.info('Emergency route optimization completed', {
        routesCreated: routes.length,
        deliveriesAssigned: routes.length,
        unassignedCount: unassignedDeliveries.length,
        totalDistance,
        processingTime
      });

      return {
        routes,
        totalDistance,
        totalDuration,
        algorithmUsed: 'EMERGENCY_ROUTING',
        processingTime,
        feasible: unassignedDeliveries.length === 0,
        unassignedDeliveries
      };

    } catch (error) {
      Logger.error('Emergency route optimization failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        algorithmUsed: 'EMERGENCY_ROUTING',
        processingTime: Date.now() - startTime,
        feasible: false,
        unassignedDeliveries: [...request.deliveries]
      };
    }
  }

  /**
   * Compares heuristic performance against OR-Tools results
   * @param heuristicResult - Result from heuristic algorithm
   * @param orToolsResult - Result from OR-Tools (if available)
   * @returns Performance comparison
   */
  compareHeuristicPerformance(
    heuristicResult: HeuristicAlgorithmResult,
    orToolsResult?: RouteOptimizationResult
  ): {
    distanceComparison: number; // percentage difference
    durationComparison: number; // percentage difference
    feasibilityComparison: boolean;
    performanceRatio: number; // heuristic time / OR-Tools time
    recommendation: string;
  } {
    if (!orToolsResult) {
      return {
        distanceComparison: 0,
        durationComparison: 0,
        feasibilityComparison: heuristicResult.feasible,
        performanceRatio: 1,
        recommendation: 'OR-Tools result not available for comparison'
      };
    }

    const distanceComparison = orToolsResult.totalDistance > 0 
      ? ((heuristicResult.totalDistance - orToolsResult.totalDistance) / orToolsResult.totalDistance) * 100
      : 0;

    const durationComparison = orToolsResult.totalDuration > 0
      ? ((heuristicResult.totalDuration - orToolsResult.totalDuration) / orToolsResult.totalDuration) * 100
      : 0;

    const performanceRatio = orToolsResult.optimizationTime > 0
      ? heuristicResult.processingTime / orToolsResult.optimizationTime
      : 1;

    let recommendation = '';
    if (distanceComparison < 10 && durationComparison < 10) {
      recommendation = 'Heuristic performs well, suitable as fallback';
    } else if (distanceComparison < 25 && durationComparison < 25) {
      recommendation = 'Heuristic provides acceptable fallback solution';
    } else {
      recommendation = 'Heuristic solution significantly suboptimal, investigate OR-Tools issues';
    }

    return {
      distanceComparison,
      durationComparison,
      feasibilityComparison: heuristicResult.feasible && orToolsResult.success,
      performanceRatio,
      recommendation
    };
  }

  /**
   * Builds a route using nearest neighbor algorithm for a single vehicle
   * @param vehicle - Vehicle to build route for
   * @param deliveries - Available deliveries
   * @param distanceMatrix - Distance matrix
   * @param request - Original routing request
   * @param config - Algorithm configuration
   * @returns Route for the vehicle
   */
  private async buildNearestNeighborRoute(
    vehicle: Vehicle,
    deliveries: Delivery[],
    _distanceMatrix: DistanceMatrix,
    request: RoutingRequest,
    config: NearestNeighborConfig
  ): Promise<Route> {
    const stops: RouteStop[] = [];
    const assignedDeliveryIds: string[] = [];
    let currentLocation = vehicle.location;
    const currentLoad: Capacity = { weight: 0, volume: 0 };
    let totalDistance = 0;
    let totalDuration = 0;

    const availableDeliveries = [...deliveries];

    while (availableDeliveries.length > 0) {
      let nearestDelivery: Delivery | null = null;
      let nearestDistance = Infinity;
      let nearestIndex = -1;

      // Find nearest delivery pickup location
      for (let i = 0; i < availableDeliveries.length; i++) {
        const delivery = availableDeliveries[i]!;

        // Check capacity constraints
        if (config.considerCapacityConstraints) {
          const newWeight = currentLoad.weight + delivery.shipment.weight;
          const newVolume = currentLoad.volume + delivery.shipment.volume;

          if (newWeight > vehicle.capacity.weight || newVolume > vehicle.capacity.volume) {
            continue;
          }
        }

        // Check compliance constraints
        if (config.considerComplianceRules) {
          const canServe = await this.canVehicleServeDelivery(vehicle, delivery, request.timeWindow);
          if (!canServe) continue;
        }

        const distance = this.calculateDistance(currentLocation, delivery.pickupLocation);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestDelivery = delivery;
          nearestIndex = i;
        }
      }

      if (!nearestDelivery) {
        break; // No more feasible deliveries
      }

      // Add pickup stop
      const pickupStop = this.createRouteStop(
        nearestDelivery.pickupLocation,
        'pickup',
        nearestDelivery.id,
        stops.length
      );
      stops.push(pickupStop);

      // Add delivery stop
      const deliveryStop = this.createRouteStop(
        nearestDelivery.deliveryLocation,
        'delivery',
        nearestDelivery.id,
        stops.length
      );
      stops.push(deliveryStop);

      // Update state
      assignedDeliveryIds.push(nearestDelivery.id);
      currentLoad.weight += nearestDelivery.shipment.weight;
      currentLoad.volume += nearestDelivery.shipment.volume;

      // Update distance and duration
      const pickupDistance = this.calculateDistance(currentLocation, nearestDelivery.pickupLocation);
      const deliveryDistance = this.calculateDistance(nearestDelivery.pickupLocation, nearestDelivery.deliveryLocation);
      
      totalDistance += pickupDistance + deliveryDistance;
      totalDuration += this.estimateTravelTime(pickupDistance + deliveryDistance);

      currentLocation = nearestDelivery.deliveryLocation;

      // Remove assigned delivery
      availableDeliveries.splice(nearestIndex, 1);
    }

    return {
      id: `nn_route_${vehicle.id}_${Date.now()}`,
      vehicleId: vehicle.id,
      stops,
      estimatedDistance: totalDistance,
      estimatedDuration: totalDuration,
      estimatedFuelConsumption: this.calculateFuelConsumption(totalDistance),
      trafficFactors: [],
      status: 'planned',
      deliveryIds: assignedDeliveryIds,
      routeType: 'direct'
    };
  }

  /**
   * Calculates delivery assignment scores for greedy algorithm
   * @param deliveries - Deliveries to score
   * @param vehicles - Available vehicles
   * @param distanceMatrix - Distance matrix
   * @param config - Algorithm configuration
   * @returns Array of scored assignments
   */
  private async calculateDeliveryAssignmentScores(
    deliveries: Delivery[],
    vehicles: Vehicle[],
    _distanceMatrix: DistanceMatrix,
    config: GreedyAssignmentConfig
  ): Promise<Array<{
    delivery: Delivery;
    vehicleId: string;
    score: number;
    distance: number;
    capacityUtilization: number;
  }>> {
    const assignments: Array<{
      delivery: Delivery;
      vehicleId: string;
      score: number;
      distance: number;
      capacityUtilization: number;
    }> = [];

    for (const delivery of deliveries) {
      for (const vehicle of vehicles) {
        let score = 0;

        // Distance score (lower distance = higher score)
        const distance = this.calculateDistance(vehicle.location, delivery.pickupLocation);
        const distanceScore = config.prioritizeByDistance ? Math.max(0, 100 - distance) : 50;

        // Capacity utilization score
        const weightUtilization = delivery.shipment.weight / vehicle.capacity.weight;
        const volumeUtilization = delivery.shipment.volume / vehicle.capacity.volume;
        const capacityUtilization = Math.max(weightUtilization, volumeUtilization);
        const capacityScore = config.prioritizeByCapacity ? capacityUtilization * 100 : 50;

        // Time window score (simplified)
        const timeScore = config.prioritizeByTimeWindow ? 75 : 50;

        // Priority score
        const priorityMultiplier = {
          'urgent': 2.0,
          'high': 1.5,
          'medium': 1.0,
          'low': 0.8
        }[delivery.priority] || 1.0;

        score = (distanceScore * 0.4 + capacityScore * 0.3 + timeScore * 0.3) * priorityMultiplier;

        assignments.push({
          delivery,
          vehicleId: vehicle.id,
          score,
          distance,
          capacityUtilization
        });
      }
    }

    return assignments;
  }

  /**
   * Filters vehicles based on Delhi compliance rules
   * @param vehicles - Vehicles to filter
   * @param request - Routing request
   * @returns Array of compliant vehicles
   */
  private async filterCompliantVehicles(vehicles: Vehicle[], request: RoutingRequest): Promise<Vehicle[]> {
    const compliantVehicles: Vehicle[] = [];
    const timestamp = new Date(request.timeWindow.earliest);

    for (const vehicle of vehicles) {
      try {
        // Check odd-even compliance
        const oddEvenResult = this.delhiComplianceService.checkOddEvenCompliance(
          vehicle.vehicleSpecs.plateNumber,
          timestamp
        );

        if (oddEvenResult.isCompliant) {
          compliantVehicles.push(vehicle);
        }
      } catch (error) {
        Logger.warn('Vehicle compliance check failed', {
          vehicleId: vehicle.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return compliantVehicles;
  }

  /**
   * Checks if a vehicle can serve a specific delivery
   * @param vehicle - Vehicle to check
   * @param delivery - Delivery to serve
   * @param timeWindow - Overall time window
   * @returns Boolean indicating if vehicle can serve delivery
   */
  private async canVehicleServeDelivery(vehicle: Vehicle, delivery: Delivery, _timeWindow: TimeWindow): Promise<boolean> {
    // Simplified compliance check
    try {
      const timestamp = new Date(delivery.timeWindow.earliest);
      const oddEvenResult = this.delhiComplianceService.checkOddEvenCompliance(
        vehicle.vehicleSpecs.plateNumber,
        timestamp
      );
      return oddEvenResult.isCompliant;
    } catch (error) {
      return false;
    }
  }

  /**
   * Creates a route stop
   * @param location - Stop location
   * @param type - Stop type
   * @param deliveryId - Associated delivery ID
   * @param sequence - Stop sequence number
   * @returns Route stop
   */
  private createRouteStop(
    location: GeoLocation,
    type: 'pickup' | 'delivery',
    deliveryId: string,
    sequence: number
  ): RouteStop {
    const now = new Date();
    const estimatedTime = new Date(now.getTime() + sequence * 30 * 60 * 1000); // 30 minutes per stop

    return {
      id: `stop_${deliveryId}_${type}_${sequence}`,
      sequence,
      location,
      type,
      deliveryId,
      estimatedArrivalTime: estimatedTime,
      estimatedDepartureTime: new Date(estimatedTime.getTime() + 15 * 60 * 1000), // 15 minutes stop time
      duration: 15,
      status: 'pending'
    };
  }

  /**
   * Calculates distance between two locations
   * @param from - Origin location
   * @param to - Destination location
   * @returns Distance in kilometers
   */
  private calculateDistance(from: GeoLocation, to: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) * Math.cos(this.toRadians(to.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculates direct distance for emergency routing
   * @param vehicleLocation - Vehicle starting location
   * @param pickupLocation - Pickup location
   * @param deliveryLocation - Delivery location
   * @returns Total distance
   */
  private calculateDirectDistance(
    vehicleLocation: GeoLocation,
    pickupLocation: GeoLocation,
    deliveryLocation: GeoLocation
  ): number {
    const toPickup = this.calculateDistance(vehicleLocation, pickupLocation);
    const toDelivery = this.calculateDistance(pickupLocation, deliveryLocation);
    return toPickup + toDelivery;
  }

  /**
   * Calculates additional distance for greedy assignment
   * @param currentLocation - Current location
   * @param pickupLocation - Pickup location
   * @param deliveryLocation - Delivery location
   * @param distanceMatrix - Distance matrix
   * @returns Distance and duration
   */
  private calculateAdditionalDistance(
    currentLocation: GeoLocation,
    pickupLocation: GeoLocation,
    deliveryLocation: GeoLocation,
    _distanceMatrix: DistanceMatrix
  ): { distance: number; duration: number } {
    const toPickup = this.calculateDistance(currentLocation, pickupLocation);
    const toDelivery = this.calculateDistance(pickupLocation, deliveryLocation);
    
    return {
      distance: toPickup + toDelivery,
      duration: this.estimateTravelTime(toPickup + toDelivery)
    };
  }

  /**
   * Estimates travel time based on distance
   * @param distance - Distance in kilometers
   * @returns Travel time in minutes
   */
  private estimateTravelTime(distance: number): number {
    // Assume average speed of 25 km/h in Delhi traffic
    const averageSpeed = 25;
    return Math.round((distance / averageSpeed) * 60);
  }

  /**
   * Calculates fuel consumption based on distance
   * @param distance - Distance in kilometers
   * @returns Fuel consumption in liters
   */
  private calculateFuelConsumption(distance: number): number {
    // Assume average fuel efficiency of 8 km/l
    const fuelEfficiency = 8;
    return Math.round((distance / fuelEfficiency) * 100) / 100;
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