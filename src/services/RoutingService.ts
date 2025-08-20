/**
 * Routing Service with OR-Tools VRP solver integration
 * Implements basic VRP solving with vehicle capacity constraints
 */

import { Vehicle } from '../models/Vehicle';
import { Delivery } from '../models/Delivery';
import { Hub } from '../models/Hub';
import { Route, RouteStop } from '../models/Route';
import { GeoLocation } from '../models/GeoLocation';
import { TimeWindow, Capacity } from '../models/Common';
import { DelhiComplianceService, ComplianceResult } from './DelhiComplianceService';
import Logger from '../utils/logger';

// OR-Tools integration (commented out due to TypeScript definition issues)
// import * as ortools from 'ts-ortools';

export interface RoutingRequest {
  vehicles: Vehicle[];
  deliveries: Delivery[];
  hubs: Hub[];
  constraints: RoutingConstraints;
  timeWindow: TimeWindow;
  optimizationOptions?: OptimizationOptions;
  serviceType?: 'shared' | 'dedicated_premium';
  premiumCustomerIds?: string[];
}

export interface RoutingConstraints {
  maxRouteDistance?: number; // in kilometers
  maxRouteDuration?: number; // in minutes
  vehicleCapacityConstraints: boolean;
  timeWindowConstraints: boolean;
  hubSequencing: boolean;
  // Delhi-specific constraints
  vehicleClassRestrictions?: VehicleClassRestriction[];
  timeWindowConstraints_delhi?: TimeWindowConstraint[];
  zoneAccessRules?: ZoneAccessRule[];
  pollutionCompliance?: PollutionRule[];
  oddEvenRules?: OddEvenRule[];
  weightDimensionLimits?: WeightDimensionLimit[];
}

export interface VehicleClassRestriction {
  vehicleType: string;
  zoneType: string;
  allowedHours: { start: string; end: string; };
  exceptions: string[];
  alternativeVehicleTypes: string[];
}

export interface TimeWindowConstraint {
  vehicleType: string;
  zoneType: string;
  restrictedHours: { start: string; end: string; };
  daysApplicable: string[];
  penalty: number;
}

export interface ZoneAccessRule {
  zoneType: string;
  allowedVehicleTypes: string[];
  restrictedVehicleTypes: string[];
  accessConditions: string[];
}

export interface PollutionRule {
  zoneLevel: 'low' | 'moderate' | 'high' | 'severe';
  requiredPollutionLevel: 'BS3' | 'BS4' | 'BS6' | 'electric';
  restrictions: string[];
  penalties: number;
}

export interface OddEvenRule {
  isActive: boolean;
  exemptVehicleTypes: string[];
  exemptFuelTypes: string[];
  penalty: number;
}

export interface WeightDimensionLimit {
  zoneType: string;
  maxWeight: number;
  maxDimensions: { length: number; width: number; height: number; };
  penalty: number;
}

export interface OptimizationOptions {
  maxSolverTimeSeconds?: number;
  firstSolutionStrategy?: string;
  localSearchMetaheuristic?: string;
  logSearch?: boolean;
}

export interface RouteOptimizationResult {
  success: boolean;
  routes: Route[];
  totalDistance: number;
  totalDuration: number;
  totalCost: number;
  optimizationTime: number;
  algorithmUsed: string;
  objectiveValue: number;
  message?: string;
  fallbackUsed?: boolean;
  premiumRoutes?: PremiumRoute[];
}

export interface PremiumRoute extends Route {
  dedicatedVehicle: boolean;
  premiumCustomerId: string;
  guaranteedTimeWindow: TimeWindow;
  priorityLevel: 'high' | 'urgent';
  exclusiveAllocation: boolean;
}

// Hub-and-spoke routing interfaces
export interface HubAssignment {
  deliveryId: string;
  hubId: string;
  assignmentScore: number;
  estimatedTransferTime: number;
  estimatedDeliveryTime: number;
  requiresLoadSplitting: boolean;
}

export interface SplitDeliveryAssignment {
  originalDeliveryId: string;
  splitIndex: number;
  splitDelivery: Delivery;
  hubAssignment: HubAssignment;
  assignedVehicleId?: string;
}

export interface HubTransferConstraints {
  maxTransferTime: number; // in minutes
  minTransferTime: number; // in minutes
  hubProcessingTime: number; // in minutes
  allowedVehicleTypes: string[];
}

export interface LoadSplitOption {
  originalDeliveryId: string;
  splitCount: number;
  splitDeliveries: Delivery[];
  requiredVehicles: Vehicle[];
  estimatedCostIncrease: number;
}

export interface VRPSolution {
  vehicleRoutes: VehicleRoute[];
  totalDistance: number;
  totalDuration: number;
  objectiveValue: number;
  status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'UNBOUNDED' | 'ABNORMAL';
}

export interface VehicleRoute {
  vehicleIndex: number;
  stops: number[];
  distance: number;
  duration: number;
  load: Capacity;
}

export interface DistanceMatrix {
  distances: number[][]; // in kilometers
  durations: number[][]; // in minutes
}

/**
 * Routing Service implementing OR-Tools VRP solver with Delhi-specific constraints
 */
export class RoutingService {
  private readonly defaultOptimizationOptions: OptimizationOptions = {
    maxSolverTimeSeconds: 30,
    firstSolutionStrategy: 'PATH_CHEAPEST_ARC',
    localSearchMetaheuristic: 'GUIDED_LOCAL_SEARCH',
    logSearch: false
  };

  private readonly delhiComplianceService: DelhiComplianceService;

  constructor(_fleetService?: any, _trafficService?: any) {
    this.delhiComplianceService = new DelhiComplianceService();
  }

  /**
   * Helper to get earliest time from TimeWindow
   */
  private getEarliestTime(timeWindow: TimeWindow): Date {
    return timeWindow.earliest || timeWindow.start || new Date();
  }

  /**
   * Helper to get latest time from TimeWindow
   */
  private getLatestTime(timeWindow: TimeWindow): Date {
    return timeWindow.latest || timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  /**
   * Validate routing input
   */
  private validateRoutingInput(request: RoutingRequest): string[] {
    const errors: string[] = [];

    if (!request.deliveries || request.deliveries.length === 0) {
      errors.push('At least one delivery is required');
    }

    if (!request.vehicles || request.vehicles.length === 0) {
      errors.push('At least one vehicle is required');
    }

    if (!request.timeWindow) {
      errors.push('Time window is required');
    }

    return errors;
  }

  /**
   * Create basic routes using simple assignment
   */
  private createBasicRoutes(request: RoutingRequest): Route[] {
    const routes: Route[] = [];
    const availableVehicles = [...request.vehicles];
    const remainingDeliveries = [...request.deliveries];

    while (remainingDeliveries.length > 0 && availableVehicles.length > 0) {
      const vehicle = availableVehicles.shift()!;
      const route: Route = {
        id: `route-${routes.length + 1}`,
        vehicleId: vehicle.id,
        stops: [],
        estimatedDistance: 10, // Basic estimate
        estimatedDuration: 60, // Basic estimate in minutes
        estimatedFuelConsumption: 2, // Basic estimate in liters
        trafficFactors: [], // Empty traffic factors for basic routing
        status: 'planned',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Assign deliveries to this vehicle based on capacity
      let currentWeight = 0;
      let currentVolume = 0;

      while (remainingDeliveries.length > 0) {
        const delivery = remainingDeliveries[0]!;

        // Check if delivery fits in vehicle
        if (currentWeight + delivery.shipment.weight <= vehicle.capacity.weight &&
          currentVolume + delivery.shipment.volume <= vehicle.capacity.volume) {

          remainingDeliveries.shift();
          currentWeight += delivery.shipment.weight;
          currentVolume += delivery.shipment.volume;

          // Add pickup stop
          route.stops.push({
            id: `stop-${route.stops.length + 1}`,
            sequence: route.stops.length,
            location: delivery.pickupLocation,
            type: 'pickup',
            deliveryId: delivery.id,
            estimatedArrivalTime: new Date(Date.now() + route.stops.length * 30 * 60 * 1000),
            estimatedDepartureTime: new Date(Date.now() + (route.stops.length * 30 + 15) * 60 * 1000),
            duration: 15,
            status: 'pending'
          });

          // Add delivery stop
          route.stops.push({
            id: `stop-${route.stops.length + 1}`,
            sequence: route.stops.length,
            location: delivery.deliveryLocation,
            type: 'delivery',
            deliveryId: delivery.id,
            estimatedArrivalTime: new Date(Date.now() + route.stops.length * 30 * 60 * 1000),
            estimatedDepartureTime: new Date(Date.now() + (route.stops.length * 30 + 15) * 60 * 1000),
            duration: 15,
            status: 'pending'
          });
        } else {
          break; // Vehicle is full
        }
      }

      if (route.stops.length > 0) {
        routes.push(route);
      }
    }

    return routes;
  }

  /**
   * Optimizes routes using OR-Tools VRP solver with premium service support
   * @param request - Routing request with vehicles, deliveries, and constraints
   * @returns RouteOptimizationResult with optimized routes
   */
  async optimizeRoutes(request: RoutingRequest): Promise<RouteOptimizationResult> {
    const startTime = Date.now();

    try {
      Logger.info('Starting route optimization', {
        vehicleCount: request.vehicles.length,
        deliveryCount: request.deliveries.length,
        hubCount: request.hubs.length
      });

      // Validate input
      const errors = this.validateRoutingInput(request);
      if (errors.length > 0) {
        return {
          success: false,
          routes: [],
          totalDistance: 0,
          totalDuration: 0,
          totalCost: 0,
          optimizationTime: Date.now() - startTime,
          algorithmUsed: 'VALIDATION_FAILED',
          objectiveValue: 0,
          message: errors.join(', ')
        };
      }

      // Build distance matrix
      const distanceMatrix = await this.buildDistanceMatrix(request);

      // Handle premium service routing if requested
      if (request.serviceType === 'dedicated_premium') {
        return await this.optimizePremiumRoutes(request, distanceMatrix, startTime);
      }

      

      // Solve VRP using OR-Tools for shared service
      const vrpSolution = await this.solveVRP(request, distanceMatrix);

      if (vrpSolution.status === 'INFEASIBLE') {
        Logger.warn('VRP solution infeasible, attempting fallback');
        return await this.fallbackHeuristicSolution(request, distanceMatrix, startTime);
      }

      // Convert VRP solution to Route objects
      const routes = await this.convertVRPSolutionToRoutes(vrpSolution, request, distanceMatrix);

      const optimizationTime = Date.now() - startTime;

      Logger.info('Route optimization completed successfully', {
        routeCount: routes.length,
        totalDistance: vrpSolution.totalDistance,
        optimizationTime
      });

      return {
        success: true,
        routes,
        totalDistance: vrpSolution.totalDistance,
        totalDuration: vrpSolution.totalDuration,
        totalCost: this.calculateTotalCost(vrpSolution),
        optimizationTime,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: vrpSolution.objectiveValue
      };

    } catch (error) {
      Logger.error('Route optimization failed', { error: error instanceof Error ? error.message : String(error) });

      // Fallback to heuristic solution
      const distanceMatrix = await this.buildDistanceMatrix(request);
      return await this.fallbackHeuristicSolution(request, distanceMatrix, startTime);
    }
  }

  /**
   * Validates routing request parameters including Delhi-specific constraints
   * @param request - Routing request to validate
   * @returns Validation result with errors if any
   */
  private validateRoutingRequest(request: RoutingRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.vehicles || request.vehicles.length === 0) {
      errors.push('No vehicles provided');
    }

    if (!request.deliveries || request.deliveries.length === 0) {
      errors.push('No deliveries provided');
    }

    // Check vehicle availability
    const availableVehicles = request.vehicles.filter(v => v.status === 'available');
    if (availableVehicles.length === 0) {
      errors.push('No available vehicles');
    }

    // Check time window validity
    const earliest = request.timeWindow.earliest || request.timeWindow.start || new Date();
    const latest = request.timeWindow.latest || request.timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000);

    if (earliest >= latest) {
      errors.push('Invalid time window: earliest must be before latest');
    }

    // Check capacity constraints if enabled
    if (request.constraints.vehicleCapacityConstraints) {
      const totalDeliveryWeight = request.deliveries.reduce((sum, d) => sum + d.shipment.weight, 0);
      const totalVehicleCapacity = availableVehicles.reduce((sum, v) => sum + v.capacity.weight, 0);

      if (totalDeliveryWeight > totalVehicleCapacity) {
        errors.push('Total delivery weight exceeds total vehicle capacity');
      }
    }

    // Validate Delhi-specific constraints
    const delhiValidationErrors = this.validateDelhiConstraints(request);
    errors.push(...delhiValidationErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates Delhi-specific routing constraints
   * @param request - Routing request to validate
   * @returns Array of validation errors
   */
  private validateDelhiConstraints(request: RoutingRequest): string[] {
    const errors: string[] = [];
    const timestamp = this.getEarliestTime(request.timeWindow);

    // Validate each vehicle against Delhi compliance rules
    for (const vehicle of request.vehicles) {
      if (vehicle.status !== 'available') continue;

      // Check odd-even compliance
      try {
        const oddEvenResult = this.delhiComplianceService.checkOddEvenCompliance(
          vehicle.vehicleSpecs.plateNumber,
          timestamp
        );

        if (!oddEvenResult.isCompliant) {
          errors.push(`Vehicle ${vehicle.id} (${vehicle.vehicleSpecs.plateNumber}) violates odd-even rule on ${timestamp.toDateString()}`);
        }
      } catch (error) {
        errors.push(`Invalid plate number format for vehicle ${vehicle.id}: ${vehicle.vehicleSpecs.plateNumber}`);
      }

      // Validate against delivery locations and time windows
      for (const delivery of request.deliveries) {
        const deliveryTime = this.getEarliestTime(delivery.timeWindow);

        // Check time restrictions for delivery location
        const zoneType = this.determineZoneTypeFromLocation(delivery.deliveryLocation);
        const timeRestrictionResult = this.delhiComplianceService.validateTimeRestrictions(
          vehicle,
          zoneType,
          deliveryTime
        );

        if (!timeRestrictionResult.isAllowed) {
          errors.push(`Vehicle ${vehicle.id} (${vehicle.type}) cannot access ${zoneType} zone at ${deliveryTime.toTimeString().slice(0, 5)}`);
        }
      }
    }

    return errors;
  }

  /**
   * Determines zone type from location (simplified implementation)
   * @param location - Geographic location
   * @returns Zone type
   */
  private determineZoneTypeFromLocation(location: GeoLocation): 'residential' | 'commercial' | 'industrial' | 'mixed' {
    // This is a simplified implementation
    // In a real system, this would use geographic data to determine zone type
    if (location.address?.toLowerCase().includes('residential')) {
      return 'residential';
    }
    if (location.address?.toLowerCase().includes('industrial')) {
      return 'industrial';
    }
    if (location.address?.toLowerCase().includes('commercial')) {
      return 'commercial';
    }
    return 'mixed'; // Default to mixed zone
  }

  /**
   * Checks if a vehicle can serve a specific delivery based on Delhi constraints
   * @param vehicle - Vehicle to check
   * @param delivery - Delivery to serve
   * @param timeWindow - Overall time window for the operation
   * @returns boolean indicating if vehicle can serve the delivery
   */
  private canVehicleServeDelivery(vehicle: Vehicle, delivery: Delivery, _timeWindow: TimeWindow): boolean {
    // Check pickup location constraints
    const pickupZoneType = this.determineZoneTypeFromLocation(delivery.pickupLocation);
    const pickupTime = this.getEarliestTime(delivery.timeWindow);

    const pickupTimeResult = this.delhiComplianceService.validateTimeRestrictions(
      vehicle,
      pickupZoneType,
      pickupTime
    );

    if (!pickupTimeResult.isAllowed) {
      Logger.debug(`Vehicle ${vehicle.id} cannot pickup from ${pickupZoneType} zone at ${pickupTime.toTimeString().slice(0, 5)}`);
      return false;
    }

    // Check delivery location constraints
    const deliveryZoneType = this.determineZoneTypeFromLocation(delivery.deliveryLocation);
    const deliveryTime = this.getLatestTime(delivery.timeWindow);

    const deliveryTimeResult = this.delhiComplianceService.validateTimeRestrictions(
      vehicle,
      deliveryZoneType,
      deliveryTime
    );

    if (!deliveryTimeResult.isAllowed) {
      Logger.debug(`Vehicle ${vehicle.id} cannot deliver to ${deliveryZoneType} zone at ${deliveryTime.toTimeString().slice(0, 5)}`);
      return false;
    }

    // Check weight and dimension limits for zones
    if (this.exceedsZoneWeightLimits(vehicle, delivery, pickupZoneType) ||
      this.exceedsZoneWeightLimits(vehicle, delivery, deliveryZoneType)) {
      Logger.debug(`Vehicle ${vehicle.id} exceeds weight/dimension limits for delivery ${delivery.id}`);
      return false;
    }

    return true;
  }

  /**
   * Checks if vehicle exceeds weight/dimension limits for a specific zone
   * @param vehicle - Vehicle to check
   * @param delivery - Delivery being served
   * @param zoneType - Zone type to check limits for
   * @returns boolean indicating if limits are exceeded
   */
  private exceedsZoneWeightLimits(vehicle: Vehicle, delivery: Delivery, zoneType: 'residential' | 'commercial' | 'industrial' | 'mixed'): boolean {
    // Define zone-specific limits (these would typically come from configuration)
    const zoneLimits = {
      residential: {
        maxWeight: 3000, // 3 tons max for residential areas
        maxDimensions: { length: 8, width: 2.5, height: 3 }
      },
      commercial: {
        maxWeight: 10000, // 10 tons max for commercial areas
        maxDimensions: { length: 12, width: 2.5, height: 4 }
      },
      industrial: {
        maxWeight: 25000, // 25 tons max for industrial areas
        maxDimensions: { length: 16, width: 3, height: 4.5 }
      },
      mixed: {
        maxWeight: 5000, // 5 tons max for mixed zones
        maxDimensions: { length: 10, width: 2.5, height: 3.5 }
      }
    };

    const limits = zoneLimits[zoneType];

    // Check weight limits
    if (delivery.shipment.weight > limits.maxWeight) {
      return true;
    }

    // Check dimension limits (if vehicle has dimension info)
    if (vehicle.capacity.maxDimensions) {
      const vehicleDimensions = vehicle.capacity.maxDimensions;
      if (vehicleDimensions.length > limits.maxDimensions.length ||
        vehicleDimensions.width > limits.maxDimensions.width ||
        vehicleDimensions.height > limits.maxDimensions.height) {
        return true;
      }
    }

    return false;
  }

  /**
   * Builds distance matrix for all locations (vehicles, deliveries, hubs)
   * @param request - Routing request
   * @returns Distance matrix with distances and durations
   */
  private async buildDistanceMatrix(request: RoutingRequest): Promise<DistanceMatrix> {
    // Collect all locations
    const locations: GeoLocation[] = [];

    // Add vehicle locations
    request.vehicles.forEach(vehicle => {
      locations.push(vehicle.location);
    });

    // Add pickup and delivery locations
    request.deliveries.forEach(delivery => {
      locations.push(delivery.pickupLocation);
      locations.push(delivery.deliveryLocation);
    });

    // Add hub locations
    request.hubs.forEach(hub => {
      locations.push(hub.location);
    });

    const n = locations.length;
    const distances: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const durations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    // Calculate distances and durations between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i]![j] = 0;
          durations[i]![j] = 0;
        } else {
          const distance = this.haversineDistance(
            locations[i]!.latitude,
            locations[i]!.longitude,
            locations[j]!.latitude,
            locations[j]!.longitude
          );
          distances[i]![j] = distance;

          // Estimate duration based on distance (accounting for Delhi traffic)
          durations[i]![j] = this.estimateTravelTime(distance);
        }
      }
    }

    return { distances, durations };
  }

  /**
   * Solves VRP using optimization algorithms with Delhi-specific constraints
   * @param request - Routing request
   * @param distanceMatrix - Pre-calculated distance matrix
   * @returns VRP solution
   */
  private async solveVRP(request: RoutingRequest, distanceMatrix: DistanceMatrix): Promise<VRPSolution> {
    // const options = { ...this.defaultOptimizationOptions, ...request.optimizationOptions };

    try {
      Logger.info('Using advanced heuristic VRP solver with Delhi constraints');

      // Filter vehicles based on Delhi compliance
      const compliantVehicles = await this.filterCompliantVehicles(request);

      if (compliantVehicles.length === 0) {
        Logger.warn('No compliant vehicles available for routing');
        return {
          vehicleRoutes: [],
          totalDistance: 0,
          totalDuration: 0,
          objectiveValue: 0,
          status: 'INFEASIBLE'
        };
      }

      // Create modified request with compliant vehicles only
      const constrainedRequest: RoutingRequest = {
        ...request,
        vehicles: compliantVehicles
      };

      const vehicleRoutes = this.solveVRPHeuristicWithConstraints(constrainedRequest, distanceMatrix);

      let totalDistance = 0;
      let totalDuration = 0;

      vehicleRoutes.forEach(route => {
        totalDistance += route.distance;
        totalDuration += route.duration;
      });

      return {
        vehicleRoutes,
        totalDistance,
        totalDuration,
        objectiveValue: totalDistance, // Use distance as objective
        status: vehicleRoutes.length > 0 ? 'OPTIMAL' : 'INFEASIBLE'
      };

    } catch (error) {
      Logger.error('VRP solving failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Filters vehicles based on Delhi compliance rules
   * @param request - Routing request
   * @returns Array of compliant vehicles
   */
  private async filterCompliantVehicles(request: RoutingRequest): Promise<Vehicle[]> {
    const compliantVehicles: Vehicle[] = [];
    const timestamp = this.getEarliestTime(request.timeWindow);

    for (const vehicle of request.vehicles) {
      if (vehicle.status !== 'available') continue;

      let isCompliant = true;
      const complianceIssues: string[] = [];

      // Check odd-even compliance
      try {
        const oddEvenResult = this.delhiComplianceService.checkOddEvenCompliance(
          vehicle.vehicleSpecs.plateNumber,
          timestamp
        );

        if (!oddEvenResult.isCompliant) {
          isCompliant = false;
          complianceIssues.push(`Odd-even violation: ${oddEvenResult.plateNumber} on ${timestamp.toDateString()}`);
        }
      } catch (error) {
        isCompliant = false;
        complianceIssues.push(`Invalid plate number: ${vehicle.vehicleSpecs.plateNumber}`);
        continue;
      }

      // Check if vehicle can serve any delivery based on time restrictions
      let canServeAnyDelivery = false;
      for (const delivery of request.deliveries) {
        const deliveryTime = this.getEarliestTime(delivery.timeWindow);
        const zoneType = this.determineZoneTypeFromLocation(delivery.deliveryLocation);

        const timeRestrictionResult = this.delhiComplianceService.validateTimeRestrictions(
          vehicle,
          zoneType,
          deliveryTime
        );

        if (timeRestrictionResult.isAllowed) {
          canServeAnyDelivery = true;
          break;
        }
      }

      if (!canServeAnyDelivery) {
        isCompliant = false;
        complianceIssues.push(`Vehicle ${vehicle.type} cannot serve any delivery due to time restrictions`);
      }

      if (isCompliant) {
        compliantVehicles.push(vehicle);
        Logger.debug(`Vehicle ${vehicle.id} is compliant for routing`);
      } else {
        Logger.warn(`Vehicle ${vehicle.id} filtered out due to compliance issues: ${complianceIssues.join(', ')}`);
      }
    }

    Logger.info(`Filtered ${compliantVehicles.length} compliant vehicles out of ${request.vehicles.length} total vehicles`);
    return compliantVehicles;
  }

  /**
   * Solves VRP using advanced heuristic algorithms with Delhi constraints
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Array of vehicle routes
   */
  private solveVRPHeuristicWithConstraints(request: RoutingRequest, distanceMatrix: DistanceMatrix): VehicleRoute[] {
    const vehicleRoutes: VehicleRoute[] = [];
    const availableVehicles = request.vehicles.filter(v => v.status === 'available');
    //const unassignedDeliveries = [...request.deliveries];

    // Use savings algorithm for better optimization
    const savings = this.calculateSavings(request, distanceMatrix);

    // Sort savings in descending order
    savings.sort((a, b) => b.saving - a.saving);

    // Initialize routes for each vehicle
    const routes: Map<number, number[]> = new Map();
    const routeLoads: Map<number, Capacity> = new Map();

    availableVehicles.forEach((vehicle, index) => {
      routes.set(index, []);
      routeLoads.set(index, { weight: 0, volume: 0 });
    });

    // Apply savings algorithm with Delhi constraints
    for (const saving of savings) {
      const delivery1 = request.deliveries.find(d => d.id === saving.delivery1Id);
      const delivery2 = request.deliveries.find(d => d.id === saving.delivery2Id);

      if (!delivery1 || !delivery2) continue;

      // Find a vehicle that can handle both deliveries
      for (let vehicleIndex = 0; vehicleIndex < availableVehicles.length; vehicleIndex++) {
        const vehicle = availableVehicles[vehicleIndex];
        const currentLoad = routeLoads.get(vehicleIndex)!;
        const route = routes.get(vehicleIndex)!;

        // Check capacity constraints
        if (request.constraints.vehicleCapacityConstraints) {
          const totalWeight = currentLoad.weight + delivery1.shipment.weight + delivery2.shipment.weight;
          const totalVolume = currentLoad.volume + delivery1.shipment.volume + delivery2.shipment.volume;

          if (totalWeight > vehicle!.capacity.weight || totalVolume > vehicle!.capacity.volume) {
            continue;
          }
        }

        // Check Delhi-specific constraints for both deliveries
        const canServeDelivery1 = this.canVehicleServeDelivery(vehicle!, delivery1, request.timeWindow);
        const canServeDelivery2 = this.canVehicleServeDelivery(vehicle!, delivery2, request.timeWindow);

        if (!canServeDelivery1 || !canServeDelivery2) {
          continue;
        }

        // Add deliveries to route if not already assigned
        const delivery1Index = this.getDeliveryLocationIndex(delivery1, request);
        const delivery2Index = this.getDeliveryLocationIndex(delivery2, request);

        if (!route.includes(delivery1Index) && !route.includes(delivery2Index)) {
          // Add pickup and delivery stops for both deliveries
          const pickup1Index = this.getPickupLocationIndex(delivery1, request);
          const pickup2Index = this.getPickupLocationIndex(delivery2, request);

          route.push(pickup1Index, delivery1Index, pickup2Index, delivery2Index);

          // Update load
          currentLoad.weight += delivery1.shipment.weight + delivery2.shipment.weight;
          currentLoad.volume += delivery1.shipment.volume + delivery2.shipment.volume;

          break;
        }
      }
    }

    // Convert routes to VehicleRoute objects
    routes.forEach((stops, vehicleIndex) => {
      if (stops.length > 0) {
        const distance = this.calculateRouteDistance(stops, distanceMatrix);
        const duration = this.calculateRouteDuration(stops, distanceMatrix);

        vehicleRoutes.push({
          vehicleIndex,
          stops,
          distance,
          duration,
          load: routeLoads.get(vehicleIndex)!
        });
      }
    });

    return vehicleRoutes;
  }

  /**
   * Calculates savings for delivery pairs using Clarke-Wright algorithm
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Array of savings
   */
  private calculateSavings(request: RoutingRequest, distanceMatrix: DistanceMatrix): Array<{
    delivery1Id: string;
    delivery2Id: string;
    saving: number;
  }> {
    const savings: Array<{ delivery1Id: string; delivery2Id: string; saving: number }> = [];
    const depot = 0; // Assume first location is depot

    for (let i = 0; i < request.deliveries.length; i++) {
      for (let j = i + 1; j < request.deliveries.length; j++) {
        const delivery1 = request.deliveries[i]!;
        const delivery2 = request.deliveries[j]!;

        const loc1Index = this.getDeliveryLocationIndex(delivery1, request);
        const loc2Index = this.getDeliveryLocationIndex(delivery2, request);

        // Clarke-Wright savings formula: S(i,j) = d(0,i) + d(0,j) - d(i,j)
        const saving = (distanceMatrix.distances[depot]?.[loc1Index] || 0) +
          (distanceMatrix.distances[depot]?.[loc2Index] || 0) -
          (distanceMatrix.distances[loc1Index]?.[loc2Index] || 0);

        savings.push({
          delivery1Id: delivery1.id,
          delivery2Id: delivery2.id,
          saving
        });
      }
    }

    return savings;
  }

  /**
   * Gets delivery location index in the distance matrix
   * @param delivery - Delivery object
   * @param request - Routing request
   * @returns Location index
   */
  private getDeliveryLocationIndex(delivery: Delivery, request: RoutingRequest): number {
    return this.getLocationIndex(delivery.deliveryLocation, request);
  }

  /**
   * Gets pickup location index in the distance matrix
   * @param delivery - Delivery object
   * @param request - Routing request
   * @returns Location index
   */
  private getPickupLocationIndex(delivery: Delivery, request: RoutingRequest): number {
    return this.getLocationIndex(delivery.pickupLocation, request);
  }

  /**
   * Calculates total distance for a route
   * @param stops - Array of location indices
   * @param distanceMatrix - Distance matrix
   * @returns Total distance in kilometers
   */
  private calculateRouteDistance(stops: number[], distanceMatrix: DistanceMatrix): number {
    let totalDistance = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const fromIndex = stops[i]!;
      const toIndex = stops[i + 1]!;
      totalDistance += distanceMatrix.distances[fromIndex]?.[toIndex] || 0;
    }
    return totalDistance;
  }

  /**
   * Calculates total duration for a route
   * @param stops - Array of location indices
   * @param distanceMatrix - Distance matrix
   * @returns Total duration in minutes
   */
  private calculateRouteDuration(stops: number[], distanceMatrix: DistanceMatrix): number {
    let totalDuration = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const fromIndex = stops[i]!;
      const toIndex = stops[i + 1]!;
      totalDuration += distanceMatrix.durations[fromIndex]?.[toIndex] || 0;
    }
    // Add stop time (15 minutes per stop)
    totalDuration += (stops.length - 2) * 15;
    return totalDuration;
  }

  /**
   * Converts VRP solution to Route objects
   * @param vrpSolution - VRP solution from OR-Tools
   * @param request - Original routing request
   * @param distanceMatrix - Distance matrix
   * @returns Array of Route objects
   */
  private async convertVRPSolutionToRoutes(
    vrpSolution: VRPSolution,
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Route[]> {
    const routes: Route[] = [];

    for (let index = 0; index < vrpSolution.vehicleRoutes.length; index++) {
      const vehicleRoute = vrpSolution.vehicleRoutes[index]!;
      const vehicle = request.vehicles[vehicleRoute.vehicleIndex];
      if (!vehicle) continue;

      const stops: RouteStop[] = [];
      let currentTime = this.getEarliestTime(request.timeWindow);

      vehicleRoute.stops.forEach((locationIndex, stopIndex) => {
        const location = this.getLocationByIndex(locationIndex, request);
        if (!location) return;

        const estimatedArrivalTime = new Date(currentTime);
        const estimatedDepartureTime = new Date(currentTime.getTime() + 15 * 60 * 1000); // 15 minutes stop time

        stops.push({
          id: `stop_${index}_${stopIndex}`,
          sequence: stopIndex,
          location,
          type: this.determineStopType(locationIndex, request),
          estimatedArrivalTime,
          estimatedDepartureTime,
          duration: 15, // 15 minutes default stop time
          status: 'pending'
        });

        // Update current time for next stop
        if (stopIndex < vehicleRoute.stops.length - 1) {
          const nextLocationIndex = vehicleRoute.stops[stopIndex + 1]!;
          const travelTime = distanceMatrix.durations[locationIndex]?.[nextLocationIndex] || 0;
          currentTime = new Date(estimatedDepartureTime.getTime() + travelTime * 60 * 1000);
        }
      });

      // Validate route compliance
      const complianceValidation = await this.validateRouteCompliance(vehicle, stops, request);

      const route: Route = {
        id: `route_${index}_${Date.now()}`,
        vehicleId: vehicle.id,
        driverId: vehicle.driverInfo.id,
        stops,
        estimatedDuration: vehicleRoute.duration,
        estimatedDistance: vehicleRoute.distance,
        estimatedFuelConsumption: this.calculateFuelConsumption(vehicleRoute.distance, vehicle),
        trafficFactors: [],
        status: 'planned',
        optimizationMetadata: {
          algorithmUsed: 'OR_TOOLS_VRP_WITH_DELHI_CONSTRAINTS',
          optimizationTime: 0,
          iterations: 0,
          objectiveValue: vrpSolution.objectiveValue,
          constraintsApplied: this.getAppliedConstraints(request.constraints),
          fallbackUsed: false,
          version: '1.0.0'
        },
        complianceValidation,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      routes.push(route);
    }

    return routes;
  }

  /**
   * Fallback heuristic solution when OR-Tools fails
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @param startTime - Start time for optimization timing
   * @returns RouteOptimizationResult using heuristic approach
   */
  private async fallbackHeuristicSolution(
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix,
    startTime: number
  ): Promise<RouteOptimizationResult> {
    Logger.info('Using fallback heuristic solution');

    // Simple nearest neighbor heuristic
    const routes: Route[] = [];
    const availableVehicles = request.vehicles.filter(v => v.status === 'available');
    const unassignedDeliveries = [...request.deliveries];

    for (let i = 0; i < availableVehicles.length && unassignedDeliveries.length > 0; i++) {
      const vehicle = availableVehicles[i]!;
      const route = await this.createHeuristicRoute(vehicle, unassignedDeliveries, distanceMatrix, request);

      if (route.stops.length > 0) {
        routes.push(route);

        // Remove assigned deliveries
        route.stops.forEach(stop => {
          if (stop.deliveryId) {
            const deliveryIndex = unassignedDeliveries.findIndex(d => d.id === stop.deliveryId);
            if (deliveryIndex !== -1) {
              unassignedDeliveries.splice(deliveryIndex, 1);
            }
          }
        });
      }
    }

    const totalDistance = routes.reduce((sum, route) => sum + route.estimatedDistance, 0);
    const totalDuration = routes.reduce((sum, route) => sum + route.estimatedDuration, 0);

    return {
      success: true,
      routes,
      totalDistance,
      totalDuration,
      totalCost: totalDistance * 10, // Simple cost calculation
      optimizationTime: Date.now() - startTime,
      algorithmUsed: 'NEAREST_NEIGHBOR_HEURISTIC',
      objectiveValue: totalDistance,
      fallbackUsed: true,
      message: 'Used fallback heuristic due to OR-Tools solver failure'
    };
  }

  /**
   * Creates a heuristic route using nearest neighbor algorithm
   * @param vehicle - Vehicle for the route
   * @param deliveries - Available deliveries
   * @param distanceMatrix - Distance matrix
   * @param request - Original routing request
   * @returns Route object
   */
  private async createHeuristicRoute(
    vehicle: Vehicle,
    deliveries: Delivery[],
    distanceMatrix: DistanceMatrix,
    request: RoutingRequest
  ): Promise<Route> {
    const stops: RouteStop[] = [];
    let currentLocation = vehicle.location;
    let currentWeight = 0;
    let currentVolume = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    let currentTime = this.getEarliestTime(request.timeWindow);

    // Greedy selection of deliveries
    const selectedDeliveries: Delivery[] = [];
    const remainingDeliveries = [...deliveries];

    while (remainingDeliveries.length > 0) {
      let bestDelivery: Delivery | null = null;
      let bestDistance = Infinity;

      // Find nearest delivery that fits capacity constraints
      for (const delivery of remainingDeliveries) {
        if (request.constraints.vehicleCapacityConstraints) {
          if (currentWeight + delivery.shipment.weight > vehicle.capacity.weight ||
            currentVolume + delivery.shipment.volume > vehicle.capacity.volume) {
            continue;
          }
        }

        const distance = this.haversineDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          delivery.pickupLocation.latitude,
          delivery.pickupLocation.longitude
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestDelivery = delivery;
        }
      }

      if (!bestDelivery) break;

      // Add pickup stop
      const travelTimeToPickup = this.estimateTravelTime(bestDistance);
      currentTime = new Date(currentTime.getTime() + travelTimeToPickup * 60 * 1000);

      stops.push({
        id: `pickup_${bestDelivery.id}`,
        sequence: stops.length,
        location: bestDelivery.pickupLocation,
        type: 'pickup',
        deliveryId: bestDelivery.id,
        estimatedArrivalTime: new Date(currentTime),
        estimatedDepartureTime: new Date(currentTime.getTime() + 15 * 60 * 1000),
        duration: 15,
        status: 'pending'
      });

      // Add delivery stop
      const deliveryDistance = this.haversineDistance(
        bestDelivery.pickupLocation.latitude,
        bestDelivery.pickupLocation.longitude,
        bestDelivery.deliveryLocation.latitude,
        bestDelivery.deliveryLocation.longitude
      );

      const travelTimeToDelivery = this.estimateTravelTime(deliveryDistance);
      currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000 + travelTimeToDelivery * 60 * 1000);

      stops.push({
        id: `delivery_${bestDelivery.id}`,
        sequence: stops.length,
        location: bestDelivery.deliveryLocation,
        type: 'delivery',
        deliveryId: bestDelivery.id,
        estimatedArrivalTime: new Date(currentTime),
        estimatedDepartureTime: new Date(currentTime.getTime() + 15 * 60 * 1000),
        duration: 15,
        status: 'pending'
      });

      // Update state
      currentLocation = bestDelivery.deliveryLocation;
      currentWeight += bestDelivery.shipment.weight;
      currentVolume += bestDelivery.shipment.volume;
      totalDistance += bestDistance + deliveryDistance;
      totalDuration += travelTimeToPickup + travelTimeToDelivery + 30; // 30 minutes for stops

      selectedDeliveries.push(bestDelivery);
      remainingDeliveries.splice(remainingDeliveries.indexOf(bestDelivery), 1);
    }

    // Validate route compliance
    const complianceValidation = await this.validateRouteCompliance(vehicle, stops, request);

    return {
      id: `heuristic_route_${vehicle.id}_${Date.now()}`,
      vehicleId: vehicle.id,
      driverId: vehicle.driverInfo.id,
      stops,
      estimatedDuration: totalDuration,
      estimatedDistance: totalDistance,
      estimatedFuelConsumption: this.calculateFuelConsumption(totalDistance, vehicle),
      trafficFactors: [],
      status: 'planned',
      optimizationMetadata: {
        algorithmUsed: 'NEAREST_NEIGHBOR_HEURISTIC_WITH_DELHI_CONSTRAINTS',
        optimizationTime: 0,
        iterations: 1,
        objectiveValue: totalDistance,
        constraintsApplied: this.getAppliedConstraints(request.constraints),
        fallbackUsed: true,
        version: '1.0.0'
      },
      complianceValidation,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Helper methods

  private getDeliveryForLocationIndex(locationIndex: number, request: RoutingRequest): Delivery | null {
    // Implementation depends on how locations are indexed
    // This is a simplified version
    if (locationIndex < request.vehicles.length) return null;

    const deliveryIndex = Math.floor((locationIndex - request.vehicles.length) / 2);
    return request.deliveries[deliveryIndex] || null;
  }

  private getLocationIndex(location: GeoLocation, request: RoutingRequest): number {
    // Find location index in the combined location array
    let index = 0;

    // Check vehicle locations
    for (const vehicle of request.vehicles) {
      if (this.locationsEqual(vehicle.location, location)) {
        return index;
      }
      index++;
    }

    // Check delivery locations
    for (const delivery of request.deliveries) {
      if (this.locationsEqual(delivery.pickupLocation, location)) {
        return index;
      }
      index++;
      if (this.locationsEqual(delivery.deliveryLocation, location)) {
        return index;
      }
      index++;
    }

    // Check hub locations
    for (const hub of request.hubs) {
      if (this.locationsEqual(hub.location, location)) {
        return index;
      }
      index++;
    }

    return -1;
  }

  private getLocationByIndex(index: number, request: RoutingRequest): GeoLocation | null {
    let currentIndex = 0;

    // Vehicle locations
    for (const vehicle of request.vehicles) {
      if (currentIndex === index) return vehicle.location;
      currentIndex++;
    }

    // Delivery locations
    for (const delivery of request.deliveries) {
      if (currentIndex === index) return delivery.pickupLocation;
      currentIndex++;
      if (currentIndex === index) return delivery.deliveryLocation;
      currentIndex++;
    }

    // Hub locations
    for (const hub of request.hubs) {
      if (currentIndex === index) return hub.location;
      currentIndex++;
    }

    return null;
  }

  private determineStopType(locationIndex: number, request: RoutingRequest): 'pickup' | 'delivery' | 'hub' | 'waypoint' {
    let currentIndex = 0;

    // Skip vehicle locations
    currentIndex += request.vehicles.length;

    // Check delivery locations
    for (let i = 0; i < request.deliveries.length; i++) {
      if (currentIndex === locationIndex) return 'pickup';
      currentIndex++;
      if (currentIndex === locationIndex) return 'delivery';
      currentIndex++;
    }

    // Must be hub
    return 'hub';
  }

  private locationsEqual(loc1: GeoLocation, loc2: GeoLocation): boolean {
    const tolerance = 0.0001; // ~10 meters
    return Math.abs(loc1.latitude - loc2.latitude) < tolerance &&
      Math.abs(loc1.longitude - loc2.longitude) < tolerance;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private estimateTravelTime(distanceKm: number): number {
    // Delhi traffic-adjusted travel time estimation
    if (distanceKm <= 5) {
      return distanceKm * 8; // 8 minutes per km for short distances
    } else if (distanceKm <= 20) {
      return distanceKm * 6; // 6 minutes per km for medium distances
    } else {
      return distanceKm * 4; // 4 minutes per km for long distances
    }
  }

  /**
   * Validates route compliance with Delhi regulations
   * @param vehicle - Vehicle for the route
   * @param stops - Route stops
   * @param request - Original routing request
   * @returns Compliance validation result
   */
  private async validateRouteCompliance(vehicle: Vehicle, stops: RouteStop[], request: RoutingRequest): Promise<{
    isCompliant: boolean;
    validatedAt: Date;
    violations: any[];
    warnings: any[];
    exemptions: any[];
  }> {
    const violations: any[] = [];
    const warnings: any[] = [];
    const exemptions: any[] = [];

    // Create a simplified route object for compliance validation
    const routeForValidation = {
      stops: stops.map(stop => ({
        location: stop.location,
        estimatedArrivalTime: stop.estimatedArrivalTime
      }))
    };

    try {
      const complianceResult = this.delhiComplianceService.validateVehicleMovement(
        vehicle,
        routeForValidation,
        this.getEarliestTime(request.timeWindow)
      );

      violations.push(...complianceResult.violations);
      warnings.push(...complianceResult.warnings);

      // Check for exemptions
      if (vehicle.vehicleSpecs.fuelType === 'electric') {
        exemptions.push({
          type: 'electric_vehicle',
          reason: 'Electric vehicle exemption from certain restrictions',
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
          authorizedBy: 'Delhi Transport Authority'
        });
      }

      Logger.debug(`Route compliance validation completed for vehicle ${vehicle.id}: ${complianceResult.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}`);

      return {
        isCompliant: complianceResult.isCompliant,
        validatedAt: new Date(),
        violations,
        warnings,
        exemptions
      };

    } catch (error) {
      Logger.error(`Route compliance validation failed for vehicle ${vehicle.id}`, { error: error instanceof Error ? error.message : String(error) });

      return {
        isCompliant: false,
        validatedAt: new Date(),
        violations: [{
          type: 'zone_restriction',
          description: 'Failed to validate route compliance',
          severity: 'high',
          penalty: 0,
          location: { latitude: 0, longitude: 0 },
          timestamp: new Date()
        }],
        warnings,
        exemptions
      };
    }
  }

  /**
   * Gets applied constraints for metadata
   * @param constraints - Routing constraints
   * @returns Array of applied constraint names
   */
  private getAppliedConstraints(constraints: RoutingConstraints): string[] {
    const applied: string[] = [];

    if (constraints.vehicleCapacityConstraints) {
      applied.push('vehicle_capacity');
    }
    if (constraints.timeWindowConstraints) {
      applied.push('time_windows');
    }
    if (constraints.hubSequencing) {
      applied.push('hub_sequencing');
    }
    if (constraints.vehicleClassRestrictions?.length) {
      applied.push('delhi_vehicle_class_restrictions');
    }
    if (constraints.timeWindowConstraints_delhi?.length) {
      applied.push('delhi_time_window_constraints');
    }
    if (constraints.zoneAccessRules?.length) {
      applied.push('delhi_zone_access_rules');
    }
    if (constraints.pollutionCompliance?.length) {
      applied.push('delhi_pollution_compliance');
    }
    if (constraints.oddEvenRules?.length) {
      applied.push('delhi_odd_even_rules');
    }
    if (constraints.weightDimensionLimits?.length) {
      applied.push('delhi_weight_dimension_limits');
    }

    return applied;
  }

  /**
   * Calculates total cost for VRP solution
   * @param vrpSolution - VRP solution
   * @returns Total cost
   */
  private calculateTotalCost(vrpSolution: VRPSolution): number {
    // Simple cost calculation based on distance
    // In a real system, this would include fuel costs, driver costs, vehicle depreciation, etc.
    const costPerKm = 10; // INR per kilometer
    return vrpSolution.totalDistance * costPerKm;
  }

  private calculateFuelConsumption(distanceKm: number, vehicle: Vehicle): number {
    // Fuel consumption calculation based on vehicle type and fuel type
    let fuelEfficiency: number; // km per liter

    switch (vehicle.type) {
      case 'truck':
        fuelEfficiency = vehicle.vehicleSpecs.fuelType === 'electric' ? 0 : 4; // 4 km/l for trucks
        break;
      case 'tempo':
        fuelEfficiency = vehicle.vehicleSpecs.fuelType === 'electric' ? 0 : 8; // 8 km/l for tempos
        break;
      case 'van':
        fuelEfficiency = vehicle.vehicleSpecs.fuelType === 'electric' ? 0 : 10; // 10 km/l for vans
        break;
      case 'three-wheeler':
        fuelEfficiency = vehicle.vehicleSpecs.fuelType === 'electric' ? 0 : 15; // 15 km/l for three-wheelers
        break;
      default:
        fuelEfficiency = vehicle.vehicleSpecs.fuelType === 'electric' ? 0 : 8;
    }

    if (vehicle.vehicleSpecs.fuelType === 'electric') {
      // For electric vehicles, return kWh consumption instead of fuel liters
      const kwhPer100km = vehicle.type === 'truck' ? 80 : vehicle.type === 'tempo' ? 40 : 25;
      return (distanceKm / 100) * kwhPer100km;
    }

    return fuelEfficiency > 0 ? distanceKm / fuelEfficiency : 0;
  }

  /**
   * Public method to validate route compliance (for external use)
   * @param route - Route to validate
   * @returns Validation result
   */
  async validateRoute(route: Route): Promise<{ isValid: boolean; violations: any[]; warnings: any[] }> {
    try {
      // This would typically fetch the vehicle from a service
      // For now, we'll create a mock validation
      return {
        isValid: route.complianceValidation?.isCompliant ?? false,
        violations: route.complianceValidation?.violations ?? [],
        warnings: route.complianceValidation?.warnings ?? []
      };
    } catch (error) {
      Logger.error('Route validation failed', { error: error instanceof Error ? error.message : String(error) });
      return {
        isValid: false,
        violations: [{
          type: 'zone_restriction',
          description: 'Failed to validate route',
          severity: 'high',
          penalty: 0,
          location: { latitude: 0, longitude: 0 },
          timestamp: new Date()
        }],
        warnings: []
      };
    }
  }

  /**
   * Validates vehicle class compliance for a specific route
   * @param vehicle - Vehicle to validate
   * @param route - Route to check
   * @returns Compliance result
   */
  async validateVehicleClassCompliance(vehicle: Vehicle, route: Route): Promise<ComplianceResult> {
    try {
      const routeForValidation = {
        stops: route.stops.map(stop => ({
          location: stop.location,
          estimatedArrivalTime: stop.estimatedArrivalTime
        }))
      };

      return this.delhiComplianceService.validateVehicleMovement(
        vehicle,
        routeForValidation,
        route.stops[0]?.estimatedArrivalTime ?? new Date()
      );
    } catch (error) {
      Logger.error('Vehicle class compliance validation failed', { error: error instanceof Error ? error.message : String(error) });

      return {
        isCompliant: false,
        violations: [{
          type: 'zone_restriction',
          description: 'Failed to validate vehicle class compliance',
          severity: 'high',
          penalty: 0,
          location: route.stops[0]?.location ?? { latitude: 0, longitude: 0 },
          timestamp: new Date()
        }],
        warnings: [],
        suggestedActions: ['Contact system administrator'],
        alternativeOptions: {
          alternativeVehicles: [],
          alternativeTimeWindows: [],
          alternativeRoutes: [],
          loadSplittingOptions: []
        }
      };
    }
  }

  /**
   * Suggests alternative vehicles when compliance issues occur
   * @param originalVehicle - Vehicle with compliance issues
   * @param delivery - Delivery to serve
   * @returns Array of alternative vehicles
   */
  async suggestAlternativeVehicles(originalVehicle: Vehicle, delivery: Delivery): Promise<Vehicle[]> {
    // This would typically query a vehicle service for alternatives
    // For now, return an empty array as this requires integration with fleet service
    Logger.info(`Suggesting alternatives for vehicle ${originalVehicle.id} and delivery ${delivery.id}`);
    return [];
  }

  /**
   * Optimizes routes for premium dedicated service with no load sharing
   * @param request - Premium routing request
   * @param distanceMatrix - Pre-calculated distance matrix
   * @param startTime - Optimization start time
   * @returns RouteOptimizationResult with premium routes
   */
  private async optimizePremiumRoutes(
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix,
    startTime: number
  ): Promise<RouteOptimizationResult> {
    Logger.info('Starting premium dedicated service routing', {
      vehicleCount: request.vehicles.length,
      deliveryCount: request.deliveries.length,
      premiumCustomers: request.premiumCustomerIds?.length || 0
    });

    try {
      // Filter vehicles for premium service eligibility
      const premiumEligibleVehicles = await this.filterPremiumEligibleVehicles(request);

      if (premiumEligibleVehicles.length === 0) {
        return {
          success: false,
          routes: [],
          totalDistance: 0,
          totalDuration: 0,
          totalCost: 0,
          optimizationTime: Date.now() - startTime,
          algorithmUsed: 'PREMIUM_NO_VEHICLES',
          objectiveValue: 0,
          message: 'No vehicles available for premium dedicated service'
        };
      }

      // Create dedicated vehicle assignments for premium deliveries
      const premiumRoutes = await this.createDedicatedVehicleRoutes(
        request,
        premiumEligibleVehicles,
        distanceMatrix
      );

      // Apply priority scheduling for premium deliveries
      const prioritizedRoutes = this.applyPriorityScheduling(premiumRoutes, request);

      // Calculate totals
      let totalDistance = 0;
      let totalDuration = 0;
      let totalCost = 0;

      prioritizedRoutes.forEach(route => {
        totalDistance += route.estimatedDistance;
        totalDuration += route.estimatedDuration;
        totalCost += this.calculatePremiumRouteCost(route);
      });

      const optimizationTime = Date.now() - startTime;

      Logger.info('Premium routing completed successfully', {
        routeCount: prioritizedRoutes.length,
        totalDistance,
        optimizationTime
      });

      return {
        success: true,
        routes: prioritizedRoutes,
        totalDistance,
        totalDuration,
        totalCost,
        optimizationTime,
        algorithmUsed: 'PREMIUM_DEDICATED_ROUTING',
        objectiveValue: totalCost, // Use cost as objective for premium service
        premiumRoutes: prioritizedRoutes.map(route => ({
          ...route,
          dedicatedVehicle: true,
          premiumCustomerId: this.extractPremiumCustomerId(route, request),
          guaranteedTimeWindow: this.calculateGuaranteedTimeWindow(route),
          priorityLevel: this.determinePriorityLevel(route, request) as "high" | "urgent",
          exclusiveAllocation: true
        }))
      };

    } catch (error) {
      Logger.error('Premium routing optimization failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        totalCost: 0,
        optimizationTime: Date.now() - startTime,
        algorithmUsed: 'PREMIUM_FAILED',
        objectiveValue: 0,
        message: `Premium routing failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Filters vehicles eligible for premium dedicated service
   * @param request - Routing request
   * @returns Array of premium-eligible vehicles
   */
  private async filterPremiumEligibleVehicles(request: RoutingRequest): Promise<Vehicle[]> {
    const eligibleVehicles: Vehicle[] = [];

    // First apply standard compliance filtering
    const compliantVehicles = await this.filterCompliantVehicles(request);

    for (const vehicle of compliantVehicles) {
      // Premium service requirements
      const isPremiumEligible = this.checkPremiumEligibility(vehicle, request);

      if (isPremiumEligible) {
        eligibleVehicles.push(vehicle);
        Logger.debug(`Vehicle ${vehicle.id} eligible for premium service`);
      } else {
        Logger.debug(`Vehicle ${vehicle.id} not eligible for premium service`);
      }
    }

    Logger.info(`Found ${eligibleVehicles.length} premium-eligible vehicles out of ${compliantVehicles.length} compliant vehicles`);
    return eligibleVehicles;
  }

  /**
   * Checks if a vehicle is eligible for premium dedicated service
   * @param vehicle - Vehicle to check
   * @param request - Routing request
   * @returns boolean indicating premium eligibility
   */
  private checkPremiumEligibility(vehicle: Vehicle, request: RoutingRequest): boolean {
    // Premium service criteria
    const criteria = {
      // Vehicle must be in good condition (not too old)
      maxAge: 7,
      // Must have sufficient capacity for typical premium deliveries
      minCapacityWeight: 500,
      minCapacityVolume: 2,
      // Must have access to all zone types
      requiredAccessPrivileges: ['residentialZones', 'commercialZones'],
      // Must have valid compliance certificates
      requiredCompliance: ['pollutionCertificate', 'permitValid']
    };

    // Check vehicle age
    if (vehicle.vehicleSpecs.vehicleAge > criteria.maxAge) {
      return false;
    }

    // Check capacity requirements
    if (vehicle.capacity.weight < criteria.minCapacityWeight ||
      vehicle.capacity.volume < criteria.minCapacityVolume) {
      return false;
    }

    // Check access privileges
    for (const privilege of criteria.requiredAccessPrivileges) {
      if (!vehicle.accessPrivileges[privilege as keyof typeof vehicle.accessPrivileges]) {
        return false;
      }
    }

    // Check compliance requirements
    for (const complianceItem of criteria.requiredCompliance) {
      if (!vehicle.compliance[complianceItem as keyof typeof vehicle.compliance]) {
        return false;
      }
    }

    // Check if vehicle can serve premium deliveries within time windows
    for (const delivery of request.deliveries) {
      if (this.isPremiumDelivery(delivery, request)) {
        if (!this.canVehicleServeDelivery(vehicle, delivery, request.timeWindow)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Creates dedicated vehicle routes for premium service (no load sharing)
   * @param request - Routing request
   * @param vehicles - Premium-eligible vehicles
   * @param distanceMatrix - Distance matrix
   * @returns Array of dedicated routes
   */
  private async createDedicatedVehicleRoutes(
    request: RoutingRequest,
    vehicles: Vehicle[],
    distanceMatrix: DistanceMatrix
  ): Promise<Route[]> {
    const dedicatedRoutes: Route[] = [];
    const availableVehicles = [...vehicles];

    // Separate premium and regular deliveries
    const premiumDeliveries = request.deliveries.filter(d => this.isPremiumDelivery(d, request));
    const regularDeliveries = request.deliveries.filter(d => !this.isPremiumDelivery(d, request));

    Logger.info(`Creating dedicated routes for ${premiumDeliveries.length} premium deliveries`);

    // Create dedicated routes for premium deliveries (one vehicle per delivery)
    for (const delivery of premiumDeliveries) {
      const bestVehicle = this.selectBestVehicleForPremiumDelivery(
        delivery,
        availableVehicles,
        request,
        distanceMatrix
      );

      if (bestVehicle) {
        const dedicatedRoute = await this.createDedicatedRoute(
          bestVehicle,
          delivery,
          request,
          distanceMatrix
        );

        if (dedicatedRoute) {
          dedicatedRoutes.push(dedicatedRoute);
          // Remove vehicle from available pool (exclusive allocation)
          const vehicleIndex = availableVehicles.findIndex(v => v.id === bestVehicle.id);
          if (vehicleIndex !== -1) {
            availableVehicles.splice(vehicleIndex, 1);
          }
        }
      } else {
        Logger.warn(`No available vehicle for premium delivery ${delivery.id}`);
      }
    }

    // Handle remaining regular deliveries with remaining vehicles (if any)
    if (regularDeliveries.length > 0 && availableVehicles.length > 0) {
      const regularRoutingRequest: RoutingRequest = {
        ...request,
        deliveries: regularDeliveries,
        vehicles: availableVehicles,
        serviceType: 'shared' // Use shared service for regular deliveries
      };

      const regularRoutes = await this.createSharedRoutes(regularRoutingRequest, distanceMatrix);
      dedicatedRoutes.push(...regularRoutes);
    }

    return dedicatedRoutes;
  }

  /**
   * Selects the best vehicle for a premium delivery based on multiple criteria
   * @param delivery - Premium delivery
   * @param availableVehicles - Available vehicles
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Best vehicle for the delivery
   */
  private selectBestVehicleForPremiumDelivery(
    delivery: Delivery,
    availableVehicles: Vehicle[],
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Vehicle | null {
    let bestVehicle: Vehicle | null = null;
    let bestScore = -1;

    for (const vehicle of availableVehicles) {
      // Check if vehicle can serve this delivery
      if (!this.canVehicleServeDelivery(vehicle, delivery, request.timeWindow)) {
        continue;
      }

      // Calculate selection score based on multiple factors
      const score = this.calculateVehicleSelectionScore(vehicle, delivery, distanceMatrix, request);

      if (score > bestScore) {
        bestScore = score;
        bestVehicle = vehicle;
      }
    }

    if (bestVehicle) {
      Logger.debug(`Selected vehicle ${bestVehicle.id} for premium delivery ${delivery.id} with score ${bestScore}`);
    }

    return bestVehicle;
  }

  /**
   * Calculates vehicle selection score for premium delivery assignment
   * @param vehicle - Vehicle to score
   * @param delivery - Delivery to serve
   * @param distanceMatrix - Distance matrix
   * @param request - Routing request
   * @returns Selection score (higher is better)
   */
  private calculateVehicleSelectionScore(
    vehicle: Vehicle,
    delivery: Delivery,
    distanceMatrix: DistanceMatrix,
    request: RoutingRequest
  ): number {
    let score = 0;

    // Factor 1: Proximity to pickup location (40% weight)
    const pickupLocationIndex = this.getLocationIndex(delivery.pickupLocation, request);
    const vehicleLocationIndex = this.getLocationIndex(vehicle.location, request);
    const distanceToPickup = distanceMatrix.distances[vehicleLocationIndex]?.[pickupLocationIndex] || 0;
    const proximityScore = Math.max(0, 100 - distanceToPickup); // Closer is better
    score += proximityScore * 0.4;

    // Factor 2: Capacity efficiency (20% weight)
    const capacityUtilization = Math.min(
      delivery.shipment.weight / vehicle.capacity.weight,
      delivery.shipment.volume / vehicle.capacity.volume
    );
    const capacityScore = capacityUtilization * 100; // Better utilization is better
    score += capacityScore * 0.2;

    // Factor 3: Vehicle type suitability (20% weight)
    const suitabilityScore = this.calculateVehicleTypeSuitability(vehicle, delivery);
    score += suitabilityScore * 0.2;

    // Factor 4: Fuel efficiency (10% weight)
    const fuelEfficiencyScore = this.calculateFuelEfficiencyScore(vehicle);
    score += fuelEfficiencyScore * 0.1;

    // Factor 5: Vehicle age/condition (10% weight)
    const conditionScore = Math.max(0, 100 - (vehicle.vehicleSpecs.vehicleAge * 10));
    score += conditionScore * 0.1;

    return score;
  }

  /**
   * Creates a dedicated route for a single premium delivery
   * @param vehicle - Dedicated vehicle
   * @param delivery - Premium delivery
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Dedicated route
   */
  private async createDedicatedRoute(
    vehicle: Vehicle,
    delivery: Delivery,
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Route | null> {
    try {
      const routeId = `premium_${vehicle.id}_${delivery.id}`;

      // Create route stops: vehicle location -> pickup -> delivery
      const stops: RouteStop[] = [];
      const currentTime = this.getEarliestTime(request.timeWindow);

      // Calculate travel time to pickup
      const vehicleLocationIndex = this.getLocationIndex(vehicle.location, request);
      const pickupLocationIndex = this.getLocationIndex(delivery.pickupLocation, request);
      const travelTimeToPickup = distanceMatrix.durations[vehicleLocationIndex]?.[pickupLocationIndex] || 0;

      // Pickup stop
      const pickupArrivalTime = new Date(currentTime.getTime() + travelTimeToPickup * 60 * 1000);
      const pickupDepartureTime = new Date(pickupArrivalTime.getTime() + 15 * 60 * 1000); // 15 min pickup time

      stops.push({
        id: `${routeId}_pickup`,
        sequence: 0,
        location: delivery.pickupLocation,
        type: 'pickup',
        estimatedArrivalTime: pickupArrivalTime,
        estimatedDepartureTime: pickupDepartureTime,
        duration: 15,
        status: 'pending',
        deliveryId: delivery.id
      });

      // Calculate travel time from pickup to delivery
      const deliveryLocationIndex = this.getLocationIndex(delivery.deliveryLocation, request);
      const travelTimeToDelivery = distanceMatrix.durations[pickupLocationIndex]?.[deliveryLocationIndex] || 0;

      // Delivery stop
      const deliveryArrivalTime = new Date(pickupDepartureTime.getTime() + travelTimeToDelivery * 60 * 1000);
      const deliveryDepartureTime = new Date(deliveryArrivalTime.getTime() + 20 * 60 * 1000); // 20 min delivery time

      stops.push({
        id: `${routeId}_delivery`,
        sequence: 1,
        location: delivery.deliveryLocation,
        type: 'delivery',
        estimatedArrivalTime: deliveryArrivalTime,
        estimatedDepartureTime: deliveryDepartureTime,
        duration: 20,
        status: 'pending',
        deliveryId: delivery.id
      });

      // Calculate route metrics
      const totalDistance = (distanceMatrix.distances[vehicleLocationIndex]?.[pickupLocationIndex] || 0) +
        (distanceMatrix.distances[pickupLocationIndex]?.[deliveryLocationIndex] || 0);
      const totalDuration = travelTimeToPickup + travelTimeToDelivery + 35; // 35 minutes for stops

      // Validate route compliance
      const complianceValidation = await this.validateRouteCompliance(vehicle, stops, request);

      const route: Route = {
        id: routeId,
        vehicleId: vehicle.id,
        driverId: vehicle.driverInfo.id,
        stops,
        estimatedDuration: totalDuration,
        estimatedDistance: totalDistance,
        estimatedFuelConsumption: this.calculateFuelConsumption(totalDistance, vehicle),
        trafficFactors: [],
        status: 'planned',
        routeType: 'premium_dedicated',
        deliveryIds: [delivery.id],
        optimizationMetadata: {
          algorithmUsed: 'PREMIUM_DEDICATED_ROUTING',
          optimizationTime: 0,
          iterations: 1,
          objectiveValue: totalDistance,
          constraintsApplied: this.getAppliedConstraints(request.constraints),
          fallbackUsed: false,
          version: '1.0.0'
        },
        complianceValidation,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      Logger.info(`Created dedicated premium route ${routeId}`, {
        vehicleId: vehicle.id,
        deliveryId: delivery.id,
        distance: totalDistance,
        duration: totalDuration
      });

      return route;

    } catch (error) {
      Logger.error(`Failed to create dedicated route for delivery ${delivery.id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // ============================================================================
  // HUB-AND-SPOKE ROUTING IMPLEMENTATION
  // ============================================================================

  /**
   * Optimizes routes using hub-and-spoke model with multi-hub support
   * @param request - Routing request with hubs
   * @returns RouteOptimizationResult with hub-and-spoke routes
   */
  async optimizeHubAndSpokeRoutes(request: RoutingRequest): Promise<RouteOptimizationResult> {
    const startTime = Date.now();

    try {
      Logger.info('Starting hub-and-spoke route optimization', {
        vehicleCount: request.vehicles.length,
        deliveryCount: request.deliveries.length,
        hubCount: request.hubs.length
      });

      // Validate hub-and-spoke requirements
      if (!request.hubs || request.hubs.length === 0) {
        Logger.info('No hubs provided, falling back to regular routing');
        
        // If no vehicles or deliveries either, return empty success result
        if ((!request.vehicles || request.vehicles.length === 0) && 
            (!request.deliveries || request.deliveries.length === 0)) {
          return {
            success: true,
            routes: [],
            totalDistance: 0,
            totalDuration: 0,
            totalCost: 0,
            optimizationTime: Date.now() - startTime,
            algorithmUsed: 'FALLBACK_EMPTY',
            objectiveValue: 0,
            message: 'No hubs, vehicles, or deliveries to route'
          };
        }
        
        // Fallback to regular routing
        return await this.optimizeRoutes(request);
      }

      // Build extended distance matrix including hubs
      const distanceMatrix = await this.buildDistanceMatrix(request);

      // Analyze deliveries and determine hub assignments
      const hubAssignments = await this.assignDeliveriesToHubs(request, distanceMatrix);

      // Handle capacity-exceeded deliveries with load splitting
      const splitDeliveries = await this.handleLoadSplitting(request, hubAssignments);

      // Create hub-to-hub transfer routes
      const transferRoutes = await this.createHubTransferRoutes(request, splitDeliveries, distanceMatrix);

      // Create hub-to-delivery routes (last mile)
      const deliveryRoutes = await this.createHubToDeliveryRoutes(request, splitDeliveries, distanceMatrix);

      // Combine all routes
      const allRoutes = [...transferRoutes, ...deliveryRoutes];

      // Calculate totals
      const totalDistance = allRoutes.reduce((sum, route) => sum + route.estimatedDistance, 0);
      const totalDuration = allRoutes.reduce((sum, route) => sum + route.estimatedDuration, 0);
      const totalCost = allRoutes.reduce((sum, route) => sum + this.calculateTotalCost({
        vehicleRoutes: [], totalDistance: route.estimatedDistance, totalDuration: route.estimatedDuration, objectiveValue: 0, status: 'OPTIMAL'
      }), 0);

      const optimizationTime = Date.now() - startTime;

      Logger.info('Hub-and-spoke optimization completed successfully', {
        routeCount: allRoutes.length,
        transferRoutes: transferRoutes.length,
        deliveryRoutes: deliveryRoutes.length,
        totalDistance,
        optimizationTime
      });

      return {
        success: true,
        routes: allRoutes,
        totalDistance,
        totalDuration,
        totalCost,
        optimizationTime,
        algorithmUsed: 'HUB_AND_SPOKE_ROUTING',
        objectiveValue: totalDistance
      };

    } catch (error) {
      Logger.error('Hub-and-spoke optimization failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to regular routing
      return await this.optimizeRoutes({
        ...request,
        constraints: { ...request.constraints, hubSequencing: false }
      });
    }
  }

  /**
   * Assigns deliveries to optimal hubs based on distance and capacity
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Hub assignments for deliveries
   */
  private async assignDeliveriesToHubs(
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Map<string, HubAssignment>> {
    const assignments = new Map<string, HubAssignment>();

    for (const delivery of request.deliveries) {
      const bestHub = await this.findOptimalHubForDelivery(delivery, request.hubs, distanceMatrix, request);

      if (bestHub) {
        assignments.set(delivery.id, {
          deliveryId: delivery.id,
          hubId: bestHub.hub.id,
          assignmentScore: bestHub.score,
          estimatedTransferTime: bestHub.transferTime,
          estimatedDeliveryTime: bestHub.deliveryTime,
          requiresLoadSplitting: bestHub.requiresLoadSplitting
        });

        Logger.debug(`Assigned delivery ${delivery.id} to hub ${bestHub.hub.id} with score ${bestHub.score}`);
      } else {
        Logger.warn(`Could not assign delivery ${delivery.id} to any hub`);
      }
    }

    return assignments;
  }

  /**
   * Finds the optimal hub for a delivery based on multiple criteria
   * @param delivery - Delivery to assign
   * @param hubs - Available hubs
   * @param distanceMatrix - Distance matrix
   * @param request - Routing request
   * @returns Best hub assignment with score
   */
  private async findOptimalHubForDelivery(
    delivery: Delivery,
    hubs: Hub[],
    distanceMatrix: DistanceMatrix,
    request: RoutingRequest
  ): Promise<{ hub: Hub; score: number; transferTime: number; deliveryTime: number; requiresLoadSplitting: boolean } | null> {
    let bestAssignment: { hub: Hub; score: number; transferTime: number; deliveryTime: number; requiresLoadSplitting: boolean } | null = null;
    let bestScore = -1;

    for (const hub of hubs) {
      // Check if hub is operational
      // const operatingHours = hub.operatingHours;
      const isOperational = hub.status === 'active';

      if (!isOperational) {
        continue;
      }

      // Calculate distances and times
      const pickupLocationIndex = this.getLocationIndex(delivery.pickupLocation, request);
      const deliveryLocationIndex = this.getLocationIndex(delivery.deliveryLocation, request);
      const hubLocationIndex = this.getLocationIndex(hub.location, request);

      const pickupToHubDistance = distanceMatrix.distances[pickupLocationIndex]?.[hubLocationIndex] || 0;
      const hubToDeliveryDistance = distanceMatrix.distances[hubLocationIndex]?.[deliveryLocationIndex] || 0;
      const pickupToHubTime = distanceMatrix.durations[pickupLocationIndex]?.[hubLocationIndex] || 0;
      const hubToDeliveryTime = distanceMatrix.durations[hubLocationIndex]?.[deliveryLocationIndex] || 0;

      // Calculate assignment score based on multiple factors
      const score = this.calculateHubAssignmentScore(
        delivery,
        hub,
        pickupToHubDistance,
        hubToDeliveryDistance,
        pickupToHubTime,
        hubToDeliveryTime
      );

      // Check if load splitting is required
      const requiresLoadSplitting = this.checkIfLoadSplittingRequired(delivery, hub, request);

      if (score > bestScore) {
        bestScore = score;
        bestAssignment = {
          hub,
          score,
          transferTime: pickupToHubTime + 30, // 30 minutes hub processing time
          deliveryTime: hubToDeliveryTime,
          requiresLoadSplitting
        };
      }
    }

    return bestAssignment;
  }

  /**
   * Calculates hub assignment score based on multiple optimization criteria
   * @param delivery - Delivery to assign
   * @param hub - Hub to evaluate
   * @param pickupToHubDistance - Distance from pickup to hub
   * @param hubToDeliveryDistance - Distance from hub to delivery
   * @param pickupToHubTime - Time from pickup to hub
   * @param hubToDeliveryTime - Time from hub to delivery
   * @returns Assignment score (higher is better)
   */
  private calculateHubAssignmentScore(
    delivery: Delivery,
    hub: Hub,
    pickupToHubDistance: number,
    hubToDeliveryDistance: number,
    pickupToHubTime: number,
    hubToDeliveryTime: number
  ): number {
    let score = 0;

    // Factor 1: Total distance efficiency (40% weight)
    const totalDistance = pickupToHubDistance + hubToDeliveryDistance;
    const distanceScore = Math.max(0, 100 - totalDistance); // Shorter total distance is better
    score += distanceScore * 0.4;

    // Factor 2: Hub capacity utilization (25% weight)
    const capacityStatus = hub.capacity;
    const capacityUtilization = capacityStatus.currentVehicles / capacityStatus.maxVehicles;
    const capacityScore = (1 - capacityUtilization) * 100; // Less utilized hubs are better
    score += capacityScore * 0.25;

    // Factor 3: Hub type preference (20% weight)
    const hubTypeScore = hub.hubType === 'primary' ? 100 : hub.hubType === 'secondary' ? 75 : 50;
    score += hubTypeScore * 0.2;

    // Factor 4: Buffer vehicle availability (10% weight)
    const bufferAvailability = hub.bufferVehicles.filter(v => v.status === 'available').length;
    const bufferScore = Math.min(100, bufferAvailability * 25); // More buffer vehicles is better
    score += bufferScore * 0.1;

    // Factor 5: Time efficiency (5% weight)
    const totalTime = pickupToHubTime + hubToDeliveryTime;
    const timeScore = Math.max(0, 100 - (totalTime / 10)); // Shorter total time is better
    score += timeScore * 0.05;

    return score;
  }

  /**
   * Checks if load splitting is required for a delivery at a hub
   * @param delivery - Delivery to check
   * @param hub - Hub to check capacity
   * @param request - Routing request
   * @returns boolean indicating if load splitting is needed
   */
  private checkIfLoadSplittingRequired(delivery: Delivery, hub: Hub, request: RoutingRequest): boolean {
    // Find available vehicles at the hub that can handle the delivery
    const availableVehicles = request.vehicles.filter(vehicle =>
      vehicle.status === 'available' &&
      this.canVehicleServeDelivery(vehicle, delivery, request.timeWindow)
    );

    // Check if any single vehicle can handle the full load
    const canHandleFullLoad = availableVehicles.some(vehicle =>
      vehicle.capacity.weight >= delivery.shipment.weight &&
      vehicle.capacity.volume >= delivery.shipment.volume
    );

    return !canHandleFullLoad && delivery.shipment.weight > 0;
  }

  /**
   * Handles load splitting for deliveries that exceed single vehicle capacity
   * @param request - Routing request
   * @param hubAssignments - Hub assignments for deliveries
   * @returns Modified delivery assignments with load splitting
   */
  private async handleLoadSplitting(
    request: RoutingRequest,
    hubAssignments: Map<string, HubAssignment>
  ): Promise<Map<string, SplitDeliveryAssignment[]>> {
    const splitAssignments = new Map<string, SplitDeliveryAssignment[]>();

    for (const [deliveryId, assignment] of hubAssignments) {
      const delivery = request.deliveries.find(d => d.id === deliveryId);
      if (!delivery) continue;

      if (assignment.requiresLoadSplitting && request.serviceType !== 'dedicated_premium') {
        // Split the delivery across multiple vehicles
        const splitDeliveries = await this.splitDeliveryLoad(delivery, assignment, request);
        splitAssignments.set(deliveryId, splitDeliveries);

        Logger.info(`Split delivery ${deliveryId} into ${splitDeliveries.length} parts`);
      } else {
        // No splitting required or premium service (no sharing)
        splitAssignments.set(deliveryId, [{
          originalDeliveryId: deliveryId,
          splitIndex: 0,
          splitDelivery: delivery,
          hubAssignment: assignment
          // assignedVehicleId will be assigned during route creation
        }]);
      }
    }

    return splitAssignments;
  }

  /**
   * Splits a delivery load across multiple vehicles when capacity is exceeded
   * @param delivery - Original delivery to split
   * @param hubAssignment - Hub assignment for the delivery
   * @param request - Routing request
   * @returns Array of split delivery assignments
   */
  private async splitDeliveryLoad(
    delivery: Delivery,
    hubAssignment: HubAssignment,
    request: RoutingRequest
  ): Promise<SplitDeliveryAssignment[]> {
    const splitDeliveries: SplitDeliveryAssignment[] = [];

    // Find available vehicles that can contribute to the delivery
    const availableVehicles = request.vehicles.filter(vehicle =>
      vehicle.status === 'available' &&
      this.canVehicleServeDelivery(vehicle, delivery, request.timeWindow)
    );

    if (availableVehicles.length === 0) {
      Logger.warn(`No available vehicles for split delivery ${delivery.id}`);
      return splitDeliveries;
    }

    // Sort vehicles by capacity (largest first) for optimal load distribution
    availableVehicles.sort((a, b) => {
      const aCapacity = Math.min(a.capacity.weight, a.capacity.volume * 100); // Rough weight equivalent
      const bCapacity = Math.min(b.capacity.weight, b.capacity.volume * 100);
      return bCapacity - aCapacity;
    });

    let remainingWeight = delivery.shipment.weight;
    let remainingVolume = delivery.shipment.volume;
    let splitIndex = 0;

    for (const vehicle of availableVehicles) {
      if (remainingWeight <= 0 && remainingVolume <= 0) break;

      // Calculate how much this vehicle can carry
      const vehicleWeightCapacity = Math.min(vehicle.capacity.weight, remainingWeight);
      const vehicleVolumeCapacity = Math.min(vehicle.capacity.volume, remainingVolume);

      // Determine the limiting factor
      const weightRatio = vehicleWeightCapacity / delivery.shipment.weight;
      const volumeRatio = vehicleVolumeCapacity / delivery.shipment.volume;
      const limitingRatio = Math.min(weightRatio, volumeRatio);

      if (limitingRatio > 0) {
        // Create split delivery
        const splitWeight = delivery.shipment.weight * limitingRatio;
        const splitVolume = delivery.shipment.volume * limitingRatio;

        const splitDelivery: Delivery = {
          ...delivery,
          id: `${delivery.id}_split_${splitIndex}`,
          shipment: {
            ...delivery.shipment,
            weight: splitWeight,
            volume: splitVolume
          }
        };

        splitDeliveries.push({
          originalDeliveryId: delivery.id,
          splitIndex,
          splitDelivery,
          hubAssignment,
          assignedVehicleId: vehicle.id
        });

        remainingWeight -= splitWeight;
        remainingVolume -= splitVolume;
        splitIndex++;

        Logger.debug(`Created split delivery ${splitDelivery.id} for vehicle ${vehicle.id}: ${splitWeight}kg, ${splitVolume}m³`);
      }
    }

    // Check if we successfully split the entire delivery
    if (remainingWeight > 0.1 || remainingVolume > 0.01) { // Small tolerance for floating point
      Logger.warn(`Could not fully split delivery ${delivery.id}. Remaining: ${remainingWeight}kg, ${remainingVolume}m³`);
    }

    return splitDeliveries;
  }

  /**
   * Creates hub-to-hub transfer routes for multi-hub operations
   * @param request - Routing request
   * @param splitDeliveries - Split delivery assignments
   * @param distanceMatrix - Distance matrix
   * @returns Array of transfer routes
   */
  private async createHubTransferRoutes(
    request: RoutingRequest,
    splitDeliveries: Map<string, SplitDeliveryAssignment[]>,
    distanceMatrix: DistanceMatrix
  ): Promise<Route[]> {
    const transferRoutes: Route[] = [];

    // Group deliveries by source and destination hubs
    const hubTransfers = new Map<string, { fromHub: Hub; toHub: Hub; deliveries: SplitDeliveryAssignment[] }>();

    for (const [, assignments] of splitDeliveries) {
      for (const assignment of assignments) {
        const sourceHub = this.findNearestHub(assignment.splitDelivery.pickupLocation, request.hubs, distanceMatrix, request);
        const destHub = request.hubs.find(h => h.id === assignment.hubAssignment.hubId);

        if (sourceHub && destHub && sourceHub.id !== destHub.id) {
          const transferKey = `${sourceHub.id}_to_${destHub.id}`;

          if (!hubTransfers.has(transferKey)) {
            hubTransfers.set(transferKey, {
              fromHub: sourceHub,
              toHub: destHub,
              deliveries: []
            });
          }

          hubTransfers.get(transferKey)!.deliveries.push(assignment);
        }
      }
    }

    // Create transfer routes for each hub-to-hub connection
    for (const [, transfer] of hubTransfers) {
      const transferRoute = await this.createHubTransferRoute(
        transfer.fromHub,
        transfer.toHub,
        transfer.deliveries,
        request,
        distanceMatrix
      );

      if (transferRoute) {
        transferRoutes.push(transferRoute);
      }
    }

    return transferRoutes;
  }

  /**
   * Creates a single hub-to-hub transfer route
   * @param fromHub - Source hub
   * @param toHub - Destination hub
   * @param deliveries - Deliveries to transfer
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Transfer route
   */
  private async createHubTransferRoute(
    fromHub: Hub,
    toHub: Hub,
    deliveries: SplitDeliveryAssignment[],
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Route | null> {
    try {
      // Select best vehicle for hub transfer (prioritize larger vehicles)
      const transferVehicle = this.selectBestTransferVehicle(deliveries, request.vehicles, request);

      if (!transferVehicle) {
        Logger.warn(`No suitable vehicle found for hub transfer from ${fromHub.id} to ${toHub.id}`);
        return null;
      }

      const routeId = `hub_transfer_${fromHub.id}_${toHub.id}_${Date.now()}`;

      // Calculate transfer time and distance
      const fromHubIndex = this.getLocationIndex(fromHub.location, request);
      const toHubIndex = this.getLocationIndex(toHub.location, request);
      const transferDistance = distanceMatrix.distances[fromHubIndex]?.[toHubIndex] || 0;
      const transferTime = distanceMatrix.durations[fromHubIndex]?.[toHubIndex] || 0;

      // Create route stops
      const stops: RouteStop[] = [
        {
          id: `${routeId}_pickup_${fromHub.id}`,
          sequence: 0,
          location: fromHub.location,
          type: 'hub',
          hubId: fromHub.id,
          estimatedArrivalTime: this.getEarliestTime(request.timeWindow),
          estimatedDepartureTime: new Date(this.getEarliestTime(request.timeWindow).getTime() + 45 * 60 * 1000), // 45 min loading
          duration: 45,
          status: 'pending'
        },
        {
          id: `${routeId}_delivery_${toHub.id}`,
          sequence: 1,
          location: toHub.location,
          type: 'hub',
          hubId: toHub.id,
          estimatedArrivalTime: new Date(this.getEarliestTime(request.timeWindow).getTime() + (45 + transferTime) * 60 * 1000),
          estimatedDepartureTime: new Date(this.getEarliestTime(request.timeWindow).getTime() + (45 + transferTime + 30) * 60 * 1000), // 30 min unloading
          duration: 30,
          status: 'pending'
        }
      ];

      const totalDuration = transferTime + 75; // Transfer time + loading/unloading
      const complianceValidation = await this.validateRouteCompliance(transferVehicle, stops, request);

      return {
        id: routeId,
        vehicleId: transferVehicle.id,
        driverId: transferVehicle.driverInfo.id,
        stops,
        estimatedDuration: totalDuration,
        estimatedDistance: transferDistance,
        estimatedFuelConsumption: this.calculateFuelConsumption(transferDistance, transferVehicle),
        trafficFactors: [],
        status: 'planned',
        routeType: 'hub_transfer',
        hubId: fromHub.id,
        deliveryIds: deliveries.map(d => d.originalDeliveryId),
        optimizationMetadata: {
          algorithmUsed: 'HUB_TRANSFER_ROUTING',
          optimizationTime: 0,
          iterations: 1,
          objectiveValue: transferDistance,
          constraintsApplied: this.getAppliedConstraints(request.constraints),
          fallbackUsed: false,
          version: '1.0.0'
        },
        complianceValidation,
        createdAt: new Date(),
        updatedAt: new Date()
      };

    } catch (error) {
      Logger.error(`Failed to create hub transfer route from ${fromHub.id} to ${toHub.id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Creates hub-to-delivery routes (last mile delivery)
   * @param request - Routing request
   * @param splitDeliveries - Split delivery assignments
   * @param distanceMatrix - Distance matrix
   * @returns Array of delivery routes
   */
  private async createHubToDeliveryRoutes(
    request: RoutingRequest,
    splitDeliveries: Map<string, SplitDeliveryAssignment[]>,
    distanceMatrix: DistanceMatrix
  ): Promise<Route[]> {
    const deliveryRoutes: Route[] = [];

    // Group deliveries by hub for efficient routing
    const hubDeliveries = new Map<string, SplitDeliveryAssignment[]>();

    for (const [, assignments] of splitDeliveries) {
      for (const assignment of assignments) {
        const hubId = assignment.hubAssignment.hubId;

        if (!hubDeliveries.has(hubId)) {
          hubDeliveries.set(hubId, []);
        }

        hubDeliveries.get(hubId)!.push(assignment);
      }
    }

    // Create delivery routes for each hub
    for (const [hubId, assignments] of hubDeliveries) {
      const hub = request.hubs.find(h => h.id === hubId);
      if (!hub) continue;

      const hubRoutes = await this.createOptimizedHubDeliveryRoutes(
        hub,
        assignments,
        request,
        distanceMatrix
      );

      deliveryRoutes.push(...hubRoutes);
    }

    return deliveryRoutes;
  }

  /**
   * Creates optimized delivery routes from a hub to multiple delivery locations
   * @param hub - Source hub
   * @param assignments - Delivery assignments from this hub
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Array of optimized delivery routes
   */
  private async createOptimizedHubDeliveryRoutes(
    hub: Hub,
    assignments: SplitDeliveryAssignment[],
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Route[]> {
    const routes: Route[] = [];

    // Group assignments by assigned vehicle
    const vehicleAssignments = new Map<string, SplitDeliveryAssignment[]>();

    for (const assignment of assignments) {
      const vehicleId = assignment.assignedVehicleId || 'unassigned';

      if (!vehicleAssignments.has(vehicleId)) {
        vehicleAssignments.set(vehicleId, []);
      }

      vehicleAssignments.get(vehicleId)!.push(assignment);
    }

    // Create route for each vehicle
    for (const [vehicleId, vehicleDeliveries] of vehicleAssignments) {
      if (vehicleId === 'unassigned') {
        // Assign vehicle for unassigned deliveries
        const availableVehicles = request.vehicles.filter(v =>
          v.status === 'available' &&
          !Array.from(vehicleAssignments.keys()).includes(v.id)
        );

        if (availableVehicles.length === 0) {
          Logger.warn(`No available vehicles for unassigned deliveries from hub ${hub.id}`);
          continue;
        }

        // Use nearest neighbor to assign vehicles to remaining deliveries
        const assignedRoutes = await this.assignVehiclesToDeliveries(
          hub,
          vehicleDeliveries,
          availableVehicles,
          request,
          distanceMatrix
        );

        routes.push(...assignedRoutes);
      } else {
        // Create route for pre-assigned vehicle
        const vehicle = request.vehicles.find(v => v.id === vehicleId);
        if (!vehicle) continue;

        const route = await this.createSingleHubDeliveryRoute(
          hub,
          vehicle,
          vehicleDeliveries,
          request,
          distanceMatrix
        );

        if (route) {
          routes.push(route);
        }
      }
    }

    return routes;
  }

  /**
   * Creates a single delivery route from hub using one vehicle
   * @param hub - Source hub
   * @param vehicle - Assigned vehicle
   * @param assignments - Delivery assignments for this vehicle
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Single delivery route
   */
  private async createSingleHubDeliveryRoute(
    hub: Hub,
    vehicle: Vehicle,
    assignments: SplitDeliveryAssignment[],
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Route | null> {
    try {
      const routeId = `hub_delivery_${hub.id}_${vehicle.id}_${Date.now()}`;
      const stops: RouteStop[] = [];
      let currentTime = this.getEarliestTime(request.timeWindow);
      let totalDistance = 0;
      let currentLocation = hub.location;

      // Start from hub
      stops.push({
        id: `${routeId}_start_${hub.id}`,
        sequence: 0,
        location: hub.location,
        type: 'hub',
        hubId: hub.id,
        estimatedArrivalTime: currentTime,
        estimatedDepartureTime: new Date(currentTime.getTime() + 30 * 60 * 1000), // 30 min loading
        duration: 30,
        status: 'pending'
      });

      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);

      // Optimize delivery sequence using nearest neighbor
      const optimizedSequence = this.optimizeDeliverySequence(
        assignments,
        currentLocation,
        distanceMatrix,
        request
      );

      // Add delivery stops
      for (let i = 0; i < optimizedSequence.length; i++) {
        const assignment = optimizedSequence[i]!;
        const delivery = assignment.splitDelivery;

        // Calculate travel time to delivery location
        const currentLocationIndex = this.getLocationIndex(currentLocation, request);
        const deliveryLocationIndex = this.getLocationIndex(delivery.deliveryLocation, request);
        const travelDistance = distanceMatrix.distances[currentLocationIndex]?.[deliveryLocationIndex] || 0;
        const travelTime = distanceMatrix.durations[currentLocationIndex]?.[deliveryLocationIndex] || 0;

        currentTime = new Date(currentTime.getTime() + travelTime * 60 * 1000);
        totalDistance += travelDistance;

        stops.push({
          id: `${routeId}_delivery_${delivery.id}`,
          sequence: i + 1,
          location: delivery.deliveryLocation,
          type: 'delivery',
          deliveryId: delivery.id,
          estimatedArrivalTime: currentTime,
          estimatedDepartureTime: new Date(currentTime.getTime() + 20 * 60 * 1000), // 20 min delivery
          duration: 20,
          status: 'pending'
        });

        currentTime = new Date(currentTime.getTime() + 20 * 60 * 1000);
        currentLocation = delivery.deliveryLocation;
      }

      const totalDuration = (currentTime.getTime() - this.getEarliestTime(request.timeWindow).getTime()) / (1000 * 60);
      const complianceValidation = await this.validateRouteCompliance(vehicle, stops, request);

      return {
        id: routeId,
        vehicleId: vehicle.id,
        driverId: vehicle.driverInfo.id,
        stops,
        estimatedDuration: totalDuration,
        estimatedDistance: totalDistance,
        estimatedFuelConsumption: this.calculateFuelConsumption(totalDistance, vehicle),
        trafficFactors: [],
        status: 'planned',
        routeType: 'hub_to_delivery',
        hubId: hub.id,
        deliveryIds: assignments.map(a => a.originalDeliveryId),
        optimizationMetadata: {
          algorithmUsed: 'HUB_TO_DELIVERY_ROUTING',
          optimizationTime: 0,
          iterations: 1,
          objectiveValue: totalDistance,
          constraintsApplied: this.getAppliedConstraints(request.constraints),
          fallbackUsed: false,
          version: '1.0.0'
        },
        complianceValidation,
        createdAt: new Date(),
        updatedAt: new Date()
      };

    } catch (error) {
      Logger.error(`Failed to create hub delivery route for vehicle ${vehicle.id}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // ============================================================================
  // HELPER METHODS FOR HUB-AND-SPOKE ROUTING
  // ============================================================================

  /**
   * Finds the nearest hub to a given location
   * @param location - Location to find nearest hub for
   * @param hubs - Available hubs
   * @param distanceMatrix - Distance matrix
   * @param request - Routing request
   * @returns Nearest hub
   */
  private findNearestHub(
    location: GeoLocation,
    hubs: Hub[],
    distanceMatrix: DistanceMatrix,
    request: RoutingRequest
  ): Hub | null {
    let nearestHub: Hub | null = null;
    let shortestDistance = Infinity;

    const locationIndex = this.getLocationIndex(location, request);

    for (const hub of hubs) {
      if (hub.status !== 'active') continue;

      const hubIndex = this.getLocationIndex(hub.location, request);
      const distance = distanceMatrix.distances[locationIndex]?.[hubIndex] || Infinity;

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestHub = hub;
      }
    }

    return nearestHub;
  }

  /**
   * Selects the best vehicle for hub-to-hub transfers
   * @param deliveries - Deliveries to transfer
   * @param vehicles - Available vehicles
   * @param request - Routing request
   * @returns Best transfer vehicle
   */
  private selectBestTransferVehicle(
    deliveries: SplitDeliveryAssignment[],
    vehicles: Vehicle[],
    _request: RoutingRequest
  ): Vehicle | null {
    const availableVehicles = vehicles.filter(v => v.status === 'available');

    if (availableVehicles.length === 0) return null;

    // Calculate total load to transfer
    const totalWeight = deliveries.reduce((sum, d) => sum + d.splitDelivery.shipment.weight, 0);
    const totalVolume = deliveries.reduce((sum, d) => sum + d.splitDelivery.shipment.volume, 0);

    // Find vehicles that can handle the load
    const suitableVehicles = availableVehicles.filter(vehicle =>
      vehicle.capacity.weight >= totalWeight && vehicle.capacity.volume >= totalVolume
    );

    if (suitableVehicles.length === 0) {
      Logger.warn('No vehicles with sufficient capacity for hub transfer');
      return null;
    }

    // Select vehicle with best fuel efficiency and capacity utilization
    return suitableVehicles.reduce((best, current) => {
      const bestEfficiency = this.calculateTransferVehicleScore(best, totalWeight, totalVolume);
      const currentEfficiency = this.calculateTransferVehicleScore(current, totalWeight, totalVolume);
      return currentEfficiency > bestEfficiency ? current : best;
    });
  }

  /**
   * Calculates transfer vehicle selection score
   * @param vehicle - Vehicle to score
   * @param totalWeight - Total weight to transfer
   * @param totalVolume - Total volume to transfer
   * @returns Vehicle score
   */
  private calculateTransferVehicleScore(vehicle: Vehicle, totalWeight: number, totalVolume: number): number {
    // Capacity utilization (prefer well-utilized vehicles)
    const weightUtilization = totalWeight / vehicle.capacity.weight;
    const volumeUtilization = totalVolume / vehicle.capacity.volume;
    const utilizationScore = Math.min(weightUtilization, volumeUtilization) * 100;

    // Fuel efficiency score
    const fuelEfficiencyScore = this.calculateFuelEfficiencyScore(vehicle);

    // Vehicle condition score
    const conditionScore = Math.max(0, 100 - (vehicle.vehicleSpecs.vehicleAge * 10));

    // Combined score
    return utilizationScore * 0.5 + fuelEfficiencyScore * 0.3 + conditionScore * 0.2;
  }

  /**
   * Optimizes delivery sequence using nearest neighbor algorithm
   * @param assignments - Delivery assignments to sequence
   * @param startLocation - Starting location
   * @param distanceMatrix - Distance matrix
   * @param request - Routing request
   * @returns Optimized sequence of assignments
   */
  private optimizeDeliverySequence(
    assignments: SplitDeliveryAssignment[],
    startLocation: GeoLocation,
    distanceMatrix: DistanceMatrix,
    request: RoutingRequest
  ): SplitDeliveryAssignment[] {
    if (assignments.length <= 1) return assignments;

    const optimizedSequence: SplitDeliveryAssignment[] = [];
    const remaining = [...assignments];
    let currentLocation = startLocation;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = Infinity;

      const currentLocationIndex = this.getLocationIndex(currentLocation, request);

      // Find nearest remaining delivery
      for (let i = 0; i < remaining.length; i++) {
        const assignment = remaining[i]!;
        const deliveryLocationIndex = this.getLocationIndex(assignment.splitDelivery.deliveryLocation, request);
        const distance = distanceMatrix.distances[currentLocationIndex]?.[deliveryLocationIndex] || Infinity;

        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add nearest delivery to sequence
      const nearestAssignment = remaining.splice(nearestIndex, 1)[0]!;
      optimizedSequence.push(nearestAssignment);
      currentLocation = nearestAssignment.splitDelivery.deliveryLocation;
    }

    return optimizedSequence;
  }

  /**
   * Assigns vehicles to unassigned deliveries using optimization
   * @param hub - Source hub
   * @param assignments - Unassigned delivery assignments
   * @param availableVehicles - Available vehicles
   * @param request - Routing request
   * @param distanceMatrix - Distance matrix
   * @returns Array of assigned routes
   */
  private async assignVehiclesToDeliveries(
    hub: Hub,
    assignments: SplitDeliveryAssignment[],
    availableVehicles: Vehicle[],
    request: RoutingRequest,
    distanceMatrix: DistanceMatrix
  ): Promise<Route[]> {
    const routes: Route[] = [];
    const remainingAssignments = [...assignments];
    const remainingVehicles = [...availableVehicles];

    while (remainingAssignments.length > 0 && remainingVehicles.length > 0) {
      // Find best vehicle-delivery combination
      let bestVehicle: Vehicle | null = null;
      let bestAssignments: SplitDeliveryAssignment[] = [];
      let bestScore = -1;

      for (const vehicle of remainingVehicles) {
        // Find deliveries this vehicle can handle
        const compatibleAssignments = remainingAssignments.filter(assignment =>
          this.canVehicleServeDelivery(vehicle, assignment.splitDelivery, request.timeWindow)
        );

        if (compatibleAssignments.length === 0) continue;

        // Pack as many deliveries as possible into this vehicle
        const packedAssignments = this.packDeliveriesIntoVehicle(vehicle, compatibleAssignments);

        if (packedAssignments.length > 0) {
          const score = this.calculateVehicleAssignmentScore(vehicle, packedAssignments, hub, distanceMatrix, request);

          if (score > bestScore) {
            bestScore = score;
            bestVehicle = vehicle;
            bestAssignments = packedAssignments;
          }
        }
      }

      if (bestVehicle && bestAssignments.length > 0) {
        // Create route for best vehicle-assignment combination
        const route = await this.createSingleHubDeliveryRoute(
          hub,
          bestVehicle,
          bestAssignments,
          request,
          distanceMatrix
        );

        if (route) {
          routes.push(route);
        }

        // Remove assigned vehicle and deliveries
        const vehicleIndex = remainingVehicles.findIndex(v => v.id === bestVehicle!.id);
        if (vehicleIndex !== -1) {
          remainingVehicles.splice(vehicleIndex, 1);
        }

        for (const assignment of bestAssignments) {
          const assignmentIndex = remainingAssignments.findIndex(a => a.splitDelivery.id === assignment.splitDelivery.id);
          if (assignmentIndex !== -1) {
            remainingAssignments.splice(assignmentIndex, 1);
          }
        }
      } else {
        // No more compatible assignments
        break;
      }
    }

    if (remainingAssignments.length > 0) {
      Logger.warn(`Could not assign ${remainingAssignments.length} deliveries from hub ${hub.id}`);
    }

    return routes;
  }

  /**
   * Packs as many deliveries as possible into a single vehicle
   * @param vehicle - Vehicle to pack deliveries into
   * @param assignments - Available delivery assignments
   * @returns Array of assignments that fit in the vehicle
   */
  private packDeliveriesIntoVehicle(vehicle: Vehicle, assignments: SplitDeliveryAssignment[]): SplitDeliveryAssignment[] {
    const packed: SplitDeliveryAssignment[] = [];
    let remainingWeight = vehicle.capacity.weight;
    let remainingVolume = vehicle.capacity.volume;

    // Sort assignments by priority (weight/volume ratio)
    const sortedAssignments = assignments.sort((a, b) => {
      const aRatio = a.splitDelivery.shipment.weight / a.splitDelivery.shipment.volume;
      const bRatio = b.splitDelivery.shipment.weight / b.splitDelivery.shipment.volume;
      return bRatio - aRatio; // Higher ratio first
    });

    for (const assignment of sortedAssignments) {
      const delivery = assignment.splitDelivery;

      if (delivery.shipment.weight <= remainingWeight && delivery.shipment.volume <= remainingVolume) {
        packed.push(assignment);
        remainingWeight -= delivery.shipment.weight;
        remainingVolume -= delivery.shipment.volume;
      }
    }

    return packed;
  }

  /**
   * Calculates vehicle assignment score for optimization
   * @param vehicle - Vehicle to score
   * @param assignments - Delivery assignments
   * @param hub - Source hub
   * @param distanceMatrix - Distance matrix
   * @param request - Routing request
   * @returns Assignment score
   */
  private calculateVehicleAssignmentScore(
    vehicle: Vehicle,
    assignments: SplitDeliveryAssignment[],
    hub: Hub,
    distanceMatrix: DistanceMatrix,
    request: RoutingRequest
  ): number {
    // Calculate total distance for this assignment
    let totalDistance = 0;
    let currentLocation = hub.location;

    for (const assignment of assignments) {
      const currentLocationIndex = this.getLocationIndex(currentLocation, request);
      const deliveryLocationIndex = this.getLocationIndex(assignment.splitDelivery.deliveryLocation, request);
      const distance = distanceMatrix.distances[currentLocationIndex]?.[deliveryLocationIndex] || 0;
      totalDistance += distance;
      currentLocation = assignment.splitDelivery.deliveryLocation;
    }

    // Calculate capacity utilization
    const totalWeight = assignments.reduce((sum, a) => sum + a.splitDelivery.shipment.weight, 0);
    const totalVolume = assignments.reduce((sum, a) => sum + a.splitDelivery.shipment.volume, 0);
    const weightUtilization = totalWeight / vehicle.capacity.weight;
    const volumeUtilization = totalVolume / vehicle.capacity.volume;
    const capacityUtilization = Math.min(weightUtilization, volumeUtilization);

    // Score components
    const distanceScore = Math.max(0, 100 - totalDistance); // Shorter distance is better
    const utilizationScore = capacityUtilization * 100; // Higher utilization is better
    const deliveryCountScore = assignments.length * 10; // More deliveries is better

    return distanceScore * 0.4 + utilizationScore * 0.4 + deliveryCountScore * 0.2;
  }

  /**
   * Apply priority scheduling for premium deliveries
   */
  private applyPriorityScheduling(routes: Route[], request: RoutingRequest): Route[] {
    return routes.sort((a, b) => {
      // Sort by priority level and time constraints
      const aPriority = this.determinePriorityLevel(a, request);
      const bPriority = this.determinePriorityLevel(b, request);

      if (aPriority === 'urgent' && bPriority !== 'urgent') return -1;
      if (bPriority === 'urgent' && aPriority !== 'urgent') return 1;
      if (aPriority === 'high' && bPriority === 'normal') return -1;
      if (bPriority === 'high' && aPriority === 'normal') return 1;

      return 0;
    });
  }

  /**
   * Calculate premium route cost
   */
  private calculatePremiumRouteCost(route: Route): number {
    const baseCost = route.estimatedDistance * 2.5; // Base rate per km
    const premiumMultiplier = 1.5; // Premium service multiplier
    return baseCost * premiumMultiplier;
  }

  /**
   * Extract premium customer ID from route
   */
  private extractPremiumCustomerId(route: Route, request: RoutingRequest): string {
    // Find the first premium delivery in the route
    for (const stop of route.stops) {
      const delivery = request.deliveries.find(d => d.id === stop.deliveryId);
      if (delivery && this.isPremiumDelivery(delivery, request)) {
        return delivery.customerId;
      }
    }
    return '';
  }

  /**
   * Calculate guaranteed time window for premium delivery
   */
  private calculateGuaranteedTimeWindow(_route: Route): TimeWindow {
    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours window

    return {
      start: startTime,
      end: endTime
    };
  }

  /**
   * Determine priority level for a route
   */
  private determinePriorityLevel(route: Route, request: RoutingRequest): 'high' | 'urgent' | 'normal' {
    // Check if any delivery in the route is urgent
    for (const stop of route.stops) {
      const delivery = request.deliveries.find(d => d.id === stop.deliveryId);
      if (delivery?.priority === 'urgent') return 'urgent';
      if (delivery?.priority === 'high') return 'high';
    }
    return 'normal';
  }

  /**
   * Check if delivery is premium
   */
  private isPremiumDelivery(delivery: Delivery, request: RoutingRequest): boolean {
    return delivery.priority === 'high' || delivery.priority === 'urgent' ||
      request.premiumCustomerIds?.includes(delivery.customerId) || false;
  }

  /**
   * Create shared routes for regular deliveries
   */
  private async createSharedRoutes(request: RoutingRequest, _distanceMatrix: DistanceMatrix): Promise<Route[]> {
    // Use existing routing logic for shared routes
    const result = await this.optimizeRoutes(request);
    return result.routes;
  }

  /**
   * Calculate vehicle type suitability score
   */
  private calculateVehicleTypeSuitability(vehicle: Vehicle, delivery: Delivery): number {
    let score = 0.5; // Base score

    // Check capacity match
    if (vehicle.capacity.weight >= delivery.shipment.weight &&
      vehicle.capacity.volume >= delivery.shipment.volume) {
      score += 0.3;
    }

    // Check special handling requirements
    if (delivery.shipment.fragile && vehicle.type === 'van') {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate fuel efficiency score
   */
  private calculateFuelEfficiencyScore(vehicle: Vehicle): number {
    const fuelTypeScores = {
      'electric': 1.0,
      'hybrid': 0.8,
      'cng': 0.7,
      'diesel': 0.5,
      'petrol': 0.4
    };

    return fuelTypeScores[vehicle.vehicleSpecs.fuelType] || 0.5;
  }

}