/**
 * Unit tests for FallbackHeuristicService
 */

import { FallbackHeuristicService, NearestNeighborConfig, GreedyAssignmentConfig, EmergencyRoutingConfig } from '../FallbackHeuristicService';
import { RoutingRequest, DistanceMatrix } from '../RoutingService';
import { Vehicle } from '../../models/Vehicle';
import { Delivery } from '../../models/Delivery';

import { GeoLocation } from '../../models/GeoLocation';

// Mock DelhiComplianceService
jest.mock('../DelhiComplianceService', () => ({
  DelhiComplianceService: jest.fn().mockImplementation(() => ({
    checkOddEvenCompliance: jest.fn().mockReturnValue({ isCompliant: true, plateNumber: 'DL01AB1234' })
  }))
}));

describe('FallbackHeuristicService', () => {
  let service: FallbackHeuristicService;

  const mockLocation1: GeoLocation = {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'Connaught Place, New Delhi'
  };

  const mockLocation2: GeoLocation = {
    latitude: 28.6200,
    longitude: 77.2200,
    address: 'Karol Bagh, New Delhi'
  };

  const mockLocation3: GeoLocation = {
    latitude: 28.6300,
    longitude: 77.2300,
    address: 'Rajouri Garden, New Delhi'
  };

  const mockVehicle1: Vehicle = {
    id: 'V001',
    type: 'van',
    capacity: { weight: 1000, volume: 5, maxDimensions: { length: 6, width: 2.5, height: 3 } },
    location: mockLocation1,
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
    , name: "Test Driver", licenseNumber: "DL123456789", contactNumber: "+91-9876543210" }
  };

  const mockVehicle2: Vehicle = {
    ...mockVehicle1,
    id: 'V002',
    capacity: { weight: 1500, volume: 8, maxDimensions: { length: 6, width: 2.5, height: 3 } },
    location: mockLocation2,
    vehicleSpecs: {
      ...mockVehicle1.vehicleSpecs,
      plateNumber: 'DL02CD5678'
    }
  };

  const mockDelivery1: Delivery = {
    id: 'D001',
    pickupLocation: mockLocation1,
    deliveryLocation: mockLocation2,
    timeWindow: {
      earliest: new Date('2024-01-15T09:00:00Z'),
      latest: new Date('2024-01-15T17:00:00Z')
    },
    shipment: {
      weight: 500,
      volume: 2,
      fragile: false,
      specialHandling: []
    , hazardous: false, temperatureControlled: false },
    priority: 'medium'
  };

  const mockDelivery2: Delivery = {
    id: 'D002',
    pickupLocation: mockLocation2,
    deliveryLocation: mockLocation3,
    timeWindow: {
      earliest: new Date('2024-01-15T10:00:00Z'),
      latest: new Date('2024-01-15T18:00:00Z')
    },
    shipment: {
      weight: 300,
      volume: 1.5,
      fragile: true,
      specialHandling: ['fragile']
    },
    priority: 'high'
  };

  const mockDelivery3: Delivery = {
    id: 'D003',
    pickupLocation: mockLocation3,
    deliveryLocation: mockLocation1,
    timeWindow: {
      earliest: new Date('2024-01-15T08:00:00Z'),
      latest: new Date('2024-01-15T16:00:00Z')
    },
    shipment: {
      weight: 800,
      volume: 3,
      fragile: false,
      specialHandling: []
    , hazardous: false, temperatureControlled: false },
    priority: 'urgent'
  };

  const mockRoutingRequest: RoutingRequest = {
    vehicles: [mockVehicle1, mockVehicle2],
    deliveries: [mockDelivery1, mockDelivery2, mockDelivery3],
    hubs: [],
    constraints: {
      vehicleCapacityConstraints: true,
      timeWindowConstraints: true,
      hubSequencing: false
    },
    timeWindow: {
      earliest: new Date('2024-01-15T08:00:00Z'),
      latest: new Date('2024-01-15T18:00:00Z')
    }
  };

  const mockDistanceMatrix: DistanceMatrix = {
    distances: [
      [0, 5, 10],
      [5, 0, 8],
      [10, 8, 0]
    ],
    durations: [
      [0, 15, 30],
      [15, 0, 24],
      [30, 24, 0]
    ]
  };

  beforeEach(() => {
    service = new FallbackHeuristicService();
  });

  describe('Nearest Neighbor Algorithm', () => {
    it('should create feasible routes using nearest neighbor', async () => {
      const config: NearestNeighborConfig = {
        startFromDepot: true,
        considerCapacityConstraints: true,
        considerTimeWindows: true,
        considerComplianceRules: true
      };

      const result = await service.nearestNeighborAlgorithm(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      expect(result.feasible).toBe(true);
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.algorithmUsed).toBe('NEAREST_NEIGHBOR');
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should respect capacity constraints', async () => {
      const config: NearestNeighborConfig = {
        startFromDepot: true,
        considerCapacityConstraints: true,
        considerTimeWindows: false,
        considerComplianceRules: false
      };

      const result = await service.nearestNeighborAlgorithm(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      // Check that no route exceeds vehicle capacity
      for (const route of result.routes) {
        const vehicle = mockRoutingRequest.vehicles.find(v => v.id === route.vehicleId);
        expect(vehicle).toBeDefined();

        const totalWeight = route.deliveryIds?.reduce((sum, deliveryId) => {
          const delivery = mockRoutingRequest.deliveries.find(d => d.id === deliveryId);
          return sum + (delivery?.shipment.weight || 0);
        }, 0) || 0;

        expect(totalWeight).toBeLessThanOrEqual(vehicle!.capacity.weight);
      }
    });

    it('should handle case with no available vehicles', async () => {
      const requestWithNoVehicles = {
        ...mockRoutingRequest,
        vehicles: mockRoutingRequest.vehicles.map(v => ({ ...v, status: 'maintenance' as const }))
      };

      const result = await service.nearestNeighborAlgorithm(
        requestWithNoVehicles,
        mockDistanceMatrix
      );

      expect(result.feasible).toBe(false);
      expect(result.routes).toHaveLength(0);
      expect(result.unassignedDeliveries).toHaveLength(3);
    });

    it('should assign deliveries to nearest available vehicles', async () => {
      const config: NearestNeighborConfig = {
        startFromDepot: true,
        considerCapacityConstraints: false,
        considerTimeWindows: false,
        considerComplianceRules: false
      };

      const result = await service.nearestNeighborAlgorithm(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      expect(result.routes.length).toBeGreaterThan(0);
      
      // Each route should have pickup and delivery stops
      for (const route of result.routes) {
        expect(route.stops.length).toBeGreaterThanOrEqual(2);
        
        // Should have equal number of pickup and delivery stops
        const pickupStops = route.stops.filter(stop => stop.type === 'pickup');
        const deliveryStops = route.stops.filter(stop => stop.type === 'delivery');
        expect(pickupStops.length).toBe(deliveryStops.length);
      }
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await service.nearestNeighborAlgorithm(
        mockRoutingRequest,
        mockDistanceMatrix
      );
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processingTime).toBeLessThan(5000);
    });
  });

  describe('Greedy Assignment Heuristic', () => {
    it('should create feasible routes using greedy assignment', async () => {
      const config: GreedyAssignmentConfig = {
        prioritizeByDistance: true,
        prioritizeByCapacity: true,
        prioritizeByTimeWindow: true,
        allowPartialAssignment: true
      };

      const result = await service.greedyAssignmentHeuristic(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      expect(result.feasible).toBe(true);
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.algorithmUsed).toBe('GREEDY_ASSIGNMENT');
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should prioritize high priority deliveries', async () => {
      const config: GreedyAssignmentConfig = {
        prioritizeByDistance: true,
        prioritizeByCapacity: true,
        prioritizeByTimeWindow: true,
        allowPartialAssignment: true
      };

      const result = await service.greedyAssignmentHeuristic(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      // Urgent delivery (D003) should be assigned
      const urgentDeliveryAssigned = result.routes.some(route => 
        route.deliveryIds?.includes('D003')
      );
      expect(urgentDeliveryAssigned).toBe(true);
    });

    it('should respect capacity constraints in greedy assignment', async () => {
      const config: GreedyAssignmentConfig = {
        prioritizeByDistance: false,
        prioritizeByCapacity: true,
        prioritizeByTimeWindow: false,
        allowPartialAssignment: false
      };

      const result = await service.greedyAssignmentHeuristic(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      // Verify capacity constraints
      for (const route of result.routes) {
        const vehicle = mockRoutingRequest.vehicles.find(v => v.id === route.vehicleId);
        expect(vehicle).toBeDefined();

        const totalWeight = route.deliveryIds?.reduce((sum, deliveryId) => {
          const delivery = mockRoutingRequest.deliveries.find(d => d.id === deliveryId);
          return sum + (delivery?.shipment.weight || 0);
        }, 0) || 0;

        expect(totalWeight).toBeLessThanOrEqual(vehicle!.capacity.weight);
      }
    });

    it('should handle partial assignment when enabled', async () => {
      // Create a scenario where not all deliveries can be assigned
      const overloadedRequest = {
        ...mockRoutingRequest,
        deliveries: [
          ...mockRoutingRequest.deliveries,
          {
            ...mockDelivery1,
            id: 'D004',
            shipment: { weight: 2000, volume: 10, fragile: false, specialHandling: [] , hazardous: false, temperatureControlled: false } // Exceeds any vehicle capacity
          }
        ]
      };

      const config: GreedyAssignmentConfig = {
        prioritizeByDistance: true,
        prioritizeByCapacity: true,
        prioritizeByTimeWindow: true,
        allowPartialAssignment: true
      };

      const result = await service.greedyAssignmentHeuristic(
        overloadedRequest,
        mockDistanceMatrix,
        config
      );

      expect(result.unassignedDeliveries.length).toBeGreaterThan(0);
      expect(result.feasible).toBe(false);
    });
  });

  describe('Emergency Route Optimization', () => {
    it('should create simple emergency routes', async () => {
      const config: EmergencyRoutingConfig = {
        maxRouteDistance: 200,
        maxRouteDuration: 480,
        ignoreNonCriticalConstraints: true,
        prioritizeUrgentDeliveries: true
      };

      const result = await service.emergencyRouteOptimization(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      expect(result.algorithmUsed).toBe('EMERGENCY_ROUTING');
      expect(result.routes.length).toBeGreaterThan(0);
      
      // Each route should be simple (one delivery per vehicle)
      for (const route of result.routes) {
        expect(route.deliveryIds).toHaveLength(1);
        expect(route.stops).toHaveLength(2); // pickup + delivery
      }
    });

    it('should prioritize urgent deliveries in emergency mode', async () => {
      const config: EmergencyRoutingConfig = {
        maxRouteDistance: 200,
        maxRouteDuration: 480,
        ignoreNonCriticalConstraints: true,
        prioritizeUrgentDeliveries: true
      };

      const result = await service.emergencyRouteOptimization(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      // First route should contain the urgent delivery (D003)
      expect(result.routes[0]?.deliveryIds).toContain('D003');
    });

    it('should respect emergency constraints', async () => {
      const config: EmergencyRoutingConfig = {
        maxRouteDistance: 5, // Very restrictive
        maxRouteDuration: 30, // Very restrictive
        ignoreNonCriticalConstraints: true,
        prioritizeUrgentDeliveries: true
      };

      const result = await service.emergencyRouteOptimization(
        mockRoutingRequest,
        mockDistanceMatrix,
        config
      );

      // Some deliveries might not be assigned due to restrictive constraints
      for (const route of result.routes) {
        expect(route.estimatedDistance).toBeLessThanOrEqual(config.maxRouteDistance);
        expect(route.estimatedDuration).toBeLessThanOrEqual(config.maxRouteDuration);
      }
    });

    it('should handle no available vehicles in emergency mode', async () => {
      const requestWithNoVehicles = {
        ...mockRoutingRequest,
        vehicles: []
      };

      const result = await service.emergencyRouteOptimization(
        requestWithNoVehicles,
        mockDistanceMatrix
      );

      expect(result.feasible).toBe(false);
      expect(result.routes).toHaveLength(0);
      expect(result.unassignedDeliveries).toHaveLength(3);
    });

    it('should be fastest algorithm', async () => {
      const startTime = Date.now();
      
      const result = await service.emergencyRouteOptimization(
        mockRoutingRequest,
        mockDistanceMatrix
      );
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.processingTime).toBeLessThan(1000);
    });
  });

  describe('Performance Comparison', () => {
    it('should compare heuristic performance against OR-Tools results', () => {
      const heuristicResult = {
        routes: [],
        totalDistance: 100,
        totalDuration: 300,
        algorithmUsed: 'NEAREST_NEIGHBOR',
        processingTime: 1000,
        feasible: true,
        unassignedDeliveries: []
      };

      const orToolsResult = {
        success: true,
        routes: [],
        totalDistance: 90,
        totalDuration: 280,
        totalCost: 150,
        optimizationTime: 5000,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: 90
      };

      const comparison = service.compareHeuristicPerformance(heuristicResult, orToolsResult);

      expect(comparison.distanceComparison).toBeCloseTo(11.11, 1); // ~11% worse
      expect(comparison.durationComparison).toBeCloseTo(7.14, 1); // ~7% worse
      expect(comparison.performanceRatio).toBe(0.2); // 5x faster
      expect(comparison.feasibilityComparison).toBe(true);
      expect(comparison.recommendation).toContain('acceptable');
    });

    it('should handle comparison when OR-Tools result is not available', () => {
      const heuristicResult = {
        routes: [],
        totalDistance: 100,
        totalDuration: 300,
        algorithmUsed: 'NEAREST_NEIGHBOR',
        processingTime: 1000,
        feasible: true,
        unassignedDeliveries: []
      };

      const comparison = service.compareHeuristicPerformance(heuristicResult);

      expect(comparison.distanceComparison).toBe(0);
      expect(comparison.durationComparison).toBe(0);
      expect(comparison.performanceRatio).toBe(1);
      expect(comparison.recommendation).toContain('not available');
    });

    it('should identify significantly suboptimal heuristic solutions', () => {
      const heuristicResult = {
        routes: [],
        totalDistance: 200, // Much worse
        totalDuration: 500, // Much worse
        algorithmUsed: 'NEAREST_NEIGHBOR',
        processingTime: 1000,
        feasible: true,
        unassignedDeliveries: []
      };

      const orToolsResult = {
        success: true,
        routes: [],
        totalDistance: 100,
        totalDuration: 250,
        totalCost: 150,
        optimizationTime: 5000,
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: 100
      };

      const comparison = service.compareHeuristicPerformance(heuristicResult, orToolsResult);

      expect(comparison.distanceComparison).toBe(100); // 100% worse
      expect(comparison.durationComparison).toBe(100); // 100% worse
      expect(comparison.recommendation).toContain('significantly suboptimal');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully in nearest neighbor algorithm', async () => {
      // Create invalid distance matrix
      const invalidDistanceMatrix: DistanceMatrix = {
        distances: [[]], // Invalid structure
        durations: [[]]
      };

      const result = await service.nearestNeighborAlgorithm(
        mockRoutingRequest,
        invalidDistanceMatrix
      );

      expect(result.feasible).toBe(false);
      expect(result.routes).toHaveLength(0);
      expect(result.unassignedDeliveries).toHaveLength(3);
    });

    it('should handle errors gracefully in greedy assignment', async () => {
      // Create request with invalid data
      const invalidRequest = {
        ...mockRoutingRequest,
        deliveries: [
          {
            ...mockDelivery1,
            shipment: {
              weight: -100, // Invalid weight
              volume: -5,   // Invalid volume
              fragile: false,
              specialHandling: []
            }
          }
        ]
      };

      const result = await service.greedyAssignmentHeuristic(
        invalidRequest,
        mockDistanceMatrix
      );

      expect(result.feasible).toBe(false);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle errors gracefully in emergency optimization', async () => {
      // Create request with null/undefined values
      const invalidRequest = {
        ...mockRoutingRequest,
        vehicles: [
          {
            ...mockVehicle1,
            location: {
              latitude: NaN,
              longitude: NaN,
              address: ''
            }
          }
        ]
      };

      const result = await service.emergencyRouteOptimization(
        invalidRequest,
        mockDistanceMatrix
      );

      expect(result.feasible).toBe(false);
      expect(result.algorithmUsed).toBe('EMERGENCY_ROUTING');
    });
  });

  describe('Algorithm Configuration', () => {
    it('should respect different nearest neighbor configurations', async () => {
      const configs = [
        { considerCapacityConstraints: true, considerTimeWindows: true },
        { considerCapacityConstraints: false, considerTimeWindows: false },
        { considerCapacityConstraints: true, considerTimeWindows: false }
      ];

      for (const config of configs) {
        const result = await service.nearestNeighborAlgorithm(
          mockRoutingRequest,
          mockDistanceMatrix,
          config
        );

        expect(result.algorithmUsed).toBe('NEAREST_NEIGHBOR');
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });

    it('should respect different greedy assignment configurations', async () => {
      const configs = [
        { prioritizeByDistance: true, prioritizeByCapacity: false },
        { prioritizeByDistance: false, prioritizeByCapacity: true },
        { prioritizeByDistance: true, prioritizeByCapacity: true }
      ];

      for (const config of configs) {
        const result = await service.greedyAssignmentHeuristic(
          mockRoutingRequest,
          mockDistanceMatrix,
          config
        );

        expect(result.algorithmUsed).toBe('GREEDY_ASSIGNMENT');
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });

    it('should respect different emergency routing configurations', async () => {
      const configs = [
        { prioritizeUrgentDeliveries: true, ignoreNonCriticalConstraints: true },
        { prioritizeUrgentDeliveries: false, ignoreNonCriticalConstraints: false },
        { maxRouteDistance: 50, maxRouteDuration: 120 }
      ];

      for (const config of configs) {
        const result = await service.emergencyRouteOptimization(
          mockRoutingRequest,
          mockDistanceMatrix,
          config
        );

        expect(result.algorithmUsed).toBe('EMERGENCY_ROUTING');
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });
  });
});