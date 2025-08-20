/**
 * Route model with optimization results and tracking
 */

import { RouteStatus, ZoneType } from './Common';
import { GeoLocation } from './GeoLocation';

export interface Route {
  id: string;
  vehicleId: string;
  driverId?: string;
  stops: RouteStop[];
  estimatedDuration: number; // in minutes
  estimatedDistance: number; // in kilometers
  estimatedFuelConsumption: number; // in liters
  actualDuration?: number | undefined;
  actualDistance?: number | undefined;
  actualFuelConsumption?: number | undefined;
  trafficFactors: TrafficFactor[];
  status: RouteStatus;
  optimizationMetadata?: OptimizationMetadata;
  complianceValidation?: RouteComplianceValidation;
  createdAt?: Date;
  updatedAt?: Date;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  // Hub-and-spoke specific properties
  hubId?: string;
  deliveryIds?: string[];
  routeType?: 'hub_to_delivery' | 'hub_transfer' | 'direct' | 'premium_dedicated';
}

export interface RouteStop {
  address?: string;
  id: string;
  sequence: number;
  location: GeoLocation;
  type: 'pickup' | 'delivery' | 'hub' | 'waypoint';
  deliveryId?: string;
  hubId?: string;
  delivery?: { shipment: { weight: number; volume: number } }; // For business metrics calculation
  estimatedArrivalTime: Date;
  estimatedDepartureTime: Date;
  actualArrivalTime?: Date;
  actualDepartureTime?: Date;
  duration: number; // time spent at stop in minutes
  instructions?: string[];
  status: 'pending' | 'arrived' | 'in-progress' | 'completed' | 'skipped';
}

export interface TrafficFactor {
  segmentId: string;
  fromLocation: GeoLocation;
  toLocation: GeoLocation;
  trafficLevel: 'light' | 'moderate' | 'heavy' | 'severe';
  delayMinutes: number;
  alternativeAvailable: boolean;
  timestamp: Date;
}

export interface OptimizationMetadata {
  algorithmUsed: string;
  optimizationTime: number; // in milliseconds
  iterations: number;
  objectiveValue: number;
  constraintsApplied: string[];
  fallbackUsed: boolean;
  version: string;
}

export interface RouteComplianceValidation {
  isCompliant: boolean;
  validatedAt: Date;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
  exemptions: ComplianceExemption[];
}

export interface ComplianceViolation {
  type: 'time_restriction' | 'zone_restriction' | 'pollution_violation' | 'odd_even_violation' | 'weight_limit_violation';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  penalty?: number;
  location: GeoLocation;
  timestamp: Date;
  routeStopId?: string;
}

export interface ComplianceWarning {
  type: string;
  description: string;
  recommendation: string;
  location: GeoLocation;
  timestamp: Date;
}

export interface ComplianceExemption {
  type: string;
  reason: string;
  validUntil: Date;
  authorizedBy: string;
}

export interface RouteEfficiencyMetrics {
  totalDistance: number;
  totalDuration: number;
  fuelEfficiency: number; // km per liter
  averageSpeed: number; // km/h
  stopEfficiency: number; // percentage of time spent driving vs stopped
  complianceScore: number; // percentage of compliant segments
}

export interface RouteOptimizationSuggestion {
  type: 'reorder_stops' | 'alternative_route' | 'time_adjustment' | 'vehicle_change';
  description: string;
  estimatedImprovement: {
    timeSavingMinutes: number;
    distanceSavingKm: number;
    fuelSavingLiters: number;
  };
  implementationComplexity: 'low' | 'medium' | 'high';
}

/**
 * Route class with tracking, compliance validation, and optimization methods
 */
export class RouteModel implements Route {
  id: string;
  vehicleId: string;
  driverId?: string;
  stops: RouteStop[];
  estimatedDuration: number;
  estimatedDistance: number;
  estimatedFuelConsumption: number;
  actualDuration?: number | undefined;
  actualDistance?: number | undefined;
  actualFuelConsumption?: number | undefined;
  trafficFactors: TrafficFactor[];
  status: RouteStatus;
  optimizationMetadata?: OptimizationMetadata;
  complianceValidation?: RouteComplianceValidation;
  createdAt?: Date;
  updatedAt?: Date;
  startedAt?: Date | undefined;
  completedAt?: Date | undefined;
  // Hub-and-spoke specific properties
  hubId?: string;
  deliveryIds?: string[];
  routeType?: 'hub_to_delivery' | 'hub_transfer' | 'direct' | 'premium_dedicated';

  constructor(routeData: Route) {
    this.id = routeData.id;
    this.vehicleId = routeData.vehicleId;
    this.driverId = routeData.driverId;
    this.stops = routeData.stops;
    this.estimatedDuration = routeData.estimatedDuration;
    this.estimatedDistance = routeData.estimatedDistance;
    this.estimatedFuelConsumption = routeData.estimatedFuelConsumption;
    this.actualDuration = routeData.actualDuration;
    this.actualDistance = routeData.actualDistance;
    this.actualFuelConsumption = routeData.actualFuelConsumption;
    this.trafficFactors = routeData.trafficFactors || [];
    this.status = routeData.status;
    this.optimizationMetadata = routeData.optimizationMetadata;
    this.complianceValidation = routeData.complianceValidation;
    this.createdAt = routeData.createdAt || new Date();
    this.updatedAt = routeData.updatedAt || new Date();
    this.startedAt = routeData.startedAt;
    this.completedAt = routeData.completedAt;
    // Hub-and-spoke specific properties
    this.hubId = routeData.hubId;
    this.deliveryIds = routeData.deliveryIds;
    this.routeType = routeData.routeType;
  }

  /**
   * Starts route execution
   */
  startRoute(): void {
    if (this.status === 'planned') {
      this.status = 'active';
      this.startedAt = new Date();
      this.updatedAt = new Date();
    }
  }

  /**
   * Completes route execution
   */
  completeRoute(): void {
    if (this.status === 'active') {
      this.status = 'completed';
      this.completedAt = new Date();
      this.updatedAt = new Date();
      
      // Calculate actual duration if not set
      if (this.startedAt && !this.actualDuration) {
        this.actualDuration = Math.round((this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60));
      }
    }
  }

  /**
   * Cancels route execution
   */
  cancelRoute(): void {
    if (this.status === 'planned' || this.status === 'active') {
      this.status = 'cancelled';
      this.updatedAt = new Date();
    }
  }

  /**
   * Updates stop status and timestamps
   * @param stopId - ID of the stop to update
   * @param newStatus - New status for the stop
   * @param timestamp - Timestamp for the status change
   */
  updateStopStatus(stopId: string, newStatus: RouteStop['status'], timestamp: Date = new Date()): boolean {
    const stop = this.stops.find(s => s.id === stopId);
    if (!stop) return false;

    stop.status = newStatus;
    
    // Update timestamps based on status
    switch (newStatus) {
      case 'arrived':
        stop.actualArrivalTime = timestamp;
        break;
      case 'completed':
        if (!stop.actualDepartureTime) {
          stop.actualDepartureTime = timestamp;
        }
        break;
    }

    this.updatedAt = new Date();
    return true;
  }

  /**
   * Adds traffic factor affecting the route
   * @param trafficFactor - Traffic information to add
   */
  addTrafficFactor(trafficFactor: TrafficFactor): void {
    // Remove existing traffic factor for the same segment if it exists
    this.trafficFactors = this.trafficFactors.filter(tf => tf.segmentId !== trafficFactor.segmentId);
    this.trafficFactors.push(trafficFactor);
    this.updatedAt = new Date();
  }

  /**
   * Calculates route efficiency metrics
   * @returns RouteEfficiencyMetrics with performance indicators
   */
  calculateEfficiencyMetrics(): RouteEfficiencyMetrics {
    const totalDistance = this.actualDistance || this.estimatedDistance;
    const totalDuration = this.actualDuration || this.estimatedDuration;
    const fuelConsumption = this.actualFuelConsumption || this.estimatedFuelConsumption;
    
    const fuelEfficiency = fuelConsumption > 0 ? totalDistance / fuelConsumption : 0;
    const averageSpeed = totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0; // Convert to km/h
    
    // Calculate stop efficiency (time driving vs time at stops)
    const totalStopTime = this.stops.reduce((total, stop) => total + stop.duration, 0);
    const drivingTime = totalDuration - totalStopTime;
    const stopEfficiency = totalDuration > 0 ? (drivingTime / totalDuration) * 100 : 0;
    
    // Calculate compliance score
    const totalViolations = this.complianceValidation.violations.length;
    const totalStops = this.stops.length;
    const complianceScore = totalStops > 0 ? ((totalStops - totalViolations) / totalStops) * 100 : 100;

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration: Math.round(totalDuration),
      fuelEfficiency: Math.round(fuelEfficiency * 100) / 100,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      stopEfficiency: Math.round(stopEfficiency * 100) / 100,
      complianceScore: Math.round(complianceScore * 100) / 100
    };
  }

  /**
   * Generates optimization suggestions for the route
   * @returns Array of RouteOptimizationSuggestion
   */
  generateOptimizationSuggestions(): RouteOptimizationSuggestion[] {
    const suggestions: RouteOptimizationSuggestion[] = [];

    // Check for stop reordering opportunities
    if (this.stops.length > 3) {
      const potentialSavings = this.estimateReorderingSavings();
      if (potentialSavings.timeSavingMinutes > 10) {
        suggestions.push({
          type: 'reorder_stops',
          description: 'Reorder stops to minimize travel distance and time',
          estimatedImprovement: potentialSavings,
          implementationComplexity: 'medium'
        });
      }
    }

    // Check for traffic-based route alternatives
    const heavyTrafficSegments = this.trafficFactors.filter(tf => 
      tf.trafficLevel === 'heavy' || tf.trafficLevel === 'severe'
    );
    if (heavyTrafficSegments.length > 0) {
      suggestions.push({
        type: 'alternative_route',
        description: 'Use alternative routes to avoid heavy traffic',
        estimatedImprovement: {
          timeSavingMinutes: heavyTrafficSegments.reduce((total, tf) => total + tf.delayMinutes, 0) * 0.6,
          distanceSavingKm: 0,
          fuelSavingLiters: 0.5
        },
        implementationComplexity: 'low'
      });
    }

    // Check for time window adjustments
    const criticalViolations = this.complianceValidation.violations.filter(v => 
      v.severity === 'high' || v.severity === 'critical'
    );
    if (criticalViolations.length > 0) {
      suggestions.push({
        type: 'time_adjustment',
        description: 'Adjust departure time to avoid compliance violations',
        estimatedImprovement: {
          timeSavingMinutes: 0,
          distanceSavingKm: 0,
          fuelSavingLiters: 0
        },
        implementationComplexity: 'low'
      });
    }

    return suggestions;
  }

  /**
   * Validates route compliance against Delhi regulations
   * @param zoneTypes - Zone types for each stop
   * @returns Updated compliance validation
   */
  validateRouteCompliance(zoneTypes: ZoneType[]): RouteComplianceValidation {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    const exemptions: ComplianceExemption[] = [];

    // Validate each stop for compliance
    this.stops.forEach((stop, index) => {
      const zoneType = zoneTypes[index] || 'mixed';
      const arrivalTime = stop.estimatedArrivalTime;
      
      // Check time restrictions (example: trucks in residential areas)
      if (zoneType === 'residential') {
        const hour = arrivalTime.getHours();
        if (hour >= 23 || hour < 7) {
          violations.push({
            type: 'time_restriction',
            description: 'Vehicle arrival during restricted hours in residential zone',
            severity: 'high',
            penalty: 5000,
            location: stop.location,
            timestamp: arrivalTime,
            routeStopId: stop.id
          });
        }
      }

      // Check for potential delays due to traffic
      const trafficAtStop = this.trafficFactors.find(tf => 
        this.isLocationNear(tf.fromLocation, stop.location, 1) // Within 1km
      );
      
      if (trafficAtStop && trafficAtStop.trafficLevel === 'severe') {
        warnings.push({
          type: 'traffic_delay',
          description: 'Severe traffic expected at this location',
          recommendation: 'Consider alternative route or timing',
          location: stop.location,
          timestamp: arrivalTime
        });
      }
    });

    const updatedValidation: RouteComplianceValidation = {
      isCompliant: violations.length === 0,
      validatedAt: new Date(),
      violations,
      warnings,
      exemptions
    };

    this.complianceValidation = updatedValidation;
    this.updatedAt = new Date();
    
    return updatedValidation;
  }

  /**
   * Gets the next pending stop in the route
   * @returns Next RouteStop or undefined if none pending
   */
  getNextStop(): RouteStop | undefined {
    return this.stops.find(stop => stop.status === 'pending');
  }

  /**
   * Gets all completed stops
   * @returns Array of completed RouteStop
   */
  getCompletedStops(): RouteStop[] {
    return this.stops.filter(stop => stop.status === 'completed');
  }

  /**
   * Calculates total delay from traffic factors
   * @returns Total delay in minutes
   */
  getTotalTrafficDelay(): number {
    return this.trafficFactors.reduce((total, tf) => total + tf.delayMinutes, 0);
  }

  /**
   * Estimates potential savings from reordering stops
   * @returns Estimated improvement metrics
   */
  private estimateReorderingSavings(): { timeSavingMinutes: number; distanceSavingKm: number; fuelSavingLiters: number } {
    // Simplified estimation - in practice would use more sophisticated algorithms
    const currentDistance = this.estimatedDistance;
    const potentialSavings = currentDistance * 0.15; // Assume 15% potential savings
    
    return {
      timeSavingMinutes: Math.round(potentialSavings * 3), // 3 minutes per km saved
      distanceSavingKm: Math.round(potentialSavings * 100) / 100,
      fuelSavingLiters: Math.round(potentialSavings * 0.1 * 100) / 100 // 0.1L per km
    };
  }

  /**
   * Checks if two locations are within specified distance
   * @param loc1 - First location
   * @param loc2 - Second location
   * @param radiusKm - Radius in kilometers
   * @returns Boolean indicating proximity
   */
  private isLocationNear(loc1: GeoLocation, loc2: GeoLocation, radiusKm: number): boolean {
    const distance = this.haversineDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
    return distance <= radiusKm;
  }

  /**
   * Calculates Haversine distance between two points
   * @param lat1 - Latitude of first point
   * @param lon1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lon2 - Longitude of second point
   * @returns Distance in kilometers
   */
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

  /**
   * Converts degrees to radians
   * @param degrees - Angle in degrees
   * @returns Angle in radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}