import { MapVisualizationService, InteractiveMapData, RouteAnimationFrame, ScenarioGenerationOptions } from './MapVisualizationService';
import { Route, Vehicle, Hub, Delivery, VehicleSubType } from '../models';
import { RoutingService } from './RoutingService';
import { DelhiComplianceService } from './DelhiComplianceService';

export interface DemoScenarioConfig {
  name: string;
  description: string;
  duration: number; // seconds
  timeAcceleration: number;
  centerLocation: [number, number];
  vehicles: DemoVehicleConfig[];
  hubs: DemoHubConfig[];
  deliveries: DemoDeliveryConfig[];
  events: DemoEventConfig[];
}

export interface DemoVehicleConfig {
  id: string;
  type: 'truck' | 'tempo' | 'van' | 'three-wheeler' | 'electric';
  location: [number, number];
  status: 'available' | 'in-transit' | 'loading' | 'breakdown';
  plateNumber?: string;
  fuelType?: 'diesel' | 'petrol' | 'cng' | 'electric';
  pollutionLevel?: 'BS6' | 'BS4' | 'BS3' | 'electric';
}

export interface DemoHubConfig {
  id: string;
  name: string;
  location: [number, number];
  capacity: number;
  bufferVehicles: number;
}

export interface DemoDeliveryConfig {
  id: string;
  pickupLocation: [number, number];
  deliveryLocation: [number, number];
  weight: number;
  volume: number;
  timeWindow: {
    earliest: string; // HH:MM format
    latest: string;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface DemoEventConfig {
  time: number; // seconds from start
  type: 'breakdown' | 'traffic_jam' | 'weather_change' | 'urgent_delivery' | 'compliance_violation';
  vehicleId?: string;
  location?: [number, number];
  description: string;
  impact: {
    duration: number;
    severity: 'low' | 'medium' | 'high';
  };
}

export interface DemoExecutionState {
  currentTime: number;
  vehiclePositions: Map<string, [number, number]>;
  routeProgress: Map<string, number>;
  activeEvents: DemoEventConfig[];
  completedDeliveries: string[];
  metrics: {
    totalDistance: number;
    totalTime: number;
    fuelConsumed: number;
    complianceViolations: number;
    efficiencyScore: number;
  };
}

/**
 * Service for generating and executing interactive demo scenarios
 * Combines MapVisualizationService with routing and compliance services
 */
export class DemoScenarioGenerator {
  private mapVisualizationService: MapVisualizationService;
  private routingService: RoutingService;
  private complianceService: DelhiComplianceService;

  constructor(
    mapVisualizationService: MapVisualizationService,
    routingService: RoutingService,
    complianceService: DelhiComplianceService
  ) {
    this.mapVisualizationService = mapVisualizationService;
    this.routingService = routingService;
    this.complianceService = complianceService;
  }

  /**
   * Generate predefined demo scenarios
   */
  async generatePredefinedScenario(
    scenarioType: 'delhi_compliance' | 'hub_spoke' | 'breakdown_recovery' | 'traffic_optimization',
    customizations?: Partial<ScenarioGenerationOptions>
  ): Promise<DemoScenarioConfig> {
    const baseOptions: ScenarioGenerationOptions = {
      scenarioType,
      centerLocation: [77.2090, 28.6139], // Delhi center
      vehicleCount: 5,
      hubCount: 3,
      deliveryCount: 10,
      timeAcceleration: 10,
      ...customizations
    };

    switch (scenarioType) {
      case 'delhi_compliance':
        return this.generateDelhiComplianceScenario(baseOptions);
      case 'hub_spoke':
        return this.generateHubSpokeScenario(baseOptions);
      case 'breakdown_recovery':
        return this.generateBreakdownRecoveryScenario(baseOptions);
      case 'traffic_optimization':
        return this.generateTrafficOptimizationScenario(baseOptions);
      default:
        throw new Error(`Unknown scenario type: ${scenarioType}`);
    }
  }

  /**
   * Execute demo scenario and generate animation frames
   */
  async executeDemoScenario(config: DemoScenarioConfig): Promise<{
    animationFrames: RouteAnimationFrame[];
    finalState: DemoExecutionState;
    summary: {
      totalDeliveries: number;
      successfulDeliveries: number;
      averageDeliveryTime: number;
      fuelEfficiency: number;
      complianceRate: number;
    };
  }> {
    try {
      // Convert demo config to internal models
      const vehicles = this.convertDemoVehiclesToModels(config.vehicles);
      const hubs = this.convertDemoHubsToModels(config.hubs);
      const deliveries = this.convertDemoDeliveriesToModels(config.deliveries);

      // Generate optimized routes
      const routes = await this.generateOptimizedRoutes(vehicles, deliveries, hubs);

      // Create animation frames
      const animationFrames = await this.mapVisualizationService.createRouteAnimation(
        routes,
        vehicles,
        config.duration,
        30 // 30 fps
      );

      // Execute scenario with events
      const finalState = await this.executeScenarioWithEvents(
        config,
        vehicles,
        routes,
        animationFrames
      );

      // Calculate summary metrics
      const summary = this.calculateScenarioSummary(config, finalState);

      return {
        animationFrames,
        finalState,
        summary
      };
    } catch (error) {
      throw new Error(`Failed to execute demo scenario: ${error}`);
    }
  }

  /**
   * Create interactive demo dashboard data
   */
  async createDemoDashboard(config: DemoScenarioConfig): Promise<{
    mapData: InteractiveMapData;
    controlPanel: {
      scenarios: string[];
      currentScenario: string;
      playbackControls: {
        isPlaying: boolean;
        currentTime: number;
        totalDuration: number;
        speed: number;
      };
      eventTriggers: Array<{
        id: string;
        name: string;
        description: string;
        trigger: () => void;
      }>;
    };
    metricsPanel: {
      realTimeMetrics: {
        activeVehicles: number;
        completedDeliveries: number;
        averageSpeed: number;
        fuelEfficiency: number;
        complianceRate: number;
      };
      charts: Array<{
        type: 'line' | 'bar' | 'pie';
        title: string;
        data: any[];
      }>;
    };
  }> {
    try {
      const vehicles = this.convertDemoVehiclesToModels(config.vehicles);
      const hubs = this.convertDemoHubsToModels(config.hubs);
      const deliveries = this.convertDemoDeliveriesToModels(config.deliveries);
      const routes = await this.generateOptimizedRoutes(vehicles, deliveries, hubs);

      const mapData = await this.mapVisualizationService.createInteractiveMapData(
        routes,
        vehicles,
        hubs
      );

      return {
        mapData,
        controlPanel: {
          scenarios: ['delhi_compliance', 'hub_spoke', 'breakdown_recovery', 'traffic_optimization'],
          currentScenario: config.name,
          playbackControls: {
            isPlaying: false,
            currentTime: 0,
            totalDuration: config.duration,
            speed: config.timeAcceleration
          },
          eventTriggers: this.createEventTriggers(config.events)
        },
        metricsPanel: {
          realTimeMetrics: {
            activeVehicles: vehicles.filter(v => v.status === 'in-transit').length,
            completedDeliveries: 0,
            averageSpeed: this.calculateAverageSpeed(vehicles),
            fuelEfficiency: 0,
            complianceRate: 100
          },
          charts: this.generateMetricsCharts(vehicles, routes)
        }
      };
    } catch (error) {
      throw new Error(`Failed to create demo dashboard: ${error}`);
    }
  }

  // Private helper methods

  private async generateDelhiComplianceScenario(options: ScenarioGenerationOptions): Promise<DemoScenarioConfig> {
    const center = options.centerLocation || [77.2090, 28.6139];
    
    return {
      name: 'Delhi Vehicle Class Compliance Demo',
      description: 'Demonstrates vehicle assignment based on Delhi-specific time and zone restrictions',
      duration: 600, // 10 minutes
      timeAcceleration: options.timeAcceleration || 10,
      centerLocation: center,
      vehicles: [
        {
          id: 'TRUCK_DL01AB1234',
          type: 'truck',
          location: [center[0] - 0.02, center[1] + 0.01],
          status: 'available',
          plateNumber: 'DL01AB1234',
          fuelType: 'diesel',
          pollutionLevel: 'BS6'
        },
        {
          id: 'TEMPO_DL02CD5678',
          type: 'tempo',
          location: [center[0] + 0.01, center[1] - 0.01],
          status: 'available',
          plateNumber: 'DL02CD5678',
          fuelType: 'cng',
          pollutionLevel: 'BS6'
        },
        {
          id: 'EV_DL03EF9012',
          type: 'electric',
          location: [center[0], center[1]],
          status: 'available',
          plateNumber: 'DL03EF9012',
          fuelType: 'electric',
          pollutionLevel: 'electric'
        },
        {
          id: 'THREE_WHEELER_DL04GH3456',
          type: 'three-wheeler',
          location: [center[0] + 0.015, center[1] + 0.015],
          status: 'available',
          plateNumber: 'DL04GH3456',
          fuelType: 'cng',
          pollutionLevel: 'BS6'
        }
      ],
      hubs: [
        {
          id: 'HUB_CENTRAL',
          name: 'Central Distribution Hub',
          location: center,
          capacity: 50,
          bufferVehicles: 5
        }
      ],
      deliveries: [
        {
          id: 'DELIVERY_COMMERCIAL',
          pickupLocation: center,
          deliveryLocation: [center[0] + 0.02, center[1] + 0.01], // Connaught Place area
          weight: 2000,
          volume: 10,
          timeWindow: { earliest: '09:00', latest: '18:00' },
          priority: 'high'
        },
        {
          id: 'DELIVERY_RESIDENTIAL_RESTRICTED',
          pickupLocation: center,
          deliveryLocation: [center[0] - 0.03, center[1] - 0.02], // Karol Bagh residential
          weight: 500,
          volume: 3,
          timeWindow: { earliest: '01:00', latest: '05:00' }, // Truck restricted hours
          priority: 'medium'
        },
        {
          id: 'DELIVERY_NARROW_LANE',
          pickupLocation: center,
          deliveryLocation: [center[0] + 0.025, center[1] - 0.015], // Lajpat Nagar
          weight: 200,
          volume: 1,
          timeWindow: { earliest: '10:00', latest: '16:00' },
          priority: 'low'
        }
      ],
      events: [
        {
          time: 120, // 2 minutes in
          type: 'compliance_violation',
          vehicleId: 'TRUCK_DL01AB1234',
          location: [center[0] - 0.03, center[1] - 0.02],
          description: 'Truck attempting delivery in residential area during restricted hours',
          impact: { duration: 60, severity: 'high' }
        },
        {
          time: 180, // 3 minutes in
          type: 'compliance_violation',
          vehicleId: 'TEMPO_DL02CD5678',
          description: 'Even-numbered vehicle on odd date (odd-even rule violation)',
          impact: { duration: 30, severity: 'medium' }
        }
      ]
    };
  }

  private async generateHubSpokeScenario(options: ScenarioGenerationOptions): Promise<DemoScenarioConfig> {
    const center = options.centerLocation || [77.2090, 28.6139];
    
    return {
      name: 'Hub-and-Spoke Operations Demo',
      description: 'Shows multi-hub routing with load transfers and buffer vehicle allocation',
      duration: 900, // 15 minutes
      timeAcceleration: options.timeAcceleration || 15,
      centerLocation: center,
      vehicles: [
        {
          id: 'INTER_HUB_TRUCK_1',
          type: 'truck',
          location: [center[0], center[1] + 0.03], // North hub
          status: 'available'
        },
        {
          id: 'INTER_HUB_TRUCK_2',
          type: 'truck',
          location: [center[0], center[1] - 0.03], // South hub
          status: 'available'
        },
        {
          id: 'LOCAL_TEMPO_1',
          type: 'tempo',
          location: [center[0] + 0.03, center[1]], // East hub
          status: 'available'
        },
        {
          id: 'LOCAL_TEMPO_2',
          type: 'tempo',
          location: [center[0] - 0.03, center[1]], // West hub
          status: 'available'
        }
      ],
      hubs: [
        {
          id: 'HUB_NORTH',
          name: 'North Delhi Hub',
          location: [center[0], center[1] + 0.03],
          capacity: 30,
          bufferVehicles: 3
        },
        {
          id: 'HUB_SOUTH',
          name: 'South Delhi Hub',
          location: [center[0], center[1] - 0.03],
          capacity: 30,
          bufferVehicles: 3
        },
        {
          id: 'HUB_EAST',
          name: 'East Delhi Hub',
          location: [center[0] + 0.03, center[1]],
          capacity: 25,
          bufferVehicles: 2
        },
        {
          id: 'HUB_WEST',
          name: 'West Delhi Hub',
          location: [center[0] - 0.03, center[1]],
          capacity: 25,
          bufferVehicles: 2
        }
      ],
      deliveries: this.generateCrossHubDeliveries(center, 15),
      events: [
        {
          time: 300, // 5 minutes in
          type: 'breakdown',
          vehicleId: 'INTER_HUB_TRUCK_1',
          location: [center[0] - 0.01, center[1] + 0.02],
          description: 'Inter-hub truck breakdown on route',
          impact: { duration: 180, severity: 'high' }
        }
      ]
    };
  }

  private async generateBreakdownRecoveryScenario(options: ScenarioGenerationOptions): Promise<DemoScenarioConfig> {
    const center = options.centerLocation || [77.2090, 28.6139];
    
    return {
      name: 'Vehicle Breakdown Recovery Demo',
      description: 'Simulates vehicle breakdown and automatic buffer vehicle allocation',
      duration: 480, // 8 minutes
      timeAcceleration: options.timeAcceleration || 8,
      centerLocation: center,
      vehicles: [
        {
          id: 'PRIMARY_VEHICLE',
          type: 'truck',
          location: [center[0] + 0.02, center[1] + 0.01],
          status: 'in-transit'
        },
        {
          id: 'BUFFER_VEHICLE_1',
          type: 'truck',
          location: center,
          status: 'available'
        },
        {
          id: 'BUFFER_VEHICLE_2',
          type: 'tempo',
          location: center,
          status: 'available'
        }
      ],
      hubs: [
        {
          id: 'RECOVERY_HUB',
          name: 'Emergency Recovery Hub',
          location: center,
          capacity: 20,
          bufferVehicles: 2
        }
      ],
      deliveries: [
        {
          id: 'URGENT_DELIVERY',
          pickupLocation: [center[0] + 0.02, center[1] + 0.01],
          deliveryLocation: [center[0] + 0.04, center[1] + 0.02],
          weight: 1500,
          volume: 8,
          timeWindow: { earliest: '10:00', latest: '12:00' },
          priority: 'urgent'
        }
      ],
      events: [
        {
          time: 120, // 2 minutes in
          type: 'breakdown',
          vehicleId: 'PRIMARY_VEHICLE',
          location: [center[0] + 0.025, center[1] + 0.015],
          description: 'Primary delivery vehicle breakdown',
          impact: { duration: 300, severity: 'high' }
        }
      ]
    };
  }

  private async generateTrafficOptimizationScenario(options: ScenarioGenerationOptions): Promise<DemoScenarioConfig> {
    const center = options.centerLocation || [77.2090, 28.6139];
    
    return {
      name: 'Traffic-Aware Route Optimization Demo',
      description: 'Shows dynamic route optimization based on real-time traffic conditions',
      duration: 720, // 12 minutes
      timeAcceleration: options.timeAcceleration || 12,
      centerLocation: center,
      vehicles: [
        {
          id: 'OPTIMIZED_VEHICLE_1',
          type: 'van',
          location: [center[0] - 0.02, center[1]],
          status: 'in-transit'
        },
        {
          id: 'OPTIMIZED_VEHICLE_2',
          type: 'tempo',
          location: [center[0], center[1] + 0.02],
          status: 'in-transit'
        }
      ],
      hubs: [
        {
          id: 'TRAFFIC_HUB',
          name: 'Traffic Optimization Hub',
          location: center,
          capacity: 25,
          bufferVehicles: 2
        }
      ],
      deliveries: this.generateTrafficSensitiveDeliveries(center, 8),
      events: [
        {
          time: 180, // 3 minutes in
          type: 'traffic_jam',
          location: [center[0] + 0.01, center[1] + 0.01],
          description: 'Heavy traffic congestion on main route',
          impact: { duration: 240, severity: 'high' }
        },
        {
          time: 360, // 6 minutes in
          type: 'weather_change',
          description: 'Heavy rain affecting traffic conditions',
          impact: { duration: 180, severity: 'medium' }
        }
      ]
    };
  }

  private convertDemoVehiclesToModels(demoVehicles: DemoVehicleConfig[]): Vehicle[] {
    return demoVehicles.map(dv => ({
      id: dv.id,
      type: dv.type,
      subType: this.getSubType(dv.type) as VehicleSubType, // Added type assertion
      capacity: this.getVehicleCapacity(dv.type),
      location: { latitude: dv.location[1], longitude: dv.location[0], timestamp: new Date() }, // Added timestamp
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
        manufacturingYear: 2020 // Added this line
      },
      accessPrivileges: this.getAccessPrivileges(dv.type),
      driverInfo: {
        id: `driver_${dv.id}`,
        name: `Driver ${dv.id}`, // Added this line
        licenseNumber: `LIC-${Math.floor(Math.random() * 1000000)}`, // Added this line
        contactNumber: `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`, // Added this line
        workingHours: 8,
        maxWorkingHours: 12
      },
      lastUpdated: new Date() // Added this line
    }));
  }

  private convertDemoHubsToModels(demoHubs: DemoHubConfig[]): Hub[] {
    return demoHubs.map(dh => ({
      id: dh.id,
      name: dh.name,
      location: { latitude: dh.location[1], longitude: dh.location[0] },
      capacity: {
        vehicles: dh.capacity,
        storage: dh.capacity * 100,
        maxVehicles: dh.capacity, // Added this line
        currentVehicles: dh.capacity, // Added this line
        storageArea: dh.capacity * 100, // Added this line
        loadingBays: 5, // Added this line
        bufferVehicleSlots: dh.bufferVehicles // Added this line
      },
      bufferVehicles: [],
      operatingHours: { open: '06:00', close: '22:00', timezone: 'Asia/Kolkata' }, // Added timezone
      facilities: ['loading_dock', 'fuel_station'],
      hubType: 'primary', // Changed from 'distribution' to 'primary'
      status: 'active', // Added this line
      contactInfo: {
        manager: 'Hub Manager',
        managerName: 'Hub Manager Name', // Added this line
        phone: '123-456-7890',
        email: `${dh.id.toLowerCase()}@example.com`,
        emergencyContact: '987-654-3210' // Added this line
      },
      createdAt: new Date(), // Added this line
      updatedAt: new Date() // Added this line
    }));
  }

  private convertDemoDeliveriesToModels(demoDeliveries: DemoDeliveryConfig[]): Delivery[] {
    return demoDeliveries.map(dd => ({
      id: dd.id,
      pickupLocation: { latitude: dd.pickupLocation[1], longitude: dd.pickupLocation[0] },
      deliveryLocation: { latitude: dd.deliveryLocation[1], longitude: dd.deliveryLocation[0] },
      timeWindow: {
        earliest: this.parseTimeToDate(dd.timeWindow.earliest),
        latest: this.parseTimeToDate(dd.timeWindow.latest)
      },
      shipment: {
        weight: dd.weight,
        volume: dd.volume,
        fragile: false,
        specialHandling: [],
        hazardous: false, // Added this line
        temperatureControlled: false // Added this line
      },
      priority: dd.priority,
      customerId: `CUST-${Math.floor(Math.random() * 100000)}`, // Added this line
      serviceType: 'shared', // Added this line
      createdAt: new Date(), // Added this line
      updatedAt: new Date() // Added this line
    }));
  }

  private async generateOptimizedRoutes(vehicles: Vehicle[], deliveries: Delivery[], _hubs: Hub[]): Promise<Route[]> {
    // This would normally use the RoutingService, but for demo purposes we'll create simplified routes
    return vehicles.map((vehicle, index) => ({
      id: `route_${vehicle.id}`,
      vehicleId: vehicle.id,
      stops: deliveries.slice(index, index + 2).map((delivery, stopIndex) => ({
        id: `stop_${delivery.id}`,
        sequence: stopIndex,
        location: stopIndex === 0 ? delivery.pickupLocation : delivery.deliveryLocation,
        type: stopIndex === 0 ? 'pickup' : 'delivery',
        estimatedArrivalTime: new Date(Date.now() + (stopIndex + 1) * 1800000),
        estimatedDepartureTime: new Date(Date.now() + (stopIndex + 1) * 1800000 + 300000),
        duration: 15,
        status: 'pending',
        address: `${stopIndex === 0 ? 'Pickup' : 'Delivery'} Location ${delivery.id}`
      })),
      estimatedDuration: 3600,
      estimatedDistance: 15000,
      estimatedFuelConsumption: 5.0,
      trafficFactors: [],
      status: 'planned'
    }));
  }

  private async executeScenarioWithEvents(
    config: DemoScenarioConfig,
    vehicles: Vehicle[],
    routes: Route[],
    _animationFrames: RouteAnimationFrame[]
  ): Promise<DemoExecutionState> {
    const state: DemoExecutionState = {
      currentTime: config.duration,
      vehiclePositions: new Map(),
      routeProgress: new Map(),
      activeEvents: [],
      completedDeliveries: config.deliveries.map(d => d.id),
      metrics: {
        totalDistance: routes.reduce((sum, r) => sum + r.estimatedDistance, 0),
        totalTime: config.duration,
        fuelConsumed: routes.reduce((sum, r) => sum + r.estimatedFuelConsumption, 0),
        complianceViolations: config.events.filter(e => e.type === 'compliance_violation').length,
        efficiencyScore: 85
      }
    };

    // Set final vehicle positions
    vehicles.forEach(vehicle => {
      state.vehiclePositions.set(vehicle.id, [vehicle.location.longitude, vehicle.location.latitude]);
    });

    routes.forEach(route => {
      state.routeProgress.set(route.id, 1.0);
    });

    return state;
  }

  private calculateScenarioSummary(config: DemoScenarioConfig, finalState: DemoExecutionState) {
    return {
      totalDeliveries: config.deliveries.length,
      successfulDeliveries: finalState.completedDeliveries.length,
      averageDeliveryTime: finalState.metrics.totalTime / config.deliveries.length,
      fuelEfficiency: finalState.metrics.totalDistance / finalState.metrics.fuelConsumed,
      complianceRate: ((config.deliveries.length - finalState.metrics.complianceViolations) / config.deliveries.length) * 100
    };
  }

  private createEventTriggers(events: DemoEventConfig[]) {
    return events.map(event => ({
      // eslint-disable-next-line prefer-template
      id: `${event.type  }_${  event.time}`,
      name: event.type.replace('_', ' ').toUpperCase(),
      description: event.description,
      trigger: () => {
        console.log(`Triggering event: ${event.description}`);
        // In a real implementation, this would trigger the actual event
      }
    }));
  }

  private calculateAverageSpeed(vehicles: Vehicle[]): number {
    const speeds = {
      'truck': 40,
      'tempo': 35,
      'van': 45,
      'three-wheeler': 25,
      'electric': 30
    };

    const totalSpeed = vehicles.reduce((sum, vehicle) => {
      return sum + (speeds[vehicle.type as keyof typeof speeds] || 35);
    }, 0);

    return vehicles.length > 0 ? totalSpeed / vehicles.length : 0;
  }

  private generateMetricsCharts(vehicles: Vehicle[], routes: Route[]) {
    return [
      {
        type: 'pie' as const,
        title: 'Vehicle Type Distribution',
        data: this.getVehicleTypeDistribution(vehicles)
      },
      {
        type: 'bar' as const,
        title: 'Route Efficiency',
        data: routes.map(route => ({
          name: route.id,
          value: route.estimatedDistance / route.estimatedDuration
        }))
      },
      {
        type: 'line' as const,
        title: 'Fuel Consumption Over Time',
        data: routes.map((route, index) => ({
          time: index * 30,
          consumption: route.estimatedFuelConsumption
        }))
      }
    ];
  }

  private generateCrossHubDeliveries(center: [number, number], count: number): DemoDeliveryConfig[] {
    const deliveries: DemoDeliveryConfig[] = [];
    const hubOffsets = [
      [0, 0.03], [0, -0.03], [0.03, 0], [-0.03, 0]
    ];

    for (let i = 0; i < count; i++) {
      const pickupHub = hubOffsets[i % hubOffsets.length];
      const deliveryHub = hubOffsets[(i + 1) % hubOffsets.length];

      deliveries.push({
        id: `CROSS_HUB_DELIVERY_${i + 1}`,
        pickupLocation: [center[0] + pickupHub[0], center[1] + pickupHub[1]],
        deliveryLocation: [center[0] + deliveryHub[0], center[1] + deliveryHub[1]],
        weight: 500 + Math.random() * 1500,
        volume: 2 + Math.random() * 8,
        timeWindow: {
          earliest: '08:00',
          latest: '18:00'
        },
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high'
      });
    }

    return deliveries;
  }

  private generateTrafficSensitiveDeliveries(center: [number, number], count: number): DemoDeliveryConfig[] {
    const deliveries: DemoDeliveryConfig[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      const radius = 0.02 + Math.random() * 0.02;
      
      deliveries.push({
        id: `TRAFFIC_DELIVERY_${i + 1}`,
        pickupLocation: center,
        deliveryLocation: [
          center[0] + Math.cos(angle) * radius,
          center[1] + Math.sin(angle) * radius
        ],
        weight: 200 + Math.random() * 800,
        volume: 1 + Math.random() * 4,
        timeWindow: {
          earliest: '09:00',
          latest: '17:00'
        },
        priority: 'medium'
      });
    }

    return deliveries;
  }

  private getSubType(type: string): string {
    const subTypes = {
      'truck': 'heavy-truck',
      'tempo': 'tempo-traveller',
      'van': 'pickup-van',
      'three-wheeler': 'auto-rickshaw',
      'electric': 'e-rickshaw'
    };
    return subTypes[type as keyof typeof subTypes] || 'unknown';
  }

  private getVehicleCapacity(type: string) {
    const capacities = {
      'truck': { weight: 5000, volume: 20, maxDimensions: { length: 10, width: 2.5, height: 3 } },
      'tempo': { weight: 1500, volume: 8, maxDimensions: { length: 5, width: 2, height: 2.2 } },
      'van': { weight: 1000, volume: 6, maxDimensions: { length: 4, width: 1.8, height: 2 } },
      'three-wheeler': { weight: 300, volume: 2, maxDimensions: { length: 3, width: 1.5, height: 1.8 } },
      'electric': { weight: 250, volume: 1.5, maxDimensions: { length: 3.5, width: 1.6, height: 1.9 } }
    };
    return capacities[type as keyof typeof capacities] || { weight: 1000, volume: 5, maxDimensions: { length: 4, width: 1.8, height: 2 } };
  }

  private getAccessPrivileges(type: string) {
    const privileges = {
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
    return privileges[type as keyof typeof privileges] || privileges.tempo;
  }

  private parseTimeToDate(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private getVehicleTypeDistribution(vehicles: Vehicle[]) {
    const distribution: { [key: string]: number } = {};
    vehicles.forEach(vehicle => {
      distribution[vehicle.type] = (distribution[vehicle.type] || 0) + 1;
    });
    
    return Object.entries(distribution).map(([type, count]) => ({
      name: type,
      value: count
    }));
  }
} 