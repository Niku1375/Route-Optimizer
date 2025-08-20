/**
 * Integration tests for RealTimeRouteOptimizer
 * Tests the real-time optimization functionality without depending on broken RoutingService
 */

import { RealTimeRouteOptimizer, ReOptimizationTrigger, RouteMonitoringConfig } from '../RealTimeRouteOptimizer';
import { Route } from '../../models/Route';
import { Vehicle } from '../../models/Vehicle';
import { TrafficData } from '../../models/Traffic';


// Mock implementations for testing
class MockRoutingService {
  async optimizeRoutes(request: any) {
    return {
      success: true,
      routes: request.vehicles.map((vehicle: Vehicle) => ({
        id: `route_${vehicle.id}`,
        vehicleId: vehicle.id,
        stops: [],
        estimatedDistance: 10,
        estimatedDuration: 60,
        estimatedFuelConsumption: 1.2,
        trafficFactors: [],
        status: 'planned',
        deliveryIds: [],
        routeType: 'direct'
      })),
      totalDistance: 10,
      totalDuration: 60,
      totalCost: 100,
      optimizationTime: 5000,
      algorithmUsed: 'MOCK_ALGORITHM',
      objectiveValue: 10
    };
  }
}

class MockTrafficService {
  async getCurrentTraffic(area: any): Promise<TrafficData> {
    return {
      area,
      congestionLevel: 'moderate',
      averageSpeed: 30,
      travelTimeMultiplier: 1.2,
      timestamp: new Date(),
      source: 'cached'
    };
  }

  async getTrafficAlerts(_area: any) {
    return [];
  }
}

class MockFleetService {
  async getVehicle(vehicleId: string): Promise<Vehicle> {
    return {
      id: vehicleId,
      type: 'van',
      subType: 'pickup-van',
      capacity: { weight: 1000, volume: 5, maxDimensions: { length: 6, width: 2.5, height: 3 } },
      location: {
        latitude: 28.6139,
        longitude: 77.2090
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
        maxWorkingHours: 8
      , name: "Test Driver", licenseNumber: "DL123456789", contactNumber: "+91-9876543210" },
      lastUpdated: new Date()
    };
  }
}

describe('RealTimeRouteOptimizer Integration Tests', () => {
  let optimizer: RealTimeRouteOptimizer;
  let mockRoutingService: MockRoutingService;
  let mockTrafficService: MockTrafficService;
  let mockFleetService: MockFleetService;

  const mockConfig: RouteMonitoringConfig = {
    trafficCheckInterval: 100, // Very short for testing
    vehicleStatusCheckInterval: 50,
    significantTrafficChangeThreshold: 25,
    significantDelayThreshold: 15,
    maxReOptimizationFrequency: 10, // Allow more frequent optimization for testing
    enableProactiveOptimization: true
  };

  const mockRoute: Route = {
    id: 'R001',
    vehicleId: 'V001',
    stops: [
      {
        id: 'S001',
        sequence: 0,
        location: {
          latitude: 28.6139,
          longitude: 77.2090
        },
        type: 'pickup',
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
    mockRoutingService = new MockRoutingService();
    mockTrafficService = new MockTrafficService();
    mockFleetService = new MockFleetService();

    optimizer = new RealTimeRouteOptimizer(
      mockRoutingService as any,
      mockTrafficService as any,
      mockFleetService as any,
      mockConfig
    );
  });

  afterEach(() => {
    // Clean up any active monitoring
    optimizer.stopRouteMonitoring('R001');
  });

  describe('End-to-End Route Monitoring and Optimization', () => {
    it('should successfully monitor and re-optimize routes', async () => {
      // Start monitoring
      await optimizer.startRouteMonitoring([mockRoute]);

      // Verify monitoring started
      expect(optimizer['activeRoutes'].size).toBe(1);
      expect(optimizer['activeRoutes'].get('R001')).toEqual(mockRoute);

      // Simulate a trigger
      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'high',
        description: 'Heavy traffic detected',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      // Perform re-optimization
      const result = await optimizer.performIncrementalReOptimization(trigger);

      // Verify successful re-optimization
      expect(result.success).toBe(true);
      expect(result.optimizedRoutes).toHaveLength(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should detect traffic changes and trigger re-optimization', async () => {
      // Set up initial traffic data
      const initialTraffic: TrafficData = {
        area: { id: 'test-area', name: 'Test Area', boundaries: [mockRoute.stops[0]!.location], zoneType: 'commercial' },
        congestionLevel: 'low',
        averageSpeed: 40,
        travelTimeMultiplier: 1.0,
        timestamp: new Date(),
        source: 'cached'
      };

      optimizer['lastTrafficData'].set('R001_0', initialTraffic);

      // Mock traffic service to return heavy traffic
      mockTrafficService.getCurrentTraffic = jest.fn().mockResolvedValue({
        ...initialTraffic,
        congestionLevel: 'severe',
        travelTimeMultiplier: 2.0
      });

      // Start monitoring
      await optimizer.startRouteMonitoring([mockRoute]);

      // Detect changes
      const triggers = await optimizer.detectSignificantChanges('R001');

      // Verify traffic change detected
      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.type).toBe('traffic_change');
      expect(triggers[0]?.severity).toBe('critical');
    });

    it('should handle vehicle breakdown scenarios', async () => {
      // Mock fleet service to return broken vehicle
      mockFleetService.getVehicle = jest.fn().mockResolvedValue({
        ...await mockFleetService.getVehicle('V001'),
        status: 'breakdown'
      });

      // Start monitoring
      await optimizer.startRouteMonitoring([mockRoute]);

      // Detect changes
      const triggers = await optimizer.detectSignificantChanges('R001');

      // Verify breakdown detected
      expect(triggers).toHaveLength(1);
      expect(triggers[0]?.type).toBe('vehicle_breakdown');
      expect(triggers[0]?.severity).toBe('critical');
    });

    it('should broadcast route updates after optimization', async () => {
      let broadcastReceived = false;
      let broadcastData: any = null;

      // Subscribe to route updates
      optimizer.on('route_updates', (broadcasts) => {
        broadcastReceived = true;
        broadcastData = broadcasts;
      });

      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'medium',
        description: 'Traffic congestion increased',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      // Start monitoring and perform optimization
      await optimizer.startRouteMonitoring([mockRoute]);
      await optimizer.performIncrementalReOptimization(trigger);

      // Wait for broadcast
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify broadcast
      expect(broadcastReceived).toBe(true);
      expect(broadcastData).toHaveLength(1);
      expect(broadcastData[0].routeId).toBe('route_V001');
      expect(broadcastData[0].updateType).toBe('alternative_route');
    });

    it('should respect re-optimization frequency limits', async () => {
      // Record multiple recent optimizations
      const now = new Date();
      optimizer['reOptimizationHistory'].set('R001', [
        new Date(now.getTime() - 5 * 60 * 1000),  // 5 minutes ago
        new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
        new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
        new Date(now.getTime() - 20 * 60 * 1000), // 20 minutes ago
        new Date(now.getTime() - 25 * 60 * 1000), // 25 minutes ago
        new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
        new Date(now.getTime() - 35 * 60 * 1000), // 35 minutes ago
        new Date(now.getTime() - 40 * 60 * 1000), // 40 minutes ago
        new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes ago
        new Date(now.getTime() - 50 * 60 * 1000)  // 50 minutes ago
      ]);

      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'medium',
        description: 'Traffic change',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      // Start monitoring
      await optimizer.startRouteMonitoring([mockRoute]);

      // Attempt re-optimization
      const result = await optimizer.performIncrementalReOptimization(trigger);

      // Should be blocked due to frequency limit
      expect(result.success).toBe(false);
      expect(result.message).toBe('Re-optimization frequency limit exceeded');
    });

    it('should handle service errors gracefully', async () => {
      // Mock services to throw errors
      mockTrafficService.getCurrentTraffic = jest.fn().mockRejectedValue(new Error('Traffic API error'));
      mockFleetService.getVehicle = jest.fn().mockRejectedValue(new Error('Fleet API error'));

      // Start monitoring
      await optimizer.startRouteMonitoring([mockRoute]);

      // Detect changes should not throw
      const triggers = await optimizer.detectSignificantChanges('R001');

      // Should return empty array on errors
      expect(triggers).toHaveLength(0);
    });

    it('should calculate traffic changes correctly', async () => {
      const oldTraffic: TrafficData = {
        area: { id: 'test-area', name: 'Test Area', boundaries: [mockRoute.stops[0]!.location], zoneType: 'commercial' },
        congestionLevel: 'moderate',
        averageSpeed: 30,
        travelTimeMultiplier: 1.2,
        timestamp: new Date(),
        source: 'cached'
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

    it('should complete optimization within performance targets', async () => {
      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'high',
        description: 'Performance test',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      // Start monitoring
      await optimizer.startRouteMonitoring([mockRoute]);

      const startTime = Date.now();
      const result = await optimizer.performIncrementalReOptimization(trigger);
      const endTime = Date.now();

      // Should complete within 30 seconds (requirement 6.2)
      expect(endTime - startTime).toBeLessThan(30000);
      expect(result.processingTime).toBeLessThan(30000);
      expect(result.success).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should emit monitoring_started event', async () => {
      let eventEmitted = false;
      let eventData: any = null;

      optimizer.on('monitoring_started', (data) => {
        eventEmitted = true;
        eventData = data;
      });

      await optimizer.startRouteMonitoring([mockRoute]);

      expect(eventEmitted).toBe(true);
      expect(eventData.routeCount).toBe(1);
    });

    it('should emit reoptimization_completed event', async () => {
      let eventEmitted = false;
      let eventData: any = null;

      optimizer.on('reoptimization_completed', (result) => {
        eventEmitted = true;
        eventData = result;
      });

      const trigger: ReOptimizationTrigger = {
        type: 'traffic_change',
        severity: 'critical',
        description: 'Critical traffic change',
        affectedRoutes: ['R001'],
        timestamp: new Date()
      };

      await optimizer.startRouteMonitoring([mockRoute]);
      await optimizer.performIncrementalReOptimization(trigger);

      expect(eventEmitted).toBe(true);
      expect(eventData.success).toBe(true);
    });
  });

  describe('Configuration Handling', () => {
    it('should use custom configuration settings', () => {
      const customConfig: RouteMonitoringConfig = {
        trafficCheckInterval: 2000,
        vehicleStatusCheckInterval: 1000,
        significantTrafficChangeThreshold: 30,
        significantDelayThreshold: 20,
        maxReOptimizationFrequency: 5,
        enableProactiveOptimization: false
      };

      const customOptimizer = new RealTimeRouteOptimizer(
        mockRoutingService as any,
        mockTrafficService as any,
        mockFleetService as any,
        customConfig
      );

      expect(customOptimizer['config']).toEqual(customConfig);
    });

    it('should use default configuration when not provided', () => {
      const defaultOptimizer = new RealTimeRouteOptimizer(
        mockRoutingService as any,
        mockTrafficService as any,
        mockFleetService as any
      );

      expect(defaultOptimizer['config'].trafficCheckInterval).toBe(5 * 60 * 1000);
      expect(defaultOptimizer['config'].maxReOptimizationFrequency).toBe(3);
    });
  });
});