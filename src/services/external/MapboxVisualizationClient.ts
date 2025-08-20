
import { BaseAPIClient } from './BaseAPIClient';
import { GeoLocation, Route, Vehicle} from '../../models';

export interface MapboxConfig {
  accessToken: string;
  baseUrl?: string;
  timeout?: number;
}

export interface MapboxRoute {
  geometry: {
    coordinates: number[][];
    type: 'LineString';
  };
  legs: MapboxRouteLeg[];
  distance: number;
  duration: number;
  weight: number;
}

export interface MapboxRouteLeg {
  distance: number;
  duration: number;
  steps: MapboxRouteStep[];
}

export interface MapboxRouteStep {
  geometry: {
    coordinates: number[][];
    type: 'LineString';
  };
  maneuver: {
    location: [number, number];
    type: string;
    instruction: string;
  };
  distance: number;
  duration: number;
}

export interface MapboxDirectionsResponse {
  routes: MapboxRoute[];
  waypoints: Array<{
    location: [number, number];
    name: string;
  }>;
  code: string;
}

export interface RouteVisualizationData {
  routeId: string;
  vehicleId: string;
  coordinates: number[][];
  waypoints: Array<{
    location: [number, number];
    name: string;
    type: 'pickup' | 'delivery' | 'hub';
  }>;
  distance: number;
  duration: number;
  trafficLevel: 'low' | 'moderate' | 'heavy';
}

export interface VehicleTrackingData {
  vehicleId: string;
  currentLocation: [number, number];
  heading: number;
  speed: number;
  status: 'moving' | 'stopped' | 'loading' | 'unloading';
  routeProgress: number; // 0-1
  estimatedArrival: Date;
}

export interface DemoScenarioData {
  name: string;
  description: string;
  vehicles: Array<{
    id: string;
    type: string;
    location: [number, number];
    status: string;
  }>;
  hubs: Array<{
    id: string;
    location: [number, number];
    capacity: number;
    bufferVehicles: number;
  }>;
  routes: RouteVisualizationData[];
  bounds: {
    southwest: [number, number];
    northeast: [number, number];
  };
}

/**
 * Mapbox client for route visualization and interactive mapping
 */
export class MapboxVisualizationClient extends BaseAPIClient {
  private accessToken: string;

  constructor(config: MapboxConfig) {
    super({
      baseUrl: config.baseUrl || 'https://api.mapbox.com',
      timeout: config.timeout || 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      cacheTimeout: 300
    });
    
    this.accessToken = config.accessToken;
  }

  /**
   * Get route geometry and directions from Mapbox Directions API
   */
  async getRouteDirections(
    coordinates: Array<[number, number]>,
    profile: 'driving' | 'driving-traffic' = 'driving-traffic'
  ): Promise<MapboxDirectionsResponse> {
    try {
      const coordinatesString = coordinates
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const response = await this.makeRequest<MapboxDirectionsResponse>(
        `/directions/v5/mapbox/${profile}/${coordinatesString}?access_token=${this.accessToken}&geometries=geojson&steps=true&overview=full&annotations=duration,distance,speed`
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get route directions from Mapbox: ${error}`);
    }
  }

  /**
   * Convert internal Route model to Mapbox visualization format
   */
  async convertRouteToVisualization(route: Route): Promise<RouteVisualizationData> {
    try {
      // Extract coordinates from route stops
      const coordinates: Array<[number, number]> = route.stops.map(stop => [
        stop.location.longitude,
        stop.location.latitude
      ]);

      // Get detailed route geometry from Mapbox
      const directions = await this.getRouteDirections(coordinates);
      
      if (!directions.routes || directions.routes.length === 0) {
        throw new Error('No route found from Mapbox');
      }

      const mapboxRoute = directions.routes[0];
      
      // Create waypoints with types
      const waypoints = route.stops.map((stop, index) => ({
        location: [stop.location.longitude, stop.location.latitude] as [number, number],
        name: (stop as any).address || `Stop ${index + 1}`,
        type: this.determineWaypointType(stop.type)
      }));

      return {
        routeId: route.id,
        vehicleId: route.vehicleId,
        coordinates: mapboxRoute!.geometry.coordinates,
        waypoints,
        distance: mapboxRoute!.distance,
        duration: mapboxRoute!.duration,
        trafficLevel: this.determineTrafficLevel(mapboxRoute!.duration, route.estimatedDuration)
      };
    } catch (error) {
      throw new Error(`Failed to convert route to visualization format: ${error}`);
    }
  }

  /**
   * Generate demo scenario data for testing and demonstration
   */
  async generateDemoScenario(
    scenarioType: 'delhi_compliance' | 'hub_spoke' | 'breakdown_recovery' | 'traffic_optimization',
    centerLocation: [number, number] = [77.2090, 28.6139] // Delhi center
  ): Promise<DemoScenarioData> {
    try {
      switch (scenarioType) {
        case 'delhi_compliance':
          return this.generateDelhiComplianceScenario(centerLocation);
        case 'hub_spoke':
          return this.generateHubSpokeScenario(centerLocation);
        case 'breakdown_recovery':
          return this.generateBreakdownRecoveryScenario(centerLocation);
        case 'traffic_optimization':
          return this.generateTrafficOptimizationScenario(centerLocation);
        default:
          throw new Error(`Unknown scenario type: ${scenarioType}`);
      }
    } catch (error) {
      throw new Error(`Failed to generate demo scenario: ${error}`);
    }
  }

  /**
   * Create vehicle tracking visualization data
   */
  createVehicleTrackingData(
    vehicle: Vehicle,
    route: Route,
    progress: number = 0
  ): VehicleTrackingData {
    // Calculate current position based on progress
    const currentLocation = this.interpolateLocationOnRoute(route, progress);
    
    return {
      vehicleId: vehicle.id,
      currentLocation: [currentLocation.longitude, currentLocation.latitude],
      heading: this.calculateHeading(route, progress),
      speed: this.estimateSpeed(vehicle, route),
      status: this.determineVehicleStatus(vehicle),
      routeProgress: progress,
      estimatedArrival: this.calculateEstimatedArrival(route, progress)
    };
  }

  /**
   * Get map bounds for a set of locations
   */
  calculateMapBounds(locations: Array<[number, number]>): {
    southwest: [number, number];
    northeast: [number, number];
  } {
    if (locations.length === 0) {
      // Default to Delhi bounds
      return {
        southwest: [76.8, 28.4],
        northeast: [77.6, 28.9]
      };
    }

    const lngs = locations.map(loc => loc[0]);
    const lats = locations.map(loc => loc[1]);

    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Add padding
    const padding = 0.01;

    return {
      southwest: [minLng - padding, minLat - padding],
      northeast: [maxLng + padding, maxLat + padding]
    };
  }

  // Private helper methods

  private determineWaypointType(stopType: string): 'pickup' | 'delivery' | 'hub' {
    if (stopType.includes('pickup')) return 'pickup';
    if (stopType.includes('hub')) return 'hub';
    return 'delivery';
  }

  private determineTrafficLevel(actualDuration: number, estimatedDuration: number): 'low' | 'moderate' | 'heavy' {
    const ratio = actualDuration / estimatedDuration;
    if (ratio < 1.2) return 'low';
    if (ratio < 1.5) return 'moderate';
    return 'heavy';
  }

  private interpolateLocationOnRoute(route: Route, progress: number): GeoLocation {
    if (progress <= 0) return route.stops[0]!.location;
    if (progress >= 1) return route.stops[route.stops.length - 1]!.location;

    // Simple linear interpolation between stops
    const totalStops = route.stops.length;
    const stopIndex = Math.floor(progress * (totalStops - 1));
    const nextStopIndex = Math.min(stopIndex + 1, totalStops - 1);
    
    const currentStop = route.stops[stopIndex]!;
    const nextStop = route.stops[nextStopIndex]!;
    
    const localProgress = (progress * (totalStops - 1)) - stopIndex;
    
    return {
      latitude: currentStop.location.latitude + 
        (nextStop.location.latitude - currentStop.location.latitude) * localProgress,
      longitude: currentStop.location.longitude + 
        (nextStop.location.longitude - currentStop.location.longitude) * localProgress
    };
  }

  private calculateHeading(route: Route, progress: number): number {
    const currentLocation = this.interpolateLocationOnRoute(route, progress);
    const nextProgress = Math.min(progress + 0.01, 1);
    const nextLocation = this.interpolateLocationOnRoute(route, nextProgress);
    
    const deltaLng = nextLocation.longitude - currentLocation.longitude;
    const deltaLat = nextLocation.latitude - currentLocation.latitude;
    
    return Math.atan2(deltaLng, deltaLat) * (180 / Math.PI);
  }

  private estimateSpeed(vehicle: Vehicle, _route: Route): number {
    // Estimate speed based on vehicle type and route characteristics
    const baseSpeed = {
      'truck': 40,
      'tempo': 35,
      'van': 45,
      'three-wheeler': 25,
      'electric': 30
    };
    
    return baseSpeed[vehicle.type as keyof typeof baseSpeed] || 35;
  }

  private determineVehicleStatus(vehicle: Vehicle): 'moving' | 'stopped' | 'loading' | 'unloading' {
    switch (vehicle.status) {
      case 'in-transit': return 'moving';
      case 'loading': return 'loading';
      case 'available': return 'stopped';
      default: return 'stopped';
    }
  }

  private calculateEstimatedArrival(route: Route, progress: number): Date {
    const remainingDuration = route.estimatedDuration * (1 - progress);
    return new Date(Date.now() + remainingDuration * 1000);
  }

  private generateDelhiComplianceScenario(center: [number, number]): DemoScenarioData {
    return {
      name: "Delhi Vehicle Class Compliance",
      description: "Demonstrates vehicle assignment based on Delhi-specific restrictions",
      vehicles: [
        {
          id: 'TRUCK_001',
          type: 'truck',
          location: [center[0] - 0.02, center[1] + 0.01],
          status: 'available'
        },
        {
          id: 'TEMPO_001',
          type: 'tempo',
          location: [center[0] + 0.01, center[1] - 0.01],
          status: 'available'
        },
        {
          id: 'EV_001',
          type: 'electric',
          location: [center[0], center[1]],
          status: 'available'
        }
      ],
      hubs: [
        {
          id: 'HUB_CENTRAL',
          location: center,
          capacity: 50,
          bufferVehicles: 5
        }
      ],
      routes: [],
      bounds: this.calculateMapBounds([
        [center[0] - 0.05, center[1] - 0.05],
        [center[0] + 0.05, center[1] + 0.05]
      ])
    };
  }

  private generateHubSpokeScenario(center: [number, number]): DemoScenarioData {
    const hubs = [
      { id: 'HUB_NORTH', location: [center[0], center[1] + 0.03] as [number, number] },
      { id: 'HUB_SOUTH', location: [center[0], center[1] - 0.03] as [number, number] },
      { id: 'HUB_EAST', location: [center[0] + 0.03, center[1]] as [number, number] },
      { id: 'HUB_WEST', location: [center[0] - 0.03, center[1]] as [number, number] }
    ];

    return {
      name: "Hub-and-Spoke Operations",
      description: "Shows multi-hub routing with load transfers",
      vehicles: hubs.map((hub, index) => ({
        id: `VEHICLE_${hub.id}`,
        type: index % 2 === 0 ? 'truck' : 'tempo',
        location: hub.location,
        status: 'available'
      })),
      hubs: hubs.map(hub => ({
        ...hub,
        capacity: 30,
        bufferVehicles: 3
      })),
      routes: [],
      bounds: this.calculateMapBounds(hubs.map(h => h.location))
    };
  }

  private generateBreakdownRecoveryScenario(center: [number, number]): DemoScenarioData {
    return {
      name: "Vehicle Breakdown Recovery",
      description: "Simulates breakdown and buffer vehicle allocation",
      vehicles: [
        {
          id: 'BREAKDOWN_VEHICLE',
          type: 'truck',
          location: [center[0] + 0.02, center[1] + 0.01],
          status: 'breakdown'
        },
        {
          id: 'BUFFER_VEHICLE',
          type: 'truck',
          location: center,
          status: 'available'
        }
      ],
      hubs: [
        {
          id: 'RECOVERY_HUB',
          location: center,
          capacity: 20,
          bufferVehicles: 2
        }
      ],
      routes: [],
      bounds: this.calculateMapBounds([
        [center[0] - 0.03, center[1] - 0.03],
        [center[0] + 0.03, center[1] + 0.03]
      ])
    };
  }

  private generateTrafficOptimizationScenario(center: [number, number]): DemoScenarioData {
    return {
      name: "Traffic-Aware Route Optimization",
      description: "Shows route optimization based on traffic conditions",
      vehicles: [
        {
          id: 'OPTIMIZED_VEHICLE',
          type: 'van',
          location: [center[0] - 0.02, center[1]],
          status: 'in-transit'
        }
      ],
      hubs: [
        {
          id: 'TRAFFIC_HUB',
          location: center,
          capacity: 25,
          bufferVehicles: 2
        }
      ],
      routes: [],
      bounds: this.calculateMapBounds([
        [center[0] - 0.04, center[1] - 0.04],
        [center[0] + 0.04, center[1] + 0.04]
      ])
    };
  }
}