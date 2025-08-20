import { GraphHopperNavigationClient, GraphHopperConfig } from '../GraphHopperNavigationClient';
import { GeoLocation, Route } from '../../../models';

// Mock axios
jest.mock('axios');

describe('GraphHopperNavigationClient', () => {
  let client: GraphHopperNavigationClient;
  let mockConfig: GraphHopperConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://graphhopper.com/api/1',
      timeout: 5000
    };
    client = new GraphHopperNavigationClient(mockConfig);
  });

  describe('getNavigationDirections', () => {
    it('should fetch navigation directions from GraphHopper API', async () => {
      const mockResponse = {
        data: {
          paths: [{
            distance: 15000,
            time: 1800000, // 30 minutes in ms
            points: {
              coordinates: [[77.2090, 28.6139], [77.2100, 28.6149], [77.2110, 28.6159]],
              type: 'LineString'
            },
            instructions: [
              {
                distance: 500,
                time: 60000,
                text: 'Head north on Connaught Place',
                sign: 0,
                interval: [0, 1],
                points: [[77.2090, 28.6139], [77.2095, 28.6144]]
              },
              {
                distance: 1000,
                time: 120000,
                text: 'Turn right on Janpath',
                sign: 2,
                interval: [1, 2],
                points: [[77.2095, 28.6144], [77.2100, 28.6149]]
              }
            ],
            legs: []
          }],
          info: {
            copyrights: ['GraphHopper'],
            took: 50
          }
        }
      };

      // Mock the makeRequest method
      const mockMakeRequest = jest.fn().mockResolvedValue({
        data: mockResponse.data,
        success: true,
        timestamp: new Date(),
        source: 'GraphHopperNavigationClient',
        cached: false
      });
      (client as any).makeRequest = mockMakeRequest;

      const coordinates: Array<[number, number]> = [[77.2090, 28.6139], [77.2110, 28.6159]];
      const result = await client.getNavigationDirections(coordinates);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        expect.stringContaining('/route?')
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle traffic-aware routing options', async () => {
      const mockResponse = {
        data: {
          paths: [{
            distance: 15000,
            time: 1800000,
            points: { coordinates: [], type: 'LineString' },
            instructions: [],
            legs: []
          }],
          info: { copyrights: [], took: 50 }
        }
      };

      const mockMakeRequest = jest.fn().mockResolvedValue({
        data: mockResponse.data,
        success: true,
        timestamp: new Date(),
        source: 'GraphHopperNavigationClient',
        cached: false
      });
      (client as any).makeRequest = mockMakeRequest;

      const coordinates: Array<[number, number]> = [[77.2090, 28.6139], [77.2110, 28.6159]];
      const departureTime = new Date('2024-01-15T08:00:00Z');
      
      await client.getNavigationDirections(coordinates, {
        avoidTolls: true,
        avoidHighways: true,
        avoidFerries: false,
        considerTraffic: true,
        departureTime
      });

      expect(mockMakeRequest).toHaveBeenCalledWith(
        expect.stringContaining('/route?')
      );
    });
  });

  describe('convertToNavigationData', () => {
    it('should convert GraphHopper response to navigation data format', () => {
      const mockGraphHopperResponse = {
        paths: [{
          distance: 15000,
          time: 1800000,
          points: {
            coordinates: [[77.2090, 28.6139], [77.2100, 28.6149]],
            type: 'LineString' as const
          },
          instructions: [
            {
              distance: 500,
              time: 60000,
              text: 'Head north on Connaught Place',
              sign: 0,
              interval: [0, 1] as [number, number],
              points: [[77.2090, 28.6139]]
            },
            {
              distance: 1000,
              time: 120000,
              text: 'Turn right on Janpath',
              sign: 2,
              interval: [1, 2] as [number, number],
              points: [[77.2100, 28.6149]]
            }
          ],
          legs: []
        }],
        info: {
          copyrights: ['GraphHopper'],
          took: 50
        }
      };

      const result = client.convertToNavigationData('test-route', mockGraphHopperResponse, true);

      expect(result.routeId).toBe('test-route');
      expect(result.totalDistance).toBe(15000);
      expect(result.totalTime).toBe(1800); // Converted from ms to seconds
      expect(result.trafficAware).toBe(true);
      expect(result.instructions).toHaveLength(2);
      
      expect(result.instructions[0]).toEqual({
        id: 'test-route_instruction_0',
        sequence: 1,
        instruction: 'Head north on Connaught Place',
        distance: 500,
        time: 60,
        maneuver: 'continue',
        coordinates: [77.2090, 28.6139],
        streetName: 'Connaught Place'
      });

      expect(result.instructions[1]).toEqual({
        id: 'test-route_instruction_1',
        sequence: 2,
        instruction: 'Turn right on Janpath',
        distance: 1000,
        time: 120,
        maneuver: 'right',
        coordinates: [77.2100, 28.6149],
        streetName: 'Janpath'
      });
    });

    it('should handle empty GraphHopper response', () => {
      const emptyResponse = {
        paths: [],
        info: { copyrights: [], took: 0 }
      };

      expect(() => {
        client.convertToNavigationData('test-route', emptyResponse);
      }).toThrow('No routes found in GraphHopper response');
    });
  });

  describe('getTrafficAwareRouting', () => {
    it('should compare normal and traffic-optimized routes', async () => {
      const mockNormalResponse = {
        data: {
          paths: [{
            distance: 20000,
            time: 2400000, // 40 minutes
            points: { coordinates: [], type: 'LineString' },
            instructions: [],
            legs: []
          }],
          info: { copyrights: [], took: 50 }
        }
      };

      const mockTrafficResponse = {
        data: {
          paths: [{
            distance: 18000,
            time: 1800000, // 30 minutes
            points: { coordinates: [], type: 'LineString' },
            instructions: [],
            legs: []
          }],
          info: { copyrights: [], took: 50 }
        }
      };

      const mockMakeRequest = jest.fn()
        .mockResolvedValueOnce({
          data: mockNormalResponse.data,
          success: true,
          timestamp: new Date(),
          source: 'GraphHopperNavigationClient',
          cached: false
        })
        .mockResolvedValueOnce({
          data: mockTrafficResponse.data,
          success: true,
          timestamp: new Date(),
          source: 'GraphHopperNavigationClient',
          cached: false
        });
      (client as any).makeRequest = mockMakeRequest;

      const origin: GeoLocation = { latitude: 28.6139, longitude: 77.2090 };
      const destination: GeoLocation = { latitude: 28.6159, longitude: 77.2110 };

      const result = await client.getTrafficAwareRouting(origin, destination);

      expect(result.normalRoute.totalDistance).toBe(20000);
      expect(result.normalRoute.totalTime).toBe(2400);
      expect(result.trafficOptimizedRoute.totalDistance).toBe(18000);
      expect(result.trafficOptimizedRoute.totalTime).toBe(1800);
      
      expect(result.trafficSavings.timeSavedMinutes).toBe(10); // (2400-1800)/60
      expect(result.trafficSavings.distanceDifference).toBe(2000);
      expect(result.trafficSavings.fuelSavings).toBe(200); // 2000 * 0.1
    });
  });

  describe('integrateWithORToolsRoute', () => {
    it('should enhance route with navigation instructions', () => {
      const mockRoute: Route = {
        id: 'test-route',
        vehicleId: 'vehicle-1',
        stops: [
          {
            id: 'stop-1',
            sequence: 1,
            location: { latitude: 28.6139, longitude: 77.2090 },
            type: 'pickup',
            estimatedArrivalTime: new Date(),
            estimatedDepartureTime: new Date(),
            duration: 10,
            status: 'pending'
          },
          {
            id: 'stop-2',
            sequence: 2,
            location: { latitude: 28.6149, longitude: 77.2100 },
            type: 'delivery',
            estimatedArrivalTime: new Date(),
            estimatedDepartureTime: new Date(),
            duration: 15,
            status: 'pending'
          }
        ],
        estimatedDuration: 30,
        estimatedDistance: 5,
        estimatedFuelConsumption: 0.5,
        trafficFactors: [],
        status: 'planned'
      };

      const mockNavigationData = {
        routeId: 'nav-route',
        totalDistance: 8000, // 8 km
        totalTime: 1200, // 20 minutes
        instructions: [
          {
            id: 'inst-1',
            sequence: 1,
            instruction: 'Head north',
            distance: 500,
            time: 60,
            maneuver: 'continue',
            coordinates: [77.2090, 28.6139] as [number, number]
          },
          {
            id: 'inst-2',
            sequence: 2,
            instruction: 'Turn right',
            distance: 1000,
            time: 120,
            maneuver: 'right',
            coordinates: [77.2100, 28.6149] as [number, number]
          }
        ],
        trafficAware: true,
        alternativeRoutes: []
      };

      const result = client.integrateWithORToolsRoute(mockRoute, mockNavigationData);

      expect(result.estimatedDistance).toBe(8); // Converted from meters to km
      expect(result.estimatedDuration).toBe(20); // Converted from seconds to minutes
      expect(result.stops[0]?.instructions).toBeDefined();
      expect(result.stops[1]?.instructions).toBeDefined();
    });
  });

  describe('generateDelhiNavigationScenarios', () => {
    it('should generate Delhi-specific navigation scenarios', async () => {
      const mockResponse = {
        data: {
          paths: [{
            distance: 25000,
            time: 3000000,
            points: { coordinates: [], type: 'LineString' },
            instructions: [],
            legs: []
          }],
          info: { copyrights: [], took: 50 }
        }
      };

      const mockMakeRequest = jest.fn().mockResolvedValue({
        data: mockResponse.data,
        success: true,
        timestamp: new Date(),
        source: 'GraphHopperNavigationClient',
        cached: false
      });
      (client as any).makeRequest = mockMakeRequest;

      const result = await client.generateDelhiNavigationScenarios();

      expect(result.peakHourNavigation).toBeDefined();
      expect(result.offPeakNavigation).toBeDefined();
      expect(result.monsoonNavigation).toBeDefined();
      expect(result.pollutionAlertNavigation).toBeDefined();

      expect(result.peakHourNavigation.routeId).toBe('peak_hour');
      expect(result.offPeakNavigation.routeId).toBe('off_peak');
      expect(result.monsoonNavigation.routeId).toBe('monsoon');
      expect(result.pollutionAlertNavigation.routeId).toBe('pollution_alert');

      // Verify API was called 4 times for different scenarios
      expect(mockMakeRequest).toHaveBeenCalledTimes(4);
    });
  });
});