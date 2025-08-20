import { MapboxVisualizationClient, MapboxConfig } from '../MapboxVisualizationClient';
import { Route, Vehicle } from '../../../models';

// Mock axios
jest.mock('axios');

describe('MapboxVisualizationClient', () => {
  let client: MapboxVisualizationClient;
  let mockConfig: MapboxConfig;

  beforeEach(() => {
    mockConfig = {
      accessToken: 'test-token',
      baseUrl: 'https://api.mapbox.com',
      timeout: 5000
    };
    client = new MapboxVisualizationClient(mockConfig);
  });

  describe('getRouteDirections', () => {
    it('should fetch route directions from Mapbox API', async () => {
      const mockResponse = {
        data: {
          routes: [{
            geometry: {
              coordinates: [[77.2090, 28.6139], [77.2100, 28.6149]],
              type: 'LineString'
            },
            legs: [],
            distance: 1000,
            duration: 300,
            weight: 300
          }],
          waypoints: [
            { location: [77.2090, 28.6139], name: 'Start' },
            { location: [77.2100, 28.6149], name: 'End' }
          ],
          code: 'Ok'
        }
      };

      // Mock the axios get method
      const mockGet = jest.fn().mockResolvedValue(mockResponse);
      (client as any).client.get = mockGet;

      const coordinates: Array<[number, number]> = [[77.2090, 28.6139], [77.2100, 28.6149]];
      const result = await client.getRouteDirections(coordinates);

      expect(mockGet).toHaveBeenCalledWith(
        '/directions/v5/mapbox/driving-traffic/77.2090,28.6139;77.2100,28.6149',
        {
          params: {
            access_token: 'test-token',
            geometries: 'geojson',
            steps: true,
            overview: 'full',
            annotations: 'duration,distance,speed'
          }
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      const mockGet = jest.fn().mockRejectedValue(mockError);
      (client as any).client.get = mockGet;

      const coordinates: Array<[number, number]> = [[77.2090, 28.6139], [77.2100, 28.6149]];

      await expect(client.getRouteDirections(coordinates)).rejects.toThrow();
    });
  });

  describe('convertRouteToVisualization', () => {
    it('should convert internal Route to visualization format', async () => {
      const mockRoute: Route = {
        id: 'route-1',
        vehicleId: 'vehicle-1',
        stops: [
          {
            id: 'stop-1',
            location: { latitude: 28.6139, longitude: 77.2090 },
            type: 'pickup',
            estimatedArrivalTime: new Date(),
            estimatedDepartureTime: new Date(),
            address: 'Connaught Place'
          },
          {
            id: 'stop-2',
            location: { latitude: 28.6149, longitude: 77.2100 },
            type: 'delivery',
            estimatedArrivalTime: new Date(),
            estimatedDepartureTime: new Date(),
            address: 'Karol Bagh'
          }
        ],
        estimatedDuration: 1800,
        estimatedDistance: 5000,
        estimatedFuelConsumption: 2.5,
        trafficFactors: [],
        status: 'planned'
      };

      const mockDirectionsResponse = {
        routes: [{
          geometry: {
            coordinates: [[77.2090, 28.6139], [77.2095, 28.6144], [77.2100, 28.6149]],
            type: 'LineString'
          },
          legs: [],
          distance: 5000,
          duration: 1800,
          weight: 1800
        }],
        waypoints: [],
        code: 'Ok'
      };

      // Mock the getRouteDirections method
      jest.spyOn(client, 'getRouteDirections').mockResolvedValue(mockDirectionsResponse);

      const result = await client.convertRouteToVisualization(mockRoute);

      expect(result).toEqual({
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        coordinates: [[77.2090, 28.6139], [77.2095, 28.6144], [77.2100, 28.6149]],
        waypoints: [
          {
            location: [77.2090, 28.6139],
            name: 'Connaught Place',
            type: 'pickup'
          },
          {
            location: [77.2100, 28.6149],
            name: 'Karol Bagh',
            type: 'delivery'
          }
        ],
        distance: 5000,
        duration: 1800,
        trafficLevel: 'low'
      });
    });

    it('should handle routes with no Mapbox response', async () => {
      const mockRoute: Route = {
        id: 'route-1',
        vehicleId: 'vehicle-1',
        stops: [],
        estimatedDuration: 0,
        estimatedDistance: 0,
        estimatedFuelConsumption: 0,
        trafficFactors: [],
        status: 'planned'
      };

      const mockDirectionsResponse = {
        routes: [],
        waypoints: [],
        code: 'NoRoute'
      };

      jest.spyOn(client, 'getRouteDirections').mockResolvedValue(mockDirectionsResponse);

      await expect(client.convertRouteToVisualization(mockRoute)).rejects.toThrow('No route found from Mapbox');
    });
  });

  describe('generateDemoScenario', () => {
    it('should generate Delhi compliance demo scenario', async () => {
      const result = await client.generateDemoScenario('delhi_compliance');

      expect(result.name).toBe('Delhi Vehicle Class Compliance');
      expect(result.description).toContain('Delhi-specific restrictions');
      expect(result.vehicles).toHaveLength(3);
      expect(result.hubs).toHaveLength(1);
      expect(result.bounds).toBeDefined();

      // Check vehicle types
      const vehicleTypes = result.vehicles.map(v => v.type);
      expect(vehicleTypes).toContain('truck');
      expect(vehicleTypes).toContain('tempo');
      expect(vehicleTypes).toContain('electric');
    });

    it('should generate hub-spoke demo scenario', async () => {
      const result = await client.generateDemoScenario('hub_spoke');

      expect(result.name).toBe('Hub-and-Spoke Operations');
      expect(result.description).toContain('multi-hub routing');
      expect(result.vehicles).toHaveLength(4);
      expect(result.hubs).toHaveLength(4);

      // Check hub names
      const hubIds = result.hubs.map(h => h.id);
      expect(hubIds).toContain('HUB_NORTH');
      expect(hubIds).toContain('HUB_SOUTH');
      expect(hubIds).toContain('HUB_EAST');
      expect(hubIds).toContain('HUB_WEST');
    });

    it('should generate breakdown recovery demo scenario', async () => {
      const result = await client.generateDemoScenario('breakdown_recovery');

      expect(result.name).toBe('Vehicle Breakdown Recovery');
      expect(result.description).toContain('breakdown and buffer vehicle allocation');
      expect(result.vehicles).toHaveLength(2);
      expect(result.hubs).toHaveLength(1);

      // Check vehicle statuses
      const vehicleStatuses = result.vehicles.map(v => v.status);
      expect(vehicleStatuses).toContain('breakdown');
      expect(vehicleStatuses).toContain('available');
    });

    it('should generate traffic optimization demo scenario', async () => {
      const result = await client.generateDemoScenario('traffic_optimization');

      expect(result.name).toBe('Traffic-Aware Route Optimization');
      expect(result.description).toContain('traffic conditions');
      expect(result.vehicles).toHaveLength(1);
      expect(result.hubs).toHaveLength(1);

      // Check vehicle status
      expect(result.vehicles[0].status).toBe('in-transit');
    });

    it('should throw error for unknown scenario type', async () => {
      await expect(
        client.generateDemoScenario('unknown_scenario' as any)
      ).rejects.toThrow('Unknown scenario type: unknown_scenario');
    });
  });

  describe('createVehicleTrackingData', () => {
    it('should create vehicle tracking data', () => {
      const mockVehicle: Vehicle = {
        id: 'vehicle-1',
        type: 'truck',
        subType: 'heavy-truck',
        capacity: { weight: 5000, volume: 20, maxDimensions: { length: 6, width: 2.5, height: 3 } },
        location: { latitude: 28.6139, longitude: 77.2090 },
        status: 'in-transit',
        compliance: {
          pollutionCertificate: true,
          pollutionLevel: 'BS6',
          permitValid: true,
          oddEvenCompliant: true,
          zoneRestrictions: [],
          timeRestrictions: []
        },
        vehicleSpecs: {
          plateNumber: 'DL01AB1234',
          fuelType: 'diesel',
          vehicleAge: 2,
          registrationState: 'Delhi'
        , manufacturingYear: 2021 },
        accessPrivileges: {
          residentialZones: false,
          commercialZones: true,
          industrialZones: true,
          restrictedHours: false,
          pollutionSensitiveZones: false,
          narrowLanes: false
        },
        driverInfo: {
          id: 'driver-1',
          workingHours: 8,
          maxWorkingHours: 12
        , name: "Test Driver", licenseNumber: "DL123456789", contactNumber: "+91-9876543210" }
      };

      const mockRoute: Route = {
        id: 'route-1',
        vehicleId: 'vehicle-1',
        stops: [
          {
            id: 'stop-1',
            location: { latitude: 28.6139, longitude: 77.2090 },
            type: 'pickup',
            estimatedArrivalTime: new Date(),
            estimatedDepartureTime: new Date(),
            address: 'Start'
          },
          {
            id: 'stop-2',
            location: { latitude: 28.6149, longitude: 77.2100 },
            type: 'delivery',
            estimatedArrivalTime: new Date(Date.now() + 1800000),
            estimatedDepartureTime: new Date(Date.now() + 1800000),
            address: 'End'
          }
        ],
        estimatedDuration: 1800,
        estimatedDistance: 5000,
        estimatedFuelConsumption: 2.5,
        trafficFactors: [],
        status: 'active'
      };

      const result = client.createVehicleTrackingData(mockVehicle, mockRoute, 0.5);

      expect(result.vehicleId).toBe('vehicle-1');
      expect(result.currentLocation).toHaveLength(2);
      expect(result.heading).toBeDefined();
      expect(result.speed).toBe(40); // Expected speed for truck
      expect(result.status).toBe('moving');
      expect(result.routeProgress).toBe(0.5);
      expect(result.estimatedArrival).toBeInstanceOf(Date);
    });
  });

  describe('calculateMapBounds', () => {
    it('should calculate bounds for given locations', () => {
      const locations: Array<[number, number]> = [
        [77.2090, 28.6139],
        [77.2100, 28.6149],
        [77.2080, 28.6129]
      ];

      const result = client.calculateMapBounds(locations);

      expect(result.southwest[0]).toBeLessThan(result.northeast[0]);
      expect(result.southwest[1]).toBeLessThan(result.northeast[1]);
      
      // Check padding is applied
      expect(result.southwest[0]).toBeLessThan(77.2080);
      expect(result.northeast[0]).toBeGreaterThan(77.2100);
    });

    it('should return Delhi bounds for empty locations', () => {
      const result = client.calculateMapBounds([]);

      expect(result.southwest).toEqual([76.8, 28.4]);
      expect(result.northeast).toEqual([77.6, 28.9]);
    });
  });
});