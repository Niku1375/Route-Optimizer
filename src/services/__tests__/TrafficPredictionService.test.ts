/**
 * Unit tests for TrafficPredictionService with external API integration
 */

import { TrafficPredictionServiceImpl } from '../TrafficPredictionService';
import { 
  GoogleMapsTrafficClientImpl,
  DelhiTrafficPoliceClientImpl,
  IMDWeatherClientImpl,
  AmbeeAirQualityClientImpl
} from '../external';
import { GeoArea, GeoLocation } from '../../models/GeoLocation';
import { TimeWindow } from '../../models/Common';
import { 
  TrafficData, 
  WeatherData, 
  AirQualityData, 
  TrafficAlert, 
  RoadClosure,
  ExternalAPIResponse 
} from '../../models/Traffic';

// Mock the external API clients
jest.mock('../external/GoogleMapsTrafficClient');
jest.mock('../external/DelhiTrafficPoliceClient');
jest.mock('../external/IMDWeatherClient');
jest.mock('../external/AmbeeAirQualityClient');

describe('TrafficPredictionService', () => {
  let service: TrafficPredictionServiceImpl;
  let mockGoogleMapsClient: jest.Mocked<GoogleMapsTrafficClientImpl>;
  let mockDelhiTrafficClient: jest.Mocked<DelhiTrafficPoliceClientImpl>;
  let mockIMDClient: jest.Mocked<IMDWeatherClientImpl>;
  let mockAmbeeClient: jest.Mocked<AmbeeAirQualityClientImpl>;

  const testArea: GeoArea = {
    id: 'test_area',
    name: 'Test Area',
    boundaries: [
      { latitude: 28.6139, longitude: 77.2090 },
      { latitude: 28.6200, longitude: 77.2150 },
    ],
    zoneType: 'commercial',
  };

  const testLocation: GeoLocation = {
    latitude: 28.6139,
    longitude: 77.2090,
  };

  const testTimeWindow: TimeWindow = {
    earliest: new Date('2024-01-15T09:00:00Z'),
    latest: new Date('2024-01-15T17:00:00Z'),
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service with mock configurations
    service = new TrafficPredictionServiceImpl({
      googleMaps: {
        baseUrl: 'https://maps.googleapis.com',
        apiKey: 'test-google-key',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 1000,
        cacheTimeout: 300,
      },
      delhiTrafficPolice: {
        baseUrl: 'https://delhitraffic.gov.in',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 1000,
        cacheTimeout: 600,
      },
      imdWeather: {
        baseUrl: 'https://api.imd.gov.in',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 1000,
        cacheTimeout: 1800,
      },
      ambeeAirQuality: {
        baseUrl: 'https://api.ambeedata.com',
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 1000,
        cacheTimeout: 3600,
      },
    });

    // Get mock instances
    mockGoogleMapsClient = (service as any).apiClients.googleMaps;
    mockDelhiTrafficClient = (service as any).apiClients.delhiTrafficPolice;
    mockIMDClient = (service as any).apiClients.imdWeather;
    mockAmbeeClient = (service as any).apiClients.ambeeAirQuality;
  });

  describe('getCurrentTraffic', () => {
    it('should return traffic data from Google Maps API', async () => {
      const mockTrafficData: TrafficData = {
        area: testArea,
        congestionLevel: 'high',
        averageSpeed: 15,
        travelTimeMultiplier: 2.0,
        timestamp: new Date(),
        source: 'google_maps',
      };

      const mockResponse: ExternalAPIResponse<TrafficData> = {
        data: mockTrafficData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      };

      mockGoogleMapsClient.getCurrentTraffic.mockResolvedValue(mockResponse);

      const result = await service.getCurrentTraffic(testArea);

      expect(result).toEqual(mockTrafficData);
      expect(mockGoogleMapsClient.getCurrentTraffic).toHaveBeenCalledWith(testArea);
    });

    it('should return fallback data when Google Maps API fails', async () => {
      const mockResponse: ExternalAPIResponse<TrafficData> = {
        data: null as any,
        success: false,
        error: 'API unavailable',
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      };

      mockGoogleMapsClient.getCurrentTraffic.mockResolvedValue(mockResponse);

      const result = await service.getCurrentTraffic(testArea);

      expect(result.source).toBe('cached');
      expect(result.congestionLevel).toBe('moderate');
      expect(result.area).toEqual(testArea);
    });

    it('should handle API client exceptions', async () => {
      mockGoogleMapsClient.getCurrentTraffic.mockRejectedValue(new Error('Network error'));

      const result = await service.getCurrentTraffic(testArea);

      expect(result.source).toBe('cached');
      expect(result.area).toEqual(testArea);
    });
  });

  describe('predictTraffic', () => {
    it('should generate traffic predictions based on current traffic', async () => {
      const mockTrafficData: TrafficData = {
        area: testArea,
        congestionLevel: 'moderate',
        averageSpeed: 25,
        travelTimeMultiplier: 1.5,
        timestamp: new Date(),
        source: 'google_maps',
      };

      const mockResponse: ExternalAPIResponse<TrafficData> = {
        data: mockTrafficData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      };

      mockGoogleMapsClient.getCurrentTraffic.mockResolvedValue(mockResponse);

      const result = await service.predictTraffic(testArea, testTimeWindow);

      expect(result.area).toEqual(testArea);
      expect(result.timeWindow).toEqual(testTimeWindow);
      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.modelUsed).toBe('basic_extrapolation');
      expect(result.confidence).toBe(0.6);
    });

    it('should return fallback forecast when current traffic fails', async () => {
      mockGoogleMapsClient.getCurrentTraffic.mockRejectedValue(new Error('API error'));

      const result = await service.predictTraffic(testArea, testTimeWindow);

      expect(result.modelUsed).toBe('fallback_basic');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('getAlternativeRoutes', () => {
    it('should return route traffic data from Google Maps API', async () => {
      const mockRouteData: TrafficData[] = [
        {
          area: {
            id: 'route_segment_1',
            name: 'Route Segment 1',
            boundaries: [testLocation, testLocation],
            zoneType: 'mixed',
          },
          congestionLevel: 'moderate',
          averageSpeed: 30,
          travelTimeMultiplier: 1.3,
          timestamp: new Date(),
          source: 'google_maps',
        },
      ];

      const mockResponse: ExternalAPIResponse<TrafficData[]> = {
        data: mockRouteData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      };

      mockGoogleMapsClient.getRouteTraffic.mockResolvedValue(mockResponse);

      const result = await service.getAlternativeRoutes(testLocation, testLocation);

      expect(result).toEqual(mockRouteData);
      expect(mockGoogleMapsClient.getRouteTraffic).toHaveBeenCalledWith(testLocation, testLocation);
    });
  });

  describe('getWeatherData', () => {
    it('should return weather data from IMD API', async () => {
      const mockWeatherData: WeatherData = {
        location: testLocation,
        temperature: 28,
        humidity: 70,
        rainfall: 0,
        visibility: 10,
        windSpeed: 8,
        conditions: 'clear',
        timestamp: new Date(),
        source: 'imd',
      };

      const mockResponse: ExternalAPIResponse<WeatherData> = {
        data: mockWeatherData,
        success: true,
        timestamp: new Date(),
        source: 'imd',
        cached: false,
      };

      mockIMDClient.getCurrentWeather.mockResolvedValue(mockResponse);

      const result = await service.getWeatherData(testLocation);

      expect(result).toEqual(mockWeatherData);
      expect(mockIMDClient.getCurrentWeather).toHaveBeenCalledWith(testLocation);
    });

    it('should return fallback weather data when IMD API fails', async () => {
      const mockResponse: ExternalAPIResponse<WeatherData> = {
        data: null as any,
        success: false,
        error: 'IMD API unavailable',
        timestamp: new Date(),
        source: 'imd',
        cached: false,
      };

      mockIMDClient.getCurrentWeather.mockResolvedValue(mockResponse);

      const result = await service.getWeatherData(testLocation);

      expect(result.source).toBe('cached');
      expect(result.location).toEqual(testLocation);
      expect(result.temperature).toBe(25);
    });
  });

  describe('getAirQualityData', () => {
    it('should return air quality data from Ambee API', async () => {
      const mockAirQualityData: AirQualityData = {
        location: testLocation,
        aqi: 150,
        pm25: 75,
        pm10: 120,
        no2: 45,
        so2: 15,
        co: 1.2,
        category: 'moderate',
        timestamp: new Date(),
        source: 'ambee',
      };

      const mockResponse: ExternalAPIResponse<AirQualityData> = {
        data: mockAirQualityData,
        success: true,
        timestamp: new Date(),
        source: 'ambee',
        cached: false,
      };

      mockAmbeeClient.getCurrentAirQuality.mockResolvedValue(mockResponse);

      const result = await service.getAirQualityData(testLocation);

      expect(result).toEqual(mockAirQualityData);
      expect(mockAmbeeClient.getCurrentAirQuality).toHaveBeenCalledWith(testLocation);
    });
  });

  describe('getTrafficAlerts', () => {
    it('should return traffic alerts from Delhi Traffic Police API', async () => {
      const mockAlerts: TrafficAlert[] = [
        {
          id: 'alert_1',
          location: testLocation,
          type: 'accident',
          severity: 'high',
          description: 'Major accident on Ring Road',
          estimatedDuration: 60,
          affectedRoutes: ['Ring Road', 'NH1'],
          timestamp: new Date(),
        },
      ];

      const mockResponse: ExternalAPIResponse<TrafficAlert[]> = {
        data: mockAlerts,
        success: true,
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      };

      mockDelhiTrafficClient.getTrafficAlerts.mockResolvedValue(mockResponse);

      const result = await service.getTrafficAlerts(testArea);

      expect(result).toEqual(mockAlerts);
      expect(mockDelhiTrafficClient.getTrafficAlerts).toHaveBeenCalledWith(testArea);
    });

    it('should return empty array when traffic alerts API fails', async () => {
      const mockResponse: ExternalAPIResponse<TrafficAlert[]> = {
        data: [],
        success: false,
        error: 'API unavailable',
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      };

      mockDelhiTrafficClient.getTrafficAlerts.mockResolvedValue(mockResponse);

      const result = await service.getTrafficAlerts(testArea);

      expect(result).toEqual([]);
    });
  });

  describe('getRoadClosures', () => {
    it('should return road closures from Delhi Traffic Police API', async () => {
      const mockClosures: RoadClosure[] = [
        {
          id: 'closure_1',
          location: testLocation,
          roadName: 'Rajpath',
          reason: 'Republic Day preparations',
          startTime: new Date(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          alternativeRoutes: ['India Gate Road', 'Janpath'],
        },
      ];

      const mockResponse: ExternalAPIResponse<RoadClosure[]> = {
        data: mockClosures,
        success: true,
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      };

      mockDelhiTrafficClient.getRoadClosures.mockResolvedValue(mockResponse);

      const result = await service.getRoadClosures();

      expect(result).toEqual(mockClosures);
      expect(mockDelhiTrafficClient.getRoadClosures).toHaveBeenCalled();
    });
  });

  describe('getIntegratedTrafficData', () => {
    it('should return integrated traffic data from all APIs', async () => {
      // Mock all API responses
      const mockTrafficData: TrafficData = {
        area: testArea,
        congestionLevel: 'high',
        averageSpeed: 15,
        travelTimeMultiplier: 2.0,
        timestamp: new Date(),
        source: 'google_maps',
      };

      const mockWeatherData: WeatherData = {
        location: testLocation,
        temperature: 28,
        humidity: 70,
        rainfall: 5, // Light rain
        visibility: 6,
        windSpeed: 8,
        conditions: 'rain',
        timestamp: new Date(),
        source: 'imd',
      };

      const mockAirQualityData: AirQualityData = {
        location: testLocation,
        aqi: 250,
        pm25: 120,
        pm10: 180,
        no2: 60,
        so2: 25,
        co: 2.0,
        category: 'poor',
        timestamp: new Date(),
        source: 'ambee',
      };

      const mockAlerts: TrafficAlert[] = [
        {
          id: 'alert_1',
          location: testLocation,
          type: 'accident',
          severity: 'critical',
          description: 'Major accident',
          estimatedDuration: 90,
          affectedRoutes: ['NH1'],
          timestamp: new Date(),
        },
      ];

      const mockClosures: RoadClosure[] = [];

      // Setup mocks
      mockGoogleMapsClient.getCurrentTraffic.mockResolvedValue({
        data: mockTrafficData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      mockIMDClient.getCurrentWeather.mockResolvedValue({
        data: mockWeatherData,
        success: true,
        timestamp: new Date(),
        source: 'imd',
        cached: false,
      });

      mockAmbeeClient.getCurrentAirQuality.mockResolvedValue({
        data: mockAirQualityData,
        success: true,
        timestamp: new Date(),
        source: 'ambee',
        cached: false,
      });

      mockDelhiTrafficClient.getTrafficAlerts.mockResolvedValue({
        data: mockAlerts,
        success: true,
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      });

      mockDelhiTrafficClient.getRoadClosures.mockResolvedValue({
        data: mockClosures,
        success: true,
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      });

      const result = await service.getIntegratedTrafficData(testArea);

      expect(result.traffic).toEqual(mockTrafficData);
      expect(result.weather).toEqual(mockWeatherData);
      expect(result.airQuality).toEqual(mockAirQualityData);
      expect(result.alerts).toEqual(mockAlerts);
      expect(result.roadClosures).toEqual(mockClosures);

      // Check impact assessment
      expect(result.overallImpact.severityLevel).toBe('severe'); // High traffic + rain + critical alert
      expect(result.overallImpact.primaryFactors).toContain('Heavy traffic congestion');
      expect(result.overallImpact.primaryFactors).toContain('Light rainfall');
      expect(result.overallImpact.primaryFactors).toContain('1 critical traffic incidents');
      expect(result.overallImpact.alternativeRoutesRecommended).toBe(true);
      expect(result.overallImpact.estimatedDelay).toBeGreaterThan(0);
    });

    it('should handle partial API failures gracefully', async () => {
      // Mock some APIs to fail
      mockGoogleMapsClient.getCurrentTraffic.mockRejectedValue(new Error('Google API down'));
      mockIMDClient.getCurrentWeather.mockRejectedValue(new Error('IMD API down'));

      // Mock successful APIs
      mockAmbeeClient.getCurrentAirQuality.mockResolvedValue({
        data: {
          location: testLocation,
          aqi: 150,
          pm25: 75,
          pm10: 120,
          no2: 45,
          so2: 15,
          co: 1.2,
          category: 'moderate',
          timestamp: new Date(),
          source: 'ambee',
        },
        success: true,
        timestamp: new Date(),
        source: 'ambee',
        cached: false,
      });

      mockDelhiTrafficClient.getTrafficAlerts.mockResolvedValue({
        data: [],
        success: true,
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      });

      mockDelhiTrafficClient.getRoadClosures.mockResolvedValue({
        data: [],
        success: true,
        timestamp: new Date(),
        source: 'delhi_traffic_police',
        cached: false,
      });

      const result = await service.getIntegratedTrafficData(testArea);

      // Should use fallback data for failed APIs
      expect(result.traffic.source).toBe('cached');
      expect(result.weather.source).toBe('cached');
      expect(result.airQuality.source).toBe('ambee'); // This one succeeded
      expect(result.alerts).toEqual([]);
      expect(result.roadClosures).toEqual([]);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics from all clients', () => {
      // Mock cache stats for each client
      mockGoogleMapsClient.getCacheStats = jest.fn().mockReturnValue({
        total: 10,
        expired: 2,
        active: 8,
      });

      mockDelhiTrafficClient.getCacheStats = jest.fn().mockReturnValue({
        total: 5,
        expired: 1,
        active: 4,
      });

      mockIMDClient.getCacheStats = jest.fn().mockReturnValue({
        total: 3,
        expired: 0,
        active: 3,
      });

      mockAmbeeClient.getCacheStats = jest.fn().mockReturnValue({
        total: 7,
        expired: 1,
        active: 6,
      });

      const stats = service.getCacheStatistics();

      expect(stats.googleMaps).toEqual({ total: 10, expired: 2, active: 8 });
      expect(stats.delhiTrafficPolice).toEqual({ total: 5, expired: 1, active: 4 });
      expect(stats.imdWeather).toEqual({ total: 3, expired: 0, active: 3 });
      expect(stats.ambeeAirQuality).toEqual({ total: 7, expired: 1, active: 6 });
    });
  });
});