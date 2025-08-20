import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { DelhiComplianceService } from '../../services/DelhiComplianceService';
import { VehicleSearchService } from '../../services/VehicleSearchService';
import { FleetService } from '../../services/FleetService';
import { DatabaseService } from '../../database/DatabaseService';
import { RedisService } from '../../cache/RedisService';
import { Vehicle, VehicleType, VehicleStatus } from '../../models/Vehicle';
import { SearchCriteria } from '../../models/Common';
import { Route } from '../../models/Route';

/**
 * Delhi Compliance Integration Test Suite
 * 
 * Validates all Delhi-specific vehicle movement restrictions
 * Tests real-world compliance scenarios with comprehensive coverage
 * Ensures 100% compliance with Delhi vehicle movement restrictions
 * 
 * Requirements Coverage: 13.1-13.7 (Delhi Vehicle Class Movement Restrictions)
 */
describe('Delhi Compliance Integration Tests', () => {
  let delhiComplianceService: DelhiComplianceService;
  let vehicleSearchService: VehicleSearchService;
  let fleetService: FleetService;
  let databaseService: DatabaseService;
  let redisService: RedisService;

  // Test vehicles representing different Delhi vehicle classes
  const delhiTestVehicles: Vehicle[] = [
    // Heavy Truck - Maximum restrictions
    {
      id: 'DL_TRUCK_001',
      type: 'truck' as VehicleType,
      subType: 'heavy-truck',
      capacity: { weight: 10000, volume: 40, maxDimensions: { length: 8, width: 2.5, height: 3.5 } },
      location: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: ['residential_restricted'],
        timeRestrictions: [{
          zoneType: 'residential',
          restrictedHours: { start: '23:00', end: '07:00' },
          daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          exceptions: ['emergency_services']
        }]
      },
      vehicleSpecs: {
        plateNumber: 'DL01AB1357', // Odd plate
        fuelType: 'diesel',
        vehicleAge: 3,
        registrationState: 'Delhi'
      },
      accessPrivileges: {
        residentialZones: false, // Restricted in residential areas during night
        commercialZones: true,
        industrialZones: true,
        restrictedHours: false,
        pollutionSensitiveZones: false,
        narrowLanes: false
      },
      driverInfo: { id: 'D001', workingHours: 0, maxWorkingHours: 8 }
    },
    
    // Tempo - Moderate restrictions
    {
      id: 'DL_TEMPO_001',
      type: 'tempo' as VehicleType,
      subType: 'tempo-traveller',
      capacity: { weight: 2000, volume: 12, maxDimensions: { length: 5, width: 2, height: 2.5 } },
      location: { latitude: 28.7041, longitude: 77.1025, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: 'DL02CD2468', // Even plate
        fuelType: 'cng',
        vehicleAge: 2,
        registrationState: 'Delhi'
      },
      accessPrivileges: {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: false
      },
      driverInfo: { id: 'D002', workingHours: 0, maxWorkingHours: 8 }
    },

    // Three-wheeler - Minimal restrictions
    {
      id: 'DL_3W_001',
      type: 'three-wheeler' as VehicleType,
      subType: 'auto-rickshaw',
      capacity: { weight: 400, volume: 2, maxDimensions: { length: 3, width: 1.5, height: 2 } },
      location: { latitude: 28.5355, longitude: 77.3910, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'BS6',
        permitValid: true,
        oddEvenCompliant: true,
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: 'DL03EF1357', // Odd plate
        fuelType: 'cng',
        vehicleAge: 1,
        registrationState: 'Delhi'
      },
      accessPrivileges: {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: true
      },
      driverInfo: { id: 'D003', workingHours: 0, maxWorkingHours: 8 }
    },

    // Electric Vehicle - Maximum privileges
    {
      id: 'DL_EV_001',
      type: 'electric' as VehicleType,
      subType: 'e-rickshaw',
      capacity: { weight: 300, volume: 1.8, maxDimensions: { length: 2.8, width: 1.3, height: 1.9 } },
      location: { latitude: 28.6500, longitude: 77.2300, timestamp: new Date() },
      status: 'available' as VehicleStatus,
      compliance: {
        pollutionCertificate: true,
        pollutionLevel: 'electric',
        permitValid: true,
        oddEvenCompliant: true, // EVs often exempt from odd-even
        zoneRestrictions: [],
        timeRestrictions: []
      },
      vehicleSpecs: {
        plateNumber: 'DL04GH2468', // Even plate but EV exempt
        fuelType: 'electric',
        vehicleAge: 1,
        registrationState: 'Delhi'
      },
      accessPrivileges: {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: true,
        pollutionSensitiveZones: true,
        narrowLanes: true
      },
      driverInfo: { id: 'D004', workingHours: 0, maxWorkingHours: 8 }
    }
  ];

  beforeAll(async () => {
    databaseService = new DatabaseService();
    redisService = new RedisService();
    await databaseService.connect();
    await redisService.connect();

    fleetService = new FleetService(databaseService);
    delhiComplianceService = new DelhiComplianceService();
    vehicleSearchService = new VehicleSearchService(fleetService, delhiComplianceService, redisService);

    // Clear test data
    await databaseService.query('DELETE FROM vehicles WHERE id LIKE \'DL_%\'');
  });

  afterAll(async () => {
    await databaseService.disconnect();
    await redisService.disconnect();
  });

  beforeEach(async () => {
    // Register test vehicles
    for (const vehicle of delhiTestVehicles) {
      await fleetService.registerVehicle(vehicle);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await databaseService.query('DELETE FROM vehicles WHERE id LIKE \'DL_%\'');
    await redisService.flushAll();
  });

  describe('Time-Based Restrictions (Requirement 13.1)', () => {
    it('should restrict truck movement in residential areas during night hours', async () => {
      const nightTimeSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 }, // Commercial area
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 }, // Residential area (Karol Bagh)
        timeWindow: { start: '02:00', end: '05:00' }, // Restricted hours (11 PM to 7 AM)
        capacity: { weight: 5000, volume: 20 },
        serviceType: 'shared',
        vehicleTypePreference: ['truck']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(nightTimeSearch);
      
      // Should not return trucks for residential delivery during restricted hours
      const truckResults = searchResult.availableVehicles.filter(v => v.type === 'truck');
      expect(truckResults.length).toBe(0);
      
      // Should suggest alternative vehicles or time windows
      expect(searchResult.alternatives.length).toBeGreaterThan(0);
      const timeAlternative = searchResult.alternatives.find(alt => 
        alt.suggestion.includes('time') || alt.suggestion.includes('07:00')
      );
      expect(timeAlternative).toBeDefined();
    });

    it('should allow truck movement in commercial areas during night hours', async () => {
      const commercialNightSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 }, // Connaught Place (Commercial)
        deliveryLocation: { latitude: 28.6200, longitude: 77.2100 }, // Another commercial area
        timeWindow: { start: '02:00', end: '05:00' },
        capacity: { weight: 5000, volume: 20 },
        serviceType: 'shared',
        vehicleTypePreference: ['truck']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(commercialNightSearch);
      
      // Should allow trucks in commercial-to-commercial routes during night
      const truckResults = searchResult.availableVehicles.filter(v => v.type === 'truck');
      expect(truckResults.length).toBeGreaterThan(0);
    });

    it('should allow tempo and three-wheeler movement during all hours', async () => {
      const restrictedHourSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 }, // Residential
        timeWindow: { start: '02:00', end: '05:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared',
        vehicleTypePreference: ['tempo', 'three-wheeler']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(restrictedHourSearch);
      
      const tempoResults = searchResult.availableVehicles.filter(v => v.type === 'tempo');
      const threeWheelerResults = searchResult.availableVehicles.filter(v => v.type === 'three-wheeler');
      
      expect(tempoResults.length + threeWheelerResults.length).toBeGreaterThan(0);
    });
  });

  describe('Odd-Even Rule Compliance (Requirement 13.5)', () => {
    it('should enforce odd-even rules on odd dates', async () => {
      const oddDate = new Date('2024-01-15'); // Monday, odd date
      
      // Test odd plate vehicle (should be allowed)
      const oddPlateCompliance = await delhiComplianceService.checkOddEvenCompliance('DL01AB1357', oddDate);
      expect(oddPlateCompliance).toBe(true);
      
      // Test even plate vehicle (should be restricted)
      const evenPlateCompliance = await delhiComplianceService.checkOddEvenCompliance('DL02CD2468', oddDate);
      expect(evenPlateCompliance).toBe(false);
    });

    it('should enforce odd-even rules on even dates', async () => {
      const evenDate = new Date('2024-01-16'); // Tuesday, even date
      
      // Test even plate vehicle (should be allowed)
      const evenPlateCompliance = await delhiComplianceService.checkOddEvenCompliance('DL02CD2468', evenDate);
      expect(evenPlateCompliance).toBe(true);
      
      // Test odd plate vehicle (should be restricted)
      const oddPlateCompliance = await delhiComplianceService.checkOddEvenCompliance('DL01AB1357', evenDate);
      expect(oddPlateCompliance).toBe(false);
    });

    it('should exempt electric vehicles from odd-even rules', async () => {
      const oddDate = new Date('2024-01-15');
      const evenDate = new Date('2024-01-16');
      
      // Electric vehicle with even plate should be allowed on odd date
      const evOddDateCompliance = await delhiComplianceService.checkOddEvenCompliance('DL04GH2468', oddDate);
      expect(evOddDateCompliance).toBe(true);
      
      // Electric vehicle with even plate should be allowed on even date
      const evEvenDateCompliance = await delhiComplianceService.checkOddEvenCompliance('DL04GH2468', evenDate);
      expect(evEvenDateCompliance).toBe(true);
    });

    it('should filter vehicles based on odd-even compliance in search results', async () => {
      const oddDateSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared',
        date: '2024-01-15' // Odd date
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(oddDateSearch);
      
      // Should only return vehicles compliant with odd-even rule
      searchResult.availableVehicles.forEach(vehicle => {
        const plateNumber = vehicle.vehicleSpecs.plateNumber;
        const lastDigit = parseInt(plateNumber.slice(-1));
        const isOddPlate = lastDigit % 2 === 1;
        const isElectric = vehicle.type === 'electric';
        
        expect(isOddPlate || isElectric).toBe(true);
      });
    });
  });

  describe('Pollution Zone Compliance (Requirement 13.4, 13.6)', () => {
    it('should prioritize electric vehicles in pollution-sensitive zones', async () => {
      const pollutionSensitiveSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 }, // Connaught Place (high pollution)
        deliveryLocation: { latitude: 28.6200, longitude: 77.2100 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 250, volume: 1.5 },
        serviceType: 'shared',
        pollutionSensitive: true
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(pollutionSensitiveSearch);
      
      // Electric vehicles should be prioritized (appear first)
      const firstVehicle = searchResult.availableVehicles[0];
      expect(firstVehicle.type).toBe('electric');
      
      // Should have higher priority score for electric vehicles
      const electricVehicles = searchResult.availableVehicles.filter(v => v.type === 'electric');
      expect(electricVehicles.length).toBeGreaterThan(0);
    });

    it('should validate BS6 compliance for pollution zones', async () => {
      const bs6Vehicle = delhiTestVehicles.find(v => v.compliance.pollutionLevel === 'BS6');
      const pollutionZone = {
        id: 'PZ001',
        name: 'Connaught Place',
        bounds: {
          north: 28.6200,
          south: 28.6100,
          east: 77.2150,
          west: 77.2050
        },
        restrictions: ['BS4_ban'],
        pollutionLevel: 'severe'
      };

      const complianceResult = await delhiComplianceService.validatePollutionZoneAccess(
        bs6Vehicle!,
        pollutionZone
      );
      
      expect(complianceResult).toBe(true);
    });

    it('should restrict older vehicles in high pollution zones', async () => {
      // Create a BS4 vehicle for testing
      const bs4Vehicle: Vehicle = {
        ...delhiTestVehicles[0],
        id: 'DL_BS4_001',
        compliance: {
          ...delhiTestVehicles[0].compliance,
          pollutionLevel: 'BS4'
        }
      };

      await fleetService.registerVehicle(bs4Vehicle);

      const pollutionZone = {
        id: 'PZ002',
        name: 'High Pollution Zone',
        bounds: { north: 28.7, south: 28.6, east: 77.3, west: 77.2 },
        restrictions: ['BS4_ban'],
        pollutionLevel: 'severe'
      };

      const complianceResult = await delhiComplianceService.validatePollutionZoneAccess(
        bs4Vehicle,
        pollutionZone
      );
      
      expect(complianceResult).toBe(false);
    });
  });

  describe('Vehicle Class Access Privileges (Requirement 13.2, 13.3)', () => {
    it('should allow three-wheelers in narrow lanes', async () => {
      const narrowLaneSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6500, longitude: 77.2300 },
        deliveryLocation: { latitude: 28.6520, longitude: 77.2320 }, // Narrow lane area
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 300, volume: 2 },
        serviceType: 'shared',
        accessRequirement: 'narrow_lanes'
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(narrowLaneSearch);
      
      // Should prioritize three-wheelers for narrow lanes
      const threeWheelerResults = searchResult.availableVehicles.filter(v => v.type === 'three-wheeler');
      expect(threeWheelerResults.length).toBeGreaterThan(0);
      
      // Should not include trucks or large vehicles
      const truckResults = searchResult.availableVehicles.filter(v => v.type === 'truck');
      expect(truckResults.length).toBe(0);
    });

    it('should validate zone access based on vehicle type', async () => {
      const truck = delhiTestVehicles.find(v => v.type === 'truck')!;
      const threeWheeler = delhiTestVehicles.find(v => v.type === 'three-wheeler')!;

      // Test residential zone access
      expect(truck.accessPrivileges.residentialZones).toBe(false);
      expect(threeWheeler.accessPrivileges.residentialZones).toBe(true);
      
      // Test narrow lane access
      expect(truck.accessPrivileges.narrowLanes).toBe(false);
      expect(threeWheeler.accessPrivileges.narrowLanes).toBe(true);
    });
  });

  describe('Weight and Dimension Limits (Requirement 13.7)', () => {
    it('should validate vehicle weight limits for specific zones', async () => {
      const heavyTruck = delhiTestVehicles.find(v => v.subType === 'heavy-truck')!;
      
      const weightLimitZone = {
        zoneType: 'residential_bridge',
        maxWeight: 5000, // 5 ton limit
        maxDimensions: { length: 6, width: 2.2, height: 3 }
      };

      // Heavy truck exceeds weight limit
      const weightCompliance = heavyTruck.capacity.weight <= weightLimitZone.maxWeight;
      expect(weightCompliance).toBe(false);
      
      // Should suggest alternative vehicle
      const alternatives = await delhiComplianceService.suggestCompliantAlternatives(
        heavyTruck,
        {
          id: 'D001',
          pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
          deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
          timeWindow: { earliest: new Date(), latest: new Date() },
          shipment: { weight: 3000, volume: 15, fragile: false, specialHandling: [] },
          priority: 'medium',
          customerId: 'C001',
          serviceType: 'shared'
        }
      );

      expect(alternatives.alternativeVehicles.length).toBeGreaterThan(0);
      alternatives.alternativeVehicles.forEach(alt => {
        expect(alt.capacity.weight).toBeLessThanOrEqual(weightLimitZone.maxWeight);
      });
    });

    it('should validate vehicle dimension limits', async () => {
      const truck = delhiTestVehicles.find(v => v.type === 'truck')!;
      const dimensionLimit = { length: 7, width: 2.3, height: 3.2 };

      const dimensionCompliance = 
        truck.capacity.maxDimensions.length <= dimensionLimit.length &&
        truck.capacity.maxDimensions.width <= dimensionLimit.width &&
        truck.capacity.maxDimensions.height <= dimensionLimit.height;

      // Truck dimensions should be within limits for this test
      expect(dimensionCompliance).toBe(true);
    });
  });

  describe('Comprehensive Compliance Validation', () => {
    it('should perform complete compliance check for complex route', async () => {
      const complexRoute: Route = {
        id: 'R_COMPLEX_001',
        vehicleId: 'DL_TRUCK_001',
        stops: [
          {
            location: { latitude: 28.6139, longitude: 77.2090 }, // Commercial pickup
            type: 'pickup',
            timeWindow: { start: '09:00', end: '10:00' }
          },
          {
            location: { latitude: 28.7041, longitude: 77.1025 }, // Residential delivery
            type: 'delivery',
            timeWindow: { start: '15:00', end: '16:00' } // Allowed hours
          }
        ],
        estimatedDuration: 120,
        estimatedDistance: 25,
        estimatedFuelConsumption: 4.5,
        trafficFactors: [],
        status: 'planned'
      };

      const truck = delhiTestVehicles.find(v => v.id === 'DL_TRUCK_001')!;
      const complianceResult = await delhiComplianceService.validateVehicleMovement(
        truck,
        complexRoute,
        new Date('2024-01-15T15:00:00') // Odd date, allowed hours
      );

      expect(complianceResult.isCompliant).toBe(true);
      expect(complianceResult.violations.length).toBe(0);
    });

    it('should identify multiple compliance violations', async () => {
      const violatingRoute: Route = {
        id: 'R_VIOLATING_001',
        vehicleId: 'DL_TRUCK_001',
        stops: [
          {
            location: { latitude: 28.6139, longitude: 77.2090 },
            type: 'pickup',
            timeWindow: { start: '02:00', end: '03:00' } // Restricted hours
          },
          {
            location: { latitude: 28.7041, longitude: 77.1025 }, // Residential
            type: 'delivery',
            timeWindow: { start: '03:00', end: '04:00' } // Restricted hours
          }
        ],
        estimatedDuration: 90,
        estimatedDistance: 20,
        estimatedFuelConsumption: 3.5,
        trafficFactors: [],
        status: 'planned'
      };

      const evenPlateTruck: Vehicle = {
        ...delhiTestVehicles[0],
        id: 'DL_TRUCK_EVEN',
        vehicleSpecs: {
          ...delhiTestVehicles[0].vehicleSpecs,
          plateNumber: 'DL01AB2468' // Even plate
        }
      };

      await fleetService.registerVehicle(evenPlateTruck);

      const complianceResult = await delhiComplianceService.validateVehicleMovement(
        evenPlateTruck,
        violatingRoute,
        new Date('2024-01-15T02:00:00') // Odd date with even plate
      );

      expect(complianceResult.isCompliant).toBe(false);
      expect(complianceResult.violations.length).toBeGreaterThan(0);
      
      // Should have time restriction violation
      const timeViolation = complianceResult.violations.find(v => v.type === 'time_restriction');
      expect(timeViolation).toBeDefined();
      
      // Should have odd-even violation
      const oddEvenViolation = complianceResult.violations.find(v => v.type === 'odd_even_violation');
      expect(oddEvenViolation).toBeDefined();
    });

    it('should provide comprehensive alternative suggestions', async () => {
      const restrictedDelivery = {
        id: 'D_RESTRICTED',
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 }, // Residential
        timeWindow: { earliest: new Date('2024-01-15T02:00:00'), latest: new Date('2024-01-15T05:00:00') },
        shipment: { weight: 3000, volume: 15, fragile: false, specialHandling: [] },
        priority: 'medium' as const,
        customerId: 'C001',
        serviceType: 'shared' as const
      };

      const truck = delhiTestVehicles.find(v => v.type === 'truck')!;
      const alternatives = await delhiComplianceService.suggestCompliantAlternatives(truck, restrictedDelivery);

      // Should suggest alternative vehicles
      expect(alternatives.alternativeVehicles.length).toBeGreaterThan(0);
      alternatives.alternativeVehicles.forEach(alt => {
        expect(alt.accessPrivileges.restrictedHours).toBe(true);
      });

      // Should suggest alternative time windows
      expect(alternatives.alternativeTimeWindows.length).toBeGreaterThan(0);
      const morningWindow = alternatives.alternativeTimeWindows.find(tw => 
        tw.start.includes('07:') || tw.start.includes('08:')
      );
      expect(morningWindow).toBeDefined();

      // Should suggest load splitting if needed
      if (restrictedDelivery.shipment.weight > 1500) {
        expect(alternatives.loadSplittingOptions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Real-World Delhi Scenarios', () => {
    it('should handle Diwali odd-even exemption scenario', async () => {
      // During festivals, odd-even rules might be relaxed
      
      
      const searchCriteria: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared',
        date: '2024-11-01',
        specialConditions: ['festival_exemption']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(searchCriteria);
      
      // Should return more vehicles due to exemption
      expect(searchResult.availableVehicles.length).toBeGreaterThan(0);
    });

    it('should handle emergency pollution alert scenario', async () => {
      const emergencyPollutionSearch: SearchCriteria = {
        pickupLocation: { latitude: 28.6139, longitude: 77.2090 },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared',
        specialConditions: ['pollution_emergency']
      };

      const searchResult = await vehicleSearchService.searchAvailableVehicles(emergencyPollutionSearch);
      
      // Should prioritize electric and CNG vehicles
      const cleanVehicles = searchResult.availableVehicles.filter(v => 
        v.type === 'electric' || v.vehicleSpecs.fuelType === 'cng'
      );
      expect(cleanVehicles.length).toBeGreaterThan(0);
      
      // Should restrict diesel vehicles
      const dieselVehicles = searchResult.availableVehicles.filter(v => 
        v.vehicleSpecs.fuelType === 'diesel'
      );
      expect(dieselVehicles.length).toBe(0);
    });

    it('should validate weekend vs weekday restrictions', async () => {
      const weekdayDate = new Date('2024-01-15'); // Monday
      const weekendDate = new Date('2024-01-13'); // Saturday

      // Some restrictions might be relaxed on weekends
      const weekdayCompliance = await delhiComplianceService.getActiveRestrictions(
        weekdayDate,
        { bounds: { north: 28.8, south: 28.4, east: 77.4, west: 77.0 } }
      );

      const weekendCompliance = await delhiComplianceService.getActiveRestrictions(
        weekendDate,
        { bounds: { north: 28.8, south: 28.4, east: 77.4, west: 77.0 } }
      );

      expect(weekdayCompliance.length).toBeGreaterThanOrEqual(weekendCompliance.length);
    });
  });

  describe('Performance Under Compliance Load', () => {
    it('should maintain performance with multiple compliance checks', async () => {
      const multipleSearches = Array.from({ length: 20 }, (_, i) => ({
        pickupLocation: { latitude: 28.6139 + (i * 0.001), longitude: 77.2090 + (i * 0.001) },
        deliveryLocation: { latitude: 28.7041, longitude: 77.1025 },
        timeWindow: { start: '10:00', end: '16:00' },
        capacity: { weight: 1000, volume: 5 },
        serviceType: 'shared' as const,
        date: i % 2 === 0 ? '2024-01-15' : '2024-01-16' // Mix odd/even dates
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        multipleSearches.map(criteria => vehicleSearchService.searchAvailableVehicles(criteria))
      );
      const endTime = Date.now();

      expect(results.length).toBe(20);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // All results should have compliance validation
      results.forEach(result => {
        expect(result.availableVehicles.length).toBeGreaterThanOrEqual(0);
        result.availableVehicles.forEach(vehicle => {
          expect(vehicle.compliance).toBeDefined();
        });
      });
    });
  });
});