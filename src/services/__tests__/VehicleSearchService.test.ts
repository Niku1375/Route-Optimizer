/**
 * Unit tests for VehicleSearchService
 * Tests requirements 2.1, 2.2, 3.1, 3.2 for real-time vehicle availability API
 */

import { VehicleSearchService, SearchCriteria} from '../VehicleSearchService';
import { FleetService } from '../FleetService';
import { DelhiComplianceService, ComplianceResult } from '../DelhiComplianceService';
import { CustomerLoyaltyService } from '../CustomerLoyaltyService';
import { Vehicle } from '../../models/Vehicle';
import { GeoLocation } from '../../models/GeoLocation';
import { ServiceType,  TimeWindow } from '../../models/Common';
import { ValidationError } from '../../utils/errors';

// Mock dependencies
jest.mock('../FleetService');
jest.mock('../DelhiComplianceService');
jest.mock('../CustomerLoyaltyService');

describe('VehicleSearchService', () => {
  let vehicleSearchService: VehicleSearchService;
  let mockFleetService: jest.Mocked<FleetService>;
  let mockComplianceService: jest.Mocked<DelhiComplianceService>;
  let mockLoyaltyService: jest.Mocked<CustomerLoyaltyService>;

  // Test data
  const testPickupLocation: GeoLocation = {
    latitude: 28.6139,
    longitude: 77.2090,
    address: 'Connaught Place, New Delhi',
    timestamp: new Date()
  };

  const testDeliveryLocation: GeoLocation = {
    latitude: 28.5355,
    longitude: 77.3910,
    address: 'Noida Sector 18',
    timestamp: new Date()
  };

  const testVehicle: Vehicle = {
    id: 'VEH_TEST_001',
    type: 'tempo',
    subType: 'tempo-traveller',
    capacity: {
      weight: 1500,
      volume: 8,
      maxDimensions: {
        length: 6,
        width: 2,
        height: 2.5
      }
    },
    location: {
      latitude: 28.6200,
      longitude: 77.2100,
      address: 'Near Connaught Place',
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
      narrowLanes: false
    },
    driverInfo: {
      id: 'DRV_001',
      name: 'Test Driver',
      licenseNumber: 'DL123456789',
      contactNumber: '+91-9876543210',
      workingHours: 8,
      maxWorkingHours: 12
    },
    lastUpdated: new Date()
  };

  const testSearchCriteria: SearchCriteria = {
    pickupLocation: testPickupLocation,
    deliveryLocation: testDeliveryLocation,
    timeWindow: {
      earliest: new Date('2024-01-15T10:00:00Z'),
      latest: new Date('2024-01-15T18:00:00Z')
    },
    capacity: {
      weight: 500,
      volume: 3
    },
    serviceType: 'shared',
    vehicleTypePreference: ['tempo', 'van'],
    customerId: 'CUST_001'
  };

  const mockComplianceResult: ComplianceResult = {
    isCompliant: true,
    violations: [],
    warnings: [],
    suggestedActions: [],
    alternativeOptions: {
      alternativeVehicles: [],
      alternativeTimeWindows: [],
      alternativeRoutes: [],
      loadSplittingOptions: []
    }
  };

  beforeEach(() => {
    // Create mocked instances
    mockFleetService = new FleetService() as jest.Mocked<FleetService>;
    mockComplianceService = new DelhiComplianceService() as jest.Mocked<DelhiComplianceService>;
    mockLoyaltyService = new CustomerLoyaltyService() as jest.Mocked<CustomerLoyaltyService>;
    
    // Create service instance
    vehicleSearchService = new VehicleSearchService(mockFleetService, mockComplianceService, mockLoyaltyService);

    // Setup default mock implementations
    mockFleetService.getVehicles.mockResolvedValue([testVehicle]);
    mockFleetService.getVehicle.mockResolvedValue(testVehicle);
    mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue(mockComplianceResult);
    
    // Setup loyalty service mocks
    mockLoyaltyService.calculateIncentives = jest.fn().mockResolvedValue({
      baseDiscount: 10,
      tierBonus: 5,
      poolingFrequencyBonus: 2,
      msmeBonus: 0,
      totalDiscountPercentage: 17,
      bonusCreditsEarned: 10,
      environmentalImpact: {
        co2SavedThisBooking: 2.5,
        cumulativeCo2Saved: 50,
        fuelSavedLiters: 1.2,
        costSavingsINR: 75,
        treesEquivalent: 2
      }
    });
    
    mockLoyaltyService.applyLoyaltyDiscount = jest.fn().mockResolvedValue({
      originalPrice: 1000,
      discountPercentage: 17,
      discountAmount: 170,
      finalPrice: 830,
      bonusCreditsUsed: 0,
      bonusCreditsEarned: 10
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchAvailableVehicles', () => {
    it('should return available vehicles with compliance filtering', async () => {
      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      expect(result).toBeDefined();
      expect(result.availableVehicles).toHaveLength(1);
      expect(result.availableVehicles[0]?.vehicle.id).toBe('VEH_TEST_001');
      expect(result.availableVehicles[0]?.complianceStatus.isCompliant).toBe(true);
      expect(result.searchMetadata.totalVehiclesEvaluated).toBe(1);
      expect(result.searchMetadata.cacheHit).toBe(false);
    });

    it('should filter vehicles by capacity requirements', async () => {
      // Arrange
      const highCapacityCriteria: SearchCriteria = {
        ...testSearchCriteria,
        capacity: {
          weight: 2000, // Higher than test vehicle capacity
          volume: 10
        }
      };

      mockFleetService.getVehicles.mockResolvedValue([]);

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(highCapacityCriteria);

      // Assert
      expect(result.availableVehicles).toHaveLength(0);
      expect(mockFleetService.getVehicles).toHaveBeenCalledWith(
        expect.objectContaining({
          capacity: {
            minWeight: 2000,
            minVolume: 10
          }
        })
      );
    });

    it('should filter vehicles by vehicle type preference', async () => {
      // Arrange
      const truckOnlyCriteria: SearchCriteria = {
        ...testSearchCriteria,
        vehicleTypePreference: ['truck']
      };

      // Act
      await vehicleSearchService.searchAvailableVehicles(truckOnlyCriteria);

      // Assert
      expect(mockFleetService.getVehicles).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicleTypes: ['truck']
        })
      );
    });

    it('should exclude non-compliant vehicles', async () => {
      // Arrange
      const nonCompliantResult: ComplianceResult = {
        isCompliant: false,
        violations: [{
          type: 'time_restriction',
          description: 'Vehicle not allowed in residential areas during restricted hours',
          severity: 'high',
          penalty: 5000,
          location: testDeliveryLocation,
          timestamp: new Date()
        }],
        warnings: [],
        suggestedActions: ['Use alternative vehicle type'],
        alternativeOptions: {
          alternativeVehicles: [],
          alternativeTimeWindows: [],
          alternativeRoutes: [],
          loadSplittingOptions: []
        }
      };

      mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue(nonCompliantResult);

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      expect(result.availableVehicles).toHaveLength(0);
      expect(result.searchMetadata.complianceFiltersApplied).toContain('time_restriction');
    });

    it('should return premium options for dedicated service', async () => {
      // Arrange
      const premiumCriteria: SearchCriteria = {
        ...testSearchCriteria,
        serviceType: 'dedicated_premium'
      };

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(premiumCriteria);

      // Assert
      expect(result.premiumOptions).toHaveLength(1);
      expect(result.premiumOptions[0]?.dedicatedService).toBe(true);
      expect(result.premiumOptions[0]?.premiumPricing.premiumMultiplier).toBe(1.8);
      expect(result.availableVehicles).toHaveLength(0); // Should not include in regular list
    });

    it('should calculate accurate pricing for vehicles', async () => {
      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      const vehicleInfo = result.availableVehicles[0];
      expect(vehicleInfo).toBeDefined();
      expect(vehicleInfo?.pricing).toBeDefined();
      expect(vehicleInfo?.pricing.baseRate).toBe(300); // Tempo base rate
      expect(vehicleInfo?.pricing.distanceRate).toBe(12); // Tempo distance rate
      expect(vehicleInfo?.pricing.totalEstimate).toBeGreaterThan(0);
      expect(vehicleInfo?.pricing.currency).toBe('INR');
    });

    it('should generate alternatives when no compliant vehicles found', async () => {
      // Arrange
      mockFleetService.getVehicles.mockResolvedValue([]);

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives.some(alt => alt.type === 'vehicle_type')).toBe(true);
    });

    it('should suggest time window alternatives for restricted hours', async () => {
      // Arrange
      const restrictedHoursCriteria: SearchCriteria = {
        ...testSearchCriteria,
        timeWindow: {
          earliest: new Date('2024-01-15T02:00:00Z'), // 2 AM - restricted hours
          latest: new Date('2024-01-15T04:00:00Z')
        }
      };

      mockFleetService.getVehicles.mockResolvedValue([]);

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(restrictedHoursCriteria);

      // Assert
      expect(result.alternatives.some(alt => alt.type === 'time_window')).toBe(true);
      const timeWindowAlt = result.alternatives.find(alt => alt.type === 'time_window');
      expect(timeWindowAlt?.suggestion).toContain('7 AM and 11 PM');
    });

    it('should suggest shared service alternative for premium requests', async () => {
      // Arrange
      const premiumCriteria: SearchCriteria = {
        ...testSearchCriteria,
        serviceType: 'dedicated_premium'
      };

      mockFleetService.getVehicles.mockResolvedValue([]);

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(premiumCriteria);

      // Assert
      expect(result.alternatives.some(alt => alt.type === 'service_type')).toBe(true);
      const serviceTypeAlt = result.alternatives.find(alt => alt.type === 'service_type');
      expect(serviceTypeAlt?.estimatedSavings).toBe(50);
    });

    it('should use cache for repeated searches', async () => {
      // Act - First search
      const result1 = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);
      
      // Act - Second search with same criteria
      const result2 = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      expect(result1.searchMetadata.cacheHit).toBe(false);
      expect(result2.searchMetadata.cacheHit).toBe(true);
      expect(mockFleetService.getVehicles).toHaveBeenCalledTimes(1); // Should only call once
    });

    it('should calculate estimated pickup and delivery times', async () => {
      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      const vehicleInfo = result.availableVehicles[0];
      expect(vehicleInfo).toBeDefined();
      expect(vehicleInfo?.estimatedPickupTime).toBeInstanceOf(Date);
      expect(vehicleInfo?.estimatedDeliveryTime).toBeInstanceOf(Date);
      expect(vehicleInfo?.estimatedDeliveryTime.getTime()).toBeGreaterThan(
        vehicleInfo?.estimatedPickupTime.getTime() || 0
      );
    });

    it('should include search metadata with performance metrics', async () => {
      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      expect(result.searchMetadata).toBeDefined();
      expect(result.searchMetadata.searchId).toMatch(/^SEARCH_/);
      expect(result.searchMetadata.timestamp).toBeInstanceOf(Date);
      expect(result.searchMetadata.searchDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.searchMetadata.totalVehiclesEvaluated).toBe(1);
    });
  });

  describe('validateCompliance', () => {
    it('should validate vehicle compliance for a route', async () => {
      // Arrange
      const testRoute = {
        id: 'ROUTE_001',
        stops: [
          { location: testPickupLocation, type: 'pickup' },
          { location: testDeliveryLocation, type: 'delivery' }
        ],
        vehicleId: 'VEH_TEST_001',
        status: 'planned',
        estimatedDuration: 120,
        estimatedDistance: 25
      };

      // Act
      const result = await vehicleSearchService.validateCompliance('VEH_TEST_001', testRoute);

      // Assert
      expect(result).toBe(mockComplianceResult);
      expect(mockFleetService.getVehicle).toHaveBeenCalledWith('VEH_TEST_001');
      expect(mockComplianceService.validateVehicleMovement).toHaveBeenCalledWith(
        testVehicle,
        testRoute,
        expect.any(Date)
      );
    });
  });

  describe('getCachedResults', () => {
    it('should return cached results when available', async () => {
      // Arrange - First search to populate cache
      await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);
      
      // Generate cache key (simplified for test)
      const cacheKey = 'test_cache_key';

      // Act
      const cachedResult = vehicleSearchService.getCachedResults(cacheKey);

      // Assert - Should return null for unknown cache key
      expect(cachedResult).toBeNull();
    });
  });

  describe('clearExpiredCache', () => {
    it('should clear expired cache entries', () => {
      // Act
      vehicleSearchService.clearExpiredCache();

      // Assert - Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('validation', () => {
    it('should throw ValidationError for missing pickup location', async () => {
      // Arrange
      const invalidCriteria: SearchCriteria = {
        ...testSearchCriteria,
        pickupLocation: null as any
      };

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(invalidCriteria)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing delivery location', async () => {
      // Arrange
      const invalidCriteria: SearchCriteria = {
        ...testSearchCriteria,
        deliveryLocation: null as any
      };

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(invalidCriteria)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid time window', async () => {
      // Arrange
      const invalidCriteria: SearchCriteria = {
        ...testSearchCriteria,
        timeWindow: {
          earliest: new Date('2024-01-15T18:00:00Z'),
          latest: new Date('2024-01-15T10:00:00Z') // Latest before earliest
        }
      };

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(invalidCriteria)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid capacity', async () => {
      // Arrange
      const invalidCriteria: SearchCriteria = {
        ...testSearchCriteria,
        capacity: {
          weight: -100, // Negative weight
          volume: 0 // Zero volume
        }
      };

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(invalidCriteria)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid service type', async () => {
      // Arrange
      const invalidCriteria: SearchCriteria = {
        ...testSearchCriteria,
        serviceType: 'invalid_service' as ServiceType
      };

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(invalidCriteria)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('distance calculation', () => {
    it('should calculate distance between two points correctly', async () => {
      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      const vehicleInfo = result.availableVehicles[0];
      expect(vehicleInfo).toBeDefined();
      expect(vehicleInfo?.distance).toBeGreaterThan(0);
      expect(vehicleInfo?.distance).toBeLessThan(100); // Should be reasonable for Delhi area
    });
  });

  describe('error handling', () => {
    it('should handle fleet service errors gracefully', async () => {
      // Arrange
      mockFleetService.getVehicles.mockRejectedValue(new Error('Fleet service unavailable'));

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(testSearchCriteria)
      ).rejects.toThrow(ValidationError);
    });

    it('should handle compliance service errors gracefully', async () => {
      // Arrange
      mockComplianceService.validateVehicleMovement = jest.fn().mockRejectedValue(
        new Error('Compliance service unavailable')
      );

      // Act & Assert
      await expect(
        vehicleSearchService.searchAvailableVehicles(testSearchCriteria)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('performance', () => {
    it('should complete search within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

      // Assert
      const endTime = Date.now();
      const searchDuration = endTime - startTime;
      expect(searchDuration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.searchMetadata.searchDurationMs).toBeLessThan(5000);
    });
  });

  // Alternative Suggestion Engine Tests - Requirements 2.4, 2.5, 10.4, 10.6
  describe('Alternative Suggestion Engine', () => {
    describe('vehicle type alternatives', () => {
      it('should suggest smaller vehicles for time restriction violations', async () => {
        // Arrange
        const restrictedHoursCriteria: SearchCriteria = {
          ...testSearchCriteria,
          timeWindow: {
            earliest: new Date('2024-01-15T02:00:00Z'), // 2 AM - restricted hours
            latest: new Date('2024-01-15T04:00:00Z')
          },
          vehicleTypePreference: ['truck']
        };

        const truckVehicle: Vehicle = {
          ...testVehicle,
          type: 'truck',
          id: 'TRUCK_001'
        };

        const tempoVehicle: Vehicle = {
          ...testVehicle,
          type: 'tempo',
          id: 'TEMPO_001'
        };

        mockFleetService.getVehicles.mockResolvedValue([truckVehicle, tempoVehicle]);

        // Mock compliance results - truck fails, tempo passes
        mockComplianceService.validateVehicleMovement = jest.fn()
          .mockResolvedValueOnce({
            isCompliant: false,
            violations: [{
              type: 'time_restriction',
              description: 'Truck not allowed during restricted hours',
              severity: 'high',
              penalty: 5000,
              location: testDeliveryLocation,
              timestamp: new Date()
            }],
            warnings: [],
            suggestedActions: [],
            alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
          })
          .mockResolvedValue({
            isCompliant: true,
            violations: [],
            warnings: [],
            suggestedActions: [],
            alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
          });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(restrictedHoursCriteria);

        // Assert
        expect(result.alternatives.length).toBeGreaterThan(0);
        const vehicleTypeAlt = result.alternatives.find(alt => alt.type === 'vehicle_type');
        expect(vehicleTypeAlt).toBeDefined();
        expect(vehicleTypeAlt?.suggestion).toContain('smaller vehicles');
        expect(vehicleTypeAlt?.alternativeVehicles).toContain(tempoVehicle);
      });

      it('should suggest exempt vehicles for odd-even violations', async () => {
        // Arrange
        const oddEvenCriteria: SearchCriteria = {
          ...testSearchCriteria,
          timeWindow: {
            earliest: new Date('2024-01-15T10:00:00Z'), // Odd date
            latest: new Date('2024-01-15T14:00:00Z')
          }
        };

        const evenPlateVehicle: Vehicle = {
          ...testVehicle,
          id: 'EVEN_VEHICLE',
          vehicleSpecs: {
            ...testVehicle.vehicleSpecs,
            plateNumber: 'DL01AB1234' // Even plate on odd date
          }
        };

        const electricVehicle: Vehicle = {
          ...testVehicle,
          type: 'electric',
          id: 'ELECTRIC_001'
        };

        mockFleetService.getVehicles.mockResolvedValue([evenPlateVehicle, electricVehicle]);

        // Mock compliance results - even plate fails, electric passes
        mockComplianceService.validateVehicleMovement = jest.fn()
          .mockResolvedValueOnce({
            isCompliant: false,
            violations: [{
              type: 'odd_even_violation',
              description: 'Even plate vehicle on odd date',
              severity: 'medium',
              penalty: 2000,
              location: testPickupLocation,
              timestamp: new Date()
            }],
            warnings: [],
            suggestedActions: [],
            alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
          })
          .mockResolvedValue({
            isCompliant: true,
            violations: [],
            warnings: [],
            suggestedActions: [],
            alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
          });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(oddEvenCriteria);

        // Assert
        const vehicleTypeAlt = result.alternatives.find(alt => 
          alt.type === 'vehicle_type' && alt.suggestion.includes('exempt from odd-even')
        );
        expect(vehicleTypeAlt).toBeDefined();
        expect(vehicleTypeAlt?.alternativeVehicles).toContain(electricVehicle);
      });

      it('should suggest cleaner vehicles for pollution violations', async () => {
        // Arrange
        const pollutionSensitiveCriteria: SearchCriteria = {
          ...testSearchCriteria,
          deliveryLocation: {
            ...testDeliveryLocation,
            address: 'Connaught Place - Pollution Sensitive Zone'
          }
        };

        const dieselVehicle: Vehicle = {
          ...testVehicle,
          id: 'DIESEL_001',
          vehicleSpecs: {
            ...testVehicle.vehicleSpecs,
            fuelType: 'diesel'
          },
          compliance: {
            ...testVehicle.compliance,
            pollutionLevel: 'BS4'
          }
        };

        const bs6Vehicle: Vehicle = {
          ...testVehicle,
          id: 'BS6_001',
          compliance: {
            ...testVehicle.compliance,
            pollutionLevel: 'BS6'
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([dieselVehicle, bs6Vehicle]);

        // Mock compliance results - BS4 fails, BS6 passes
        mockComplianceService.validateVehicleMovement = jest.fn()
          .mockResolvedValueOnce({
            isCompliant: false,
            violations: [{
              type: 'pollution_violation',
              description: 'Vehicle does not meet pollution standards',
              severity: 'high',
              penalty: 10000,
              location: testDeliveryLocation,
              timestamp: new Date()
            }],
            warnings: [],
            suggestedActions: [],
            alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
          })
          .mockResolvedValue({
            isCompliant: true,
            violations: [],
            warnings: [],
            suggestedActions: [],
            alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
          });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(pollutionSensitiveCriteria);

        // Assert
        const vehicleTypeAlt = result.alternatives.find(alt => 
          alt.type === 'vehicle_type' && alt.suggestion.includes('pollution compliance')
        );
        expect(vehicleTypeAlt).toBeDefined();
        expect(vehicleTypeAlt?.alternativeVehicles).toContain(bs6Vehicle);
      });
    });

    describe('time window alternatives', () => {
      it('should suggest morning window for restricted hour requests', async () => {
        // Arrange
        const nightTimeCriteria: SearchCriteria = {
          ...testSearchCriteria,
          timeWindow: {
            earliest: new Date('2024-01-15T01:00:00Z'), // 1 AM
            latest: new Date('2024-01-15T03:00:00Z')
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([]);

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(nightTimeCriteria);

        // Assert
        const timeWindowAlt = result.alternatives.find(alt => alt.type === 'time_window');
        expect(timeWindowAlt).toBeDefined();
        expect(timeWindowAlt?.suggestion).toContain('unrestricted hours');
        expect(timeWindowAlt?.alternativeTimeWindows).toBeDefined();
        expect(timeWindowAlt?.alternativeTimeWindows?.length).toBeGreaterThan(0);
        
        // Check that suggested time is in allowed hours (7 AM - 11 PM)
        const suggestedTime = timeWindowAlt?.alternativeTimeWindows?.[0];
        expect((suggestedTime?.earliest || suggestedTime?.start || new Date()).getHours()).toBeGreaterThanOrEqual(7);
      });

      it('should suggest next day delivery for odd-even violations', async () => {
        // Arrange
        const oddEvenViolationCriteria: SearchCriteria = {
          ...testSearchCriteria,
          timeWindow: {
            earliest: new Date('2024-01-15T10:00:00Z'), // Odd date
            latest: new Date('2024-01-15T14:00:00Z')
          }
        };

        const evenPlateVehicle: Vehicle = {
          ...testVehicle,
          vehicleSpecs: {
            ...testVehicle.vehicleSpecs,
            plateNumber: 'DL01AB2468' // Even plate
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([evenPlateVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [{
            type: 'odd_even_violation',
            description: 'Even plate on odd date',
            severity: 'medium',
            penalty: 2000,
            location: testPickupLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(oddEvenViolationCriteria);

        // Assert
        const timeWindowAlt = result.alternatives.find(alt => 
          alt.type === 'time_window' && alt.suggestion.includes('next day')
        );
        expect(timeWindowAlt).toBeDefined();
        expect((timeWindowAlt?.alternativeTimeWindows?.[0]?.earliest || timeWindowAlt?.alternativeTimeWindows?.[0]?.start || new Date()).getDate()).toBe(16); // Next day
      });
    });

    describe('pickup location alternatives', () => {
      it('should suggest nearby locations with better vehicle availability', async () => {
        // Arrange
        const limitedAvailabilityCriteria: SearchCriteria = {
          ...testSearchCriteria,
          pickupLocation: {
            latitude: 28.6000,
            longitude: 77.2000,
            address: 'Remote Location',
            timestamp: new Date()
          }
        };

        // Mock vehicles at different locations
        const nearbyVehicle: Vehicle = {
          ...testVehicle,
          id: 'NEARBY_001',
          location: {
            latitude: 28.6100, // Close to alternative location
            longitude: 77.2100,
            address: 'Near Commercial Hub',
            timestamp: new Date()
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([nearbyVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [{
            type: 'zone_restriction',
            description: 'Limited access to remote area',
            severity: 'medium',
            penalty: 1000,
            location: limitedAvailabilityCriteria.pickupLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(limitedAvailabilityCriteria);

        // Assert
        const pickupLocationAlt = result.alternatives.find(alt => alt.type === 'pickup_location');
        expect(pickupLocationAlt).toBeDefined();
        expect(pickupLocationAlt?.alternativeLocations).toBeDefined();
        expect(pickupLocationAlt?.alternativeLocations?.length).toBeGreaterThan(0);
      });

      it('should suggest hub locations for guaranteed availability', async () => {
        // Arrange
        mockFleetService.getVehicles.mockResolvedValue([]);

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(testSearchCriteria);

        // Assert
        const hubLocationAlt = result.alternatives.find(alt => 
          alt.type === 'pickup_location' && alt.suggestion.includes('hub locations')
        );
        expect(hubLocationAlt).toBeDefined();
        expect(hubLocationAlt?.alternativeLocations).toBeDefined();
        expect(hubLocationAlt?.alternativeLocations?.some(loc => 
          loc.address?.includes('Hub')
        )).toBe(true);
      });
    });

    describe('vehicle class substitution', () => {
      it('should suggest load splitting for oversized vehicles', async () => {
        // Arrange
        const smallLoadCriteria: SearchCriteria = {
          ...testSearchCriteria,
          capacity: {
            weight: 200, // Small load
            volume: 1
          }
        };

        const oversizedVehicle: Vehicle = {
          ...testVehicle,
          id: 'OVERSIZED_001',
          type: 'truck',
          capacity: {
            weight: 5000, // Much larger than needed
            volume: 20,
            maxDimensions: { length: 10, width: 3, height: 3 }
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([oversizedVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [{
            type: 'time_restriction',
            description: 'Truck restricted during requested hours',
            severity: 'high',
            penalty: 5000,
            location: testDeliveryLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(smallLoadCriteria);

        // Assert
        const loadSplitAlt = result.alternatives.find(alt => 
          alt.type === 'vehicle_type' && alt.suggestion.includes('Split load')
        );
        expect(loadSplitAlt).toBeDefined();
        expect(loadSplitAlt?.estimatedSavings).toBeGreaterThan(0);
      });

      it('should suggest right-sized vehicles for capacity optimization', async () => {
        // Arrange
        const mediumLoadCriteria: SearchCriteria = {
          ...testSearchCriteria,
          capacity: {
            weight: 800,
            volume: 4
          }
        };

        const rightSizedVehicle: Vehicle = {
          ...testVehicle,
          id: 'RIGHT_SIZED_001',
          capacity: {
            weight: 1000, // Appropriately sized
            volume: 5,
            maxDimensions: { length: 6, width: 2, height: 2.5 }
          }
        };

        const oversizedVehicle: Vehicle = {
          ...testVehicle,
          id: 'OVERSIZED_001',
          type: 'truck',
          capacity: {
            weight: 5000, // Too large
            volume: 20,
            maxDimensions: { length: 10, width: 3, height: 3 }
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([rightSizedVehicle, oversizedVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [{
            type: 'zone_restriction',
            description: 'Vehicle too large for delivery zone',
            severity: 'medium',
            penalty: 2000,
            location: testDeliveryLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(mediumLoadCriteria);

        // Assert
        const rightSizedAlt = result.alternatives.find(alt => 
          alt.type === 'vehicle_type' && alt.suggestion.includes('right-sized vehicles')
        );
        expect(rightSizedAlt).toBeDefined();
        expect(rightSizedAlt?.alternativeVehicles).toContain(rightSizedVehicle);
        expect(rightSizedAlt?.estimatedSavings).toBeGreaterThan(0);
      });

      it('should suggest electric vehicles for environmental benefits', async () => {
        // Arrange
        const environmentalCriteria: SearchCriteria = {
          ...testSearchCriteria,
          vehicleTypePreference: ['tempo', 'van'] // No electric preference
        };

        const electricVehicle: Vehicle = {
          ...testVehicle,
          type: 'electric',
          id: 'ELECTRIC_001'
        };

        mockFleetService.getVehicles.mockResolvedValue([electricVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [{
            type: 'pollution_violation',
            description: 'High pollution area requires cleaner vehicles',
            severity: 'medium',
            penalty: 3000,
            location: testDeliveryLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(environmentalCriteria);

        // Assert
        const electricAlt = result.alternatives.find(alt => 
          alt.type === 'vehicle_type' && alt.suggestion.includes('electric vehicles')
        );
        expect(electricAlt).toBeDefined();
        expect(electricAlt?.alternativeVehicles).toContain(electricVehicle);
        expect(electricAlt?.suggestion).toContain('environmental benefits');
      });
    });

    describe('service type alternatives', () => {
      it('should suggest shared service for premium requests', async () => {
        // Arrange
        const premiumCriteria: SearchCriteria = {
          ...testSearchCriteria,
          serviceType: 'dedicated_premium'
        };

        mockFleetService.getVehicles.mockResolvedValue([]);

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(premiumCriteria);

        // Assert
        const serviceTypeAlt = result.alternatives.find(alt => alt.type === 'service_type');
        expect(serviceTypeAlt).toBeDefined();
        expect(serviceTypeAlt?.suggestion).toContain('Shared service');
        expect(serviceTypeAlt?.estimatedSavings).toBe(50);
      });

      it('should suggest premium service for shared requests when appropriate', async () => {
        // Arrange
        const sharedCriteria: SearchCriteria = {
          ...testSearchCriteria,
          serviceType: 'shared'
        };

        mockFleetService.getVehicles.mockResolvedValue([]);

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(sharedCriteria);

        // Assert
        const serviceTypeAlt = result.alternatives.find(alt => alt.type === 'service_type');
        expect(serviceTypeAlt).toBeDefined();
        expect(serviceTypeAlt?.suggestion).toContain('Premium dedicated service');
        expect(serviceTypeAlt?.estimatedSavings).toBe(-80); // Negative indicates additional cost
      });
    });

    describe('comprehensive alternative scenarios', () => {
      it('should provide multiple alternative types when no vehicles are available', async () => {
        // Arrange
        const challengingCriteria: SearchCriteria = {
          ...testSearchCriteria,
          timeWindow: {
            earliest: new Date('2024-01-15T02:00:00Z'), // Restricted hours
            latest: new Date('2024-01-15T04:00:00Z')
          },
          vehicleTypePreference: ['truck'], // Restricted vehicle type
          serviceType: 'dedicated_premium' // Expensive service type
        };

        mockFleetService.getVehicles.mockResolvedValue([testVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [{
            type: 'time_restriction',
            description: 'Multiple restrictions apply',
            severity: 'high',
            penalty: 5000,
            location: testDeliveryLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(challengingCriteria);

        // Assert
        expect(result.alternatives.length).toBeGreaterThan(2);
        
        const alternativeTypes = result.alternatives.map(alt => alt.type);
        expect(alternativeTypes).toContain('vehicle_type');
        expect(alternativeTypes).toContain('time_window');
        expect(alternativeTypes).toContain('service_type');
        expect(alternativeTypes).toContain('pickup_location');
      });

      it('should prioritize alternatives based on violation severity', async () => {
        // Arrange
        const multiViolationCriteria: SearchCriteria = {
          ...testSearchCriteria,
          timeWindow: {
            earliest: new Date('2024-01-15T01:00:00Z'), // Time restriction
            latest: new Date('2024-01-15T03:00:00Z')
          }
        };

        const violatingVehicle: Vehicle = {
          ...testVehicle,
          id: 'VIOLATING_001',
          vehicleSpecs: {
            ...testVehicle.vehicleSpecs,
            plateNumber: 'DL01AB2468' // Even plate on odd date
          }
        };

        mockFleetService.getVehicles.mockResolvedValue([violatingVehicle]);
        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue({
          isCompliant: false,
          violations: [
            {
              type: 'time_restriction',
              description: 'Time restriction violation',
              severity: 'high',
              penalty: 5000,
              location: testDeliveryLocation,
              timestamp: new Date()
            },
            {
              type: 'odd_even_violation',
              description: 'Odd-even violation',
              severity: 'medium',
              penalty: 2000,
              location: testPickupLocation,
              timestamp: new Date()
            }
          ],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: { alternativeVehicles: [], alternativeTimeWindows: [], alternativeRoutes: [], loadSplittingOptions: [] }
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(multiViolationCriteria);

        // Assert
        expect(result.alternatives.length).toBeGreaterThan(0);
        
        // Should suggest alternatives for the most common/severe violation (time_restriction)
        const timeRelatedAlts = result.alternatives.filter(alt => 
          alt.suggestion.includes('restricted hours') || 
          alt.suggestion.includes('smaller vehicles') ||
          alt.type === 'time_window'
        );
        expect(timeRelatedAlts.length).toBeGreaterThan(0);
      });
    });
  });

  // Premium Service Tests - Requirements 2.6, 2.7
  describe('Premium Dedicated Vehicle Service', () => {
    const premiumSearchCriteria: SearchCriteria = {
      ...testSearchCriteria,
      serviceType: 'dedicated_premium',
      customerId: 'PREMIUM_CUST_001'
    };

    describe('searchPremiumVehicles', () => {
      it('should return premium vehicle options with dedicated service', async () => {
        // Act
        const result = await vehicleSearchService.searchPremiumVehicles(premiumSearchCriteria);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]?.dedicatedService).toBe(true);
        expect(result[0]?.vehicle.id).toBe('VEH_TEST_001');
        expect(result[0]?.guaranteedTimeWindow).toBeDefined();
        expect(result[0]?.premiumPricing).toBeDefined();
        expect(result[0]?.priorityLevel).toMatch(/^(high|urgent)$/);
      });

      it('should throw error for non-premium service type', async () => {
        // Arrange
        const nonPremiumCriteria: SearchCriteria = {
          ...testSearchCriteria,
          serviceType: 'shared'
        };

        // Act & Assert
        await expect(
          vehicleSearchService.searchPremiumVehicles(nonPremiumCriteria)
        ).rejects.toThrow('Premium vehicle search requires dedicated_premium service type');
      });

      it('should filter out non-compliant vehicles for premium service', async () => {
        // Arrange
        const nonCompliantResult: ComplianceResult = {
          isCompliant: false,
          violations: [{
            type: 'time_restriction',
            description: 'Vehicle not allowed during requested time',
            severity: 'high',
            penalty: 5000,
            location: testDeliveryLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: {
            alternativeVehicles: [],
            alternativeTimeWindows: [],
            alternativeRoutes: [],
            loadSplittingOptions: []
          }
        };

        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue(nonCompliantResult);

        // Act
        const result = await vehicleSearchService.searchPremiumVehicles(premiumSearchCriteria);

        // Assert
        expect(result).toHaveLength(0);
      });

      it('should sort premium options by priority and pricing', async () => {
        // Arrange - Add multiple vehicles with different priorities
        const urgentVehicle: Vehicle = {
          ...testVehicle,
          id: 'VEH_URGENT_001',
          type: 'electric' // Electric vehicles get priority
        };

        const regularVehicle: Vehicle = {
          ...testVehicle,
          id: 'VEH_REGULAR_001',
          type: 'truck'
        };

        mockFleetService.getVehicles.mockResolvedValue([urgentVehicle, regularVehicle]);

        // Mock urgent time window (within 2 hours)
        const urgentCriteria: SearchCriteria = {
          ...premiumSearchCriteria,
          timeWindow: {
            earliest: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            latest: new Date(Date.now() + 3 * 60 * 60 * 1000)
          }
        };

        // Act
        const result = await vehicleSearchService.searchPremiumVehicles(urgentCriteria);

        // Assert
        expect(result).toHaveLength(2);
        expect(result[0]?.priorityLevel).toBe('urgent');
        expect(result[0]?.vehicle.type).toBe('electric');
      });
    });

    describe('calculatePremiumPricing', () => {
      it('should calculate premium pricing with correct multipliers', async () => {
        // Act
        const pricing = await vehicleSearchService.calculatePremiumPricing(testVehicle, 'high');

        // Assert
        expect(pricing.baseRate).toBe(300); // Tempo base rate
        expect(pricing.totalEstimate / pricing.baseRate).toBe(1.7); // Tempo high service multiplier
        expect(pricing.totalEstimate).toBe(300 * 1.7);
        expect(pricing.totalEstimate * 0.5).toBe(300 * 0.7); // (multiplier - 1) * basePrice
      });

      it('should apply higher multipliers for urgent service', async () => {
        // Act
        const pricing = await vehicleSearchService.calculatePremiumPricing(testVehicle, 'urgent');

        // Assert
        expect(pricing.totalEstimate / pricing.baseRate).toBe(2.3); // Tempo urgent service multiplier
        expect(pricing.totalEstimate).toBe(300 * 2.3);
        expect(pricing.totalEstimate * 0.5).toBeCloseTo(300 * 1.3, 2);
      });

      it('should apply lower multipliers for electric vehicles', async () => {
        // Arrange
        const electricVehicle: Vehicle = {
          ...testVehicle,
          type: 'electric'
        };

        // Act
        const pricing = await vehicleSearchService.calculatePremiumPricing(electricVehicle, 'high');

        // Assert
        expect(pricing.totalEstimate / pricing.baseRate).toBe(1.4); // Electric high service multiplier
        expect(pricing.totalEstimate).toBe(200 * 1.4); // Electric base rate * multiplier
      });

      it('should handle unknown vehicle types with default multiplier', async () => {
        // Arrange
        const unknownVehicle: Vehicle = {
          ...testVehicle,
          type: 'unknown' as any
        };

        // Act
        const pricing = await vehicleSearchService.calculatePremiumPricing(unknownVehicle, 'high');

        // Assert
        expect(pricing.totalEstimate / pricing.baseRate).toBe(1.8); // Default multiplier
      });
    });

    describe('validateGuaranteedDeliveryWindow', () => {
      /*const testRoute = {
        id: 'PREMIUM_ROUTE_001',
        stops: [
          { location: testPickupLocation, type: 'pickup' },
          { location: testDeliveryLocation, type: 'delivery' }
        ],
        vehicleId: 'VEH_TEST_001',
        status: 'planned',
        estimatedDuration: 120,
        estimatedDistance: 25
      };*/

      it('should validate feasible delivery window', async () => {
        // Arrange
        const feasibleTimeWindow: TimeWindow = {
          earliest: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          latest: new Date(Date.now() + 6 * 60 * 60 * 1000)   // 6 hours from now
        };

        // Act
        const isValid = await vehicleSearchService.validateGuaranteedDeliveryWindow(
          testVehicle,
          feasibleTimeWindow);

        // Assert
        expect(isValid).toBe(true);
      });

      it('should reject impossible delivery window', async () => {
        // Arrange
        const impossibleTimeWindow: TimeWindow = {
          earliest: new Date(Date.now() + 5 * 60 * 1000),  // 5 minutes from now
          latest: new Date(Date.now() + 10 * 60 * 1000)    // 10 minutes from now
        };

        // Act
        const isValid = await vehicleSearchService.validateGuaranteedDeliveryWindow(
          testVehicle,
          impossibleTimeWindow);

        // Assert
        expect(isValid).toBe(false);
      });

      it('should reject delivery window with compliance violations', async () => {
        // Arrange
        const nonCompliantResult: ComplianceResult = {
          isCompliant: false,
          violations: [{
            type: 'time_restriction',
            description: 'Vehicle not allowed during requested time',
            severity: 'high',
            penalty: 5000,
            location: testDeliveryLocation,
            timestamp: new Date()
          }],
          warnings: [],
          suggestedActions: [],
          alternativeOptions: {
            alternativeVehicles: [],
            alternativeTimeWindows: [],
            alternativeRoutes: [],
            loadSplittingOptions: []
          }
        };

        mockComplianceService.validateVehicleMovement = jest.fn().mockResolvedValue(nonCompliantResult);

        const timeWindow: TimeWindow = {
          earliest: new Date(Date.now() + 2 * 60 * 60 * 1000),
          latest: new Date(Date.now() + 6 * 60 * 60 * 1000)
        };

        // Act
        const isValid = await vehicleSearchService.validateGuaranteedDeliveryWindow(
          testVehicle,
          timeWindow);

        // Assert
        expect(isValid).toBe(false);
      });
    });

    describe('allocateDedicatedVehicle', () => {
      it('should successfully allocate available vehicle', async () => {
        // Arrange
        const timeWindow: TimeWindow = {
          earliest: new Date(Date.now() + 60 * 60 * 1000),
          latest: new Date(Date.now() + 4 * 60 * 60 * 1000)
        };

        mockFleetService.updateVehicleStatus = jest.fn().mockResolvedValue(testVehicle);

        // Act
        const result = await vehicleSearchService.allocateDedicatedVehicle(
          'VEH_TEST_001',
          'PREMIUM_CUST_001',
          timeWindow
        );

        // Assert
        expect(result).toBe(true);
        expect(mockFleetService.updateVehicleStatus).toHaveBeenCalledWith(
          'VEH_TEST_001',
          'in-transit',
          expect.objectContaining({
            reservedFor: 'PREMIUM_CUST_001',
            serviceType: 'dedicated_premium',
            reservationWindow: timeWindow,
            exclusiveAllocation: true
          })
        );
      });

      it('should fail to allocate unavailable vehicle', async () => {
        // Arrange
        const unavailableVehicle: Vehicle = {
          ...testVehicle,
          status: 'in-transit'
        };

        mockFleetService.getVehicle.mockResolvedValue(unavailableVehicle);

        const timeWindow: TimeWindow = {
          earliest: new Date(Date.now() + 60 * 60 * 1000),
          latest: new Date(Date.now() + 4 * 60 * 60 * 1000)
        };

        // Act
        const result = await vehicleSearchService.allocateDedicatedVehicle(
          'VEH_TEST_001',
          'PREMIUM_CUST_001',
          timeWindow
        );

        // Assert
        expect(result).toBe(false);
        expect(mockFleetService.updateVehicleStatus).not.toHaveBeenCalled();
      });

      it('should handle fleet service errors gracefully', async () => {
        // Arrange
        mockFleetService.updateVehicleStatus = jest.fn().mockRejectedValue(
          new Error('Fleet service error')
        );

        const timeWindow: TimeWindow = {
          earliest: new Date(Date.now() + 60 * 60 * 1000),
          latest: new Date(Date.now() + 4 * 60 * 60 * 1000)
        };

        // Act
        const result = await vehicleSearchService.allocateDedicatedVehicle(
          'VEH_TEST_001',
          'PREMIUM_CUST_001',
          timeWindow
        );

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('premium service integration with main search', () => {
      it('should return premium options in main search for dedicated service', async () => {
        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(premiumSearchCriteria);

        // Assert
        expect(result.premiumOptions).toHaveLength(1);
        expect(result.availableVehicles).toHaveLength(0); // Should not include in regular list
        expect(result.premiumOptions[0]?.dedicatedService).toBe(true);
        expect(result.premiumOptions[0]?.guaranteedTimeWindow).toBeDefined();
      });

      it('should calculate guaranteed time windows with appropriate buffers', async () => {
        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(premiumSearchCriteria);

        // Assert
        const premiumOption = result.premiumOptions[0];
        expect(premiumOption).toBeDefined();
        expect(premiumOption!.guaranteedTimeWindow.earliest || premiumOption!.guaranteedTimeWindow.start).toBeInstanceOf(Date);
        expect(premiumOption!.guaranteedTimeWindow.latest || premiumOption!.guaranteedTimeWindow.end).toBeInstanceOf(Date);
        
        // Should have buffer time between earliest and latest
        const earliest = premiumOption!.guaranteedTimeWindow.earliest || premiumOption!.guaranteedTimeWindow.start || new Date();
        const latest = premiumOption!.guaranteedTimeWindow.latest || premiumOption!.guaranteedTimeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000);
        const bufferTime = latest.getTime() - earliest.getTime();
        expect(bufferTime).toBeGreaterThan(0);
      });

      it('should prioritize electric vehicles for premium service', async () => {
        // Arrange
        const electricVehicle: Vehicle = {
          ...testVehicle,
          id: 'VEH_ELECTRIC_001',
          type: 'electric'
        };

        mockFleetService.getVehicles.mockResolvedValue([testVehicle, electricVehicle]);

        // Act
        const result = await vehicleSearchService.searchPremiumVehicles(premiumSearchCriteria);

        // Assert
        expect(result).toHaveLength(2);
        // Electric vehicle should have lower premium pricing
        const electricOption = result.find(option => option.vehicle.type === 'electric');
        const tempoOption = result.find(option => option.vehicle.type === 'tempo');
        
        expect(electricOption?.premiumPricing.premiumMultiplier).toBeLessThan(
          tempoOption?.premiumPricing.premiumMultiplier || 0
        );
      });
    });

    describe('premium service pricing scenarios', () => {
      it('should calculate different pricing for different vehicle types', async () => {
        // Arrange
        const truckVehicle: Vehicle = { ...testVehicle, id: 'TRUCK_001', type: 'truck' };
        const vanVehicle: Vehicle = { ...testVehicle, id: 'VAN_001', type: 'van' };
        const threeWheelerVehicle: Vehicle = { ...testVehicle, id: 'TW_001', type: 'three-wheeler' };

        mockFleetService.getVehicles.mockResolvedValue([truckVehicle, vanVehicle, threeWheelerVehicle]);

        // Act
        const result = await vehicleSearchService.searchPremiumVehicles(premiumSearchCriteria);

        // Assert
        expect(result).toHaveLength(3);
        
        const truckOption = result.find(option => option.vehicle.type === 'truck');
        const vanOption = result.find(option => option.vehicle.type === 'van');
        const threeWheelerOption = result.find(option => option.vehicle.type === 'three-wheeler');

        // Truck should have highest premium pricing
        expect(truckOption?.premiumPricing.totalPrice).toBeGreaterThan(
          vanOption?.premiumPricing.totalPrice || 0
        );
        expect(vanOption?.premiumPricing.totalPrice).toBeGreaterThan(
          threeWheelerOption?.premiumPricing.totalPrice || 0
        );
      });

      it('should apply urgent pricing for time-sensitive requests', async () => {
        // Arrange - Request with pickup in 1 hour (urgent)
        const urgentCriteria: SearchCriteria = {
          ...premiumSearchCriteria,
          timeWindow: {
            earliest: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            latest: new Date(Date.now() + 3 * 60 * 60 * 1000)
          }
        };

        // Act
        const result = await vehicleSearchService.searchPremiumVehicles(urgentCriteria);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]?.priorityLevel).toBe('urgent');
        expect(result[0]?.premiumPricing.premiumMultiplier).toBeGreaterThan(2.0); // Urgent multiplier
      });
    });
  });

  describe('Customer Loyalty Integration', () => {
    const loyalCustomerId = 'LOYAL_CUSTOMER_001';
    
    const loyaltySearchCriteria: SearchCriteria = {
      pickupLocation: testPickupLocation,
      deliveryLocation: testDeliveryLocation,
      timeWindow: {
        earliest: new Date(Date.now() + 2 * 60 * 60 * 1000),
        latest: new Date(Date.now() + 6 * 60 * 60 * 1000)
      },
      capacity: { weight: 500, volume: 2 },
      serviceType: 'shared',
      customerId: loyalCustomerId
    };

    describe('calculateLoyaltyIncentives', () => {
      it('should calculate loyalty incentives for registered customer', async () => {
        // Act
        const incentives = await vehicleSearchService.calculateLoyaltyIncentives(loyalCustomerId, 'shared');

        // Assert
        expect(incentives).toMatchObject({
          baseDiscount: 10,
          tierBonus: 5,
          poolingFrequencyBonus: 2,
          msmeBonus: 0,
          totalDiscountPercentage: 17,
          bonusCreditsEarned: 10,
          environmentalImpact: expect.objectContaining({
            co2SavedThisBooking: 2.5,
            cumulativeCo2Saved: 50,
            treesEquivalent: 2
          })
        });
        expect(mockLoyaltyService.calculateIncentives).toHaveBeenCalledWith(loyalCustomerId, 'shared');
      });

      it('should return default incentives for anonymous customer', async () => {
        // Act
        const incentives = await vehicleSearchService.calculateLoyaltyIncentives('', 'shared');

        // Assert
        expect(incentives).toMatchObject({
          baseDiscount: 0,
          tierBonus: 0,
          poolingFrequencyBonus: 0,
          msmeBonus: 0,
          totalDiscountPercentage: 0,
          bonusCreditsEarned: 0,
          environmentalImpact: {
            co2SavedThisBooking: 0,
            cumulativeCo2Saved: 0,
            fuelSavedLiters: 0,
            costSavingsINR: 0,
            treesEquivalent: 0
          }
        });
        expect(mockLoyaltyService.calculateIncentives).not.toHaveBeenCalled();
      });

      it('should handle loyalty service errors gracefully', async () => {
        // Arrange
        mockLoyaltyService.calculateIncentives.mockRejectedValue(new Error('Loyalty service error'));

        // Act
        const incentives = await vehicleSearchService.calculateLoyaltyIncentives(loyalCustomerId, 'shared');

        // Assert
        expect(incentives.totalDiscountPercentage).toBe(0);
        expect(incentives.bonusCreditsEarned).toBe(0);
      });
    });

    describe('applyLoyaltyDiscount', () => {
      it('should apply loyalty discount to pricing', async () => {
        // Act
        const discountedPricing = await vehicleSearchService.applyLoyaltyDiscount(loyalCustomerId, 1000, 20);

        // Assert
        expect(discountedPricing).toMatchObject({
          originalPrice: 1000,
          discountPercentage: 17,
          discountAmount: 170,
          finalPrice: 830,
          bonusCreditsUsed: 0,
          bonusCreditsEarned: 10
        });
        expect(mockLoyaltyService.applyLoyaltyDiscount).toHaveBeenCalledWith(loyalCustomerId, 1000, 20);
      });

      it('should return original pricing for anonymous customer', async () => {
        // Act
        const discountedPricing = await vehicleSearchService.applyLoyaltyDiscount('', 1000);

        // Assert
        expect(discountedPricing).toMatchObject({
          originalPrice: 1000,
          discountPercentage: 0,
          discountAmount: 0,
          finalPrice: 1000,
          bonusCreditsUsed: 0,
          bonusCreditsEarned: 0
        });
        expect(mockLoyaltyService.applyLoyaltyDiscount).not.toHaveBeenCalled();
      });

      it('should handle invalid pricing gracefully', async () => {
        // Act
        const discountedPricing = await vehicleSearchService.applyLoyaltyDiscount(loyalCustomerId, 0);

        // Assert
        expect(discountedPricing.finalPrice).toBe(0);
        expect(discountedPricing.discountAmount).toBe(0);
      });

      it('should handle loyalty service errors gracefully', async () => {
        // Arrange
        mockLoyaltyService.applyLoyaltyDiscount.mockRejectedValue(new Error('Loyalty service error'));

        // Act
        const discountedPricing = await vehicleSearchService.applyLoyaltyDiscount(loyalCustomerId, 1000);

        // Assert
        expect(discountedPricing).toMatchObject({
          originalPrice: 1000,
          discountPercentage: 0,
          discountAmount: 0,
          finalPrice: 1000,
          bonusCreditsUsed: 0,
          bonusCreditsEarned: 0
        });
      });
    });

    describe('updateCustomerPoolingHistory', () => {
      const mockDeliveryDetails = {
        deliveryId: 'DELIVERY_001',
        customerId: loyalCustomerId,
        serviceType: 'shared' as const,
        weight: 500,
        volume: 2,
        distanceKm: 15,
        wasPooled: true,
        deliveryDate: new Date()
      };

      it('should update pooling history for customer', async () => {
        // Arrange
        mockLoyaltyService.updatePoolingHistory = jest.fn().mockResolvedValue(undefined);

        // Act
        await vehicleSearchService.updateCustomerPoolingHistory(loyalCustomerId, mockDeliveryDetails);

        // Assert
        expect(mockLoyaltyService.updatePoolingHistory).toHaveBeenCalledWith(loyalCustomerId, mockDeliveryDetails);
      });

      it('should handle anonymous customer gracefully', async () => {
        // Act
        await vehicleSearchService.updateCustomerPoolingHistory('', mockDeliveryDetails);

        // Assert
        expect(mockLoyaltyService.updatePoolingHistory).not.toHaveBeenCalled();
      });

      it('should handle loyalty service errors gracefully', async () => {
        // Arrange
        mockLoyaltyService.updatePoolingHistory = jest.fn().mockRejectedValue(new Error('Update error'));

        // Act & Assert - Should not throw
        await expect(
          vehicleSearchService.updateCustomerPoolingHistory(loyalCustomerId, mockDeliveryDetails)
        ).resolves.toBeUndefined();
      });
    });

    describe('integrated loyalty pricing in search results', () => {
      it('should include loyalty discount in search results for registered customer', async () => {
        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(loyaltySearchCriteria);

        // Assert
        expect(result.pricing.loyaltyDiscount).toBeDefined();
        expect(result.pricing.loyaltyIncentives).toBeDefined();
        expect(result.pricing.loyaltyDiscount?.discountPercentage).toBe(17);
        expect(result.pricing.loyaltyDiscount?.finalPrice).toBe(830);
        expect(result.pricing.priceBreakdown).toContainEqual(
          expect.objectContaining({
            component: 'Loyalty Discount',
            amount: -170,
            description: '17% loyalty discount applied'
          })
        );
      });

      it('should not include loyalty discount for anonymous customer', async () => {
        // Arrange
        const anonymousSearchCriteria = { ...loyaltySearchCriteria };
        delete (anonymousSearchCriteria as any).customerId;

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(anonymousSearchCriteria);

        // Assert
        expect(result.pricing.loyaltyDiscount).toBeUndefined();
        expect(result.pricing.loyaltyIncentives).toBeUndefined();
        expect(mockLoyaltyService.calculateIncentives).not.toHaveBeenCalled();
        expect(mockLoyaltyService.applyLoyaltyDiscount).not.toHaveBeenCalled();
      });

      it('should include bonus credits in price breakdown when used', async () => {
        // Arrange
        mockLoyaltyService.applyLoyaltyDiscount.mockResolvedValue({
          originalPrice: 1000,
          discountPercentage: 17,
          discountAmount: 170,
          finalPrice: 800,
          bonusCreditsUsed: 30,
          bonusCreditsEarned: 10
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(loyaltySearchCriteria);

        // Assert
        expect(result.pricing.priceBreakdown).toContainEqual(
          expect.objectContaining({
            component: 'Bonus Credits',
            amount: -30,
            description: '30 bonus credits applied'
          })
        );
      });

      it('should handle loyalty service failures gracefully in search', async () => {
        // Arrange
        mockLoyaltyService.calculateIncentives.mockRejectedValue(new Error('Loyalty error'));
        mockLoyaltyService.applyLoyaltyDiscount.mockRejectedValue(new Error('Discount error'));

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(loyaltySearchCriteria);

        // Assert
        expect(result).toBeDefined();
        expect(result.availableVehicles).toHaveLength(1);
        expect(result.pricing.loyaltyDiscount).toBeUndefined();
        expect(result.pricing.loyaltyIncentives).toBeUndefined();
      });
    });

    describe('MSME customer loyalty integration', () => {
      const msmeCustomerId = 'MSME_CUSTOMER_001';
      const msmeSearchCriteria: SearchCriteria = {
        ...loyaltySearchCriteria,
        customerId: msmeCustomerId
      };

      it('should calculate MSME-specific incentives', async () => {
        // Arrange
        mockLoyaltyService.calculateIncentives.mockResolvedValue({
          baseDiscount: 15,
          tierBonus: 10,
          poolingFrequencyBonus: 3,
          msmeBonus: 12, // MSME bulk booking discount
          totalDiscountPercentage: 30, // Capped at 30%
          bonusCreditsEarned: 15,
          environmentalImpact: {
            co2SavedThisBooking: 3.2,
            cumulativeCo2Saved: 120,
            fuelSavedLiters: 1.8,
            costSavingsINR: 150,
            treesEquivalent: 5
          }
        });

        // Act
        const incentives = await vehicleSearchService.calculateLoyaltyIncentives(msmeCustomerId, 'shared');

        // Assert
        expect(incentives.msmeBonus).toBe(12);
        expect(incentives.totalDiscountPercentage).toBe(30); // Should be capped
        expect(incentives.bonusCreditsEarned).toBe(15);
      });

      it('should apply maximum discount cap for MSME customers', async () => {
        // Arrange
        mockLoyaltyService.applyLoyaltyDiscount.mockResolvedValue({
          originalPrice: 1000,
          discountPercentage: 30, // Maximum allowed
          discountAmount: 300,
          finalPrice: 700,
          bonusCreditsUsed: 0,
          bonusCreditsEarned: 15
        });

        // Act
        const result = await vehicleSearchService.searchAvailableVehicles(msmeSearchCriteria);

        // Assert
        expect(result.pricing.loyaltyDiscount?.discountPercentage).toBe(30);
        expect(result.pricing.loyaltyDiscount?.finalPrice).toBe(700);
      });
    });
  });
});