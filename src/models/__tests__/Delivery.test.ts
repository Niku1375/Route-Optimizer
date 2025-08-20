/**
 * Unit tests for Delivery model
 */

import { Delivery, DeliveryModel } from '../Delivery';
import { Priority } from '../Common';

describe('Delivery Model', () => {
  let mockDelivery: Delivery;
  let deliveryModel: DeliveryModel;

  beforeEach(() => {
    mockDelivery = global.testUtils.generateTestDelivery();
    deliveryModel = new DeliveryModel(mockDelivery);
  });

  describe('Delivery Interface', () => {
    it('should have all required properties', () => {
      expect(mockDelivery).toHaveProperty('id');
      expect(mockDelivery).toHaveProperty('customerId');
      expect(mockDelivery).toHaveProperty('pickupLocation');
      expect(mockDelivery).toHaveProperty('deliveryLocation');
      expect(mockDelivery).toHaveProperty('timeWindow');
      expect(mockDelivery).toHaveProperty('shipment');
      expect(mockDelivery).toHaveProperty('priority');
      expect(mockDelivery).toHaveProperty('serviceType');
      expect(mockDelivery).toHaveProperty('createdAt');
      expect(mockDelivery).toHaveProperty('updatedAt');
    });

    it('should have valid priority', () => {
      const validPriorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
      expect(validPriorities).toContain(mockDelivery.priority);
    });

    it('should have valid service type', () => {
      const validServiceTypes = ['shared', 'dedicated_premium'];
      expect(validServiceTypes).toContain(mockDelivery.serviceType);
    });

    it('should have valid time window', () => {
      expect(mockDelivery.timeWindow.earliest).toBeInstanceOf(Date);
      expect(mockDelivery.timeWindow.latest).toBeInstanceOf(Date);
      expect(mockDelivery.timeWindow.earliest.getTime()).toBeLessThan(mockDelivery.timeWindow.latest.getTime());
    });

    it('should have positive shipment dimensions', () => {
      expect(mockDelivery.shipment.weight).toBeGreaterThan(0);
      expect(mockDelivery.shipment.volume).toBeGreaterThan(0);
    });
  });

  describe('DeliveryModel Class', () => {
    it('should create instance from delivery data', () => {
      expect(deliveryModel).toBeInstanceOf(DeliveryModel);
      expect(deliveryModel.id).toBe(mockDelivery.id);
      expect(deliveryModel.customerId).toBe(mockDelivery.customerId);
    });

    it('should update priority with timestamp', () => {
      const beforeUpdate = deliveryModel.updatedAt;
      
      deliveryModel.updatePriority('urgent');
      
      expect(deliveryModel.priority).toBe('urgent');
      expect(deliveryModel.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should update estimated duration with timestamp', () => {
      const beforeUpdate = deliveryModel.updatedAt;
      
      deliveryModel.updateEstimatedDuration(180);
      
      expect(deliveryModel.estimatedDuration).toBe(180);
      expect(deliveryModel.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should add special requirements without duplicates', () => {
      deliveryModel.addSpecialRequirement('fragile_handling');
      deliveryModel.addSpecialRequirement('fragile_handling'); // Duplicate
      deliveryModel.addSpecialRequirement('temperature_controlled');
      
      expect(deliveryModel.specialRequirements).toHaveLength(2);
      expect(deliveryModel.specialRequirements).toContain('fragile_handling');
      expect(deliveryModel.specialRequirements).toContain('temperature_controlled');
    });
  });

  describe('Delivery Validation', () => {
    it('should validate correct delivery data', () => {
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestedVehicleTypes.length).toBeGreaterThan(0);
    });

    it('should detect invalid pickup location', () => {
      deliveryModel.pickupLocation.latitude = 0;
      deliveryModel.pickupLocation.longitude = 0;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid pickup location coordinates');
    });

    it('should detect invalid delivery location', () => {
      deliveryModel.deliveryLocation.latitude = 0;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid delivery location coordinates');
    });

    it('should detect invalid time window', () => {
      deliveryModel.timeWindow.earliest = new Date('2024-01-16T10:00:00');
      deliveryModel.timeWindow.latest = new Date('2024-01-16T09:00:00'); // Earlier than start
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid time window: earliest time must be before latest time');
    });

    it('should detect past time window', () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      deliveryModel.timeWindow.earliest = pastDate;
      deliveryModel.timeWindow.latest = new Date(pastDate.getTime() + 3600000);
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Time window cannot be in the past');
    });

    it('should detect invalid shipment weight', () => {
      deliveryModel.shipment.weight = -10;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Shipment weight must be positive');
    });

    it('should detect invalid shipment volume', () => {
      deliveryModel.shipment.volume = 0;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Shipment volume must be positive');
    });

    it('should suggest truck for heavy shipments', () => {
      deliveryModel.shipment.weight = 3500; // Over 3000kg
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.suggestedVehicleTypes).toContain('truck');
    });

    it('should suggest tempo/van for medium shipments', () => {
      deliveryModel.shipment.weight = 1500; // Between 1000-3000kg
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.suggestedVehicleTypes).toContain('tempo');
      expect(result.suggestedVehicleTypes).toContain('van');
    });

    it('should suggest van/three-wheeler for light shipments', () => {
      deliveryModel.shipment.weight = 500; // Under 1000kg
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.suggestedVehicleTypes).toContain('van');
      expect(result.suggestedVehicleTypes).toContain('three-wheeler');
    });

    it('should warn about fragile shipments', () => {
      deliveryModel.shipment.fragile = true;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.warnings).toContain('Fragile shipment requires careful handling');
      expect(result.suggestedVehicleTypes).toContain('van');
    });

    it('should handle hazardous materials', () => {
      deliveryModel.shipment.hazardous = true;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.warnings).toContain('Hazardous material requires certified vehicle and driver');
      expect(result.suggestedVehicleTypes).toEqual(['truck']);
    });

    it('should warn about temperature-controlled shipments', () => {
      deliveryModel.shipment.temperatureControlled = true;
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.warnings).toContain('Temperature-controlled shipment requires refrigerated vehicle');
    });

    it('should warn about narrow time windows', () => {
      const now = new Date();
      deliveryModel.timeWindow.earliest = new Date(now.getTime() + 3600000); // 1 hour from now
      deliveryModel.timeWindow.latest = new Date(now.getTime() + 5400000);   // 1.5 hours from now
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.warnings).toContain('Narrow time window may limit vehicle availability');
    });

    it('should warn about premium service for small shipments', () => {
      deliveryModel.serviceType = 'dedicated_premium';
      deliveryModel.shipment.weight = 50; // Small shipment
      
      const result = deliveryModel.validateDelivery();
      
      expect(result.warnings).toContain('Premium service may not be cost-effective for small shipments');
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between pickup and delivery', () => {
      // Set known coordinates (Delhi to Gurgaon approximately)
      deliveryModel.pickupLocation = { latitude: 28.6139, longitude: 77.2090 };
      deliveryModel.deliveryLocation = { latitude: 28.4595, longitude: 77.0266 };
      
      const result = deliveryModel.calculateDistance();
      
      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.estimatedDurationMinutes).toBeGreaterThan(0);
      expect(['simple', 'moderate', 'complex']).toContain(result.routeComplexity);
    });

    it('should classify short distances as simple', () => {
      // Set close coordinates
      deliveryModel.pickupLocation = { latitude: 28.6139, longitude: 77.2090 };
      deliveryModel.deliveryLocation = { latitude: 28.6200, longitude: 77.2150 };
      
      const result = deliveryModel.calculateDistance();
      
      expect(result.routeComplexity).toBe('simple');
      expect(result.distanceKm).toBeLessThan(5);
    });

    it('should add buffer time for loading/unloading', () => {
      const result = deliveryModel.calculateDistance();
      
      // Should include at least 20 minutes buffer
      expect(result.estimatedDurationMinutes).toBeGreaterThan(20);
    });

    it('should add extra time for special handling', () => {
      // Create a clean delivery without special handling
      const normalDelivery = global.testUtils.generateTestDelivery({
        shipment: {
          ...mockDelivery.shipment,
          fragile: false,
          temperatureControlled: false,
          hazardous: false
        }
      });
      const normalModel = new DeliveryModel(normalDelivery);
      
      // Set special handling on test model
      deliveryModel.shipment.fragile = true;
      deliveryModel.shipment.temperatureControlled = true;
      deliveryModel.shipment.hazardous = false;
      
      const result = deliveryModel.calculateDistance();
      const resultNormal = normalModel.calculateDistance();
      
      expect(result.estimatedDurationMinutes).toBeGreaterThan(resultNormal.estimatedDurationMinutes);
    });

    it('should add extra time for hazardous materials', () => {
      // Create a clean delivery without hazardous materials
      const normalDelivery = global.testUtils.generateTestDelivery({
        shipment: {
          ...mockDelivery.shipment,
          fragile: false,
          temperatureControlled: false,
          hazardous: false
        }
      });
      const normalModel = new DeliveryModel(normalDelivery);
      
      // Set hazardous on test model
      deliveryModel.shipment.hazardous = true;
      deliveryModel.shipment.fragile = false;
      deliveryModel.shipment.temperatureControlled = false;
      
      const result = deliveryModel.calculateDistance();
      const resultNormal = normalModel.calculateDistance();
      
      expect(result.estimatedDurationMinutes).toBeGreaterThan(resultNormal.estimatedDurationMinutes);
    });
  });

  describe('Vehicle Compatibility', () => {
    it('should check compatibility with vehicle capacity', () => {
      deliveryModel.shipment.weight = 500;
      deliveryModel.shipment.volume = 2;
      
      const compatibleVehicle = { weight: 1000, volume: 5 };
      const incompatibleVehicle = { weight: 300, volume: 1 };
      
      expect(deliveryModel.isCompatibleWithVehicle(compatibleVehicle)).toBe(true);
      expect(deliveryModel.isCompatibleWithVehicle(incompatibleVehicle)).toBe(false);
    });

    it('should reject vehicles with insufficient weight capacity', () => {
      deliveryModel.shipment.weight = 1500;
      deliveryModel.shipment.volume = 2;
      
      const vehicle = { weight: 1000, volume: 5 };
      
      expect(deliveryModel.isCompatibleWithVehicle(vehicle)).toBe(false);
    });

    it('should reject vehicles with insufficient volume capacity', () => {
      deliveryModel.shipment.weight = 500;
      deliveryModel.shipment.volume = 10;
      
      const vehicle = { weight: 1000, volume: 5 };
      
      expect(deliveryModel.isCompatibleWithVehicle(vehicle)).toBe(false);
    });
  });

  describe('Time Window Validation', () => {
    it('should validate time within window', () => {
      const withinWindow = new Date(deliveryModel.timeWindow.earliest.getTime() + 1800000); // 30 min after start
      
      expect(deliveryModel.isWithinTimeWindow(withinWindow)).toBe(true);
    });

    it('should reject time before window', () => {
      const beforeWindow = new Date(deliveryModel.timeWindow.earliest.getTime() - 1800000); // 30 min before start
      
      expect(deliveryModel.isWithinTimeWindow(beforeWindow)).toBe(false);
    });

    it('should reject time after window', () => {
      const afterWindow = new Date(deliveryModel.timeWindow.latest.getTime() + 1800000); // 30 min after end
      
      expect(deliveryModel.isWithinTimeWindow(afterWindow)).toBe(false);
    });

    it('should accept time at window boundaries', () => {
      expect(deliveryModel.isWithinTimeWindow(deliveryModel.timeWindow.earliest)).toBe(true);
      expect(deliveryModel.isWithinTimeWindow(deliveryModel.timeWindow.latest)).toBe(true);
    });
  });
});