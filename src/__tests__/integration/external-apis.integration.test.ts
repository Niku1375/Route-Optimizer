import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { TrafficPredictionService } from '../../services/TrafficPredictionService';
import { MapVisualizationService } from '../../services/MapVisualizationService';
import { RedisService } from '../../cache/RedisService';
import { GeoArea, TrafficData } from '../../models/Traffic';
import { GeoLocation } from '../../models/GeoLocation';
import axios from 'axios';

// Mock axios for external API calls
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * External API Integration Test Suite
 * 
 * Tests integration with all external APIs including fallback mechanisms
 * Validates API response handling and error scenarios
 * Ensures graceful degradation when APIs are unavailable
 * 
 * Requirements Coverage: 4.1, 4.3, 7.1-7.4 (External API Integration)
 */
describe('External API Integration Tests', () => {
  let trafficPredictionService: TrafficPredictionService;
  let mapVisualizationService: MapVisualizationService;
  let redisService: RedisService;

  // Test data
  const testArea: GeoArea = {
    bounds: {
      north: 28.8,
      south: 28.4,
      east: 77.4,
      west: 77.0
    }
  };

  const testLocation: GeoLocation = {
    latitude: 28.6139,
    longitude: 77.2090
  };

  beforeAll(async () => {
    redisService = new RedisService();
    await redisService.connect();
    
    trafficPredictionService = new TrafficPredictionService(redisService);
    mapVisualizationService = new MapVisualizationService();
  });

  afterAll(async () => {
    await redisService.disconnect();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clear cache after each test
    await redisService.flushAll();
  });

  describe('Google Maps Traffic API Integration', () => {
    it('should fetch current traffic data successfully', async () => {
      // Mock successful Google Maps API response
      const mockTrafficResponse = {
        data: {
          routes: [{
            legs: [{
              duration: { value: 1800, text: '30 mins' },
              duration_in_traffic: { value: 2400, text: '40 mins' },
              distance: { value: 15000, text: '15 km' }
            }]
          }],
          status: 'OK'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTrafficResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBeDefined();
      expect(trafficData.averageSpeed).toBeGreaterThan(0);
      expect(trafficData.timestamp).toBeInstanceOf(Date);
      
      // Verify API was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('maps.googleapis.com'),
        expect.objectContaining({
          params: expect.objectContaining({
            origin: expect.any(String),
            destination: expect.any(String),
            departure_time: 'now'
          })
        })
      );
    });

    it('should handle Google Maps API rate limiting', async () => {
      // Mock rate limit response
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { error_message: 'You have exceeded your rate-limit for this API.' }
        }
      });

      // Should use cached data as fallback
      const cachedData: TrafficData = {
        area: testArea,
        congestionLevel: 'moderate',
        averageSpeed: 25,
        incidents: [],
        timestamp: new Date(Date.now() - 300000), // 5 minutes old
        predictions: []
      };

      await redisService.set(`traffic:${JSON.stringify(testArea)}`, JSON.stringify(cachedData), 3600);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBe('moderate');
      expect(trafficData.averageSpeed).toBe(25);
    });

    it('should predict traffic for future time windows', async () => {
      // Mock historical traffic data response
      const mockHistoricalResponse = {
        data: {
          routes: [{
            legs: [{
              duration: { value: 1500, text: '25 mins' },
              duration_in_traffic: { value: 2100, text: '35 mins' }
            }]
          }]
        }
      };

      mockedAxios.get.mockResolvedValue(mockHistoricalResponse);

      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const forecast = await trafficPredictionService.predictTraffic(testArea, {
        start: futureTime.toISOString().substr(11, 5),
        end: new Date(futureTime.getTime() + 3600000).toISOString().substr(11, 5)
      });

      expect(forecast).toBeDefined();
      expect(forecast.predictions.length).toBeGreaterThan(0);
      expect(forecast.confidence).toBeGreaterThan(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Delhi Traffic Police API Integration', () => {
    it('should fetch real-time traffic incidents', async () => {
      // Mock Delhi Traffic Police API response
      const mockIncidentResponse = {
        data: {
          incidents: [
            {
              id: 'INC001',
              type: 'accident',
              location: { lat: 28.6139, lng: 77.2090 },
              description: 'Minor accident at Connaught Place',
              severity: 'medium',
              timestamp: new Date().toISOString()
            },
            {
              id: 'INC002',
              type: 'construction',
              location: { lat: 28.7041, lng: 77.1025 },
              description: 'Road construction at Karol Bagh',
              severity: 'high',
              timestamp: new Date().toISOString()
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockIncidentResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData.incidents.length).toBeGreaterThan(0);
      expect(trafficData.incidents[0]).toMatchObject({
        id: expect.any(String),
        type: expect.any(String),
        location: expect.objectContaining({
          latitude: expect.any(Number),
          longitude: expect.any(Number)
        }),
        severity: expect.any(String)
      });
    });

    it('should handle Delhi Traffic Police API downtime', async () => {
      // Mock API downtime
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      // Should still return traffic data without incidents
      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.incidents).toEqual([]);
      expect(trafficData.congestionLevel).toBeDefined();
    });
  });

  describe('IMD Weather API Integration', () => {
    it('should fetch weather data affecting traffic', async () => {
      // Mock IMD Weather API response
      const mockWeatherResponse = {
        data: {
          weather: {
            main: 'Rain',
            description: 'heavy intensity rain',
            visibility: 2000
          },
          main: {
            temp: 25,
            humidity: 85
          },
          wind: {
            speed: 15
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockWeatherResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData.weatherImpact).toBeDefined();
      expect(trafficData.weatherImpact.condition).toBe('Rain');
      expect(trafficData.weatherImpact.visibility).toBe(2000);
      expect(trafficData.weatherImpact.trafficImpact).toBeDefined();
    });

    it('should adjust traffic predictions based on weather', async () => {
      // Mock rainy weather
      const mockRainyWeather = {
        data: {
          weather: { main: 'Rain', description: 'heavy rain' },
          visibility: 1000
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockRainyWeather);

      const forecast = await trafficPredictionService.predictTraffic(testArea, {
        start: '14:00',
        end: '16:00'
      });

      // Traffic should be slower due to rain
      expect(forecast.weatherAdjustment).toBeDefined();
      expect(forecast.weatherAdjustment.speedReduction).toBeGreaterThan(0);
    });
  });

  describe('Ambee Air Quality API Integration', () => {
    it('should fetch air quality data for pollution compliance', async () => {
      // Mock Ambee Air Quality API response
      const mockAirQualityResponse = {
        data: {
          records: [{
            station: 'Connaught Place',
            pollutant_id: 'PM2.5',
            pollutant_avg: 85,
            pollutant_max: 120,
            pollutant_min: 65,
            sampling_date: new Date().toISOString()
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockAirQualityResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData.airQuality).toBeDefined();
      expect(trafficData.airQuality.pm25).toBe(85);
      expect(trafficData.airQuality.category).toBeDefined();
      expect(['good', 'moderate', 'poor', 'very_poor', 'severe']).toContain(trafficData.airQuality.category);
    });

    it('should trigger pollution alerts for severe air quality', async () => {
      // Mock severe air quality
      const mockSevereAirQuality = {
        data: {
          records: [{
            pollutant_id: 'PM2.5',
            pollutant_avg: 350, // Severe level
            sampling_date: new Date().toISOString()
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockSevereAirQuality);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData.airQuality.category).toBe('severe');
      expect(trafficData.pollutionAlert).toBe(true);
      expect(trafficData.vehicleRestrictions).toContain('diesel_ban');
    });
  });

  describe('Mapbox API Integration', () => {
    it('should generate route visualization data', async () => {
      // Mock Mapbox Directions API response
      const mockDirectionsResponse = {
        data: {
          routes: [{
            geometry: 'encoded_polyline_string',
            duration: 1800,
            distance: 15000,
            legs: [{
              steps: [
                {
                  geometry: 'step_polyline',
                  maneuver: {
                    instruction: 'Head north on Parliament Street',
                    type: 'depart'
                  },
                  duration: 300,
                  distance: 1000
                }
              ]
            }]
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockDirectionsResponse);

      const routeVisualization = await mapVisualizationService.generateRouteVisualization({
        origin: testLocation,
        destination: { latitude: 28.7041, longitude: 77.1025 },
        waypoints: []
      });

      expect(routeVisualization).toBeDefined();
      expect(routeVisualization.polyline).toBeDefined();
      expect(routeVisualization.duration).toBe(1800);
      expect(routeVisualization.distance).toBe(15000);
      expect(routeVisualization.steps.length).toBeGreaterThan(0);
    });

    it('should handle Mapbox API quota exceeded', async () => {
      // Mock quota exceeded response
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      });

      // Should use fallback route generation
      const routeVisualization = await mapVisualizationService.generateRouteVisualization({
        origin: testLocation,
        destination: { latitude: 28.7041, longitude: 77.1025 },
        waypoints: []
      });

      expect(routeVisualization).toBeDefined();
      expect(routeVisualization.fallbackUsed).toBe(true);
      expect(routeVisualization.polyline).toBeDefined(); // Should have basic straight-line route
    });
  });

  describe('GraphHopper API Integration', () => {
    it('should fetch turn-by-turn navigation data', async () => {
      // Mock GraphHopper API response
      const mockNavigationResponse = {
        data: {
          paths: [{
            instructions: [
              {
                text: 'Continue onto Parliament Street',
                distance: 500,
                time: 120000,
                sign: 0
              },
              {
                text: 'Turn right onto Janpath',
                distance: 800,
                time: 180000,
                sign: 2
              }
            ],
            points: 'encoded_polyline',
            distance: 15000,
            time: 1800000
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockNavigationResponse);

      const navigationData = await mapVisualizationService.getNavigationInstructions({
        origin: testLocation,
        destination: { latitude: 28.7041, longitude: 77.1025 }
      });

      expect(navigationData).toBeDefined();
      expect(navigationData.instructions.length).toBeGreaterThan(0);
      expect(navigationData.instructions[0]).toMatchObject({
        text: expect.any(String),
        distance: expect.any(Number),
        duration: expect.any(Number)
      });
    });

    it('should provide traffic-aware routing', async () => {
      // Mock traffic-aware routing response
      const mockTrafficAwareResponse = {
        data: {
          paths: [{
            instructions: [],
            points: 'traffic_aware_polyline',
            distance: 16500, // Longer due to traffic avoidance
            time: 2100000 // Longer time but faster due to avoiding congestion
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockTrafficAwareResponse);

      const trafficAwareRoute = await mapVisualizationService.getTrafficAwareRoute({
        origin: testLocation,
        destination: { latitude: 28.7041, longitude: 77.1025 },
        departureTime: new Date()
      });

      expect(trafficAwareRoute).toBeDefined();
      expect(trafficAwareRoute.distance).toBeGreaterThan(15000); // Longer distance
      expect(trafficAwareRoute.trafficOptimized).toBe(true);
    });
  });

  describe('API Fallback and Caching Mechanisms', () => {
    it('should use cached data when all APIs are down', async () => {
      // Mock all APIs failing
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      // Set up cached data
      const cachedTrafficData: TrafficData = {
        area: testArea,
        congestionLevel: 'light',
        averageSpeed: 35,
        incidents: [],
        timestamp: new Date(Date.now() - 600000), // 10 minutes old
        predictions: []
      };

      await redisService.set(
        `traffic:${JSON.stringify(testArea)}`,
        JSON.stringify(cachedTrafficData),
        3600
      );

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBe('light');
      expect(trafficData.averageSpeed).toBe(35);
      expect(trafficData.cached).toBe(true);
      expect(trafficData.staleness).toBeGreaterThan(0);
    });

    it('should refresh stale cached data', async () => {
      // Set up very old cached data
      const staleCachedData: TrafficData = {
        area: testArea,
        congestionLevel: 'heavy',
        averageSpeed: 15,
        incidents: [],
        timestamp: new Date(Date.now() - 3600000), // 1 hour old
        predictions: []
      };

      await redisService.set(
        `traffic:stale:${JSON.stringify(testArea)}`,
        JSON.stringify(staleCachedData),
        3600
      );

      // Mock fresh API response
      const mockFreshResponse = {
        data: {
          routes: [{
            legs: [{
              duration: { value: 1200, text: '20 mins' },
              duration_in_traffic: { value: 1500, text: '25 mins' }
            }]
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockFreshResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData.cached).toBeFalsy();
      expect(trafficData.timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Fresh data
    });

    it('should handle partial API failures gracefully', async () => {
      // Mock Google Maps success but Delhi Traffic Police failure
      const mockTrafficResponse = {
        data: {
          routes: [{
            legs: [{
              duration: { value: 1800, text: '30 mins' },
              duration_in_traffic: { value: 2400, text: '40 mins' }
            }]
          }]
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockTrafficResponse) // Google Maps success
        .mockRejectedValueOnce(new Error('Delhi Traffic Police API down')); // DTP failure

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBeDefined();
      expect(trafficData.incidents).toEqual([]); // No incidents due to API failure
      expect(trafficData.partialData).toBe(true);
    });
  });

  describe('API Performance and Rate Limiting', () => {
    it('should respect API rate limits', async () => {
      const requests = Array.from({ length: 5 }, () => 
        trafficPredictionService.getCurrentTraffic(testArea)
      );

      // Mock rate limiting after 3 requests
      mockedAxios.get
        .mockResolvedValueOnce({ data: { routes: [{ legs: [{ duration: { value: 1800 } }] }] } })
        .mockResolvedValueOnce({ data: { routes: [{ legs: [{ duration: { value: 1800 } }] }] } })
        .mockResolvedValueOnce({ data: { routes: [{ legs: [{ duration: { value: 1800 } }] }] } })
        .mockRejectedValueOnce({ response: { status: 429 } })
        .mockRejectedValueOnce({ response: { status: 429 } });

      const results = await Promise.allSettled(requests);

      // First 3 should succeed, last 2 should use fallback
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBe(5); // All should complete (using fallback for rate-limited ones)
    });

    it('should batch API requests efficiently', async () => {
      const multipleAreas = Array.from({ length: 10 }, (_, i) => ({
        bounds: {
          north: 28.8 + (i * 0.01),
          south: 28.4 + (i * 0.01),
          east: 77.4 + (i * 0.01),
          west: 77.0 + (i * 0.01)
        }
      }));

      // Mock successful responses
      mockedAxios.get.mockResolvedValue({
        data: { routes: [{ legs: [{ duration: { value: 1800 } }] }] }
      });

      const startTime = Date.now();
      const results = await Promise.all(
        multipleAreas.map(area => trafficPredictionService.getCurrentTraffic(area))
      );
      const endTime = Date.now();

      expect(results.length).toBe(10);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Should have made efficient use of API calls (batching or caching)
      expect(mockedAxios.get).toHaveBeenCalledTimes(10);
    });
  });

  describe('API Response Validation', () => {
    it('should validate and sanitize API responses', async () => {
      // Mock malformed API response
      const mockMalformedResponse = {
        data: {
          routes: [{
            legs: [{
              duration: { value: 'invalid_number' }, // Invalid data
              duration_in_traffic: { value: 2400 }
            }]
          }]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockMalformedResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBeDefined();
      expect(trafficData.averageSpeed).toBeGreaterThan(0); // Should have fallback value
      expect(trafficData.dataQuality).toBe('degraded');
    });

    it('should handle unexpected API response formats', async () => {
      // Mock completely unexpected response
      const mockUnexpectedResponse = {
        data: {
          unexpected_field: 'unexpected_value',
          missing_routes: true
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockUnexpectedResponse);

      const trafficData = await trafficPredictionService.getCurrentTraffic(testArea);

      expect(trafficData).toBeDefined();
      expect(trafficData.congestionLevel).toBeDefined();
      expect(trafficData.fallbackUsed).toBe(true);
    });
  });
});