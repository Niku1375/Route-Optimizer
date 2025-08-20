/**
 * Integration tests for Demo Scenario Generator
 * Tests end-to-end demo scenario execution with real service integration
 */

import { DemoScenarioGenerator } from '../DemoScenarioGenerator';
import { MapVisualizationService } from '../MapVisualizationService';
import { RoutingService } from '../RoutingService';
import { DelhiComplianceService } from '../DelhiComplianceService';
import { FleetService } from '../FleetService';
import { TrafficPredictionService } from '../TrafficPredictionService';
import { CacheService } from '../../cache/CacheService';

describe('DemoScenarioGenerator Integration Tests', () => {
  let demoGenerator: DemoScenarioGenerator;
  let mapVisualizationService: MapVisualizationService;
  let routingService: RoutingService;
  let complianceService: DelhiComplianceService;
  let fleetService: FleetService;
  let trafficService: TrafficPredictionService;
  let cacheService: CacheService;

  beforeAll(async () => {
    // Initialize real services for integration testing
    cacheService = new CacheService();
    await cacheService.connect();

    fleetService = new FleetService(cacheService);
    trafficService = new TrafficPredictionService(cacheService);
    complianceService = new DelhiComplianceService();
    
    // Mock external API clients for integration tests
    const mockMapboxClient = {
      getRoute: jest.fn().mockResolvedValue({
        routes: [{
          geometry: 'mock_geometry',
          duration: 1800,
          distance: 15000
        }]
      }),
      getDirections: jest.fn().mockResolvedValue({
        routes: [{
          legs: [{
            steps: [
              { maneuver: { instruction: 'Head north' }, distance: 500, duration: 60 }
            ]
          }]
        }]
      })
    };

    const mockGraphHopperClient = {
      getRoute: jest.fn().mockResolvedValue({
        paths: [{
          points: 'mock_points',
          time: 1800000,
          distance: 15000,
          instructions: [
            { text: 'Head north', distance: 500, time: 60000 }
          ]
        }]
      })
    };

    mapVisualizationService = new MapVisualizationService({
      mapboxClient: mockMapboxClient,
      graphHopperClient: mockGraphHopperClient
    });

    routingService = new RoutingService(fleetService, trafficService);

    demoGenerator = new DemoScenarioGenerator(
      mapVisualizationService,
      routingService,
      complianceService
    );
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  describe('Delhi Compliance Demo Integration', () => {
    it('should execute complete Delhi compliance demo scenario', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');
      
      // Execute the scenario
      const result = await demoGenerator.executeDemoScenario(scenario);

      expect(result).toBeDefined();
      expect(result.animationFrames).toBeDefined();
      expect(result.finalState).toBeDefined();
      expect(result.summary).toBeDefined();

      // Verify scenario execution results
      expect(result.summary.totalDeliveries).toBe(3);
      expect(result.summary.complianceRate).toBeLessThan(100); // Should have violations
      expect(result.finalState.metrics.complianceViolations).toBeGreaterThan(0);
    });

    it('should validate compliance violations in Delhi scenario', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');
      
      // Check that compliance service validates violations correctly
      const truckVehicle = scenario.vehicles.find(v => v.type === 'truck');
      expect(truckVehicle).toBeDefined();

      // Test time restriction validation
      const restrictedTime = new Date('2024-01-15T02:00:00');
      const timeValidation = complianceService.validateTimeRestrictions(
        {
          id: truckVehicle!.id,
          type: 'truck',
          subType: 'heavy-truck',
          capacity: { weight: 5000, volume: 20, maxDimensions: { length: 8, width: 2.5, height: 3 } },
          location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
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
            plateNumber: truckVehicle!.plateNumber || 'DL01AB1234',
            fuelType: 'diesel',
            vehicleAge: 3,
            registrationState: 'DL'
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
            id: 'driver_1',
            workingHours: 8,
            maxWorkingHours: 12
          }
        },
        'residential',
        restrictedTime
      );

      expect(timeValidation.isAllowed).toBe(false);
      expect(timeValidation.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
    });

    it('should suggest compliant alternatives for violations', async () => {
      //const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');
      
      // Test odd-even violation
      const evenDate = new Date('2024-01-16'); // Even date
      const oddPlate = 'DL01AB1235'; // Odd plate
      
      const oddEvenResult = complianceService.checkOddEvenCompliance(oddPlate, evenDate);
      expect(oddEvenResult.isCompliant).toBe(false);
      
      // Test alternative suggestions
      const suggestions = complianceService.suggestCompliantAlternatives(
        {
          id: 'test_vehicle',
          type: 'truck',
          subType: 'heavy-truck',
          capacity: { weight: 5000, volume: 20, maxDimensions: { length: 8, width: 2.5, height: 3 } },
          location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
          status: 'available',
          compliance: {
            pollutionCertificate: true,
            pollutionLevel: 'BS6',
            permitValid: true,
            oddEvenCompliant: false,
            zoneRestrictions: [],
            timeRestrictions: []
          },
          vehicleSpecs: {
            plateNumber: oddPlate,
            fuelType: 'diesel',
            vehicleAge: 3,
            registrationState: 'DL'
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
            id: 'driver_1',
            workingHours: 8,
            maxWorkingHours: 12
          }
        },
        'residential',
        evenDate
      );

      expect(suggestions).toContain('Use electric vehicle (exempt from odd-even rules)');
      expect(suggestions).toContain('Use CNG vehicle (often exempt from odd-even rules)');
    });
  });

  describe('Hub-and-Spoke Demo Integration', () => {
    it('should execute hub-and-spoke scenario with multi-hub routing', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');
      
      const result = await demoGenerator.executeDemoScenario(scenario);

      expect(result).toBeDefined();
      expect(result.summary.totalDeliveries).toBe(15);
      expect(result.finalState.metrics.totalDistance).toBeGreaterThan(0);
      
      // Should have routes connecting multiple hubs
      expect(scenario.hubs).toHaveLength(4);
      expect(scenario.deliveries.every(d => d.id.includes('CROSS_HUB'))).toBe(true);
    });

    it('should handle breakdown event and buffer vehicle allocation', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');
      
      const breakdownEvent = scenario.events.find(e => e.type === 'breakdown');
      expect(breakdownEvent).toBeDefined();
      expect(breakdownEvent!.vehicleId).toBe('INTER_HUB_TRUCK_1');
      
      // Verify buffer vehicles are available at hubs
      const hubWithBuffers = scenario.hubs.find(h => h.bufferVehicles > 0);
      expect(hubWithBuffers).toBeDefined();
      expect(hubWithBuffers!.bufferVehicles).toBeGreaterThan(0);
    });
  });

  describe('Breakdown Recovery Demo Integration', () => {
    it('should execute breakdown recovery scenario successfully', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');
      
      const result = await demoGenerator.executeDemoScenario(scenario);

      expect(result).toBeDefined();
      expect(result.summary.totalDeliveries).toBe(1);
      expect(result.summary.successfulDeliveries).toBe(1);
      
      // Should have primary vehicle and buffer vehicles
      const primaryVehicle = scenario.vehicles.find(v => v.id === 'PRIMARY_VEHICLE');
      const bufferVehicles = scenario.vehicles.filter(v => v.id.includes('BUFFER_VEHICLE'));
      
      expect(primaryVehicle).toBeDefined();
      expect(primaryVehicle!.status).toBe('in-transit');
      expect(bufferVehicles).toHaveLength(2);
      expect(bufferVehicles.every(v => v.status === 'available')).toBe(true);
    });

    it('should simulate breakdown event timing correctly', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');
      
      const breakdownEvent = scenario.events.find(e => e.type === 'breakdown');
      expect(breakdownEvent).toBeDefined();
      expect(breakdownEvent!.time).toBe(120); // 2 minutes into scenario
      expect(breakdownEvent!.impact.severity).toBe('high');
      expect(breakdownEvent!.impact.duration).toBe(300); // 5 minutes recovery time
    });
  });

  describe('Traffic Optimization Demo Integration', () => {
    it('should execute traffic optimization scenario with dynamic events', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('traffic_optimization');
      
      const result = await demoGenerator.executeDemoScenario(scenario);

      expect(result).toBeDefined();
      expect(result.summary.totalDeliveries).toBe(8);
      
      // Should have traffic and weather events
      const trafficEvent = scenario.events.find(e => e.type === 'traffic_jam');
      const weatherEvent = scenario.events.find(e => e.type === 'weather_change');
      
      expect(trafficEvent).toBeDefined();
      expect(weatherEvent).toBeDefined();
      expect(trafficEvent!.impact.severity).toBe('high');
      expect(weatherEvent!.impact.severity).toBe('medium');
    });

    it('should generate traffic-sensitive delivery patterns', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('traffic_optimization');
      
      // All deliveries should be radially distributed from center
      const center = scenario.centerLocation;
      scenario.deliveries.forEach(delivery => {
        expect(delivery.pickupLocation).toEqual(center);
        
        // Delivery location should be different from pickup
        expect(delivery.deliveryLocation).not.toEqual(center);
        
        // Should have reasonable time windows
        expect(delivery.timeWindow.earliest).toBe('09:00');
        expect(delivery.timeWindow.latest).toBe('17:00');
      });
    });
  });

  describe('Demo Dashboard Integration', () => {
    it('should create interactive dashboard with all components', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');
      
      const dashboard = await demoGenerator.createDemoDashboard(scenario);

      expect(dashboard).toBeDefined();
      expect(dashboard.mapData).toBeDefined();
      expect(dashboard.controlPanel).toBeDefined();
      expect(dashboard.metricsPanel).toBeDefined();

      // Verify map data structure
      expect(dashboard.mapData.metadata.centerLocation).toEqual(scenario.centerLocation);
      expect(dashboard.mapData.vehicles).toBeDefined();
      expect(dashboard.mapData.routes).toBeDefined();

      // Verify control panel
      expect(dashboard.controlPanel.scenarios).toHaveLength(4);
      expect(dashboard.controlPanel.currentScenario).toBe(scenario.name);
      expect(dashboard.controlPanel.playbackControls.totalDuration).toBe(scenario.duration);

      // Verify metrics panel
      expect(dashboard.metricsPanel.realTimeMetrics).toBeDefined();
      expect(dashboard.metricsPanel.charts).toHaveLength(3);
    });

    it('should create functional event triggers', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');
      
      const dashboard = await demoGenerator.createDemoDashboard(scenario);

      expect(dashboard.controlPanel.eventTriggers).toHaveLength(1);
      
      const breakdownTrigger = dashboard.controlPanel.eventTriggers[0];
      expect(breakdownTrigger.name).toBe('BREAKDOWN');
      expect(breakdownTrigger.description).toContain('Primary delivery vehicle breakdown');
      
      // Test that trigger function exists and is callable
      expect(typeof breakdownTrigger.trigger).toBe('function');
      expect(() => breakdownTrigger.trigger()).not.toThrow();
    });

    it('should calculate real-time metrics correctly', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');
      
      const dashboard = await demoGenerator.createDemoDashboard(scenario);

      const metrics = dashboard.metricsPanel.realTimeMetrics;
      
      // Count vehicles by status
      const inTransitVehicles = scenario.vehicles.filter(v => v.status === 'in-transit').length;
      expect(metrics.activeVehicles).toBe(inTransitVehicles);
      
      // Initial state should have no completed deliveries
      expect(metrics.completedDeliveries).toBe(0);
      
      // Should have calculated average speed
      expect(metrics.averageSpeed).toBeGreaterThan(0);
      
      // Initial compliance rate should be 100%
      expect(metrics.complianceRate).toBe(100);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large scenario execution within time limits', async () => {
      const startTime = Date.now();
      
      const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke', {
        vehicleCount: 20,
        deliveryCount: 50,
        hubCount: 6
      });
      
      const result = await demoGenerator.executeDemoScenario(scenario);
      
      const executionTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.summary.totalDeliveries).toBeGreaterThan(0);
    });

    it('should handle concurrent demo scenario executions', async () => {
      const scenarios = [
        demoGenerator.generatePredefinedScenario('delhi_compliance'),
        demoGenerator.generatePredefinedScenario('hub_spoke'),
        demoGenerator.generatePredefinedScenario('breakdown_recovery')
      ];

      const startTime = Date.now();
      const results = await Promise.all(scenarios.map(async (scenarioPromise) => {
        const scenario = await scenarioPromise;
        return demoGenerator.executeDemoScenario(scenario);
      }));

      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.summary.totalDeliveries > 0)).toBe(true);
      expect(executionTime).toBeLessThan(45000); // Should complete within 45 seconds
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle routing service failures gracefully', async () => {
      // Create a scenario that might cause routing issues
      const problematicScenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');
      
      // Modify scenario to have impossible constraints
      problematicScenario.deliveries.forEach(delivery => {
        delivery.timeWindow.earliest = '23:59';
        delivery.timeWindow.latest = '00:01'; // Impossible time window
      });

      // Should handle gracefully without crashing
      await expect(demoGenerator.executeDemoScenario(problematicScenario))
        .resolves.toBeDefined();
    });

    it('should handle map visualization service failures', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');
      
      // Mock a failure in map visualization
      const originalCreateAnimation = mapVisualizationService.createRouteAnimation;
      mapVisualizationService.createRouteAnimation = jest.fn().mockRejectedValue(new Error('Map service unavailable'));

      await expect(demoGenerator.executeDemoScenario(scenario))
        .rejects.toThrow('Failed to execute demo scenario');

      // Restore original method
      mapVisualizationService.createRouteAnimation = originalCreateAnimation;
    });
  });

  describe('Data Consistency and Validation', () => {
    it('should maintain data consistency across scenario execution', async () => {
      const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');
      const result = await demoGenerator.executeDemoScenario(scenario);

      // Verify vehicle count consistency
      expect(result.finalState.vehiclePositions.size).toBe(scenario.vehicles.length);

      // Verify delivery count consistency
      expect(result.summary.totalDeliveries).toBe(scenario.deliveries.length);

      // Verify hub count consistency
      expect(scenario.hubs.length).toBeGreaterThan(0);
    });

    it('should validate scenario configuration before execution', async () => {
      const invalidScenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');
      
      // Make scenario invalid
      invalidScenario.vehicles = [];
      invalidScenario.deliveries = [];

      // Should still execute but with appropriate handling
      const result = await demoGenerator.executeDemoScenario(invalidScenario);
      
      expect(result.summary.totalDeliveries).toBe(0);
      expect(result.summary.successfulDeliveries).toBe(0);
    });
  });
});