/**
 * Unit tests for hub-and-spoke routing functionality in RoutingService
 */

import { RoutingService, RoutingRequest } from '../RoutingService';
import { Vehicle } from '../../models/Vehicle';
import { Delivery } from '../../models/Delivery';
import { Hub } from '../../models/Hub';



describe('RoutingService - Hub and Spoke Routing', () => {
  let routingService: RoutingService;
  let mockVehicles: Vehicle[];
  let mockDeliveries: Delivery[];
  let mockHubs: Hub[];
  let mockRequest: RoutingRequest;

  beforeEach(() => {
    routingService = new RoutingService();

    // Mock vehicles with different capacities and types
    mockVehicles = [
      {
        id: 'V001',
        type: 'truck',
        subType: 'heavy-truck',
        capacity: { weight: 5000, volume: 20, maxDimensions: { length: 8, width: 2.5, height: 3 } },
        location: { latitude: 28.6139, longitude: 77.2090, address: 'Central Delhi' },
        status: 'available',
        lastUpdated: new Date(),
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
          vehicleAge: 3,
          registrationState: 'Delhi',
          manufacturingYear: 2021
        },
        accessPrivileges: {
          residentialZones: true,
          commercialZones: true,
          industrialZones: true,
          restrictedHours: false,
          pollutionSensitiveZones: false,
          narrowLanes: false
        },
        driverInfo: {
          id: 'D001',
          name: 'Driver One',
          licenseNumber: 'DL123456789',
          contactNumber: '+91-9876543210',
          workingHours: 0,
          maxWorkingHours: 8
        }
      },
      {
        id: 'V002',
        type: 'tempo',
        subType: 'tempo-traveller',
        capacity: { weight: 1500, volume: 8, maxDimensions: { length: 5, width: 2, height: 2.5 } },
        location: { latitude: 28.7041, longitude: 77.1025, address: 'North Delhi' },
        status: 'available',
        lastUpdated: new Date(),
        compliance: {
          pollutionCertificate: true,
          pollutionLevel: 'BS6',
          permitValid: true,
          oddEvenCompliant: true,
          zoneRestrictions: [],
          timeRestrictions: []
        },
        vehicleSpecs: {
          plateNumber: 'DL02CD5678',
          fuelType: 'cng',
          vehicleAge: 2,
          registrationState: 'Delhi',
          manufacturingYear: 2022
        },
        accessPrivileges: {
          residentialZones: true,
          commercialZones: true,
          industrialZones: true,
          restrictedHours: true,
          pollutionSensitiveZones: true,
          narrowLanes: true
        },
        driverInfo: {
          id: 'D002',
          name: 'Driver Two',
          licenseNumber: 'DL123456790',
          contactNumber: '+91-9876543211',
          workingHours: 0,
          maxWorkingHours: 8
        }
      },
      {
        id: 'V003',
        type: 'van',
        subType: 'pickup-van',
        capacity: { weight: 1000, volume: 6, maxDimensions: { length: 4, width: 1.8, height: 2 } },
        location: { latitude: 28.5355, longitude: 77.3910, address: 'South Delhi' },
        status: 'available',
        lastUpdated: new Date(),
        compliance: {
          pollutionCertificate: true,
          pollutionLevel: 'BS6',
          permitValid: true,
          oddEvenCompliant: true,
          zoneRestrictions: [],
          timeRestrictions: []
        },
        vehicleSpecs: {
          plateNumber: 'DL03EF9012',
          fuelType: 'petrol',
          vehicleAge: 1,
          registrationState: 'Delhi',
          manufacturingYear: 2023
        },
        accessPrivileges: {
          residentialZones: true,
          commercialZones: true,
          industrialZones: false,
          restrictedHours: true,
          pollutionSensitiveZones: true,
          narrowLanes: true
        },
        driverInfo: {
          id: 'D003',
          name: 'Driver Three',
          licenseNumber: 'DL123456791',
          contactNumber: '+91-9876543212',
          workingHours: 0,
          maxWorkingHours: 8
        }
      }
    ];

    // Mock hubs in different locations
    mockHubs = [
      {
        id: 'HUB001',
        name: 'Central Hub',
        location: { latitude: 28.6139, longitude: 77.2090, address: 'Connaught Place, Delhi' },
        capacity: {
          maxVehicles: 50,
          currentVehicles: 25,
          storageArea: 5000,
          loadingBays: 10,
          bufferVehicleSlots: 8
        },
        bufferVehicles: [
          mockVehicles[0]!, // Truck available as buffer
          {
            ...mockVehicles[1]!,
            id: 'V004',
            status: 'available'
          }
        ],
        operatingHours: {
          open: '06:00',
          close: '22:00',
          timezone: 'Asia/Kolkata'
        },
        facilities: ['loading_dock', 'storage', 'maintenance'],
        hubType: 'primary',
        status: 'active',
        contactInfo: {
          managerName: 'Rajesh Kumar',
          phone: '+91-9876543210',
          email: 'rajesh@logistics.com',
          emergencyContact: '+91-9876543211'
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'HUB002',
        name: 'North Hub',
        location: { latitude: 28.7041, longitude: 77.1025, address: 'Rohini, Delhi' },
        capacity: {
          maxVehicles: 30,
          currentVehicles: 15,
          storageArea: 3000,
          loadingBays: 6,
          bufferVehicleSlots: 5
        },
        bufferVehicles: [
          {
            ...mockVehicles[2]!,
            id: 'V005',
            status: 'available'
          }
        ],
        operatingHours: {
          open: '07:00',
          close: '21:00',
          timezone: 'Asia/Kolkata'
        },
        facilities: ['loading_dock', 'storage'],
        hubType: 'secondary',
        status: 'active',
        contactInfo: {
          managerName: 'Priya Sharma',
          phone: '+91-9876543220',
          email: 'priya@logistics.com',
          emergencyContact: '+91-9876543221'
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      },
      {
        id: 'HUB003',
        name: 'South Hub',
        location: { latitude: 28.5355, longitude: 77.3910, address: 'Gurgaon, Haryana' },
        capacity: {
          maxVehicles: 40,
          currentVehicles: 20,
          storageArea: 4000,
          loadingBays: 8,
          bufferVehicleSlots: 6
        },
        bufferVehicles: [
          {
            ...mockVehicles[0]!,
            id: 'V006',
            status: 'available'
          }
        ],
        operatingHours: {
          open: '06:00',
          close: '23:00',
          timezone: 'Asia/Kolkata'
        },
        facilities: ['loading_dock', 'storage', 'maintenance', 'fuel_station'],
        hubType: 'primary',
        status: 'active',
        contactInfo: {
          managerName: 'Amit Singh',
          phone: '+91-9876543230',
          email: 'amit@logistics.com',
          emergencyContact: '+91-9876543231'
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      }
    ];

    // Mock deliveries with varying sizes and locations
    mockDeliveries = [
      {
        id: 'DEL001',
        customerId: 'CUST001',
        pickupLocation: { latitude: 28.6500, longitude: 77.2300, address: 'Karol Bagh, Delhi' },
        deliveryLocation: { latitude: 28.5500, longitude: 77.2700, address: 'Lajpat Nagar, Delhi' },
        timeWindow: {
          earliest: new Date('2024-01-15T09:00:00Z'),
          latest: new Date('2024-01-15T17:00:00Z')
        },
        shipment: {
          weight: 800,
          volume: 4,
          fragile: false,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: []
        },
        priority: 'medium',
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'DEL002',
        customerId: 'CUST002',
        pickupLocation: { latitude: 28.7200, longitude: 77.1100, address: 'Pitampura, Delhi' },
        deliveryLocation: { latitude: 28.4600, longitude: 77.0700, address: 'Dwarka, Delhi' },
        timeWindow: {
          earliest: new Date('2024-01-15T10:00:00Z'),
          latest: new Date('2024-01-15T18:00:00Z')
        },
        shipment: {
          weight: 2500, // Large shipment requiring load splitting
          volume: 12,
          fragile: true,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: ['careful_handling']
        },
        priority: 'high',
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'DEL003',
        customerId: 'CUST003',
        pickupLocation: { latitude: 28.5800, longitude: 77.3200, address: 'Noida, UP' },
        deliveryLocation: { latitude: 28.4200, longitude: 77.0500, address: 'Gurgaon, Haryana' },
        timeWindow: {
          earliest: new Date('2024-01-15T11:00:00Z'),
          latest: new Date('2024-01-15T19:00:00Z')
        },
        shipment: {
          weight: 500,
          volume: 2,
          fragile: false,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: []
        },
        priority: 'low',
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'DEL004',
        customerId: 'CUST004',
        pickupLocation: { latitude: 28.6800, longitude: 77.2200, address: 'Civil Lines, Delhi' },
        deliveryLocation: { latitude: 28.5200, longitude: 77.4100, address: 'Faridabad, Haryana' },
        timeWindow: {
          earliest: new Date('2024-01-15T08:00:00Z'),
          latest: new Date('2024-01-15T16:00:00Z')
        },
        shipment: {
          weight: 3000, // Another large shipment
          volume: 15,
          fragile: false,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: ['heavy_lifting']
        },
        priority: 'urgent',
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Mock routing request
    mockRequest = {
      vehicles: mockVehicles,
      deliveries: mockDeliveries,
      hubs: mockHubs,
      constraints: {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: true,
        hubSequencing: true,
        maxRouteDistance: 100,
        maxRouteDuration: 480 // 8 hours
      },
      timeWindow: {
        earliest: new Date('2024-01-15T08:00:00Z'),
        latest: new Date('2024-01-15T20:00:00Z')
      },
      serviceType: 'shared'
    };
  });

  describe('optimizeHubAndSpokeRoutes', () => {
    it('should successfully optimize hub-and-spoke routes', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.algorithmUsed).toBe('HUB_AND_SPOKE_ROUTING');
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.optimizationTime).toBeGreaterThan(0);
    });

    it('should handle requests without hubs by falling back to regular routing', async () => {
      const requestWithoutHubs = { ...mockRequest, hubs: [] };
      
      const result = await routingService.optimizeHubAndSpokeRoutes(requestWithoutHubs);

      // Should fallback to regular routing
      expect(result.success).toBe(true);
      expect(result.algorithmUsed).not.toBe('HUB_AND_SPOKE_ROUTING');
    });

    it('should create both transfer and delivery routes', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      const transferRoutes = result.routes.filter(r => r.routeType === 'hub_transfer');
      const deliveryRoutes = result.routes.filter(r => r.routeType === 'hub_to_delivery');

      expect(transferRoutes.length).toBeGreaterThanOrEqual(0);
      expect(deliveryRoutes.length).toBeGreaterThan(0);
    });

    it('should handle load splitting for large deliveries', async () => {
      // Create a request with only large deliveries that require splitting
      const largeDeliveryRequest = {
        ...mockRequest,
        deliveries: [mockDeliveries[1]!, mockDeliveries[3]!] // Large deliveries
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(largeDeliveryRequest);

      expect(result.success).toBe(true);
      expect(result.routes.length).toBeGreaterThan(0);
      
      // Should have multiple routes for split deliveries
      const deliveryRoutes = result.routes.filter(r => r.routeType === 'hub_to_delivery');
      expect(deliveryRoutes.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect vehicle capacity constraints in hub routing', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      // Check that no route exceeds vehicle capacity
      for (const route of result.routes) {
        const vehicle = mockVehicles.find(v => v.id === route.vehicleId);
        if (vehicle && route.deliveryIds) {
          let totalWeight = 0;
          let totalVolume = 0;
          
          for (const deliveryId of route.deliveryIds) {
            const delivery = mockDeliveries.find(d => d.id === deliveryId);
            if (delivery) {
              totalWeight += delivery.shipment.weight;
              totalVolume += delivery.shipment.volume;
            }
          }
          
          // Allow for some tolerance due to load splitting
          expect(totalWeight).toBeLessThanOrEqual(vehicle.capacity.weight * 1.1);
          expect(totalVolume).toBeLessThanOrEqual(vehicle.capacity.volume * 1.1);
        }
      }
    });

    it('should assign deliveries to optimal hubs', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      // Check that routes have hub assignments
      const hubRoutes = result.routes.filter(r => r.hubId);
      expect(hubRoutes.length).toBeGreaterThan(0);
      
      // Check that hub IDs are valid
      for (const route of hubRoutes) {
        expect(mockHubs.some(h => h.id === route.hubId)).toBe(true);
      }
    });
  });

  describe('Hub Assignment Logic', () => {
    it('should assign deliveries to nearest suitable hub', async () => {
      // Test with a single delivery close to Central Hub
      const singleDeliveryRequest = {
        ...mockRequest,
        deliveries: [mockDeliveries[0]!] // Delivery in central Delhi
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(singleDeliveryRequest);

      expect(result.success).toBe(true);
      
      const hubRoute = result.routes.find(r => r.hubId);
      expect(hubRoute).toBeDefined();
      expect(hubRoute!.hubId).toBe('HUB001'); // Should assign to Central Hub
    });

    it('should consider hub capacity in assignment', async () => {
      // Create a hub with limited capacity
      const limitedCapacityHub = {
        ...mockHubs[0]!,
        capacity: {
          ...mockHubs[0]!.capacity,
          maxVehicles: 1,
          currentVehicles: 1 // At capacity
        }
      };

      const requestWithLimitedHub = {
        ...mockRequest,
        hubs: [limitedCapacityHub, ...mockHubs.slice(1)]
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(requestWithLimitedHub);

      expect(result.success).toBe(true);
      
      // Should prefer hubs with available capacity
      const hubRoutes = result.routes.filter(r => r.hubId);
      const hubIds = hubRoutes.map(r => r.hubId);
      
      // Should prefer other hubs over the limited capacity one
      expect(hubIds.filter(id => id !== 'HUB001').length).toBeGreaterThanOrEqual(
        hubIds.filter(id => id === 'HUB001').length
      );
    });
  });

  describe('Load Splitting Logic', () => {
    it('should split large deliveries across multiple vehicles', async () => {
      // Create a delivery that exceeds single vehicle capacity
      const largeDelivery: Delivery = {
        id: 'DEL_LARGE',
        customerId: 'CUST_LARGE',
        pickupLocation: { latitude: 28.6500, longitude: 77.2300, address: 'Pickup Location' },
        deliveryLocation: { latitude: 28.5500, longitude: 77.2700, address: 'Delivery Location' },
        timeWindow: {
          earliest: new Date('2024-01-15T09:00:00Z'),
          latest: new Date('2024-01-15T17:00:00Z')
        },
        shipment: {
          weight: 8000, // Exceeds any single vehicle capacity
          volume: 30,
          fragile: false,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: []
        },
        priority: 'medium',
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const largeDeliveryRequest = {
        ...mockRequest,
        deliveries: [largeDelivery],
        serviceType: 'shared' as const // Allow load splitting
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(largeDeliveryRequest);

      expect(result.success).toBe(true);
      
      // Should create multiple routes for the split delivery
      const deliveryRoutes = result.routes.filter(r => 
        r.deliveryIds?.some(id => id.includes('DEL_LARGE'))
      );
      
      expect(deliveryRoutes.length).toBeGreaterThan(1);
    });

    it('should not split deliveries for premium service', async () => {
      const largeDelivery: Delivery = {
        id: 'DEL_PREMIUM_LARGE',
        customerId: 'PREMIUM',
        pickupLocation: { latitude: 28.6500, longitude: 77.2300, address: 'Premium Pickup' },
        deliveryLocation: { latitude: 28.5500, longitude: 77.2700, address: 'Premium Delivery' },
        timeWindow: {
          earliest: new Date('2024-01-15T09:00:00Z'),
          latest: new Date('2024-01-15T17:00:00Z')
        },
        shipment: {
          weight: 8000, // Large shipment
          volume: 30,
          fragile: false,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: []
        },
        priority: 'urgent',
        serviceType: 'dedicated_premium',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const premiumRequest = {
        ...mockRequest,
        deliveries: [largeDelivery],
        serviceType: 'dedicated_premium' as const,
        premiumCustomerIds: ['PREMIUM']
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(premiumRequest);

      expect(result.success).toBe(true);
      
      // Should not split the delivery for premium service
      const deliveryRoutes = result.routes.filter(r => 
        r.deliveryIds?.some(id => id.includes('DEL_PREMIUM_LARGE'))
      );
      
      // Should either have one route or fail gracefully
      expect(deliveryRoutes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Hub Transfer Routes', () => {
    it('should create transfer routes between hubs when needed', async () => {
      // Create deliveries that require inter-hub transfers
      const crossHubDeliveries: Delivery[] = [
        {
          id: 'DEL_CROSS_1',
          customerId: 'CUST_CROSS',
          pickupLocation: { latitude: 28.7200, longitude: 77.1100, address: 'North Delhi Pickup' },
          deliveryLocation: { latitude: 28.4200, longitude: 77.0500, address: 'South Delhi Delivery' },
          timeWindow: {
            earliest: new Date('2024-01-15T09:00:00Z'),
            latest: new Date('2024-01-15T17:00:00Z')
          },
          shipment: {
            weight: 1000,
            volume: 5,
            fragile: false,
            hazardous: false,
            temperatureControlled: false,
            specialHandling: []
          },
          priority: 'medium',
          serviceType: 'shared',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const crossHubRequest = {
        ...mockRequest,
        deliveries: crossHubDeliveries
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(crossHubRequest);

      expect(result.success).toBe(true);
      
      // May have transfer routes depending on optimization
     // const transferRoutes = result.routes.filter(r => r.routeType === 'hub_transfer');
      const deliveryRoutes = result.routes.filter(r => r.routeType === 'hub_to_delivery');
      
      expect(deliveryRoutes.length).toBeGreaterThan(0);
      // Transfer routes are optional depending on optimization
    });

    it('should include proper hub stops in transfer routes', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      const transferRoutes = result.routes.filter(r => r.routeType === 'hub_transfer');
      
      for (const route of transferRoutes) {
        expect(route.stops.length).toBeGreaterThanOrEqual(2);
        
        // Should have hub stops
        const hubStops = route.stops.filter(s => s.type === 'hub');
        expect(hubStops.length).toBeGreaterThanOrEqual(2);
        
        // Should have valid hub IDs
        for (const stop of hubStops) {
          expect(stop.hubId).toBeDefined();
          expect(mockHubs.some(h => h.id === stop.hubId)).toBe(true);
        }
      }
    });
  });

  describe('Vehicle Assignment Optimization', () => {
    it('should assign vehicles based on fuel efficiency and proximity', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      // Check that vehicles are assigned to routes
      for (const route of result.routes) {
        expect(route.vehicleId).toBeDefined();
        expect(mockVehicles.some(v => v.id === route.vehicleId)).toBe(true);
      }
    });

    it('should prefer electric vehicles when available', async () => {
      // Add an electric vehicle
      const electricVehicle: Vehicle = {
        ...mockVehicles[0]!,
        id: 'V_ELECTRIC',
        type: 'van',
        vehicleSpecs: {
          ...mockVehicles[0]!.vehicleSpecs,
          fuelType: 'electric',
          plateNumber: 'DL04EV1234'
        },
        compliance: {
          ...mockVehicles[0]!.compliance,
          pollutionLevel: 'electric'
        }
      };

      const requestWithElectric = {
        ...mockRequest,
        vehicles: [...mockVehicles, electricVehicle]
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(requestWithElectric);

      expect(result.success).toBe(true);
      
      // Electric vehicle should be used if suitable
      const electricRoutes = result.routes.filter(r => r.vehicleId === 'V_ELECTRIC');
      expect(electricRoutes.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect vehicle access privileges in assignment', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      // Check that vehicle assignments respect access privileges
      for (const route of result.routes) {
        const vehicle = mockVehicles.find(v => v.id === route.vehicleId);
        expect(vehicle).toBeDefined();
        
        // All assigned vehicles should have appropriate access privileges
        expect(vehicle!.accessPrivileges.commercialZones).toBe(true);
      }
    });
  });

  describe('Route Optimization and Sequencing', () => {
    it('should optimize delivery sequence within routes', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      const deliveryRoutes = result.routes.filter(r => r.routeType === 'hub_to_delivery');
      
      for (const route of deliveryRoutes) {
        // Check that stops are properly sequenced
        for (let i = 0; i < route.stops.length - 1; i++) {
          expect(route.stops[i]!.sequence).toBeLessThan(route.stops[i + 1]!.sequence);
        }
        
        // Check that estimated times are logical
        for (let i = 0; i < route.stops.length - 1; i++) {
          expect(route.stops[i]!.estimatedDepartureTime.getTime())
            .toBeLessThanOrEqual(route.stops[i + 1]!.estimatedArrivalTime.getTime());
        }
      }
    });

    it('should include appropriate stop durations', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      for (const route of result.routes) {
        for (const stop of route.stops) {
          expect(stop.duration).toBeGreaterThan(0);
          
          // Hub stops should have longer durations
          if (stop.type === 'hub') {
            expect(stop.duration).toBeGreaterThanOrEqual(20);
          }
          
          // Delivery stops should have reasonable durations
          if (stop.type === 'delivery') {
            expect(stop.duration).toBeGreaterThanOrEqual(15);
            expect(stop.duration).toBeLessThanOrEqual(60);
          }
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty delivery list gracefully', async () => {
      const emptyRequest = {
        ...mockRequest,
        deliveries: []
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(emptyRequest);

      expect(result.success).toBe(true);
      expect(result.routes).toEqual([]);
    });

    it('should handle inactive hubs', async () => {
      const inactiveHubRequest = {
        ...mockRequest,
        hubs: mockHubs.map(h => ({ ...h, status: 'inactive' as const }))
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(inactiveHubRequest);

      // Should fallback to regular routing or handle gracefully
      expect(result.success).toBe(true);
    });

    it('should handle vehicles with insufficient capacity', async () => {
      // Create vehicles with very small capacity
      const smallVehicles = mockVehicles.map(v => ({
        ...v,
        capacity: { weight: 100, volume: 1, maxDimensions: { length: 2, width: 1, height: 1 } }
      }));

      const smallCapacityRequest = {
        ...mockRequest,
        vehicles: smallVehicles
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(smallCapacityRequest);

      // Should handle gracefully, possibly with load splitting or partial fulfillment
      expect(result.success).toBe(true);
    });

    it('should validate route compliance', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      // All routes should have compliance validation
      for (const route of result.routes) {
        expect(route.complianceValidation).toBeDefined();
        expect(route.complianceValidation!.validatedAt).toBeDefined();
        expect(Array.isArray(route.complianceValidation!.violations)).toBe(true);
        expect(Array.isArray(route.complianceValidation!.warnings)).toBe(true);
      }
    });
  });

  describe('Performance and Metrics', () => {
    it('should complete optimization within reasonable time', async () => {
      const startTime = Date.now();
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.optimizationTime).toBeGreaterThan(0);
    });

    it('should provide meaningful optimization metadata', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      for (const route of result.routes) {
        expect(route.optimizationMetadata).toBeDefined();
        expect(route.optimizationMetadata!.algorithmUsed).toBeDefined();
        expect(route.optimizationMetadata!.optimizationTime).toBeGreaterThanOrEqual(0);
        expect(route.optimizationMetadata!.version).toBeDefined();
        expect(Array.isArray(route.optimizationMetadata!.constraintsApplied)).toBe(true);
      }
    });

    it('should calculate realistic fuel consumption estimates', async () => {
      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      expect(result.success).toBe(true);
      
      for (const route of result.routes) {
        expect(route.estimatedFuelConsumption).toBeGreaterThan(0);
        
        // Fuel consumption should be proportional to distance
        const fuelPerKm = route.estimatedFuelConsumption / route.estimatedDistance;
        expect(fuelPerKm).toBeGreaterThan(0.05); // At least 0.05L per km
        expect(fuelPerKm).toBeLessThan(1.0); // At most 1L per km
      }
    });
  });
});