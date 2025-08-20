/**
 * Hub model for logistics operations and buffer vehicle management
 */

import { GeoLocation } from './GeoLocation';
import { Vehicle } from './Vehicle';
import { VehicleType } from './Common';

export interface Hub {
  id: string;
  name: string;
  location: GeoLocation;
  capacity: HubCapacity;
  bufferVehicles: Vehicle[];
  operatingHours: OperatingHours;
  facilities: string[];
  hubType: 'primary' | 'secondary' | 'micro';
  status: 'active' | 'inactive' | 'maintenance';
  contactInfo: HubContactInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface HubCapacity {
  maxVehicles: number;
  currentVehicles: number;
  storageArea: number; // in square meters
  loadingBays: number;
  bufferVehicleSlots: number;
}

export interface OperatingHours {
  open: string; // "06:00"
  close: string; // "22:00"
  timezone: string;
  specialHours?: {
    [day: string]: {
      open: string;
      close: string;
    };
  };
}

export interface HubContactInfo {
  managerName: string;
  phone: string;
  email: string;
  emergencyContact: string;
}

export interface LoadingOperation {
  id: string;
  vehicleId: string;
  deliveryIds: string[];
  startTime: Date;
  estimatedEndTime: Date;
  actualEndTime?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  loadingBay: number;
}

export interface TransferOperation {
  id: string;
  fromHubId: string;
  toHubId: string;
  vehicleId: string;
  deliveryIds: string[];
  departureTime: Date;
  estimatedArrivalTime: Date;
  actualArrivalTime?: Date;
  status: 'planned' | 'in-transit' | 'completed' | 'cancelled';
}

export interface BufferAllocationResult {
  success: boolean;
  allocatedVehicle?: Vehicle;
  message: string;
  alternativeOptions?: Vehicle[];
}

export interface HubCapacityStatus {
  vehicleUtilization: number; // percentage
  storageUtilization: number; // percentage
  loadingBayUtilization: number; // percentage
  bufferVehicleAvailability: number; // count
  isAtCapacity: boolean;
  recommendedActions: string[];
}

export interface OperatingHoursValidation {
  isOpen: boolean;
  currentTime: string;
  openTime: string;
  closeTime: string;
  minutesUntilClose?: number | undefined;
  nextOpenTime?: string | undefined;
}

/**
 * Hub class with capacity management and buffer vehicle allocation
 */
export class HubModel implements Hub {
  id: string;
  name: string;
  location: GeoLocation;
  capacity: HubCapacity;
  bufferVehicles: Vehicle[];
  operatingHours: OperatingHours;
  facilities: string[];
  hubType: 'primary' | 'secondary' | 'micro';
  status: 'active' | 'inactive' | 'maintenance';
  contactInfo: HubContactInfo;
  createdAt: Date;
  updatedAt: Date;

  constructor(hubData: Hub) {
    this.id = hubData.id;
    this.name = hubData.name;
    this.location = hubData.location;
    this.capacity = hubData.capacity;
    this.bufferVehicles = hubData.bufferVehicles;
    this.operatingHours = hubData.operatingHours;
    this.facilities = hubData.facilities;
    this.hubType = hubData.hubType;
    this.status = hubData.status;
    this.contactInfo = hubData.contactInfo;
    this.createdAt = hubData.createdAt;
    this.updatedAt = hubData.updatedAt;
  }

  /**
   * Allocates a buffer vehicle for breakdown replacement
   * @param requiredVehicleType - Type of vehicle needed
   * @param minCapacity - Minimum capacity requirements
   * @returns BufferAllocationResult with allocation status
   */
  allocateBufferVehicle(
    requiredVehicleType?: VehicleType,
    minCapacity?: { weight: number; volume: number }
  ): BufferAllocationResult {
    // Check if hub is operational
    if (this.status !== 'active') {
      return {
        success: false,
        message: `Hub ${this.name} is not active (status: ${this.status})`
      };
    }

    // Check if any buffer vehicles are available
    const availableBufferVehicles = this.bufferVehicles.filter(
      vehicle => vehicle.status === 'available'
    );

    if (availableBufferVehicles.length === 0) {
      return {
        success: false,
        message: 'No buffer vehicles available at this hub'
      };
    }

    // Filter by vehicle type if specified
    let candidateVehicles = availableBufferVehicles;
    if (requiredVehicleType) {
      candidateVehicles = availableBufferVehicles.filter(
        vehicle => vehicle.type === requiredVehicleType
      );
    }

    // Filter by capacity if specified
    if (minCapacity) {
      candidateVehicles = candidateVehicles.filter(
        vehicle => vehicle.capacity.weight >= minCapacity.weight && 
                   vehicle.capacity.volume >= minCapacity.volume
      );
    }

    if (candidateVehicles.length === 0) {
      return {
        success: false,
        message: 'No buffer vehicles match the specified requirements',
        alternativeOptions: availableBufferVehicles
      };
    }

    // Select the best matching vehicle (prioritize by capacity and compliance)
    const selectedVehicle = candidateVehicles.reduce((best, current) => {
      // Prefer vehicles with better compliance
      if (current.compliance.pollutionLevel === 'BS6' && best.compliance.pollutionLevel !== 'BS6') {
        return current;
      }
      // Prefer vehicles with higher capacity utilization efficiency
      const currentEfficiency = this.calculateCapacityEfficiency(current, minCapacity);
      const bestEfficiency = this.calculateCapacityEfficiency(best, minCapacity);
      return currentEfficiency > bestEfficiency ? current : best;
    });

    // Mark vehicle as allocated
    selectedVehicle.status = 'in-transit';
    this.updatedAt = new Date();

    return {
      success: true,
      allocatedVehicle: selectedVehicle,
      message: `Buffer vehicle ${selectedVehicle.id} allocated successfully`
    };
  }

  /**
   * Adds a vehicle to the buffer fleet
   * @param vehicle - Vehicle to add to buffer
   * @returns boolean indicating success
   */
  addBufferVehicle(vehicle: Vehicle): boolean {
    // Check if hub has capacity for more buffer vehicles
    if (this.bufferVehicles.length >= this.capacity.bufferVehicleSlots) {
      return false;
    }

    // Check if vehicle is already in buffer
    if (this.bufferVehicles.some(v => v.id === vehicle.id)) {
      return false;
    }

    // Add vehicle to buffer
    this.bufferVehicles.push(vehicle);
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Removes a vehicle from the buffer fleet
   * @param vehicleId - ID of vehicle to remove
   * @returns boolean indicating success
   */
  removeBufferVehicle(vehicleId: string): boolean {
    const initialLength = this.bufferVehicles.length;
    this.bufferVehicles = this.bufferVehicles.filter(v => v.id !== vehicleId);
    
    if (this.bufferVehicles.length < initialLength) {
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Checks current capacity status of the hub
   * @returns HubCapacityStatus with utilization metrics
   */
  getCapacityStatus(): HubCapacityStatus {
    const vehicleUtilization = (this.capacity.currentVehicles / this.capacity.maxVehicles) * 100;
    const storageUtilization = 75; // Placeholder - would be calculated from actual storage usage
    const loadingBayUtilization = 60; // Placeholder - would be calculated from active operations
    const bufferVehicleAvailability = this.bufferVehicles.filter(v => v.status === 'available').length;
    
    const isAtCapacity = vehicleUtilization >= 90 || bufferVehicleAvailability === 0;
    
    const recommendedActions: string[] = [];
    if (vehicleUtilization > 85) {
      recommendedActions.push('Consider redirecting new vehicles to alternative hubs');
    }
    if (bufferVehicleAvailability < 2) {
      recommendedActions.push('Replenish buffer vehicle inventory');
    }
    if (storageUtilization > 80) {
      recommendedActions.push('Expedite outbound shipments to free storage space');
    }

    return {
      vehicleUtilization: Math.round(vehicleUtilization * 100) / 100,
      storageUtilization,
      loadingBayUtilization,
      bufferVehicleAvailability,
      isAtCapacity,
      recommendedActions
    };
  }

  /**
   * Validates if hub is currently operating
   * @param currentTime - Time to check (defaults to current time)
   * @returns OperatingHoursValidation with operational status
   */
  validateOperatingHours(currentTime: Date = new Date()): OperatingHoursValidation {
    const timeString = currentTime.toTimeString().slice(0, 5); // HH:MM format
    const dayOfWeek = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Check for special hours for this day
    let openTime = this.operatingHours.open;
    let closeTime = this.operatingHours.close;
    
    if (this.operatingHours.specialHours && this.operatingHours.specialHours[dayOfWeek]) {
      openTime = this.operatingHours.specialHours[dayOfWeek].open;
      closeTime = this.operatingHours.specialHours[dayOfWeek].close;
    }

    const currentMinutes = this.timeToMinutes(timeString);
    const openMinutes = this.timeToMinutes(openTime);
    const closeMinutes = this.timeToMinutes(closeTime);
    
    let isOpen: boolean;
    let minutesUntilClose: number | undefined;
    let nextOpenTime: string | undefined;

    // Handle overnight operations (e.g., 22:00 to 06:00)
    if (openMinutes > closeMinutes) {
      isOpen = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
      if (isOpen && currentMinutes <= closeMinutes) {
        minutesUntilClose = closeMinutes - currentMinutes;
      } else if (isOpen) {
        minutesUntilClose = (24 * 60) - currentMinutes + closeMinutes;
      } else {
        nextOpenTime = openTime;
      }
    } else {
      isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
      if (isOpen) {
        minutesUntilClose = closeMinutes - currentMinutes;
      } else if (currentMinutes < openMinutes) {
        nextOpenTime = openTime;
      } else {
        // After closing, next open is tomorrow
        nextOpenTime = `${openTime} (next day)`;
      }
    }

    return {
      isOpen,
      currentTime: timeString,
      openTime,
      closeTime,
      minutesUntilClose,
      nextOpenTime
    };
  }

  /**
   * Calculates distance to another hub
   * @param otherHub - Hub to calculate distance to
   * @returns Distance in kilometers
   */
  calculateDistanceToHub(otherHub: Hub): number {
    return this.haversineDistance(
      this.location.latitude,
      this.location.longitude,
      otherHub.location.latitude,
      otherHub.location.longitude
    );
  }

  /**
   * Updates hub status
   * @param newStatus - New hub status
   */
  updateStatus(newStatus: 'active' | 'inactive' | 'maintenance'): void {
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  /**
   * Updates current vehicle count
   * @param count - New vehicle count
   */
  updateCurrentVehicleCount(count: number): void {
    this.capacity.currentVehicles = Math.max(0, Math.min(count, this.capacity.maxVehicles));
    this.updatedAt = new Date();
  }

  /**
   * Calculates capacity efficiency for vehicle selection
   * @param vehicle - Vehicle to evaluate
   * @param requiredCapacity - Required capacity
   * @returns Efficiency score (0-1)
   */
  private calculateCapacityEfficiency(
    vehicle: Vehicle, 
    requiredCapacity?: { weight: number; volume: number }
  ): number {
    if (!requiredCapacity) return 0.5; // Neutral score if no requirements
    
    const weightEfficiency = requiredCapacity.weight / vehicle.capacity.weight;
    const volumeEfficiency = requiredCapacity.volume / vehicle.capacity.volume;
    
    // Prefer vehicles that are well-utilized but not over-capacity
    return Math.min(weightEfficiency, volumeEfficiency);
  }

  /**
   * Converts time string to minutes since midnight
   * @param time - Time in HH:MM format
   * @returns Minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const timeParts = time.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    return hours * 60 + minutes;
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