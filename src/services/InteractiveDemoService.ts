/**
 * Interactive Demo Service for Delhi-specific logistics scenarios
 * Provides comprehensive demo scenarios with real-time interaction and compliance validation
 */

import { DemoScenarioGenerator, DemoScenarioConfig, DemoExecutionState } from './DemoScenarioGenerator';
import { DelhiComplianceService, ComplianceResult } from './DelhiComplianceService';
import { MapVisualizationService } from './MapVisualizationService';
import { RoutingService } from './RoutingService';
import { Vehicle } from '../models';
import { Delivery } from '../models/Delivery';
import { VehicleType, ZoneType } from '../models/Common';

export interface InteractiveDemoScenario extends DemoScenarioConfig {
  interactiveFeatures: {
    complianceValidation: boolean;
    realTimeBreakdowns: boolean;
    trafficSimulation: boolean;
    userControls: boolean;
  };
  validationRules: DelhiValidationRule[];
  expectedOutcomes: ScenarioExpectedOutcome[];
}

export interface DelhiValidationRule {
  id: string;
  type: 'time_restriction' | 'odd_even' | 'pollution_zone' | 'vehicle_class';
  description: string;
  vehicleTypes: VehicleType[];
  zoneTypes: ZoneType[];
  timeWindows?: { start: string; end: string }[];
  expectedViolations: number;
}

export interface ScenarioExpectedOutcome {
  metric: string;
  expectedValue: number | string;
  tolerance?: number;
  description: string;
}

export interface InteractiveDemoExecution {
  scenario: InteractiveDemoScenario;
  currentState: DemoExecutionState;
  complianceResults: Map<string, ComplianceResult>;
  userInteractions: UserInteraction[];
  realTimeMetrics: RealTimeMetrics;
}

export interface UserInteraction {
  timestamp: Date;
  type: 'trigger_breakdown' | 'change_traffic' | 'add_delivery' | 'modify_vehicle';
  vehicleId?: string;
  parameters: Record<string, any>;
  impact: {
    affectedVehicles: string[];
    routeChanges: string[];
    complianceChanges: string[];
  };
}

export interface RealTimeMetrics {
  complianceRate: number;
  violationCount: number;
  routeEfficiency: number;
  fuelSavings: number;
  averageDeliveryTime: number;
  bufferVehicleUsage: number;
  customerSatisfaction: number;
}

export interface DemoControlPanel {
  scenarios: {
    id: string;
    name: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedDuration: number;
  }[];
  activeScenario?: string;
  playbackControls: {
    isPlaying: boolean;
    currentTime: number;
    totalDuration: number;
    speed: number;
    canPause: boolean;
    canRestart: boolean;
  };
  interactionControls: {
    triggerBreakdown: (vehicleId: string) => void;
    changeTrafficCondition: (severity: 'light' | 'moderate' | 'heavy') => void;
    addUrgentDelivery: (delivery: Partial<Delivery>) => void;
    modifyVehicleStatus: (vehicleId: string, status: string) => void;
  };
  complianceMonitor: {
    activeViolations: ComplianceViolation[];
    suggestedActions: string[];
    alternativeOptions: string[];
  };
}

export interface ComplianceViolation {
  vehicleId: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  timestamp: Date;
  suggestedFix: string;
}

/**
 * Interactive Demo Service for comprehensive Delhi logistics demonstrations
 */
export class InteractiveDemoService {
  private demoGenerator: DemoScenarioGenerator;
  private complianceService: DelhiComplianceService;
  private mapVisualizationService: MapVisualizationService;
  private routingService: RoutingService;
  private activeExecutions: Map<string, InteractiveDemoExecution> = new Map();

  constructor(
    demoGenerator: DemoScenarioGenerator,
    complianceService: DelhiComplianceService,
    mapVisualizationService: MapVisualizationService,
    routingService: RoutingService
  ) {
    this.demoGenerator = demoGenerator;
    this.complianceService = complianceService;
    this.mapVisualizationService = mapVisualizationService;
    this.routingService = routingService;
  }

  /**
   * Creates comprehensive Delhi compliance demo scenario
   */
  async createDelhiComplianceDemo(): Promise<InteractiveDemoScenario> {
    const baseScenario = await this.demoGenerator.generatePredefinedScenario('delhi_compliance');
    
    return {
      ...baseScenario,
      name: 'Delhi Vehicle Class Restriction Compliance Demo',
      description: 'Interactive demonstration of Delhi-specific vehicle movement restrictions with real-time compliance validation',
      interactiveFeatures: {
        complianceValidation: true,
        realTimeBreakdowns: true,
        trafficSimulation: true,
        userControls: true
      },
      validationRules: [
        {
          id: 'truck_time_restriction',
          type: 'time_restriction',
          description: 'Trucks restricted in residential areas 11 PM - 7 AM',
          vehicleTypes: ['truck'],
          zoneTypes: ['residential'],
          timeWindows: [{ start: '23:00', end: '07:00' }],
          expectedViolations: 1
        },
        {
          id: 'odd_even_rule',
          type: 'odd_even',
          description: 'Odd-even rule enforcement based on plate number and date',
          vehicleTypes: ['truck', 'tempo', 'van'],
          zoneTypes: ['commercial', 'residential'],
          expectedViolations: 1
        },
        {
          id: 'pollution_zone_access',
          type: 'pollution_zone',
          description: 'Electric vehicles prioritized in pollution-sensitive zones',
          vehicleTypes: ['electric'],
          zoneTypes: ['commercial'],
          expectedViolations: 0
        },
        {
          id: 'narrow_lane_access',
          type: 'vehicle_class',
          description: 'Only three-wheelers allowed in narrow residential lanes',
          vehicleTypes: ['three-wheeler'],
          zoneTypes: ['residential'],
          expectedViolations: 0
        }
      ],
      expectedOutcomes: [
        {
          metric: 'complianceRate',
          expectedValue: 75,
          tolerance: 10,
          description: 'Overall compliance rate should be around 75% due to planned violations'
        },
        {
          metric: 'violationCount',
          expectedValue: 2,
          tolerance: 1,
          description: 'Expected 2 compliance violations (truck time restriction + odd-even)'
        },
        {
          metric: 'alternativeSuggestions',
          expectedValue: 4,
          tolerance: 2,
          description: 'System should suggest 4 alternative solutions for violations'
        }
      ]
    };
  }

  /**
   * Creates hub-and-spoke operations demo scenario
   */
  async createHubSpokeDemo(): Promise<InteractiveDemoScenario> {
    const baseScenario = await this.demoGenerator.generatePredefinedScenario('hub_spoke');
    
    return {
      ...baseScenario,
      name: 'Hub-and-Spoke Operations with Buffer Management Demo',
      description: 'Demonstrates multi-hub routing, load transfers, and automatic buffer vehicle allocation during breakdowns',
      interactiveFeatures: {
        complianceValidation: false,
        realTimeBreakdowns: true,
        trafficSimulation: true,
        userControls: true
      },
      validationRules: [
        {
          id: 'buffer_allocation_time',
          type: 'vehicle_class',
          description: 'Buffer vehicle allocation should occur within 2 minutes of breakdown',
          vehicleTypes: ['truck', 'tempo'],
          zoneTypes: ['industrial'],
          expectedViolations: 0
        }
      ],
      expectedOutcomes: [
        {
          metric: 'bufferAllocationTime',
          expectedValue: 120,
          tolerance: 30,
          description: 'Buffer vehicle should be allocated within 2 minutes (120 seconds)'
        },
        {
          metric: 'routeReoptimizationTime',
          expectedValue: 30,
          tolerance: 10,
          description: 'Route re-optimization should complete within 30 seconds'
        },
        {
          metric: 'deliveryCompletionRate',
          expectedValue: 100,
          tolerance: 0,
          description: 'All deliveries should be completed despite breakdown'
        }
      ]
    };
  }

  /**
   * Creates real-time breakdown and recovery demo scenario
   */
  async createBreakdownRecoveryDemo(): Promise<InteractiveDemoScenario> {
    const baseScenario = await this.demoGenerator.generatePredefinedScenario('breakdown_recovery');
    
    return {
      ...baseScenario,
      name: 'Real-Time Vehicle Breakdown Recovery Demo',
      description: 'Simulates vehicle breakdown scenarios with automatic buffer allocation and route re-optimization',
      interactiveFeatures: {
        complianceValidation: true,
        realTimeBreakdowns: true,
        trafficSimulation: false,
        userControls: true
      },
      validationRules: [
        {
          id: 'emergency_response_time',
          type: 'vehicle_class',
          description: 'Emergency response and buffer allocation within 2 minutes',
          vehicleTypes: ['truck', 'tempo', 'van'],
          zoneTypes: ['commercial', 'industrial'],
          expectedViolations: 0
        }
      ],
      expectedOutcomes: [
        {
          metric: 'recoveryTime',
          expectedValue: 300,
          tolerance: 60,
          description: 'Complete recovery should take no more than 5 minutes'
        },
        {
          metric: 'customerNotificationTime',
          expectedValue: 30,
          tolerance: 10,
          description: 'Customer should be notified within 30 seconds of breakdown'
        }
      ]
    };
  }

  /**
   * Executes interactive demo scenario with real-time monitoring
   */
  async executeInteractiveDemo(scenario: InteractiveDemoScenario): Promise<InteractiveDemoExecution> {
    const executionId = `demo_${Date.now()}`;
    
    // Execute base scenario
    const baseExecution = await this.demoGenerator.executeDemoScenario(scenario);
    
    // Create interactive execution state
    const execution: InteractiveDemoExecution = {
      scenario,
      currentState: baseExecution.finalState,
      complianceResults: new Map(),
      userInteractions: [],
      realTimeMetrics: {
        complianceRate: 100,
        violationCount: 0,
        routeEfficiency: 85,
        fuelSavings: 20,
        averageDeliveryTime: 1800,
        bufferVehicleUsage: 0,
        customerSatisfaction: 95
      }
    };

    // Validate compliance for all vehicles and routes
    await this.validateScenarioCompliance(execution);
    
    // Calculate real-time metrics
    this.updateRealTimeMetrics(execution);
    
    // Store active execution
    this.activeExecutions.set(executionId, execution);
    
    return execution;
  }

  /**
   * Creates interactive demo control panel
   */
  createDemoControlPanel(): DemoControlPanel {
    return {
      scenarios: [
        {
          id: 'delhi_compliance',
          name: 'Delhi Compliance Demo',
          description: 'Vehicle class restrictions and compliance validation',
          difficulty: 'intermediate',
          estimatedDuration: 600
        },
        {
          id: 'hub_spoke',
          name: 'Hub-and-Spoke Operations',
          description: 'Multi-hub routing with buffer vehicle management',
          difficulty: 'advanced',
          estimatedDuration: 900
        },
        {
          id: 'breakdown_recovery',
          name: 'Breakdown Recovery',
          description: 'Emergency response and buffer allocation',
          difficulty: 'beginner',
          estimatedDuration: 480
        }
      ],
      playbackControls: {
        isPlaying: false,
        currentTime: 0,
        totalDuration: 600,
        speed: 1,
        canPause: true,
        canRestart: true
      },
      interactionControls: {
        triggerBreakdown: (vehicleId: string) => this.triggerVehicleBreakdown(vehicleId),
        changeTrafficCondition: (severity) => this.changeTrafficCondition(severity),
        addUrgentDelivery: (delivery) => this.addUrgentDelivery(delivery),
        modifyVehicleStatus: (vehicleId, status) => this.modifyVehicleStatus(vehicleId, status)
      },
      complianceMonitor: {
        activeViolations: [],
        suggestedActions: [],
        alternativeOptions: []
      }
    };
  }

  /**
   * Validates compliance for entire scenario
   */
  private async validateScenarioCompliance(execution: InteractiveDemoExecution): Promise<void> {
    const { scenario } = execution;
    
    // Convert demo vehicles to full vehicle models for compliance checking
    const vehicles = this.convertDemoVehiclesToModels(scenario.vehicles);
    
    for (const vehicle of vehicles) {
      // Create mock route for compliance validation
      const mockRoute = {
        id: `route_${vehicle.id}`,
        vehicleId: vehicle.id,
        stops: scenario.deliveries.map(delivery => ({
          id: `stop_${delivery.id}`,
          location: delivery.deliveryLocation,
          type: 'delivery' as const,
          estimatedArrival: new Date(),
          estimatedDeparture: new Date(),
          address: `Delivery location for ${delivery.id}`
        })),
        estimatedDuration: 3600,
        estimatedDistance: 15000,
        estimatedFuelConsumption: 5.0,
        trafficFactors: [],
        status: 'planned' as const
      };

      // Validate compliance
      const complianceResult = this.complianceService.validateVehicleMovement(
        vehicle,
        mockRoute,
        new Date()
      );

      execution.complianceResults.set(vehicle.id, complianceResult);
    }
  }

  /**
   * Updates real-time metrics based on current execution state
   */
  private updateRealTimeMetrics(execution: InteractiveDemoExecution): void {
    const { complianceResults } = execution;
    
    // Calculate compliance rate
    const totalVehicles = complianceResults.size;
    const compliantVehicles = Array.from(complianceResults.values())
      .filter(result => result.isCompliant).length;
    
    execution.realTimeMetrics.complianceRate = totalVehicles > 0 
      ? (compliantVehicles / totalVehicles) * 100 
      : 100;

    // Count violations
    execution.realTimeMetrics.violationCount = Array.from(complianceResults.values())
      .reduce((total, result) => total + result.violations.length, 0);

    // Calculate route efficiency (simplified)
    execution.realTimeMetrics.routeEfficiency = Math.max(
      0, 
      100 - (execution.realTimeMetrics.violationCount * 5)
    );

    // Update other metrics based on scenario performance
    execution.realTimeMetrics.fuelSavings = Math.max(
      0, 
      25 - (execution.realTimeMetrics.violationCount * 2)
    );

    execution.realTimeMetrics.customerSatisfaction = Math.max(
      60, 
      100 - (execution.realTimeMetrics.violationCount * 3)
    );
  }

  /**
   * Triggers vehicle breakdown for interactive testing
   */
  private async triggerVehicleBreakdown(vehicleId: string): Promise<void> {
    const execution = Array.from(this.activeExecutions.values())
      .find(exec => exec.scenario.vehicles.some(v => v.id === vehicleId));
    
    if (!execution) {
      throw new Error(`No active execution found for vehicle ${vehicleId}`);
    }

    const interaction: UserInteraction = {
      timestamp: new Date(),
      type: 'trigger_breakdown',
      vehicleId,
      parameters: { reason: 'user_triggered', severity: 'high' },
      impact: {
        affectedVehicles: [vehicleId],
        routeChanges: [`route_${vehicleId}`],
        complianceChanges: []
      }
    };

    execution.userInteractions.push(interaction);
    
    // Update metrics to reflect breakdown impact
    execution.realTimeMetrics.bufferVehicleUsage += 1;
    execution.realTimeMetrics.customerSatisfaction = Math.max(
      execution.realTimeMetrics.customerSatisfaction - 10,
      50
    );
  }

  /**
   * Changes traffic conditions for scenario testing
   */
  private async changeTrafficCondition(severity: 'light' | 'moderate' | 'heavy'): Promise<void> {
    // Implementation would update traffic conditions across all active executions
    const trafficImpact = {
      'light': { delayFactor: 1.1, fuelIncrease: 5 },
      'moderate': { delayFactor: 1.3, fuelIncrease: 15 },
      'heavy': { delayFactor: 1.6, fuelIncrease: 30 }
    };

    const impact = trafficImpact[severity];
    
    for (const execution of this.activeExecutions.values()) {
      execution.realTimeMetrics.averageDeliveryTime *= impact.delayFactor;
      execution.realTimeMetrics.fuelSavings = Math.max(
        0,
        execution.realTimeMetrics.fuelSavings - impact.fuelIncrease
      );
    }
  }

  /**
   * Adds urgent delivery to active scenario
   */
  private async addUrgentDelivery(_delivery: Partial<Delivery>): Promise<void> {
    // Implementation would add urgent delivery and trigger re-optimization
    for (const execution of this.activeExecutions.values()) {
      execution.realTimeMetrics.routeEfficiency = Math.max(
        execution.realTimeMetrics.routeEfficiency - 5,
        60
      );
    }
  }

  /**
   * Modifies vehicle status for testing
   */
  private async modifyVehicleStatus(vehicleId: string, status: string): Promise<void> {
    const execution = Array.from(this.activeExecutions.values())
      .find(exec => exec.scenario.vehicles.some(v => v.id === vehicleId));
    
    if (execution) {
      const vehicle = execution.scenario.vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        vehicle.status = status as any;
        this.updateRealTimeMetrics(execution);
      }
    }
  }

  /**
   * Converts demo vehicle configs to full vehicle models
   */
  private convertDemoVehiclesToModels(demoVehicles: any[]): Vehicle[] {
    return demoVehicles.map(dv => ({
      id: dv.id,
      type: dv.type,
      subType: this.getSubType(dv.type),
      capacity: {
        weight: this.getVehicleCapacity(dv.type).weight,
        volume: this.getVehicleCapacity(dv.type).volume,
        maxDimensions: { length: 8, width: 2.5, height: 3 }
      },
      location: { 
        latitude: dv.location[1], 
        longitude: dv.location[0], 
        timestamp: new Date() 
      },
      status: dv.status,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: dv.pollutionLevel || 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: dv.plateNumber || `DL${Math.floor(Math.random() * 100).toString().padStart(2, '0')}AB${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        fuelType: dv.fuelType || 'diesel',
        vehicleAge: 2,
        registrationState: 'Delhi',
        manufacturingYear: 2022
      },
      accessPrivileges: this.getAccessPrivileges(dv.type),
      driverInfo: {
        id: `driver_${dv.id}`,
        name: `Driver for ${dv.id}`,
        licenseNumber: `DL${Math.floor(Math.random() * 1000000)}`,
        workingHours: 8,
        maxWorkingHours: 12,
        contactNumber: `+91${Math.floor(Math.random() * 10000000000)}`
      },
      lastUpdated: new Date()
    }));
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

  private getVehicleCapacity(type: string) {
    const capacities: Record<string, { weight: number; volume: number }> = {
      'truck': { weight: 5000, volume: 20 },
      'tempo': { weight: 1500, volume: 8 },
      'van': { weight: 1000, volume: 6 },
      'three-wheeler': { weight: 300, volume: 2 },
      'electric': { weight: 250, volume: 1.5 }
    };
    return capacities[type] || { weight: 1000, volume: 5 };
  }

  private getAccessPrivileges(type: string) {
    const privileges: Record<string, any> = {
      'truck': {
        residentialZones: false,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: false,
        pollutionSensitiveZones: false,
        narrowLanes: false
      },
      'tempo': {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: false
      },
      'van': {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: false
      },
      'three-wheeler': {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: true
      },
      'electric': {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: true
      }
    };
    return privileges[type] || privileges.tempo;
  }

  async runDelhiComplianceDemo(): Promise<any> {
    return await this.createDelhiComplianceDemo();
  }

  async runHubSpokeDemo(): Promise<any> {
    // Run hub spoke demo
    return {
      scenario: 'hub-spoke',
      results: {}
    };
  }

  async runBreakdownRecoveryDemo(): Promise<any> {
    return await this.createBreakdownRecoveryDemo();
  }
}