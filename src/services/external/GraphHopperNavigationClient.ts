import { BaseAPIClient } from './BaseAPIClient';
import { GeoLocation, Route } from '../../models';
import { APIClientConfig } from '../../models/Traffic';

export interface GraphHopperConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface GraphHopperRoute {
  distance: number;
  time: number;
  points: {
    coordinates: number[][];
    type: 'LineString';
  };
  instructions: GraphHopperInstruction[];
  legs: GraphHopperLeg[];
}

export interface GraphHopperInstruction {
  distance: number;
  time: number;
  text: string;
  sign: number;
  interval: [number, number];
  points: number[][];
}

export interface GraphHopperLeg {
  distance: number;
  time: number;
  instructions: GraphHopperInstruction[];
}

export interface GraphHopperResponse {
  paths: GraphHopperRoute[];
  info: {
    copyrights: string[];
    took: number;
  };
}

export interface NavigationData {
  routeId: string;
  totalDistance: number;
  totalTime: number;
  instructions: TurnByTurnInstruction[];
  trafficAware: boolean;
  alternativeRoutes: AlternativeRoute[];
}

export interface TurnByTurnInstruction {
  id: string;
  sequence: number;
  instruction: string;
  distance: number;
  time: number;
  maneuver: string;
  coordinates: [number, number];
  streetName?: string;
  exitNumber?: number;
}

export interface AlternativeRoute {
  id: string;
  description: string;
  distance: number;
  time: number;
  trafficLevel: 'low' | 'moderate' | 'heavy';
  coordinates: number[][];
}

export interface TrafficAwareRoutingOptions {
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  considerTraffic: boolean;
  departureTime?: Date;
}

/**
 * GraphHopper client for turn-by-turn navigation and traffic-aware routing
 */
export class GraphHopperNavigationClient extends BaseAPIClient {
  private apiKey: string;

  constructor(config: GraphHopperConfig) {
    const apiConfig: APIClientConfig = {
      baseUrl: config.baseUrl || 'https://graphhopper.com/api/1',
      apiKey: config.apiKey,
      timeout: config.timeout || 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      cacheTimeout: 300 // 5 minutes
    };
    
    super(apiConfig);
    this.apiKey = config.apiKey;
  }

  /**
   * Get turn-by-turn navigation from GraphHopper Directions API
   */
  async getNavigationDirections(
    coordinates: Array<[number, number]>,
    options: TrafficAwareRoutingOptions = {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
      considerTraffic: true
    }
  ): Promise<GraphHopperResponse> {
    try {
      //const points = coordinates.map(coord => `${coord[1]},${coord[0]}`).join('|');
      
      const params: any = {
        key: this.apiKey,
        point: coordinates.map(coord => `${coord[1]},${coord[0]}`),
        vehicle: 'car',
        locale: 'en',
        instructions: true,
        calc_points: true,
        debug: false,
        elevation: false,
        points_encoded: false
      };

      // Add traffic-aware routing options
      if (options.considerTraffic && options.departureTime) {
        params.departure_time = options.departureTime.toISOString();
      }

      if (options.avoidTolls) {
        params.avoid = (params.avoid || []).concat(['toll']);
      }

      if (options.avoidHighways) {
        params.avoid = (params.avoid || []).concat(['motorway']);
      }

      if (options.avoidFerries) {
        params.avoid = (params.avoid || []).concat(['ferry']);
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await this.makeRequest<GraphHopperResponse>(`/route?${queryString}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get navigation directions from GraphHopper');
      }
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get navigation directions from GraphHopper: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert GraphHopper response to navigation data format
   */
  convertToNavigationData(
    routeId: string,
    graphHopperResponse: GraphHopperResponse,
    trafficAware: boolean = true
  ): NavigationData {
    if (!graphHopperResponse.paths || graphHopperResponse.paths.length === 0) {
      throw new Error('No routes found in GraphHopper response');
    }

    const primaryRoute = graphHopperResponse.paths[0];
    if (!primaryRoute) {
      throw new Error('Primary route is undefined');
    }
    
    // Convert instructions to turn-by-turn format
    const instructions: TurnByTurnInstruction[] = primaryRoute.instructions.map((instruction, index) => {
      const turnInstruction: TurnByTurnInstruction = {
        id: `${routeId}_instruction_${index}`,
        sequence: index + 1,
        instruction: instruction.text,
        distance: instruction.distance,
        time: instruction.time / 1000, // Convert from ms to seconds
        maneuver: this.getManeuverType(instruction.sign),
        coordinates: instruction.points[0] as [number, number]
      };
      
      const streetName = this.extractStreetName(instruction.text);
      if (streetName) {
        turnInstruction.streetName = streetName;
      }
      
      return turnInstruction;
    });

    // Create alternative routes from additional paths
    const alternativeRoutes: AlternativeRoute[] = graphHopperResponse.paths.slice(1).map((path, index) => ({
      id: `${routeId}_alt_${index}`,
      description: `Alternative route ${index + 1}`,
      distance: path.distance,
      time: path.time / 1000,
      trafficLevel: this.estimateTrafficLevel(path.time, primaryRoute.time),
      coordinates: path.points.coordinates
    }));

    return {
      routeId,
      totalDistance: primaryRoute.distance,
      totalTime: primaryRoute.time / 1000,
      instructions,
      trafficAware,
      alternativeRoutes
    };
  }

  /**
   * Get traffic-aware routing simulation for Delhi conditions
   */
  async getTrafficAwareRouting(
    origin: GeoLocation,
    destination: GeoLocation,
    departureTime: Date = new Date()
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
      const coordinates: Array<[number, number]> = [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ];

      // Get normal route without traffic consideration
      const normalResponse = await this.getNavigationDirections(coordinates, {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
        considerTraffic: false
      });

      // Get traffic-optimized route
      const trafficResponse = await this.getNavigationDirections(coordinates, {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
        considerTraffic: true,
        departureTime
      });

      const normalRoute = this.convertToNavigationData('normal_route', normalResponse, false);
      const trafficOptimizedRoute = this.convertToNavigationData('traffic_optimized', trafficResponse, true);

      // Calculate savings
      const timeSavedMinutes = (normalRoute.totalTime - trafficOptimizedRoute.totalTime) / 60;
      const distanceDifference = normalRoute.totalDistance - trafficOptimizedRoute.totalDistance;
      const fuelSavings = Math.abs(distanceDifference) * 0.1; // Estimate 0.1L per km

      return {
        normalRoute,
        trafficOptimizedRoute,
        trafficSavings: {
          timeSavedMinutes: Math.round(timeSavedMinutes * 100) / 100,
          distanceDifference: Math.round(distanceDifference * 100) / 100,
          fuelSavings: Math.round(fuelSavings * 100) / 100
        }
      };
    } catch (error) {
      throw new Error(`Failed to get traffic-aware routing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Integrate navigation data with OR-Tools routing results
   */
  integrateWithORToolsRoute(
    route: Route,
    navigationData: NavigationData
  ): Route {
    // Create enhanced route with navigation instructions
    const enhancedRoute: Route = {
      ...route,
      stops: route.stops.map((stop, _index) => {
        // Find relevant navigation instructions for this stop
        const relevantInstructions = navigationData.instructions.filter(
          instruction => this.isInstructionNearStop(instruction, stop.location)
        );

        return {
          ...stop,
          instructions: relevantInstructions.map(inst => inst.instruction)
        };
      })
    };

    // Update route metrics with navigation data
    enhancedRoute.estimatedDistance = navigationData.totalDistance / 1000; // Convert to km
    enhancedRoute.estimatedDuration = navigationData.totalTime / 60; // Convert to minutes

    return enhancedRoute;
  }

  /**
   * Generate Delhi-specific navigation scenarios
   */
  async generateDelhiNavigationScenarios(): Promise<{
    peakHourNavigation: NavigationData;
    offPeakNavigation: NavigationData;
    monsoonNavigation: NavigationData;
    pollutionAlertNavigation: NavigationData;
  }> {
    // Delhi coordinates: Connaught Place to Gurgaon
    const origin: GeoLocation = { latitude: 28.6315, longitude: 77.2167 };
    const destination: GeoLocation = { latitude: 28.4595, longitude: 77.0266 };

    try {
      // Peak hour scenario (8 AM)
      const peakHour = new Date();
      peakHour.setHours(8, 0, 0, 0);
      const peakResponse = await this.getNavigationDirections(
        [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]],
        { avoidTolls: false, avoidHighways: false, avoidFerries: false, considerTraffic: true, departureTime: peakHour }
      );

      // Off-peak scenario (2 PM)
      const offPeak = new Date();
      offPeak.setHours(14, 0, 0, 0);
      const offPeakResponse = await this.getNavigationDirections(
        [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]],
        { avoidTolls: false, avoidHighways: false, avoidFerries: false, considerTraffic: true, departureTime: offPeak }
      );

      // Monsoon scenario (avoid flood-prone areas)
      const monsoonResponse = await this.getNavigationDirections(
        [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]],
        { avoidTolls: false, avoidHighways: true, avoidFerries: true, considerTraffic: true }
      );

      // Pollution alert scenario (avoid main roads)
      const pollutionResponse = await this.getNavigationDirections(
        [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]],
        { avoidTolls: true, avoidHighways: true, avoidFerries: false, considerTraffic: true }
      );

      return {
        peakHourNavigation: this.convertToNavigationData('peak_hour', peakResponse, true),
        offPeakNavigation: this.convertToNavigationData('off_peak', offPeakResponse, true),
        monsoonNavigation: this.convertToNavigationData('monsoon', monsoonResponse, true),
        pollutionAlertNavigation: this.convertToNavigationData('pollution_alert', pollutionResponse, true)
      };
    } catch (error) {
      throw new Error(`Failed to generate Delhi navigation scenarios: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private getManeuverType(sign: number): string {
    const maneuverMap: { [key: number]: string } = {
      0: 'continue',
      1: 'slight_right',
      2: 'right',
      3: 'sharp_right',
      4: 'finish',
      5: 'via',
      6: 'roundabout',
      [-1]: 'slight_left',
      [-2]: 'left',
      [-3]: 'sharp_left',
      [-7]: 'keep_left',
      7: 'keep_right'
    };

    return maneuverMap[sign] || 'continue';
  }

  private extractStreetName(instruction: string): string | undefined {
    // Simple extraction - in practice would use more sophisticated parsing
    const match = instruction.match(/on\s+(.+?)(?:\s+for|\s+toward|$)/i);
    return match?.[1]?.trim();
  }

  private estimateTrafficLevel(routeTime: number, baselineTime: number): 'low' | 'moderate' | 'heavy' {
    const ratio = routeTime / baselineTime;
    if (ratio < 1.2) return 'low';
    if (ratio < 1.5) return 'moderate';
    return 'heavy';
  }

  private isInstructionNearStop(instruction: TurnByTurnInstruction, stopLocation: GeoLocation): boolean {
    const distance = this.haversineDistance(
      instruction.coordinates[1],
      instruction.coordinates[0],
      stopLocation.latitude,
      stopLocation.longitude
    );
    return distance < 0.5; // Within 500 meters
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}