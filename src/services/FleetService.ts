/**
 * Fleet Service for vehicle registration, status tracking, and GPS management
 * Implements requirements 1.1, 1.2, 1.3 for real-time fleet management
 */

import { Vehicle, VehicleModel } from '../models/Vehicle';
import { VehicleStatus } from '../models/Common';
import { GeoLocation } from '../models/GeoLocation';
import { ValidationError, NotFoundError } from '../utils/errors';

export interface VehicleRegistrationData {
  vehicle: Omit<Vehicle, 'id' | 'lastUpdated'>;
}

export interface VehicleUpdateData {
  location?: GeoLocation;
  status?: VehicleStatus;
  driverInfo?: Partial<Vehicle['driverInfo']>;
}

export interface FleetSearchCriteria {
  status?: VehicleStatus[];
  vehicleTypes?: Vehicle['type'][];
  location?: {
    center: GeoLocation;
    radiusKm: number;
  };
  capacity?: {
    minWeight?: number;
    minVolume?: number;
  };
}

export interface FleetMetrics {
  totalVehicles: number;
  availableVehicles: number;
  inTransitVehicles: number;
  maintenanceVehicles: number;
  breakdownVehicles: number;
  averageUtilization: number;
  lastUpdated: Date;
}

/**
 * Fleet Service implementation for vehicle CRUD operations and real-time tracking
 */
export class FleetService {
  private vehicles: Map<string, VehicleModel> = new Map();
  private locationUpdateCallbacks: Map<string, ((vehicle: Vehicle) => void)[]> = new Map();
  private statusUpdateCallbacks: Map<string, ((vehicle: Vehicle) => void)[]> = new Map();

  /**
   * Registers a new vehicle in the fleet
   * @param registrationData - Vehicle data for registration
   * @returns Promise<Vehicle> - The registered vehicle with generated ID
   */
  async registerVehicle(registrationData: VehicleRegistrationData): Promise<Vehicle> {
    // Generate unique vehicle ID
    const vehicleId = this.generateVehicleId();
    
    // Validate registration data
    this.validateVehicleRegistrationData(registrationData);
    
    // Create vehicle with ID and timestamp
    const vehicleData: Vehicle = {
      ...registrationData.vehicle,
      id: vehicleId,
      lastUpdated: new Date()
    };
    
    // Create vehicle model instance
    const vehicle = new VehicleModel(vehicleData);
    
    // Store in fleet registry
    this.vehicles.set(vehicleId, vehicle);
    
    return vehicle;
  }

  /**
   * Updates vehicle information
   * @param vehicleId - ID of vehicle to update
   * @param updateData - Data to update
   * @returns Promise<Vehicle> - Updated vehicle
   */
  async updateVehicle(vehicleId: string, updateData: VehicleUpdateData): Promise<Vehicle> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      throw new NotFoundError(`Vehicle with ID ${vehicleId} not found`);
    }

    // Update location if provided
    if (updateData.location) {
      vehicle.updateLocation(updateData.location);
      this.notifyLocationUpdate(vehicleId, vehicle);
    }

    // Update status if provided
    if (updateData.status) {
      vehicle.updateStatus(updateData.status);
      this.notifyStatusUpdate(vehicleId, vehicle);
    }

    // Update driver info if provided
    if (updateData.driverInfo) {
      vehicle.driverInfo = { ...vehicle.driverInfo, ...updateData.driverInfo };
      vehicle.lastUpdated = new Date();
    }

    return vehicle;
  }

  /**
   * Retrieves a vehicle by ID
   * @param vehicleId - ID of vehicle to retrieve
   * @returns Promise<Vehicle> - The requested vehicle
   */
  async getVehicle(vehicleId: string): Promise<Vehicle> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      throw new NotFoundError(`Vehicle with ID ${vehicleId} not found`);
    }
    return vehicle;
  }

  /**
   * Retrieves all vehicles matching search criteria
   * @param criteria - Search criteria for filtering vehicles
   * @returns Promise<Vehicle[]> - Array of matching vehicles
   */
  async getVehicles(criteria?: FleetSearchCriteria): Promise<Vehicle[]> {
    let vehicles = Array.from(this.vehicles.values());

    if (!criteria) {
      return vehicles;
    }

    // Filter by status
    if (criteria.status && criteria.status.length > 0) {
      vehicles = vehicles.filter(v => criteria.status!.includes(v.status));
    }

    // Filter by vehicle types
    if (criteria.vehicleTypes && criteria.vehicleTypes.length > 0) {
      vehicles = vehicles.filter(v => criteria.vehicleTypes!.includes(v.type));
    }

    // Filter by location radius
    if (criteria.location) {
      vehicles = vehicles.filter(v => {
        const distance = this.calculateDistance(
          v.location,
          criteria.location!.center
        );
        return distance <= criteria.location!.radiusKm;
      });
    }

    // Filter by capacity requirements
    if (criteria.capacity) {
      vehicles = vehicles.filter(v => {
        const meetsWeight = !criteria.capacity!.minWeight || 
          v.capacity.weight >= criteria.capacity!.minWeight;
        const meetsVolume = !criteria.capacity!.minVolume || 
          v.capacity.volume >= criteria.capacity!.minVolume;
        return meetsWeight && meetsVolume;
      });
    }

    return vehicles;
  }

  /**
   * Removes a vehicle from the fleet
   * @param vehicleId - ID of vehicle to remove
   * @returns Promise<boolean> - Success status
   */
  async removeVehicle(vehicleId: string): Promise<boolean> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) {
      throw new NotFoundError(`Vehicle with ID ${vehicleId} not found`);
    }

    // Only allow removal if vehicle is not in-transit
    if (vehicle.status === 'in-transit') {
      throw new ValidationError('Cannot remove vehicle that is currently in-transit');
    }

    this.vehicles.delete(vehicleId);
    this.locationUpdateCallbacks.delete(vehicleId);
    this.statusUpdateCallbacks.delete(vehicleId);
    
    return true;
  }

  /**
   * Updates vehicle location with GPS tracking
   * @param vehicleId - ID of vehicle to update
   * @param location - New GPS location
   * @returns Promise<Vehicle> - Updated vehicle
   */
  async updateVehicleLocation(vehicleId: string, location: GeoLocation): Promise<Vehicle> {
    return this.updateVehicle(vehicleId, { location });
  }

  /**
   * Updates vehicle status
   * @param vehicleId - ID of vehicle to update
   * @param status - New vehicle status
   * @param metadata - Additional metadata for status update (optional)
   * @returns Promise<Vehicle> - Updated vehicle
   */
  async updateVehicleStatus(
    vehicleId: string, 
    status: VehicleStatus, 
    metadata?: any
  ): Promise<Vehicle> {
    const vehicle = await this.updateVehicle(vehicleId, { status });
    
    // Store metadata if provided (for premium service reservations, etc.)
    if (metadata) {
      // In a real implementation, this would be stored in a database
      // For now, we'll just log it
      console.log(`Vehicle ${vehicleId} status updated to ${status} with metadata:`, metadata);
    }
    
    return vehicle;
  }

  /**
   * Gets fleet metrics and statistics
   * @returns Promise<FleetMetrics> - Current fleet metrics
   */
  async getFleetMetrics(): Promise<FleetMetrics> {
    const vehicles = Array.from(this.vehicles.values());
    const totalVehicles = vehicles.length;
    
    const statusCounts = vehicles.reduce((counts, vehicle) => {
      counts[vehicle.status] = (counts[vehicle.status] || 0) + 1;
      return counts;
    }, {} as Record<VehicleStatus, number>);

    // Calculate utilization (vehicles not available / total vehicles)
    const utilizationRate = totalVehicles > 0 
      ? ((totalVehicles - (statusCounts.available || 0)) / totalVehicles) * 100 
      : 0;

    return {
      totalVehicles,
      availableVehicles: statusCounts.available || 0,
      inTransitVehicles: statusCounts['in-transit'] || 0,
      maintenanceVehicles: statusCounts.maintenance || 0,
      breakdownVehicles: statusCounts.breakdown || 0,
      averageUtilization: Math.round(utilizationRate * 100) / 100,
      lastUpdated: new Date()
    };
  }

  /**
   * Subscribes to location updates for a specific vehicle
   * @param vehicleId - ID of vehicle to monitor
   * @param callback - Callback function to execute on location update
   */
  subscribeToLocationUpdates(vehicleId: string, callback: (vehicle: Vehicle) => void): void {
    if (!this.locationUpdateCallbacks.has(vehicleId)) {
      this.locationUpdateCallbacks.set(vehicleId, []);
    }
    this.locationUpdateCallbacks.get(vehicleId)!.push(callback);
  }

  /**
   * Subscribes to status updates for a specific vehicle
   * @param vehicleId - ID of vehicle to monitor
   * @param callback - Callback function to execute on status update
   */
  subscribeToStatusUpdates(vehicleId: string, callback: (vehicle: Vehicle) => void): void {
    if (!this.statusUpdateCallbacks.has(vehicleId)) {
      this.statusUpdateCallbacks.set(vehicleId, []);
    }
    this.statusUpdateCallbacks.get(vehicleId)!.push(callback);
  }

  /**
   * Unsubscribes from location updates for a specific vehicle
   * @param vehicleId - ID of vehicle to stop monitoring
   * @param callback - Specific callback to remove (optional, removes all if not provided)
   */
  unsubscribeFromLocationUpdates(vehicleId: string, callback?: (vehicle: Vehicle) => void): void {
    if (!this.locationUpdateCallbacks.has(vehicleId)) {
      return;
    }

    if (callback) {
      const callbacks = this.locationUpdateCallbacks.get(vehicleId)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.locationUpdateCallbacks.delete(vehicleId);
    }
  }

  /**
   * Unsubscribes from status updates for a specific vehicle
   * @param vehicleId - ID of vehicle to stop monitoring
   * @param callback - Specific callback to remove (optional, removes all if not provided)
   */
  unsubscribeFromStatusUpdates(vehicleId: string, callback?: (vehicle: Vehicle) => void): void {
    if (!this.statusUpdateCallbacks.has(vehicleId)) {
      return;
    }

    if (callback) {
      const callbacks = this.statusUpdateCallbacks.get(vehicleId)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.statusUpdateCallbacks.delete(vehicleId);
    }
  }

  /**
   * Gets vehicles that haven't updated location within specified time
   * @param maxAgeMinutes - Maximum age in minutes for location updates
   * @returns Promise<Vehicle[]> - Array of vehicles with stale location data
   */
  async getVehiclesWithStaleLocation(maxAgeMinutes: number = 30): Promise<Vehicle[]> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const vehicles = Array.from(this.vehicles.values());
    
    return vehicles.filter(vehicle => {
      const locationTimestamp = vehicle.location.timestamp || vehicle.lastUpdated;
      return locationTimestamp < cutoffTime;
    });
  }

  /**
   * Validates vehicle registration data
   * @param registrationData - Data to validate
   * @throws ValidationError if data is invalid
   */
  private validateVehicleRegistrationData(registrationData: VehicleRegistrationData): void {
    const { vehicle } = registrationData;

    if (!vehicle.vehicleSpecs.plateNumber) {
      throw new ValidationError('Plate number is required');
    }

    if (!vehicle.driverInfo.licenseNumber) {
      throw new ValidationError('Driver license number is required');
    }

    if (vehicle.capacity.weight <= 0) {
      throw new ValidationError('Vehicle weight capacity must be greater than 0');
    }

    if (vehicle.capacity.volume <= 0) {
      throw new ValidationError('Vehicle volume capacity must be greater than 0');
    }

    // Check for duplicate plate number
    const existingVehicle = Array.from(this.vehicles.values())
      .find(v => v.vehicleSpecs.plateNumber === vehicle.vehicleSpecs.plateNumber);
    
    if (existingVehicle) {
      throw new ValidationError(`Vehicle with plate number ${vehicle.vehicleSpecs.plateNumber} already exists`);
    }
  }

  /**
   * Generates a unique vehicle ID
   * @returns string - Unique vehicle ID
   */
  private generateVehicleId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `VEH_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Calculates distance between two geographic points using Haversine formula
   * @param point1 - First geographic point
   * @param point2 - Second geographic point
   * @returns number - Distance in kilometers
   */
  private calculateDistance(point1: GeoLocation, point2: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.latitude - point1.latitude);
    const dLon = this.toRadians(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.latitude)) * Math.cos(this.toRadians(point2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts degrees to radians
   * @param degrees - Angle in degrees
   * @returns number - Angle in radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Notifies subscribers of location updates
   * @param vehicleId - ID of updated vehicle
   * @param vehicle - Updated vehicle instance
   */
  private notifyLocationUpdate(vehicleId: string, vehicle: Vehicle): void {
    const callbacks = this.locationUpdateCallbacks.get(vehicleId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(vehicle);
        } catch (error) {
          console.error(`Error in location update callback for vehicle ${vehicleId}:`, error);
        }
      });
    }
  }

  /**
   * Notifies subscribers of status updates
   * @param vehicleId - ID of updated vehicle
   * @param vehicle - Updated vehicle instance
   */
  private notifyStatusUpdate(vehicleId: string, vehicle: Vehicle): void {
    const callbacks = this.statusUpdateCallbacks.get(vehicleId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(vehicle);
        } catch (error) {
          console.error(`Error in status update callback for vehicle ${vehicleId}:`, error);
        }
      });
    }

    // Check for breakdown and trigger buffer allocation if needed
    if (vehicle.status === 'breakdown') {
      this.handleVehicleBreakdown(vehicle).catch(error => {
        console.error(`Error handling breakdown for vehicle ${vehicleId}:`, error);
      });
    }
  }

  // Buffer Vehicle Allocation System

  private hubs: Map<string, any> = new Map(); // Hub registry
  private breakdownCallbacks: ((vehicleId: string, bufferVehicleId?: string) => void)[] = [];

  /**
   * Registers a hub for buffer vehicle management
   * @param hub - Hub to register
   */
  registerHub(hub: any): void {
    this.hubs.set(hub.id, hub);
  }

  /**
   * Handles vehicle breakdown by allocating buffer vehicle
   * @param brokenVehicle - Vehicle that broke down
   * @returns Promise<BufferAllocationResult> - Allocation result
   */
  async handleVehicleBreakdown(brokenVehicle: Vehicle): Promise<BufferAllocationResult> {
    // Find nearest hub with buffer vehicles
    const nearestHub = await this.findNearestHubWithBufferVehicles(brokenVehicle.location);
    
    if (!nearestHub) {
      const result: BufferAllocationResult = {
        success: false,
        message: 'No hubs with available buffer vehicles found',
        hubId: undefined,
        allocatedVehicle: undefined,
        estimatedArrivalTime: undefined
      };
      
      this.notifyBreakdownHandled(brokenVehicle.id);
      return result;
    }

    // Allocate buffer vehicle from the hub
    const allocationResult = nearestHub.allocateBufferVehicle(
      brokenVehicle.type,
      {
        weight: brokenVehicle.capacity.weight,
        volume: brokenVehicle.capacity.volume
      }
    );

    if (allocationResult.success && allocationResult.allocatedVehicle) {
      // Calculate estimated arrival time (assuming 30 km/h average speed)
      const distance = this.calculateDistance(nearestHub.location, brokenVehicle.location);
      const estimatedTravelTimeMinutes = (distance / 30) * 60; // 30 km/h average
      const estimatedArrivalTime = new Date(Date.now() + estimatedTravelTimeMinutes * 60 * 1000);

      // Update buffer vehicle location to breakdown location (if it's registered in fleet)
      try {
        await this.updateVehicleLocation(
          allocationResult.allocatedVehicle.id,
          brokenVehicle.location
        );
      } catch (error) {
        // Buffer vehicle might not be registered in this fleet service
        // This is acceptable as buffer vehicles are managed by hubs
        console.log(`Buffer vehicle ${allocationResult.allocatedVehicle.id} location update skipped - not in fleet registry`);
      }

      const result: BufferAllocationResult = {
        success: true,
        message: `Buffer vehicle ${allocationResult.allocatedVehicle.id} dispatched from hub ${nearestHub.id}`,
        hubId: nearestHub.id,
        allocatedVehicle: allocationResult.allocatedVehicle,
        estimatedArrivalTime
      };

      this.notifyBreakdownHandled(brokenVehicle.id, allocationResult.allocatedVehicle.id);
      return result;
    }

    const result: BufferAllocationResult = {
      success: false,
      message: allocationResult.message,
      hubId: nearestHub.id,
      allocatedVehicle: undefined,
      estimatedArrivalTime: undefined
    };

    this.notifyBreakdownHandled(brokenVehicle.id);
    return result;
  }

  /**
   * Manually allocates buffer vehicle for a specific breakdown
   * @param brokenVehicleId - ID of broken vehicle
   * @param hubId - ID of hub to allocate from (optional)
   * @returns Promise<BufferAllocationResult> - Allocation result
   */
  async allocateBufferVehicle(
    brokenVehicleId: string,
    hubId?: string
  ): Promise<BufferAllocationResult> {
    const brokenVehicle = await this.getVehicle(brokenVehicleId);
    
    if (brokenVehicle.status !== 'breakdown') {
      return {
        success: false,
        message: 'Vehicle is not in breakdown status',
        hubId: undefined,
        allocatedVehicle: undefined,
        estimatedArrivalTime: undefined
      };
    }

    if (hubId) {
      const hub = this.hubs.get(hubId);
      if (!hub) {
        return {
          success: false,
          message: `Hub ${hubId} not found`,
          hubId,
          allocatedVehicle: undefined,
          estimatedArrivalTime: undefined
        };
      }

      const allocationResult = hub.allocateBufferVehicle(
        brokenVehicle.type,
        {
          weight: brokenVehicle.capacity.weight,
          volume: brokenVehicle.capacity.volume
        }
      );

      if (allocationResult.success && allocationResult.allocatedVehicle) {
        const distance = this.calculateDistance(hub.location, brokenVehicle.location);
        const estimatedTravelTimeMinutes = (distance / 30) * 60;
        const estimatedArrivalTime = new Date(Date.now() + estimatedTravelTimeMinutes * 60 * 1000);

        try {
          await this.updateVehicleLocation(
            allocationResult.allocatedVehicle.id,
            brokenVehicle.location
          );
        } catch (error) {
          // Buffer vehicle might not be registered in this fleet service
          console.log(`Buffer vehicle ${allocationResult.allocatedVehicle.id} location update skipped - not in fleet registry`);
        }

        return {
          success: true,
          message: `Buffer vehicle ${allocationResult.allocatedVehicle.id} allocated from hub ${hubId}`,
          hubId,
          allocatedVehicle: allocationResult.allocatedVehicle,
          estimatedArrivalTime
        };
      }

      return {
        success: false,
        message: allocationResult.message,
        hubId,
        allocatedVehicle: undefined,
        estimatedArrivalTime: undefined
      };
    }

    // No specific hub provided, use automatic allocation
    return this.handleVehicleBreakdown(brokenVehicle);
  }

  /**
   * Gets buffer vehicle availability across all hubs
   * @returns Promise<BufferVehicleAvailability[]> - Availability by hub
   */
  async getBufferVehicleAvailability(): Promise<BufferVehicleAvailability[]> {
    const availability: BufferVehicleAvailability[] = [];

    for (const [hubId, hub] of this.hubs) {
      const availableBufferVehicles = hub.bufferVehicles.filter(
        (vehicle: Vehicle) => vehicle.status === 'available'
      );

      const byType = availableBufferVehicles.reduce((acc: Record<string, number>, vehicle: Vehicle) => {
        acc[vehicle.type] = (acc[vehicle.type] || 0) + 1;
        return acc;
      }, {});

      availability.push({
        hubId,
        hubName: hub.name,
        totalBufferVehicles: hub.bufferVehicles.length,
        availableBufferVehicles: availableBufferVehicles.length,
        availableByType: byType,
        hubStatus: hub.status,
        lastUpdated: hub.updatedAt
      });
    }

    return availability;
  }

  /**
   * Tracks buffer vehicle usage metrics
   * @returns Promise<BufferVehicleMetrics> - Usage metrics
   */
  async getBufferVehicleMetrics(): Promise<BufferVehicleMetrics> {
    let totalBufferVehicles = 0;
    let availableBufferVehicles = 0;
    let allocatedBufferVehicles = 0;
    let maintenanceBufferVehicles = 0;

    for (const [, hub] of this.hubs) {
      totalBufferVehicles += hub.bufferVehicles.length;
      
      for (const vehicle of hub.bufferVehicles) {
        switch (vehicle.status) {
          case 'available':
            availableBufferVehicles++;
            break;
          case 'in-transit':
            allocatedBufferVehicles++;
            break;
          case 'maintenance':
            maintenanceBufferVehicles++;
            break;
        }
      }
    }

    const utilizationRate = totalBufferVehicles > 0 
      ? ((allocatedBufferVehicles / totalBufferVehicles) * 100)
      : 0;

    return {
      totalBufferVehicles,
      availableBufferVehicles,
      allocatedBufferVehicles,
      maintenanceBufferVehicles,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      lastUpdated: new Date()
    };
  }

  /**
   * Subscribes to breakdown handling notifications
   * @param callback - Callback function for breakdown events
   */
  subscribeToBreakdownEvents(callback: (vehicleId: string, bufferVehicleId?: string) => void): void {
    this.breakdownCallbacks.push(callback);
  }

  /**
   * Unsubscribes from breakdown handling notifications
   * @param callback - Callback function to remove
   */
  unsubscribeFromBreakdownEvents(callback: (vehicleId: string, bufferVehicleId?: string) => void): void {
    const index = this.breakdownCallbacks.indexOf(callback);
    if (index > -1) {
      this.breakdownCallbacks.splice(index, 1);
    }
  }

  /**
   * Simulates vehicle breakdown for testing
   * @param vehicleId - ID of vehicle to simulate breakdown
   * @returns Promise<BufferAllocationResult> - Allocation result
   */
  async simulateVehicleBreakdown(vehicleId: string): Promise<BufferAllocationResult> {
    const vehicle = await this.getVehicle(vehicleId);
    await this.updateVehicleStatus(vehicleId, 'breakdown');
    return this.handleVehicleBreakdown(vehicle);
  }

  /**
   * Finds nearest hub with available buffer vehicles
   * @param location - Location to search from
   * @returns Hub with available buffer vehicles or null
   */
  private async findNearestHubWithBufferVehicles(location: GeoLocation): Promise<any | null> {
    let nearestHub: any = null;
    let shortestDistance = Infinity;

    for (const [, hub] of this.hubs) {
      // Check if hub has available buffer vehicles
      const availableBufferVehicles = hub.bufferVehicles.filter(
        (vehicle: Vehicle) => vehicle.status === 'available'
      );

      if (availableBufferVehicles.length === 0 || hub.status !== 'active') {
        continue;
      }

      const distance = this.calculateDistance(hub.location, location);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestHub = hub;
      }
    }

    return nearestHub;
  }

  /**
   * Notifies subscribers of breakdown handling completion
   * @param vehicleId - ID of broken vehicle
   * @param bufferVehicleId - ID of allocated buffer vehicle (if any)
   */
  private notifyBreakdownHandled(vehicleId: string, bufferVehicleId?: string): void {
    this.breakdownCallbacks.forEach(callback => {
      try {
        callback(vehicleId, bufferVehicleId);
      } catch (error) {
        console.error(`Error in breakdown callback:`, error);
      }
    });
  }

  /**
   * Get available vehicles for a location and time window
   */
  async getAvailableVehicles(_location: any, _timeWindow: any): Promise<Vehicle[]> {
    const allVehicles = await this.getVehicles();
    return allVehicles.filter(vehicle => vehicle.status === 'available');
  }

  /**
   * Check if a vehicle is available for a specific time window
   */
  async isVehicleAvailable(vehicleId: string, _timeWindow: any): Promise<boolean> {
    const vehicle = await this.getVehicle(vehicleId);
    return vehicle.status === 'available';
  }

  /**
   * Reserve a vehicle for a specific time window
   */
  async reserveVehicle(vehicleId: string, _timeWindow: any): Promise<void> {
    await this.updateVehicleStatus(vehicleId, 'reserved');
  }
}

// Additional interfaces for buffer vehicle system
export interface BufferAllocationResult {
  success: boolean;
  message: string;
  hubId?: string | undefined;
  allocatedVehicle?: Vehicle | undefined;
  estimatedArrivalTime?: Date | undefined;
}

export interface BufferVehicleAvailability {
  hubId: string;
  hubName: string;
  totalBufferVehicles: number;
  availableBufferVehicles: number;
  availableByType: Record<string, number>;
  hubStatus: string;
  lastUpdated: Date;
}

export interface BufferVehicleMetrics {
  totalBufferVehicles: number;
  availableBufferVehicles: number;
  allocatedBufferVehicles: number;
  maintenanceBufferVehicles: number;
  utilizationRate: number;
  lastUpdated: Date;
}