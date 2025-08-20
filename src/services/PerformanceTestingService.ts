/**
 * Performance and Load Testing Service for Delhi Logistics Demo Scenarios
 * Provides comprehensive performance testing capabilities for routing optimization and system scalability
 */

import { DemoScenarioGenerator } from './DemoScenarioGenerator';
import { RoutingService } from './RoutingService';
import { VehicleSearchService } from './VehicleSearchService';
import { DelhiComplianceService } from './DelhiComplianceService';
import { Vehicle, Delivery, Hub } from '../models';

export interface PerformanceTestConfig {
  testName: string;
  description: string;
  concurrentRequests: number;
  totalRequests: number;
  vehicleCount: number;
  deliveryCount: number;
  hubCount: number;
  timeoutMs: number;
  targetResponseTime: number; // milliseconds
  targetThroughput: number; // requests per second
}

export interface LoadTestResult {
  testName: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  throughput: number; // requests per second
  errorRate: number; // percentage
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  cpuUsage: {
    average: number;
    peak: number;
  };
  performanceMetrics: PerformanceMetric[];
}

export interface PerformanceMetric {
  timestamp: Date;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  requestId: string;
  success: boolean;
  errorMessage?: string;
}

export interface StressTestConfig {
  name: string;
  description: string;
  phases: StressTestPhase[];
  maxConcurrentUsers: number;
  rampUpDuration: number; // seconds
  sustainDuration: number; // seconds
  rampDownDuration: number; // seconds
}

export interface StressTestPhase {
  name: string;
  duration: number; // seconds
  concurrentUsers: number;
  requestsPerSecond: number;
}

export interface ScalabilityTestResult {
  testName: string;
  phases: PhaseResult[];
  overallMetrics: {
    totalRequests: number;
    totalDuration: number;
    averageResponseTime: number;
    peakThroughput: number;
    systemStability: 'stable' | 'degraded' | 'unstable';
  };
  recommendations: string[];
}

export interface PhaseResult {
  phaseName: string;
  duration: number;
  requestCount: number;
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  systemMetrics: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Performance Testing Service for comprehensive system performance validation
 */
export class PerformanceTestingService {
  private demoGenerator: DemoScenarioGenerator;
  private routingService: RoutingService;
  private vehicleSearchService: VehicleSearchService;
  private complianceService: DelhiComplianceService;

  constructor(
    demoGenerator: DemoScenarioGenerator,
    routingService: RoutingService,
    vehicleSearchService: VehicleSearchService,
    complianceService: DelhiComplianceService
  ) {
    this.demoGenerator = demoGenerator;
    this.routingService = routingService;
    this.vehicleSearchService = vehicleSearchService;
    this.complianceService = complianceService;
  }

  /**
   * Runs concurrent routing optimization load test
   */
  async runRoutingOptimizationLoadTest(config: PerformanceTestConfig): Promise<LoadTestResult> {
    const startTime = new Date();
    const performanceMetrics: PerformanceMetric[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;
    const responseTimes: number[] = [];

    // Generate test data
    const testVehicles = this.generateTestVehicles(config.vehicleCount);
    const testDeliveries = this.generateTestDeliveries(config.deliveryCount);
    const testHubs = this.generateTestHubs(config.hubCount);

    console.log(`Starting load test: ${config.testName}`);
    console.log(`Concurrent requests: ${config.concurrentRequests}, Total requests: ${config.totalRequests}`);

    // Execute concurrent requests in batches
    const batchSize = config.concurrentRequests;
    const totalBatches = Math.ceil(config.totalRequests / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const batchStartTime = Date.now();
      const requestsInBatch = Math.min(batchSize, config.totalRequests - (batch * batchSize));
      
      // Create concurrent requests
      const batchPromises = Array.from({ length: requestsInBatch }, (_, index) => 
        this.executeRoutingRequest(
          testVehicles,
          testDeliveries,
          testHubs,
          `batch_${batch}_request_${index}`,
          config.timeoutMs
        )
      );

      // Execute batch concurrently
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process batch results
      batchResults.forEach((result, index) => {
        const requestEndTime = Date.now();
        const responseTime = requestEndTime - batchStartTime;
        responseTimes.push(responseTime);

        const metric: PerformanceMetric = {
          timestamp: new Date(requestEndTime),
          responseTime,
          memoryUsage: this.getMemoryUsage(),
          cpuUsage: this.getCpuUsage(),
          requestId: `batch_${batch}_request_${index}`,
          success: result.status === 'fulfilled'
        };

        if (result.status === 'fulfilled') {
          successfulRequests++;
        } else {
          failedRequests++;
          metric.errorMessage = result.reason?.message || 'Unknown error';
        }

        performanceMetrics.push(metric);
      });

      // Small delay between batches to prevent overwhelming the system
      if (batch < totalBatches - 1) {
        await this.delay(100);
      }
    }

    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();

    return {
      testName: config.testName,
      startTime,
      endTime,
      totalDuration,
      totalRequests: config.totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      throughput: (successfulRequests / totalDuration) * 1000, // requests per second
      errorRate: (failedRequests / config.totalRequests) * 100,
      memoryUsage: {
        initial: performanceMetrics[0]?.memoryUsage || 0,
        peak: Math.max(...performanceMetrics.map(m => m.memoryUsage)),
        final: performanceMetrics[performanceMetrics.length - 1]?.memoryUsage || 0
      },
      cpuUsage: {
        average: performanceMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / performanceMetrics.length,
        peak: Math.max(...performanceMetrics.map(m => m.cpuUsage))
      },
      performanceMetrics
    };
  }

  /**
   * Runs stress test with gradual load increase
   */
  async runStressTest(config: StressTestConfig): Promise<ScalabilityTestResult> {
    const phaseResults: PhaseResult[] = [];
    let totalRequests = 0;
    let totalDuration = 0;
    const allResponseTimes: number[] = [];

    console.log(`Starting stress test: ${config.name}`);

    for (const phase of config.phases) {
      console.log(`Executing phase: ${phase.name} (${phase.concurrentUsers} users, ${phase.duration}s)`);
      
      const phaseStartTime = Date.now();
      const phaseRequests: Promise<any>[] = [];
      let phaseRequestCount = 0;
      const phaseResponseTimes: number[] = [];
      let phaseErrors = 0;

      // Generate requests for this phase
      const requestInterval = 1000 / phase.requestsPerSecond; // ms between requests
      const totalPhaseRequests = phase.requestsPerSecond * phase.duration;

      for (let i = 0; i < totalPhaseRequests; i++) {
        const requestPromise = this.executeStressTestRequest(phase.concurrentUsers)
          .then(responseTime => {
            phaseResponseTimes.push(responseTime);
            allResponseTimes.push(responseTime);
            phaseRequestCount++;
          })
          .catch(() => {
            phaseErrors++;
            phaseRequestCount++;
          });

        phaseRequests.push(requestPromise);

        // Wait between requests to maintain target RPS
        if (i < totalPhaseRequests - 1) {
          await this.delay(requestInterval);
        }
      }

      // Wait for all phase requests to complete
      await Promise.allSettled(phaseRequests);

      const phaseEndTime = Date.now();
      const phaseDuration = phaseEndTime - phaseStartTime;

      const phaseResult: PhaseResult = {
        phaseName: phase.name,
        duration: phaseDuration,
        requestCount: phaseRequestCount,
        averageResponseTime: phaseResponseTimes.reduce((sum, time) => sum + time, 0) / phaseResponseTimes.length || 0,
        throughput: (phaseRequestCount / phaseDuration) * 1000,
        errorRate: (phaseErrors / phaseRequestCount) * 100,
        systemMetrics: {
          memoryUsage: this.getMemoryUsage(),
          cpuUsage: this.getCpuUsage()
        }
      };

      phaseResults.push(phaseResult);
      totalRequests += phaseRequestCount;
      totalDuration += phaseDuration;
    }

    // Analyze overall system stability
    const systemStability = this.analyzeSystemStability(phaseResults);
    const recommendations = this.generatePerformanceRecommendations(phaseResults);

    return {
      testName: config.name,
      phases: phaseResults,
      overallMetrics: {
        totalRequests,
        totalDuration,
        averageResponseTime: allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length || 0,
        peakThroughput: Math.max(...phaseResults.map(p => p.throughput)),
        systemStability
      },
      recommendations
    };
  }

  /**
   * Runs latency test to ensure sub-10-second route optimization
   */
  async runLatencyTest(): Promise<{
    testName: string;
    results: {
      scenario: string;
      vehicleCount: number;
      deliveryCount: number;
      responseTime: number;
      withinTarget: boolean;
    }[];
    overallSuccess: boolean;
  }> {
    const targetLatency = 10000; // 10 seconds in milliseconds
    const testScenarios = [
      { name: 'Small Scale', vehicles: 5, deliveries: 10 },
      { name: 'Medium Scale', vehicles: 15, deliveries: 30 },
      { name: 'Large Scale', vehicles: 25, deliveries: 50 },
      { name: 'Extra Large Scale', vehicles: 50, deliveries: 100 }
    ];

    const results = [];
    let allWithinTarget = true;

    console.log('Starting latency test for route optimization');

    for (const scenario of testScenarios) {
      const vehicles = this.generateTestVehicles(scenario.vehicles);
      const deliveries = this.generateTestDeliveries(scenario.deliveries);
      const hubs = this.generateTestHubs(3);

      const startTime = Date.now();
      
      try {
        await this.routingService.optimizeRoutes({
          vehicles,
          deliveries,
          hubs,
          constraints: {
            maxRouteDistance: 100000,
            maxRouteDuration: 28800,
            vehicleCapacityBuffer: 0.1
          },
          preferences: {
            optimizeFor: 'time',
            allowLoadSplitting: true,
            prioritizeCompliance: true
          }
        });

        const responseTime = Date.now() - startTime;
        const withinTarget = responseTime <= targetLatency;
        
        if (!withinTarget) {
          allWithinTarget = false;
        }

        results.push({
          scenario: scenario.name,
          vehicleCount: scenario.vehicles,
          deliveryCount: scenario.deliveries,
          responseTime,
          withinTarget
        });

        console.log(`${scenario.name}: ${responseTime}ms (${withinTarget ? 'PASS' : 'FAIL'})`);
      } catch (error) {
        allWithinTarget = false;
        results.push({
          scenario: scenario.name,
          vehicleCount: scenario.vehicles,
          deliveryCount: scenario.deliveries,
          responseTime: targetLatency + 1000, // Mark as failed
          withinTarget: false
        });

        console.log(`${scenario.name}: ERROR - ${error}`);
      }
    }

    return {
      testName: 'Route Optimization Latency Test',
      results,
      overallSuccess: allWithinTarget
    };
  }

  /**
   * Runs scalability test for horizontal scaling validation
   */
  async runScalabilityTest(): Promise<{
    testName: string;
    scalingResults: {
      instanceCount: number;
      throughput: number;
      responseTime: number;
      scalingEfficiency: number;
    }[];
    recommendations: string[];
  }> {
    const instanceCounts = [1, 2, 4, 8];
    const scalingResults = [];

    console.log('Starting scalability test for horizontal scaling');

    for (const instanceCount of instanceCounts) {
      console.log(`Testing with ${instanceCount} instance(s)`);

      // Simulate load distribution across instances
      const requestsPerInstance = Math.ceil(100 / instanceCount);
      const instancePromises = Array.from({ length: instanceCount }, async (_, index) => {
        const instanceStartTime = Date.now();
        const instanceRequests = [];

        for (let i = 0; i < requestsPerInstance; i++) {
          const vehicles = this.generateTestVehicles(10);
          const deliveries = this.generateTestDeliveries(20);
          const hubs = this.generateTestHubs(2);

          instanceRequests.push(
            this.executeRoutingRequest(vehicles, deliveries, hubs, `instance_${index}_request_${i}`, 30000)
          );
        }

        const results = await Promise.allSettled(instanceRequests);
        const instanceDuration = Date.now() - instanceStartTime;
        const successfulRequests = results.filter(r => r.status === 'fulfilled').length;

        return {
          instanceId: index,
          duration: instanceDuration,
          successfulRequests,
          throughput: (successfulRequests / instanceDuration) * 1000
        };
      });

      const instanceResults = await Promise.all(instancePromises);
      const totalThroughput = instanceResults.reduce((sum, result) => sum + result.throughput, 0);
      const averageResponseTime = instanceResults.reduce((sum, result) => sum + result.duration, 0) / instanceResults.length;
      
      // Calculate scaling efficiency (ideal would be linear scaling)
      const baselineThroughput = scalingResults[0]?.throughput || totalThroughput;
      const expectedThroughput = baselineThroughput * instanceCount;
      const scalingEfficiency = (totalThroughput / expectedThroughput) * 100;

      scalingResults.push({
        instanceCount,
        throughput: totalThroughput,
        responseTime: averageResponseTime,
        scalingEfficiency
      });

      console.log(`${instanceCount} instances: ${totalThroughput.toFixed(2)} RPS, ${scalingEfficiency.toFixed(1)}% efficiency`);
    }

    const recommendations = this.generateScalingRecommendations(scalingResults);

    return {
      testName: 'Horizontal Scaling Test',
      scalingResults,
      recommendations
    };
  }

  // Private helper methods

  private async executeRoutingRequest(
    vehicles: Vehicle[],
    deliveries: Delivery[],
    hubs: Hub[],
    requestId: string,
    timeoutMs: number
  ): Promise<any> {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    return Promise.race([
      this.routingService.optimizeRoutes({
        vehicles,
        deliveries,
        hubs,
        constraints: {
          maxRouteDistance: 100000,
          maxRouteDuration: 28800,
          vehicleCapacityBuffer: 0.1
        },
        preferences: {
          optimizeFor: 'time',
          allowLoadSplitting: true,
          prioritizeCompliance: true
        }
      }),
      timeoutPromise
    ]);
  }

  private async executeStressTestRequest(concurrentUsers: number): Promise<number> {
    const startTime = Date.now();
    
    // Simulate varying load based on concurrent users
    const vehicles = this.generateTestVehicles(Math.min(concurrentUsers * 2, 20));
    const deliveries = this.generateTestDeliveries(Math.min(concurrentUsers * 3, 30));
    const hubs = this.generateTestHubs(3);

    try {
      await this.routingService.optimizeRoutes({
        vehicles,
        deliveries,
        hubs,
        constraints: {
          maxRouteDistance: 100000,
          maxRouteDuration: 28800,
          vehicleCapacityBuffer: 0.1
        },
        preferences: {
          optimizeFor: 'time',
          allowLoadSplitting: true,
          prioritizeCompliance: true
        }
      });

      return Date.now() - startTime;
    } catch (error) {
      throw new Error(`Stress test request failed: ${error}`);
    }
  }

  private generateTestVehicles(count: number): Vehicle[] {
    const vehicleTypes = ['truck', 'tempo', 'van', 'three-wheeler', 'electric'];
    const vehicles: Vehicle[] = [];

    for (let i = 0; i < count; i++) {
      const type = vehicleTypes[i % vehicleTypes.length] as any;
      vehicles.push({
        id: `TEST_VEHICLE_${i + 1}`,
        type,
        subType: this.getSubType(type),
        capacity: {
          weight: this.getCapacityForType(type).weight,
          volume: this.getCapacityForType(type).volume,
          maxDimensions: { length: 8, width: 2.5, height: 3 }
        },
        location: {
          latitude: 28.6139 + (Math.random() - 0.5) * 0.1,
          longitude: 77.2090 + (Math.random() - 0.5) * 0.1,
          timestamp: new Date()
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
          plateNumber: `DL${Math.floor(Math.random() * 100).toString().padStart(2, '0')}AB${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          fuelType: type === 'electric' ? 'electric' : 'diesel',
          vehicleAge: Math.floor(Math.random() * 5) + 1,
          registrationState: 'DL',
          manufacturingYear: 2024 - Math.floor(Math.random() * 5)
        },
        accessPrivileges: {
          residentialZones: type !== 'truck',
          commercialZones: true,
          industrialZones: true,
          restrictedHours: type !== 'truck',
          pollutionSensitiveZones: type === 'electric',
          narrowLanes: type === 'three-wheeler' || type === 'electric'
        },
        driverInfo: {
          id: `DRIVER_${i + 1}`,
          name: `Test Driver ${i + 1}`,
          licenseNumber: `DL${Math.floor(Math.random() * 1000000)}`,
          workingHours: 8,
          maxWorkingHours: 12,
          contactNumber: `+91${Math.floor(Math.random() * 10000000000)}`
        },
        lastUpdated: new Date()
      });
    }

    return vehicles;
  }

  private generateTestDeliveries(count: number): Delivery[] {
    const deliveries: Delivery[] = [];

    for (let i = 0; i < count; i++) {
      deliveries.push({
        id: `TEST_DELIVERY_${i + 1}`,
        customerId: `CUSTOMER_${Math.floor(Math.random() * 100) + 1}`,
        pickupLocation: {
          latitude: 28.6139 + (Math.random() - 0.5) * 0.05,
          longitude: 77.2090 + (Math.random() - 0.5) * 0.05,
          timestamp: new Date()
        },
        deliveryLocation: {
          latitude: 28.6139 + (Math.random() - 0.5) * 0.1,
          longitude: 77.2090 + (Math.random() - 0.5) * 0.1,
          timestamp: new Date()
        },
        timeWindow: {
          earliest: new Date(Date.now() + Math.random() * 3600000),
          latest: new Date(Date.now() + 3600000 + Math.random() * 7200000)
        },
        shipment: {
          weight: Math.floor(Math.random() * 1000) + 100,
          volume: Math.floor(Math.random() * 10) + 1,
          fragile: Math.random() > 0.7,
          specialHandling: Math.random() > 0.8 ? ['fragile'] : [],
          hazardous: false,
          temperatureControlled: Math.random() > 0.9
        },
        priority: ['low', 'medium', 'high', 'urgent'][Math.floor(Math.random() * 4)] as any,
        serviceType: Math.random() > 0.8 ? 'premium' : 'standard',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return deliveries;
  }

  private generateTestHubs(count: number): Hub[] {
    const hubs: Hub[] = [];

    for (let i = 0; i < count; i++) {
      hubs.push({
        id: `TEST_HUB_${i + 1}`,
        name: `Test Hub ${i + 1}`,
        location: {
          latitude: 28.6139 + (Math.random() - 0.5) * 0.2,
          longitude: 77.2090 + (Math.random() - 0.5) * 0.2,
          timestamp: new Date()
        },
        capacity: {
          vehicles: 50,
          storage: 5000,
          maxVehicles: 60,
          currentVehicles: Math.floor(Math.random() * 30),
          storageArea: 5000,
          loadingBays: 10,
          bufferVehicleSlots: 5
        },
        bufferVehicles: [],
        operatingHours: {
          open: '06:00',
          close: '22:00'
        },
        facilities: ['loading_dock', 'fuel_station', 'maintenance'],
        hubType: 'distribution',
        status: 'active',
        contactInfo: {
          phone: `+91${Math.floor(Math.random() * 10000000000)}`,
          email: `hub${i + 1}@testlogistics.com`,
          manager: `Hub Manager ${i + 1}`
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return hubs;
  }

  private getSubType(type: string): string {
    const subTypes: Record<string, string> = {
      'truck': 'heavy-truck',
      'tempo': 'tempo-traveller',
      'van': 'pickup-van',
      'three-wheeler': 'auto-rickshaw',
      'electric': 'e-rickshaw'
    };
    return subTypes[type] || 'unknown';
  }

  private getCapacityForType(type: string) {
    const capacities: Record<string, { weight: number; volume: number }> = {
      'truck': { weight: 5000, volume: 20 },
      'tempo': { weight: 1500, volume: 8 },
      'van': { weight: 1000, volume: 6 },
      'three-wheeler': { weight: 300, volume: 2 },
      'electric': { weight: 250, volume: 1.5 }
    };
    return capacities[type] || { weight: 1000, volume: 5 };
  }

  private getMemoryUsage(): number {
    // Simulate memory usage (in a real implementation, use process.memoryUsage())
    return Math.floor(Math.random() * 100) + 50; // MB
  }

  private getCpuUsage(): number {
    // Simulate CPU usage (in a real implementation, use system monitoring)
    return Math.floor(Math.random() * 50) + 10; // percentage
  }

  private analyzeSystemStability(phaseResults: PhaseResult[]): 'stable' | 'degraded' | 'unstable' {
    const errorRates = phaseResults.map(p => p.errorRate);
    const responseTimes = phaseResults.map(p => p.averageResponseTime);

    const avgErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
    const responseTimeIncrease = responseTimes[responseTimes.length - 1] / responseTimes[0];

    if (avgErrorRate > 10 || responseTimeIncrease > 3) {
      return 'unstable';
    } else if (avgErrorRate > 5 || responseTimeIncrease > 2) {
      return 'degraded';
    } else {
      return 'stable';
    }
  }

  private generatePerformanceRecommendations(phaseResults: PhaseResult[]): string[] {
    const recommendations: string[] = [];
    const avgErrorRate = phaseResults.reduce((sum, p) => sum + p.errorRate, 0) / phaseResults.length;
    const avgResponseTime = phaseResults.reduce((sum, p) => sum + p.averageResponseTime, 0) / phaseResults.length;
    const peakMemoryUsage = Math.max(...phaseResults.map(p => p.systemMetrics.memoryUsage));

    if (avgErrorRate > 5) {
      recommendations.push('High error rate detected. Consider implementing circuit breakers and better error handling.');
    }

    if (avgResponseTime > 5000) {
      recommendations.push('Response times are high. Consider optimizing algorithms or adding caching.');
    }

    if (peakMemoryUsage > 80) {
      recommendations.push('High memory usage detected. Consider implementing memory optimization strategies.');
    }

    if (recommendations.length === 0) {
      recommendations.push('System performance is within acceptable limits.');
    }

    return recommendations;
  }

  private generateScalingRecommendations(scalingResults: any[]): string[] {
    const recommendations: string[] = [];
    const efficiencies = scalingResults.map(r => r.scalingEfficiency);
    const avgEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;

    if (avgEfficiency > 80) {
      recommendations.push('Excellent horizontal scaling efficiency. System scales well with additional instances.');
    } else if (avgEfficiency > 60) {
      recommendations.push('Good scaling efficiency. Minor optimizations could improve performance.');
    } else {
      recommendations.push('Poor scaling efficiency. Consider optimizing for better horizontal scaling.');
      recommendations.push('Review database connection pooling and shared resource management.');
    }

    return recommendations;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}