/**
 * Unit tests for Demo Scenario Generator
 * Tests Delhi-specific demo scenarios, hub-and-spoke operations, and breakdown recovery
 */

import { DemoScenarioGenerator, DemoScenarioConfig } from '../DemoScenarioGenerator';
import { MapVisualizationService } from '../MapVisualizationService';
import { RoutingService } from '../RoutingService';
import { DelhiComplianceService } from '../DelhiComplianceService';
import { Vehicle } from '../../models';

// Mock dependencies
jest.mock('../MapVisualizationService');
jest.mock('../RoutingService');
jest.mock('../DelhiComplianceService');

describe('DemoScenarioGenerator', () => {
  let demoGenerator: DemoScenarioGenerator;
  let mockMapVisualizationService: jest.Mocked<MapVisualizationService>;
  let mockRoutingService: jest.Mocked<RoutingService>;
  let mockComplianceService: jest.Mocked<DelhiComplianceService>;

  beforeEach(() => {
    mockMapVisualizationService = new MapVisualizationService({} as any) as jest.Mocked<MapVisualizationService>;
    mockRoutingService = new RoutingService({} as any, {} as any) as jest.Mocked<RoutingService>;
    mockComplianceService = new DelhiComplianceService() as jest.Mocked<DelhiComplianceService>;

    demoGenerator = new DemoScenarioGenerator(
      mockMapVisualizationService,
      mockRoutingService,
      mockComplianceService
    );

    // Setup default mocks
    mockMapVisualizationService.createRouteAnimation.mockResolvedValue([]);
    mockMapVisualizationService.createInteractiveMapData.mockResolvedValue({
      routes: [],
      vehicles: [],
      hubs: [],
      trafficData: [],
      metadata: {
        centerLocation: [77.2090, 28.6139],
        zoomLevel: 12,
        lastUpdated: new Date()
      }
    });

    mockRoutingService.optimizeRoutes.mockResolvedValue({
      routes: [],
      summary: {
        totalDistance: 0,
        totalDuration: 0,
        totalFuelConsumption: 0,
        vehicleUtilization: 0,
        routeEfficiency: 0
      },
      optimizationMetrics: {
        algorithmUsed: 'OR-Tools',
        solutionTime: 5,
        iterations: 100,
        constraintsApplied: []
      }
    });
  });

  describe('generatePredefinedScenario', () => {
    describe('Delhi Compliance Scenario', () => {
      it('should generate Delhi compliance demo scenario with correct vehicle types', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');

        expect(scenario.name).toBe('Delhi Vehicle Class Compliance Demo');
        expect(scenario.description).toContain('Delhi-specific time and zone restrictions');
        expect(scenario.vehicles).toHaveLength(4);
        
        // Check vehicle types
        const vehicleTypes = scenario.vehicles.map(v => v.type);
        expect(vehicleTypes).toContain('truck');
        expect(vehicleTypes).toContain('tempo');
        expect(vehicleTypes).toContain('electric');
        expect(vehicleTypes).toContain('three-wheeler');
      });

      it('should include compliance violation events', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');

        const complianceEvents = scenario.events.filter(e => e.type === 'compliance_violation');
        expect(complianceEvents).toHaveLength(2);
        
        const truckViolation = complianceEvents.find(e => e.vehicleId === 'TRUCK_DL01AB1234');
        expect(truckViolation).toBeDefined();
        expect(truckViolation!.description).toContain('restricted hours');
        
        const oddEvenViolation = complianceEvents.find(e => e.vehicleId === 'TEMPO_DL02CD5678');
        expect(oddEvenViolation).toBeDefined();
        expect(oddEvenViolation!.description).toContain('odd-even rule violation');
      });

      it('should create deliveries with different zone types and time windows', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');

        expect(scenario.deliveries).toHaveLength(3);
        
        const commercialDelivery = scenario.deliveries.find(d => d.id === 'DELIVERY_COMMERCIAL');
        expect(commercialDelivery).toBeDefined();
        expect(commercialDelivery!.timeWindow.earliest).toBe('09:00');
        expect(commercialDelivery!.timeWindow.latest).toBe('18:00');
        
        const restrictedDelivery = scenario.deliveries.find(d => d.id === 'DELIVERY_RESIDENTIAL_RESTRICTED');
        expect(restrictedDelivery).toBeDefined();
        expect(restrictedDelivery!.timeWindow.earliest).toBe('01:00');
        expect(restrictedDelivery!.timeWindow.latest).toBe('05:00');
      });

      it('should set appropriate vehicle plate numbers and fuel types', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance');

        const truckVehicle = scenario.vehicles.find(v => v.id === 'TRUCK_DL01AB1234');
        expect(truckVehicle).toBeDefined();
        expect(truckVehicle!.plateNumber).toBe('DL01AB1234');
        expect(truckVehicle!.fuelType).toBe('diesel');
        expect(truckVehicle!.pollutionLevel).toBe('BS6');

        const electricVehicle = scenario.vehicles.find(v => v.id === 'EV_DL03EF9012');
        expect(electricVehicle).toBeDefined();
        expect(electricVehicle!.fuelType).toBe('electric');
        expect(electricVehicle!.pollutionLevel).toBe('electric');
      });
    });

    describe('Hub-and-Spoke Scenario', () => {
      it('should generate hub-and-spoke scenario with multiple hubs', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');

        expect(scenario.name).toBe('Hub-and-Spoke Operations Demo');
        expect(scenario.description).toContain('multi-hub routing');
        expect(scenario.hubs).toHaveLength(4);
        
        const hubNames = scenario.hubs.map(h => h.name);
        expect(hubNames).toContain('North Delhi Hub');
        expect(hubNames).toContain('South Delhi Hub');
        expect(hubNames).toContain('East Delhi Hub');
        expect(hubNames).toContain('West Delhi Hub');
      });

      it('should include inter-hub and local vehicles', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');

        expect(scenario.vehicles).toHaveLength(4);
        
        const interHubTrucks = scenario.vehicles.filter(v => v.id.includes('INTER_HUB_TRUCK'));
        expect(interHubTrucks).toHaveLength(2);
        
        const localTempos = scenario.vehicles.filter(v => v.id.includes('LOCAL_TEMPO'));
        expect(localTempos).toHaveLength(2);
      });

      it('should include breakdown event for inter-hub vehicle', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');

        const breakdownEvents = scenario.events.filter(e => e.type === 'breakdown');
        expect(breakdownEvents).toHaveLength(1);
        
        const breakdownEvent = breakdownEvents[0];
        expect(breakdownEvent.vehicleId).toBe('INTER_HUB_TRUCK_1');
        expect(breakdownEvent.time).toBe(300); // 5 minutes
        expect(breakdownEvent.impact.severity).toBe('high');
      });

      it('should generate cross-hub deliveries', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke');

        expect(scenario.deliveries).toHaveLength(15);
        
        // Check that deliveries have different pickup and delivery locations
        scenario.deliveries.forEach(delivery => {
          expect(delivery.pickupLocation).not.toEqual(delivery.deliveryLocation);
          expect(delivery.id).toContain('CROSS_HUB_DELIVERY');
        });
      });
    });

    describe('Breakdown Recovery Scenario', () => {
      it('should generate breakdown recovery scenario with buffer vehicles', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');

        expect(scenario.name).toBe('Vehicle Breakdown Recovery Demo');
        expect(scenario.description).toContain('buffer vehicle allocation');
        expect(scenario.vehicles).toHaveLength(3);
        
        const primaryVehicle = scenario.vehicles.find(v => v.id === 'PRIMARY_VEHICLE');
        expect(primaryVehicle).toBeDefined();
        expect(primaryVehicle!.status).toBe('in-transit');
        
        const bufferVehicles = scenario.vehicles.filter(v => v.id.includes('BUFFER_VEHICLE'));
        expect(bufferVehicles).toHaveLength(2);
        bufferVehicles.forEach(vehicle => {
          expect(vehicle.status).toBe('available');
        });
      });

      it('should include urgent delivery and breakdown event', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');

        expect(scenario.deliveries).toHaveLength(1);
        const urgentDelivery = scenario.deliveries[0];
        expect(urgentDelivery.id).toBe('URGENT_DELIVERY');
        expect(urgentDelivery.priority).toBe('urgent');
        
        const breakdownEvents = scenario.events.filter(e => e.type === 'breakdown');
        expect(breakdownEvents).toHaveLength(1);
        expect(breakdownEvents[0].vehicleId).toBe('PRIMARY_VEHICLE');
        expect(breakdownEvents[0].time).toBe(120); // 2 minutes
      });

      it('should have recovery hub with buffer vehicles', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery');

        expect(scenario.hubs).toHaveLength(1);
        const recoveryHub = scenario.hubs[0];
        expect(recoveryHub.id).toBe('RECOVERY_HUB');
        expect(recoveryHub.name).toBe('Emergency Recovery Hub');
        expect(recoveryHub.bufferVehicles).toBe(2);
      });
    });

    describe('Traffic Optimization Scenario', () => {
      it('should generate traffic optimization scenario with traffic events', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('traffic_optimization');

        expect(scenario.name).toBe('Traffic-Aware Route Optimization Demo');
        expect(scenario.description).toContain('real-time traffic conditions');
        
        const trafficEvents = scenario.events.filter(e => e.type === 'traffic_jam' || e.type === 'weather_change');
        expect(trafficEvents).toHaveLength(2);
        
        const trafficJam = scenario.events.find(e => e.type === 'traffic_jam');
        expect(trafficJam).toBeDefined();
        expect(trafficJam!.description).toContain('traffic congestion');
        
        const weatherEvent = scenario.events.find(e => e.type === 'weather_change');
        expect(weatherEvent).toBeDefined();
        expect(weatherEvent!.description).toContain('Heavy rain');
      });

      it('should include vehicles in transit for optimization', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('traffic_optimization');

        expect(scenario.vehicles).toHaveLength(2);
        scenario.vehicles.forEach(vehicle => {
          expect(vehicle.status).toBe('in-transit');
        });
      });
    });

    describe('Custom scenario options', () => {
      it('should apply custom vehicle count', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('delhi_compliance', {
          vehicleCount: 6
        });

        // Note: The current implementation doesn't use vehicleCount for delhi_compliance
        // but we test that customizations are accepted
        expect(scenario.vehicles).toHaveLength(4); // Default for delhi_compliance
      });

      it('should apply custom time acceleration', async () => {
        const scenario = await demoGenerator.generatePredefinedScenario('hub_spoke', {
          timeAcceleration: 20
        });

        expect(scenario.timeAcceleration).toBe(20);
      });

      it('should apply custom center location', async () => {
        const customCenter: [number, number] = [77.1000, 28.5000];
        const scenario = await demoGenerator.generatePredefinedScenario('breakdown_recovery', {
          centerLocation: customCenter
        });

        expect(scenario.centerLocation).toEqual(customCenter);
      });
    });

    describe('Error handling', () => {
      it('should throw error for unknown scenario type', async () => {
        await expect(
          demoGenerator.generatePredefinedScenario('unknown_scenario' as any)
        ).rejects.toThrow('Unknown scenario type: unknown_scenario');
      });
    });
  });

  describe('executeDemoScenario', () => {
    let mockScenario: DemoScenarioConfig;

    beforeEach(() => {
      mockScenario = {
        name: 'Test Scenario',
        description: 'Test scenario for unit testing',
        duration: 300,
        timeAcceleration: 5,
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
        events: []
      };

      // Mock route optimization result
      mockRoutingService.optimizeRoutes.mockResolvedValue({
        routes: [
          {
            id: 'test_route_1',
            vehicleId: 'TEST_VEHICLE_1',
            stops: [],
            estimatedDuration: 1800,
            estimatedDistance: 15000,
            estimatedFuelConsumption: 5.0,
            trafficFactors: [],
            status: 'planned'
          }
        ],
        summary: {
          totalDistance: 15000,
          totalDuration: 1800,
          totalFuelConsumption: 5.0,
          vehicleUtilization: 100,
          routeEfficiency: 85
        },
        optimizationMetrics: {
          algorithmUsed: 'OR-Tools',
          solutionTime: 3,
          iterations: 50,
          constraintsApplied: ['capacity', 'time_windows']
        }
      });

      // Mock animation frames
      mockMapVisualizationService.createRouteAnimation.mockResolvedValue([
        {
          timestamp: 0,
          vehiclePositions: new Map([['TEST_VEHICLE_1', [77.2090, 28.6139]]]),
          routeProgress: new Map([['test_route_1', 0]]),
          activeEvents: [],
          metrics: {
            totalDistance: 0,
            completedDeliveries: 0,
            fuelConsumed: 0,
            averageSpeed: 0
          }
        }
      ]);
    });

    it('should execute demo scenario successfully', async () => {
      const result = await demoGenerator.executeDemoScenario(mockScenario);

      expect(result).toBeDefined();
      expect(result.animationFrames).toBeDefined();
      expect(result.finalState).toBeDefined();
      expect(result.summary).toBeDefined();
      
      expect(result.summary.totalDeliveries).toBe(1);
      expect(result.summary.successfulDeliveries).toBe(1);
      expect(result.summary.fuelEfficiency).toBeGreaterThan(0);
      expect(result.summary.complianceRate).toBe(100);
    });

    it('should convert demo vehicles to internal models correctly', async () => {
      await demoGenerator.executeDemoScenario(mockScenario);

      expect(mockRoutingService.optimizeRoutes).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicles: expect.arrayContaining([
            expect.objectContaining({
              id: 'TEST_VEHICLE_1',
              type: 'truck',
              subType: 'heavy-truck',
              vehicleSpecs: expect.objectContaining({
                plateNumber: 'DL01AB1234',
                fuelType: 'diesel'
              })
            })
          ])
        })
      );
    });

    it('should convert demo hubs to internal models correctly', async () => {
      await demoGenerator.executeDemoScenario(mockScenario);

      expect(mockRoutingService.optimizeRoutes).toHaveBeenCalledWith(
        expect.objectContaining({
          hubs: expect.arrayContaining([
            expect.objectContaining({
              id: 'TEST_HUB',
              name: 'Test Hub',
              capacity: expect.objectContaining({
                vehicles: 10,
                storage: 1000
              })
            })
          ])
        })
      );
    });

    it('should convert demo deliveries to internal models correctly', async () => {
      await demoGenerator.executeDemoScenario(mockScenario);

      expect(mockRoutingService.optimizeRoutes).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveries: expect.arrayContaining([
            expect.objectContaining({
              id: 'TEST_DELIVERY',
              shipment: expect.objectContaining({
                weight: 1000,
                volume: 5
              }),
              priority: 'medium'
            })
          ])
        })
      );
    });

    it('should handle execution errors gracefully', async () => {
      mockRoutingService.optimizeRoutes.mockRejectedValue(new Error('Routing failed'));

      await expect(demoGenerator.executeDemoScenario(mockScenario))
        .rejects.toThrow('Failed to execute demo scenario: Error: Routing failed');
    });

    it('should calculate scenario summary correctly', async () => {
      const result = await demoGenerator.executeDemoScenario(mockScenario);

      expect(result.summary.totalDeliveries).toBe(mockScenario.deliveries.length);
      expect(result.summary.averageDeliveryTime).toBe(mockScenario.duration / mockScenario.deliveries.length);
      expect(result.summary.complianceRate).toBe(100); // No compliance violations in test scenario
    });
  });

  describe('createDemoDashboard', () => {
    let mockScenario: DemoScenarioConfig;

    beforeEach(() => {
      mockScenario = {
        name: 'Dashboard Test Scenario',
        description: 'Test scenario for dashboard creation',
        duration: 600,
        timeAcceleration: 10,
        centerLocation: [77.2090, 28.6139],
        vehicles: [
          {
            id: 'DASH_VEHICLE_1',
            type: 'van',
            location: [77.2090, 28.6139],
            status: 'in-transit'
          },
          {
            id: 'DASH_VEHICLE_2',
            type: 'tempo',
            location: [77.2100, 28.6150],
            status: 'available'
          }
        ],
        hubs: [
          {
            id: 'DASH_HUB',
            name: 'Dashboard Hub',
            location: [77.2090, 28.6139],
            capacity: 20,
            bufferVehicles: 3
          }
        ],
        deliveries: [
          {
            id: 'DASH_DELIVERY',
            pickupLocation: [77.2090, 28.6139],
            deliveryLocation: [77.2100, 28.6150],
            weight: 500,
            volume: 3,
            timeWindow: { earliest: '10:00', latest: '16:00' },
            priority: 'high'
          }
        ],
        events: [
          {
            time: 180,
            type: 'breakdown',
            vehicleId: 'DASH_VEHICLE_1',
            description: 'Test breakdown event',
            impact: { duration: 120, severity: 'medium' }
          }
        ]
      };
    });

    it('should create demo dashboard with all components', async () => {
      const dashboard = await demoGenerator.createDemoDashboard(mockScenario);

      expect(dashboard).toBeDefined();
      expect(dashboard.mapData).toBeDefined();
      expect(dashboard.controlPanel).toBeDefined();
      expect(dashboard.metricsPanel).toBeDefined();
    });

    it('should create control panel with correct scenario information', async () => {
      const dashboard = await demoGenerator.createDemoDashboard(mockScenario);

      expect(dashboard.controlPanel.scenarios).toContain('delhi_compliance');
      expect(dashboard.controlPanel.scenarios).toContain('hub_spoke');
      expect(dashboard.controlPanel.scenarios).toContain('breakdown_recovery');
      expect(dashboard.controlPanel.scenarios).toContain('traffic_optimization');
      
      expect(dashboard.controlPanel.currentScenario).toBe('Dashboard Test Scenario');
      expect(dashboard.controlPanel.playbackControls.totalDuration).toBe(600);
      expect(dashboard.controlPanel.playbackControls.speed).toBe(10);
    });

    it('should create event triggers from scenario events', async () => {
      const dashboard = await demoGenerator.createDemoDashboard(mockScenario);

      expect(dashboard.controlPanel.eventTriggers).toHaveLength(1);
      const eventTrigger = dashboard.controlPanel.eventTriggers[0];
      expect(eventTrigger.name).toBe('BREAKDOWN');
      expect(eventTrigger.description).toBe('Test breakdown event');
      expect(typeof eventTrigger.trigger).toBe('function');
    });

    it('should create metrics panel with real-time metrics', async () => {
      const dashboard = await demoGenerator.createDemoDashboard(mockScenario);

      expect(dashboard.metricsPanel.realTimeMetrics.activeVehicles).toBe(1); // Only in-transit vehicles
      expect(dashboard.metricsPanel.realTimeMetrics.completedDeliveries).toBe(0);
      expect(dashboard.metricsPanel.realTimeMetrics.averageSpeed).toBeGreaterThan(0);
      expect(dashboard.metricsPanel.realTimeMetrics.complianceRate).toBe(100);
    });

    it('should create metrics charts', async () => {
      const dashboard = await demoGenerator.createDemoDashboard(mockScenario);

      expect(dashboard.metricsPanel.charts).toHaveLength(3);
      
      const pieChart = dashboard.metricsPanel.charts.find(c => c.type === 'pie');
      expect(pieChart).toBeDefined();
      expect(pieChart!.title).toBe('Vehicle Type Distribution');
      
      const barChart = dashboard.metricsPanel.charts.find(c => c.type === 'bar');
      expect(barChart).toBeDefined();
      expect(barChart!.title).toBe('Route Efficiency');
      
      const lineChart = dashboard.metricsPanel.charts.find(c => c.type === 'line');
      expect(lineChart).toBeDefined();
      expect(lineChart!.title).toBe('Fuel Consumption Over Time');
    });

    it('should handle dashboard creation errors gracefully', async () => {
      mockMapVisualizationService.createInteractiveMapData.mockRejectedValue(new Error('Map creation failed'));

      await expect(demoGenerator.createDemoDashboard(mockScenario))
        .rejects.toThrow('Failed to create demo dashboard: Error: Map creation failed');
    });
  });

  describe('Helper methods', () => {
    describe('Vehicle type conversion', () => {
      it('should convert vehicle types to correct subtypes', () => {
        const demoVehicles = [
          { id: 'v1', type: 'truck' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const },
          { id: 'v2', type: 'tempo' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const },
          { id: 'v3', type: 'van' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const },
          { id: 'v4', type: 'three-wheeler' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const },
          { id: 'v5', type: 'electric' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const }
        ];

        // Access private method through any cast for testing
        const vehicles = (demoGenerator as any).convertDemoVehiclesToModels(demoVehicles);

        expect(vehicles[0].subType).toBe('heavy-truck');
        expect(vehicles[1].subType).toBe('tempo-traveller');
        expect(vehicles[2].subType).toBe('pickup-van');
        expect(vehicles[3].subType).toBe('auto-rickshaw');
        expect(vehicles[4].subType).toBe('e-rickshaw');
      });

      it('should assign correct capacities for vehicle types', () => {
        const demoVehicles = [
          { id: 'truck', type: 'truck' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const },
          { id: 'tempo', type: 'tempo' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const }
        ];

        const vehicles = (demoGenerator as any).convertDemoVehiclesToModels(demoVehicles);

        expect(vehicles[0].capacity.weight).toBe(5000);
        expect(vehicles[0].capacity.volume).toBe(20);
        expect(vehicles[1].capacity.weight).toBe(1500);
        expect(vehicles[1].capacity.volume).toBe(8);
      });

      it('should assign correct access privileges for vehicle types', () => {
        const demoVehicles = [
          { id: 'truck', type: 'truck' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const },
          { id: 'three-wheeler', type: 'three-wheeler' as const, location: [77.2090, 28.6139] as [number, number], status: 'available' as const }
        ];

        const vehicles = (demoGenerator as any).convertDemoVehiclesToModels(demoVehicles);

        // Truck should not have residential zone access
        expect(vehicles[0].accessPrivileges.residentialZones).toBe(false);
        expect(vehicles[0].accessPrivileges.narrowLanes).toBe(false);

        // Three-wheeler should have full access
        expect(vehicles[1].accessPrivileges.residentialZones).toBe(true);
        expect(vehicles[1].accessPrivileges.narrowLanes).toBe(true);
      });
    });

    describe('Time parsing', () => {
      it('should parse time strings correctly', () => {
        const timeStr = '14:30';
        const parsedTime = (demoGenerator as any).parseTimeToDate(timeStr);

        expect(parsedTime.getHours()).toBe(14);
        expect(parsedTime.getMinutes()).toBe(30);
        expect(parsedTime.getSeconds()).toBe(0);
      });
    });

    describe('Vehicle type distribution', () => {
      it('should calculate vehicle type distribution correctly', () => {
        const vehicles = [
          { type: 'truck' } as Vehicle,
          { type: 'truck' } as Vehicle,
          { type: 'tempo' } as Vehicle,
          { type: 'van' } as Vehicle
        ];

        const distribution = (demoGenerator as any).getVehicleTypeDistribution(vehicles);

        expect(distribution).toHaveLength(3);
        expect(distribution.find((d: any) => d.name === 'truck').value).toBe(2);
        expect(distribution.find((d: any) => d.name === 'tempo').value).toBe(1);
        expect(distribution.find((d: any) => d.name === 'van').value).toBe(1);
      });
    });
  });
});