/**
 * Comprehensive tests for Interactive Demo Service
 * Tests Delhi-specific demo scenarios with compliance validation and interactive features
 */

import { InteractiveDemoService, InteractiveDemoScenario} from '../InteractiveDemoService';
import { DemoScenarioGenerator } from '../DemoScenarioGenerator';
import { DelhiComplianceService } from '../DelhiComplianceService';
import { MapVisualizationService } from '../MapVisualizationService';
import { RoutingService } from '../RoutingService';

// Mock dependencies
jest.mock('../DemoScenarioGenerator');
jest.mock('../DelhiComplianceService');
jest.mock('../MapVisualizationService');
jest.mock('../RoutingService');

describe('InteractiveDemoService', () => {
  let interactiveDemoService: InteractiveDemoService;
  let mockDemoGenerator: jest.Mocked<DemoScenarioGenerator>;
  let mockComplianceService: jest.Mocked<DelhiComplianceService>;
  let mockMapVisualizationService: jest.Mocked<MapVisualizationService>;
  let mockRoutingService: jest.Mocked<RoutingService>;

  beforeEach(() => {
    mockDemoGenerator = new DemoScenarioGenerator({} as any, {} as any, {} as any) as jest.Mocked<DemoScenarioGenerator>;
    mockComplianceService = new DelhiComplianceService() as jest.Mocked<DelhiComplianceService>;
    mockMapVisualizationService = new MapVisualizationService({} as any) as jest.Mocked<MapVisualizationService>;
    mockRoutingService = new RoutingService({} as any, {} as any) as jest.Mocked<RoutingService>;

    interactiveDemoService = new InteractiveDemoService(
      mockDemoGenerator,
      mockComplianceService,
      mockMapVisualizationService,
      mockRoutingService
    );

    // Setup default mocks
    mockDemoGenerator.generatePredefinedScenario.mockResolvedValue({
      name: 'Test Scenario',
      description: 'Test scenario',
      duration: 600,
      timeAcceleration: 10,
      centerLocation: [77.2090, 28.6139],
      vehicles: [
        {
          id: 'TRUCK_DL01AB1234',
          type: 'truck',
          location: [77.2090, 28.6139],
          status: 'available',
          plateNumber: 'DL01AB1234',
          fuelType: 'diesel',
          pollutionLevel: 'BS6'
        }
      ],
      hubs: [
        {
          id: 'HUB_CENTRAL',
          name: 'Central Hub',
          location: [77.2090, 28.6139],
          capacity: 50,
          bufferVehicles: 5
        }
      ],
      deliveries: [
        {
          id: 'DELIVERY_1',
          pickupLocation: [77.2090, 28.6139],
          deliveryLocation: [77.2100, 28.6150],
          weight: 1000,
          volume: 5,
          timeWindow: { earliest: '09:00', latest: '17:00' },
          priority: 'medium'
        }
      ],
      events: []
    });

    mockDemoGenerator.executeDemoScenario.mockResolvedValue({
      animationFrames: [],
      finalState: {
        currentTime: 600,
        vehiclePositions: new Map([['TRUCK_DL01AB1234', [77.2090, 28.6139]]]),
        routeProgress: new Map([['route_1', 1.0]]),
        activeEvents: [],
        completedDeliveries: ['DELIVERY_1'],
        metrics: {
          totalDistance: 15000,
          totalTime: 600,
          fuelConsumed: 5.0,
          complianceViolations: 0,
          efficiencyScore: 85
        }
      },
      summary: {
        totalDeliveries: 1,
        successfulDeliveries: 1,
        averageDeliveryTime: 600,
        fuelEfficiency: 3000,
        complianceRate: 100
      }
    });

    mockComplianceService.validateVehicleMovement.mockResolvedValue({
      isCompliant: true,
      violations: [],
      warnings: [],
      suggestedActions: [],
      alternativeOptions: {
        alternativeVehicles: [],
        alternativeTimeWindows: [],
        alternativeRoutes: [],
        loadSplittingOptions: []
      }
    });
  });

  describe('Delhi Compliance Demo Creation', () => {
    it('should create comprehensive Delhi compliance demo scenario', async () => {
      const scenario = await interactiveDemoService.createDelhiComplianceDemo();

      expect(scenario.name).toBe('Delhi Vehicle Class Restriction Compliance Demo');
      expect(scenario.description).toContain('Delhi-specific vehicle movement restrictions');
      
      // Check interactive features
      expect(scenario.interactiveFeatures.complianceValidation).toBe(true);
      expect(scenario.interactiveFeatures.realTimeBreakdowns).toBe(true);
      expect(scenario.interactiveFeatures.trafficSimulation).toBe(true);
      expect(scenario.interactiveFeatures.userControls).toBe(true);
    });

    it('should include comprehensive validation rules', async () => {
      const scenario = await interactiveDemoService.createDelhiComplianceDemo();

      expect(scenario.validationRules).toHaveLength(4);
      
      const truckTimeRestriction = scenario.validationRules.find(r => r.id === 'truck_time_restriction');
      expect(truckTimeRestriction).toBeDefined();
      expect(truckTimeRestriction!.type).toBe('time_restriction');
      expect(truckTimeRestriction!.vehicleTypes).toContain('truck');
      expect(truckTimeRestriction!.zoneTypes).toContain('residential');
      expect(truckTimeRestriction!.expectedViolations).toBe(1);

      const oddEvenRule = scenario.validationRules.find(r => r.id === 'odd_even_rule');
      expect(oddEvenRule).toBeDefined();
      expect(oddEvenRule!.type).toBe('odd_even');
      expect(oddEvenRule!.expectedViolations).toBe(1);

      const pollutionZoneAccess = scenario.validationRules.find(r => r.id === 'pollution_zone_access');
      expect(pollutionZoneAccess).toBeDefined();
      expect(pollutionZoneAccess!.type).toBe('pollution_zone');
      expect(pollutionZoneAccess!.vehicleTypes).toContain('electric');

      const narrowLaneAccess = scenario.validationRules.find(r => r.id === 'narrow_lane_access');
      expect(narrowLaneAccess).toBeDefined();
      expect(narrowLaneAccess!.type).toBe('vehicle_class');
      expect(narrowLaneAccess!.vehicleTypes).toContain('three-wheeler');
    });

    it('should define expected outcomes with tolerances', async () => {
      const scenario = await interactiveDemoService.createDelhiComplianceDemo();

      expect(scenario.expectedOutcomes).toHaveLength(3);
      
      const complianceRateOutcome = scenario.expectedOutcomes.find(o => o.metric === 'complianceRate');
      expect(complianceRateOutcome).toBeDefined();
      expect(complianceRateOutcome!.expectedValue).toBe(75);
      expect(complianceRateOutcome!.tolerance).toBe(10);

      const violationCountOutcome = scenario.expectedOutcomes.find(o => o.metric === 'violationCount');
      expect(violationCountOutcome).toBeDefined();
      expect(violationCountOutcome!.expectedValue).toBe(2);
      expect(violationCountOutcome!.tolerance).toBe(1);

      const alternativeSuggestionsOutcome = scenario.expectedOutcomes.find(o => o.metric === 'alternativeSuggestions');
      expect(alternativeSuggestionsOutcome).toBeDefined();
      expect(alternativeSuggestionsOutcome!.expectedValue).toBe(4);
      expect(alternativeSuggestionsOutcome!.tolerance).toBe(2);
    });
  });

  describe('Hub-and-Spoke Demo Creation', () => {
    it('should create hub-and-spoke operations demo scenario', async () => {
      const scenario = await interactiveDemoService.createHubSpokeDemo();

      expect(scenario.name).toBe('Hub-and-Spoke Operations with Buffer Management Demo');
      expect(scenario.description).toContain('multi-hub routing');
      
      // Check interactive features (compliance validation should be false for this scenario)
      expect(scenario.interactiveFeatures.complianceValidation).toBe(false);
      expect(scenario.interactiveFeatures.realTimeBreakdowns).toBe(true);
      expect(scenario.interactiveFeatures.trafficSimulation).toBe(true);
      expect(scenario.interactiveFeatures.userControls).toBe(true);
    });

    it('should include buffer allocation validation rules', async () => {
      const scenario = await interactiveDemoService.createHubSpokeDemo();

      expect(scenario.validationRules).toHaveLength(1);
      
      const bufferAllocationRule = scenario.validationRules[0];
      expect(bufferAllocationRule.id).toBe('buffer_allocation_time');
      expect(bufferAllocationRule.type).toBe('vehicle_class');
      expect(bufferAllocationRule.description).toContain('Buffer vehicle allocation should occur within 2 minutes');
      expect(bufferAllocationRule.expectedViolations).toBe(0);
    });

    it('should define performance-focused expected outcomes', async () => {
      const scenario = await interactiveDemoService.createHubSpokeDemo();

      expect(scenario.expectedOutcomes).toHaveLength(3);
      
      const bufferAllocationTime = scenario.expectedOutcomes.find(o => o.metric === 'bufferAllocationTime');
      expect(bufferAllocationTime).toBeDefined();
      expect(bufferAllocationTime!.expectedValue).toBe(120);
      expect(bufferAllocationTime!.tolerance).toBe(30);

      const routeReoptimizationTime = scenario.expectedOutcomes.find(o => o.metric === 'routeReoptimizationTime');
      expect(routeReoptimizationTime).toBeDefined();
      expect(routeReoptimizationTime!.expectedValue).toBe(30);
      expect(routeReoptimizationTime!.tolerance).toBe(10);

      const deliveryCompletionRate = scenario.expectedOutcomes.find(o => o.metric === 'deliveryCompletionRate');
      expect(deliveryCompletionRate).toBeDefined();
      expect(deliveryCompletionRate!.expectedValue).toBe(100);
      expect(deliveryCompletionRate!.tolerance).toBe(0);
    });
  });

  describe('Breakdown Recovery Demo Creation', () => {
    it('should create breakdown recovery demo scenario', async () => {
      const scenario = await interactiveDemoService.createBreakdownRecoveryDemo();

      expect(scenario.name).toBe('Real-Time Vehicle Breakdown Recovery Demo');
      expect(scenario.description).toContain('vehicle breakdown scenarios');
      
      // Check interactive features
      expect(scenario.interactiveFeatures.complianceValidation).toBe(true);
      expect(scenario.interactiveFeatures.realTimeBreakdowns).toBe(true);
      expect(scenario.interactiveFeatures.trafficSimulation).toBe(false);
      expect(scenario.interactiveFeatures.userControls).toBe(true);
    });

    it('should include emergency response validation rules', async () => {
      const scenario = await interactiveDemoService.createBreakdownRecoveryDemo();

      expect(scenario.validationRules).toHaveLength(1);
      
      const emergencyResponseRule = scenario.validationRules[0];
      expect(emergencyResponseRule.id).toBe('emergency_response_time');
      expect(emergencyResponseRule.type).toBe('vehicle_class');
      expect(emergencyResponseRule.description).toContain('Emergency response and buffer allocation within 2 minutes');
      expect(emergencyResponseRule.expectedViolations).toBe(0);
    });

    it('should define recovery-focused expected outcomes', async () => {
      const scenario = await interactiveDemoService.createBreakdownRecoveryDemo();

      expect(scenario.expectedOutcomes).toHaveLength(2);
      
      const recoveryTime = scenario.expectedOutcomes.find(o => o.metric === 'recoveryTime');
      expect(recoveryTime).toBeDefined();
      expect(recoveryTime!.expectedValue).toBe(300);
      expect(recoveryTime!.tolerance).toBe(60);

      const customerNotificationTime = scenario.expectedOutcomes.find(o => o.metric === 'customerNotificationTime');
      expect(customerNotificationTime).toBeDefined();
      expect(customerNotificationTime!.expectedValue).toBe(30);
      expect(customerNotificationTime!.tolerance).toBe(10);
    });
  });

  describe('Interactive Demo Execution', () => {
    let mockScenario: InteractiveDemoScenario;

    beforeEach(() => {
      mockScenario = {
        name: 'Test Interactive Scenario',
        description: 'Test scenario for interactive execution',
        duration: 600,
        timeAcceleration: 10,
        centerLocation: [77.2090, 28.6139],
        vehicles: [
          {
            id: 'TEST_VEHICLE_1',
            type: 'truck',
            location: [77.2090, 28.6139],
            status: 'available',
            plateNumber: 'DL01AB1234',
            fuelType: 'diesel',
            pollutionLevel: 'BS6'
          }
        ],
        hubs: [
          {
            id: 'TEST_HUB',
            name: 'Test Hub',
            location: [77.2090, 28.6139],
            capacity: 10,
            bufferVehicles: 2
          }
        ],
        deliveries: [
          {
            id: 'TEST_DELIVERY',
            pickupLocation: [77.2090, 28.6139],
            deliveryLocation: [77.2100, 28.6150],
            weight: 1000,
            volume: 5,
            timeWindow: { earliest: '09:00', latest: '17:00' },
            priority: 'medium'
          }
        ],
        events: [],
        interactiveFeatures: {
          complianceValidation: true,
          realTimeBreakdowns: true,
          trafficSimulation: true,
          userControls: true
        },
        validationRules: [],
        expectedOutcomes: []
      };
    });

    it('should execute interactive demo scenario successfully', async () => {
      const execution = await interactiveDemoService.executeInteractiveDemo(mockScenario);

      expect(execution).toBeDefined();
      expect(execution.scenario).toEqual(mockScenario);
      expect(execution.currentState).toBeDefined();
      expect(execution.complianceResults).toBeDefined();
      expect(execution.userInteractions).toEqual([]);
      expect(execution.realTimeMetrics).toBeDefined();
    });

    it('should validate compliance for all vehicles', async () => {
      const execution = await interactiveDemoService.executeInteractiveDemo(mockScenario);

      expect(mockComplianceService.validateVehicleMovement).toHaveBeenCalledTimes(1);
      expect(execution.complianceResults.size).toBe(1);
      expect(execution.complianceResults.has('TEST_VEHICLE_1')).toBe(true);
    });

    it('should calculate real-time metrics correctly', async () => {
      const execution = await interactiveDemoService.executeInteractiveDemo(mockScenario);

      expect(execution.realTimeMetrics.complianceRate).toBe(100);
      expect(execution.realTimeMetrics.violationCount).toBe(0);
      expect(execution.realTimeMetrics.routeEfficiency).toBe(100);
      expect(execution.realTimeMetrics.fuelSavings).toBe(25);
      expect(execution.realTimeMetrics.bufferVehicleUsage).toBe(0);
      expect(execution.realTimeMetrics.customerSatisfaction).toBe(100);
    });

    it('should handle compliance violations in metrics calculation', async () => {
      // Mock compliance service to return violations
      mockComplianceService.validateVehicleMovement.mockResolvedValue({
        isCompliant: false,
        violations: [
          {
            type: 'time_restriction',
            description: 'Vehicle not allowed during restricted hours',
            severity: 'high',
            penalty: 5000,
            location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
            timestamp: new Date()
          }
        ],
        warnings: [],
        suggestedActions: ['Use alternative vehicle'],
        alternativeOptions: {
          alternativeVehicles: [],
          alternativeTimeWindows: [],
          alternativeRoutes: [],
          loadSplittingOptions: []
        }
      });

      const execution = await interactiveDemoService.executeInteractiveDemo(mockScenario);

      expect(execution.realTimeMetrics.complianceRate).toBe(0);
      expect(execution.realTimeMetrics.violationCount).toBe(1);
      expect(execution.realTimeMetrics.routeEfficiency).toBe(95); // 100 - (1 * 5)
      expect(execution.realTimeMetrics.fuelSavings).toBe(23); // 25 - (1 * 2)
      expect(execution.realTimeMetrics.customerSatisfaction).toBe(97); // 100 - (1 * 3)
    });
  });

  describe('Demo Control Panel', () => {
    it('should create comprehensive demo control panel', () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      expect(controlPanel).toBeDefined();
      expect(controlPanel.scenarios).toHaveLength(3);
      expect(controlPanel.playbackControls).toBeDefined();
      expect(controlPanel.interactionControls).toBeDefined();
      expect(controlPanel.complianceMonitor).toBeDefined();
    });

    it('should include all predefined scenarios', () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      const scenarioIds = controlPanel.scenarios.map(s => s.id);
      expect(scenarioIds).toContain('delhi_compliance');
      expect(scenarioIds).toContain('hub_spoke');
      expect(scenarioIds).toContain('breakdown_recovery');

      // Check scenario details
      const delhiComplianceScenario = controlPanel.scenarios.find(s => s.id === 'delhi_compliance');
      expect(delhiComplianceScenario).toBeDefined();
      expect(delhiComplianceScenario!.name).toBe('Delhi Compliance Demo');
      expect(delhiComplianceScenario!.difficulty).toBe('intermediate');
      expect(delhiComplianceScenario!.estimatedDuration).toBe(600);

      const hubSpokeScenario = controlPanel.scenarios.find(s => s.id === 'hub_spoke');
      expect(hubSpokeScenario).toBeDefined();
      expect(hubSpokeScenario!.difficulty).toBe('advanced');
      expect(hubSpokeScenario!.estimatedDuration).toBe(900);

      const breakdownRecoveryScenario = controlPanel.scenarios.find(s => s.id === 'breakdown_recovery');
      expect(breakdownRecoveryScenario).toBeDefined();
      expect(breakdownRecoveryScenario!.difficulty).toBe('beginner');
      expect(breakdownRecoveryScenario!.estimatedDuration).toBe(480);
    });

    it('should provide functional playback controls', () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      expect(controlPanel.playbackControls.isPlaying).toBe(false);
      expect(controlPanel.playbackControls.currentTime).toBe(0);
      expect(controlPanel.playbackControls.totalDuration).toBe(600);
      expect(controlPanel.playbackControls.speed).toBe(1);
      expect(controlPanel.playbackControls.canPause).toBe(true);
      expect(controlPanel.playbackControls.canRestart).toBe(true);
    });

    it('should provide interactive control functions', () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      expect(typeof controlPanel.interactionControls.triggerBreakdown).toBe('function');
      expect(typeof controlPanel.interactionControls.changeTrafficCondition).toBe('function');
      expect(typeof controlPanel.interactionControls.addUrgentDelivery).toBe('function');
      expect(typeof controlPanel.interactionControls.modifyVehicleStatus).toBe('function');
    });

    it('should initialize compliance monitor', () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();

      expect(controlPanel.complianceMonitor.activeViolations).toEqual([]);
      expect(controlPanel.complianceMonitor.suggestedActions).toEqual([]);
      expect(controlPanel.complianceMonitor.alternativeOptions).toEqual([]);
    });
  });

  describe('Interactive Controls', () => {
    let mockScenario: InteractiveDemoScenario;

    beforeEach(async () => {
      mockScenario = await interactiveDemoService.createDelhiComplianceDemo();
      await interactiveDemoService.executeInteractiveDemo(mockScenario);
    });

    it('should trigger vehicle breakdown and update metrics', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      
      // This should not throw an error
      expect(() => controlPanel.interactionControls.triggerBreakdown('TRUCK_DL01AB1234')).not.toThrow();
    });

    it('should change traffic conditions and impact metrics', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      
      // Test different traffic severities
      expect(() => controlPanel.interactionControls.changeTrafficCondition('light')).not.toThrow();
      expect(() => controlPanel.interactionControls.changeTrafficCondition('moderate')).not.toThrow();
      expect(() => controlPanel.interactionControls.changeTrafficCondition('heavy')).not.toThrow();
    });

    it('should add urgent delivery and trigger re-optimization', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      
      const urgentDelivery = {
        id: 'URGENT_DELIVERY_1',
        pickupLocation: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
        deliveryLocation: { latitude: 28.6200, longitude: 77.2150, timestamp: new Date() },
        timeWindow: {
          earliest: new Date(),
          latest: new Date(Date.now() + 3600000) // 1 hour from now
        },
        shipment: {
          weight: 500,
          volume: 2,
          fragile: true,
          specialHandling: ['urgent']
        },
        priority: 'urgent' as const
      };

      expect(() => controlPanel.interactionControls.addUrgentDelivery(urgentDelivery)).not.toThrow();
    });

    it('should modify vehicle status and update execution state', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      
      expect(() => controlPanel.interactionControls.modifyVehicleStatus('TRUCK_DL01AB1234', 'maintenance')).not.toThrow();
      expect(() => controlPanel.interactionControls.modifyVehicleStatus('TRUCK_DL01AB1234', 'breakdown')).not.toThrow();
      expect(() => controlPanel.interactionControls.modifyVehicleStatus('TRUCK_DL01AB1234', 'available')).not.toThrow();
    });
  });

  describe('Vehicle Model Conversion', () => {
    it('should convert demo vehicles to full vehicle models correctly', async () => {
      const mockScenario = await interactiveDemoService.createDelhiComplianceDemo();
      
      // Execute scenario to trigger vehicle conversion
      await interactiveDemoService.executeInteractiveDemo(mockScenario);

      // Verify that compliance service was called with properly converted vehicles
      expect(mockComplianceService.validateVehicleMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
          subType: expect.any(String),
          capacity: expect.objectContaining({
            weight: expect.any(Number),
            volume: expect.any(Number),
            maxDimensions: expect.objectContaining({
              length: expect.any(Number),
              width: expect.any(Number),
              height: expect.any(Number)
            })
          }),
          location: expect.objectContaining({
            latitude: expect.any(Number),
            longitude: expect.any(Number),
            timestamp: expect.any(Date)
          }),
          vehicleSpecs: expect.objectContaining({
            plateNumber: expect.any(String),
            fuelType: expect.any(String),
            vehicleAge: expect.any(Number),
            registrationState: expect.any(String),
            manufacturingYear: expect.any(Number)
          }),
          accessPrivileges: expect.objectContaining({
            residentialZones: expect.any(Boolean),
            commercialZones: expect.any(Boolean),
            industrialZones: expect.any(Boolean),
            restrictedHours: expect.any(Boolean),
            pollutionSensitiveZones: expect.any(Boolean),
            narrowLanes: expect.any(Boolean)
          }),
          driverInfo: expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            licenseNumber: expect.any(String),
            workingHours: expect.any(Number),
            maxWorkingHours: expect.any(Number),
            contactNumber: expect.any(String)
          })
        }),
        expect.any(Object),
        expect.any(Date)
      );
    });

    it('should assign correct subtypes for different vehicle types', () => {
      const service = interactiveDemoService as any;
      
      expect(service.getSubType('truck')).toBe('heavy-truck');
      expect(service.getSubType('tempo')).toBe('tempo-traveller');
      expect(service.getSubType('van')).toBe('pickup-van');
      expect(service.getSubType('three-wheeler')).toBe('auto-rickshaw');
      expect(service.getSubType('electric')).toBe('e-rickshaw');
      expect(service.getSubType('unknown')).toBe('unknown');
    });

    it('should assign correct capacities for different vehicle types', () => {
      const service = interactiveDemoService as any;
      
      expect(service.getVehicleCapacity('truck')).toEqual({ weight: 5000, volume: 20 });
      expect(service.getVehicleCapacity('tempo')).toEqual({ weight: 1500, volume: 8 });
      expect(service.getVehicleCapacity('van')).toEqual({ weight: 1000, volume: 6 });
      expect(service.getVehicleCapacity('three-wheeler')).toEqual({ weight: 300, volume: 2 });
      expect(service.getVehicleCapacity('electric')).toEqual({ weight: 250, volume: 1.5 });
      expect(service.getVehicleCapacity('unknown')).toEqual({ weight: 1000, volume: 5 });
    });

    it('should assign correct access privileges for different vehicle types', () => {
      const service = interactiveDemoService as any;
      
      const truckPrivileges = service.getAccessPrivileges('truck');
      expect(truckPrivileges.residentialZones).toBe(false);
      expect(truckPrivileges.narrowLanes).toBe(false);
      expect(truckPrivileges.commercialZones).toBe(true);

      const threeWheelerPrivileges = service.getAccessPrivileges('three-wheeler');
      expect(threeWheelerPrivileges.residentialZones).toBe(true);
      expect(threeWheelerPrivileges.narrowLanes).toBe(true);
      expect(threeWheelerPrivileges.pollutionSensitiveZones).toBe(true);

      const electricPrivileges = service.getAccessPrivileges('electric');
      expect(electricPrivileges.residentialZones).toBe(true);
      expect(electricPrivileges.narrowLanes).toBe(true);
      expect(electricPrivileges.pollutionSensitiveZones).toBe(true);
      expect(electricPrivileges.restrictedHours).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle demo generator failures gracefully', async () => {
      mockDemoGenerator.generatePredefinedScenario.mockRejectedValue(new Error('Demo generation failed'));

      await expect(interactiveDemoService.createDelhiComplianceDemo())
        .rejects.toThrow('Demo generation failed');
    });

    it('should handle demo execution failures gracefully', async () => {
      mockDemoGenerator.executeDemoScenario.mockRejectedValue(new Error('Demo execution failed'));

      const scenario = await interactiveDemoService.createDelhiComplianceDemo();
      
      await expect(interactiveDemoService.executeInteractiveDemo(scenario))
        .rejects.toThrow('Demo execution failed');
    });

    it('should handle compliance validation failures gracefully', async () => {
      mockComplianceService.validateVehicleMovement.mockRejectedValue(new Error('Compliance validation failed'));

      const scenario = await interactiveDemoService.createDelhiComplianceDemo();
      
      await expect(interactiveDemoService.executeInteractiveDemo(scenario))
        .rejects.toThrow('Compliance validation failed');
    });

    it('should handle invalid vehicle breakdown triggers', async () => {
      const controlPanel = interactiveDemoService.createDemoControlPanel();
      
      // Should not throw error for non-existent vehicle
      expect(() => controlPanel.interactionControls.triggerBreakdown('NON_EXISTENT_VEHICLE')).not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent demo executions', async () => {
      const scenarios = await Promise.all([
        interactiveDemoService.createDelhiComplianceDemo(),
        interactiveDemoService.createHubSpokeDemo(),
        interactiveDemoService.createBreakdownRecoveryDemo()
      ]);

      const startTime = Date.now();
      const executions = await Promise.all(
        scenarios.map(scenario => interactiveDemoService.executeInteractiveDemo(scenario))
      );
      const executionTime = Date.now() - startTime;

      expect(executions).toHaveLength(3);
      expect(executions.every(exec => exec.realTimeMetrics)).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance with large number of vehicles', async () => {
      // Mock scenario with many vehicles
      mockDemoGenerator.generatePredefinedScenario.mockResolvedValue({
        name: 'Large Scale Test',
        description: 'Test with many vehicles',
        duration: 600,
        timeAcceleration: 10,
        centerLocation: [77.2090, 28.6139],
        vehicles: Array.from({ length: 50 }, (_, i) => ({
          id: `VEHICLE_${i}`,
          type: 'truck',
          location: [77.2090 + (i * 0.001), 28.6139 + (i * 0.001)],
          status: 'available',
          plateNumber: `DL01AB${1000 + i}`,
          fuelType: 'diesel',
          pollutionLevel: 'BS6'
        })),
        hubs: [
          {
            id: 'LARGE_HUB',
            name: 'Large Hub',
            location: [77.2090, 28.6139],
            capacity: 100,
            bufferVehicles: 10
          }
        ],
        deliveries: Array.from({ length: 100 }, (_, i) => ({
          id: `DELIVERY_${i}`,
          pickupLocation: [77.2090, 28.6139],
          deliveryLocation: [77.2100 + (i * 0.001), 28.6150 + (i * 0.001)],
          weight: 1000,
          volume: 5,
          timeWindow: { earliest: '09:00', latest: '17:00' },
          priority: 'medium'
        })),
        events: []
      });

      const scenario = await interactiveDemoService.createDelhiComplianceDemo();
      
      const startTime = Date.now();
      const execution = await interactiveDemoService.executeInteractiveDemo(scenario);
      const executionTime = Date.now() - startTime;

      expect(execution).toBeDefined();
      expect(execution.complianceResults.size).toBe(50);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});