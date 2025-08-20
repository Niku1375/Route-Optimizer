/**
 * Integration tests for FallbackHeuristicService
 * Tests the fallback algorithms with realistic scenarios
 */

import { FallbackHeuristicService } from '../FallbackHeuristicService';
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

describe('FallbackHeuristicService Integration Tests', () => {
  let service: FallbackHeuristicService;

  // Delhi locations for realistic testing
  const delhiLocations: GeoLocation[] = [
    { latitude: 28.6139, longitude: 77.2090, address: 'Connaught Place, New Delhi' },
    { latitude: 28.6507, longitude: 77.2334, address: 'Red Fort, New Delhi' },
    { latitude: 28.6129, longitude: 77.2295, address: 'India Gate, New Delhi' },
    { latitude: 28.5355, longitude: 77.3910, address: 'Noida Sector 18' },
    { latitude: 28.4595, longitude: 77.0266, address: 'Gurgaon Cyber City' },
    { latitude: 28.7041, longitude: 77.1025, address: 'Rohini, New Delhi' },
    { latitude: 28.5706, longitude: 77.3272, address: 'Lajpat Nagar, New Delhi' },
    { latitude: 28.6692, longitude: 77.4538, address: 'Ghaziabad' }
  ];

  const createVehicle = (id: string, type: Vehicle['type'], location: GeoLocation, capacity: { weight: number; volume: number }): Vehicle => ({
    id,
    type,
    capacity,
    location,
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
      plateNumber: `DL01${id}`,
      fuelType: 'diesel',
      vehicleAge: 2,
      registrationState: 'DL'
    },
    accessPrivileges: {
      residentialZones: true,
      commercialZones: true,
      industrialZones: true,
      restrictedHours: false,
      pollutionSensitiveZones: true,
      narrowLanes: type === 'three-wheeler'
    },
    driverInfo: {
      id: `D${id}`,
      workingHours: 0,
      maxWorkingHours: 8
    }
  });

  const createDelivery = (id: string, pickup: GeoLocation, delivery: GeoLocation, weight: number, priority: Delivery['priority']): Delivery => ({
    id,
    pickupLocation: pickup,
    deliveryLocation: delivery,
    timeWindow: {
      earliest: new Date('2024-01-15T09:00:00Z'),
      latest: new Date('2024-01-15T17:00:00Z')
    },
    shipment: {
      weight,
      volume: weight / 200, // Assume 200kg per cubic meter
      fragile: false,
      specialHandling: []
    },
    priority
  });

  const createDistanceMatrix = (locations: GeoLocation[]): DistanceMatrix => {
    const n = locations.length;
    const distances: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const durations: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          distances[i]![j] = 0;
          durations[i]![j] = 0;
        } else {
          // Calculate Haversine distance
          const R = 6371;
          const dLat = (locations[j]!.latitude - locations[i]!.latitude) * Math.PI / 180;
          const dLon = (locations[j]!.longitude - locations[i]!.longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(locations[i]!.latitude * Math.PI / 180) * Math.cos(locations[j]!.latitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          distances[i]![j] = distance;
          durations[i]![j] = Math.round((distance / 25) * 60); // 25 km/h average speed in Delhi
        }
      }
    }

    return { distances, durations };
  };

  beforeEach(() => {
    service = new FallbackHeuristicService();
  });

  describe('Realistic Delhi Logistics Scenarios', () => {
    it('should handle mixed vehicle fleet with various delivery priorities', async () => {
      const vehicles = [
        createVehicle('V001', 'truck', delhiLocations[0]!, { weight: 5000, volume: 25 }),
        createVehicle('V002', 'van', delhiLocations[1]!, { weight: 1500, volume: 8 }),
        createVehicle('V003', 'tempo', delhiLocations[2]!, { weight: 1000, volume: 5 }),
        createVehicle('V004', 'three-wheeler', delhiLocations[3]!, { weight: 300, volume: 1.5 })
      ];

      const deliveries = [
        createDelivery('D001', delhiLocations[0]!, delhiLocations[4]!, 2000, 'urgent'),
        createDelivery('D002', delhiLocations[1]!, delhiLocations[5]!, 800, 'high'),
        createDelivery('D003', delhiLocations[2]!, delhiLocations[6]!, 500, 'medium'),
        createDelivery('D004', delhiLocations[3]!, delhiLocations[7]!, 200, 'low'),
        createDelivery('D005', delhiLocations[4]!, delhiLocations[0]!, 1200, 'high'),
        createDelivery('D006', delhiLocations[5]!, delhiLocations[1]!, 300, 'medium')
      ];

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      // Test Nearest Neighbor Algorithm
      const nnResult = await service.nearestNeighborAlgorithm(request, distanceMatrix);
      
      expect(nnResult.feasible).toBe(true);
      expect(nnResult.routes.length).toBeGreaterThan(0);
      expect(nnResult.totalDistance).toBeGreaterThan(0);
      expect(nnResult.processingTime).toBeLessThan(5000);

      // Verify urgent delivery is assigned
      const urgentDeliveryAssigned = nnResult.routes.some(route => 
        route.deliveryIds?.includes('D001')
      );
      expect(urgentDeliveryAssigned).toBe(true);

      // Test Greedy Assignment Algorithm
      const greedyResult = await service.greedyAssignmentHeuristic(request, distanceMatrix);
      
      expect(greedyResult.feasible).toBe(true);
      expect(greedyResult.routes.length).toBeGreaterThan(0);
      expect(greedyResult.totalDistance).toBeGreaterThan(0);
      expect(greedyResult.processingTime).toBeLessThan(5000);

      // Test Emergency Routing
      const emergencyResult = await service.emergencyRouteOptimization(request, distanceMatrix);
      
      expect(emergencyResult.routes.length).toBeGreaterThan(0);
      expect(emergencyResult.processingTime).toBeLessThan(1000);

      // Emergency should be fastest
      expect(emergencyResult.processingTime).toBeLessThan(nnResult.processingTime);
      expect(emergencyResult.processingTime).toBeLessThan(greedyResult.processingTime);
    });

    it('should handle capacity-constrained scenarios', async () => {
      // Create scenario where total delivery weight exceeds individual vehicle capacity
      const vehicles = [
        createVehicle('V001', 'van', delhiLocations[0]!, { weight: 1000, volume: 5 }),
        createVehicle('V002', 'tempo', delhiLocations[1]!, { weight: 800, volume: 4 })
      ];

      const deliveries = [
        createDelivery('D001', delhiLocations[0]!, delhiLocations[2]!, 900, 'high'),
        createDelivery('D002', delhiLocations[1]!, delhiLocations[3]!, 700, 'medium'),
        createDelivery('D003', delhiLocations[2]!, delhiLocations[4]!, 600, 'low'),
        createDelivery('D004', delhiLocations[3]!, delhiLocations[5]!, 1200, 'urgent') // Exceeds any single vehicle
      ];

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      const result = await service.greedyAssignmentHeuristic(request, distanceMatrix, {
        prioritizeByCapacity: true,
        allowPartialAssignment: true
      });

      // Should have some unassigned deliveries due to capacity constraints
      expect(result.unassignedDeliveries.length).toBeGreaterThan(0);
      
      // The oversized delivery should be unassigned
      const oversizedDeliveryUnassigned = result.unassignedDeliveries.some(d => d.id === 'D004');
      expect(oversizedDeliveryUnassigned).toBe(true);

      // Other deliveries should be assigned respecting capacity
      for (const route of result.routes) {
        const vehicle = vehicles.find(v => v.id === route.vehicleId);
        const totalWeight = route.deliveryIds?.reduce((sum, deliveryId) => {
          const delivery = deliveries.find(d => d.id === deliveryId);
          return sum + (delivery?.shipment.weight || 0);
        }, 0) || 0;

        expect(totalWeight).toBeLessThanOrEqual(vehicle!.capacity.weight);
      }
    });

    it('should prioritize urgent deliveries in emergency scenarios', async () => {
      const vehicles = [
        createVehicle('V001', 'van', delhiLocations[0]!, { weight: 1000, volume: 5 }),
        createVehicle('V002', 'tempo', delhiLocations[1]!, { weight: 800, volume: 4 })
      ];

      const deliveries = [
        createDelivery('D001', delhiLocations[0]!, delhiLocations[2]!, 500, 'low'),
        createDelivery('D002', delhiLocations[1]!, delhiLocations[3]!, 400, 'medium'),
        createDelivery('D003', delhiLocations[2]!, delhiLocations[4]!, 300, 'urgent'),
        createDelivery('D004', delhiLocations[3]!, delhiLocations[5]!, 600, 'high')
      ];

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      const result = await service.emergencyRouteOptimization(request, distanceMatrix, {
        prioritizeUrgentDeliveries: true
      });

      // Urgent delivery should be assigned first
      expect(result.routes[0]?.deliveryIds).toContain('D003');
    });

    it('should handle vehicle breakdown scenarios with remaining fleet', async () => {
      const vehicles = [
        createVehicle('V001', 'truck', delhiLocations[0]!, { weight: 5000, volume: 25 }),
        { ...createVehicle('V002', 'van', delhiLocations[1]!, { weight: 1500, volume: 8 }), status: 'breakdown' as const },
        createVehicle('V003', 'tempo', delhiLocations[2]!, { weight: 1000, volume: 5 })
      ];

      const deliveries = [
        createDelivery('D001', delhiLocations[0]!, delhiLocations[3]!, 800, 'high'),
        createDelivery('D002', delhiLocations[1]!, delhiLocations[4]!, 600, 'medium'),
        createDelivery('D003', delhiLocations[2]!, delhiLocations[5]!, 400, 'low')
      ];

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      const result = await service.nearestNeighborAlgorithm(request, distanceMatrix);

      // Should only use available vehicles (V001 and V003)
      const usedVehicleIds = result.routes.map(route => route.vehicleId);
      expect(usedVehicleIds).not.toContain('V002'); // Broken vehicle should not be used
      expect(usedVehicleIds).toContain('V001');
      expect(usedVehicleIds).toContain('V003');
    });

    it('should demonstrate performance differences between algorithms', async () => {
      // Create larger scenario to show performance differences
      const vehicles = Array.from({ length: 10 }, (_, i) => 
        createVehicle(`V${i.toString().padStart(3, '0')}`, 'van', delhiLocations[i % delhiLocations.length]!, { weight: 1000, volume: 5 })
      );

      const deliveries = Array.from({ length: 20 }, (_, i) => 
        createDelivery(
          `D${i.toString().padStart(3, '0')}`, 
          delhiLocations[i % delhiLocations.length]!, 
          delhiLocations[(i + 1) % delhiLocations.length]!, 
          300 + (i * 50), 
          ['low', 'medium', 'high', 'urgent'][i % 4] as Delivery['priority']
        )
      );

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      // Test all algorithms
      const nnResult = await service.nearestNeighborAlgorithm(request, distanceMatrix);
      const greedyResult = await service.greedyAssignmentHeuristic(request, distanceMatrix);
      const emergencyResult = await service.emergencyRouteOptimization(request, distanceMatrix);

      // Emergency should be fastest
      expect(emergencyResult.processingTime).toBeLessThan(nnResult.processingTime);
      expect(emergencyResult.processingTime).toBeLessThan(greedyResult.processingTime);

      // All should complete within reasonable time
      expect(nnResult.processingTime).toBeLessThan(10000);
      expect(greedyResult.processingTime).toBeLessThan(10000);
      expect(emergencyResult.processingTime).toBeLessThan(2000);

      // All should produce feasible solutions
      expect(nnResult.feasible).toBe(true);
      expect(greedyResult.feasible).toBe(true);
      expect(emergencyResult.routes.length).toBeGreaterThan(0);
    });
  });

  describe('Algorithm Comparison and Performance', () => {
    it('should compare algorithms against mock OR-Tools results', async () => {
      const vehicles = [
        createVehicle('V001', 'van', delhiLocations[0]!, { weight: 1000, volume: 5 }),
        createVehicle('V002', 'tempo', delhiLocations[1]!, { weight: 800, volume: 4 })
      ];

      const deliveries = [
        createDelivery('D001', delhiLocations[0]!, delhiLocations[2]!, 500, 'high'),
        createDelivery('D002', delhiLocations[1]!, delhiLocations[3]!, 400, 'medium')
      ];

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      const heuristicResult = await service.nearestNeighborAlgorithm(request, distanceMatrix);

      // Mock OR-Tools result (slightly better)
      const mockORToolsResult = {
        success: true,
        routes: [],
        totalDistance: heuristicResult.totalDistance * 0.9, // 10% better
        totalDuration: heuristicResult.totalDuration * 0.9,
        totalCost: 100,
        optimizationTime: 8000, // Slower than heuristic
        algorithmUsed: 'OR_TOOLS_VRP',
        objectiveValue: heuristicResult.totalDistance * 0.9
      };

      const comparison = service.compareHeuristicPerformance(heuristicResult, mockORToolsResult);

      expect(comparison.distanceComparison).toBeCloseTo(11.11, 1); // ~11% worse
      expect(comparison.performanceRatio).toBeLessThan(1); // Heuristic should be faster
      expect(comparison.feasibilityComparison).toBe(true);
      expect(comparison.recommendation).toContain('acceptable');
    });

    it('should handle edge cases and error conditions', async () => {
      // Test with no vehicles
      const emptyVehicleRequest: RoutingRequest = {
        vehicles: [],
        deliveries: [createDelivery('D001', delhiLocations[0]!, delhiLocations[1]!, 500, 'high')],
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

      const distanceMatrix = createDistanceMatrix(delhiLocations);

      const result = await service.nearestNeighborAlgorithm(emptyVehicleRequest, distanceMatrix);

      expect(result.feasible).toBe(false);
      expect(result.routes).toHaveLength(0);
      expect(result.unassignedDeliveries).toHaveLength(1);
    });

    it('should validate algorithm configurations', async () => {
      const vehicles = [createVehicle('V001', 'van', delhiLocations[0]!, { weight: 1000, volume: 5 })];
      const deliveries = [createDelivery('D001', delhiLocations[0]!, delhiLocations[1]!, 500, 'high')];
      const distanceMatrix = createDistanceMatrix(delhiLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      // Test different configurations
      const configs = [
        { considerCapacityConstraints: true, considerTimeWindows: true, considerComplianceRules: true },
        { considerCapacityConstraints: false, considerTimeWindows: false, considerComplianceRules: false }
      ];

      for (const config of configs) {
        const result = await service.nearestNeighborAlgorithm(request, distanceMatrix, config);
        expect(result.algorithmUsed).toBe('NEAREST_NEIGHBOR');
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });
  });

  describe('Real-world Performance Benchmarks', () => {
    it('should meet performance requirements for typical Delhi operations', async () => {
      // Simulate typical Delhi logistics operation
      const vehicles = [
        createVehicle('V001', 'truck', delhiLocations[0]!, { weight: 5000, volume: 25 }),
        createVehicle('V002', 'truck', delhiLocations[1]!, { weight: 5000, volume: 25 }),
        createVehicle('V003', 'van', delhiLocations[2]!, { weight: 1500, volume: 8 }),
        createVehicle('V004', 'van', delhiLocations[3]!, { weight: 1500, volume: 8 }),
        createVehicle('V005', 'tempo', delhiLocations[4]!, { weight: 1000, volume: 5 }),
        createVehicle('V006', 'three-wheeler', delhiLocations[5]!, { weight: 300, volume: 1.5 })
      ];

      const deliveries = Array.from({ length: 15 }, (_, i) => 
        createDelivery(
          `D${i.toString().padStart(3, '0')}`, 
          delhiLocations[i % delhiLocations.length]!, 
          delhiLocations[(i + 2) % delhiLocations.length]!, 
          200 + (i * 100), 
          ['low', 'medium', 'high', 'urgent'][i % 4] as Delivery['priority']
        )
      );

      const allLocations = [...delhiLocations, ...vehicles.map(v => v.location)];
      const distanceMatrix = createDistanceMatrix(allLocations);

      const request: RoutingRequest = {
        vehicles,
        deliveries,
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

      // Test performance requirements
      const startTime = Date.now();
      const result = await service.nearestNeighborAlgorithm(request, distanceMatrix);
      const endTime = Date.now();

      // Should complete within 10 seconds for typical batch sizes (requirement 5.2)
      expect(endTime - startTime).toBeLessThan(10000);
      expect(result.processingTime).toBeLessThan(10000);
      
      // Should produce feasible solution
      expect(result.feasible).toBe(true);
      expect(result.routes.length).toBeGreaterThan(0);
      
      // Should assign most deliveries
      const assignedDeliveries = result.routes.reduce((sum, route) => sum + (route.deliveryIds?.length || 0), 0);
      expect(assignedDeliveries).toBeGreaterThan(deliveries.length * 0.8); // At least 80% assigned
    });
  });
});