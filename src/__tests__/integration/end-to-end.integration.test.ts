import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../api/server';
import { DatabaseService } from '../../database/DatabaseService';
import { RedisService } from '../../cache/RedisService';
import { FleetService } from '../../services/FleetService';
import { VehicleSearchService } from '../../services/VehicleSearchService';
import { RoutingService } from '../../services/RoutingService';
import { DelhiComplianceService } from '../../services/DelhiComplianceService';
import { TrafficPredictionService } from '../../services/TrafficPredictionService';
import { CustomerLoyaltyService } from '../../services/CustomerLoyaltyService';
import { InteractiveDemoService } from '../../services/InteractiveDemoService';
import { Vehicle, VehicleType, VehicleStatus } from '../../models/Vehicle';
import { Delivery } from '../../models/Delivery';
import { SearchCriteria, VehicleSearchResult } from '../../models/Common';


/**
 * End-to-End Integration Test Suite
 * 
 * Tests complete workflows from vehicle search to route optimization
 * Validates all Delhi compliance scenarios with real-world test cases
 * Performs integration testing with all external APIs (mocked)
 * 
 * Requirements Coverage: All requirements integration
 */
describe('End-to-End Integration Tests', () => {
  let databaseService: DatabaseService;
  let redisService: RedisService;
  let fleetService: FleetService;
  let vehicleSearchService: VehicleSearchService;
  let routingService: RoutingService;
  let delhiComplianceService: DelhiComplianceService;
  let trafficPredictionService: TrafficPredictionService;
  let customerLoyaltyService: CustomerLoyaltyService;
  let interactiveDemoService: InteractiveDemoService;

  // Test data
  const testVehicles: Vehicle[] = [
    {
      id: 'V001',
      type: 'truck' as VehicleType,
      subType: 'heavy-truck',
      capacity: { weight: 5000, volume: 20, maxDimensions: { length: 6, width: 2.5, height: 3 } },
      location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: ['commercial'],
        timeRestrictions: [{ 
          zoneType: 'residential', 
          restrictedHours: { start: '23:00', end: '07:00' },
          daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          exceptions: []
        }]
      },
      vehicleSpecs: {
        plateNumber: 'DL01AB1234',
        fuelType: 'diesel',
        vehicleAge: 2,
        registrationState: 'Delhi'
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
        id: 'D001',
        workingHours: 0,
        maxWorkingHours: 8
      }
    },
    {
      id: 'V002',
      type: 'tempo' as VehicleType,
      subType: 'tempo-traveller',
      capacity: { weight: 1500, volume: 8, maxDimensions: { length: 4, width: 1.8, height: 2.2 } },
      location: { latitude: 28.7041, longitude: 77.1025, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: 'DL02CD5678',
        fuelType: 'cng',
        vehicleAge: 1,
        registrationState: 'Delhi'
      },
      accessPrivileges: {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: false
      },
      driverInfo: {
        id: 'D002',
        workingHours: 0,
        maxWorkingHours: 8
      }
    },
    {
      id: 'V003',
      type: 'electric' as VehicleType,
      subType: 'e-rickshaw',
      capacity: { weight: 250, volume: 1.5, maxDimensions: { length: 2.5, width: 1.2, height: 1.8 } },
      location: { latitude: 28.5355, longitude: 77.3910, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'electric',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: 'DL03EF9012',
        fuelType: 'electric',
        vehicleAge: 1,
        registrationState: 'Delhi'
      },
      accessPrivileges: {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: true
      },
      driverInfo: {
        id: 'D003',
        workingHours: 0,
        maxWorkingHours: 8
      }
    }
  ];

  const testDeliveries: Delivery[] = [
    {
      id: 'D001',
      pickupLocation: { latitude: 28.6139, longitude: 77.2090 }, // Connaught Place
      deliveryLocation: { latitude: 28.7041, longitude: 77.1025 }, // Karol Bagh
      timeWindow: { earliest: new Date('2024-01-15T09:00:00'), latest: new Date('2024-01-15T18:00:00') },
      shipment: { weight: 2000, volume: 10, fragile: false, specialHandling: [] },
      priority: 'high',
      customerId: 'C001',
      serviceType: 'shared'
    },
    {
      id: 'D002',
      pickupLocation: { latitude: 28.7041, longitude: 77.1025 }, // Karol Bagh
      deliveryLocation: { latitude: 28.5355, longitude: 77.3910 }, // Lajpat Nagar
      timeWindow: { earliest: new Date('2024-01-15T02:00:00'), latest: new Date('2024-01-15T05:00:00') },
      shipment: { weight: 500, volume: 3, fragile: false, specialHandling: [] },
      priority: 'medium',
      customerId: 'C002',
      serviceType: 'shared'
    }
  ];

  beforeAll(async () => {
    // Initialize services
    databaseService = new DatabaseService();
    redisService = new RedisService();
    fleetService = new FleetService(databaseService);
    delhiComplianceService = new DelhiComplianceService();
    trafficPredictionService = new TrafficPredictionService(redisService);
    vehicleSearchService = new VehicleSearchService(fleetService, delhiComplianceService, redisService);
    routingService = new RoutingService(delhiComplianceService, trafficPredictionService);
    customerLoyaltyService = new CustomerLoyaltyService(databaseService);
    interactiveDemoService = new InteractiveDemoService(
      fleetService,
      routingService,
      vehicleSearchService,
      delhiComplianceService
    );

    // Setup test database and cache
    await databaseService.connect();
    await redisService.connect();
    
    // Clear existing test data
    await databaseService.query('DELETE FROM vehicles WHERE id LIKE \'V%\'');
    await databaseService.query('DELETE FROM deliveries WHERE id LIKE \'D%\'');
    await redisService.flushAll();
  });

  afterAll(async () => {
    // Cleanup
    await databaseService.disconnect();
    await redisService.disconnect();
  });

  beforeEach(async () => {
    // Setup test data for each test
    for (const vehicle of testVehicles) {
      await fleetService.registerVehicle(vehicle);
    }
  });

  afterEach(async () => {
    // Clean up test data after each test
    await databaseService.query('DELETE FROM vehicles WHERE id LIKE \'V%\'');
    await databaseService.query('DELETE FROM deliveries WHERE id LIKE \'D%\'');
    await databaseService.query('DELETE FROM routes WHERE id LIKE \'R%\'');
    await redisService.flushAll();
  });

  describe('Complete Vehicle Search to Route Optimization Workflow', () => {
    it('should complete full workflow from search to optimized route', async () => {
      const startTime = Date.now();

      // Step 1: Search for available vehicles
      const searchCriteria: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '09:00', end: '18:00' },
        capacity: { weight: 2000, volume: 10 },
        serviceType: 'shared',
        vehicleTypePreference: ['truck', 'tempo']
      };

      const searchResult: VehicleSearchResult = await vehicleSearchService.searchAvailableVehicles(searchCriteria);
      
      expect(searchResult).toBeDefined();
      expect(searchResult.availableVehicles.length).toBeGreaterThan(0);
      expect(searchResult.totalResults).toBeGreaterThan(0);

      // Step 2: Validate compliance for selected vehicle
      const selectedVehicle = searchResult.availableVehicles[0];
      const complianceResult = await delhiComplianceService.validateVehicleMovement(
        selectedVehicle,
        {
          id: 'test-route',
          vehicleId: selectedVehicle.id,
          stops: [
            { location: searchCriteria.pickupLocation, type: 'pickup', timeWindow: { start: '09:00', end: '10:00' } },
            { location: searchCriteria.deliveryLocation, type: 'delivery', timeWindow: { start: '10:30', end: '11:30' } }
          ],
          estimatedDuration: 90,
          estimatedDistance: 15,
          estimatedFuelConsumption: 2.5,
          trafficFactors: [],
          status: 'planned'
        },
        new Date('2024-01-15T09:00:00')
      );

      expect(complianceResult.isCompliant).toBe(true);
      expect(complianceResult.violations.length).toBe(0);

      // Step 3: Generate optimized route
      const routingRequest = {
        vehicles: [selectedVehicle],
        deliveries: [testDeliveries[0]],
        hubs: [],
        constraints: {
          vehicleClassRestrictions: [],
          timeWindowConstraints: [],
          zoneAccessRules: [],
          pollutionCompliance: [],
          oddEvenRules: [],
          weightDimensionLimits: []
        },
        trafficData: await trafficPredictionService.getCurrentTraffic({
          bounds: {
            north: 28.8,
            south: 28.4,
            east: 77.4,
            west: 77.0
          }
        }),
        timeWindow: { start: '09:00', end: '18:00' },
        complianceRules: []
      };

      const optimizationResult = await routingService.optimizeRoutes(routingRequest);
      
      expect(optimizationResult).toBeDefined();
      expect(optimizationResult.routes.length).toBeGreaterThan(0);
      expect(optimizationResult.totalDistance).toBeGreaterThan(0);
      expect(optimizationResult.totalDuration).toBeGreaterThan(0);

      // Verify performance requirements
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Step 4: Verify route efficiency
      expect(optimizationResult.efficiencyImprovement).toBeGreaterThanOrEqual(0.2); // 20% improvement target
    });

    it('should handle premium service workflow', async () => {
      const searchCriteria: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '14:00', end: '16:00' },
        capacity: { weight: 800, volume: 4 },
        serviceType: 'dedicated_premium',
        vehicleTypePreference: ['van', 'tempo']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(searchCriteria);
      
      expect(searchResult.premiumOptions).toBeDefined();
      expect(searchResult.premiumOptions.length).toBeGreaterThan(0);
      
      const premiumOption = searchResult.premiumOptions[0];
      expect(premiumOption.dedicatedService).toBe(true);
      expect(premiumOption.premiumPricing.totalPrice).toBeGreaterThan(premiumOption.premiumPricing.basePrice);
      expect(premiumOption.priorityLevel).toBeDefined();
    });
  });

  describe('Delhi Compliance Scenarios', () => {
    it('should enforce truck time restrictions in residential areas', async () => {
      const restrictedTimeSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 }, // Residential area
        timeWindow: { start: '02:00', end: '05:00' }, // Restricted hours for trucks
        capacity: { weight: 3000, volume: 15 },
        serviceType: 'shared',
        vehicleTypePreference: ['truck']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(restrictedTimeSearch);
      
      // Should not return trucks for residential delivery during restricted hours
      const truckResults = searchResult.availableVehicles.filter(v => v.type === 'truck');
      expect(truckResults.length).toBe(0);
      
      // Should suggest alternatives
      expect(searchResult.alternatives.length).toBeGreaterThan(0);
      expect(searchResult.alternatives[0].suggestion).toContain('alternative');
    });

    it('should validate odd-even rule compliance', async () => {
      const oddDate = new Date('2024-01-15'); // Odd date
      const evenPlateVehicle = testVehicles.find(v => v.vehicleSpecs.plateNumber.endsWith('5678')); // Even plate
      
      const complianceResult = await delhiComplianceService.checkOddEvenCompliance(
        evenPlateVehicle!.vehicleSpecs.plateNumber,
        oddDate
      );
      
      expect(complianceResult).toBe(false); // Even plate on odd date should fail
    });

    it('should prioritize electric vehicles in pollution zones', async () => {
      const pollutionZoneSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 }, // Connaught Place (pollution sensitive)
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 200, volume: 1 },
        serviceType: 'shared'
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(pollutionZoneSearch);
      
      // Electric vehicles should be prioritized
      const electricVehicles = searchResult.availableVehicles.filter(v => v.type === 'electric');
      expect(electricVehicles.length).toBeGreaterThan(0);
      
      // First result should be electric if available
      if (electricVehicles.length > 0) {
        expect(searchResult.availableVehicles[0].type).toBe('electric');
      }
    });
  });

  describe('Customer Loyalty Integration', () => {
    it('should apply loyalty discounts correctly', async () => {
      const loyalCustomerId = 'C001';
      
      // Setup customer loyalty profile
      await customerLoyaltyService.updatePoolingHistory(loyalCustomerId, {
        deliveryId: 'D001',
        serviceType: 'shared',
        co2Saved: 2.5,
        costSaved: 150
      });

      const searchCriteria: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared',
        customerId: loyalCustomerId
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(searchCriteria);
      
      expect(searchResult.pricing.loyaltyDiscount).toBeGreaterThan(0);
      expect(searchResult.pricing.finalPrice).toBeLessThan(searchResult.pricing.basePrice);
    });

    it('should track environmental impact for pooled deliveries', async () => {
      const customerId = 'C002';
      const delivery = testDeliveries[0];
      
      await customerLoyaltyService.trackEnvironmentalImpact(customerId, delivery);
      
      const loyaltyProfile = await customerLoyaltyService.getLoyaltyProfile(customerId);
      expect(loyaltyProfile.poolingHistory.co2SavedKg).toBeGreaterThan(0);
      expect(loyaltyProfile.poolingHistory.totalPooledDeliveries).toBeGreaterThan(0);
    });
  });

  describe('Interactive Demo Scenarios', () => {
    it('should execute Delhi vehicle class restriction demo', async () => {
      const demoResult = await interactiveDemoService.runDelhiComplianceDemo();
      
      expect(demoResult.scenarioName).toBe('Delhi Vehicle Class Movement Restrictions');
      expect(demoResult.results.truckAssignment).toContain('compliance');
      expect(demoResult.results.alternativeSuggestions).toBeDefined();
      expect(demoResult.metrics.complianceRate).toBe(1.0); // 100% compliance
    });

    it('should demonstrate hub-and-spoke operations', async () => {
      const hubSpokeDemo = await interactiveDemoService.runHubSpokeDemo();
      
      expect(hubSpokeDemo.scenarioName).toBe('Hub-and-Spoke Routing');
      expect(hubSpokeDemo.results.hubTransfers).toBeGreaterThan(0);
      expect(hubSpokeDemo.results.loadOptimization).toBeDefined();
      expect(hubSpokeDemo.metrics.efficiencyImprovement).toBeGreaterThanOrEqual(0.2);
    });

    it('should simulate vehicle breakdown and recovery', async () => {
      const breakdownDemo = await interactiveDemoService.runBreakdownRecoveryDemo();
      
      expect(breakdownDemo.scenarioName).toBe('Vehicle Breakdown Recovery');
      expect(breakdownDemo.results.bufferAllocation).toBeDefined();
      expect(breakdownDemo.results.reoptimizationTime).toBeLessThan(30); // Within 30 seconds
      expect(breakdownDemo.metrics.recoveryTime).toBeLessThan(120); // Within 2 minutes
    });
  });

  describe('External API Integration (Mocked)', () => {
    beforeEach(() => {
      // Mock external API responses
      jest.spyOn(trafficPredictionService, 'getCurrentTraffic').mockResolvedValue({
        area: { bounds: { north: 28.8, south: 28.4, east: 77.4, west: 77.0 } },
        congestionLevel: 'moderate',
        averageSpeed: 25,
        incidents: [],
        timestamp: new Date(),
        predictions: []
      });
    });

    it('should handle traffic API integration', async () => {
      const trafficData = await trafficPredictionService.getCurrentTraffic({
        bounds: { north: 28.8, south: 28.4, east: 77.4, west: 77.0 }
      });
      
      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBeDefined();
      expect(trafficData.averageSpeed).toBeGreaterThan(0);
    });

    it('should handle API failures gracefully', async () => {
      // Mock API failure
      jest.spyOn(trafficPredictionService, 'getCurrentTraffic').mockRejectedValue(new Error('API Unavailable'));
      
      // Should use fallback data
      const searchResult = await vehicleSearchService.searchAvailableVehicles({
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared'
      });
      
      expect(searchResult).toBeDefined();
      expect(searchResult.availableVehicles.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent routing requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        pickupLocation: { latitude: 28.6139 + (i * 0.01), longitude: 77.2090 + (i * 0.01) },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared' as const
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentRequests.map(criteria => vehicleSearchService.searchAvailableVehicles(criteria))
      );
      const endTime = Date.now();

      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.availableVehicles.length).toBeGreaterThanOrEqual(0);
      });

      // Should handle concurrent requests efficiently
      expect(endTime - startTime).toBeLessThan(15000); // Within 15 seconds for 10 concurrent requests
    });

    it('should maintain response time under load', async () => {
      const searchCriteria: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared'
      };

      const startTime = Date.now();
      const result = await vehicleSearchService.searchAvailableVehicles(searchCriteria);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // API response within 5 seconds
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide system health metrics', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services.database).toBe('connected');
      expect(response.body.services.cache).toBe('connected');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should track route optimization metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/routing')
        .expect(200);

      expect(response.body.averageOptimizationTime).toBeDefined();
      expect(response.body.successRate).toBeGreaterThanOrEqual(0.95); // 95% success rate
      expect(response.body.efficiencyImprovement).toBeGreaterThanOrEqual(0.2); // 20% improvement
    });
  });
});