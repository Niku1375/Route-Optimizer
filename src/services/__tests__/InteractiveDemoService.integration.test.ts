/**
 * Integration tests for Interactive Demo Service
 * Tests end-to-end Delhi-specific demo scenarios with real service integration
 */

import { InteractiveDemoService } from '../InteractiveDemoService';
import { DemoScenarioGenerator } from '../DemoScenarioGenerator';
import { DelhiComplianceService } from '../DelhiComplianceService';
import { MapVisualizationService } from '../MapVisualizationService';
import { RoutingService } from '../RoutingService';
import { FleetService } from '../FleetService';
import type { TrafficPredictionService } from '../TrafficPredictionService';
import { CacheService } from '../../cache/CacheService';

describe('InteractiveDemoService Integration Tests', () => {
  let interactiveDemoService: InteractiveDemoService;
  let demoGenerator: DemoScenarioGenerator;
  let complianceService: DelhiComplianceService;
  let mapVisualizationService: MapVisualizationService;
  let routingService: RoutingService;
  let fleetService: FleetService;
  let trafficService: TrafficPredictionService;
  let cacheService: CacheService;
  
  // Store scenarios to avoid redundant creation
  let delhiComplianceScenario: any;
  let delhiComplianceExecution: any;
  let hubSpokeScenario: any;
  let hubSpokeExecution: any;
  let breakdownRecoveryScenario: any;
  let breakdownRecoveryExecution: any;

  beforeAll(async () => {
    // Initialize real services for integration testing
    cacheService = new CacheService();
    await cacheService.connect();

    fleetService = new FleetService();
    // Create a mock traffic service instead
    trafficService = {
      getPredictedTrafficLevel: jest.fn().mockReturnValue('moderate'),
      getTrafficDelay: jest.fn().mockReturnValue(1.2),
      getTrafficPattern: jest.fn().mockReturnValue({
        hourly: [0.8, 0.7, 0.6, 0.5, 0.6, 0.8, 1.0, 1.3, 1.5, 1.4, 1.3, 1.2, 1.3, 1.4, 1.3, 1.4, 1.5, 1.6, 1.4, 1.2, 1.0, 0.9, 0.8, 0.7],
        daily: [0.8, 0.9, 1.0, 1.1, 1.2, 1.0, 0.8]
      })
    } as unknown as TrafficPredictionService;
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

    // Initialize with the correct configuration
    mapVisualizationService = new MapVisualizationService({
      mapbox: {
        ...mockMapboxClient,
        accessToken: 'mock-mapbox-token'
      },
      graphHopper: {
        ...mockGraphHopperClient,
        apiKey: 'mock-graphhopper-key'
      }
    });

    routingService = new RoutingService(fleetService, trafficService);

    demoGenerator = new DemoScenarioGenerator(
      mapVisualizationService,
      routingService,
      complianceService
    );

    interactiveDemoService = new InteractiveDemoService(
      demoGenerator,
      complianceService,
      mapVisualizationService,
      routingService
    );
    
    // Create scenarios once for reuse across tests
    delhiComplianceScenario = await interactiveDemoService.createDelhiComplianceDemo();
    hubSpokeScenario = await interactiveDemoService.createHubSpokeDemo();
    breakdownRecoveryScenario = await interactiveDemoService.createBreakdownRecoveryDemo();
    
    // Execute scenarios once
    delhiComplianceExecution = await interactiveDemoService.executeInteractiveDemo(delhiComplianceScenario);
    hubSpokeExecution = await interactiveDemoService.executeInteractiveDemo(hubSpokeScenario);
    breakdownRecoveryExecution = await interactiveDemoService.executeInteractiveDemo(breakdownRecoveryScenario);
  });

  afterAll(async () => {
    await cacheService.disconnect();
  });

  describe('Delhi Compliance Demo Integration', () => {
    it('should execute complete Delhi compliance demo with real compliance validation', async () => {
      // Use the pre-created scenario and execution from beforeAll
     // const scenario = delhiComplianceScenario;
      const execution = delhiComplianceExecution;

      expect(execution).toBeDefined();
      expect(execution.scenario.name).toBe('Delhi Vehicle Class Restriction Compliance Demo');
      expect(execution.complianceResults.size).toBeGreaterThan(0);
      expect(execution.realTimeMetrics).toBeDefined();

      // Verify compliance validation was performed
      const complianceResults = Array.from(execution.complianceResults.values());
      expect(complianceResults.length).toBeGreaterThan(0);
      
      // Check that some violations are expected based on scenario design
      const hasViolations = complianceResults.some((result: any) => !result.isCompliant);
      expect(hasViolations).toBe(true); // Delhi compliance demo should have planned violations
    });

    it('should validate truck time restrictions correctly', async () => {
      const scenario = await interactiveDemoService.createDelhiComplianceDemo();
      
      // Find truck vehicle in scenario
      const truckVehicle = scenario.vehicles.find(v => v.type === 'truck');
      expect(truckVehicle).toBeDefined();

      // Test time restriction validation during restricted hours (2 AM)
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
            registrationState: 'DL',
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
            id: 'driver_1',
            name: 'Test Driver',
            licenseNumber: 'DL123456789',
            workingHours: 8,
            maxWorkingHours: 12,
            contactNumber: '+919876543210'
          },
          lastUpdated: new Date()
        },
        'residential',
        restrictedTime
      );

      expect(timeValidation.isAllowed).toBe(false);
      expect(timeValidation.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
      expect(timeValidation.alternativeTimeWindows).toBeDefined();
      expect(timeValidation.alternativeTimeWindows!.length).toBeGreaterThan(0);
    });

    it('should validate odd-even rule compliance correctly', async () => {
      // Use the pre-created scenario from beforeAll
      
      // Test odd-even compliance for different scenarios
      const oddDate = new Date('2024-01-15'); // Odd date (15th)
      //const evenDate = new Date('2024-01-16'); // Even date (16th)
      
      // Test odd plate on odd date (should be compliant)
      const oddPlateOddDate = complianceService.checkOddEvenCompliance('DL01AB1235', oddDate);
      expect(oddPlateOddDate.isCompliant).toBe(true);
      expect(oddPlateOddDate.isOddPlate).toBe(true);
      expect(oddPlateOddDate.isOddDate).toBe(true);

      // Test even plate on odd date (should be non-compliant)
      const evenPlateOddDate = complianceService.checkOddEvenCompliance('DL01AB1234', oddDate);
      expect(evenPlateOddDate.isCompliant).toBe(false);
      expect(evenPlateOddDate.isOddPlate).toBe(false);
      expect(evenPlateOddDate.isOddDate).toBe(true);

      // Test electric vehicle exemption
      const electricVehicleExemption = complianceService.checkOddEvenCompliance('DL01EV1234', oddDate);
      expect(electricVehicleExemption.isExempt).toBe(true);
      expect(electricVehicleExemption.exemptionReason).toContain('Electric vehicle');
    });

    it('should suggest compliant alternatives for violations', async () => {
      //const scenario = await interactiveDemoService.createDelhiComplianceDemo();
      
      // Create a vehicle with compliance issues
      const problematicVehicle = {
        id: 'PROBLEMATIC_TRUCK',
        type: 'truck' as const,
        subType: 'heavy-truck' as const,
        capacity: { weight: 5000, volume: 20, maxDimensions: { length: 8, width: 2.5, height: 3 } },
        location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
        status: 'available' as const,
        compliance: {
          pollutionCertificate: true,
          pollutionLevel: 'BS6' as const,
          permitValid: true,
          oddEvenCompliant: false,
          zoneRestrictions: [],
          timeRestrictions: []
        },
        vehicleSpecs: {
          plateNumber: 'DL01AB1234', // Even plate
          fuelType: 'diesel' as const,
          vehicleAge: 3,
          registrationState: 'DL',
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
          id: 'driver_problematic',
          name: 'Problematic Driver',
          licenseNumber: 'DL987654321',
          workingHours: 8,
          maxWorkingHours: 12,
          contactNumber: '+919876543210'
        },
        lastUpdated: new Date()
      };

      const oddDate = new Date('2024-01-15'); // Odd date, even plate = violation
      const suggestions = complianceService.suggestCompliantAlternatives(
        problematicVehicle,
        'residential',
        oddDate
      );

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('electric vehicle'))).toBe(true);
      expect(suggestions.some(s => s.includes('CNG vehicle'))).toBe(true);
      expect(suggestions.some(s => s.includes('three-wheeler'))).toBe(true);
    });

    it('should validate expected outcomes against actual results', async () => {
      // Validate expected outcomes
      for (const expectedOutcome of delhiComplianceScenario.expectedOutcomes) {
        const actualValue = delhiComplianceExecution.realTimeMetrics[expectedOutcome.metric];
        
        if (typeof expectedOutcome.expectedValue === 'number' && typeof actualValue === 'number') {
          const tolerance = expectedOutcome.tolerance || 0;
          const lowerBound = expectedOutcome.expectedValue - tolerance;
          const upperBound = expectedOutcome.expectedValue + tolerance;
          
          expect(actualValue).toBeGreaterThanOrEqual(lowerBound);
          expect(actualValue).toBeLessThanOrEqual(upperBound);
        }
      }
    });
  });

  describe('Hub-and-Spoke Demo Integration', () => {
    it('should execute hub-and-spoke demo with multi-hub routing', async () => {
      // Use the pre-created scenario and execution from beforeAll
      const scenario = hubSpokeScenario;
      const execution = hubSpokeExecution;

      expect(execution).toBeDefined();
      expect(execution.scenario.name).toBe('Hub-and-Spoke Operations with Buffer Management Demo');
      
      // Verify hub configuration
      expect(scenario.hubs.length).toBeGreaterThan(1);
      expect(scenario.vehicles.length).toBeGreaterThan(0);
      expect(scenario.deliveries.length).toBeGreaterThan(0);

      // Verify buffer vehicle allocation is configured
      const hubsWithBuffers = scenario.hubs.filter(h => h.bufferVehicles > 0);
      expect(hubsWithBuffers.length).toBeGreaterThan(0);
    });

    it('should simulate breakdown event and buffer allocation', async () => {
      // Use the pre-created scenario and execution from beforeAll
      const scenario = hubSpokeScenario;
      //const execution = hubSpokeExecution;

      // Find breakdown event in scenario
      const breakdownEvent = scenario.events.find(e => e.type === 'breakdown');
      expect(breakdownEvent).toBeDefined();
      expect(breakdownEvent!.vehicleId).toBeDefined();
      expect(breakdownEvent!.impact.severity).toBe('high');

      // Trigger breakdown through control panel
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      
      // Should not throw error
      expect(() => controlPanel.interactionControls.triggerBreakdown(breakdownEvent!.vehicleId!)).not.toThrow();
    });

    it('should validate buffer allocation timing', async () => {
      // Use the pre-created scenario from beforeAll
      const scenario = hubSpokeScenario;
      
      // Check validation rules for buffer allocation
      const bufferAllocationRule = scenario.validationRules.find(r => r.id === 'buffer_allocation_time');
      expect(bufferAllocationRule).toBeDefined();
      expect(bufferAllocationRule!.description).toContain('within 2 minutes');
      expect(bufferAllocationRule!.expectedViolations).toBe(0);

      // Check expected outcomes
      const bufferAllocationOutcome = scenario.expectedOutcomes.find(o => o.metric === 'bufferAllocationTime');
      expect(bufferAllocationOutcome).toBeDefined();
      expect(bufferAllocationOutcome!.expectedValue).toBe(120); // 2 minutes
      expect(bufferAllocationOutcome!.tolerance).toBe(30); // 30 seconds tolerance
    });
  });

  describe('Breakdown Recovery Demo Integration', () => {
    it('should execute breakdown recovery demo with emergency response', async () => {
      // Use the pre-created scenario and execution from beforeAll
      const scenario = breakdownRecoveryScenario;
      const execution = breakdownRecoveryExecution;

      expect(execution).toBeDefined();
      expect(execution.scenario.name).toBe('Real-Time Vehicle Breakdown Recovery Demo');
      
      // Verify emergency response configuration
      expect(scenario.vehicles.some(v => v.id === 'PRIMARY_VEHICLE')).toBe(true);
      expect(scenario.vehicles.some(v => v.id.includes('BUFFER_VEHICLE'))).toBe(true);
      expect(scenario.deliveries.some(d => d.priority === 'urgent')).toBe(true);
    });

    it('should validate emergency response timing', async () => {
      // Use the pre-created scenario from beforeAll
      const scenario = breakdownRecoveryScenario;
      
      // Check validation rules for emergency response
      const emergencyResponseRule = scenario.validationRules.find(r => r.id === 'emergency_response_time');
      expect(emergencyResponseRule).toBeDefined();
      expect(emergencyResponseRule!.description).toContain('within 2 minutes');
      expect(emergencyResponseRule!.expectedViolations).toBe(0);

      // Check expected outcomes
      const recoveryTimeOutcome = scenario.expectedOutcomes.find(o => o.metric === 'recoveryTime');
      expect(recoveryTimeOutcome).toBeDefined();
      expect(recoveryTimeOutcome!.expectedValue).toBe(300); // 5 minutes
      expect(recoveryTimeOutcome!.tolerance).toBe(60); // 1 minute tolerance

      const notificationTimeOutcome = scenario.expectedOutcomes.find(o => o.metric === 'customerNotificationTime');
      expect(notificationTimeOutcome).toBeDefined();
      expect(notificationTimeOutcome!.expectedValue).toBe(30); // 30 seconds
      expect(notificationTimeOutcome!.tolerance).toBe(10); // 10 seconds tolerance
    });

    it('should handle multiple breakdown scenarios', async () => {
      // Use the pre-created scenario from beforeAll
      const scenario = breakdownRecoveryScenario;
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      // Trigger multiple breakdowns
      const primaryVehicle = scenario.vehicles.find(v => v.id === 'PRIMARY_VEHICLE');
      const bufferVehicle = scenario.vehicles.find(v => v.id.includes('BUFFER_VEHICLE'));

      expect(primaryVehicle).toBeDefined();
      expect(bufferVehicle).toBeDefined();

      // Should handle multiple breakdown triggers
      expect(() => controlPanel.interactionControls.triggerBreakdown(primaryVehicle!.id)).not.toThrow();
      expect(() => controlPanel.interactionControls.triggerBreakdown(bufferVehicle!.id)).not.toThrow();
    });
  });

  describe('Interactive Controls Integration', () => {
    it('should handle traffic condition changes across all scenarios', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      // Verify that traffic changes affect metrics (in a real implementation)
      // For now, we just verify the function doesn't throw
      expect(() => controlPanel.interactionControls.changeTrafficCondition('light')).not.toThrow();
      expect(() => controlPanel.interactionControls.changeTrafficCondition('moderate')).not.toThrow();
      expect(() => controlPanel.interactionControls.changeTrafficCondition('heavy')).not.toThrow();
    });

    it('should handle urgent delivery additions', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      const urgentDelivery = {
        id: 'URGENT_DELIVERY_INTEGRATION',
        pickupLocation: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
        deliveryLocation: { latitude: 28.6200, longitude: 77.2150, timestamp: new Date() },
        timeWindow: {
          earliest: new Date(),
          latest: new Date(Date.now() + 1800000) // 30 minutes from now
        },
        shipment: {
          weight: 200,
          volume: 1,
          fragile: true,
          specialHandling: ['urgent', 'fragile'],
          hazardous: false,
          temperatureControlled: false
        },
        priority: 'urgent' as const
      };

      // Should handle urgent delivery addition
      expect(() => controlPanel.interactionControls.addUrgentDelivery(urgentDelivery)).not.toThrow();
    });

    it('should handle vehicle status modifications', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      const vehicleId = delhiComplianceScenario.vehicles[0].id;

      // Test different status changes
      expect(() => controlPanel.interactionControls.modifyVehicleStatus(vehicleId, 'maintenance')).not.toThrow();
      expect(() => controlPanel.interactionControls.modifyVehicleStatus(vehicleId, 'breakdown')).not.toThrow();
      expect(() => controlPanel.interactionControls.modifyVehicleStatus(vehicleId, 'in-transit')).not.toThrow();
      expect(() => controlPanel.interactionControls.modifyVehicleStatus(vehicleId, 'available')).not.toThrow();
    });
  });

  describe('Real-Time Metrics Integration', () => {
    it('should calculate accurate compliance rates', async () => {
      expect(delhiComplianceExecution.realTimeMetrics.complianceRate).toBeGreaterThanOrEqual(0);
      expect(delhiComplianceExecution.realTimeMetrics.complianceRate).toBeLessThanOrEqual(100);
      expect(delhiComplianceExecution.realTimeMetrics.violationCount).toBeGreaterThanOrEqual(0);
      expect(delhiComplianceExecution.realTimeMetrics.routeEfficiency).toBeGreaterThanOrEqual(0);
      expect(delhiComplianceExecution.realTimeMetrics.fuelSavings).toBeGreaterThanOrEqual(0);
    });

    it('should maintain metric consistency across scenario types', async () => {
      const allExecutions = [
        delhiComplianceExecution,
        hubSpokeExecution,
        breakdownRecoveryExecution
      ];

      // All executions should have valid metrics
      allExecutions.forEach(execution => {
        expect(execution.realTimeMetrics.complianceRate).toBeGreaterThanOrEqual(0);
        expect(execution.realTimeMetrics.complianceRate).toBeLessThanOrEqual(100);
        expect(execution.realTimeMetrics.violationCount).toBeGreaterThanOrEqual(0);
        expect(execution.realTimeMetrics.routeEfficiency).toBeGreaterThanOrEqual(0);
        expect(execution.realTimeMetrics.fuelSavings).toBeGreaterThanOrEqual(0);
        expect(execution.realTimeMetrics.averageDeliveryTime).toBeGreaterThan(0);
        expect(execution.realTimeMetrics.bufferVehicleUsage).toBeGreaterThanOrEqual(0);
        expect(execution.realTimeMetrics.customerSatisfaction).toBeGreaterThanOrEqual(0);
        expect(execution.realTimeMetrics.customerSatisfaction).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle concurrent demo executions efficiently', async () => {
      const startTime = Date.now();

      // Create deep copies of pre-created scenarios to avoid modifying originals
      const delhiCopy = JSON.parse(JSON.stringify(delhiComplianceScenario));
      const hubSpokeCopy = JSON.parse(JSON.stringify(hubSpokeScenario));
      const breakdownCopy = JSON.parse(JSON.stringify(breakdownRecoveryScenario));
      
      const concurrentExecutions = await Promise.all([
        interactiveDemoService.executeInteractiveDemo(delhiCopy),
        interactiveDemoService.executeInteractiveDemo(hubSpokeCopy),
        interactiveDemoService.executeInteractiveDemo(breakdownCopy)
      ]);

      const executionTime = Date.now() - startTime;

      expect(concurrentExecutions).toHaveLength(3);
      expect(concurrentExecutions.every(exec => exec.realTimeMetrics)).toBe(true);
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should maintain performance with complex scenarios', async () => {
      // Start with a copy of our pre-created scenario
      const complexScenario = { ...delhiComplianceScenario };
      
      // Add complexity by modifying scenario
      complexScenario.vehicles = Array.from({ length: 20 }, (_, i) => ({
        id: `COMPLEX_VEHICLE_${i}`,
        type: ['truck', 'tempo', 'van', 'three-wheeler', 'electric'][i % 5] as any,
        location: [77.2090 + (i * 0.001), 28.6139 + (i * 0.001)],
        status: 'available',
        plateNumber: `DL01AB${1000 + i}`,
        fuelType: ['diesel', 'petrol', 'cng', 'electric'][i % 4] as any,
        pollutionLevel: ['BS6', 'BS4', 'electric'][i % 3] as any
      })) as any[];

      complexScenario.deliveries = Array.from({ length: 50 }, (_, i) => ({
        id: `COMPLEX_DELIVERY_${i}`,
        pickupLocation: [77.2090, 28.6139],
        deliveryLocation: [77.2100 + (i * 0.001), 28.6150 + (i * 0.001)],
        weight: 100 + (i * 50),
        volume: 1 + (i * 0.5),
        timeWindow: { earliest: '08:00', latest: '20:00' },
        priority: ['low', 'medium', 'high', 'urgent'][i % 4] as any
      })) as any[];

      const startTime = Date.now();
      const complexExecution = await interactiveDemoService.executeInteractiveDemo(complexScenario);
      const executionTime = Date.now() - startTime;

      expect(complexExecution).toBeDefined();
      expect(complexExecution.complianceResults.size).toBe(20);
      expect(executionTime).toBeLessThan(20000); // Should complete within 20 seconds
    });
  });

  describe('Error Handling and Recovery Integration', () => {
    it('should handle compliance service failures gracefully', async () => {
      // Use the pre-created scenario from beforeAll
      const scenario = { ...delhiComplianceScenario };
      
      // Mock compliance service failure
      const originalValidateVehicleMovement = complianceService.validateVehicleMovement;
      complianceService.validateVehicleMovement = jest.fn().mockRejectedValue(new Error('Compliance service unavailable'));

      await expect(interactiveDemoService.executeInteractiveDemo(scenario))
        .rejects.toThrow('Compliance service unavailable');

      // Restore original method
      complianceService.validateVehicleMovement = originalValidateVehicleMovement;
    });

    it('should handle invalid user interactions gracefully', async () => {
      // Use the pre-created scenario and execution from beforeAll
     // const scenario = delhiComplianceScenario;
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      // Test invalid vehicle IDs
      expect(() => controlPanel.interactionControls.triggerBreakdown('INVALID_VEHICLE_ID')).not.toThrow();
      expect(() => controlPanel.interactionControls.modifyVehicleStatus('INVALID_VEHICLE_ID', 'breakdown')).not.toThrow();

      // Test invalid traffic conditions
      expect(() => controlPanel.interactionControls.changeTrafficCondition('invalid' as any)).not.toThrow();
    });

    it('should recover from partial execution failures', async () => {
      // Clone the pre-created scenario to avoid modifying the original
      const scenario = JSON.parse(JSON.stringify(hubSpokeScenario));
      
      // Modify scenario to have some invalid data
      scenario.vehicles.push({
        id: 'INVALID_VEHICLE',
        type: 'invalid_type' as any,
        location: [NaN, NaN],
        status: 'invalid_status' as any
      });

      // Should still execute successfully despite invalid data
      const execution = await interactiveDemoService.executeInteractiveDemo(scenario);
      expect(execution).toBeDefined();
      expect(execution.realTimeMetrics).toBeDefined();
    });
  });

  describe('Data Consistency and Validation Integration', () => {
    it('should maintain data consistency across demo lifecycle', async () => {
      // Use the pre-created scenario and execution from beforeAll
      const scenario = delhiComplianceScenario;
      const execution = delhiComplianceExecution;

      // Verify vehicle count consistency
      expect(execution.complianceResults.size).toBe(scenario.vehicles.length);

      // Verify scenario data integrity
      expect(execution.scenario.name).toBe(scenario.name);
      expect(execution.scenario.vehicles.length).toBe(scenario.vehicles.length);
      expect(execution.scenario.deliveries.length).toBe(scenario.deliveries.length);
      expect(execution.scenario.hubs.length).toBe(scenario.hubs.length);
    });

    it('should validate scenario configuration completeness', async () => {
      // Use the pre-created scenarios from beforeAll
      const scenarios = [
        delhiComplianceScenario,
        hubSpokeScenario,
        breakdownRecoveryScenario
      ];

      scenarios.forEach(scenario => {
        // All scenarios should have required fields
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(scenario.duration).toBeGreaterThan(0);
        expect(scenario.timeAcceleration).toBeGreaterThan(0);
        expect(scenario.centerLocation).toHaveLength(2);
        expect(scenario.vehicles.length).toBeGreaterThan(0);
        expect(scenario.hubs.length).toBeGreaterThan(0);
        expect(scenario.deliveries.length).toBeGreaterThan(0);
        expect(scenario.interactiveFeatures).toBeDefined();
        expect(scenario.validationRules).toBeDefined();
        expect(scenario.expectedOutcomes).toBeDefined();
      });
    });

    it('should validate compliance results accuracy', async () => {
      // Use the pre-created scenario and execution from beforeAll
      const scenario = delhiComplianceScenario;
      const execution = delhiComplianceExecution;

      // Verify compliance results structure
      execution.complianceResults.forEach((result, vehicleId) => {
        expect(result.isCompliant).toBeDefined();
        expect(result.violations).toBeDefined();
        expect(result.warnings).toBeDefined();
        expect(result.suggestedActions).toBeDefined();
        expect(result.alternativeOptions).toBeDefined();
        
        // Verify vehicle ID consistency
        expect(scenario.vehicles.some(v => v.id === vehicleId)).toBe(true);
      });
    });
  });
});
