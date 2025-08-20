/**
 * Google Maps Traffic API client implementation
 */

import { BaseAPIClient } from './BaseAPIClient';
import { 
  GoogleMapsTrafficClient, 
  TrafficData, 
  ExternalAPIResponse,
  APIClientConfig 
} from '../../models/Traffic';
import { GeoLocation, GeoArea } from '../../models/GeoLocation';

export class GoogleMapsTrafficClientImpl extends BaseAPIClient implements GoogleMapsTrafficClient {
  constructor(config: APIClientConfig) {
    super(config);
  }

  async getCurrentTraffic(area: GeoArea): Promise<ExternalAPIResponse<TrafficData>> {
    const cacheKey = this.generateCacheKey('traffic', { 
      areaId: area.id,
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute cache buckets
    });

    // Check cache first
    const cached = this.getCachedResponse<TrafficData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Calculate center point of area
      //const centerLat = area.boundaries.reduce((sum, point) => sum + point.latitude, 0) / area.boundaries.length;
      //const centerLng = area.boundaries.reduce((sum, point) => sum + point.longitude, 0) / area.boundaries.length;

      const response = await this.makeRequest<any>('/maps/api/distancematrix/json', {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': this.config.apiKey || '',
        },
      });

      if (!response.success) {
        return this.getFallbackTrafficData(area, response.error);
      }

      // Transform Google Maps response to our TrafficData format
      const trafficData: TrafficData = {
        area,
        congestionLevel: this.mapGoogleTrafficLevel(response.data.traffic_level || 'moderate'),
        averageSpeed: response.data.average_speed || 25, // Default 25 km/h for Delhi
        travelTimeMultiplier: response.data.duration_in_traffic / response.data.duration || 1.5,
        timestamp: new Date(),
        source: 'google_maps',
      };

      // Cache the result
      this.setCachedData(cacheKey, trafficData);

      return {
        data: trafficData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackTrafficData(area, (error as Error).message);
    }
  }

  async getRouteTraffic(
    origin: GeoLocation, 
    destination: GeoLocation
  ): Promise<ExternalAPIResponse<TrafficData[]>> {
    const cacheKey = this.generateCacheKey('route_traffic', {
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000))
    });

    const cached = this.getCachedResponse<TrafficData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<any>('/maps/api/directions/json', {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': this.config.apiKey || '',
        },
      });

      if (!response.success) {
        return this.getFallbackRouteTrafficData(origin, destination, response.error);
      }

      // Transform response to TrafficData array for route segments
      const routeTrafficData: TrafficData[] = this.parseRouteTrafficData(response.data, origin, destination);

      this.setCachedData(cacheKey, routeTrafficData);

      return {
        data: routeTrafficData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackRouteTrafficData(origin, destination, (error as Error).message);
    }
  }

  private mapGoogleTrafficLevel(googleLevel: string): 'low' | 'moderate' | 'high' | 'severe' {
    switch (googleLevel.toLowerCase()) {
      case 'light':
      case 'low':
        return 'low';
      case 'moderate':
      case 'medium':
        return 'moderate';
      case 'heavy':
      case 'high':
        return 'high';
      case 'severe':
      case 'very_heavy':
        return 'severe';
      default:
        return 'moderate';
    }
  }

  private parseRouteTrafficData(googleResponse: any, origin: GeoLocation, destination: GeoLocation): TrafficData[] {
    const trafficData: TrafficData[] = [];
    
    if (googleResponse.routes && googleResponse.routes.length > 0) {
      const route = googleResponse.routes[0];
      
      if (route.legs) {
        route.legs.forEach((leg: any, index: number) => {
          const segmentArea: GeoArea = {
            id: `segment_${index}`,
            name: `Route Segment ${index + 1}`,
            boundaries: [origin, destination], // Simplified for demo
            zoneType: 'mixed',
          };

          trafficData.push({
            area: segmentArea,
            congestionLevel: this.mapGoogleTrafficLevel(leg.traffic_speed_entry?.speed_category || 'moderate'),
            averageSpeed: leg.traffic_speed_entry?.speed || 25,
            travelTimeMultiplier: leg.duration_in_traffic?.value / leg.duration?.value || 1.5,
            timestamp: new Date(),
            source: 'google_maps',
          });
        });
      }
    }

    // If no segments found, create a single segment
    if (trafficData.length === 0) {
      const defaultArea: GeoArea = {
        id: 'route_default',
        name: 'Route Default',
        boundaries: [origin, destination],
        zoneType: 'mixed',
      };

      trafficData.push({
        area: defaultArea,
        congestionLevel: 'moderate',
        averageSpeed: 25,
        travelTimeMultiplier: 1.5,
        timestamp: new Date(),
        source: 'google_maps',
      });
    }

    return trafficData;
  }

  private getFallbackTrafficData(area: GeoArea, error?: string): ExternalAPIResponse<TrafficData> {
    // Return cached data if available, even if expired
    const cacheKey = this.generateCacheKey('traffic_fallback', { areaId: area.id });
    const fallbackData = this.getCachedData<TrafficData>(cacheKey);

    const trafficData: TrafficData = fallbackData || {
      area,
      congestionLevel: 'moderate', // Conservative default
      averageSpeed: 20, // Conservative speed for Delhi
      travelTimeMultiplier: 2.0, // Conservative multiplier
      timestamp: new Date(),
      source: 'cached',
    };

    return {
      data: trafficData,
      success: false,
      error: error || 'Google Maps API unavailable, using fallback data',
      timestamp: new Date(),
      source: 'google_maps',
      cached: true,
    };
  }

  private getFallbackRouteTrafficData(
    origin: GeoLocation, 
    destination: GeoLocation, 
    error?: string
  ): ExternalAPIResponse<TrafficData[]> {
    const defaultArea: GeoArea = {
      id: 'fallback_route',
      name: 'Fallback Route',
      boundaries: [origin, destination],
      zoneType: 'mixed',
    };

    const fallbackData: TrafficData[] = [{
      area: defaultArea,
      congestionLevel: 'moderate',
      averageSpeed: 20,
      travelTimeMultiplier: 2.0,
      timestamp: new Date(),
      source: 'cached',
    }];

    return {
      data: fallbackData,
      success: false,
      error: error || 'Google Maps API unavailable, using fallback data',
      timestamp: new Date(),
      source: 'google_maps',
      cached: true,
    };
  }
}