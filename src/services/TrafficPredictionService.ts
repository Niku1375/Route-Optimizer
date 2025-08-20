/**
 * Traffic Prediction Service with external API integration framework
 * Integrates Google Maps Traffic, Delhi Traffic Police, IMD Weather, and Ambee Air Quality APIs
 */

import { 
  TrafficData, 
  TrafficForecast, 
  WeatherData, 
  AirQualityData,
  TrafficAlert,
  RoadClosure,
  TrafficAPIClients,
  APIClientConfig
} from '../models/Traffic';
import { GeoLocation, GeoArea } from '../models/GeoLocation';
import { TimeWindow } from '../models/Common';
import {
  GoogleMapsTrafficClientImpl,
  MapmyIndiaTrafficClientImpl,
  OpenWeatherMapClientImpl,
    AmbeeAirQualityClientImpl,
  DelhiTrafficPoliceClientImpl
} from './external';
import { TrafficMLService } from './ml/TrafficMLService';
import { TrafficDataPoint } from '../models/TrafficML';

export interface TrafficPredictionService {
  getCurrentTraffic(area: GeoArea): Promise<TrafficData>;
  predictTraffic(area: GeoArea, timeWindow: TimeWindow): Promise<TrafficForecast>;
  getAlternativeRoutes(origin: GeoLocation, destination: GeoLocation): Promise<TrafficData[]>;
  getWeatherData(location: GeoLocation): Promise<WeatherData>;
  getAirQualityData(location: GeoLocation): Promise<AirQualityData>;
  getTrafficAlerts(area: GeoArea): Promise<TrafficAlert[]>;
  getRoadClosures(): Promise<RoadClosure[]>;
  getIntegratedTrafficData(area: GeoArea): Promise<IntegratedTrafficData>;
}

export interface IntegratedTrafficData {
  traffic: TrafficData;
  weather: WeatherData;
  airQuality: AirQualityData;
  alerts: TrafficAlert[];
  roadClosures: RoadClosure[];
  overallImpact: TrafficImpactAssessment;
}

export interface TrafficImpactAssessment {
  severityLevel: 'low' | 'moderate' | 'high' | 'severe';
  primaryFactors: string[];
  recommendedActions: string[];
  estimatedDelay: number; // minutes
  alternativeRoutesRecommended: boolean;
}

export class TrafficPredictionServiceImpl implements TrafficPredictionService {
  private apiClients: TrafficAPIClients;
  private fallbackCache: Map<string, any> = new Map();
  private mlService: TrafficMLService | null = null;

  constructor(configs: {
    googleMaps: APIClientConfig;
    mapmyindia: APIClientConfig;
    openWeatherMap: APIClientConfig;
    ambeeAirQuality: APIClientConfig;
  }) {
    this.apiClients = {
      googleMaps: new GoogleMapsTrafficClientImpl(configs.googleMaps),
      mapmyindia: new MapmyIndiaTrafficClientImpl(configs.mapmyindia),
      openWeatherMap: new OpenWeatherMapClientImpl(configs.openWeatherMap),
      ambeeAirQuality: new AmbeeAirQualityClientImpl(configs.ambeeAirQuality),
      delhiTrafficPolice: new DelhiTrafficPoliceClientImpl(configs.delhiTrafficPolice),
    };

    // Set up periodic cache cleanup
    setInterval(() => this.cleanupCaches(), 30 * 60 * 1000); // Every 30 minutes
    
    // Initialize ML service
    this.mlService = new TrafficMLService();
  }

  /**
   * Initialize ML models with historical traffic data
   */
  async initializeMLModels(historicalData: TrafficDataPoint[]): Promise<void> {
    if (!this.mlService) {
      this.mlService = new TrafficMLService();
    }
    
    try {
      await this.mlService.initialize(historicalData);
      console.log('ML models initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ML models:', error);
      // Continue without ML models
    }
  }

  /**
   * Get detailed traffic prediction with ML analysis
   */
  async getDetailedTrafficPrediction(area: GeoArea, targetTime: Date): Promise<any> {
    if (this.mlService && (this.mlService as any).isInitialized) {
      try {
        return await this.mlService.getDetailedPrediction(area, targetTime);
      } catch (error) {
        console.error('ML prediction failed, using fallback:', error);
      }
    }
    
    // Fallback to basic prediction
    const basicPrediction = {
      timestamp: targetTime,
      congestionLevel: 'moderate' as const,
      averageSpeed: 25,
      confidence: 0.5,
    };
    return {
      predictions: [basicPrediction],
      confidence: basicPrediction.confidence,
      modelUsed: 'pattern_analysis_fallback',
      accuracy: { accuracy: 0.6, mape: 25, rmse: 0.8, mae: 0.6, r2: 0.4 },
      factors: [],
    };
  }

  async getCurrentTraffic(area: GeoArea): Promise<TrafficData> {
    try {
      const response = await this.apiClients.googleMaps.getCurrentTraffic(area);
      
      if (response.success) {
        return response.data;
      } else {
        console.warn(`Traffic API failed: ${response.error}, using fallback`);
        return this.getFallbackTrafficData(area);
      }
    } catch (error) {
      console.error('Error getting current traffic:', error);
      return this.getFallbackTrafficData(area);
    }
  }

  async predictTraffic(area: GeoArea, timeWindow: TimeWindow): Promise<TrafficForecast> {
    try {
      // Try to use ML models if available
      if (this.mlService && (this.mlService as any).isInitialized) {
        return await this.mlService.generateTrafficForecast(area, timeWindow);
      }
      
      // Fallback to basic prediction based on current traffic
      const currentTraffic = await this.getCurrentTraffic(area);
      
      return {
        area,
        timeWindow,
        predictions: this.generateBasicPredictions(currentTraffic, timeWindow),
        confidence: 0.6, // Moderate confidence without ML models
        modelUsed: 'basic_extrapolation',
      };
    } catch (error) {
      console.error('Error predicting traffic:', error);
      return this.getFallbackTrafficForecast(area, timeWindow);
    }
  }

  async getAlternativeRoutes(origin: GeoLocation, destination: GeoLocation): Promise<TrafficData[]> {
    try {
      const response = await this.apiClients.googleMaps.getRouteTraffic(origin, destination);
      
      if (response.success) {
        return response.data;
      } else {
        console.warn(`Route traffic API failed: ${response.error}, using fallback`);
        return this.getFallbackRouteData(origin, destination);
      }
    } catch (error) {
      console.error('Error getting alternative routes:', error);
      return this.getFallbackRouteData(origin, destination);
    }
  }

  async getWeatherData(location: GeoLocation): Promise<WeatherData> {
    try {
      const response = await this.apiClients.openWeatherMap.getCurrentWeather(location);
      
      if (response.success) {
        return response.data;
      } else {
        console.warn(`Weather API failed: ${response.error}, using fallback`);
        return this.getFallbackWeatherData(location);
      }
    } catch (error) {
      console.error('Error getting weather data:', error);
      return this.getFallbackWeatherData(location);
    }
  }

  async getAirQualityData(location: GeoLocation): Promise<AirQualityData> {
    try {
      const response = await this.apiClients.ambeeAirQuality.getCurrentAirQuality(location);
      
      if (response.success) {
        return response.data;
      } else {
        console.warn(`Air quality API failed: ${response.error}, using fallback`);
        return this.getFallbackAirQualityData(location);
      }
    } catch (error) {
      console.error('Error getting air quality data:', error);
      return this.getFallbackAirQualityData(location);
    }
  }

  async getTrafficAlerts(area: GeoArea): Promise<TrafficAlert[]> {
    try {
      const response = await this.apiClients.mapmyindia.getTrafficAlerts(area);
      
      if (response.success) {
        return response.data;
      } else {
        console.warn(`Traffic alerts API failed: ${response.error}, returning empty alerts`);
        return [];
      }
    } catch (error) {
      console.error('Error getting traffic alerts:', error);
      return [];
    }
  }

  async getRoadClosures(): Promise<RoadClosure[]> {
    try {
      const response = await this.apiClients.mapmyindia.getRoadClosures();
      
      if (response.success) {
        return response.data;
      } else {
        console.warn(`Road closures API failed: ${response.error}, returning empty closures`);
        return [];
      }
    } catch (error) {
      console.error('Error getting road closures:', error);
      return [];
    }
  }

  async getIntegratedTrafficData(area: GeoArea): Promise<IntegratedTrafficData> {
    try {
      // Get all data in parallel for better performance
      const [traffic, weather, airQuality, alerts, roadClosures] = await Promise.allSettled([
        this.getCurrentTraffic(area),
        this.getWeatherData(this.getAreaCenter(area)),
        this.getAirQualityData(this.getAreaCenter(area)),
        this.getTrafficAlerts(area),
        this.getRoadClosures(),
      ]);

      const trafficData = traffic.status === 'fulfilled' ? traffic.value : this.getFallbackTrafficData(area);
      const weatherData = weather.status === 'fulfilled' ? weather.value : this.getFallbackWeatherData(this.getAreaCenter(area));
      const airQualityData = airQuality.status === 'fulfilled' ? airQuality.value : this.getFallbackAirQualityData(this.getAreaCenter(area));
      const alertsData = alerts.status === 'fulfilled' ? alerts.value : [];
      const closuresData = roadClosures.status === 'fulfilled' ? roadClosures.value : [];

      const overallImpact = this.assessTrafficImpact(trafficData, weatherData, airQualityData, alertsData, closuresData);

      return {
        traffic: trafficData,
        weather: weatherData,
        airQuality: airQualityData,
        alerts: alertsData,
        roadClosures: closuresData,
        overallImpact,
      };
    } catch (error) {
      console.error('Error getting integrated traffic data:', error);
      throw new Error('Failed to get integrated traffic data');
    }
  }

  private generateBasicPredictions(currentTraffic: TrafficData, timeWindow: TimeWindow): any[] {
    const predictions = [];
    const startTime = (timeWindow.earliest || timeWindow.start || new Date()).getTime();
    const endTime = (timeWindow.latest || timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000)).getTime();
    const hourlyInterval = 60 * 60 * 1000; // 1 hour

    for (let time = startTime; time <= endTime; time += hourlyInterval) {
      const timestamp = new Date(time);
      const hour = timestamp.getHours();
      
      // Simple time-based traffic pattern
      let congestionMultiplier = 1.0;
      if (hour >= 7 && hour <= 10) {
        congestionMultiplier = 1.5; // Morning rush
      } else if (hour >= 17 && hour <= 20) {
        congestionMultiplier = 1.4; // Evening rush
      } else if (hour >= 22 || hour <= 5) {
        congestionMultiplier = 0.6; // Night time
      }

      predictions.push({
        timestamp,
        congestionLevel: this.adjustCongestionLevel(currentTraffic.congestionLevel, congestionMultiplier),
        averageSpeed: Math.round(currentTraffic.averageSpeed / congestionMultiplier),
        confidence: 0.6,
      });
    }

    return predictions;
  }

  private adjustCongestionLevel(current: string, multiplier: number): string {
    const levels = ['low', 'moderate', 'high', 'severe'];
    const currentIndex = levels.indexOf(current);
    
    if (multiplier > 1.3) {
      return levels[Math.min(3, currentIndex + 1)] || 'severe';
    } else if (multiplier < 0.7) {
      return levels[Math.max(0, currentIndex - 1)] || 'low';
    }
    
    return current;
  }

  private assessTrafficImpact(
    traffic: TrafficData,
    weather: WeatherData,
    airQuality: AirQualityData,
    alerts: TrafficAlert[],
    closures: RoadClosure[]
  ): TrafficImpactAssessment {
    const factors: string[] = [];
    let severityScore = 0;
    let estimatedDelay = 0;

    // Traffic impact
    switch (traffic.congestionLevel) {
      case 'severe':
        severityScore += 4;
        estimatedDelay += 30;
        factors.push('Heavy traffic congestion');
        break;
      case 'high':
        severityScore += 3;
        estimatedDelay += 20;
        factors.push('High traffic density');
        break;
      case 'moderate':
        severityScore += 2;
        estimatedDelay += 10;
        break;
      case 'low':
        severityScore += 1;
        break;
    }

    // Weather impact
    if (weather.rainfall > 5) {
      severityScore += 2;
      estimatedDelay += 15;
      factors.push('Heavy rainfall affecting visibility');
    } else if (weather.rainfall > 0) {
      severityScore += 1;
      estimatedDelay += 5;
      factors.push('Light rainfall');
    }

    if (weather.visibility < 5) {
      severityScore += 2;
      estimatedDelay += 10;
      factors.push('Poor visibility due to fog/pollution');
    }

    // Air quality impact (affects vehicle restrictions)
    if (airQuality.category === 'severe' || airQuality.category === 'very_poor') {
      severityScore += 1;
      factors.push('Poor air quality may trigger vehicle restrictions');
    }

    // Alerts and closures impact
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high');
    if (criticalAlerts.length > 0) {
      severityScore += criticalAlerts.length;
      estimatedDelay += criticalAlerts.length * 10;
      factors.push(`${criticalAlerts.length} critical traffic incidents`);
    }

    if (closures.length > 0) {
      severityScore += closures.length;
      estimatedDelay += closures.length * 15;
      factors.push(`${closures.length} road closures`);
    }

    // Determine overall severity
    let severityLevel: 'low' | 'moderate' | 'high' | 'severe';
    if (severityScore <= 2) {
      severityLevel = 'low';
    } else if (severityScore <= 5) {
      severityLevel = 'moderate';
    } else if (severityScore <= 8) {
      severityLevel = 'high';
    } else {
      severityLevel = 'severe';
    }

    // Generate recommendations
    const recommendedActions: string[] = [];
    if (severityLevel === 'severe' || severityLevel === 'high') {
      recommendedActions.push('Consider delaying non-urgent deliveries');
      recommendedActions.push('Use alternative routes');
      recommendedActions.push('Allow extra time for deliveries');
    }
    if (weather.rainfall > 0) {
      recommendedActions.push('Exercise caution due to wet roads');
    }
    if (closures.length > 0) {
      recommendedActions.push('Check for road closure updates');
    }

    return {
      severityLevel,
      primaryFactors: factors,
      recommendedActions,
      estimatedDelay: Math.min(estimatedDelay, 120), // Cap at 2 hours
      alternativeRoutesRecommended: severityLevel === 'high' || severityLevel === 'severe',
    };
  }

  private getAreaCenter(area: GeoArea): GeoLocation {
    const centerLat = area.boundaries.reduce((sum, point) => sum + point.latitude, 0) / area.boundaries.length;
    const centerLng = area.boundaries.reduce((sum, point) => sum + point.longitude, 0) / area.boundaries.length;
    
    return {
      latitude: centerLat,
      longitude: centerLng,
    };
  }

  private getFallbackTrafficData(area: GeoArea): TrafficData {
    return {
      area,
      congestionLevel: 'moderate',
      averageSpeed: 20,
      travelTimeMultiplier: 1.8,
      timestamp: new Date(),
      source: 'cached',
    };
  }

  private getFallbackTrafficForecast(area: GeoArea, timeWindow: TimeWindow): TrafficForecast {
    const fallbackTraffic = this.getFallbackTrafficData(area);
    
    return {
      area,
      timeWindow,
      predictions: this.generateBasicPredictions(fallbackTraffic, timeWindow),
      confidence: 0.3, // Low confidence for fallback
      modelUsed: 'fallback_basic',
    };
  }

  private getFallbackRouteData(origin: GeoLocation, destination: GeoLocation): TrafficData[] {
    const defaultArea: GeoArea = {
      id: 'fallback_route',
      name: 'Fallback Route',
      boundaries: [origin, destination],
      zoneType: 'mixed',
    };

    return [this.getFallbackTrafficData(defaultArea)];
  }

  private getFallbackWeatherData(location: GeoLocation): WeatherData {
    return {
      location,
      temperature: 25,
      humidity: 65,
      rainfall: 0,
      visibility: 8,
      windSpeed: 5,
      conditions: 'partly_cloudy',
      timestamp: new Date(),
      source: 'cached',
    };
  }

  private getFallbackAirQualityData(location: GeoLocation): AirQualityData {
    return {
      location,
      aqi: 180,
      pm25: 85,
      pm10: 140,
      no2: 50,
      so2: 18,
      co: 1.5,
      category: 'moderate',
      timestamp: new Date(),
      source: 'cached',
    };
  }

  private cleanupCaches(): void {
    // Clean up caches in all API clients
    Object.values(this.apiClients).forEach(client => {
      if ('clearExpiredCache' in client) {
        (client as any).clearExpiredCache();
      }
    });
  }

  // Utility method to get cache statistics
  public getCacheStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    Object.entries(this.apiClients).forEach(([name, client]) => {
      if ('getCacheStats' in client) {
        stats[name] = (client as any).getCacheStats();
      }
    });
    
    return stats;
  }
}