/**
 * Unit tests for RealTimeRouteOptimizer
 */

import { RealTimeRouteOptimizer, ReOptimizationTrigger, RouteMonitoringConfig } from '../RealTimeRouteOptimizer';
import { RoutingService } from '../RoutingService';
import { TrafficPredictionService } from '../TrafficPredictionService';
import { FleetService } from '../FleetService';
import { Route} from '../../models/Route';
import { Vehicle } from '../../models/Vehicle';
import { TrafficData, TrafficAlert } from '../../models/Traffic';
import { GeoLocation } from '../../models/GeoLocation';

// Mock services
jest.mock('../RoutingService');
jest.mock('../TrafficPredictionService');
jest.mock('../FleetService');

describe('RealTimeRouteOptimizer', () => {
  let optimizer: RealTimeRouteOptimizer;
  let mockRoutingService: jest.Mocked<RoutingService>;
  let mockTrafficService: jest.Mocked<TrafficPredictionService>;
  let mockFleetService: jest.Mocked<FleetService>;

  const mockConfig: RouteMonitoringConfig = {
    trafficCheckInterval: 1000, // 1 second for testing
    vehicleStatusCheckInterval: 500,
    significantTrafficChangeThreshold: 25,
    significantDelayThreshold: 15,
    maxReOptimizationFrequency: 3,
    enableProactiveOptimization: true
  };

  const mockLocation: GeoLocation = {
    latitude: 28.6139,
    longitude: 77.2090
  };

  const mockVehicle: Vehicle = {
    id: 'V001',
    type: 'van',
    subType: 'pickup-van',
    capacity: { weight: 1000, volume: 5, maxDimensions: { length: 6, width: 2.5, height: 3 } },
    location: mockLocation,
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
      vehicleAge: 2,
      registrationState: 'DL'
    , manufacturingYear: 2021 },
    accessPrivileges: {
      residentialZones: true,
      commercialZones: true,
      industrialZones: true,
      restrictedHours: false,
      pollutionSensitiveZones: true,
      narrowLanes: true
    },
    driverInfo: {
      id: 'D001',
      workingHours: 0,
      maxWorkingHours: 8,
      name: "Test Driver", 
      licenseNumber: "DL123456789", 
      contactNumber: "+91-9876543210"
    },
    lastUpdated: new Date()
  };

  const mockRoute: Route = {
    id: 'R001',
    vehicleId: 'V001',
    stops: [
      {
        id: 'S001',
        sequence: 0,
        location: mockLocation,
        type: 'pickup',
        deliveryId: 'D001',
        estimatedArrivalTime: new Date(),
        estimatedDepartureTime: new Date(),
        duration: 15,
        status: 'pending'
      },
      {
        id: 'S002',
        sequence: 1,
        location: { ...mockLocation, latitude: 28.6200 },
        type: 'delivery',
        deliveryId: 'D001',
        estimatedArrivalTime: new Date(),
        estimatedDepartureTime: new Date(),
        duration: 15,
        status: 'pending'
      }
    ],
    estimatedDuration: 60,
    estimatedDistance: 10,
    estimatedFuelConsumption: 1.2,
    trafficFactors: [],
    status: 'active',
    deliveryIds: ['D001'],
    routeType: 'direct'
  };

  beforeEach(() => {
    mockRoutingService = new RoutingService() as jest.Mocked<RoutingService>;
    mockTrafficService = {} as jest.Mocked<TrafficPredictionService>;
    mockFleetService = {} as jest.Mocked<FleetService>;

    // Setup mock implementations
    mockTrafficService.getCurrentTraffic = jest.fn();
    mockTrafficService.getTrafficAlerts = jest.fn();
    mockFleetService.getVehicle = jest.fn();
    mockRoutingService.optimizeRoutes = jest.fn();

    optimizer = new RealTimeRouteOptimizer(
      mockRoutingService,
      mockTrafficService,
      mockFleetService,
      mockConfig
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Route Monitoring', () => {
    it('should start monitoring active routes', async () => {
      const routes = [mockRoute];
      
      await optimizer.startRouteMonitoring(routes);
      
      expect(optimizer['activeRoutes'].size).toBe(1);
      expect(optimizer['activeRoutes'].get('R001')).toEqual(mockRoute);
    });

    it('should stop monitoring a specific route', () => {
      optimizer['activeRoutes'].set('R001', mockRoute);
      
      optimizer.stopRouteMonitoring('R001');
      
      expect(optimizer['activeRoutes'].has('R001')).toBe(false);
    });

    it('should not monitor routes with inactive status', async () => {
      const inactiveRoute = { ...mockRoute, status: 'completed' as const };
      
      await optimizer.startRouteMonitoring([inactiveRoute]);
      
      expect(optimizer['activeRoutes'].size).toBe(0);
    });
  });

  describe('Change Detection', () => {
    beforeEach(() => {
      optimizer['activeRoutes'].set('R001', mockRoute);
    });

    it('should detect significant traffic changes', async () => {
      const oldTraffic: TrafficData = {
        area: { 
          id: 'test-area-1', 
          name: 'Test Area 1', 
          boundaries: [mockLocation], 
          zoneType: 'commercial' 
        },
        congestionLevel: 'moderate',
        averageSpeed: 30,
        travelTimeMultiplier: 1.2,
        timestamp: new Date(),
        source: 'google_maps'
      };

      const newTraffic: TrafficData = {
        ...oldTraffic,
        congestionLevel: 'severe',
        travelTimeMultiplier: 2.0
      };

      optimizer['lastTrafficData'].set('R001_0', oldTraffic);
      mockTrafficService.getCurrentTraffic.mockResolvedValue(newTraffic);
      mockTrafficService.getTrafficAlerts.mockResolvedValue([]);

      const triggers = await optimizer.detectSignificantChanges('R001');

      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.type).toBe('traffic_change');
      expect(triggers[0]?.severity).toBe('critical');
    });

    it('should detect vehicle breakdown', async () => {
      const brokenVehicle = { ...mockVehicle, status: 'breakdown' as const };
      
      mockFleetService.getVehicle.mockResolvedValue(brokenVehicle);
      mockTrafficService.getCurrentTraffic.mockResolvedValue({
        area: { 
          id: 'test-area-3', 
          name: 'Test Area 3', 
          boundaries: [mockLocation], 
          zoneType: 'commercial' 
        },
        congestionLevel: 'low',
        averageSpeed: 40,
        travelTimeMultiplier: 1.0,
        timestamp: new Date(),
        source: 'cached'
      });
      mockTrafficService.getTrafficAlerts.mockResolvedValue([]);

      const triggers = await optimizer.detectSignificantChanges('R001');

      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.type).toBe('vehicle_breakdown');
      expect(triggers[0]?.severity).toBe('critical');
    });

    it('should detect vehicle location deviation', async () => {
      const deviatedVehicle = {
        ...mockVehicle,
        location: { ...mockLocation, latitude: 28.7000 } // Far from route
      };
      
      mockFleetService.getVehicle.mockResolvedValue(deviatedVehicle);
      mockTrafficService.getCurrentTraffic.mockResolvedValue({
        area: { 
          id: 'test-area-4', 
          name: 'Test Area 4', 
          boundaries: [mockLocation], 
          zoneType: 'commercial' 
        },
        congestionLevel: 'low',
        averageSpeed: 40,
        travelTimeMultiplier: 1.0,
        timestamp: new Date(),
        source: 'cached'
      });
      mockTrafficService.getTrafficAlerts.mockResolvedValue([]);

      const triggers = await optimizer.detectSignificantChanges('R001');

      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.type).toBe('vehicle_breakdown');
      expect(triggers[0]?.severity).toBe('medium');
      expect(triggers[0]?.description).toContain('off planned route');
    });

    it('should detect traffic alerts relevant to route', async () => {
      const trafficAlert: TrafficAlert = {
        id: 'A001',
        location: mockLocation,
        type: 'accident',
        severity: 'high',
        description: 'Major accident blocking traffic',
        estimatedDuration: 120,
        affectedRoutes: ['NH1'],
        timestamp: new Date()
      };

      mockTrafficService.getCurrentTraffic.mockResolvedValue({
        area: { 
          id: 'test-area-5', 
          name: 'Test Area 5', 
          boundaries: [mockLocation], 
          zoneType: 'commercial' 
        },
        congestionLevel: 'low',
        averageSpeed: 40,
        travelTimeMultiplier: 1.0,
        timestamp: new Date(),
        source: 'cached'
      });
      mockTrafficService.getTrafficAlerts.mockResolvedValue([trafficAlert]);

      const triggers = await optimizer.detectSignificantChanges('R001');

      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.type).toBe('traffic_change');
      expect(triggers[0]?.description).toContain('Traffic alert');
    });
  });

  describe('Re-optimization', () => {
    const mockTrigger: ReOptimizationTrigger = {
      type: 'traffic_change',
      severity: 'high',
      description: 'Heavy traffic detected',
      affectedRoutes: ['R001'],
      timestamp: new Date()
    };

    beforeEach(() => {
      optimizer['activeRoutes'].set('R001', mockRoute);
    });

    it('should perform successful incremental re-optimization', async () => {
      const optimizedRoute = {
        ...mockRoute,
        estimatedDuration: 45, // Improved
        estimatedDistance: 8   // Improved
      };

      mockFleetService.getVehicle.mockResolvedValue(mockVehicle);
      mockRoutingService.optimizeRoutes.mockResolvedValue({
        success: true,
        routes: [optimizedRoute],
        totalDistance: 8,
        totalDuration: 45,
        totalCost: 100,
        optimizationTime: 5000,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: 8
      });

      const result = await optimizer.performIncrementalReOptimization(mockTrigger);

      expect(result.success).toBe(true);
      expect(result.optimizedRoutes).toHaveLength(1);
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0]?.timeSavingMinutes).toBe(15);
      expect(result.improvements[0]?.distanceSavingKm).toBe(2);
    });

    it('should handle re-optimization failure gracefully', async () => {
      mockFleetService.getVehicle.mockResolvedValue(mockVehicle);
      mockRoutingService.optimizeRoutes.mockResolvedValue({
        success: false,
        routes: [],
        totalDistance: 0,
        totalDuration: 0,
        totalCost: 0,
        optimizationTime: 1000,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: 0,
        message: 'Optimization failed'
      });

      const result = await optimizer.performIncrementalReOptimization(mockTrigger);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Optimization failed');
      expect(result.optimizedRoutes).toEqual([mockRoute]); // Should keep original
    });

    it('should respect re-optimization frequency limits', async () => {
      // Record multiple recent optimizations
      const now = new Date();
      optimizer['reOptimizationHistory'].set('R001', [
        new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
        new Date(now.getTime() - 20 * 60 * 1000), // 20 minutes ago
        new Date(now.getTime() - 30 * 60 * 1000)  // 30 minutes ago
      ]);

      const result = await optimizer.performIncrementalReOptimization(mockTrigger);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Re-optimization frequency limit exceeded');
    });

    it('should handle missing routes gracefully', async () => {
      const invalidTrigger = {
        ...mockTrigger,
        affectedRoutes: ['INVALID_ROUTE']
      };

      const result = await optimizer.performIncrementalReOptimization(invalidTrigger);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No valid routes found for re-optimization');
    });
  });

  describe('Route Updates Broadcasting', () => {
    it('should broadcast route updates with correct format', async () => {
      const routes = [mockRoute];
      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'high',
        description: 'Traffic congestion increased',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      let broadcastReceived = false;
      optimizer.on('route_updates', (broadcasts) => {
        broadcastReceived = true;
        expect(broadcasts).toHaveLength(1);
        expect(broadcasts[0]?.routeId).toBe('R001');
        expect(broadcasts[0]?.vehicleId).toBe('V001');
        expect(broadcasts[0]?.updateType).toBe('alternative_route');
        expect(broadcasts[0]?.urgency).toBe('high');
      });

      await optimizer.broadcastRouteUpdates(routes, trigger);

      expect(broadcastReceived).toBe(true);
    });

    it('should map trigger types to correct update types', async () => {
      const testCases = [
        { triggerType: 'traffic_change' as const, expectedUpdateType: 'alternative_route' as const },
        { triggerType: 'vehicle_breakdown' as const, expectedUpdateType: 'route_change' as const },
        { triggerType: 'delivery_update' as const, expectedUpdateType: 'stop_reorder' as const },
        { triggerType: 'compliance_change' as const, expectedUpdateType: 'time_adjustment' as const }
      ];

      for (const testCase of testCases) {
        const trigger: ReOptimizationTrigger = {
          type: testCase.triggerType,
          severity: 'medium',
          description: 'Test trigger',
          affectedRoutes: ['R001'],
          timestamp: new Date()
        };

        let receivedUpdateType: string | undefined;
        optimizer.on('route_updates', (broadcasts) => {
          receivedUpdateType = broadcasts[0]?.updateType;
        });

        await optimizer.broadcastRouteUpdates([mockRoute], trigger);

        expect(receivedUpdateType).toBe(testCase.expectedUpdateType);
      }
    });
  });

  describe('Traffic Change Calculation', () => {
    it('should calculate significant traffic changes correctly', () => {
      const oldTraffic: TrafficData = {
        area: { 
          id: 'test-area-6', 
          name: 'Test Area 6', 
          boundaries: [mockLocation], 
          zoneType: 'commercial' 
        },
        congestionLevel: 'moderate',
        averageSpeed: 30,
        travelTimeMultiplier: 1.2,
        timestamp: new Date(),
        source: 'google_maps'
      };

      const newTraffic: TrafficData = {
        ...oldTraffic,
        travelTimeMultiplier: 1.8 // 50% increase
      };

      const change = optimizer['calculateTrafficChange'](oldTraffic, newTraffic);

      expect(change.isSignificant).toBe(true);
      expect(change.changePercentage).toBe(50);
      expect(change.changeType).toBe('increased');
      expect(change.severity).toBe('critical');
    });

    it('should not flag minor traffic changes as significant', () => {
      const oldTraffic: TrafficData = {
        area: { 
          id: 'test-area-7', 
          name: 'Test Area 7', 
          boundaries: [mockLocation], 
          zoneType: 'commercial' 
        },
        congestionLevel: 'moderate',
        averageSpeed: 30,
        travelTimeMultiplier: 1.2,
        timestamp: new Date(),
        source: 'google_maps'
      };

      const newTraffic: TrafficData = {
        ...oldTraffic,
        travelTimeMultiplier: 1.3 // ~8% increase
      };

      const change = optimizer['calculateTrafficChange'](oldTraffic, newTraffic);

      expect(change.isSignificant).toBe(false);
      expect(change.changePercentage).toBeCloseTo(8.33, 1);
      expect(change.severity).toBe('low');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle service errors gracefully during change detection', async () => {
      optimizer['activeRoutes'].set('R001', mockRoute);
      
      mockTrafficService.getCurrentTraffic.mockRejectedValue(new Error('API timeout'));
      mockFleetService.getVehicle.mockRejectedValue(new Error('Database error'));

      const triggers = await optimizer.detectSignificantChanges('R001');

      expect(triggers).toHaveLength(0); // Should return empty array on errors
    });

    it('should handle re-optimization errors gracefully', async () => {
      optimizer['activeRoutes'].set('R001', mockRoute);
      
      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'high',
        description: 'Test trigger',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      mockFleetService.getVehicle.mockRejectedValue(new Error('Service unavailable'));

      const result = await optimizer.performIncrementalReOptimization(trigger);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Service unavailable');
    });

    it('should complete re-optimization within reasonable time', async () => {
      optimizer['activeRoutes'].set('R001', mockRoute);
      
      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'medium',
        description: 'Test trigger',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      mockFleetService.getVehicle.mockResolvedValue(mockVehicle);
      mockRoutingService.optimizeRoutes.mockResolvedValue({
        success: true,
        routes: [mockRoute],
        totalDistance: 10,
        totalDuration: 60,
        totalCost: 100,
        optimizationTime: 8000,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: 10
      });

      const startTime = Date.now();
      const result = await optimizer.performIncrementalReOptimization(trigger);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit monitoring_started event', async () => {
      let eventEmitted = false;
      optimizer.on('monitoring_started', (data) => {
        eventEmitted = true;
        expect(data.routeCount).toBe(1);
      });

      await optimizer.startRouteMonitoring([mockRoute]);

      expect(eventEmitted).toBe(true);
    });

    it('should emit reoptimization_completed event', async () => {
      optimizer['activeRoutes'].set('R001', mockRoute);
      
      let eventEmitted = false;
      optimizer.on('reoptimization_completed', (result) => {
        eventEmitted = true;
        expect(result.success).toBe(true);
      });

      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'critical',
        description: 'Critical traffic change',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      mockFleetService.getVehicle.mockResolvedValue(mockVehicle);
      mockRoutingService.optimizeRoutes.mockResolvedValue({
        success: true,
        routes: [mockRoute],
        totalDistance: 10,
        totalDuration: 60,
        totalCost: 100,
        optimizationTime: 5000,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: 10
      });

      // Simulate the monitoring interval detecting a critical trigger
      await optimizer.performIncrementalReOptimization(trigger);

      expect(eventEmitted).toBe(true);
    });
  });
});