import { MapVisualizationService, MapVisualizationConfig } from '../MapVisualizationService';
import { Route, GeoLocation } from '../../models';

// Mock the external clients
jest.mock('../external/MapboxVisualizationClient');
jest.mock('../external/GraphHopperNavigationClient');

describe('MapVisualizationService Integration', () => {
  let service: MapVisualizationService;
  let mockConfig: MapVisualizationConfig;

  beforeEach(() => {
    mockConfig = {
      mapbox: {
        accessToken: 'test-mapbox-token',
        baseUrl: 'https://api.mapbox.com',
        timeout: 5000
      },
      graphHopper: {
        apiKey: 'test-graphhopper-key',
        baseUrl: 'https://graphhopper.com/api/1',
        timeout: 10000
      },
      defaultCenter: [77.2090, 28.6139],
      defaultZoom: 11
    };

    service = new MapVisualizationService(mockConfig);
  });

  describe('enhanceRoutesWithNavigation', () => {
    it('should enhance routes with GraphHopper navigation data', async () => {
      const mockRoutes: Route[] = [
        {
          id: 'route-1',
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
        }
      ];

      // Mock GraphHopper client methods
      const mockGraphHopperResponse = {
        paths: [{
          distance: 8000,
          time: 1200000,
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
            }
          ],
          legs: []
        }],
        info: {
          copyrights: ['GraphHopper'],
          took: 50
        }
      };

      const mockNavigationData = {
        routeId: 'route-1',
        totalDistance: 8000,
        totalTime: 1200,
        instructions: [
          {
            id: 'route-1_instruction_0',
            sequence: 1,
            instruction: 'Head north on Connaught Place',
            distance: 500,
            time: 60,
            maneuver: 'continue',
            coordinates: [77.2090, 28.6139] as [number, number],
            streetName: 'Connaught Place'
          }
        ],
        trafficAware: true,
        alternativeRoutes: []
      };

      // Mock the GraphHopper client methods
      const mockGetNavigationDirections = jest.fn().mockResolvedValue(mockGraphHopperResponse);
      const mockConvertToNavigationData = jest.fn().mockReturnValue(mockNavigationData);
      const mockIntegrateWithORToolsRoute = jest.fn().mockImplementation((route, navData) => ({
        ...route,
        estimatedDistance: navData.totalDistance / 1000,
        estimatedDuration: navData.totalTime / 60
      }));

      (service as any).graphHopperClient = {
        getNavigationDirections: mockGetNavigationDirections,
        convertToNavigationData: mockConvertToNavigationData,
        integrateWithORToolsRoute: mockIntegrateWithORToolsRoute
      };

      const enhancedRoutes = await service.enhanceRoutesWithNavigation(mockRoutes);

      expect(enhancedRoutes).toHaveLength(1);
      expect(enhancedRoutes[0]).toHaveProperty('navigationData');
      expect(enhancedRoutes[0]?.navigationData).toEqual(mockNavigationData);
      expect(enhancedRoutes[0]?.estimatedDistance).toBe(8); // 8000m converted to km
      expect(enhancedRoutes[0]?.estimatedDuration).toBe(20); // 1200s converted to minutes

      expect(mockGetNavigationDirections).toHaveBeenCalledWith(
        [[77.2090, 28.6139], [77.2100, 28.6149]],
        {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false,
          considerTraffic: true
        }
      );

      expect(mockConvertToNavigationData).toHaveBeenCalledWith(
        'route-1',
        mockGraphHopperResponse,
        true
      );

      expect(mockIntegrateWithORToolsRoute).toHaveBeenCalledWith(
        mockRoutes[0],
        mockNavigationData
      );
    });

    it('should handle routes with insufficient stops', async () => {
      const mockRoutes: Route[] = [
        {
          id: 'route-1',
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
            }
          ],
          estimatedDuration: 30,
          estimatedDistance: 5,
          estimatedFuelConsumption: 0.5,
          trafficFactors: [],
          status: 'planned'
        }
      ];

      const enhancedRoutes = await service.enhanceRoutesWithNavigation(mockRoutes);

      expect(enhancedRoutes).toHaveLength(1);
      expect(enhancedRoutes[0]).toEqual(mockRoutes[0]);
      expect(enhancedRoutes[0]).not.toHaveProperty('navigationData');
    });

    it('should handle GraphHopper API errors gracefully', async () => {
      const mockRoutes: Route[] = [
        {
          id: 'route-1',
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
        }
      ];

      // Mock GraphHopper client to throw an error
      const mockGetNavigationDirections = jest.fn().mockRejectedValue(new Error('API Error'));

      (service as any).graphHopperClient = {
        getNavigationDirections: mockGetNavigationDirections,
        convertToNavigationData: jest.fn(),
        integrateWithORToolsRoute: jest.fn()
      };

      // Should not throw, but return original routes
      const enhancedRoutes = await service.enhanceRoutesWithNavigation(mockRoutes);

      expect(enhancedRoutes).toHaveLength(1);
      expect(enhancedRoutes[0]).toEqual(mockRoutes[0]);
      expect(enhancedRoutes[0]).not.toHaveProperty('navigationData');
    });
  });

  describe('generateDelhiNavigationScenarios', () => {
    it('should generate Delhi-specific navigation scenarios', async () => {
      const mockScenarios = {
        peakHourNavigation: {
          routeId: 'peak_hour',
          totalDistance: 25000,
          totalTime: 3600,
          instructions: [],
          trafficAware: true,
          alternativeRoutes: []
        },
        offPeakNavigation: {
          routeId: 'off_peak',
          totalDistance: 22000,
          totalTime: 2400,
          instructions: [],
          trafficAware: true,
          alternativeRoutes: []
        },
        monsoonNavigation: {
          routeId: 'monsoon',
          totalDistance: 27000,
          totalTime: 4200,
          instructions: [],
          trafficAware: true,
          alternativeRoutes: []
        },
        pollutionAlertNavigation: {
          routeId: 'pollution_alert',
          totalDistance: 24000,
          totalTime: 3300,
          instructions: [],
          trafficAware: true,
          alternativeRoutes: []
        }
      };

      const mockGenerateDelhiNavigationScenarios = jest.fn().mockResolvedValue(mockScenarios);

      (service as any).graphHopperClient = {
        generateDelhiNavigationScenarios: mockGenerateDelhiNavigationScenarios
      };

      const scenarios = await service.generateDelhiNavigationScenarios();

      expect(scenarios).toEqual(mockScenarios);
      expect(mockGenerateDelhiNavigationScenarios).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTrafficAwareRoutingDemo', () => {
    it('should get traffic-aware routing comparison', async () => {
      const origin: GeoLocation = { latitude: 28.6139, longitude: 77.2090 };
      const destination: GeoLocation = { latitude: 28.4595, longitude: 77.0266 };

      const mockTrafficAwareRouting = {
        normalRoute: {
          routeId: 'normal_route',
          totalDistance: 30000,
          totalTime: 3600,
          instructions: [],
          trafficAware: false,
          alternativeRoutes: []
        },
        trafficOptimizedRoute: {
          routeId: 'traffic_optimized',
          totalDistance: 28000,
          totalTime: 3000,
          instructions: [],
          trafficAware: true,
          alternativeRoutes: []
        },
        trafficSavings: {
          timeSavedMinutes: 10,
          distanceDifference: 2000,
          fuelSavings: 200
        }
      };

      const mockGetTrafficAwareRouting = jest.fn().mockResolvedValue(mockTrafficAwareRouting);

      (service as any).graphHopperClient = {
        getTrafficAwareRouting: mockGetTrafficAwareRouting
      };

      const result = await service.getTrafficAwareRoutingDemo(origin, destination);

      expect(result).toEqual(mockTrafficAwareRouting);
      expect(mockGetTrafficAwareRouting).toHaveBeenCalledWith(origin, destination);
    });
  });
});