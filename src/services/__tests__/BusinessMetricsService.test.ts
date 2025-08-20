/**
 * Unit tests for BusinessMetricsService
 */

import { BusinessMetricsService } from '../BusinessMetricsService';
import {
  MetricsCalculationConfig,
  BusinessKPIs
} from '../../models/BusinessMetrics';
import { Route } from '../../models/Route';
import { Vehicle } from '../../models/Vehicle';

describe('BusinessMetricsService', () => {
  let service: BusinessMetricsService;
  let mockConfig: MetricsCalculationConfig;
  let mockRoute: Route;
  let mockVehicle: Vehicle;

  beforeEach(() => {
    mockConfig = {
      baselineFuelConsumptionRates: {
        diesel: 0.15, // liters per km
        petrol: 0.12,
        cng: 0.10,
        electric: 0.25 // kWh per km
      },
      co2EmissionFactors: {
        diesel: 2.68, // kg CO2 per liter
        petrol: 2.31,
        cng: 1.87,
        electric: 0.82 // kg CO2 per kWh (grid factor)
      },
      fuelCosts: {
        diesel: 90, // INR per liter
        petrol: 105,
        cng: 60,
        electric: 8 // INR per kWh
      },
      compliancePenaltyCosts: {
        timeRestriction: 5000, // INR
        zoneRestriction: 3000,
        pollutionViolation: 10000,
        oddEvenViolation: 2000,
        weightLimitViolation: 7500,
        capacityViolation: 1500
      },
      efficiencyTargets: {
        minimumEfficiencyImprovement: 20, // %
        targetComplianceRate: 100, // %
        targetFuelSavings: 15, // %
        targetCO2Reduction: 20 // %
      }
    };

    service = new BusinessMetricsService(mockConfig);

    mockRoute = {
      id: 'route_001',
      vehicleId: 'vehicle_001',
      stops: [
        {
          id: 'stop_001',
          sequence: 1,
          location: { latitude: 28.6139, longitude: 77.2090 },
          type: 'pickup',
          deliveryId: 'delivery_001',
          delivery: { shipment: { weight: 500, volume: 2 } },
          estimatedArrivalTime: new Date('2024-01-15T09:00:00Z'),
          estimatedDepartureTime: new Date('2024-01-15T09:15:00Z'),
          duration: 15,
          status: 'completed'
        },
        {
          id: 'stop_002',
          sequence: 2,
          location: { latitude: 28.7041, longitude: 77.1025 },
          type: 'delivery',
          deliveryId: 'delivery_001',
          delivery: { shipment: { weight: 500, volume: 2 } },
          estimatedArrivalTime: new Date('2024-01-15T10:00:00Z'),
          estimatedDepartureTime: new Date('2024-01-15T10:10:00Z'),
          duration: 10,
          status: 'completed'
        }
      ],
      estimatedDuration: 75, // minutes
      estimatedDistance: 25, // km
      estimatedFuelConsumption: 3.75, // liters
      trafficFactors: [],
      status: 'completed',
      createdAt: new Date('2024-01-15T08:00:00Z')
    };

    mockVehicle = {
      id: 'vehicle_001',
      type: 'truck',
      subType: 'light-truck',
      capacity: {
        weight: 2000, // kg
        volume: 10, // cubic meters
        maxDimensions: { length: 6, width: 2.5, height: 2.5 }
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
        vehicleAge: 2,
        registrationState: 'Delhi',
        manufacturingYear: 2022
      },
      accessPrivileges: {
        residentialZones: true,
        commercialZones: true,
        industrialZones: true,
        restrictedHours: false,
        pollutionSensitiveZones: true,
        narrowLanes: false
      },
      driverInfo: {
        id: 'driver_001',
        name: 'John Doe',
        licenseNumber: 'DL123456789',
        contactNumber: '+91-9876543210',
        workingHours: 8,
        maxWorkingHours: 12
      },
      lastUpdated: new Date('2024-01-15T08:00:00Z')
    };
  });

  describe('calculateRouteEfficiency', () => {
    it('should calculate route efficiency metrics correctly', () => {
      const baselineRoute = { distance: 30, time: 90 }; // 30km, 90 minutes

      const result = service.calculateRouteEfficiency(mockRoute, baselineRoute);

      expect(result).toMatchObject({
        routeId: 'route_001',
        totalDistance: 30,
        optimizedDistance: 25,
        distanceSavings: 5,
        distanceSavingsPercentage: expect.closeTo(16.67, 1),
        totalTime: 90,
        optimizedTime: 75,
        timeSavings: 15,
        timeSavingsPercentage: expect.closeTo(16.67, 1)
      });

      expect(result.baselineComparison.improvementPercentage).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle zero baseline values gracefully', () => {
      const baselineRoute = { distance: 0, time: 0 };

      const result = service.calculateRouteEfficiency(mockRoute, baselineRoute);

      expect(result.distanceSavingsPercentage).toBe(0);
      expect(result.timeSavingsPercentage).toBe(0);
      expect(result.distanceSavings).toBe(0);
      expect(result.timeSavings).toBe(0);
    });

    it('should not show negative savings', () => {
      const baselineRoute = { distance: 20, time: 60 }; // Shorter than optimized

      const result = service.calculateRouteEfficiency(mockRoute, baselineRoute);

      expect(result.distanceSavings).toBe(0);
      expect(result.timeSavings).toBe(0);
      expect(result.distanceSavingsPercentage).toBe(0);
      expect(result.timeSavingsPercentage).toBe(0);
    });
  });

  describe('calculateFuelSavings', () => {
    it('should calculate fuel savings metrics correctly for diesel vehicle', () => {
      const baselineDistance = 30; // km

      const result = service.calculateFuelSavings(mockRoute, mockVehicle, baselineDistance);

      expect(result).toMatchObject({
        routeId: 'route_001',
        vehicleId: 'vehicle_001',
        fuelType: 'diesel',
        baselineFuelConsumption: 4.5, // 30 * 0.15
        optimizedFuelConsumption: 3.75, // 25 * 0.15
        fuelSavings: 0.75,
        fuelSavingsPercentage: expect.closeTo(16.67, 1),
        costSavings: 67.5 // 0.75 * 90
      });

      expect(result.fuelEfficiencyKmPerLiter).toBeCloseTo(6.67, 1); // 25 / 3.75
      expect(result.vehicleCapacityUtilization).toBe(50); // 1000kg / 2000kg * 100
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate fuel savings for electric vehicle', () => {
      const electricVehicle = {
        ...mockVehicle,
        vehicleSpecs: { ...mockVehicle.vehicleSpecs, fuelType: 'electric' as const }
      };
      const baselineDistance = 30;

      const result = service.calculateFuelSavings(mockRoute, electricVehicle, baselineDistance);

      expect(result.fuelType).toBe('electric');
      expect(result.baselineFuelConsumption).toBe(7.5); // 30 * 0.25 kWh
      expect(result.optimizedFuelConsumption).toBe(6.25); // 25 * 0.25 kWh
      expect(result.costSavings).toBe(10); // 1.25 * 8 INR
    });

    it('should handle zero fuel consumption gracefully', () => {
      const zeroDistanceRoute = { ...mockRoute, estimatedDistance: 0 };
      const baselineDistance = 0;

      const result = service.calculateFuelSavings(zeroDistanceRoute, mockVehicle, baselineDistance);

      expect(result.fuelSavings).toBe(0);
      expect(result.costSavings).toBe(0);
      expect(result.fuelEfficiencyKmPerLiter).toBe(0);
    });
  });

  describe('trackComplianceViolation', () => {
    it('should track compliance violation correctly', () => {
      const violationData = {
        routeId: 'route_001',
        vehicleId: 'vehicle_001',
        violationType: 'time_restriction' as const,
        description: 'Vehicle in residential area during restricted hours',
        severity: 'high' as const,
        location: { latitude: 28.6139, longitude: 77.2090 },
        resolved: false,
        penaltyCost: 5000,
        preventedBySystem: true
      };

      const result = service.trackComplianceViolation(violationData);

      expect(result).toMatchObject({
        ...violationData,
        id: expect.stringMatching(/^violation_/),
        timestamp: expect.any(Date)
      });

      expect(result.id).toContain('violation_');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should generate unique violation IDs', () => {
      const violationData = {
        routeId: 'route_001',
        vehicleId: 'vehicle_001',
        violationType: 'zone_restriction' as const,
        description: 'Vehicle in restricted zone',
        severity: 'medium' as const,
        location: { latitude: 28.6139, longitude: 77.2090 },
        resolved: false,
        penaltyCost: 3000,
        preventedBySystem: false
      };

      const result1 = service.trackComplianceViolation(violationData);
      const result2 = service.trackComplianceViolation(violationData);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('calculateComplianceMetrics', () => {

    it('should calculate compliance metrics correctly', () => {
      // Add some test violations first
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      // Mock the trackComplianceViolation to set the timestamp within the date range
      const violation1 = service.trackComplianceViolation({
        routeId: 'route_001',
        vehicleId: 'vehicle_001',
        violationType: 'time_restriction',
        description: 'Time violation',
        severity: 'high',
        location: { latitude: 28.6139, longitude: 77.2090 },
        resolved: false,
        penaltyCost: 5000,
        preventedBySystem: true
      });
      // Manually set the timestamp to be within the date range
      violation1.timestamp = new Date('2024-01-15T10:00:00Z');

      const violation2 = service.trackComplianceViolation({
        routeId: 'route_002',
        vehicleId: 'vehicle_002',
        violationType: 'pollution_violation',
        description: 'Pollution violation',
        severity: 'critical',
        location: { latitude: 28.7041, longitude: 77.1025 },
        resolved: false,
        penaltyCost: 10000,
        preventedBySystem: false
      });
      // Manually set the timestamp to be within the date range
      violation2.timestamp = new Date('2024-01-15T14:00:00Z');

      const routes = [mockRoute, { ...mockRoute, id: 'route_002' }, { ...mockRoute, id: 'route_003' }];

      const result = service.calculateComplianceMetrics(routes, startDate, endDate);

      expect(result).toMatchObject({
        totalRoutes: 3,
        compliantRoutes: 1, // route_003 has no violations
        complianceRate: expect.closeTo(33.33, 1), // 1/3 * 100
        violationsByType: {
          timeRestrictions: 1,
          zoneRestrictions: 0,
          pollutionViolations: 1,
          oddEvenViolations: 0,
          weightLimitViolations: 0,
          capacityViolations: 0
        }
      });

      expect(result.violationDetails).toHaveLength(2);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle no violations correctly', () => {
      service.clearHistory(); // Clear existing violations
      const routes = [mockRoute];
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = service.calculateComplianceMetrics(routes, startDate, endDate);

      expect(result.complianceRate).toBe(100);
      expect(result.compliantRoutes).toBe(1);
      expect(result.violationDetails).toHaveLength(0);
    });

    it('should handle empty routes array', () => {
      const routes: Route[] = [];
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = service.calculateComplianceMetrics(routes, startDate, endDate);

      expect(result.complianceRate).toBe(100);
      expect(result.totalRoutes).toBe(0);
      expect(result.compliantRoutes).toBe(0);
    });
  });

  describe('calculateEnvironmentalImpact', () => {
    it('should calculate environmental impact metrics correctly', () => {
      const routes = [mockRoute];
      const vehicles = [mockVehicle];
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = service.calculateEnvironmentalImpact(routes, vehicles, startDate, endDate);

      // Expected calculations:
      // Optimized: 25km * 0.15 L/km = 3.75L
      // Baseline: 30km * 0.15 L/km = 4.5L (20% longer)
      // Fuel savings: 4.5 - 3.75 = 0.75L
      // CO2 optimized: 3.75L * 2.68 kg/L = 10.05 kg
      // CO2 baseline: 4.5L * 2.68 kg/L = 12.06 kg
      // CO2 savings: 12.06 - 10.05 = 2.01 kg

      expect(result.co2Emissions.totalEmissions).toBeCloseTo(10.05, 1);
      expect(result.co2Emissions.baselineEmissions).toBeCloseTo(12.06, 1);
      expect(result.co2Emissions.co2Savings).toBeCloseTo(2.01, 1);
      expect(result.co2Emissions.co2SavingsPercentage).toBeCloseTo(16.67, 1);

      expect(result.fuelConsumption.totalFuelConsumed).toBeCloseTo(3.75, 2);
      expect(result.fuelConsumption.fuelSavings).toBeCloseTo(0.75, 2);
      expect(result.fuelConsumption.fuelSavingsPercentage).toBeCloseTo(16.67, 1);

      expect(result.environmentalBenefits.treesEquivalent).toBeCloseTo(0.09, 2); // 2.01 / 22
      expect(result.sustainabilityScore).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle multiple vehicles with different fuel types', () => {
      const electricVehicle = {
        ...mockVehicle,
        id: 'vehicle_002',
        vehicleSpecs: { ...mockVehicle.vehicleSpecs, fuelType: 'electric' as const }
      };

      const electricRoute = {
        ...mockRoute,
        id: 'route_002',
        vehicleId: 'vehicle_002'
      };

      const routes = [mockRoute, electricRoute];
      const vehicles = [mockVehicle, electricVehicle];
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = service.calculateEnvironmentalImpact(routes, vehicles, startDate, endDate);

      expect(result.co2Emissions.emissionsByFuelType.has('diesel')).toBe(true);
      expect(result.co2Emissions.emissionsByFuelType.has('electric')).toBe(true);
      expect(result.fuelConsumption.consumptionByFuelType.has('diesel')).toBe(true);
      expect(result.fuelConsumption.consumptionByFuelType.has('electric')).toBe(true);
    });

    it('should handle routes without matching vehicles', () => {
      const routes = [{ ...mockRoute, vehicleId: 'nonexistent_vehicle' }];
      const vehicles = [mockVehicle];
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = service.calculateEnvironmentalImpact(routes, vehicles, startDate, endDate);

      expect(result.co2Emissions.totalEmissions).toBe(0);
      expect(result.fuelConsumption.totalFuelConsumed).toBe(0);
      expect(result.sustainabilityScore).toBe(0);
    });
  });

  describe('generateBusinessKPIs', () => {
    it('should generate comprehensive business KPIs', () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      // Add some test data with timestamps within the date range
      const routeEfficiency = service.calculateRouteEfficiency(mockRoute, { distance: 30, time: 90 });
      routeEfficiency.timestamp = new Date('2024-01-15T10:00:00Z');

      const fuelSavings = service.calculateFuelSavings(mockRoute, mockVehicle, 30);
      fuelSavings.timestamp = new Date('2024-01-15T10:00:00Z');

      const result = service.generateBusinessKPIs('daily', startDate, endDate);

      expect(result).toMatchObject({
        period: 'daily',
        routeEfficiency: {
          averageEfficiencyImprovement: expect.any(Number),
          totalDistanceSaved: expect.any(Number),
          totalTimeSaved: expect.any(Number),
          routesOptimized: 1,
          efficiencyTrend: expect.any(Array)
        },
        costSavings: {
          totalFuelCostSavings: expect.any(Number),
          totalOperationalSavings: expect.any(Number),
          averageSavingsPerRoute: expect.any(Number),
          savingsPerKm: expect.any(Number),
          roi: expect.any(Number)
        },
        operationalMetrics: {
          totalDeliveries: 1,
          onTimeDeliveryRate: expect.any(Number),
          vehicleUtilizationRate: expect.any(Number),
          hubEfficiencyRate: expect.any(Number),
          customerSatisfactionScore: expect.any(Number)
        },
        complianceMetrics: {
          overallComplianceRate: expect.any(Number),
          violationReductionRate: expect.any(Number),
          penaltyCostSavings: expect.any(Number),
          complianceTrend: expect.any(Array)
        },
        environmentalMetrics: {
          totalCO2Saved: expect.any(Number),
          totalFuelSaved: expect.any(Number),
          sustainabilityScore: expect.any(Number),
          environmentalTrend: expect.any(Array)
        }
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different time periods', () => {
      const periods: Array<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'> = 
        ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

      periods.forEach(period => {
        const startDate = new Date('2024-01-15T00:00:00Z');
        const endDate = new Date('2024-01-15T23:59:59Z');

        const result = service.generateBusinessKPIs(period, startDate, endDate);
        expect(result.period).toBe(period);
      });
    });
  });

  describe('validateEfficiencyTargets', () => {
    it('should validate efficiency targets correctly when targets are met', () => {
      const kpis: BusinessKPIs = {
        timestamp: new Date(),
        period: 'daily',
        routeEfficiency: {
          averageEfficiencyImprovement: 25, // Above 20% target
          totalDistanceSaved: 100,
          totalTimeSaved: 300,
          routesOptimized: 10,
          efficiencyTrend: []
        },
        costSavings: {
          totalFuelCostSavings: 5000,
          totalOperationalSavings: 5000,
          averageSavingsPerRoute: 500,
          savingsPerKm: 50,
          roi: 120
        },
        operationalMetrics: {
          totalDeliveries: 10,
          onTimeDeliveryRate: 95,
          vehicleUtilizationRate: 85,
          hubEfficiencyRate: 90,
          customerSatisfactionScore: 8.5
        },
        complianceMetrics: {
          overallComplianceRate: 100, // Meets 100% target
          violationReductionRate: 20,
          penaltyCostSavings: 15000,
          complianceTrend: []
        },
        environmentalMetrics: {
          totalCO2Saved: 500,
          totalFuelSaved: 200,
          sustainabilityScore: 85,
          environmentalTrend: []
        }
      };

      const result = service.validateEfficiencyTargets(kpis);

      expect(result.meetsRequirements).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.achievements).toHaveLength(2); // Route efficiency and compliance
    });

    it('should identify issues when targets are not met', () => {
      const kpis: BusinessKPIs = {
        timestamp: new Date(),
        period: 'daily',
        routeEfficiency: {
          averageEfficiencyImprovement: 15, // Below 20% target
          totalDistanceSaved: 50,
          totalTimeSaved: 150,
          routesOptimized: 5,
          efficiencyTrend: []
        },
        costSavings: {
          totalFuelCostSavings: 2000,
          totalOperationalSavings: 2000,
          averageSavingsPerRoute: 400,
          savingsPerKm: 40,
          roi: 80
        },
        operationalMetrics: {
          totalDeliveries: 5,
          onTimeDeliveryRate: 90,
          vehicleUtilizationRate: 75,
          hubEfficiencyRate: 80,
          customerSatisfactionScore: 7.5
        },
        complianceMetrics: {
          overallComplianceRate: 85, // Below 100% target
          violationReductionRate: 10,
          penaltyCostSavings: 5000,
          complianceTrend: []
        },
        environmentalMetrics: {
          totalCO2Saved: 200,
          totalFuelSaved: 80,
          sustainabilityScore: 65,
          environmentalTrend: []
        }
      };

      const result = service.validateEfficiencyTargets(kpis);

      expect(result.meetsRequirements).toBe(false);
      expect(result.issues).toHaveLength(2); // Route efficiency and compliance issues
      expect(result.achievements).toHaveLength(0);
    });
  });

  describe('getBenchmarkComparison', () => {
    it('should provide benchmark comparison for key metrics', () => {
      const kpis: BusinessKPIs = {
        timestamp: new Date(),
        period: 'daily',
        routeEfficiency: {
          averageEfficiencyImprovement: 25,
          totalDistanceSaved: 100,
          totalTimeSaved: 300,
          routesOptimized: 10,
          efficiencyTrend: []
        },
        costSavings: {
          totalFuelCostSavings: 5000,
          totalOperationalSavings: 5000,
          averageSavingsPerRoute: 500,
          savingsPerKm: 50,
          roi: 120
        },
        operationalMetrics: {
          totalDeliveries: 10,
          onTimeDeliveryRate: 95,
          vehicleUtilizationRate: 85,
          hubEfficiencyRate: 90,
          customerSatisfactionScore: 8.5
        },
        complianceMetrics: {
          overallComplianceRate: 98,
          violationReductionRate: 20,
          penaltyCostSavings: 15000,
          complianceTrend: []
        },
        environmentalMetrics: {
          totalCO2Saved: 500,
          totalFuelSaved: 200,
          sustainabilityScore: 85,
          environmentalTrend: []
        }
      };

      const result = service.getBenchmarkComparison(kpis);

      expect(result).toHaveLength(3);
      expect(result[0]?.metric).toBe('Route Efficiency Improvement');
      expect(result[1]?.metric).toBe('Compliance Rate');
      expect(result[2]?.metric).toBe('Sustainability Score');

      result.forEach(benchmark => {
        expect(benchmark).toMatchObject({
          metric: expect.any(String),
          currentValue: expect.any(Number),
          benchmarkValue: expect.any(Number),
          industryAverage: expect.any(Number),
          performanceRating: expect.stringMatching(/^(excellent|good|average|below_average|poor)$/),
          improvementPotential: expect.any(Number)
        });
      });
    });
  });

  describe('generateMetricsReport', () => {
    it('should generate comprehensive metrics report', () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      // Add test data with timestamps within the date range
      const routeEfficiency = service.calculateRouteEfficiency(mockRoute, { distance: 30, time: 90 });
      routeEfficiency.timestamp = new Date('2024-01-15T10:00:00Z');

      const fuelSavings = service.calculateFuelSavings(mockRoute, mockVehicle, 30);
      fuelSavings.timestamp = new Date('2024-01-15T10:00:00Z');
      const title = 'Daily Performance Report';
      const period = {
        start: startDate,
        end: endDate,
        type: 'daily' as const
      };
      const routes = [mockRoute];
      const vehicles = [mockVehicle];

      const result = service.generateMetricsReport(title, period, routes, vehicles);

      expect(result).toMatchObject({
        id: expect.stringMatching(/^report_/),
        title,
        period,
        generatedAt: expect.any(Date),
        summary: expect.any(Object),
        detailedMetrics: {
          routeEfficiency: expect.any(Array),
          fuelSavings: expect.any(Array),
          compliance: expect.any(Object),
          environmentalImpact: expect.any(Object)
        },
        insights: {
          topPerformingRoutes: expect.any(Array),
          areasForImprovement: expect.any(Array),
          complianceIssues: expect.any(Array),
          costSavingOpportunities: expect.any(Array),
          environmentalHighlights: expect.any(Array)
        },
        recommendations: {
          operationalImprovements: expect.any(Array),
          complianceActions: expect.any(Array),
          sustainabilityInitiatives: expect.any(Array),
          costOptimizations: expect.any(Array)
        }
      });

      expect(result.id).toContain('report_');
    });
  });

  describe('History Management', () => {
    it('should maintain history within limits', () => {
      // Add more than 1000 route efficiency records
      for (let i = 0; i < 1100; i++) {
        service.calculateRouteEfficiency(
          { ...mockRoute, id: `route_${i}` },
          { distance: 30, time: 90 }
        );
      }

      const history = service.getRouteEfficiencyHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should clear history when requested', () => {
      service.calculateRouteEfficiency(mockRoute, { distance: 30, time: 90 });
      service.calculateFuelSavings(mockRoute, mockVehicle, 30);

      expect(service.getRouteEfficiencyHistory().length).toBeGreaterThan(0);
      expect(service.getFuelSavingsHistory().length).toBeGreaterThan(0);

      service.clearHistory();

      expect(service.getRouteEfficiencyHistory().length).toBe(0);
      expect(service.getFuelSavingsHistory().length).toBe(0);
      expect(service.getComplianceHistory().length).toBe(0);
      expect(service.getEnvironmentalHistory().length).toBe(0);
      expect(service.getViolationsHistory().length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing vehicle data gracefully', () => {
      const incompleteVehicle = {
        ...mockVehicle,
        vehicleSpecs: { ...mockVehicle.vehicleSpecs, fuelType: 'unknown' as any }
      };

      expect(() => {
        service.calculateFuelSavings(mockRoute, incompleteVehicle, 30);
      }).not.toThrow();
    });

    it('should handle routes without creation dates', () => {
      const routeWithoutDate = { ...mockRoute };
      delete (routeWithoutDate as any).createdAt;
      const routes = [routeWithoutDate];
      const vehicles = [mockVehicle];
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const result = service.calculateEnvironmentalImpact(routes, vehicles, startDate, endDate);
      expect(result.co2Emissions.totalEmissions).toBe(0);
    });

    it('should handle empty data sets', () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      const kpis = service.generateBusinessKPIs('daily', startDate, endDate);
      
      expect(kpis.routeEfficiency.averageEfficiencyImprovement).toBe(0);
      expect(kpis.costSavings.totalFuelCostSavings).toBe(0);
      expect(kpis.environmentalMetrics.totalCO2Saved).toBe(0);
    });
  });
});