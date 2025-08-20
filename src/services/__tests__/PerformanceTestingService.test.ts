/**
 * Comprehensive tests for Performance Testing Service
 * Tests load testing, stress testing, latency testing, and scalability validation
 */

import { PerformanceTestingService, PerformanceTestConfig, StressTestConfig } from '../PerformanceTestingService';
import { DemoScenarioGenerator } from '../DemoScenarioGenerator';
import { RoutingService } from '../RoutingService';
import { VehicleSearchService } from '../VehicleSearchService';
import { DelhiComplianceService } from '../DelhiComplianceService';

// Mock dependencies
jest.mock('../DemoScenarioGenerator');
jest.mock('../RoutingService');
jest.mock('../VehicleSearchService');
jest.mock('../DelhiComplianceService');

describe('PerformanceTestingService', () => {
  let performanceTestingService: PerformanceTestingService;
  let mockDemoGenerator: jest.Mocked<DemoScenarioGenerator>;
  let mockRoutingService: jest.Mocked<RoutingService>;
  let mockVehicleSearchService: jest.Mocked<VehicleSearchService>;
  let mockComplianceService: jest.Mocked<DelhiComplianceService>;

  beforeEach(() => {
    mockDemoGenerator = new DemoScenarioGenerator({} as any, {} as any, {} as any) as jest.Mocked<DemoScenarioGenerator>;
    mockRoutingService = {
      optimizeRoutes: jest.fn()
    } as any;
    mockVehicleSearchService = {} as any;
    mockComplianceService = {} as any;

    performanceTestingService = new PerformanceTestingService(
      mockDemoGenerator,
      mockRoutingService,
      mockVehicleSearchService,
      mockComplianceService
    );

    // Setup default successful routing response
    mockRoutingService.optimizeRoutes.mockResolvedValue({
      success: true,
      routes: [
        {
          id: 'test_route_1',
          vehicleId: 'TEST_VEHICLE_1',
          stops: [],
          estimatedDuration: 3600,
          estimatedDistance: 15000,
          estimatedFuelConsumption: 5.0,
          trafficFactors: [],
          status: 'planned'
        }
      ],
      summary: {
        totalDistance: 15000,
        totalDuration: 3600,
        totalFuelConsumption: 5.0,
        vehicleUtilization: 80,
        routeEfficiency: 85
      },
      optimizationMetrics: {
        algorithmUsed: 'OR-Tools',
        solutionTime: 2.5,
        iterations: 100,
        constraintsApplied: ['capacity', 'time_windows']
      }
    });
  });

  describe('Load Testing', () => {
    it('should run routing optimization load test successfully', async () => {
      const config: PerformanceTestConfig = {
        testName: 'Basic Load Test',
        description: 'Test concurrent routing requests',
        concurrentRequests: 5,
        totalRequests: 20,
        vehicleCount: 10,
        deliveryCount: 20,
        hubCount: 3,
        timeoutMs: 10000,
        targetResponseTime: 5000,
        targetThroughput: 10
      };

      const result = await performanceTestingService.runRoutingOptimizationLoadTest(config);

      expect(result).toBeDefined();
      expect(result.testName).toBe('Basic Load Test');
      expect(result.totalRequests).toBe(20);
      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.failedRequests).toBeGreaterThanOrEqual(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.performanceMetrics).toHaveLength(20);

      // Verify routing service was called for each request
      expect(mockRoutingService.optimizeRoutes).toHaveBeenCalledTimes(20);
    });

    it('should handle routing service failures gracefully', async () => {
      // Mock some failures
      mockRoutingService.optimizeRoutes
        .mockResolvedValueOnce({} as any) // Success
        .mockRejectedValueOnce(new Error('Routing failed')) // Failure
        .mockResolvedValueOnce({} as any) // Success
        .mockRejectedValueOnce(new Error('Timeout')) // Failure
        .mockResolvedValueOnce({} as any); // Success

      const config: PerformanceTestConfig = {
        testName: 'Failure Handling Test',
        description: 'Test handling of routing failures',
        concurrentRequests: 2,
        totalRequests: 5,
        vehicleCount: 5,
        deliveryCount: 10,
        hubCount: 2,
        timeoutMs: 5000,
        targetResponseTime: 3000,
        targetThroughput: 5
      };

      const result = await performanceTestingService.runRoutingOptimizationLoadTest(config);

      expect(result.totalRequests).toBe(5);
      expect(result.successfulRequests).toBe(3);
      expect(result.failedRequests).toBe(2);
      expect(result.errorRate).toBe(40); // 2/5 * 100

      // Check that error messages are captured
      const failedMetrics = result.performanceMetrics.filter(m => !m.success);
      expect(failedMetrics).toHaveLength(2);
      expect(failedMetrics.every(m => m.errorMessage)).toBe(true);
    });

    it('should calculate performance metrics correctly', async () => {
      const config: PerformanceTestConfig = {
        testName: 'Metrics Calculation Test',
        description: 'Test performance metrics calculation',
        concurrentRequests: 3,
        totalRequests: 9,
        vehicleCount: 8,
        deliveryCount: 15,
        hubCount: 2,
        timeoutMs: 8000,
        targetResponseTime: 4000,
        targetThroughput: 8
      };

      const result = await performanceTestingService.runRoutingOptimizationLoadTest(config);

      // Verify metrics structure
      expect(result.memoryUsage.initial).toBeGreaterThan(0);
      expect(result.memoryUsage.peak).toBeGreaterThanOrEqual(result.memoryUsage.initial);
      expect(result.memoryUsage.final).toBeGreaterThan(0);

      expect(result.cpuUsage.average).toBeGreaterThan(0);
      expect(result.cpuUsage.peak).toBeGreaterThanOrEqual(result.cpuUsage.average);

      expect(result.minResponseTime).toBeLessThanOrEqual(result.averageResponseTime);
      expect(result.maxResponseTime).toBeGreaterThanOrEqual(result.averageResponseTime);

      // Verify all metrics have required fields
      result.performanceMetrics.forEach(metric => {
        expect(metric.timestamp).toBeInstanceOf(Date);
        expect(metric.responseTime).toBeGreaterThan(0);
        expect(metric.memoryUsage).toBeGreaterThan(0);
        expect(metric.cpuUsage).toBeGreaterThan(0);
        expect(metric.requestId).toBeDefined();
        expect(typeof metric.success).toBe('boolean');
      });
    });

    it('should handle timeout scenarios', async () => {
      // Mock slow responses that exceed timeout
      mockRoutingService.optimizeRoutes.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 2000))
      );

      const config: PerformanceTestConfig = {
        testName: 'Timeout Test',
        description: 'Test timeout handling',
        concurrentRequests: 2,
        totalRequests: 4,
        vehicleCount: 5,
        deliveryCount: 10,
        hubCount: 2,
        timeoutMs: 1000, // Short timeout
        targetResponseTime: 500,
        targetThroughput: 10
      };

      const result = await performanceTestingService.runRoutingOptimizationLoadTest(config);

      // All requests should timeout and fail
      expect(result.failedRequests).toBe(4);
      expect(result.successfulRequests).toBe(0);
      expect(result.errorRate).toBe(100);

      // Check timeout error messages
      const timeoutMetrics = result.performanceMetrics.filter(m => 
        m.errorMessage?.includes('timed out')
      );
      expect(timeoutMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('Stress Testing', () => {
    it('should run stress test with multiple phases', async () => {
      const config: StressTestConfig = {
        name: 'Multi-Phase Stress Test',
        description: 'Test system under increasing load',
        phases: [
          {
            name: 'Warm-up',
            duration: 2,
            concurrentUsers: 2,
            requestsPerSecond: 1
          },
          {
            name: 'Peak Load',
            duration: 3,
            concurrentUsers: 5,
            requestsPerSecond: 2
          },
          {
            name: 'Cool-down',
            duration: 2,
            concurrentUsers: 1,
            requestsPerSecond: 0.5
          }
        ],
        maxConcurrentUsers: 5,
        rampUpDuration: 30,
        sustainDuration: 60,
        rampDownDuration: 30
      };

      const result = await performanceTestingService.runStressTest(config);

      expect(result).toBeDefined();
      expect(result.testName).toBe('Multi-Phase Stress Test');
      expect(result.phases).toHaveLength(3);

      // Verify each phase has correct structure
      result.phases.forEach((phase, index) => {
        expect(phase.phaseName).toBe(config.phases[index].name);
        expect(phase.duration).toBeGreaterThan(0);
        expect(phase.requestCount).toBeGreaterThan(0);
        expect(phase.averageResponseTime).toBeGreaterThanOrEqual(0);
        expect(phase.throughput).toBeGreaterThanOrEqual(0);
        expect(phase.errorRate).toBeGreaterThanOrEqual(0);
        expect(phase.systemMetrics.memoryUsage).toBeGreaterThan(0);
        expect(phase.systemMetrics.cpuUsage).toBeGreaterThan(0);
      });

      // Verify overall metrics
      expect(result.overallMetrics.totalRequests).toBeGreaterThan(0);
      expect(result.overallMetrics.totalDuration).toBeGreaterThan(0);
      expect(result.overallMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.overallMetrics.peakThroughput).toBeGreaterThan(0);
      expect(['stable', 'degraded', 'unstable']).toContain(result.overallMetrics.systemStability);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should detect system instability during stress test', async () => {
      // Mock failures to simulate system instability
      let callCount = 0;
      mockRoutingService.optimizeRoutes.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('System overloaded'));
        }
        return Promise.resolve({} as any);
      });

      const config: StressTestConfig = {
        name: 'Instability Test',
        description: 'Test system instability detection',
        phases: [
          {
            name: 'High Load',
            duration: 2,
            concurrentUsers: 10,
            requestsPerSecond: 5
          }
        ],
        maxConcurrentUsers: 10,
        rampUpDuration: 10,
        sustainDuration: 20,
        rampDownDuration: 10
      };

      const result = await performanceTestingService.runStressTest(config);

      // Should detect instability due to high error rate
      expect(result.overallMetrics.systemStability).toBe('unstable');
      expect(result.recommendations.some(r => r.includes('error rate'))).toBe(true);
    });

    it('should provide performance recommendations', async () => {
      // Mock slow responses to trigger performance recommendations
      mockRoutingService.optimizeRoutes.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 6000))
      );

      const config: StressTestConfig = {
        name: 'Performance Recommendation Test',
        description: 'Test performance recommendation generation',
        phases: [
          {
            name: 'Slow Response Test',
            duration: 1,
            concurrentUsers: 2,
            requestsPerSecond: 1
          }
        ],
        maxConcurrentUsers: 2,
        rampUpDuration: 5,
        sustainDuration: 10,
        rampDownDuration: 5
      };

      const result = await performanceTestingService.runStressTest(config);

      // Should recommend optimizations due to high response times
      expect(result.recommendations.some(r => 
        r.includes('Response times are high') || r.includes('optimizing algorithms')
      )).toBe(true);
    });
  });

  describe('Latency Testing', () => {
    it('should run latency test for different scenario sizes', async () => {
      const result = await performanceTestingService.runLatencyTest();

      expect(result).toBeDefined();
      expect(result.testName).toBe('Route Optimization Latency Test');
      expect(result.results).toHaveLength(4); // Small, Medium, Large, Extra Large

      // Verify each scenario result
      result.results.forEach(scenarioResult => {
        expect(scenarioResult.scenario).toBeDefined();
        expect(scenarioResult.vehicleCount).toBeGreaterThan(0);
        expect(scenarioResult.deliveryCount).toBeGreaterThan(0);
        expect(scenarioResult.responseTime).toBeGreaterThan(0);
        expect(typeof scenarioResult.withinTarget).toBe('boolean');
      });

      expect(typeof result.overallSuccess).toBe('boolean');

      // Verify routing service was called for each scenario
      expect(mockRoutingService.optimizeRoutes).toHaveBeenCalledTimes(4);
    });

    it('should pass latency test when responses are fast', async () => {
      // Mock fast responses (under 10 seconds)
      mockRoutingService.optimizeRoutes.mockResolvedValue({} as any);

      const result = await performanceTestingService.runLatencyTest();

      // All scenarios should pass the 10-second target
      expect(result.results.every(r => r.withinTarget)).toBe(true);
      expect(result.overallSuccess).toBe(true);
    });

    it('should fail latency test when responses are slow', async () => {
      // Mock slow responses (over 10 seconds)
      mockRoutingService.optimizeRoutes.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({} as any), 11000))
      );

      const result = await performanceTestingService.runLatencyTest();

      // All scenarios should fail the 10-second target
      expect(result.results.every(r => !r.withinTarget)).toBe(true);
      expect(result.overallSuccess).toBe(false);
    });

    it('should handle routing service errors in latency test', async () => {
      // Mock routing service errors
      mockRoutingService.optimizeRoutes.mockRejectedValue(new Error('Routing service unavailable'));

      const result = await performanceTestingService.runLatencyTest();

      // All scenarios should fail due to errors
      expect(result.results.every(r => !r.withinTarget)).toBe(true);
      expect(result.overallSuccess).toBe(false);

      // Response times should be marked as failed (over target)
      expect(result.results.every(r => r.responseTime > 10000)).toBe(true);
    });
  });

  describe('Scalability Testing', () => {
    it('should run scalability test for horizontal scaling', async () => {
      const result = await performanceTestingService.runScalabilityTest();

      expect(result).toBeDefined();
      expect(result.testName).toBe('Horizontal Scaling Test');
      expect(result.scalingResults).toHaveLength(4); // 1, 2, 4, 8 instances

      // Verify scaling results structure
      result.scalingResults.forEach((scalingResult, index) => {
        const expectedInstanceCount = Math.pow(2, index === 0 ? 0 : index);
        expect(scalingResult.instanceCount).toBe(expectedInstanceCount);
        expect(scalingResult.throughput).toBeGreaterThan(0);
        expect(scalingResult.responseTime).toBeGreaterThan(0);
        expect(scalingResult.scalingEfficiency).toBeGreaterThan(0);
        expect(scalingResult.scalingEfficiency).toBeLessThanOrEqual(100);
      });

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect good scaling efficiency', async () => {
      // Mock consistent performance across instances
      mockRoutingService.optimizeRoutes.mockResolvedValue({} as any);

      const result = await performanceTestingService.runScalabilityTest();

      // Should provide positive recommendations for good scaling
      expect(result.recommendations.some(r => 
        r.includes('Excellent') || r.includes('Good') || r.includes('scales well')
      )).toBe(true);
    });

    it('should detect poor scaling efficiency', async () => {
      // Mock degrading performance with more instances
      let callCount = 0;
      mockRoutingService.optimizeRoutes.mockImplementation(() => {
        callCount++;
        const delay = Math.min(callCount * 100, 2000); // Increasing delay
        return new Promise(resolve => setTimeout(() => resolve({} as any), delay));
      });

      const result = await performanceTestingService.runScalabilityTest();

      // Should detect poor scaling and provide recommendations
      expect(result.recommendations.some(r => 
        r.includes('Poor scaling') || r.includes('optimizing')
      )).toBe(true);
    });

    it('should calculate scaling efficiency correctly', async () => {
      const result = await performanceTestingService.runScalabilityTest();

      // Verify scaling efficiency calculation
      result.scalingResults.forEach((scalingResult, index) => {
        if (index > 0) {
          // Efficiency should be calculated relative to baseline
          expect(scalingResult.scalingEfficiency).toBeGreaterThan(0);
          expect(scalingResult.scalingEfficiency).toBeLessThanOrEqual(100);
        }
      });
    });
  });

  describe('Test Data Generation', () => {
    it('should generate test vehicles with correct properties', () => {
      const service = performanceTestingService as any;
      const vehicles = service.generateTestVehicles(5);

      expect(vehicles).toHaveLength(5);
      vehicles.forEach((vehicle, index) => {
        expect(vehicle.id).toBe(`TEST_VEHICLE_${index + 1}`);
        expect(['truck', 'tempo', 'van', 'three-wheeler', 'electric']).toContain(vehicle.type);
        expect(vehicle.capacity.weight).toBeGreaterThan(0);
        expect(vehicle.capacity.volume).toBeGreaterThan(0);
        expect(vehicle.location.latitude).toBeCloseTo(28.6139, 1);
        expect(vehicle.location.longitude).toBeCloseTo(77.2090, 1);
        expect(vehicle.status).toBe('available');
        expect(vehicle.vehicleSpecs.plateNumber).toMatch(/^DL\d{2}AB\d{4}$/);
        expect(vehicle.driverInfo.name).toBe(`Test Driver ${index + 1}`);
        expect(vehicle.lastUpdated).toBeInstanceOf(Date);
      });
    });

    it('should generate test deliveries with correct properties', () => {
      const service = performanceTestingService as any;
      const deliveries = service.generateTestDeliveries(3);

      expect(deliveries).toHaveLength(3);
      deliveries.forEach((delivery, index) => {
        expect(delivery.id).toBe(`TEST_DELIVERY_${index + 1}`);
        expect(delivery.customerId).toMatch(/^CUSTOMER_\d+$/);
        expect(delivery.pickupLocation.latitude).toBeCloseTo(28.6139, 1);
        expect(delivery.pickupLocation.longitude).toBeCloseTo(77.2090, 1);
        expect(delivery.deliveryLocation.latitude).toBeCloseTo(28.6139, 1);
        expect(delivery.deliveryLocation.longitude).toBeCloseTo(77.2090, 1);
        expect(delivery.timeWindow.earliest).toBeInstanceOf(Date);
        expect(delivery.timeWindow.latest).toBeInstanceOf(Date);
        expect(delivery.timeWindow.latest.getTime()).toBeGreaterThan(delivery.timeWindow.earliest.getTime());
        expect(delivery.shipment.weight).toBeGreaterThan(0);
        expect(delivery.shipment.volume).toBeGreaterThan(0);
        expect(['low', 'medium', 'high', 'urgent']).toContain(delivery.priority);
        expect(['standard', 'premium']).toContain(delivery.serviceType);
      });
    });

    it('should generate test hubs with correct properties', () => {
      const service = performanceTestingService as any;
      const hubs = service.generateTestHubs(2);

      expect(hubs).toHaveLength(2);
      hubs.forEach((hub, index) => {
        expect(hub.id).toBe(`TEST_HUB_${index + 1}`);
        expect(hub.name).toBe(`Test Hub ${index + 1}`);
        expect(hub.location.latitude).toBeCloseTo(28.6139, 1);
        expect(hub.location.longitude).toBeCloseTo(77.2090, 1);
        expect(hub.capacity.vehicles).toBe(50);
        expect(hub.capacity.storage).toBe(5000);
        expect(hub.operatingHours.open).toBe('06:00');
        expect(hub.operatingHours.close).toBe('22:00');
        expect(hub.facilities).toContain('loading_dock');
        expect(hub.hubType).toBe('distribution');
        expect(hub.status).toBe('active');
        expect(hub.contactInfo.email).toBe(`hub${index + 1}@testlogistics.com`);
      });
    });
  });

  describe('Helper Methods', () => {
    it('should get correct subtypes for vehicle types', () => {
      const service = performanceTestingService as any;
      
      expect(service.getSubType('truck')).toBe('heavy-truck');
      expect(service.getSubType('tempo')).toBe('tempo-traveller');
      expect(service.getSubType('van')).toBe('pickup-van');
      expect(service.getSubType('three-wheeler')).toBe('auto-rickshaw');
      expect(service.getSubType('electric')).toBe('e-rickshaw');
      expect(service.getSubType('unknown')).toBe('unknown');
    });

    it('should get correct capacities for vehicle types', () => {
      const service = performanceTestingService as any;
      
      expect(service.getCapacityForType('truck')).toEqual({ weight: 5000, volume: 20 });
      expect(service.getCapacityForType('tempo')).toEqual({ weight: 1500, volume: 8 });
      expect(service.getCapacityForType('van')).toEqual({ weight: 1000, volume: 6 });
      expect(service.getCapacityForType('three-wheeler')).toEqual({ weight: 300, volume: 2 });
      expect(service.getCapacityForType('electric')).toEqual({ weight: 250, volume: 1.5 });
      expect(service.getCapacityForType('unknown')).toEqual({ weight: 1000, volume: 5 });
    });

    it('should simulate system metrics correctly', () => {
      const service = performanceTestingService as any;
      
      const memoryUsage = service.getMemoryUsage();
      expect(memoryUsage).toBeGreaterThanOrEqual(50);
      expect(memoryUsage).toBeLessThanOrEqual(150);

      const cpuUsage = service.getCpuUsage();
      expect(cpuUsage).toBeGreaterThanOrEqual(10);
      expect(cpuUsage).toBeLessThanOrEqual(60);
    });

    it('should analyze system stability correctly', () => {
      const service = performanceTestingService as any;
      
      // Stable system
      const stablePhases = [
        { errorRate: 1, averageResponseTime: 1000 },
        { errorRate: 2, averageResponseTime: 1100 },
        { errorRate: 1.5, averageResponseTime: 1050 }
      ];
      expect(service.analyzeSystemStability(stablePhases)).toBe('stable');

      // Degraded system
      const degradedPhases = [
        { errorRate: 3, averageResponseTime: 1000 },
        { errorRate: 6, averageResponseTime: 2200 },
        { errorRate: 7, averageResponseTime: 2500 }
      ];
      expect(service.analyzeSystemStability(degradedPhases)).toBe('degraded');

      // Unstable system
      const unstablePhases = [
        { errorRate: 5, averageResponseTime: 1000 },
        { errorRate: 15, averageResponseTime: 4000 },
        { errorRate: 20, averageResponseTime: 5000 }
      ];
      expect(service.analyzeSystemStability(unstablePhases)).toBe('unstable');
    });

    it('should generate appropriate performance recommendations', () => {
      const service = performanceTestingService as any;
      
      // High error rate scenario
      const highErrorPhases = [
        { errorRate: 8, averageResponseTime: 2000, systemMetrics: { memoryUsage: 60, cpuUsage: 40 } }
      ];
      const highErrorRecommendations = service.generatePerformanceRecommendations(highErrorPhases);
      expect(highErrorRecommendations.some(r => r.includes('error rate'))).toBe(true);

      // High response time scenario
      const slowResponsePhases = [
        { errorRate: 2, averageResponseTime: 8000, systemMetrics: { memoryUsage: 60, cpuUsage: 40 } }
      ];
      const slowResponseRecommendations = service.generatePerformanceRecommendations(slowResponsePhases);
      expect(slowResponseRecommendations.some(r => r.includes('Response times'))).toBe(true);

      // High memory usage scenario
      const highMemoryPhases = [
        { errorRate: 2, averageResponseTime: 2000, systemMetrics: { memoryUsage: 90, cpuUsage: 40 } }
      ];
      const highMemoryRecommendations = service.generatePerformanceRecommendations(highMemoryPhases);
      expect(highMemoryRecommendations.some(r => r.includes('memory'))).toBe(true);

      // Good performance scenario
      const goodPhases = [
        { errorRate: 1, averageResponseTime: 1000, systemMetrics: { memoryUsage: 50, cpuUsage: 30 } }
      ];
      const goodRecommendations = service.generatePerformanceRecommendations(goodPhases);
      expect(goodRecommendations.some(r => r.includes('acceptable limits'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle routing service initialization errors', () => {
      expect(() => {
        new PerformanceTestingService(
          null as any,
          null as any,
          null as any,
          null as any
        );
      }).not.toThrow();
    });

    it('should handle empty test configurations', async () => {
      const emptyConfig: PerformanceTestConfig = {
        testName: 'Empty Test',
        description: 'Test with minimal configuration',
        concurrentRequests: 1,
        totalRequests: 1,
        vehicleCount: 1,
        deliveryCount: 1,
        hubCount: 1,
        timeoutMs: 5000,
        targetResponseTime: 3000,
        targetThroughput: 1
      };

      const result = await performanceTestingService.runRoutingOptimizationLoadTest(emptyConfig);
      
      expect(result).toBeDefined();
      expect(result.totalRequests).toBe(1);
    });

    it('should handle stress test with empty phases', async () => {
      const emptyStressConfig: StressTestConfig = {
        name: 'Empty Stress Test',
        description: 'Test with no phases',
        phases: [],
        maxConcurrentUsers: 1,
        rampUpDuration: 1,
        sustainDuration: 1,
        rampDownDuration: 1
      };

      const result = await performanceTestingService.runStressTest(emptyStressConfig);
      
      expect(result).toBeDefined();
      expect(result.phases).toHaveLength(0);
      expect(result.overallMetrics.totalRequests).toBe(0);
    });
  });
});