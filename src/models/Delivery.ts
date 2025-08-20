/**
 * Delivery model with shipment details and requirements
 */

import { Priority, TimeWindow, VehicleType } from './Common';
import { GeoLocation } from './GeoLocation';

export interface Delivery {
  id: string;
  customerId: string;
  pickupLocation: GeoLocation;
  deliveryLocation: GeoLocation;
  timeWindow: TimeWindow;
  shipment: ShipmentDetails;
  priority: Priority;
  serviceType: 'shared' | 'dedicated_premium';
  specialRequirements?: string[] | undefined;
  estimatedDuration?: number | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentDetails {
  weight: number;
  volume: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  fragile: boolean;
  hazardous: boolean;
  temperatureControlled: boolean;
  specialHandling: string[];
  value?: number;
  description?: string;
}

export interface DeliveryRequirements {
  vehicleTypePreference?: string[];
  accessRequirements?: string[];
  handlingInstructions?: string[];
  deliveryInstructions?: string[];
  contactPerson?: ContactInfo;
}

export interface ContactInfo {
  name: string;
  phone: string;
  email?: string;
  alternatePhone?: string;
}

export interface DeliveryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestedVehicleTypes: VehicleType[];
}

export interface DistanceCalculationResult {
  distanceKm: number;
  estimatedDurationMinutes: number;
  routeComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Delivery class with validation and utility methods
 */
export class DeliveryModel implements Delivery {
  id: string;
  customerId: string;
  pickupLocation: GeoLocation;
  deliveryLocation: GeoLocation;
  timeWindow: TimeWindow;
  shipment: ShipmentDetails;
  priority: Priority;
  serviceType: 'shared' | 'dedicated_premium';
  specialRequirements?: string[] | undefined;
  estimatedDuration?: number | undefined;
  createdAt: Date;
  updatedAt: Date;

  constructor(deliveryData: Delivery) {
    this.id = deliveryData.id;
    this.customerId = deliveryData.customerId;
    this.pickupLocation = deliveryData.pickupLocation;
    this.deliveryLocation = deliveryData.deliveryLocation;
    this.timeWindow = deliveryData.timeWindow;
    this.shipment = deliveryData.shipment;
    this.priority = deliveryData.priority;
    this.serviceType = deliveryData.serviceType;
    this.specialRequirements = deliveryData.specialRequirements;
    this.estimatedDuration = deliveryData.estimatedDuration;
    this.createdAt = deliveryData.createdAt;
    this.updatedAt = deliveryData.updatedAt;
  }

  /**
   * Validates delivery data and requirements
   * @returns DeliveryValidationResult with validation status and suggestions
   */
  validateDelivery(): DeliveryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestedVehicleTypes: VehicleType[] = [];

    // Validate basic requirements
    if (!this.pickupLocation.latitude || !this.pickupLocation.longitude) {
      errors.push('Invalid pickup location coordinates');
    }

    if (!this.deliveryLocation.latitude || !this.deliveryLocation.longitude) {
      errors.push('Invalid delivery location coordinates');
    }

    if (this.timeWindow.earliest >= this.timeWindow.latest) {
      errors.push('Invalid time window: earliest time must be before latest time');
    }

    if (this.timeWindow.earliest < new Date()) {
      errors.push('Time window cannot be in the past');
    }

    // Validate shipment details
    if (this.shipment.weight <= 0) {
      errors.push('Shipment weight must be positive');
    }

    if (this.shipment.volume <= 0) {
      errors.push('Shipment volume must be positive');
    }

    // Suggest vehicle types based on shipment characteristics
    if (this.shipment.weight > 3000) {
      suggestedVehicleTypes.push('truck');
    } else if (this.shipment.weight > 1000) {
      suggestedVehicleTypes.push('tempo', 'van');
    } else {
      suggestedVehicleTypes.push('van', 'three-wheeler');
    }

    // Special handling warnings
    if (this.shipment.fragile) {
      warnings.push('Fragile shipment requires careful handling');
      suggestedVehicleTypes.push('van'); // Prefer vans for fragile items
    }

    if (this.shipment.hazardous) {
      warnings.push('Hazardous material requires certified vehicle and driver');
      suggestedVehicleTypes.length = 0; // Clear suggestions
      suggestedVehicleTypes.push('truck'); // Only trucks for hazardous materials
    }

    if (this.shipment.temperatureControlled) {
      warnings.push('Temperature-controlled shipment requires refrigerated vehicle');
    }

    // Time window warnings
    const timeWindowHours = (this.timeWindow.latest.getTime() - this.timeWindow.earliest.getTime()) / (1000 * 60 * 60);
    if (timeWindowHours < 2) {
      warnings.push('Narrow time window may limit vehicle availability');
    }

    // Premium service validation
    if (this.serviceType === 'dedicated_premium' && this.shipment.weight < 100) {
      warnings.push('Premium service may not be cost-effective for small shipments');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestedVehicleTypes: [...new Set(suggestedVehicleTypes)] // Remove duplicates
    };
  }

  /**
   * Calculates estimated distance and duration between pickup and delivery
   * @returns DistanceCalculationResult with distance and time estimates
   */
  calculateDistance(): DistanceCalculationResult {
    const distance = this.haversineDistance(
      this.pickupLocation.latitude,
      this.pickupLocation.longitude,
      this.deliveryLocation.latitude,
      this.deliveryLocation.longitude
    );

    // Estimate duration based on distance and Delhi traffic conditions
    let estimatedDurationMinutes: number;
    let routeComplexity: 'simple' | 'moderate' | 'complex';

    if (distance <= 5) {
      estimatedDurationMinutes = distance * 8; // 8 minutes per km for short distances
      routeComplexity = 'simple';
    } else if (distance <= 20) {
      estimatedDurationMinutes = distance * 6; // 6 minutes per km for medium distances
      routeComplexity = 'moderate';
    } else {
      estimatedDurationMinutes = distance * 4; // 4 minutes per km for long distances
      routeComplexity = 'complex';
    }

    // Add buffer for loading/unloading
    estimatedDurationMinutes += 20;

    // Adjust for special handling requirements
    if (this.shipment.fragile || this.shipment.temperatureControlled) {
      estimatedDurationMinutes += 10;
    }

    if (this.shipment.hazardous) {
      estimatedDurationMinutes += 15;
    }

    return {
      distanceKm: Math.round(distance * 100) / 100, // Round to 2 decimal places
      estimatedDurationMinutes: Math.round(estimatedDurationMinutes),
      routeComplexity
    };
  }

  /**
   * Checks if delivery is compatible with vehicle capacity
   * @param vehicleCapacity - Vehicle capacity constraints
   * @returns boolean indicating compatibility
   */
  isCompatibleWithVehicle(vehicleCapacity: { weight: number; volume: number }): boolean {
    return this.shipment.weight <= vehicleCapacity.weight && 
           this.shipment.volume <= vehicleCapacity.volume;
  }

  /**
   * Checks if delivery falls within specified time window
   * @param proposedTime - Proposed delivery time
   * @returns boolean indicating if time is within window
   */
  isWithinTimeWindow(proposedTime: Date): boolean {
    return proposedTime >= this.timeWindow.earliest && proposedTime <= this.timeWindow.latest;
  }

  /**
   * Updates delivery priority
   * @param newPriority - New priority level
   */
  updatePriority(newPriority: Priority): void {
    this.priority = newPriority;
    this.updatedAt = new Date();
  }

  /**
   * Updates estimated duration
   * @param durationMinutes - New estimated duration in minutes
   */
  updateEstimatedDuration(durationMinutes: number): void {
    this.estimatedDuration = durationMinutes;
    this.updatedAt = new Date();
  }

  /**
   * Adds special requirement to delivery
   * @param requirement - Special requirement to add
   */
  addSpecialRequirement(requirement: string): void {
    if (!this.specialRequirements) {
      this.specialRequirements = [];
    }
    if (!this.specialRequirements.includes(requirement)) {
      this.specialRequirements.push(requirement);
      this.updatedAt = new Date();
    }
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