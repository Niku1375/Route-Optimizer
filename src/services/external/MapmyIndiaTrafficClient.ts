/**
 * MapmyIndia Traffic API client implementation
 * Provides real-time & predictive traffic data, incidents, and road conditions for Delhi
 */

import { BaseAPIClient } from './BaseAPIClient';
import { 
  MapmyIndiaTrafficClient, 
  TrafficAlert, 
  RoadClosure,
  ExternalAPIResponse,
  APIClientConfig 
} from '../../models/Traffic';
import { GeoArea} from '../../models/GeoLocation';

export class MapmyIndiaTrafficClientImpl extends BaseAPIClient implements MapmyIndiaTrafficClient {
  constructor(config: APIClientConfig) {
    super(config);
  }

  async getTrafficAlerts(area: GeoArea): Promise<ExternalAPIResponse<TrafficAlert[]>> {
    const cacheKey = this.generateCacheKey('traffic_incidents', { 
      areaId: area.id,
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute cache buckets for real-time data
    });

    const cached = this.getCachedResponse<TrafficAlert[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        bounds: `${area.boundaries[0].latitude},${area.boundaries[0].longitude};${area.boundaries[1].latitude},${area.boundaries[1].longitude}`,
        incident_types: 'accident,construction,event,weather,breakdown',
        severity: 'medium,high,critical',
      }).toString();

      const endpoint = `/traffic_incidents?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return this.getFallbackTrafficAlerts(area, response.error);
      }

      const alerts: TrafficAlert[] = this.parseTrafficIncidents(response.data.incidents || []);
      this.setCachedData(cacheKey, alerts);

      return {
        data: alerts,
        success: true,
        timestamp: new Date(),
        source: 'mapmyindia_traffic',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackTrafficAlerts(area, (error as Error).message);
    }
  }

  async getRoadClosures(): Promise<ExternalAPIResponse<RoadClosure[]>> {
    const cacheKey = this.generateCacheKey('road_conditions', {
      timestamp: Math.floor(Date.now() / (10 * 60 * 1000)) // 10-minute cache buckets
    });

    const cached = this.getCachedResponse<RoadClosure[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        region: 'delhi',
        condition_types: 'closure,construction,maintenance',
      }).toString();

      const endpoint = `/road_conditions?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return this.getFallbackRoadClosures(response.error);
      }

      const closures: RoadClosure[] = this.parseRoadConditions(response.data.conditions || []);
      this.setCachedData(cacheKey, closures);

      return {
        data: closures,
        success: true,
        timestamp: new Date(),
        source: 'mapmyindia_traffic',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackRoadClosures((error as Error).message);
    }
  }

  async getTrafficFlow(area: GeoArea): Promise<ExternalAPIResponse<any>> {
    const cacheKey = this.generateCacheKey('traffic_flow', { 
      areaId: area.id,
      timestamp: Math.floor(Date.now() / (2 * 60 * 1000)) // 2-minute cache for live traffic flow
    });

    const cached = this.getCachedResponse<any>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        bounds: `${area.boundaries[0].latitude},${area.boundaries[0].longitude};${area.boundaries[1].latitude},${area.boundaries[1].longitude}`,
        include_speed: 'true',
        include_congestion: 'true',
      }).toString();

      const endpoint = `/traffic_flow?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return {
          data: null,
          success: false,
          error: response.error || 'Traffic flow data unavailable',
          timestamp: new Date(),
          source: 'mapmyindia_traffic',
          cached: false,
        };
      }

      this.setCachedData(cacheKey, response.data);

      return {
        data: response.data,
        success: true,
        timestamp: new Date(),
        source: 'mapmyindia_traffic',
        cached: false,
      };

    } catch (error) {
      return {
        data: null,
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        source: 'mapmyindia_traffic',
        cached: false,
      };
    }
  }

  async getPredictiveTraffic(area: GeoArea, forecastHours: number = 2): Promise<ExternalAPIResponse<any>> {
    const cacheKey = this.generateCacheKey('traffic_forecast', { 
      areaId: area.id,
      forecastHours,
      timestamp: Math.floor(Date.now() / (30 * 60 * 1000)) // 30-minute cache for predictions
    });

    const cached = this.getCachedResponse<any>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        bounds: `${area.boundaries[0].latitude},${area.boundaries[0].longitude};${area.boundaries[1].latitude},${area.boundaries[1].longitude}`,
        forecast_hours: forecastHours.toString(),
        include_historical: 'true',
      }).toString();

      const endpoint = `/traffic_forecast?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return {
          data: null,
          success: false,
          error: response.error || 'Traffic forecast unavailable',
          timestamp: new Date(),
          source: 'mapmyindia_traffic',
          cached: false,
        };
      }

      this.setCachedData(cacheKey, response.data);

      return {
        data: response.data,
        success: true,
        timestamp: new Date(),
        source: 'mapmyindia_traffic',
        cached: false,
      };

    } catch (error) {
      return {
        data: null,
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        source: 'mapmyindia_traffic',
        cached: false,
      };
    }
  }

  private parseTrafficIncidents(incidentsData: any[]): TrafficAlert[] {
    return incidentsData.map((incident, index) => ({
      id: incident.id || `incident_${index}_${Date.now()}`,
      location: {
        latitude: incident.location?.lat || incident.lat || 28.6139,
        longitude: incident.location?.lng || incident.lng || 77.2090,
        address: incident.location?.address || incident.address,
      },
      type: this.mapIncidentType(incident.type || incident.incident_type),
      severity: this.mapSeverity(incident.severity || incident.impact_level),
      description: incident.description || incident.summary || 'Traffic incident reported',
      estimatedDuration: incident.duration_minutes || incident.estimated_duration || 45,
      affectedRoutes: incident.affected_roads || incident.routes || [],
      timestamp: new Date(incident.timestamp || incident.created_at || Date.now()),
    }));
  }

  private parseRoadConditions(conditionsData: any[]): RoadClosure[] {
    return conditionsData.map((condition, index) => ({
      id: condition.id || `condition_${index}_${Date.now()}`,
      location: {
        latitude: condition.location?.lat || condition.lat || 28.6139,
        longitude: condition.location?.lng || condition.lng || 77.2090,
        address: condition.location?.address || condition.address,
      },
      roadName: condition.road_name || condition.street || 'Unknown Road',
      reason: condition.reason || condition.description || 'Road maintenance',
      startTime: new Date(condition.start_time || condition.from || Date.now()),
      endTime: new Date(condition.end_time || condition.to || Date.now() + 3 * 60 * 60 * 1000), // Default 3 hours
      alternativeRoutes: condition.alternatives || condition.detours || [],
    }));
  }

  private mapIncidentType(type: string): TrafficAlert['type'] {
    switch (type?.toLowerCase()) {
      case 'accident':
      case 'collision':
      case 'crash':
        return 'accident';
      case 'construction':
      case 'roadwork':
      case 'maintenance':
        return 'construction';
      case 'event':
      case 'rally':
      case 'procession':
      case 'festival':
        return 'event';
      case 'weather':
      case 'rain':
      case 'fog':
      case 'flooding':
        return 'weather';
      case 'breakdown':
      case 'vehicle_breakdown':
      case 'stalled_vehicle':
        return 'breakdown';
      default:
        return 'accident';
    }
  }

  private mapSeverity(severity: string): TrafficAlert['severity'] {
    switch (severity?.toLowerCase()) {
      case 'low':
      case 'minor':
      case 'light':
        return 'low';
      case 'medium':
      case 'moderate':
      case 'normal':
        return 'medium';
      case 'high':
      case 'major':
      case 'heavy':
        return 'high';
      case 'critical':
      case 'severe':
      case 'extreme':
        return 'critical';
      default:
        return 'medium';
    }
  }

  private getFallbackTrafficAlerts(area: GeoArea, error?: string): ExternalAPIResponse<TrafficAlert[]> {
    // Return empty array as fallback - no alerts is better than wrong alerts
    const fallbackAlerts: TrafficAlert[] = [];

    return {
      data: fallbackAlerts,
      success: false,
      error: error || 'MapmyIndia Traffic API unavailable',
      timestamp: new Date(),
      source: 'mapmyindia_traffic',
      cached: true,
    };
  }

  private getFallbackRoadClosures(error?: string): ExternalAPIResponse<RoadClosure[]> {
    // Return empty array as fallback
    const fallbackClosures: RoadClosure[] = [];

    return {
      data: fallbackClosures,
      success: false,
      error: error || 'MapmyIndia Traffic API unavailable',
      timestamp: new Date(),
      source: 'mapmyindia_traffic',
      cached: true,
    };
  }
}