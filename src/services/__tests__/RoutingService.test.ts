/**
 * Unit tests for RoutingService with OR-Tools VRP solver integration
 */

import { RoutingService, RoutingRequest, RoutingConstraints } from '../RoutingService';
import { Vehicle } from '../../models/Vehicle';
import { Delivery } from '../../models/Delivery';
import { Hub } from '../../models/Hub';
import { VehicleType, Priority, TimeWindow } from '../../models/Common';


describe('RoutingService', () => {
  let routingService: RoutingService;
  let mockVehicles: Vehicle[];
  let mockDeliveries: Delivery[];
  let mockHubs: Hub[];
  let mockTimeWindow: TimeWindow;
  let mockElectricVehicle: Vehicle;
  let mockTruckVehicle: Vehicle;
  let mockResidentialDelivery: Delivery;
  let mockCommercialDelivery: Delivery;
  let mockPremiumDelivery: Delivery;
  let mockPremiumVehicle: Vehicle;

  beforeEach(() => {
    routingService = new RoutingService();
    
    // Mock vehicles
    mockVehicles = [
      {
        id: 'V001',
        type: 'van' as VehicleType,
        subType: 'pickup-van',
        capacity: {
          weight: 1000,
          volume: 5,
          maxDimensions: { length: 3, width: 2, height: 2 }
        },
        location: {
          latitude: 28.6139,
          longitude: 77.2090,
          timestamp: new Date()
        },
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
          vehicleAge: 3,
          registrationState: 'Delhi',
          manufacturingYear: 2021
        },
        accessPrivileges: {
          residentialZones: true,
          commercialZones: true,
          industrialZones: true,
          restrictedHours: false,
          pollutionSensitiveZones: true,
          narrowLanes: true
        },
        driverInfo: {
          id: 'D001',
          name: 'John Doe',
          licenseNumber: 'DL123456',
          workingHours: 0,
          maxWorkingHours: 8,
          contactNumber: '+91-9876543210'
        },
        lastUpdated: new Date()
      },
      {
        id: 'V002',
        type: 'truck' as VehicleType,
        subType: 'light-truck',
        capacity: {
          weight: 3000,
          volume: 15,
          maxDimensions: { length: 6, width: 2.5, height: 3 }
        },
        location: {
          latitude: 28.7041,
          longitude: 77.1025,
          timestamp: new Date()
        },
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
          plateNumber: 'DL02CD5678',
          fuelType: 'diesel',
          vehicleAge: 2,
          registrationState: 'Delhi',
          manufacturingYear: 2022
        },
        accessPrivileges: {
          residentialZones: false,
          commercialZones: true,
          industrialZones: true,
          restrictedHours: false,
          pollutionSensitiveZones: false,
          narrowLanes: false
        },
        driverInfo: {
          id: 'D002',
          name: 'Jane Smith',
          licenseNumber: 'DL789012',
          workingHours: 0,
          maxWorkingHours: 10,
          contactNumber: '+91-9876543211'
        },
        lastUpdated: new Date()
      }
    ];

    // Mock deliveries
    mockDeliveries = [
      {
        id: 'DEL001',
        customerId: 'CUST001',
        pickupLocation: {
          latitude: 28.6139,
          longitude: 77.2090,
          timestamp: new Date()
        },
        deliveryLocation: {
          latitude: 28.5355,
          longitude: 77.3910,
          timestamp: new Date()
        },
        timeWindow: {
          earliest: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          latest: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours from now
        },
        shipment: {
          weight: 500,
          volume: 2,
          fragile: false,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: []
        },
        priority: 'medium' as Priority,
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'DEL002',
        customerId: 'CUST002',
        pickupLocation: {
          latitude: 28.7041,
          longitude: 77.1025,
          timestamp: new Date()
        },
        deliveryLocation: {
          latitude: 28.4595,
          longitude: 77.0266,
          timestamp: new Date()
        },
        timeWindow: {
          earliest: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          latest: new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours from now
        },
        shipment: {
          weight: 800,
          volume: 4,
          fragile: true,
          hazardous: false,
          temperatureControlled: false,
          specialHandling: ['fragile_handling']
        },
        priority: 'high' as Priority,
        serviceType: 'shared',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Mock premium delivery
    mockPremiumDelivery = {
      id: 'DEL_PREMIUM_001',
      customerId: 'PREMIUM_CUST_001',
      pickupLocation: {
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: new Date()
      },
      deliveryLocation: {
        latitude: 28.5355,
        longitude: 77.3910,
        timestamp: new Date()
      },
      timeWindow: {
        earliest: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        latest: new Date(Date.now() + 3 * 60 * 60 * 1000) // 3 hours from now
      },
      shipment: {
        weight: 750,
        volume: 3,
        fragile: false,
        hazardous: false,
        temperatureControlled: false,
        specialHandling: []
      },
      priority: 'urgent' as Priority,
      serviceType: 'dedicated_premium',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock premium-eligible vehicle
    mockPremiumVehicle = {
      id: 'V_PREMIUM_001',
      type: 'van' as VehicleType,
      subType: 'pickup-van',
      capacity: {
        weight: 1500,
        volume: 8,
        maxDimensions: { length: 4, width: 2, height: 2.5 }
      },
      location: {
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: new Date()
      },
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
        plateNumber: 'DL01XY9999',
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
        id: 'D_PREMIUM_001',
        name: 'Premium Driver',
        licenseNumber: 'DL999999',
        workingHours: 0,
        maxWorkingHours: 8,
        contactNumber: '+91-9999999999'
      },
      lastUpdated: new Date()
    };

    // Mock hubs
    mockHubs = [
      {
        id: 'HUB001',
        name: 'Central Hub',
        location: {
          latitude: 28.6139,
          longitude: 77.2090,
          timestamp: new Date()
        },
        capacity: {
          maxVehicles: 50,
          currentVehicles: 20,
          storageArea: 1000,
          loadingBays: 10,
          bufferVehicleSlots: 5
        },
        bufferVehicles: [],
        operatingHours: {
          open: '06:00',
          close: '22:00',
          timezone: 'Asia/Kolkata'
        },
        facilities: ['loading_dock', 'storage', 'maintenance'],
        hubType: 'primary',
        status: 'active',
        contactInfo: {
          managerName: 'Hub Manager',
          phone: '+91-9876543212',
          email: 'hub@logistics.com',
          emergencyContact: '+91-9876543213'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockTimeWindow = {
      earliest: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      latest: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours from now
    };

    // Additional mock vehicles for Delhi constraint testing
    mockElectricVehicle = {
      id: 'V003',
      type: 'electric' as VehicleType,
      subType: 'e-rickshaw',
      capacity: {
        weight: 250,
        volume: 1.5,
        maxDimensions: { length: 2.5, width: 1.5, height: 1.8 }
      },
      location: {
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: new Date()
      },
      status: 'available',
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'electric',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: 'DL03EV9012',
        fuelType: 'electric',
        vehicleAge: 1,
        registrationState: 'Delhi',
        manufacturingYear: 2023
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
        id: 'D003',
        name: 'Electric Driver',
        licenseNumber: 'DL345678',
        workingHours: 0,
        maxWorkingHours: 8,
        contactNumber: '+91-9876543214'
      },
      lastUpdated: new Date()
    };

    mockTruckVehicle = {
      id: 'V004',
      type: 'truck' as VehicleType,
      subType: 'heavy-truck',
      capacity: {
        weight: 8000,
        volume: 40,
        maxDimensions: { length: 10, width: 2.5, height: 4 }
      },
      location: {
        latitude: 28.6139,
        longitude: 77.2090,
        timestamp: new Date()
      },
      status: 'available',
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: ['residential_restricted'],
        timeRestrictions: [{
          zoneType: 'residential',
          restrictedHours: { start: '23:00', end: '07:00' },
          daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          exceptions: ['emergency']
        }]
      },
      vehicleSpecs: {
        plateNumber: 'DL04TR3456',
        fuelType: 'diesel',
        vehicleAge: 4,
        registrationState: 'Delhi',
        manufacturingYear: 2020
      },
      accessPrivileges: {
        residentialZones: false,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: false,
        pollutionSensitiveZones: false,
        narrowLanes: false
      },
      driverInfo: {
        id: 'D004',
        name: 'Truck Driver',
        licenseNumber: 'DL567890',
        workingHours: 0,
        maxWorkingHours: 12,
        contactNumber: '+91-9876543215'
      },
      lastUpdated: new Date()
    };

    // Mock deliveries for Delhi constraint testing
    mockResidentialDelivery = {
      id: 'DEL003',
      customerId: 'CUST003',
      pickupLocation: {
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Commercial Hub, Connaught Place',
        timestamp: new Date()
      },
      deliveryLocation: {
        latitude: 28.5355,
        longitude: 77.3910,
        address: 'Residential Area, Lajpat Nagar',
        timestamp: new Date()
      },
      timeWindow: {
        earliest: new Date(new Date().setHours(2, 0, 0, 0)), // 2 AM (restricted hours for trucks)
        latest: new Date(new Date().setHours(5, 0, 0, 0))    // 5 AM
      },
      shipment: {
        weight: 300,
        volume: 2,
        fragile: false,
        hazardous: false,
        temperatureControlled: false,
        specialHandling: []
      },
      priority: 'medium' as Priority,
      serviceType: 'shared',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockCommercialDelivery = {
      id: 'DEL004',
      customerId: 'CUST004',
      pickupLocation: {
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Industrial Hub, Mayapuri',
        timestamp: new Date()
      },
      deliveryLocation: {
        latitude: 28.6304,
        longitude: 77.2177,
        address: 'Commercial Complex, Karol Bagh',
        timestamp: new Date()
      },
      timeWindow: {
        earliest: new Date(new Date().setHours(10, 0, 0, 0)), // 10 AM (allowed hours)
        latest: new Date(new Date().setHours(18, 0, 0, 0))    // 6 PM
      },
      shipment: {
        weight: 1500,
        volume: 8,
        fragile: false,
        hazardous: false,
        temperatureControlled: false,
        specialHandling: []
      },
      priority: 'high' as Priority,
      serviceType: 'shared',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('optimizeRoutes', () => {
    it('should successfully optimize routes with basic constraints', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      expect(result.routes).toBeDefined();
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.optimizationTime).toBeGreaterThan(0);
      expect(result.algorithmUsed).toBeDefined();
    });

    it('should handle capacity constraints correctly', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      
      // Verify that no route exceeds vehicle capacity
      result.routes.forEach(route => {
        const vehicle = mockVehicles.find(v => v.id === route.vehicleId);
        expect(vehicle).toBeDefined();
        
        // Calculate total weight for deliveries in this route
        let totalWeight = 0;
        let totalVolume = 0;
        
        route.stops.forEach(stop => {
          if (stop.deliveryId) {
            const delivery = mockDeliveries.find(d => d.id === stop.deliveryId);
            if (delivery && stop.type === 'pickup') {
              totalWeight += delivery.shipment.weight;
              totalVolume += delivery.shipment.volume;
            }
          }
        });
        
        expect(totalWeight).toBeLessThanOrEqual(vehicle!.capacity.weight);
        expect(totalVolume).toBeLessThanOrEqual(vehicle!.capacity.volume);
      });
    });

    it('should handle time window constraints', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: false,
        timeWindowConstraints: true,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      
      // Verify that delivery times are within time windows
      result.routes.forEach(route => {
        route.stops.forEach(stop => {
          if (stop.deliveryId && stop.type === 'delivery') {
            const delivery = mockDeliveries.find(d => d.id === stop.deliveryId);
            if (delivery) {
              expect(stop.estimatedArrivalTime.getTime()).toBeGreaterThanOrEqual(
                (delivery.timeWindow.earliest || delivery.timeWindow.start || new Date()).getTime()
              );
              expect(stop.estimatedArrivalTime.getTime()).toBeLessThanOrEqual(
                (delivery.timeWindow.latest || delivery.timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000)).getTime()
              );
            }
          }
        });
      });
    });

    it('should return error for invalid input', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: [], // No vehicles
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No vehicles provided');
    });

    it('should handle no available vehicles', async () => {
      const unavailableVehicles = mockVehicles.map(v => ({
        ...v,
        status: 'maintenance' as const
      }));

      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: unavailableVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No available vehicles');
    });

    it('should handle capacity overflow correctly', async () => {
      // Create deliveries that exceed total vehicle capacity
      const heavyDeliveries: Delivery[] = [
        {
          ...mockDeliveries[0]!,
          shipment: {
            ...mockDeliveries[0]!.shipment,
            weight: 5000, // Exceeds all vehicle capacities
            volume: 20
          }
        }
      ];

      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: heavyDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Total delivery weight exceeds total vehicle capacity');
    });

    it('should use fallback heuristic when OR-Tools fails', async () => {
      // Mock OR-Tools to fail by providing invalid constraints
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: true,
        hubSequencing: true,
        maxRouteDistance: 1, // Unreasonably small distance
        maxRouteDuration: 1   // Unreasonably small duration
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      // Should still succeed with fallback
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.algorithmUsed).toBe('NEAREST_NEIGHBOR_HEURISTIC');
    });

    it('should optimize with custom optimization options', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow,
        optimizationOptions: {
          maxSolverTimeSeconds: 10,
          firstSolutionStrategy: 'SAVINGS',
          localSearchMetaheuristic: 'SIMULATED_ANNEALING',
          logSearch: true
        }
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      expect(result.optimizationTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should handle single vehicle single delivery', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: [mockVehicles[0]!],
        deliveries: [mockDeliveries[0]!],
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      expect(result.routes).toHaveLength(1);
      
      const route = result.routes[0]!;
      expect(route.vehicleId).toBe(mockVehicles[0]!.id);
      expect(route.stops.length).toBeGreaterThanOrEqual(2); // At least pickup and delivery
      
      // Should have pickup before delivery
      const pickupStop = route.stops.find(s => s.type === 'pickup');
      const deliveryStop = route.stops.find(s => s.type === 'delivery');
      
      expect(pickupStop).toBeDefined();
      expect(deliveryStop).toBeDefined();
      expect(pickupStop!.sequence).toBeLessThan(deliveryStop!.sequence);
    });

    it('should calculate fuel consumption correctly', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      
      result.routes.forEach(route => {
        expect(route.estimatedFuelConsumption).toBeGreaterThan(0);
        
        // Fuel consumption should be reasonable for the distance
        const vehicle = mockVehicles.find(v => v.id === route.vehicleId);
        if (vehicle && vehicle.type !== 'electric') {
          expect(route.estimatedFuelConsumption).toBeLessThan(route.estimatedDistance);
        } else if (vehicle && vehicle.type === 'electric') {
          expect(route.estimatedFuelConsumption).toBe(0);
        }
      });
    });

    it('should handle multiple deliveries per vehicle', async () => {
      // Add more deliveries to test multi-stop routes
      const additionalDeliveries: Delivery[] = [
        {
          id: 'DEL003',
          customerId: 'CUST003',
          pickupLocation: {
            latitude: 28.6500,
            longitude: 77.2300,
            timestamp: new Date()
          },
          deliveryLocation: {
            latitude: 28.5500,
            longitude: 77.2500,
            timestamp: new Date()
          },
          timeWindow: {
            earliest: new Date(Date.now() + 60 * 60 * 1000),
            latest: new Date(Date.now() + 5 * 60 * 60 * 1000)
          },
          shipment: {
            weight: 300,
            volume: 1.5,
            fragile: false,
            hazardous: false,
            temperatureControlled: false,
            specialHandling: []
          },
          priority: 'low' as Priority,
          serviceType: 'shared',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: [mockVehicles[0]!], // Use only one vehicle to force multiple deliveries
        deliveries: [...mockDeliveries, ...additionalDeliveries],
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      expect(result.routes).toHaveLength(1);
      
      const route = result.routes[0]!;
      expect(route.stops.length).toBeGreaterThan(4); // Multiple pickups and deliveries
      
      // Verify stop sequencing is logical
      const pickupStops = route.stops.filter(s => s.type === 'pickup');
      const deliveryStops = route.stops.filter(s => s.type === 'delivery');
      
      expect(pickupStops.length).toBeGreaterThan(1);
      expect(deliveryStops.length).toBeGreaterThan(1);
      
      // Each delivery should have a corresponding pickup
      deliveryStops.forEach(deliveryStop => {
        const correspondingPickup = pickupStops.find(p => p.deliveryId === deliveryStop.deliveryId);
        expect(correspondingPickup).toBeDefined();
        expect(correspondingPickup!.sequence).toBeLessThan(deliveryStop.sequence);
      });
    });
  });

  describe('Route validation', () => {
    it('should create routes with proper metadata', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: true,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      
      result.routes.forEach(route => {
        // Check route structure
        expect(route.id).toBeDefined();
        expect(route.vehicleId).toBeDefined();
        expect(route.driverId).toBeDefined();
        expect(route.status).toBe('planned');
        expect(route.createdAt).toBeDefined();
        expect(route.updatedAt).toBeDefined();
        
        // Check optimization metadata
        expect(route.optimizationMetadata).toBeDefined();
        expect(route.optimizationMetadata?.algorithmUsed).toBeDefined();
        expect(route.optimizationMetadata?.constraintsApplied).toBeDefined();
        expect(route.optimizationMetadata?.version).toBeDefined();
        
        // Check compliance validation
        expect(route.complianceValidation).toBeDefined();
        expect(route.complianceValidation?.validatedAt).toBeDefined();
        expect(Array.isArray(route.complianceValidation?.violations)).toBe(true);
        expect(Array.isArray(route.complianceValidation?.warnings)).toBe(true);
        
        // Check stops
        expect(Array.isArray(route.stops)).toBe(true);
        route.stops.forEach(stop => {
          expect(stop.id).toBeDefined();
          expect(stop.sequence).toBeGreaterThanOrEqual(0);
          expect(stop.location).toBeDefined();
          expect(stop.type).toBeDefined();
          expect(stop.estimatedArrivalTime).toBeDefined();
          expect(stop.estimatedDepartureTime).toBeDefined();
          expect(stop.status).toBe('pending');
        });
      });
    });

    it('should assign correct vehicle and driver to routes', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(true);
      
      result.routes.forEach(route => {
        const assignedVehicle = mockVehicles.find(v => v.id === route.vehicleId);
        expect(assignedVehicle).toBeDefined();
        expect(route.driverId).toBe(assignedVehicle!.driverInfo.id);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid time windows', async () => {
      const invalidTimeWindow: TimeWindow = {
        earliest: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        latest: new Date(Date.now() + 2 * 60 * 60 * 1000)   // 2 hours from now (invalid)
      };

      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: invalidTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid time window');
    });

    it('should handle empty deliveries array', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: false,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: [], // No deliveries
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const result = await routingService.optimizeRoutes(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No deliveries provided');
    });
  });

  describe('Delhi-specific routing constraints', () => {
    describe('Time-based restrictions', () => {
      it('should filter out trucks for residential deliveries during restricted hours', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false,
          vehicleClassRestrictions: [{
            vehicleType: 'truck',
            zoneType: 'residential',
            allowedHours: { start: '07:00', end: '23:00' },
            exceptions: ['emergency'],
            alternativeVehicleTypes: ['tempo', 'van', 'three-wheeler']
          }]
        };

        const request: RoutingRequest = {
          vehicles: [mockTruckVehicle, mockElectricVehicle],
          deliveries: [mockResidentialDelivery], // 2 AM delivery to residential area
          hubs: mockHubs,
          constraints,
          timeWindow: {
            earliest: new Date(new Date().setHours(1, 0, 0, 0)),
            latest: new Date(new Date().setHours(6, 0, 0, 0))
          }
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        
        // Should use electric vehicle instead of truck
        const assignedVehicleIds = result.routes.map(r => r.vehicleId);
        expect(assignedVehicleIds).toContain(mockElectricVehicle.id);
        expect(assignedVehicleIds).not.toContain(mockTruckVehicle.id);
      });

      it('should allow trucks for commercial deliveries during allowed hours', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false,
          vehicleClassRestrictions: [{
            vehicleType: 'truck',
            zoneType: 'commercial',
            allowedHours: { start: '06:00', end: '22:00' },
            exceptions: [],
            alternativeVehicleTypes: []
          }]
        };

        const request: RoutingRequest = {
          vehicles: [mockTruckVehicle],
          deliveries: [mockCommercialDelivery], // 10 AM delivery to commercial area
          hubs: mockHubs,
          constraints,
          timeWindow: {
            earliest: new Date(new Date().setHours(9, 0, 0, 0)),
            latest: new Date(new Date().setHours(19, 0, 0, 0))
          }
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes).toHaveLength(1);
        expect(result.routes[0]!.vehicleId).toBe(mockTruckVehicle.id);
      });
    });

    describe('Odd-even rule compliance', () => {
      it('should filter out vehicles violating odd-even rules', async () => {
        // Create vehicles with odd and even plate numbers
        const oddPlateVehicle = {
          ...mockVehicles[0]!,
          id: 'V_ODD',
          vehicleSpecs: {
            ...mockVehicles[0]!.vehicleSpecs,
            plateNumber: 'DL01AB1357' // Odd plate (ends with 7)
          }
        };

        const evenPlateVehicle = {
          ...mockVehicles[1]!,
          id: 'V_EVEN',
          vehicleSpecs: {
            ...mockVehicles[1]!.vehicleSpecs,
            plateNumber: 'DL02CD2468' // Even plate (ends with 8)
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: false,
          hubSequencing: false,
          oddEvenRules: [{
            isActive: true,
            exemptVehicleTypes: ['electric'],
            exemptFuelTypes: ['electric', 'cng'],
            penalty: 2000
          }]
        };

        // Test on an odd date
        const oddDate = new Date(2024, 0, 15); // January 15, 2024 (odd date)
        const request: RoutingRequest = {
          vehicles: [oddPlateVehicle, evenPlateVehicle],
          deliveries: [mockDeliveries[0]!],
          hubs: mockHubs,
          constraints,
          timeWindow: {
            earliest: oddDate,
            latest: new Date(oddDate.getTime() + 8 * 60 * 60 * 1000)
          }
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        
        // Should only use odd plate vehicle on odd date
        const assignedVehicleIds = result.routes.map(r => r.vehicleId);
        expect(assignedVehicleIds).toContain(oddPlateVehicle.id);
        expect(assignedVehicleIds).not.toContain(evenPlateVehicle.id);
      });

      it('should allow electric vehicles regardless of odd-even rules', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: false,
          hubSequencing: false,
          oddEvenRules: [{
            isActive: true,
            exemptVehicleTypes: ['electric'],
            exemptFuelTypes: ['electric'],
            penalty: 2000
          }]
        };

        // Test electric vehicle with even plate on odd date
        const evenDate = new Date(2024, 0, 16); // January 16, 2024 (even date)
        const request: RoutingRequest = {
          vehicles: [mockElectricVehicle], // Electric vehicle should be exempt
          deliveries: [mockDeliveries[0]!],
          hubs: mockHubs,
          constraints,
          timeWindow: {
            earliest: evenDate,
            latest: new Date(evenDate.getTime() + 8 * 60 * 60 * 1000)
          }
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes).toHaveLength(1);
        expect(result.routes[0]!.vehicleId).toBe(mockElectricVehicle.id);
      });
    });

    describe('Zone access restrictions', () => {
      it('should respect weight limits for different zones', async () => {
        // Create a heavy delivery that exceeds residential zone limits
        const heavyResidentialDelivery = {
          ...mockResidentialDelivery,
          shipment: {
            ...mockResidentialDelivery.shipment,
            weight: 4000 // Exceeds 3000kg residential limit
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: false,
          hubSequencing: false,
          weightDimensionLimits: [{
            zoneType: 'residential',
            maxWeight: 3000,
            maxDimensions: { length: 8, width: 2.5, height: 3 },
            penalty: 5000
          }]
        };

        const request: RoutingRequest = {
          vehicles: [mockTruckVehicle],
          deliveries: [heavyResidentialDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: {
            earliest: new Date(new Date().setHours(10, 0, 0, 0)),
            latest: new Date(new Date().setHours(18, 0, 0, 0))
          }
        };

        const result = await routingService.optimizeRoutes(request);

        // Should fail or filter out the delivery due to weight restrictions
        expect(result.success).toBe(false);
      });

      it('should allow appropriate vehicles for industrial zones', async () => {
        const industrialDelivery = {
          ...mockCommercialDelivery,
          deliveryLocation: {
            ...mockCommercialDelivery.deliveryLocation,
            address: 'Industrial Complex, Mayapuri'
          },
          shipment: {
            ...mockCommercialDelivery.shipment,
            weight: 6000 // Heavy load suitable for industrial zone
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: false,
          hubSequencing: false,
          weightDimensionLimits: [{
            zoneType: 'industrial',
            maxWeight: 25000,
            maxDimensions: { length: 16, width: 3, height: 4.5 },
            penalty: 0
          }]
        };

        const request: RoutingRequest = {
          vehicles: [mockTruckVehicle],
          deliveries: [industrialDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: {
            earliest: new Date(new Date().setHours(10, 0, 0, 0)),
            latest: new Date(new Date().setHours(18, 0, 0, 0))
          }
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes).toHaveLength(1);
        expect(result.routes[0]!.vehicleId).toBe(mockTruckVehicle.id);
      });
    });

    describe('Pollution compliance', () => {
      it('should prioritize electric vehicles in pollution-sensitive zones', async () => {
        const pollutionSensitiveDelivery = {
          ...mockCommercialDelivery,
          deliveryLocation: {
            ...mockCommercialDelivery.deliveryLocation,
            address: 'Commercial Complex, Connaught Place (High Pollution Zone)'
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: false,
          hubSequencing: false,
          pollutionCompliance: [{
            zoneLevel: 'high',
            requiredPollutionLevel: 'BS6',
            restrictions: ['diesel_surcharge'],
            penalties: 1000
          }]
        };

        const request: RoutingRequest = {
          vehicles: [mockTruckVehicle, mockElectricVehicle],
          deliveries: [pollutionSensitiveDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        
        // Should prefer electric vehicle in pollution-sensitive zone
        const assignedVehicleIds = result.routes.map(r => r.vehicleId);
        expect(assignedVehicleIds).toContain(mockElectricVehicle.id);
      });
    });

    describe('Compliance validation', () => {
      it('should validate route compliance after optimization', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false,
          vehicleClassRestrictions: [{
            vehicleType: 'truck',
            zoneType: 'residential',
            allowedHours: { start: '07:00', end: '23:00' },
            exceptions: [],
            alternativeVehicleTypes: ['tempo', 'van']
          }]
        };

        const request: RoutingRequest = {
          vehicles: [mockElectricVehicle],
          deliveries: [mockCommercialDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes).toHaveLength(1);
        
        const route = result.routes[0]!;
        expect(route.complianceValidation).toBeDefined();
        expect(route.complianceValidation?.validatedAt).toBeDefined();
        expect(route.complianceValidation?.isCompliant).toBe(true);
        expect(Array.isArray(route.complianceValidation?.violations)).toBe(true);
        expect(Array.isArray(route.complianceValidation?.warnings)).toBe(true);
        expect(Array.isArray(route.complianceValidation?.exemptions)).toBe(true);
      });

      it('should include exemptions for electric vehicles', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: false,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockElectricVehicle],
          deliveries: [mockCommercialDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes).toHaveLength(1);
        
        const route = result.routes[0]!;
        const exemptions = route.complianceValidation?.exemptions;
        expect(exemptions?.length).toBeGreaterThan(0);
        
        const electricExemption = exemptions?.find(e => e.type === 'electric_vehicle');
        expect(electricExemption).toBeDefined();
        expect(electricExemption!.reason).toContain('Electric vehicle exemption');
      });
    });

    describe('Alternative vehicle suggestions', () => {
      it('should suggest alternative vehicles when primary choice is non-compliant', async () => {
        const vehicle = mockTruckVehicle;
        const delivery = mockResidentialDelivery; // Residential delivery during restricted hours

        const alternatives = await routingService.suggestAlternativeVehicles(vehicle, delivery);

        // This would typically return actual alternatives from a fleet service
        // For now, we just verify the method doesn't throw an error
        expect(Array.isArray(alternatives)).toBe(true);
      });
    });

    describe('Route validation methods', () => {
      it('should validate individual routes', async () => {
        // Create a mock route
        const mockRoute = {
          id: 'TEST_ROUTE',
          vehicleId: mockElectricVehicle.id,
          driverId: mockElectricVehicle.driverInfo.id,
          stops: [],
          estimatedDuration: 60,
          estimatedDistance: 10,
          estimatedFuelConsumption: 0,
          trafficFactors: [],
          status: 'planned' as const,
          optimizationMetadata: {
            algorithmUsed: 'TEST',
            optimizationTime: 0,
            iterations: 1,
            objectiveValue: 10,
            constraintsApplied: [],
            fallbackUsed: false,
            version: '1.0.0'
          },
          complianceValidation: {
            isCompliant: true,
            validatedAt: new Date(),
            violations: [],
            warnings: [],
            exemptions: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const validation = await routingService.validateRoute(mockRoute);

        expect(validation.isValid).toBe(true);
        expect(Array.isArray(validation.violations)).toBe(true);
        expect(Array.isArray(validation.warnings)).toBe(true);
      });

      it('should validate vehicle class compliance', async () => {
        const mockRoute = {
          id: 'TEST_ROUTE',
          vehicleId: mockElectricVehicle.id,
          driverId: mockElectricVehicle.driverInfo.id,
          stops: [{
            id: 'STOP_1',
            sequence: 0,
            location: mockCommercialDelivery.deliveryLocation,
            type: 'delivery' as const,
            estimatedArrivalTime: new Date(),
            estimatedDepartureTime: new Date(),
            duration: 15,
            status: 'pending' as const
          }],
          estimatedDuration: 60,
          estimatedDistance: 10,
          estimatedFuelConsumption: 0,
          trafficFactors: [],
          status: 'planned' as const,
          optimizationMetadata: {
            algorithmUsed: 'TEST',
            optimizationTime: 0,
            iterations: 1,
            objectiveValue: 10,
            constraintsApplied: [],
            fallbackUsed: false,
            version: '1.0.0'
          },
          complianceValidation: {
            isCompliant: true,
            validatedAt: new Date(),
            violations: [],
            warnings: [],
            exemptions: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const compliance = await routingService.validateVehicleClassCompliance(mockElectricVehicle, mockRoute);

        expect(compliance.isCompliant).toBeDefined();
        expect(Array.isArray(compliance.violations)).toBe(true);
        expect(Array.isArray(compliance.warnings)).toBe(true);
        expect(Array.isArray(compliance.suggestedActions)).toBe(true);
        expect(compliance.alternativeOptions).toBeDefined();
      });
    });
  });

  describe('Performance', () => {
    it('should complete optimization within reasonable time', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: true,
        hubSequencing: false
      };

      const request: RoutingRequest = {
        vehicles: mockVehicles,
        deliveries: mockDeliveries,
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow,
        optimizationOptions: {
          maxSolverTimeSeconds: 5 // Short time limit
        }
      };

      const startTime = Date.now();
      const result = await routingService.optimizeRoutes(request);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.optimizationTime).toBeLessThan(8000); // Optimization time should be less than 8 seconds
    });

    it('should handle Delhi constraints without significant performance impact', async () => {
      const constraints: RoutingConstraints = {
        vehicleCapacityConstraints: true,
        timeWindowConstraints: true,
        hubSequencing: false,
        vehicleClassRestrictions: [{
          vehicleType: 'truck',
          zoneType: 'residential',
          allowedHours: { start: '07:00', end: '23:00' },
          exceptions: [],
          alternativeVehicleTypes: ['tempo', 'van']
        }],
        oddEvenRules: [{
          isActive: true,
          exemptVehicleTypes: ['electric'],
          exemptFuelTypes: ['electric'],
          penalty: 2000
        }],
        pollutionCompliance: [{
          zoneLevel: 'high',
          requiredPollutionLevel: 'BS6',
          restrictions: [],
          penalties: 1000
        }]
      };

      const request: RoutingRequest = {
        vehicles: [mockElectricVehicle, mockTruckVehicle, ...mockVehicles],
        deliveries: [mockResidentialDelivery, mockCommercialDelivery, ...mockDeliveries],
        hubs: mockHubs,
        constraints,
        timeWindow: mockTimeWindow
      };

      const startTime = Date.now();
      const result = await routingService.optimizeRoutes(request);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds even with constraints
    });
  });

  describe('Premium Service Routing', () => {
    describe('Premium service optimization', () => {
      it('should create dedicated routes for premium deliveries', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle, mockVehicles[0]!],
          deliveries: [mockPremiumDelivery, mockDeliveries[0]!],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.algorithmUsed).toBe('PREMIUM_DEDICATED_ROUTING');
        expect(result.premiumRoutes).toBeDefined();
        expect(result.premiumRoutes!.length).toBeGreaterThan(0);

        // Check that premium route has dedicated vehicle allocation
        const premiumRoute = result.premiumRoutes!.find(r => r.premiumCustomerId === 'PREMIUM_CUST_001');
        expect(premiumRoute).toBeDefined();
        expect(premiumRoute!.dedicatedVehicle).toBe(true);
        expect(premiumRoute!.exclusiveAllocation).toBe(true);
        expect(premiumRoute!.priorityLevel).toBe('urgent');
      });

      it('should prevent load sharing in premium dedicated service', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes).toHaveLength(1);

        const route = result.routes[0]!;
        const deliveryStops = route.stops.filter(stop => stop.type === 'delivery');
        
        // Premium service should have only one delivery per route
        expect(deliveryStops).toHaveLength(1);
        expect(deliveryStops[0]!.deliveryId).toBe(mockPremiumDelivery.id);
      });

      it('should calculate premium pricing correctly', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.totalCost).toBeGreaterThan(0);

        // Premium service should cost more than base cost
        const baseCostEstimate = 200 + (result.totalDistance * 15) + (result.totalDuration * 2);
        expect(result.totalCost).toBeGreaterThan(baseCostEstimate);
      });

      it('should provide guaranteed time windows for premium service', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.premiumRoutes).toBeDefined();

        const premiumRoute = result.premiumRoutes![0]!;
        expect(premiumRoute.guaranteedTimeWindow).toBeDefined();
        expect((premiumRoute.guaranteedTimeWindow.earliest || premiumRoute.guaranteedTimeWindow.start || new Date())).toBeInstanceOf(Date);
        expect((premiumRoute.guaranteedTimeWindow.latest || premiumRoute.guaranteedTimeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000))).toBeInstanceOf(Date);
        expect((premiumRoute.guaranteedTimeWindow.earliest || premiumRoute.guaranteedTimeWindow.start || new Date()).getTime()).toBeLessThan((premiumRoute.guaranteedTimeWindow.latest || premiumRoute.guaranteedTimeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000)).getTime());
      });
    });

    describe('Premium vehicle eligibility', () => {
      it('should filter vehicles based on premium eligibility criteria', async () => {
        // Create an old vehicle that shouldn't be eligible for premium service
        const oldVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_OLD_001',
          vehicleSpecs: {
            ...mockPremiumVehicle.vehicleSpecs,
            vehicleAge: 10 // Too old for premium service
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [oldVehicle, mockPremiumVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        // Should use the premium-eligible vehicle, not the old one
        expect(result.routes[0]!.vehicleId).toBe(mockPremiumVehicle.id);
      });

      it('should require minimum capacity for premium vehicles', async () => {
        // Create a small vehicle that shouldn't be eligible for premium service
        const smallVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_SMALL_001',
          capacity: {
            weight: 200, // Too small for premium service
            volume: 1,
            maxDimensions: { length: 2, width: 1, height: 1 }
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [smallVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No vehicles available for premium dedicated service');
      });

      it('should require proper access privileges for premium vehicles', async () => {
        // Create a vehicle without residential zone access
        const restrictedVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_RESTRICTED_001',
          accessPrivileges: {
            ...mockPremiumVehicle.accessPrivileges,
            residentialZones: false // No residential access
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [restrictedVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No vehicles available for premium dedicated service');
      });
    });

    describe('Premium delivery identification', () => {
      it('should identify premium deliveries by customer ID', async () => {
        const regularDelivery = {
          ...mockDeliveries[0]!,
          customerId: 'REGULAR_CUST_001',
          serviceType: 'shared' as const
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle, mockVehicles[0]!],
          deliveries: [mockPremiumDelivery, regularDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.premiumRoutes).toBeDefined();

        // Should have one premium route and one regular route
        const premiumRoute = result.premiumRoutes!.find(r => r.premiumCustomerId === 'PREMIUM_CUST_001');
        expect(premiumRoute).toBeDefined();
        expect(premiumRoute!.dedicatedVehicle).toBe(true);
      });

      it('should identify premium deliveries by priority level', async () => {
        const urgentDelivery = {
          ...mockDeliveries[0]!,
          priority: 'urgent' as Priority,
          customerId: 'URGENT_CUST_001'
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle],
          deliveries: [urgentDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium'
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.premiumRoutes).toBeDefined();
        expect(result.premiumRoutes![0]!.priorityLevel).toBe('urgent');
      });

      it('should identify premium deliveries by service type', async () => {
        const dedicatedDelivery = {
          ...mockDeliveries[0]!,
          serviceType: 'dedicated_premium' as const,
          customerId: 'DEDICATED_CUST_001'
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle],
          deliveries: [dedicatedDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium'
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.premiumRoutes).toBeDefined();
        expect(result.premiumRoutes![0]!.dedicatedVehicle).toBe(true);
      });
    });

    describe('Priority scheduling', () => {
      it('should prioritize urgent deliveries over high priority ones', async () => {
        const highPriorityDelivery = {
          ...mockPremiumDelivery,
          id: 'DEL_HIGH_001',
          customerId: 'HIGH_CUST_001',
          priority: 'high' as Priority
        };

        const urgentDelivery = {
          ...mockPremiumDelivery,
          id: 'DEL_URGENT_001',
          customerId: 'URGENT_CUST_001',
          priority: 'urgent' as Priority
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle, { ...mockPremiumVehicle, id: 'V_PREMIUM_002' }],
          deliveries: [highPriorityDelivery, urgentDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['HIGH_CUST_001', 'URGENT_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.premiumRoutes).toBeDefined();
        expect(result.premiumRoutes!).toHaveLength(2);

        const urgentRoute = result.premiumRoutes!.find(r => r.priorityLevel === 'urgent');
        const highRoute = result.premiumRoutes!.find(r => r.priorityLevel === 'high');

        expect(urgentRoute).toBeDefined();
        expect(highRoute).toBeDefined();

        // Urgent delivery should be scheduled earlier
        const urgentDeliveryTime = urgentRoute!.stops.find(s => s.type === 'delivery')!.estimatedArrivalTime;
        const highDeliveryTime = highRoute!.stops.find(s => s.type === 'delivery')!.estimatedArrivalTime;

        expect(urgentDeliveryTime.getTime()).toBeLessThanOrEqual(highDeliveryTime.getTime());
      });

      it('should adjust time windows for priority routes', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.premiumRoutes).toBeDefined();

        const premiumRoute = result.premiumRoutes![0]!;
        const deliveryStop = premiumRoute.stops.find(s => s.type === 'delivery')!;

        // Premium delivery should be scheduled within the guaranteed time window
        expect(deliveryStop.estimatedArrivalTime).toBeInstanceOf(Date);
        expect(deliveryStop.estimatedArrivalTime.getTime()).toBeGreaterThanOrEqual(
          (premiumRoute.guaranteedTimeWindow.earliest || premiumRoute.guaranteedTimeWindow.start || new Date()).getTime()
        );
        expect(deliveryStop.estimatedArrivalTime.getTime()).toBeLessThanOrEqual(
          (premiumRoute.guaranteedTimeWindow.latest || premiumRoute.guaranteedTimeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000)).getTime()
        );
      });
    });

    describe('Vehicle selection for premium service', () => {
      it('should select best vehicle based on multiple criteria', async () => {
        // Create vehicles with different characteristics
        const closeVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_CLOSE_001',
          location: {
            latitude: 28.6140, // Very close to pickup
            longitude: 77.2091,
            timestamp: new Date()
          }
        };

        const farVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_FAR_001',
          location: {
            latitude: 28.7041, // Farther from pickup
            longitude: 77.1025,
            timestamp: new Date()
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [farVehicle, closeVehicle], // Far vehicle first to test selection logic
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        // Should select the closer vehicle due to proximity scoring
        expect(result.routes[0]!.vehicleId).toBe(closeVehicle.id);
      });

      it('should consider fuel efficiency in vehicle selection', async () => {
        const electricVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_ELECTRIC_001',
          vehicleSpecs: {
            ...mockPremiumVehicle.vehicleSpecs,
            fuelType: 'electric'
          }
        };

        const dieselVehicle: Vehicle = {
          ...mockPremiumVehicle,
          id: 'V_DIESEL_001',
          vehicleSpecs: {
            ...mockPremiumVehicle.vehicleSpecs,
            fuelType: 'diesel'
          }
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [dieselVehicle, electricVehicle],
          deliveries: [mockPremiumDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        // Should prefer electric vehicle due to higher fuel efficiency score
        expect(result.routes[0]!.vehicleId).toBe(electricVehicle.id);
      });
    });

    describe('Mixed service handling', () => {
      it('should handle both premium and regular deliveries in same request', async () => {
        const regularDelivery = {
          ...mockDeliveries[0]!,
          customerId: 'REGULAR_CUST_001',
          serviceType: 'shared' as const
        };

        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle, mockVehicles[0]!],
          deliveries: [mockPremiumDelivery, regularDelivery],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        expect(result.routes.length).toBeGreaterThanOrEqual(2);

        // Should have both premium and regular routes
        const premiumRoute = result.routes.find(r => 
          r.stops.some(s => s.deliveryId === mockPremiumDelivery.id)
        );
        const regularRoute = result.routes.find(r => 
          r.stops.some(s => s.deliveryId === regularDelivery.id)
        );

        expect(premiumRoute).toBeDefined();
        expect(regularRoute).toBeDefined();
      });

      it('should allocate vehicles exclusively for premium deliveries', async () => {
        const constraints: RoutingConstraints = {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: false
        };

        const request: RoutingRequest = {
          vehicles: [mockPremiumVehicle], // Only one vehicle
          deliveries: [mockPremiumDelivery, mockDeliveries[0]!],
          hubs: mockHubs,
          constraints,
          timeWindow: mockTimeWindow,
          serviceType: 'dedicated_premium',
          premiumCustomerIds: ['PREMIUM_CUST_001']
        };

        const result = await routingService.optimizeRoutes(request);

        expect(result.success).toBe(true);
        
        // Premium delivery should get the vehicle exclusively
        const premiumRoute = result.routes.find(r => 
          r.stops.some(s => s.deliveryId === mockPremiumDelivery.id)
        );
        
        expect(premiumRoute).toBeDefined();
        expect(premiumRoute!.vehicleId).toBe(mockPremiumVehicle.id);
        
        // Regular delivery should either be unassigned or handled by fallback logic
        const regularRoute = result.routes.find(r => 
          r.stops.some(s => s.deliveryId === mockDeliveries[0]!.id)
        );
        
        if (regularRoute) {
          // If regular delivery is assigned, it should not use the premium vehicle
          expect(regularRoute.vehicleId).not.toBe(mockPremiumVehicle.id);
        }
      });
    });
  });
});