/**
 * Unit tests for FleetService
 * Tests vehicle registration, status tracking, and GPS management functionality
 */

import { FleetService, VehicleRegistrationData, FleetSearchCriteria } from '../FleetService';
import { Vehicle } from '../../models/Vehicle';
import { VehicleStatus } from '../../models/Common';
import { GeoLocation } from '../../models/GeoLocation';
import { ValidationError, NotFoundError } from '../../utils/errors';

describe('FleetService', () => {
  let fleetService: FleetService;
  let mockVehicleData: VehicleRegistrationData;

  beforeEach(() => {
    fleetService = new FleetService();
    
    mockVehicleData = {
      vehicle: {
        type: 'truck',
        subType: 'heavy-truck',
        capacity: {
          weight: 5000,
          volume: 20,
          maxDimensions: {
            length: 8,
            width: 2.5,
            height: 3
          }
        },
        location: {
          latitude: 28.6139,
          longitude: 77.2090,
          timestamp: new Date()
        },
        status: 'available',
        compliance: {
          pollutionCertificate: true,
          pollutionLevel: 'BS6',
          permitValid: true,
          oddEvenCompliant: true,
          zoneRestrictions: [],
          timeRestrictions: []
        },
        vehicleSpecs: {
          plateNumber: 'DL01AB1234',
          fuelType: 'diesel',
          vehicleAge: 3,
          registrationState: 'Delhi',
          manufacturingYear: 2021
        },
        accessPrivileges: {
          residentialZones: false,
          commercialZones: true,
          industrialZones: true,
          restrictedHours: false,
          pollutionSensitiveZones: false,
          narrowLanes: false
        },
        driverInfo: {
          id: 'DRV001',
          name: 'John Doe',
          licenseNumber: 'DL123456789',
          workingHours: 0,
          maxWorkingHours: 8,
          contactNumber: '+91-9876543210'
        }
      }
    };
  });

  describe('Vehicle Registration', () => {
    it('should register a new vehicle successfully', async () => {
      const registeredVehicle = await fleetService.registerVehicle(mockVehicleData);

      expect(registeredVehicle).toBeDefined();
      expect(registeredVehicle.id).toBeDefined();
      expect(registeredVehicle.id).toMatch(/^VEH_[A-Z0-9_]+$/);
      expect(registeredVehicle.vehicleSpecs.plateNumber).toBe('DL01AB1234');
      expect(registeredVehicle.status).toBe('available');
      expect(registeredVehicle.lastUpdated).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for multiple vehicles', async () => {
      const vehicle1 = await fleetService.registerVehicle(mockVehicleData);
      
      // Create second vehicle with different plate number
      const secondVehicleData = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: 'DL02CD5678'
          }
        }
      };
      
      const vehicle2 = await fleetService.registerVehicle(secondVehicleData);

      expect(vehicle1.id).not.toBe(vehicle2.id);
      expect(vehicle1.id).toMatch(/^VEH_[A-Z0-9_]+$/);
      expect(vehicle2.id).toMatch(/^VEH_[A-Z0-9_]+$/);
    });

    it('should throw ValidationError for missing plate number', async () => {
      const invalidData = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: ''
          }
        }
      };

      await expect(fleetService.registerVehicle(invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing driver license', async () => {
      const invalidData = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          driverInfo: {
            ...mockVehicleData.vehicle.driverInfo,
            licenseNumber: ''
          }
        }
      };

      await expect(fleetService.registerVehicle(invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid capacity', async () => {
      const invalidData = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          capacity: {
            ...mockVehicleData.vehicle.capacity,
            weight: 0
          }
        }
      };

      await expect(fleetService.registerVehicle(invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for duplicate plate number', async () => {
      await fleetService.registerVehicle(mockVehicleData);

      await expect(fleetService.registerVehicle(mockVehicleData))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('Vehicle Retrieval', () => {
    let registeredVehicle: Vehicle;

    beforeEach(async () => {
      registeredVehicle = await fleetService.registerVehicle(mockVehicleData);
    });

    it('should retrieve a vehicle by ID', async () => {
      const retrievedVehicle = await fleetService.getVehicle(registeredVehicle.id);

      expect(retrievedVehicle).toBeDefined();
      expect(retrievedVehicle.id).toBe(registeredVehicle.id);
      expect(retrievedVehicle.vehicleSpecs.plateNumber).toBe('DL01AB1234');
    });

    it('should throw NotFoundError for non-existent vehicle ID', async () => {
      await expect(fleetService.getVehicle('NON_EXISTENT_ID'))
        .rejects.toThrow(NotFoundError);
    });

    it('should retrieve all vehicles when no criteria provided', async () => {
      const vehicles = await fleetService.getVehicles();

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]?.id).toBe(registeredVehicle.id);
    });

    it('should filter vehicles by status', async () => {
      // Register another vehicle with different status
      const secondVehicleData = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          status: 'maintenance' as VehicleStatus,
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: 'DL02CD5678'
          }
        }
      };
      await fleetService.registerVehicle(secondVehicleData);

      const criteria: FleetSearchCriteria = {
        status: ['available']
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]?.status).toBe('available');
    });

    it('should filter vehicles by type', async () => {
      // Register a tempo vehicle
      const tempoData = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          type: 'tempo' as const,
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: 'DL02CD5678'
          }
        }
      };
      await fleetService.registerVehicle(tempoData);

      const criteria: FleetSearchCriteria = {
        vehicleTypes: ['truck']
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]?.type).toBe('truck');
    });

    it('should filter vehicles by location radius', async () => {
      const criteria: FleetSearchCriteria = {
        location: {
          center: { latitude: 28.6139, longitude: 77.2090 },
          radiusKm: 1
        }
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]?.id).toBe(registeredVehicle.id);
    });

    it('should filter vehicles by capacity requirements', async () => {
      const criteria: FleetSearchCriteria = {
        capacity: {
          minWeight: 3000,
          minVolume: 15
        }
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]?.capacity.weight).toBeGreaterThanOrEqual(3000);
      expect(vehicles[0]?.capacity.volume).toBeGreaterThanOrEqual(15);
    });

    it('should return empty array when no vehicles match criteria', async () => {
      const criteria: FleetSearchCriteria = {
        capacity: {
          minWeight: 10000 // Higher than any registered vehicle
        }
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(0);
    });
  });

  describe('Vehicle Updates', () => {
    let registeredVehicle: Vehicle;

    beforeEach(async () => {
      registeredVehicle = await fleetService.registerVehicle(mockVehicleData);
    });

    it('should update vehicle location', async () => {
      const newLocation: GeoLocation = {
        latitude: 28.7041,
        longitude: 77.1025,
        timestamp: new Date()
      };

      const updatedVehicle = await fleetService.updateVehicleLocation(
        registeredVehicle.id,
        newLocation
      );

      expect(updatedVehicle.location.latitude).toBe(28.7041);
      expect(updatedVehicle.location.longitude).toBe(77.1025);
      expect(updatedVehicle.location.timestamp).toBeInstanceOf(Date);
      expect(updatedVehicle.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update vehicle status', async () => {
      const updatedVehicle = await fleetService.updateVehicleStatus(
        registeredVehicle.id,
        'in-transit'
      );

      expect(updatedVehicle.status).toBe('in-transit');
      expect(updatedVehicle.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update driver information', async () => {
      const updatedVehicle = await fleetService.updateVehicle(registeredVehicle.id, {
        driverInfo: {
          workingHours: 4,
          contactNumber: '+91-9999999999'
        }
      });

      expect(updatedVehicle.driverInfo.workingHours).toBe(4);
      expect(updatedVehicle.driverInfo.contactNumber).toBe('+91-9999999999');
      expect(updatedVehicle.driverInfo.name).toBe('John Doe'); // Should preserve existing data
    });

    it('should throw NotFoundError when updating non-existent vehicle', async () => {
      await expect(fleetService.updateVehicleStatus('NON_EXISTENT_ID', 'maintenance'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('Vehicle Removal', () => {
    let registeredVehicle: Vehicle;

    beforeEach(async () => {
      registeredVehicle = await fleetService.registerVehicle(mockVehicleData);
    });

    it('should remove vehicle successfully when not in-transit', async () => {
      const result = await fleetService.removeVehicle(registeredVehicle.id);

      expect(result).toBe(true);
      await expect(fleetService.getVehicle(registeredVehicle.id))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when removing in-transit vehicle', async () => {
      await fleetService.updateVehicleStatus(registeredVehicle.id, 'in-transit');

      await expect(fleetService.removeVehicle(registeredVehicle.id))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when removing non-existent vehicle', async () => {
      await expect(fleetService.removeVehicle('NON_EXISTENT_ID'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('Fleet Metrics', () => {
    beforeEach(async () => {
      // Register multiple vehicles with different statuses
      await fleetService.registerVehicle(mockVehicleData);

      const vehicle2Data = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          status: 'in-transit' as VehicleStatus,
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: 'DL02CD5678'
          }
        }
      };
      await fleetService.registerVehicle(vehicle2Data);

      const vehicle3Data = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          status: 'maintenance' as VehicleStatus,
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: 'DL03EF9012'
          }
        }
      };
      await fleetService.registerVehicle(vehicle3Data);
    });

    it('should calculate fleet metrics correctly', async () => {
      const metrics = await fleetService.getFleetMetrics();

      expect(metrics.totalVehicles).toBe(3);
      expect(metrics.availableVehicles).toBe(1);
      expect(metrics.inTransitVehicles).toBe(1);
      expect(metrics.maintenanceVehicles).toBe(1);
      expect(metrics.breakdownVehicles).toBe(0);
      expect(metrics.averageUtilization).toBe(66.67); // (3-1)/3 * 100 = 66.67%
      expect(metrics.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle empty fleet metrics', async () => {
      const emptyFleetService = new FleetService();
      const metrics = await emptyFleetService.getFleetMetrics();

      expect(metrics.totalVehicles).toBe(0);
      expect(metrics.availableVehicles).toBe(0);
      expect(metrics.averageUtilization).toBe(0);
    });
  });

  describe('Real-time Tracking', () => {
    let registeredVehicle: Vehicle;

    beforeEach(async () => {
      registeredVehicle = await fleetService.registerVehicle(mockVehicleData);
    });

    it('should notify location update subscribers', async () => {
      const locationCallback = jest.fn();
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, locationCallback);

      const newLocation: GeoLocation = {
        latitude: 28.7041,
        longitude: 77.1025
      };

      await fleetService.updateVehicleLocation(registeredVehicle.id, newLocation);

      expect(locationCallback).toHaveBeenCalledTimes(1);
      expect(locationCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: registeredVehicle.id,
          location: expect.objectContaining({
            latitude: 28.7041,
            longitude: 77.1025
          })
        })
      );
    });

    it('should notify status update subscribers', async () => {
      const statusCallback = jest.fn();
      fleetService.subscribeToStatusUpdates(registeredVehicle.id, statusCallback);

      await fleetService.updateVehicleStatus(registeredVehicle.id, 'in-transit');

      expect(statusCallback).toHaveBeenCalledTimes(1);
      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: registeredVehicle.id,
          status: 'in-transit'
        })
      );
    });

    it('should handle multiple subscribers for location updates', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, callback1);
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, callback2);

      const newLocation: GeoLocation = {
        latitude: 28.7041,
        longitude: 77.1025
      };

      await fleetService.updateVehicleLocation(registeredVehicle.id, newLocation);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe from location updates', async () => {
      const callback = jest.fn();
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, callback);
      fleetService.unsubscribeFromLocationUpdates(registeredVehicle.id, callback);

      const newLocation: GeoLocation = {
        latitude: 28.7041,
        longitude: 77.1025
      };

      await fleetService.updateVehicleLocation(registeredVehicle.id, newLocation);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should unsubscribe all callbacks when no specific callback provided', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, callback1);
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, callback2);
      fleetService.unsubscribeFromLocationUpdates(registeredVehicle.id);

      const newLocation: GeoLocation = {
        latitude: 28.7041,
        longitude: 77.1025
      };

      await fleetService.updateVehicleLocation(registeredVehicle.id, newLocation);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      // Mock console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, errorCallback);
      fleetService.subscribeToLocationUpdates(registeredVehicle.id, normalCallback);

      const newLocation: GeoLocation = {
        latitude: 28.7041,
        longitude: 77.1025
      };

      await fleetService.updateVehicleLocation(registeredVehicle.id, newLocation);

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in location update callback'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Stale Location Detection', () => {
    let registeredVehicle: Vehicle;

    beforeEach(async () => {
      registeredVehicle = await fleetService.registerVehicle(mockVehicleData);
    });

    it('should identify vehicles with stale location data', async () => {
      // Get the vehicle and manually set old timestamp
      const vehicle = await fleetService.getVehicle(registeredVehicle.id);
      
      // Manually set old timestamp on the location
      vehicle.location.timestamp = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago

      const staleVehicles = await fleetService.getVehiclesWithStaleLocation(30);

      expect(staleVehicles).toHaveLength(1);
      expect(staleVehicles[0]?.id).toBe(registeredVehicle.id);
    });

    it('should not return vehicles with recent location updates', async () => {
      const recentLocation: GeoLocation = {
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: new Date() // Current time
      };

      await fleetService.updateVehicleLocation(registeredVehicle.id, recentLocation);

      const staleVehicles = await fleetService.getVehiclesWithStaleLocation(30);

      expect(staleVehicles).toHaveLength(0);
    });

    it('should use lastUpdated when location timestamp is not available', async () => {
      // Create vehicle with location without timestamp
      const vehicleWithoutTimestamp = {
        ...mockVehicleData,
        vehicle: {
          ...mockVehicleData.vehicle,
          location: {
            latitude: 28.6139,
            longitude: 77.2090
            // No timestamp
          },
          vehicleSpecs: {
            ...mockVehicleData.vehicle.vehicleSpecs,
            plateNumber: 'DL02CD5678'
          }
        }
      };

      const vehicle = await fleetService.registerVehicle(vehicleWithoutTimestamp);
      
      // Manually set lastUpdated to old time to simulate stale data
      const retrievedVehicle = await fleetService.getVehicle(vehicle.id);
      (retrievedVehicle as any).lastUpdated = new Date(Date.now() - 45 * 60 * 1000);

      const staleVehicles = await fleetService.getVehiclesWithStaleLocation(30);

      expect(staleVehicles.some(v => v.id === vehicle.id)).toBe(true);
    });
  });

  describe('Distance Calculation', () => {
    beforeEach(async () => {
      await fleetService.registerVehicle(mockVehicleData);
    });

    it('should filter vehicles within specified radius', async () => {
      const criteria: FleetSearchCriteria = {
        location: {
          center: { latitude: 28.6139, longitude: 77.2090 }, // Same as vehicle location
          radiusKm: 1
        }
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(1);
    });

    it('should exclude vehicles outside specified radius', async () => {
      const criteria: FleetSearchCriteria = {
        location: {
          center: { latitude: 28.7041, longitude: 77.1025 }, // Different location
          radiusKm: 1 // Small radius
        }
      };

      const vehicles = await fleetService.getVehicles(criteria);

      expect(vehicles).toHaveLength(0);
    });
  });

  describe('Buffer Vehicle Allocation System', () => {
    let registeredVehicle: Vehicle;
    let mockHub: any;

    beforeEach(async () => {
      registeredVehicle = await fleetService.registerVehicle(mockVehicleData);
      
      // Create mock hub with buffer vehicles
      mockHub = {
        id: 'HUB001',
        name: 'Central Hub',
        location: { latitude: 28.6139, longitude: 77.2090 },
        status: 'active',
        updatedAt: new Date(),
        bufferVehicles: [
          {
            id: 'BUFFER001',
            type: 'truck',
            capacity: { weight: 5000, volume: 20 },
            status: 'available',
            compliance: { pollutionLevel: 'BS6' }
          },
          {
            id: 'BUFFER002',
            type: 'tempo',
            capacity: { weight: 1500, volume: 8 },
            status: 'available',
            compliance: { pollutionLevel: 'BS4' }
          }
        ],
        allocateBufferVehicle: jest.fn().mockReturnValue({
          success: true,
          allocatedVehicle: {
            id: 'BUFFER001',
            type: 'truck',
            capacity: { weight: 5000, volume: 20 },
            status: 'in-transit',
            compliance: { pollutionLevel: 'BS6' }
          },
          message: 'Buffer vehicle BUFFER001 allocated successfully'
        })
      };

      fleetService.registerHub(mockHub);
    });

    it('should handle vehicle breakdown automatically', async () => {
      const breakdownResult = await fleetService.simulateVehicleBreakdown(registeredVehicle.id);

      expect(breakdownResult.success).toBe(true);
      expect(breakdownResult.allocatedVehicle).toBeDefined();
      expect(breakdownResult.allocatedVehicle?.id).toBe('BUFFER001');
      expect(breakdownResult.hubId).toBe('HUB001');
      expect(breakdownResult.estimatedArrivalTime).toBeInstanceOf(Date);
      expect(mockHub.allocateBufferVehicle).toHaveBeenCalledWith(
        'truck',
        { weight: 5000, volume: 20 }
      );
    });

    it('should manually allocate buffer vehicle from specific hub', async () => {
      // First set vehicle to breakdown status
      await fleetService.updateVehicleStatus(registeredVehicle.id, 'breakdown');

      const allocationResult = await fleetService.allocateBufferVehicle(
        registeredVehicle.id,
        'HUB001'
      );

      expect(allocationResult.success).toBe(true);
      expect(allocationResult.allocatedVehicle?.id).toBe('BUFFER001');
      expect(allocationResult.hubId).toBe('HUB001');
    });

    it('should fail allocation when vehicle is not in breakdown status', async () => {
      const allocationResult = await fleetService.allocateBufferVehicle(registeredVehicle.id);

      expect(allocationResult.success).toBe(false);
      expect(allocationResult.message).toBe('Vehicle is not in breakdown status');
    });

    it('should fail allocation when hub is not found', async () => {
      await fleetService.updateVehicleStatus(registeredVehicle.id, 'breakdown');

      const allocationResult = await fleetService.allocateBufferVehicle(
        registeredVehicle.id,
        'NONEXISTENT_HUB'
      );

      expect(allocationResult.success).toBe(false);
      expect(allocationResult.message).toBe('Hub NONEXISTENT_HUB not found');
    });

    it('should handle allocation failure from hub', async () => {
      // Mock hub to return failure
      mockHub.allocateBufferVehicle.mockReturnValue({
        success: false,
        message: 'No suitable buffer vehicles available'
      });

      await fleetService.updateVehicleStatus(registeredVehicle.id, 'breakdown');

      const allocationResult = await fleetService.allocateBufferVehicle(
        registeredVehicle.id,
        'HUB001'
      );

      expect(allocationResult.success).toBe(false);
      expect(allocationResult.message).toBe('No suitable buffer vehicles available');
    });

    it('should get buffer vehicle availability across hubs', async () => {
      const availability = await fleetService.getBufferVehicleAvailability();

      expect(availability).toHaveLength(1);
      expect(availability[0]?.hubId).toBe('HUB001');
      expect(availability[0]?.hubName).toBe('Central Hub');
      expect(availability[0]?.totalBufferVehicles).toBe(2);
      expect(availability[0]?.availableBufferVehicles).toBe(2);
      expect(availability[0]?.availableByType).toEqual({
        truck: 1,
        tempo: 1
      });
    });

    it('should calculate buffer vehicle metrics', async () => {
      const metrics = await fleetService.getBufferVehicleMetrics();

      expect(metrics.totalBufferVehicles).toBe(2);
      expect(metrics.availableBufferVehicles).toBe(2);
      expect(metrics.allocatedBufferVehicles).toBe(0);
      expect(metrics.maintenanceBufferVehicles).toBe(0);
      expect(metrics.utilizationRate).toBe(0);
      expect(metrics.lastUpdated).toBeInstanceOf(Date);
    });

    it('should notify breakdown event subscribers', async () => {
      const breakdownCallback = jest.fn();
      fleetService.subscribeToBreakdownEvents(breakdownCallback);

      await fleetService.simulateVehicleBreakdown(registeredVehicle.id);

      expect(breakdownCallback).toHaveBeenCalledWith(registeredVehicle.id, 'BUFFER001');
    });

    it('should unsubscribe from breakdown events', async () => {
      const breakdownCallback = jest.fn();
      fleetService.subscribeToBreakdownEvents(breakdownCallback);
      fleetService.unsubscribeFromBreakdownEvents(breakdownCallback);

      await fleetService.simulateVehicleBreakdown(registeredVehicle.id);

      expect(breakdownCallback).not.toHaveBeenCalled();
    });

    it('should handle breakdown when no hubs have buffer vehicles', async () => {
      // Create hub with no available buffer vehicles
      const emptyHub = {
        id: 'HUB002',
        name: 'Empty Hub',
        location: { latitude: 28.7041, longitude: 77.1025 },
        status: 'active',
        updatedAt: new Date(),
        bufferVehicles: []
      };

      // Replace the hub with empty one
      const emptyFleetService = new FleetService();
      emptyFleetService.registerHub(emptyHub);
      
      const vehicle = await emptyFleetService.registerVehicle(mockVehicleData);
      const breakdownResult = await emptyFleetService.simulateVehicleBreakdown(vehicle.id);

      expect(breakdownResult.success).toBe(false);
      expect(breakdownResult.message).toBe('No hubs with available buffer vehicles found');
    });

    it('should find nearest hub with buffer vehicles', async () => {
      // Add another hub farther away
      const distantHub = {
        id: 'HUB002',
        name: 'Distant Hub',
        location: { latitude: 28.8041, longitude: 77.3025 }, // Farther location
        status: 'active',
        updatedAt: new Date(),
        bufferVehicles: [
          {
            id: 'BUFFER003',
            type: 'truck',
            capacity: { weight: 5000, volume: 20 },
            status: 'available',
            compliance: { pollutionLevel: 'BS6' }
          }
        ],
        allocateBufferVehicle: jest.fn().mockReturnValue({
          success: true,
          allocatedVehicle: {
            id: 'BUFFER003',
            type: 'truck',
            capacity: { weight: 5000, volume: 20 },
            status: 'in-transit'
          }
        })
      };

      fleetService.registerHub(distantHub);

      const breakdownResult = await fleetService.simulateVehicleBreakdown(registeredVehicle.id);

      // Should allocate from nearest hub (HUB001)
      expect(breakdownResult.success).toBe(true);
      expect(breakdownResult.hubId).toBe('HUB001');
      expect(mockHub.allocateBufferVehicle).toHaveBeenCalled();
      expect(distantHub.allocateBufferVehicle).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully in breakdown notifications', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fleetService.subscribeToBreakdownEvents(errorCallback);
      fleetService.subscribeToBreakdownEvents(normalCallback);

      await fleetService.simulateVehicleBreakdown(registeredVehicle.id);

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in breakdown callback'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should calculate estimated arrival time based on distance', async () => {
      // Create hub at known distance
      const distantHub = {
        id: 'HUB_DISTANT',
        name: 'Distant Hub',
        location: { latitude: 28.7041, longitude: 77.1025 }, // ~15km from vehicle
        status: 'active',
        updatedAt: new Date(),
        bufferVehicles: [
          {
            id: 'BUFFER_DISTANT',
            type: 'truck',
            capacity: { weight: 5000, volume: 20 },
            status: 'available',
            compliance: { pollutionLevel: 'BS6' }
          }
        ],
        allocateBufferVehicle: jest.fn().mockReturnValue({
          success: true,
          allocatedVehicle: {
            id: 'BUFFER_DISTANT',
            type: 'truck',
            capacity: { weight: 5000, volume: 20 },
            status: 'in-transit'
          }
        })
      };

      // Remove closer hub and add distant one
      const distantFleetService = new FleetService();
      distantFleetService.registerHub(distantHub);
      
      const vehicle = await distantFleetService.registerVehicle(mockVehicleData);
      const breakdownResult = await distantFleetService.simulateVehicleBreakdown(vehicle.id);

      expect(breakdownResult.success).toBe(true);
      expect(breakdownResult.estimatedArrivalTime).toBeInstanceOf(Date);
      
      // Estimated arrival should be in the future
      const now = new Date();
      expect(breakdownResult.estimatedArrivalTime!.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});