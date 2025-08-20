import { MapVisualizationService, MapVisualizationConfig } from '../MapVisualizationService';
import { MapboxVisualizationClient } from '../external/MapboxVisualizationClient';
import { Route, Vehicle, Hub } from '../../models';

// Mock the MapboxVisualizationClient
jest.mock('../external/MapboxVisualizationClient');

describe('MapVisualizationService', () => {
  let service: MapVisualizationService;
  let mockMapboxClient: jest.Mocked<MapboxVisualizationClient>;
  let mockConfig: MapVisualizationConfig;

  beforeEach(() => {
    mockConfig = {
      mapbox: {
        accessToken: 'test-token',
        baseUrl: 'https://api.mapbox.com',
        timeout: 5000
      },
      defaultCenter: [77.2090, 28.6139],
      defaultZoom: 11
    };

    // Create mock instance
    mockMapboxClient = {
      convertRouteToVisualization: jest.fn(),
      createVehicleTrackingData: jest.fn(),
      generateDemoScenario: jest.fn(),
      calculateMapBounds: jest.fn(),
      getRouteDirections: jest.fn()
    } as any;

    // Mock the constructor
    (MapboxVisualizationClient as jest.MockedClass<typeof MapboxVisualizationClient>).mockImplementation(() => mockMapboxClient);

    service = new MapVisualizationService(mockConfig);
  });

  describe('createInteractiveMapData', () => {
    it('should create interactive map data from routes, vehicles, and hubs', async () => {
      const mockRoutes: Route[] = [{
        id: 'route-1',
        vehicleId: 'vehicle-1',
        stops: [
          {
            id: 'stop-1',
            location: { latitude: 28.6139, longitude: 77.2090 },
            type: 'pickup',
            estimatedArrival: new Date(),
            estimatedDepartureTime: new Date()
          }
        ],
        estimatedDuration: 1800,
        estimatedDistance: 5000,
        estimatedFuelConsumption: 2.5,
        trafficFactors: [],
        status: 'planned'
      }];

      const mockVehicles: Vehicle[] = [{
        id: 'vehicle-1',
        type: 'truck',
        subType: 'heavy-truck',
        capacity: { weight: 5000, volume: 20, maxDimensions: { length: 6, width: 2.5, height: 3 } },
        location: { latitude: 28.6139, longitude: 77.2090 },
        status: 'available',
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
      }];

      const mockHubs: Hub[] = [{
        id: 'hub-1',
        name: 'Central Hub',
        location: { latitude: 28.6139, longitude: 77.2090 },
        capacity: { maxVehicles: 50, currentVehicles: 10, storageArea: 1000, loadingBays: 5, bufferVehicleSlots: 8 },
        bufferVehicles: [],
        operatingHours: { open: '06:00', close: '22:00' , timezone: "Asia/Kolkata" },
        facilities: ['loading_dock', 'fuel_station']
      }];

      // Setup mocks
      mockMapboxClient.convertRouteToVisualization.mockResolvedValue({
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        coordinates: [[77.2090, 28.6139], [77.2100, 28.6149]],
        waypoints: [{ location: [77.2090, 28.6139], name: 'Start', type: 'pickup' }],
        distance: 5000,
        duration: 1800,
        trafficLevel: 'low'
      });

      mockMapboxClient.createVehicleTrackingData.mockReturnValue({
        vehicleId: 'vehicle-1',
        currentLocation: [77.2090, 28.6139],
        heading: 45,
        speed: 40,
        status: 'stopped',
        routeProgress: 0,
        estimatedArrival: new Date()
      });

      mockMapboxClient.calculateMapBounds.mockReturnValue({
        southwest: [77.2080, 28.6129],
        northeast: [77.2110, 28.6159]
      });

      const result = await service.createInteractiveMapData(mockRoutes, mockVehicles, mockHubs);

      expect(result.routes).toHaveLength(1);
      expect(result.vehicles).toHaveLength(1);
      expect(result.hubs).toHaveLength(1);
      expect(result.bounds).toBeDefined();

      expect(mockMapboxClient.convertRouteToVisualization).toHaveBeenCalledWith(mockRoutes[0]);
      expect(mockMapboxClient.createVehicleTrackingData).toHaveBeenCalled();
      expect(mockMapboxClient.calculateMapBounds).toHaveBeenCalled();
    });

    it('should handle empty input arrays', async () => {
      mockMapboxClient.calculateMapBounds.mockReturnValue({
        southwest: [76.8, 28.4],
        northeast: [77.6, 28.9]
      });

      const result = await service.createInteractiveMapData([], [], []);

      expect(result.routes).toHaveLength(0);
      expect(result.vehicles).toHaveLength(0);
      expect(result.hubs).toHaveLength(0);
      expect(result.bounds).toBeDefined();
    });
  });

  describe('generateDemoScenario', () => {
    it('should generate demo scenario with default options', async () => {
      const mockScenario = {
        name: 'Test Scenario',
        description: 'Test description',
        vehicles: [{ id: 'v1', type: 'truck', location: [77.2090, 28.6139] as [number, number], status: 'available' }],
        hubs: [{ id: 'h1', location: [77.2090, 28.6139] as [number, number], capacity: 50, bufferVehicles: 5 }],
        routes: [],
        bounds: {
          southwest: [77.2080, 28.6129] as [number, number],
          northeast: [77.2110, 28.6159] as [number, number]
        }
      };

      mockMapboxClient.generateDemoScenario.mockResolvedValue(mockScenario);

      const result = await service.generateDemoScenario({
        scenarioType: 'delhi_compliance'
      });

      expect(result).toEqual(mockScenario);
      expect(mockMapboxClient.generateDemoScenario).toHaveBeenCalledWith(
        'delhi_compliance',
        [77.2090, 28.6139]
      );
    });

    it('should enhance scenario with additional vehicles when requested', async () => {
      const mockScenario = {
        name: 'Test Scenario',
        description: 'Test description',
        vehicles: [{ id: 'v1', type: 'truck', location: [77.2090, 28.6139] as [number, number], status: 'available' }],
        hubs: [{ id: 'h1', location: [77.2090, 28.6139] as [number, number], capacity: 50, bufferVehicles: 5 }],
        routes: [],
        bounds: {
          southwest: [77.2080, 28.6129] as [number, number],
          northeast: [77.2110, 28.6159] as [number, number]
        }
      };

      mockMapboxClient.generateDemoScenario.mockResolvedValue(mockScenario);

      const result = await service.generateDemoScenario({
        scenarioType: 'hub_spoke',
        vehicleCount: 5,
        hubCount: 3
      });

      // Should have additional vehicles and hubs
      expect(result.vehicles.length).toBeGreaterThan(1);
      expect(result.hubs.length).toBeGreaterThan(1);
    });
  });

  describe('createRouteAnimation', () => {
    it('should create animation frames for route visualization', async () => {
      const mockRoutes: Route[] = [{
        id: 'route-1',
        vehicleId: 'vehicle-1',
        stops: [
          {
            id: 'stop-1',
            location: { latitude: 28.6139, longitude: 77.2090 },
            type: 'pickup',
            estimatedArrival: new Date(),
            estimatedDepartureTime: new Date()
          },
          {
            id: 'stop-2',
            location: { latitude: 28.6149, longitude: 77.2100 },
            type: 'delivery',
            estimatedArrival: new Date(Date.now() + 1800000),
            estimatedDepartureTime: new Date(Date.now() + 1800000)
          }
        ],
        estimatedDuration: 1800,
        estimatedDistance: 5000,
        estimatedFuelConsumption: 2.5,
        trafficFactors: [],
        status: 'active'
      }];

      const mockVehicles: Vehicle[] = [{
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
      }];

      mockMapboxClient.createVehicleTrackingData.mockReturnValue({
        vehicleId: 'vehicle-1',
        currentLocation: [77.2090, 28.6139],
        heading: 45,
        speed: 40,
        status: 'moving',
        routeProgress: 0.5,
        estimatedArrival: new Date()
      });

      const result = await service.createRouteAnimation(mockRoutes, mockVehicles, 10, 2);

      expect(result).toHaveLength(20); // 10 seconds * 2 fps
      expect(result[0].timestamp).toBe(0);
      expect(result[0].vehiclePositions.has('vehicle-1')).toBe(true);
      expect(result[0].routeProgress.has('route-1')).toBe(true);
    });
  });

  describe('visualizeRouteOptimization', () => {
    it('should create optimization visualization data', async () => {
      const beforeRoutes: Route[] = [{
        id: 'route-1',
        vehicleId: 'vehicle-1',
        stops: [],
        estimatedDuration: 3600,
        estimatedDistance: 10000,
        estimatedFuelConsumption: 5.0,
        trafficFactors: [],
        status: 'planned'
      }];

      const afterRoutes: Route[] = [{
        id: 'route-1-optimized',
        vehicleId: 'vehicle-1',
        stops: [],
        estimatedDuration: 2700,
        estimatedDistance: 8000,
        estimatedFuelConsumption: 4.0,
        trafficFactors: [],
        status: 'planned'
      }];

      mockMapboxClient.convertRouteToVisualization.mockResolvedValue({
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        coordinates: [[77.2090, 28.6139]],
        waypoints: [],
        distance: 8000,
        duration: 2700,
        trafficLevel: 'low'
      });

      mockMapboxClient.calculateMapBounds.mockReturnValue({
        southwest: [77.2080, 28.6129],
        northeast: [77.2110, 28.6159]
      });

      const result = await service.visualizeRouteOptimization(beforeRoutes, afterRoutes);

      expect(result.before).toBeDefined();
      expect(result.after).toBeDefined();
      expect(result.summary.totalDistanceReduction).toBe(2000);
      expect(result.summary.timeReduction).toBe(900);
      expect(result.summary.fuelSavings).toBe(1.0);
      expect(result.summary.efficiencyImprovement).toBe(20);
    });
  });

  describe('visualizeHubOperations', () => {
    it('should create hub operations visualization', async () => {
      const mockHub: Hub = {
        id: 'hub-1',
        name: 'Central Hub',
        location: { latitude: 28.6139, longitude: 77.2090 },
        capacity: { maxVehicles: 50, currentVehicles: 10, storageArea: 1000, loadingBays: 5, bufferVehicleSlots: 8 },
        bufferVehicles: [],
        operatingHours: { open: '06:00', close: '22:00' , timezone: "Asia/Kolkata" },
        facilities: ['loading_dock']
      };

      const mockVehicles: Vehicle[] = [{
        id: 'vehicle-1',
        type: 'truck',
        subType: 'heavy-truck',
        capacity: { weight: 5000, volume: 20, maxDimensions: { length: 6, width: 2.5, height: 3 } },
        location: { latitude: 28.6139, longitude: 77.2090 }, // At hub
        status: 'available',
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
      }];

      const mockRoutes: Route[] = [];

      const result = await service.visualizeHubOperations(mockHub, mockVehicles, mockRoutes);

      expect(result.hubData.id).toBe('hub-1');
      expect(result.hubData.currentLoad).toBe(1); // One vehicle at hub
      expect(result.hubData.status).toBe('active');
      expect(result.vehicleFlow).toBeDefined();
      expect(result.loadTransfers).toBeDefined();
      expect(result.bufferAllocation).toBeDefined();
    });
  });
});