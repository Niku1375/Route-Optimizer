/**
 * Traffic-related data models and interfaces
 */

import { GeoLocation, GeoArea } from './GeoLocation';
import { TimeWindow } from './Common';

export interface TrafficData {
  area: GeoArea;
  congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
  averageSpeed: number; // km/h
  travelTimeMultiplier: number; // multiplier for normal travel time
  timestamp: Date;
  source: 'google_maps' | 'delhi_traffic_police' | 'cached' | 'predicted' | 'mock';
}

export interface TrafficForecast {
  area: GeoArea;
  timeWindow: TimeWindow;
  predictions: TrafficPrediction[];
  confidence: number; // 0-1
  modelUsed: string;
}

export interface TrafficPrediction {
  timestamp: Date;
  congestionLevel: 'low' | 'moderate' | 'high' | 'severe';
  averageSpeed: number;
  confidence: number;
}

export interface WeatherData {
  location: GeoLocation;
  temperature: number; // Celsius
  humidity: number; // percentage
  rainfall: number; // mm
  visibility: number; // km
  windSpeed: number; // km/h
  conditions: string; // 'clear', 'rain', 'fog', etc.
  timestamp: Date;
  source: 'imd' | 'cached';
}

export interface AirQualityData {
  location: GeoLocation;
  aqi: number; // Air Quality Index
  pm25: number; // PM2.5 concentration
  pm10: number; // PM10 concentration
  no2: number; // NO2 concentration
  so2: number; // SO2 concentration
  co: number; // CO concentration
  category: 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
  timestamp: Date;
  source: 'ambee' | 'cached';
}

export interface ExternalAPIResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  timestamp: Date;
  source: string;
  cached: boolean;
}

export interface APIClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  cacheTimeout: number; // seconds
}

export interface TrafficAPIClients {
  googleMaps: GoogleMapsTrafficClient;
  mapmyindia: MapmyIndiaTrafficClient;
  openWeatherMap: OpenWeatherMapClient;
  ambeeAirQuality: AmbeeAirQualityClient;
  delhiTrafficPolice: APIClientConfig; // Added missing client
}

export interface GoogleMapsTrafficClient {
  getCurrentTraffic(area: GeoArea): Promise<ExternalAPIResponse<TrafficData>>;
  getRouteTraffic(origin: GeoLocation, destination: GeoLocation): Promise<ExternalAPIResponse<TrafficData[]>>;
}

export interface MapmyIndiaTrafficClient {
  getTrafficAlerts(area: GeoArea): Promise<ExternalAPIResponse<TrafficAlert[]>>;
  getRoadClosures(): Promise<ExternalAPIResponse<RoadClosure[]>>;
  getTrafficFlow(area: GeoArea): Promise<ExternalAPIResponse<any>>;
  getPredictiveTraffic(area: GeoArea, forecastHours?: number): Promise<ExternalAPIResponse<any>>;
}

export interface OpenWeatherMapClient {
  getCurrentWeather(location: GeoLocation): Promise<ExternalAPIResponse<WeatherData>>;
  getWeatherForecast(location: GeoLocation, hours: number): Promise<ExternalAPIResponse<WeatherData[]>>;
  getWeatherAlerts(location: GeoLocation): Promise<ExternalAPIResponse<any[]>>;
}

export interface AmbeeAirQualityClient {
  getCurrentAirQuality(location: GeoLocation): Promise<ExternalAPIResponse<AirQualityData>>;
  getAirQualityForecast(location: GeoLocation, hours: number): Promise<ExternalAPIResponse<AirQualityData[]>>;
}

export interface TrafficAlert {
  id: string;
  location: GeoLocation;
  type: 'accident' | 'construction' | 'event' | 'weather' | 'breakdown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimatedDuration: number; // minutes
  affectedRoutes: string[];
  timestamp: Date;
}

export interface RoadClosure {
  id: string;
  location: GeoLocation;
  roadName: string;
  reason: string;
  startTime: Date;
  endTime: Date;
  alternativeRoutes: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  source: string;
}