/**
 * Unit tests for GoogleMapsTrafficClient
 */

import { GoogleMapsTrafficClientImpl } from '../GoogleMapsTrafficClient';
import { APIClientConfig } from '../../../models/Traffic';
import { GeoArea, GeoLocation } from '../../../models/GeoLocation';

// Mock the BaseAPIClient
jest.mock('../BaseAPIClient');

describe('GoogleMapsTrafficClient', () => {
  let client: GoogleMapsTrafficClientImpl;
  let mockMakeRequest: jest.Mock;
  let mockGetCachedResponse: jest.Mock;
  let mockSetCachedData: jest.Mock;

  const testConfig: APIClientConfig = {
    baseUrl: 'https://maps.googleapis.com',
    apiKey: 'test-google-key',
    timeout: 5000,
    retryAttempts: 2,
    retryDelay: 1000,
    cacheTimeout: 300,
  };

  const testArea: GeoArea = {
    id: 'test_area',
    name: 'Test Area Delhi',
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

  beforeEach(() => {
    client = new GoogleMapsTrafficClientImpl(testConfig);
    
    // Mock the protected methods from BaseAPIClient
    mockMakeRequest = jest.fn();
    mockGetCachedResponse = jest.fn();
    mockSetCachedData = jest.fn();

    (client as any).makeRequest = mockMakeRequest;
    (client as any).getCachedResponse = mockGetCachedResponse;
    (client as any).setCachedData = mockSetCachedData;
    (client as any).generateCacheKey = jest.fn().mockReturnValue('test-cache-key');

    jest.clearAllMocks();
  });

  describe('getCurrentTraffic', () => {
    it('should return cached traffic data if available', async () => {
      const cachedTrafficData = {
        area: testArea,
        congestionLevel: 'moderate' as const,
        averageSpeed: 25,
        travelTimeMultiplier: 1.5,
        timestamp: new Date(),
        source: 'google_maps' as const,
      };

      const cachedResponse = {
        data: cachedTrafficData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: true,
      };

      mockGetCachedResponse.mockReturnValue(cachedResponse);

      const result = await client.getCurrentTraffic(testArea);

      expect(result).toEqual(cachedResponse);
      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    it('should fetch fresh traffic data when cache miss', async () => {
      mockGetCachedResponse.mockReturnValue(null);

      const mockGoogleResponse = {
        traffic_level: 'heavy',
        average_speed: 15,
        duration: 1800, // 30 minutes
        duration_in_traffic: 2700, // 45 minutes
      };

      mockMakeRequest.mockResolvedValue({
        data: mockGoogleResponse,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const result = await client.getCurrentTraffic(testArea);

      expect(result.success).toBe(true);
      expect(result.data.congestionLevel).toBe('high'); // 'heavy' maps to 'high'
      expect(result.data.averageSpeed).toBe(15);
      expect(result.data.travelTimeMultiplier).toBe(1.5); // 2700/1800
      expect(result.data.source).toBe('google_maps');
      expect(mockSetCachedData).toHaveBeenCalled();
    });

    it('should map Google traffic levels correctly', async () => {
      mockGetCachedResponse.mockReturnValue(null);

      const testCases = [
        { googleLevel: 'light', expected: 'low' },
        { googleLevel: 'moderate', expected: 'moderate' },
        { googleLevel: 'heavy', expected: 'high' },
        { googleLevel: 'severe', expected: 'severe' },
        { googleLevel: 'unknown', expected: 'moderate' }, // default
      ];

      for (const testCase of testCases) {
        mockMakeRequest.mockResolvedValue({
          data: { traffic_level: testCase.googleLevel },
          success: true,
          timestamp: new Date(),
          source: 'google_maps',
          cached: false,
        });

        const result = await client.getCurrentTraffic(testArea);
        expect(result.data.congestionLevel).toBe(testCase.expected);
      }
    });

    it('should return fallback data when API fails', async () => {
      mockGetCachedResponse.mockReturnValue(null);
      mockMakeRequest.mockResolvedValue({
        data: null,
        success: false,
        error: 'API rate limit exceeded',
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const result = await client.getCurrentTraffic(testArea);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
      expect(result.data.source).toBe('cached');
      expect(result.data.congestionLevel).toBe('moderate'); // Conservative fallback
      expect(result.data.averageSpeed).toBe(20); // Conservative speed for Delhi
    });

    it('should handle API exceptions', async () => {
      mockGetCachedResponse.mockReturnValue(null);
      mockMakeRequest.mockRejectedValue(new Error('Network timeout'));

      const result = await client.getCurrentTraffic(testArea);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.data.source).toBe('cached');
    });
  });

  describe('getRouteTraffic', () => {
    const destination: GeoLocation = {
      latitude: 28.7041,
      longitude: 77.1025,
    };

    it('should return cached route traffic data if available', async () => {
      const cachedRouteData = [{
        area: {
          id: 'route_segment_1',
          name: 'Route Segment 1',
          boundaries: [testLocation, destination],
          zoneType: 'mixed' as const,
        },
        congestionLevel: 'moderate' as const,
        averageSpeed: 30,
        travelTimeMultiplier: 1.3,
        timestamp: new Date(),
        source: 'google_maps' as const,
      }];

      const cachedResponse = {
        data: cachedRouteData,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: true,
      };

      mockGetCachedResponse.mockReturnValue(cachedResponse);

      const result = await client.getRouteTraffic(testLocation, destination);

      expect(result).toEqual(cachedResponse);
      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    it('should fetch fresh route traffic data when cache miss', async () => {
      mockGetCachedResponse.mockReturnValue(null);

      const mockGoogleResponse = {
        routes: [{
          legs: [{
            duration: { value: 1800 }, // 30 minutes
            duration_in_traffic: { value: 2400 }, // 40 minutes
            traffic_speed_entry: {
              speed_category: 'moderate',
              speed: 25,
            },
          }],
        }],
      };

      mockMakeRequest.mockResolvedValue({
        data: mockGoogleResponse,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const result = await client.getRouteTraffic(testLocation, destination);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.congestionLevel).toBe('moderate');
      expect(result.data[0]?.averageSpeed).toBe(25);
      expect(result.data[0]?.travelTimeMultiplier).toBeCloseTo(1.33, 1); // 2400/1800
    });

    it('should create default segment when no route data available', async () => {
      mockGetCachedResponse.mockReturnValue(null);

      const mockGoogleResponse = {
        routes: [], // No routes
      };

      mockMakeRequest.mockResolvedValue({
        data: mockGoogleResponse,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const result = await client.getRouteTraffic(testLocation, destination);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.area.id).toBe('route_default');
      expect(result.data[0]?.congestionLevel).toBe('moderate');
      expect(result.data[0]?.averageSpeed).toBe(25);
    });

    it('should return fallback route data when API fails', async () => {
      mockGetCachedResponse.mockReturnValue(null);
      mockMakeRequest.mockResolvedValue({
        data: null,
        success: false,
        error: 'Google Maps API unavailable',
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const result = await client.getRouteTraffic(testLocation, destination);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google Maps API unavailable');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.source).toBe('cached');
      expect(result.data[0]?.congestionLevel).toBe('moderate');
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for traffic requests', async () => {
      const mockGenerateCacheKey = jest.fn().mockReturnValue('traffic:area_id=test_area&timestamp=12345');
      (client as any).generateCacheKey = mockGenerateCacheKey;

      mockGetCachedResponse.mockReturnValue(null);
      mockMakeRequest.mockResolvedValue({
        data: { traffic_level: 'moderate' },
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      await client.getCurrentTraffic(testArea);

      expect(mockGenerateCacheKey).toHaveBeenCalledWith('traffic', expect.objectContaining({
        areaId: testArea.id,
        timestamp: expect.any(Number),
      }));
    });

    it('should generate consistent cache keys for route requests', async () => {
      const mockGenerateCacheKey = jest.fn().mockReturnValue('route_traffic:origin=28.6139,77.2090&destination=28.7041,77.1025');
      (client as any).generateCacheKey = mockGenerateCacheKey;

      const destination: GeoLocation = { latitude: 28.7041, longitude: 77.1025 };

      mockGetCachedResponse.mockReturnValue(null);
      mockMakeRequest.mockResolvedValue({
        data: { routes: [] },
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      await client.getRouteTraffic(testLocation, destination);

      expect(mockGenerateCacheKey).toHaveBeenCalledWith('route_traffic', expect.objectContaining({
        origin: `${testLocation.latitude},${testLocation.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        timestamp: expect.any(Number),
      }));
    });
  });

  describe('error scenarios', () => {
    it('should handle malformed Google Maps response', async () => {
      mockGetCachedResponse.mockReturnValue(null);

      const malformedResponse = {
        // Missing expected fields
        some_other_field: 'value',
      };

      mockMakeRequest.mockResolvedValue({
        data: malformedResponse,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const result = await client.getCurrentTraffic(testArea);

      expect(result.success).toBe(true);
      expect(result.data.averageSpeed).toBe(25); // Default value
      expect(result.data.congestionLevel).toBe('moderate'); // Default value
    });

    it('should handle empty routes response', async () => {
      mockGetCachedResponse.mockReturnValue(null);

      const emptyRoutesResponse = {
        routes: null, // Null routes
      };

      mockMakeRequest.mockResolvedValue({
        data: emptyRoutesResponse,
        success: true,
        timestamp: new Date(),
        source: 'google_maps',
        cached: false,
      });

      const destination: GeoLocation = { latitude: 28.7041, longitude: 77.1025 };
      const result = await client.getRouteTraffic(testLocation, destination);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Should create default segment
      expect(result.data[0]?.area.id).toBe('route_default');
    });
  });
});