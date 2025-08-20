import { MapboxVisualizationClient, MapboxConfig, RouteVisualizationData, VehicleTrackingData, DemoScenarioData } from './external/MapboxVisualizationClient';
import { GraphHopperNavigationClient, GraphHopperConfig, NavigationData } from './external/GraphHopperNavigationClient';
import { Route, Vehicle, Hub, GeoLocation } from '../models';

export interface MapVisualizationConfig {
  mapboxClient?: any;
  mapbox: MapboxConfig;
  graphHopper: GraphHopperConfig;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export interface InteractiveMapData {
  routes: RouteVisualizationData[];
  vehicles: VehicleTrackingData[];
  hubs: Array<{
    id: string;
    location: [number, number];
    name: string;
    capacity: number;
    currentLoad: number;
    bufferVehicles: number;
    status: 'active' | 'congested' | 'maintenance';
  }>;
  bounds: {
    southwest: [number, number];
    northeast: [number, number];
  };
}

export interface RouteAnimationFrame {
  timestamp: number;
  vehiclePositions: Map<string, VehicleTrackingData>;
  routeProgress: Map<string, number>;
  events: Array<{
    type: 'pickup' | 'delivery' | 'breakdown' | 'reroute';
    vehicleId: string;
    location: [number, number];
    message: string;
  }>;
}

export interface ScenarioGenerationOptions {
  scenarioType: 'delhi_compliance' | 'hub_spoke' | 'breakdown_recovery' | 'traffic_optimization';
  centerLocation?: [number, number];
  vehicleCount?: number;
  hubCount?: number;
  deliveryCount?: number;
  timeAcceleration?: number;
}

/**
 * Service for map visualization and interactive route display
 * Integrates with Mapbox for rendering and scenario generation
 */
export class MapVisualizationService {
  private mapboxClient: MapboxVisualizationClient;
  private graphHopperClient: GraphHopperNavigationClient;
  private defaultCenter: [number, number];
  private defaultZoom: number;

  constructor(config: MapVisualizationConfig) {
    this.mapboxClient = new MapboxVisualizationClient(config.mapbox);
    this.graphHopperClient = new GraphHopperNavigationClient(config.graphHopper);
    this.defaultCenter = config.defaultCenter || [77.2090, 28.6139]; // Delhi center
    this.defaultZoom = config.defaultZoom || 11;
  }

  /**
   * Convert routes to interactive map visualization data
   */
  async createInteractiveMapData(
    routes: Route[],
    vehicles: Vehicle[],
    hubs: Hub[]
  ): Promise<InteractiveMapData> {
    try {
      // Convert routes to visualization format
      const routeVisualizations = await Promise.all(
        routes.map(route => this.mapboxClient.convertRouteToVisualization(route))
      );

      // Create vehicle tracking data
      const vehicleTrackingData = vehicles.map(vehicle => {
        const vehicleRoute = routes.find(r => r.vehicleId === vehicle.id);
        const progress = this.calculateVehicleProgress(vehicle, vehicleRoute);
        
        return this.mapboxClient.createVehicleTrackingData(
          vehicle,
          vehicleRoute || this.createDefaultRoute(vehicle),
          progress
        );
      });

      // Convert hubs to visualization format
      const hubData = hubs.map(hub => ({
        id: hub.id,
        location: [hub.location.longitude, hub.location.latitude] as [number, number],
        name: hub.name || hub.id,
        capacity: hub.capacity.maxVehicles,
        currentLoad: this.calculateHubLoad(hub, vehicles),
        bufferVehicles: hub.bufferVehicles?.length || 0,
        status: this.determineHubStatus(hub, vehicles)
      }));

      // Calculate bounds for all locations
      const allLocations: Array<[number, number]> = [
        ...routeVisualizations.flatMap(r => r.coordinates.map(coord => [coord[0], coord[1]] as [number, number])),
        ...vehicleTrackingData.map(v => v.currentLocation),
        ...hubData.map(h => h.location)
      ];

      const bounds = this.mapboxClient.calculateMapBounds(allLocations);

      return {
        routes: routeVisualizations,
        vehicles: vehicleTrackingData,
        hubs: hubData,
        bounds
      };
    } catch (error) {
      throw new Error(`Failed to create interactive map data: ${error}`);
    }
  }

  /**
   * Generate demo scenario for testing and demonstration
   */
  async generateDemoScenario(options: ScenarioGenerationOptions): Promise<DemoScenarioData> {
    try {
      const scenario = await this.mapboxClient.generateDemoScenario(
        options.scenarioType,
        options.centerLocation || this.defaultCenter
      );

      // Enhance scenario with additional demo-specific data
      return this.enhanceScenarioForDemo(scenario, options);
    } catch (error) {
      throw new Error(`Failed to generate demo scenario: ${error}`);
    }
  }

  /**
   * Create route animation frames for smooth visualization
   */
  async createRouteAnimation(
    routes: Route[],
    vehicles: Vehicle[],
    duration: number = 300, // seconds
    frameRate: number = 30 // fps
  ): Promise<RouteAnimationFrame[]> {
    try {
      const frames: RouteAnimationFrame[] = [];
      const totalFrames = duration * frameRate;
      const timeStep = duration / totalFrames;

      for (let frame = 0; frame < totalFrames; frame++) {
        const timestamp = frame * timeStep;
        // const _progress = frame / totalFrames;

        const vehiclePositions = new Map<string, VehicleTrackingData>();
        const routeProgress = new Map<string, number>();
        const events: RouteAnimationFrame['events'] = [];

        // Calculate vehicle positions for this frame
        for (const vehicle of vehicles) {
          const route = routes.find(r => r.vehicleId === vehicle.id);
          if (route) {
            const vehicleProgress = this.calculateProgressAtTime(route, timestamp);
            const trackingData = this.mapboxClient.createVehicleTrackingData(
              vehicle,
              route,
              vehicleProgress
            );

            vehiclePositions.set(vehicle.id, trackingData);
            routeProgress.set(route.id, vehicleProgress);

            // Generate events at specific progress points
            const frameEvents = this.generateEventsForFrame(vehicle, route, vehicleProgress, timestamp);
            events.push(...frameEvents);
          }
        }

        frames.push({
          timestamp,
          vehiclePositions,
          routeProgress,
          events
        });
      }

      return frames;
    } catch (error) {
      throw new Error(`Failed to create route animation: ${error}`);
    }
  }

  /**
   * Visualize route optimization process
   */
  async visualizeRouteOptimization(
    beforeRoutes: Route[],
    afterRoutes: Route[],
    optimizationSteps?: Array<{
      step: number;
      description: string;
      routes: Route[];
      improvement: number;
    }>
  ): Promise<{
    before: InteractiveMapData;
    after: InteractiveMapData;
    steps: Array<{
      step: number;
      description: string;
      data: InteractiveMapData;
      improvement: number;
    }>;
    summary: {
      totalDistanceReduction: number;
      timeReduction: number;
      fuelSavings: number;
      efficiencyImprovement: number;
    };
  }> {
    try {
      // Create visualization data for before and after states
      const beforeData = await this.createInteractiveMapData(beforeRoutes, [], []);
      const afterData = await this.createInteractiveMapData(afterRoutes, [], []);

      // Process optimization steps if provided
      const stepVisualizations = optimizationSteps ? await Promise.all(
        optimizationSteps.map(async step => ({
          step: step.step,
          description: step.description,
          data: await this.createInteractiveMapData(step.routes, [], []),
          improvement: step.improvement
        }))
      ) : [];

      // Calculate summary metrics
      const summary = this.calculateOptimizationSummary(beforeRoutes, afterRoutes);

      return {
        before: beforeData,
        after: afterData,
        steps: stepVisualizations,
        summary
      };
    } catch (error) {
      throw new Error(`Failed to visualize route optimization: ${error}`);
    }
  }

  /**
   * Enhance routes with turn-by-turn navigation data from GraphHopper
   */
  async enhanceRoutesWithNavigation(routes: Route[]): Promise<Array<Route & { navigationData?: NavigationData }>> {
    try {
      const enhancedRoutes = await Promise.all(
        routes.map(async (route) => {
          if (route.stops.length < 2) {
            return route;
          }

          try {
            // Get coordinates for the route
            const coordinates: Array<[number, number]> = route.stops.map(stop => [
              stop.location.longitude,
              stop.location.latitude
            ]);

            // Get navigation directions from GraphHopper
            const graphHopperResponse = await this.graphHopperClient.getNavigationDirections(coordinates, {
              avoidTolls: false,
              avoidHighways: false,
              avoidFerries: false,
              considerTraffic: true
            });

            // Convert to navigation data
            const navigationData = this.graphHopperClient.convertToNavigationData(
              route.id,
              graphHopperResponse,
              true
            );

            // Integrate navigation data with the route
            const enhancedRoute = this.graphHopperClient.integrateWithORToolsRoute(route, navigationData);

            return {
              ...enhancedRoute,
              navigationData
            };
          } catch (error) {
            console.warn(`Failed to get navigation data for route ${route.id}:`, error);
            return route;
          }
        })
      );

      return enhancedRoutes;
    } catch (error) {
      throw new Error(`Failed to enhance routes with navigation: ${error}`);
    }
  }

  /**
   * Generate Delhi-specific navigation scenarios for demonstration
   */
  async generateDelhiNavigationScenarios(): Promise<{
    peakHourNavigation: NavigationData;
    offPeakNavigation: NavigationData;
    monsoonNavigation: NavigationData;
    pollutionAlertNavigation: NavigationData;
  }> {
    try {
      return await this.graphHopperClient.generateDelhiNavigationScenarios();
    } catch (error) {
      throw new Error(`Failed to generate Delhi navigation scenarios: ${error}`);
    }
  }

  /**
   * Get traffic-aware routing comparison for demonstration
   */
  async getTrafficAwareRoutingDemo(
    origin: GeoLocation,
    destination: GeoLocation
  ): Promise<{
    normalRoute: NavigationData;
    trafficOptimizedRoute: NavigationData;
    trafficSavings: {
      timeSavedMinutes: number;
      distanceDifference: number;
      fuelSavings: number;
    };
  }> {
    try {
      return await this.graphHopperClient.getTrafficAwareRouting(origin, destination);
    } catch (error) {
      throw new Error(`Failed to get traffic-aware routing demo: ${error}`);
    }
  }

  /**
   * Create hub operations visualization
   */
  async visualizeHubOperations(
    hub: Hub,
    vehicles: Vehicle[],
    routes: Route[]
  ): Promise<{
    hubData: InteractiveMapData['hubs'][0];
    vehicleFlow: Array<{
      vehicleId: string;
      direction: 'incoming' | 'outgoing';
      estimatedTime: Date;
      route: RouteVisualizationData;
    }>;
    loadTransfers: Array<{
      fromVehicle: string;
      toVehicle: string;
      transferTime: number;
      loadDetails: {
        weight: number;
        volume: number;
        items: number;
      };
    }>;
    bufferAllocation: Array<{
      bufferId: string;
      assignedTo: string;
      reason: 'breakdown' | 'capacity_overflow' | 'emergency';
      timestamp: Date;
    }>;
  }> {
    try {
      const hubVehicles = vehicles.filter(v => 
        this.isVehicleAtHub(v, hub) || 
        routes.some(r => r.vehicleId === v.id && this.routePassesThroughHub(r, hub))
      );

      const hubData = {
        id: hub.id,
        location: [hub.location.longitude, hub.location.latitude] as [number, number],
        name: hub.name || hub.id,
        capacity: hub.capacity.maxVehicles,
        currentLoad: this.calculateHubLoad(hub, vehicles),
        bufferVehicles: hub.bufferVehicles?.length || 0,
        status: this.determineHubStatus(hub, vehicles)
      };

      // Analyze vehicle flow
      const vehicleFlow = await this.analyzeVehicleFlow(hub, hubVehicles, routes);

      // Identify load transfers
      const loadTransfers = this.identifyLoadTransfers(hub, routes);

      // Track buffer allocations
      const bufferAllocation = this.trackBufferAllocations(hub);

      return {
        hubData,
        vehicleFlow,
        loadTransfers,
        bufferAllocation
      };
    } catch (error) {
      throw new Error(`Failed to visualize hub operations: ${error}`);
    }
  }

  // Private helper methods

  private calculateVehicleProgress(vehicle: Vehicle, route?: Route): number {
    if (!route) return 0;
    
    // Simple progress calculation based on vehicle status
    switch (vehicle.status) {
      case 'available': return 0;
      case 'loading': return 0.1;
      case 'in-transit': return 0.5; // Assume halfway
      case 'maintenance': return 0;
      case 'breakdown': return 0.3; // Assume broke down partway
      default: return 0;
    }
  }

  private createDefaultRoute(vehicle: Vehicle): Route {
    return {
      id: `default_${vehicle.id}`,
      vehicleId: vehicle.id,
      stops: [{
        id: 'current',
        sequence: 0,
        location: vehicle.location,
        type: 'waypoint',
        estimatedArrivalTime: new Date(),
        estimatedDepartureTime: new Date(),
        duration: 0,
        status: 'pending'
      }],
      estimatedDuration: 0,
      estimatedDistance: 0,
      estimatedFuelConsumption: 0,
      trafficFactors: [],
      status: 'planned'
    };
  }

  private calculateHubLoad(hub: Hub, vehicles: Vehicle[]): number {
    return vehicles.filter(v => this.isVehicleAtHub(v, hub)).length;
  }

  private determineHubStatus(hub: Hub, vehicles: Vehicle[]): 'active' | 'congested' | 'maintenance' {
    const currentLoad = this.calculateHubLoad(hub, vehicles);
    const utilizationRate = currentLoad / hub.capacity.maxVehicles;

    if (utilizationRate > 0.9) return 'congested';
    if (currentLoad === 0) return 'maintenance';
    return 'active';
  }

  private isVehicleAtHub(vehicle: Vehicle, hub: Hub): boolean {
    const distance = this.calculateDistance(vehicle.location, hub.location);
    return distance < 0.001; // Within ~100 meters
  }

  private routePassesThroughHub(route: Route, hub: Hub): boolean {
    return route.stops.some(stop => {
      const distance = this.calculateDistance(stop.location, hub.location);
      return distance < 0.001;
    });
  }

  private calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private enhanceScenarioForDemo(scenario: DemoScenarioData, options: ScenarioGenerationOptions): DemoScenarioData {
    // Add more vehicles if requested
    if (options.vehicleCount && options.vehicleCount > scenario.vehicles.length) {
      const additionalVehicles = this.generateAdditionalVehicles(
        options.vehicleCount - scenario.vehicles.length,
        scenario.bounds
      );
      scenario.vehicles.push(...additionalVehicles);
    }

    // Add more hubs if requested
    if (options.hubCount && options.hubCount > scenario.hubs.length) {
      const additionalHubs = this.generateAdditionalHubs(
        options.hubCount - scenario.hubs.length,
        scenario.bounds
      );
      scenario.hubs.push(...additionalHubs);
    }

    return scenario;
  }

  private generateAdditionalVehicles(count: number, bounds: DemoScenarioData['bounds']): DemoScenarioData['vehicles'] {
    const vehicles: DemoScenarioData['vehicles'] = [];
    const vehicleTypes = ['truck', 'tempo', 'van', 'three-wheeler', 'electric'];

    for (let i = 0; i < count; i++) {
      vehicles.push({
        id: `DEMO_VEHICLE_${i + 1}`,
        type: vehicleTypes[i % vehicleTypes.length]!,
        location: this.generateRandomLocationInBounds(bounds),
        status: 'available'
      });
    }

    return vehicles;
  }

  private generateAdditionalHubs(count: number, bounds: DemoScenarioData['bounds']): DemoScenarioData['hubs'] {
    const hubs: DemoScenarioData['hubs'] = [];

    for (let i = 0; i < count; i++) {
      hubs.push({
        id: `DEMO_HUB_${i + 1}`,
        location: this.generateRandomLocationInBounds(bounds),
        capacity: 20 + Math.floor(Math.random() * 30),
        bufferVehicles: 2 + Math.floor(Math.random() * 4)
      });
    }

    return hubs;
  }

  private generateRandomLocationInBounds(bounds: DemoScenarioData['bounds']): [number, number] {
    const lngRange = bounds.northeast[0] - bounds.southwest[0];
    const latRange = bounds.northeast[1] - bounds.southwest[1];

    return [
      bounds.southwest[0] + Math.random() * lngRange,
      bounds.southwest[1] + Math.random() * latRange
    ];
  }

  private calculateProgressAtTime(route: Route, timestamp: number): number {
    // Simple linear progress based on time
    const totalDuration = route.estimatedDuration;
    return Math.min(timestamp / totalDuration, 1);
  }

  private generateEventsForFrame(
    vehicle: Vehicle,
    route: Route,
    progress: number,
    _timestamp: number
  ): RouteAnimationFrame['events'] {
    const events: RouteAnimationFrame['events'] = [];

    // Generate events at specific progress milestones
    const milestones = [0.25, 0.5, 0.75, 1.0];
    const tolerance = 0.02;

    for (const milestone of milestones) {
      if (Math.abs(progress - milestone) < tolerance) {
        const stopIndex = Math.floor(milestone * (route.stops.length - 1));
        const stop = route.stops[stopIndex];

        events.push({
          type: milestone === 1.0 ? 'delivery' : 'pickup',
          vehicleId: vehicle.id,
          location: [stop!.location.longitude, stop!.location.latitude],
          message: `${vehicle.id} ${milestone === 1.0 ? 'completed delivery' : 'reached waypoint'} at ${(stop as any)?.address || 'location'}`
        });
      }
    }

    return events;
  }

  private async analyzeVehicleFlow(
    _hub: Hub,
    vehicles: Vehicle[],
    _routes: Route[]
  ): Promise<Array<{
    vehicleId: string;
    direction: 'incoming' | 'outgoing';
    estimatedTime: Date;
    route: RouteVisualizationData;
  }>> {
    const flow = [];

    for (const vehicle of vehicles) {
      const route = _routes.find(r => r.vehicleId === vehicle.id);
      if (route && this.routePassesThroughHub(route, _hub)) {
        const routeViz = await this.mapboxClient.convertRouteToVisualization(route);
        
        flow.push({
          vehicleId: vehicle.id,
          direction: this.determineFlowDirection(vehicle, _hub, route),
          estimatedTime: this.estimateArrivalTime(vehicle, _hub, route),
          route: routeViz
        });
      }
    }

    return flow;
  }

  private determineFlowDirection(vehicle: Vehicle, _hub: Hub, route: Route): 'incoming' | 'outgoing' {
    const hubStopIndex = route.stops.findIndex(stop => 
      this.calculateDistance(stop.location, _hub.location) < 0.001
    );
    
    const vehicleProgress = this.calculateVehicleProgress(vehicle, route);
    const hubProgress = hubStopIndex / (route.stops.length - 1);

    return vehicleProgress < hubProgress ? 'incoming' : 'outgoing';
  }

  private estimateArrivalTime(vehicle: Vehicle, _hub: Hub, route: Route): Date {
    const hubStopIndex = route.stops.findIndex(stop => 
      this.calculateDistance(stop.location, _hub.location) < 0.001
    );
    
    if (hubStopIndex === -1) return new Date();

    const hubStop = route.stops[hubStopIndex];
    return hubStop!.estimatedArrivalTime;
  }

  private identifyLoadTransfers(_hub: Hub, _routes: Route[]): Array<{
    fromVehicle: string;
    toVehicle: string;
    transferTime: number;
    loadDetails: {
      weight: number;
      volume: number;
      items: number;
    };
  }> {
    // Simplified load transfer identification
    // In a real implementation, this would analyze route overlaps and capacity constraints
    return [];
  }

  private trackBufferAllocations(_hub: Hub): Array<{
    bufferId: string;
    assignedTo: string;
    reason: 'breakdown' | 'capacity_overflow' | 'emergency';
    timestamp: Date;
  }> {
    // Simplified buffer allocation tracking
    // In a real implementation, this would track actual buffer vehicle assignments
    return [];
  }

  private calculateOptimizationSummary(beforeRoutes: Route[], afterRoutes: Route[]): {
    totalDistanceReduction: number;
    timeReduction: number;
    fuelSavings: number;
    efficiencyImprovement: number;
  } {
    const beforeDistance = beforeRoutes.reduce((sum, route) => sum + route.estimatedDistance, 0);
    const afterDistance = afterRoutes.reduce((sum, route) => sum + route.estimatedDistance, 0);
    
    const beforeTime = beforeRoutes.reduce((sum, route) => sum + route.estimatedDuration, 0);
    const afterTime = afterRoutes.reduce((sum, route) => sum + route.estimatedDuration, 0);
    
    const beforeFuel = beforeRoutes.reduce((sum, route) => sum + route.estimatedFuelConsumption, 0);
    const afterFuel = afterRoutes.reduce((sum, route) => sum + route.estimatedFuelConsumption, 0);

    return {
      totalDistanceReduction: beforeDistance - afterDistance,
      timeReduction: beforeTime - afterTime,
      fuelSavings: beforeFuel - afterFuel,
      efficiencyImprovement: ((beforeDistance - afterDistance) / beforeDistance) * 100
    };
  }
}