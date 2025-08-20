/**
 * Unit tests for Hub model
 */

import { Hub, HubModel } from '../Hub';
import { Vehicle } from '../Vehicle';


describe('Hub Model', () => {
  let mockHub: Hub;
  let hubModel: HubModel;
  let mockVehicle: Vehicle;

  beforeEach(() => {
    mockHub = global.testUtils.generateTestHub();
    hubModel = new HubModel(mockHub);
    mockVehicle = global.testUtils.generateTestVehicle();
  });

  describe('Hub Interface', () => {
    it('should have all required properties', () => {
      expect(mockHub).toHaveProperty('id');
      expect(mockHub).toHaveProperty('name');
      expect(mockHub).toHaveProperty('location');
      expect(mockHub).toHaveProperty('capacity');
      expect(mockHub).toHaveProperty('bufferVehicles');
      expect(mockHub).toHaveProperty('operatingHours');
      expect(mockHub).toHaveProperty('facilities');
      expect(mockHub).toHaveProperty('hubType');
      expect(mockHub).toHaveProperty('status');
      expect(mockHub).toHaveProperty('contactInfo');
      expect(mockHub).toHaveProperty('createdAt');
      expect(mockHub).toHaveProperty('updatedAt');
    });

    it('should have valid hub type', () => {
      const validTypes = ['primary', 'secondary', 'micro'];
      expect(validTypes).toContain(mockHub.hubType);
    });

    it('should have valid status', () => {
      const validStatuses = ['active', 'inactive', 'maintenance'];
      expect(validStatuses).toContain(mockHub.status);
    });

    it('should have positive capacity values', () => {
      expect(mockHub.capacity.maxVehicles).toBeGreaterThan(0);
      expect(mockHub.capacity.currentVehicles).toBeGreaterThanOrEqual(0);
      expect(mockHub.capacity.storageArea).toBeGreaterThan(0);
      expect(mockHub.capacity.loadingBays).toBeGreaterThan(0);
      expect(mockHub.capacity.bufferVehicleSlots).toBeGreaterThan(0);
    });

    it('should have valid operating hours format', () => {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      expect(timeRegex.test(mockHub.operatingHours.open)).toBe(true);
      expect(timeRegex.test(mockHub.operatingHours.close)).toBe(true);
    });

    it('should have valid contact information', () => {
      expect(mockHub.contactInfo.managerName).toBeTruthy();
      expect(mockHub.contactInfo.phone).toBeTruthy();
      expect(mockHub.contactInfo.email).toBeTruthy();
      expect(mockHub.contactInfo.emergencyContact).toBeTruthy();
    });
  });

  describe('HubModel Class', () => {
    it('should create instance from hub data', () => {
      expect(hubModel).toBeInstanceOf(HubModel);
      expect(hubModel.id).toBe(mockHub.id);
      expect(hubModel.name).toBe(mockHub.name);
    });

    it('should update status with timestamp', () => {
      const beforeUpdate = hubModel.updatedAt;
      
      hubModel.updateStatus('maintenance');
      
      expect(hubModel.status).toBe('maintenance');
      expect(hubModel.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should update current vehicle count within limits', () => {
      hubModel.updateCurrentVehicleCount(30);
      expect(hubModel.capacity.currentVehicles).toBe(30);
      
      // Test upper limit
      hubModel.updateCurrentVehicleCount(100); // Exceeds maxVehicles (50)
      expect(hubModel.capacity.currentVehicles).toBe(hubModel.capacity.maxVehicles);
      
      // Test lower limit
      hubModel.updateCurrentVehicleCount(-5);
      expect(hubModel.capacity.currentVehicles).toBe(0);
    });
  });

  describe('Buffer Vehicle Management', () => {
    beforeEach(() => {
      // Ensure hub is active and has buffer capacity
      hubModel.status = 'active';
      hubModel.bufferVehicles = [];
    });

    it('should add buffer vehicle successfully', () => {
      const result = hubModel.addBufferVehicle(mockVehicle);
      
      expect(result).toBe(true);
      expect(hubModel.bufferVehicles).toHaveLength(1);
      expect(hubModel.bufferVehicles[0]!.id).toBe(mockVehicle.id);
    });

    it('should reject duplicate buffer vehicles', () => {
      hubModel.addBufferVehicle(mockVehicle);
      const result = hubModel.addBufferVehicle(mockVehicle); // Duplicate
      
      expect(result).toBe(false);
      expect(hubModel.bufferVehicles).toHaveLength(1);
    });

    it('should reject buffer vehicles when at capacity', () => {
      // Fill buffer to capacity
      for (let i = 0; i < hubModel.capacity.bufferVehicleSlots; i++) {
        const vehicle = global.testUtils.generateTestVehicle({ id: `vehicle-${i}` });
        hubModel.addBufferVehicle(vehicle);
      }
      
      const result = hubModel.addBufferVehicle(mockVehicle);
      
      expect(result).toBe(false);
      expect(hubModel.bufferVehicles).toHaveLength(hubModel.capacity.bufferVehicleSlots);
    });

    it('should remove buffer vehicle successfully', () => {
      hubModel.addBufferVehicle(mockVehicle);
      
      const result = hubModel.removeBufferVehicle(mockVehicle.id);
      
      expect(result).toBe(true);
      expect(hubModel.bufferVehicles).toHaveLength(0);
    });

    it('should fail to remove non-existent buffer vehicle', () => {
      const result = hubModel.removeBufferVehicle('non-existent-id');
      
      expect(result).toBe(false);
    });
  });

  describe('Buffer Vehicle Allocation', () => {
    beforeEach(() => {
      hubModel.status = 'active';
      hubModel.bufferVehicles = [
        global.testUtils.generateTestVehicle({ 
          id: 'buffer-1', 
          type: 'van', 
          status: 'available',
          capacity: { weight: 1000, volume: 5, maxDimensions: { length: 3, width: 2, height: 2 } }
        }),
        global.testUtils.generateTestVehicle({ 
          id: 'buffer-2', 
          type: 'truck', 
          status: 'available',
          capacity: { weight: 3000, volume: 15, maxDimensions: { length: 6, width: 2.5, height: 3 } }
        }),
        global.testUtils.generateTestVehicle({ 
          id: 'buffer-3', 
          type: 'van', 
          status: 'in-transit' // Not available
        })
      ];
    });

    it('should allocate available buffer vehicle', () => {
      const result = hubModel.allocateBufferVehicle();
      
      expect(result.success).toBe(true);
      expect(result.allocatedVehicle).toBeDefined();
      expect(result.allocatedVehicle!.status).toBe('in-transit');
      expect(result.message).toContain('allocated successfully');
    });

    it('should allocate vehicle by type preference', () => {
      const result = hubModel.allocateBufferVehicle('truck');
      
      expect(result.success).toBe(true);
      expect(result.allocatedVehicle!.type).toBe('truck');
      expect(result.allocatedVehicle!.id).toBe('buffer-2');
    });

    it('should allocate vehicle by capacity requirements', () => {
      const minCapacity = { weight: 2000, volume: 10 };
      const result = hubModel.allocateBufferVehicle(undefined, minCapacity);
      
      expect(result.success).toBe(true);
      expect(result.allocatedVehicle!.capacity.weight).toBeGreaterThanOrEqual(minCapacity.weight);
      expect(result.allocatedVehicle!.capacity.volume).toBeGreaterThanOrEqual(minCapacity.volume);
    });

    it('should fail allocation when hub is inactive', () => {
      hubModel.status = 'inactive';
      
      const result = hubModel.allocateBufferVehicle();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not active');
    });

    it('should fail allocation when no vehicles available', () => {
      hubModel.bufferVehicles = [];
      
      const result = hubModel.allocateBufferVehicle();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No buffer vehicles available');
    });

    it('should fail allocation when no vehicles match requirements', () => {
      const result = hubModel.allocateBufferVehicle('three-wheeler'); // No three-wheelers available
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No buffer vehicles match the specified requirements');
      expect(result.alternativeOptions).toBeDefined();
      expect(result.alternativeOptions!.length).toBeGreaterThan(0);
    });

    it('should provide alternatives when exact match not found', () => {
      const minCapacity = { weight: 5000, volume: 20 }; // Exceeds all available capacity
      const result = hubModel.allocateBufferVehicle(undefined, minCapacity);
      
      expect(result.success).toBe(false);
      expect(result.alternativeOptions).toBeDefined();
      expect(result.alternativeOptions!.length).toBe(2); // Two available vehicles
    });
  });

  describe('Capacity Status', () => {
    it('should calculate capacity status correctly', () => {
      hubModel.capacity.currentVehicles = 45; // 90% of 50
      
      const status = hubModel.getCapacityStatus();
      
      expect(status.vehicleUtilization).toBe(90);
      expect(status.bufferVehicleAvailability).toBe(0); // No buffer vehicles by default
      expect(status.isAtCapacity).toBe(true); // High utilization and no buffer
      expect(status.recommendedActions.length).toBeGreaterThan(0);
    });

    it('should recommend actions for high utilization', () => {
      hubModel.capacity.currentVehicles = 43; // 86% of 50
      
      const status = hubModel.getCapacityStatus();
      
      expect(status.recommendedActions).toContain('Consider redirecting new vehicles to alternative hubs');
    });

    it('should recommend buffer vehicle replenishment', () => {
      hubModel.bufferVehicles = [
        global.testUtils.generateTestVehicle({ status: 'available' })
      ]; // Only 1 available buffer vehicle
      
      const status = hubModel.getCapacityStatus();
      
      expect(status.recommendedActions).toContain('Replenish buffer vehicle inventory');
    });
  });

  describe('Operating Hours Validation', () => {
    beforeEach(() => {
      hubModel.operatingHours = {
        open: '06:00',
        close: '22:00',
        timezone: 'Asia/Kolkata'
      };
    });

    it('should validate operating hours during business hours', () => {
      const businessHours = new Date('2024-01-15T10:00:00'); // 10 AM
      
      const result = hubModel.validateOperatingHours(businessHours);
      
      expect(result.isOpen).toBe(true);
      expect(result.currentTime).toBe('10:00');
      expect(result.openTime).toBe('06:00');
      expect(result.closeTime).toBe('22:00');
      expect(result.minutesUntilClose).toBe(12 * 60); // 12 hours until 22:00
    });

    it('should validate operating hours outside business hours', () => {
      const afterHours = new Date('2024-01-15T23:00:00'); // 11 PM
      
      const result = hubModel.validateOperatingHours(afterHours);
      
      expect(result.isOpen).toBe(false);
      expect(result.currentTime).toBe('23:00');
      expect(result.nextOpenTime).toBe('06:00 (next day)');
    });

    it('should validate operating hours before opening', () => {
      const beforeOpening = new Date('2024-01-15T05:00:00'); // 5 AM
      
      const result = hubModel.validateOperatingHours(beforeOpening);
      
      expect(result.isOpen).toBe(false);
      expect(result.nextOpenTime).toBe('06:00');
    });

    it('should handle overnight operations', () => {
      hubModel.operatingHours.open = '22:00';
      hubModel.operatingHours.close = '06:00';
      
      const midnightTime = new Date('2024-01-15T02:00:00'); // 2 AM
      const result = hubModel.validateOperatingHours(midnightTime);
      
      expect(result.isOpen).toBe(true);
      expect(result.minutesUntilClose).toBe(4 * 60); // 4 hours until 06:00
    });

    it('should handle special hours for specific days', () => {
      hubModel.operatingHours.specialHours = {
        'sunday': { open: '08:00', close: '20:00' }
      };
      
      const sundayTime = new Date('2024-01-14T07:00:00'); // Sunday 7 AM
      const result = hubModel.validateOperatingHours(sundayTime);
      
      expect(result.isOpen).toBe(false);
      expect(result.openTime).toBe('08:00');
      expect(result.closeTime).toBe('20:00');
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance to another hub', () => {
      const otherHub = global.testUtils.generateTestHub({
        id: 'other-hub',
        location: { latitude: 28.7041, longitude: 77.1025 } // Different location
      });
      
      const distance = hubModel.calculateDistanceToHub(otherHub);
      
      expect(distance).toBeGreaterThan(0);
      expect(typeof distance).toBe('number');
    });

    it('should return zero distance for same location', () => {
      const sameLocationHub = global.testUtils.generateTestHub({
        id: 'same-hub',
        location: hubModel.location
      });
      
      const distance = hubModel.calculateDistanceToHub(sameLocationHub);
      
      expect(distance).toBe(0);
    });
  });
});