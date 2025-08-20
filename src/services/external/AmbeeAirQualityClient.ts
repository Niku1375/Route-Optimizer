/**
 * Ambee Air Quality API client implementation
 */

import { BaseAPIClient } from './BaseAPIClient';
import { 
  AmbeeAirQualityClient, 
  AirQualityData, 
  ExternalAPIResponse,
  APIClientConfig 
} from '../../models/Traffic';
import { GeoLocation } from '../../models/GeoLocation';

export class AmbeeAirQualityClientImpl extends BaseAPIClient implements AmbeeAirQualityClient {
  constructor(config: APIClientConfig) {
    super(config);
  }

  async getCurrentAirQuality(location: GeoLocation): Promise<ExternalAPIResponse<AirQualityData>> {
    const cacheKey = this.generateCacheKey('current_air_quality', {
      lat: Math.round(location.latitude * 100) / 100,
      lng: Math.round(location.longitude * 100) / 100,
      timestamp: Math.floor(Date.now() / (60 * 60 * 1000)) // 1-hour cache buckets
    });

    const cached = this.getCachedResponse<AirQualityData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<any>(`/latest/by-lat-lng?lat=${location.latitude}&lng=${location.longitude}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.success) {
        return this.getFallbackAirQualityData(location, response.error);
      }

      const airQualityData: AirQualityData = this.parseAirQualityData(response.data, location);
      this.setCachedData(cacheKey, airQualityData);

      return {
        data: airQualityData,
        success: true,
        timestamp: new Date(),
        source: 'ambee',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackAirQualityData(location, (error as Error).message);
    }
  }

  async getAirQualityForecast(location: GeoLocation, hours: number): Promise<ExternalAPIResponse<AirQualityData[]>> {
    const cacheKey = this.generateCacheKey('air_quality_forecast', {
      lat: Math.round(location.latitude * 100) / 100,
      lng: Math.round(location.longitude * 100) / 100,
      hours,
      timestamp: Math.floor(Date.now() / (2 * 60 * 60 * 1000)) // 2-hour cache buckets for forecasts
    });

    const cached = this.getCachedResponse<AirQualityData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<any>(`/history/by-lat-lng?lat=${location.latitude}&lng=${location.longitude}&from=${new Date().toISOString()}&to=${new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.success) {
        return this.getFallbackAirQualityForecast(location, hours, response.error);
      }

      const forecastData: AirQualityData[] = this.parseAirQualityForecast(response.data, location);
      this.setCachedData(cacheKey, forecastData);

      return {
        data: forecastData,
        success: true,
        timestamp: new Date(),
        source: 'ambee',
        cached: false,
      };

    } catch (error) {
      return this.getFallbackAirQualityForecast(location, hours, (error as Error).message);
    }
  }

  private parseAirQualityData(data: any, location: GeoLocation): AirQualityData {
    const aqi = data.aqi || data.air_quality_index || 150; // Default moderate AQI for Delhi
    
    return {
      location,
      aqi,
      pm25: data.pm25 || data.PM25 || 75,
      pm10: data.pm10 || data.PM10 || 120,
      no2: data.no2 || data.NO2 || 45,
      so2: data.so2 || data.SO2 || 15,
      co: data.co || data.CO || 1.2,
      category: this.categorizeAQI(aqi),
      timestamp: new Date(data.timestamp || Date.now()),
      source: 'ambee',
    };
  }

  private parseAirQualityForecast(data: any, location: GeoLocation): AirQualityData[] {
    const forecasts = data.forecasts || data.hourly || [];
    
    return forecasts.map((forecast: any) => {
      const aqi = forecast.aqi || forecast.air_quality_index || 150;
      
      return {
        location,
        aqi,
        pm25: forecast.pm25 || forecast.PM25 || 75,
        pm10: forecast.pm10 || forecast.PM10 || 120,
        no2: forecast.no2 || forecast.NO2 || 45,
        so2: forecast.so2 || forecast.SO2 || 15,
        co: forecast.co || forecast.CO || 1.2,
        category: this.categorizeAQI(aqi),
        timestamp: new Date(forecast.timestamp || forecast.time || Date.now()),
        source: 'ambee',
      };
    });
  }

  private categorizeAQI(aqi: number): AirQualityData['category'] {
    if (aqi <= 50) {
      return 'good';
    } else if (aqi <= 100) {
      return 'satisfactory';
    } else if (aqi <= 200) {
      return 'moderate';
    } else if (aqi <= 300) {
      return 'poor';
    } else if (aqi <= 400) {
      return 'very_poor';
    } else {
      return 'severe';
    }
  }

  private getFallbackAirQualityData(location: GeoLocation, error?: string): ExternalAPIResponse<AirQualityData> {
    // Use typical Delhi air quality as fallback (unfortunately often poor)
    const fallbackAQI: AirQualityData = {
      location,
      aqi: this.getSeasonalAQI(),
      pm25: 85, // Typical Delhi PM2.5
      pm10: 140, // Typical Delhi PM10
      no2: 50,
      so2: 18,
      co: 1.5,
      category: this.categorizeAQI(this.getSeasonalAQI()),
      timestamp: new Date(),
      source: 'cached',
    };

    return {
      data: fallbackAQI,
      success: false,
      error: error || 'Ambee Air Quality API unavailable, using seasonal defaults',
      timestamp: new Date(),
      source: 'ambee',
      cached: true,
    };
  }

  private getFallbackAirQualityForecast(
    location: GeoLocation, 
    hours: number, 
    error?: string
  ): ExternalAPIResponse<AirQualityData[]> {
    const fallbackForecast: AirQualityData[] = [];
    const baseAQI = this.getSeasonalAQI();
    
    for (let i = 0; i < hours; i++) {
      const timestamp = new Date(Date.now() + i * 60 * 60 * 1000);
      
      // AQI typically varies throughout the day (worse in morning/evening)
      const hourOfDay = timestamp.getHours();
      let aqiVariation = 0;
      
      if (hourOfDay >= 6 && hourOfDay <= 10) {
        aqiVariation = 30; // Morning rush hour
      } else if (hourOfDay >= 18 && hourOfDay <= 22) {
        aqiVariation = 25; // Evening rush hour
      } else if (hourOfDay >= 0 && hourOfDay <= 5) {
        aqiVariation = -20; // Early morning, slightly better
      }
      
      const hourlyAQI = Math.max(50, baseAQI + aqiVariation + (Math.random() - 0.5) * 40);
      
      fallbackForecast.push({
        location,
        aqi: Math.round(hourlyAQI),
        pm25: Math.round(hourlyAQI * 0.6), // Approximate PM2.5 from AQI
        pm10: Math.round(hourlyAQI * 0.9), // Approximate PM10 from AQI
        no2: 45 + Math.random() * 20,
        so2: 15 + Math.random() * 10,
        co: 1.2 + Math.random() * 0.8,
        category: this.categorizeAQI(hourlyAQI),
        timestamp,
        source: 'cached',
      });
    }

    return {
      data: fallbackForecast,
      success: false,
      error: error || 'Ambee Air Quality API unavailable, using seasonal forecast',
      timestamp: new Date(),
      source: 'ambee',
      cached: true,
    };
  }

  private getSeasonalAQI(): number {
    const month = new Date().getMonth(); // 0-11
    
    // Delhi seasonal AQI patterns (approximate)
    // Winter months (Nov-Feb) are typically worse due to crop burning and weather conditions
    const seasonalAQI = [280, 250, 180, 150, 160, 180, 200, 190, 200, 220, 300, 320]; // Jan-Dec
    return seasonalAQI[month] || 180; // Default AQI if month is invalid
  }
}