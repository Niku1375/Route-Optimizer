/**
 * OpenWeatherMap API client implementation
 * Provides comprehensive weather data for traffic and routing decisions
 */

import { BaseAPIClient } from './BaseAPIClient';
import { 
  OpenWeatherMapClient, 
  WeatherData, 
  ExternalAPIResponse,
  APIClientConfig 
} from '../../models/Traffic';
import { GeoLocation } from '../../models/GeoLocation';

export class OpenWeatherMapClientImpl extends BaseAPIClient implements OpenWeatherMapClient {
  constructor(config: APIClientConfig) {
    super(config);
  }

  async getCurrentWeather(location: GeoLocation): Promise<ExternalAPIResponse<WeatherData>> {
    const cacheKey = this.generateCacheKey('current_weather', {
      lat: Math.round(location.latitude * 100) / 100, // Round to 2 decimal places for caching
      lng: Math.round(location.longitude * 100) / 100,
      timestamp: Math.floor(Date.now() / (10 * 60 * 1000)) // 10-minute cache buckets
    });

    const cached = this.getCachedResponse<WeatherData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        lat: location.latitude.toString(),
        lon: location.longitude.toString(),
        appid: this.config.apiKey,
        units: 'metric',
        lang: 'en',
      }).toString();

      const endpoint = `/weather?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return this.getFallbackWeatherData(location, response.error);
      }

      const weatherData: WeatherData = this.parseCurrentWeatherData(response.data, location);
      this.setCachedData(cacheKey, weatherData);

      return {
        data: weatherData,
        success: true,
        timestamp: new Date(),
        source: 'openweathermap',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackWeatherData(location, (error as Error).message);
    }
  }

  async getWeatherForecast(location: GeoLocation, hours: number): Promise<ExternalAPIResponse<WeatherData[]>> {
    const cacheKey = this.generateCacheKey('weather_forecast', {
      lat: Math.round(location.latitude * 100) / 100,
      lng: Math.round(location.longitude * 100) / 100,
      hours,
      timestamp: Math.floor(Date.now() / (30 * 60 * 1000)) // 30-minute cache buckets for forecasts
    });

    const cached = this.getCachedResponse<WeatherData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        lat: location.latitude.toString(),
        lon: location.longitude.toString(),
        appid: this.config.apiKey,
        units: 'metric',
        cnt: Math.min(Math.ceil(hours / 3), 40).toString(), // Convert number to string
      }).toString();

      const endpoint = `/forecast?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return this.getFallbackWeatherForecast(location, hours, response.error);
      }

      const forecastData: WeatherData[] = this.parseWeatherForecast(response.data, location, hours);
      this.setCachedData(cacheKey, forecastData);

      return {
        data: forecastData,
        success: true,
        timestamp: new Date(),
        source: 'openweathermap',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackWeatherForecast(location, hours, (error as Error).message);
    }
  }

  async getWeatherAlerts(location: GeoLocation): Promise<ExternalAPIResponse<any[]>> {
    const cacheKey = this.generateCacheKey('weather_alerts', {
      lat: Math.round(location.latitude * 100) / 100,
      lng: Math.round(location.longitude * 100) / 100,
      timestamp: Math.floor(Date.now() / (15 * 60 * 1000)) // 15-minute cache buckets
    });

    const cached = this.getCachedResponse<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        lat: location.latitude.toString(),
        lon: location.longitude.toString(),
        appid: this.config.apiKey,
        exclude: 'minutely,daily', // Only get current, hourly, and alerts
      }).toString();

      const endpoint = `/onecall?${queryParams}`;

      const response = await this.makeRequest<any>(endpoint, {
        method: 'GET',
      });

      if (!response.success) {
        return {
          data: [],
          success: false,
          error: response.error || 'Weather alerts unavailable',
          timestamp: new Date(),
          source: 'openweathermap',
          cached: false,
        };
      }

      const alerts = response.data.alerts || [];
      this.setCachedData(cacheKey, alerts);

      return {
        data: alerts,
        success: true,
        timestamp: new Date(),
        source: 'openweathermap',
        cached: false,
      };

    } catch (error) {
      return {
        data: [],
        success: false,
        error: (error as Error).message,
        timestamp: new Date(),
        source: 'openweathermap',
        cached: false,
      };
    }
  }

  private parseCurrentWeatherData(data: any, location: GeoLocation): WeatherData {
    const main = data.main || {};
    const weather = data.weather?.[0] || {};
    const wind = data.wind || {};
    const rain = data.rain || {};
    
    return {
      location,
      temperature: Math.round(main.temp || 25),
      humidity: main.humidity || 60,
      rainfall: (rain['1h'] || rain['3h'] || 0), // mm in last 1h or 3h
      visibility: (data.visibility || 10000) / 1000, // Convert meters to kilometers
      windSpeed: Math.round((wind.speed || 0) * 3.6), // Convert m/s to km/h
      conditions: this.mapWeatherConditions(weather.main, weather.description),
      timestamp: new Date((data.dt || Date.now() / 1000) * 1000),
      source: 'openweathermap',
    };
  }

  private parseWeatherForecast(data: any, location: GeoLocation, requestedHours: number): WeatherData[] {
    const forecasts = data.list || [];
    const result: WeatherData[] = [];
    
    // OpenWeatherMap provides 3-hour intervals, interpolate if needed
    for (let i = 0; i < forecasts.length && result.length < requestedHours; i++) {
      const forecast = forecasts[i];
      const main = forecast.main || {};
      const weather = forecast.weather?.[0] || {};
      const wind = forecast.wind || {};
      const rain = forecast.rain || {};
      
      const weatherData: WeatherData = {
        location,
        temperature: Math.round(main.temp || 25),
        humidity: main.humidity || 60,
        rainfall: (rain['3h'] || 0), // mm in 3h period
        visibility: (forecast.visibility || 10000) / 1000,
        windSpeed: Math.round((wind.speed || 0) * 3.6),
        conditions: this.mapWeatherConditions(weather.main, weather.description),
        timestamp: new Date((forecast.dt || Date.now() / 1000) * 1000),
        source: 'openweathermap',
      };
      
      result.push(weatherData);
      
      // If we need hourly data but only have 3-hourly, interpolate
      if (requestedHours > forecasts.length * 3) {
        const nextForecast = forecasts[i + 1];
        if (nextForecast) {
          const interpolated = this.interpolateWeatherData(weatherData, nextForecast, location);
          result.push(...interpolated);
        }
      }
    }
    
    return result.slice(0, requestedHours);
  }

  private interpolateWeatherData(current: WeatherData, next: any, location: GeoLocation): WeatherData[] {
    const interpolated: WeatherData[] = [];
    const nextMain = next.main || {};
    const nextWeather = next.weather?.[0] || {};
    const nextWind = next.wind || {};
    
    // Create 2 interpolated points between current and next (3-hour gap)
    for (let i = 1; i <= 2; i++) {
      const ratio = i / 3;
      const timestamp = new Date(current.timestamp.getTime() + i * 60 * 60 * 1000);
      
      interpolated.push({
        location,
        temperature: Math.round(current.temperature + (nextMain.temp - current.temperature) * ratio),
        humidity: Math.round(current.humidity + (nextMain.humidity - current.humidity) * ratio),
        rainfall: current.rainfall * (1 - ratio), // Assume rainfall decreases over time
        visibility: current.visibility + (((next.visibility || 10000) / 1000) - current.visibility) * ratio,
        windSpeed: Math.round(current.windSpeed + (((nextWind.speed || 0) * 3.6) - current.windSpeed) * ratio),
        conditions: i === 1 ? current.conditions : this.mapWeatherConditions(nextWeather.main, nextWeather.description),
        timestamp,
        source: 'openweathermap_interpolated',
      });
    }
    
    return interpolated;
  }

  private mapWeatherConditions(main: string, description: string): string {
    if (!main) return 'clear';
    
    const mainCondition = main.toLowerCase();
    const desc = (description || '').toLowerCase();
    
    if (mainCondition.includes('rain') || mainCondition.includes('drizzle')) {
      return 'rain';
    } else if (mainCondition.includes('fog') || mainCondition.includes('mist') || desc.includes('haze')) {
      return 'fog';
    } else if (mainCondition.includes('cloud')) {
      return desc.includes('few') || desc.includes('scattered') ? 'partly_cloudy' : 'cloudy';
    } else if (mainCondition.includes('storm') || mainCondition.includes('thunder')) {
      return 'storm';
    } else if (mainCondition.includes('clear')) {
      return 'clear';
    } else if (mainCondition.includes('snow')) {
      return 'snow';
    } else {
      return 'partly_cloudy';
    }
  }

  private getFallbackWeatherData(location: GeoLocation, error?: string): ExternalAPIResponse<WeatherData> {
    // Use typical Delhi weather as fallback
    const fallbackWeather: WeatherData = {
      location,
      temperature: this.getSeasonalTemperature(),
      humidity: 65,
      rainfall: 0,
      visibility: 8, // Reduced visibility due to pollution
      windSpeed: 5,
      conditions: 'partly_cloudy',
      timestamp: new Date(),
      source: 'cached',
    };

    return {
      data: fallbackWeather,
      success: false,
      error: error || 'OpenWeatherMap API unavailable, using seasonal defaults',
      timestamp: new Date(),
      source: 'openweathermap',
      cached: true,
    };
  }

  private getFallbackWeatherForecast(
    location: GeoLocation, 
    hours: number, 
    error?: string
  ): ExternalAPIResponse<WeatherData[]> {
    const fallbackForecast: WeatherData[] = [];
    const baseTemp = this.getSeasonalTemperature();
    
    for (let i = 0; i < hours; i++) {
      const timestamp = new Date(Date.now() + i * 60 * 60 * 1000);
      const hourlyTemp = baseTemp + Math.sin((i / 24) * 2 * Math.PI) * 5; // Daily temperature variation
      
      fallbackForecast.push({
        location,
        temperature: Math.round(hourlyTemp),
        humidity: 65 + Math.random() * 20, // 65-85% humidity
        rainfall: Math.random() < 0.1 ? Math.random() * 5 : 0, // 10% chance of rain
        visibility: 8 + Math.random() * 4, // 8-12 km visibility
        windSpeed: Math.round(5 + Math.random() * 5), // 5-10 km/h wind
        conditions: this.getRandomWeatherCondition(),
        timestamp,
        source: 'cached',
      });
    }

    return {
      data: fallbackForecast,
      success: false,
      error: error || 'OpenWeatherMap API unavailable, using seasonal forecast',
      timestamp: new Date(),
      source: 'openweathermap',
      cached: true,
    };
  }

  private getSeasonalTemperature(): number {
    const month = new Date().getMonth(); // 0-11
    
    // Delhi seasonal temperatures (approximate)
    const seasonalTemps = [15, 18, 25, 32, 38, 40, 35, 33, 32, 28, 22, 17]; // Jan-Dec
    return seasonalTemps[month] || 25; // Default to 25°C if month is invalid
  }

  private getRandomWeatherCondition(): string {
    const conditions = ['clear', 'partly_cloudy', 'cloudy', 'fog'];
    const weights = [0.3, 0.4, 0.2, 0.1]; // Probabilities for Delhi
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < conditions.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        cumulative += weight;
        if (random <= cumulative) {
          return conditions[i] || 'clear';
        }
      }
    }
    
    return 'clear';
  }
}