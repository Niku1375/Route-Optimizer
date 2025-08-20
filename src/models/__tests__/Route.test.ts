/**
 * Unit tests for Route model
 */

import { Route, RouteModel, RouteStop, TrafficFactor } from '../Route';
import { RouteStatus, ZoneType } from '../Common';

describe('Route Model', () => {
  let mockRoute: Route;
  let routeModel: RouteModel;

  beforeEach(() => {
    mockRoute = global.testUtils.generateTestRoute();
    routeModel = new RouteModel(mockRoute);
  });

  describe('Route Interface', () => {
    it('should have all required properties', () => {
      expect(mockRoute).toHaveProperty('id');
      expect(mockRoute).toHaveProperty('vehicleId');
      expect(mockRoute).toHaveProperty('driverId');
      expect(mockRoute).toHaveProperty('stops');
      expect(mockRoute).toHaveProperty('estimatedDuration');
      expect(mockRoute).toHaveProperty('estimatedDistance');
      expect(mockRoute).toHaveProperty('estimatedFuelConsumption');
      expect(mockRoute).toHaveProperty('trafficFactors');
      expect(mockRoute).toHaveProperty('status');
      expect(mockRoute).toHaveProperty('optimizationMetadata');
      expect(mockRoute).toHaveProperty('complianceValidation');
      expect(mockRoute).toHaveProperty('createdAt');
      expect(mockRoute).toHaveProperty('updatedAt');
    });

    it('should have valid route status', () => {
      const validStatuses: RouteStatus[] = ['planned', 'active', 'completed', 'cancelled'];
      expect(validStatuses).toContain(mockRoute.status);
    });

    it('should have positive distance and duration', () => {
      expect(mockRoute.estimatedDistance).toBeGreaterThan(0);
      expect(mockRoute.estimatedDuration).toBeGreaterThan(0);
      expect(mockRoute.estimatedFuelConsumption).toBeGreaterThan(0);
    });

    it('should have valid stops array', () => {
      expect(Array.isArray(mockRoute.stops)).toBe(true);
      expect(mockRoute.stops.length).toBeGreaterThan(0);
      
      mockRoute.stops.forEach((stop, index) => {
        expect(stop.sequence).toBe(index + 1);
        expect(['pickup', 'delivery', 'hub', 'waypoint']).toContain(stop.type);
        expect(['pending', 'arrived', 'in-progress', 'completed', 'skipped']).toContain(stop.status);
      });
    });

    it('should have valid optimization metadata', () => {
      expect(mockRoute.optimizationMetadata.algorithmUsed).toBeTruthy();
      expect(mockRoute.optimizationMetadata.optimizationTime).toBeGreaterThan(0);
      expect(mockRoute.optimizationMetadata.iterations).toBeGreaterThan(0);
      expect(Array.isArray(mockRoute.optimizationMetadata.constraintsApplied)).toBe(true);
      expect(typeof mockRoute.optimizationMetadata.fallbackUsed).toBe('boolean');
    });

    it('should have valid compliance validation', () => {
      expect(typeof mockRoute.complianceValidation.isCompliant).toBe('boolean');
      expect(mockRoute.complianceValidation.validatedAt).toBeInstanceOf(Date);
      expect(Array.isArray(mockRoute.complianceValidation.violations)).toBe(true);
      expect(Array.isArray(mockRoute.complianceValidation.warnings)).toBe(true);
      expect(Array.isArray(mockRoute.complianceValidation.exemptions)).toBe(true);
    });
  });

  describe('RouteModel Class', () => {
    it('should create instance from route data', () => {
      expect(routeModel).toBeInstanceOf(RouteModel);
      expect(routeModel.id).toBe(mockRoute.id);
      expect(routeModel.vehicleId).toBe(mockRoute.vehicleId);
    });

    it('should start route execution', () => {
      routeModel.status = 'planned';
      
      routeModel.startRoute();
      
      expect(routeModel.status).toBe('active');
      expect(routeModel.startedAt).toBeInstanceOf(Date);
      expect(routeModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should not start route if not planned', () => {
      routeModel.status = 'completed';
      const originalStatus = routeModel.status;
      
      routeModel.startRoute();
      
      expect(routeModel.status).toBe(originalStatus);
    });

    it('should complete route execution', () => {
      routeModel.status = 'active';
      routeModel.startedAt = new Date(Date.now() - 3600000); // 1 hour ago
      
      routeModel.completeRoute();
      
      expect(routeModel.status).toBe('completed');
      expect(routeModel.completedAt).toBeInstanceOf(Date);
      expect(routeModel.actualDuration).toBeGreaterThan(0);
    });

    it('should not complete route if not active', () => {
      routeModel.status = 'planned';
      const originalStatus = routeModel.status;
      
      routeModel.completeRoute();
      
      expect(routeModel.status).toBe(originalStatus);
      expect(routeModel.completedAt).toBeUndefined();
    });

    it('should cancel route execution', () => {
      routeModel.status = 'planned';
      
      routeModel.cancelRoute();
      
      expect(routeModel.status).toBe('cancelled');
      expect(routeModel.updatedAt).toBeInstanceOf(Date);
    });

    it('should cancel active route', () => {
      routeModel.status = 'active';
      
      routeModel.cancelRoute();
      
      expect(routeModel.status).toBe('cancelled');
    });

    it('should not cancel completed route', () => {
      routeModel.status = 'completed';
      const originalStatus = routeModel.status;
      
      routeModel.cancelRoute();
      
      expect(routeModel.status).toBe(originalStatus);
    });
  });

  describe('Stop Management', () => {
    it('should update stop status successfully', () => {
      const firstStop = routeModel.stops[0];
      expect(firstStop).toBeDefined();
      const stopId = firstStop!.id;
      const timestamp = new Date();
      
      const result = routeModel.updateStopStatus(stopId, 'arrived', timestamp);
      
      expect(result).toBe(true);
      expect(routeModel.stops[0]!.status).toBe('arrived');
      expect(routeModel.stops[0]!.actualArrivalTime).toEqual(timestamp);
    });

    it('should update departure time when completing stop', () => {
      const firstStop = routeModel.stops[0];
      expect(firstStop).toBeDefined();
      const stopId = firstStop!.id;
      const timestamp = new Date();
      
      const result = routeModel.updateStopStatus(stopId, 'completed', timestamp);
      
      expect(result).toBe(true);
      expect(routeModel.stops[0]!.status).toBe('completed');
      expect(routeModel.stops[0]!.actualDepartureTime).toEqual(timestamp);
    });

    it('should fail to update non-existent stop', () => {
      const result = routeModel.updateStopStatus('non-existent-id', 'arrived');
      
      expect(result).toBe(false);
    });

    it('should get next pending stop', () => {
      routeModel.stops[0]!.status = 'completed';
      routeModel.stops[1]!.status = 'pending';
      
      const nextStop = routeModel.getNextStop();
      
      expect(nextStop).toBeDefined();
      expect(nextStop!.id).toBe(routeModel.stops[1]!.id);
      expect(nextStop!.status).toBe('pending');
    });

    it('should return undefined when no pending stops', () => {
      routeModel.stops.forEach(stop => stop.status = 'completed');
      
      const nextStop = routeModel.getNextStop();
      
      expect(nextStop).toBeUndefined();
    });

    it('should get completed stops', () => {
      routeModel.stops[0]!.status = 'completed';
      routeModel.stops[1]!.status = 'pending';
      
      const completedStops = routeModel.getCompletedStops();
      
      expect(completedStops).toHaveLength(1);
      expect(completedStops[0]!.id).toBe(routeModel.stops[0]!.id);
    });
  });

  describe('Traffic Factor Management', () => {
    it('should add traffic factor', () => {
      const trafficFactor: TrafficFactor = {
        segmentId: 'segment-1',
        fromLocation: { latitude: 28.6139, longitude: 77.2090 },
        toLocation: { latitude: 28.7041, longitude: 77.1025 },
        trafficLevel: 'heavy',
        delayMinutes: 15,
        alternativeAvailable: true,
        timestamp: new Date()
      };
      
      routeModel.addTrafficFactor(trafficFactor);
      
      expect(routeModel.trafficFactors).toContain(trafficFactor);
    });

    it('should replace existing traffic factor for same segment', () => {
      const trafficFactor1: TrafficFactor = {
        segmentId: 'segment-1',
        fromLocation: { latitude: 28.6139, longitude: 77.2090 },
        toLocation: { latitude: 28.7041, longitude: 77.1025 },
        trafficLevel: 'moderate',
        delayMinutes: 10,
        alternativeAvailable: false,
        timestamp: new Date()
      };
      
      const trafficFactor2: TrafficFactor = {
        segmentId: 'segment-1',
        fromLocation: { latitude: 28.6139, longitude: 77.2090 },
        toLocation: { latitude: 28.7041, longitude: 77.1025 },
        trafficLevel: 'heavy',
        delayMinutes: 20,
        alternativeAvailable: true,
        timestamp: new Date()
      };
      
      routeModel.addTrafficFactor(trafficFactor1);
      routeModel.addTrafficFactor(trafficFactor2);
      
      expect(routeModel.trafficFactors).toHaveLength(1);
      expect(routeModel.trafficFactors[0]!.trafficLevel).toBe('heavy');
      expect(routeModel.trafficFactors[0]!.delayMinutes).toBe(20);
    });

    it('should calculate total traffic delay', () => {
      const trafficFactors: TrafficFactor[] = [
        {
          segmentId: 'segment-1',
          fromLocation: { latitude: 28.6139, longitude: 77.2090 },
          toLocation: { latitude: 28.7041, longitude: 77.1025 },
          trafficLevel: 'heavy',
          delayMinutes: 15,
          alternativeAvailable: true,
          timestamp: new Date()
        },
        {
          segmentId: 'segment-2',
          fromLocation: { latitude: 28.7041, longitude: 77.1025 },
          toLocation: { latitude: 28.5355, longitude: 77.3910 },
          trafficLevel: 'moderate',
          delayMinutes: 8,
          alternativeAvailable: false,
          timestamp: new Date()
        }
      ];
      
      trafficFactors.forEach(tf => routeModel.addTrafficFactor(tf));
      
      const totalDelay = routeModel.getTotalTrafficDelay();
      
      expect(totalDelay).toBe(23); // 15 + 8
    });
  });

  describe('Efficiency Metrics', () => {
    beforeEach(() => {
      routeModel.actualDistance = 30.5;
      routeModel.actualDuration = 150; // 2.5 hours
      routeModel.actualFuelConsumption = 4.2;
      routeModel.stops.forEach(stop => stop.duration = 15); // 15 minutes per stop
    });

    it('should calculate efficiency metrics correctly', () => {
      const metrics = routeModel.calculateEfficiencyMetrics();
      
      expect(metrics.totalDistance).toBe(30.5);
      expect(metrics.totalDuration).toBe(150);
      expect(metrics.fuelEfficiency).toBeCloseTo(7.26, 2); // 30.5 / 4.2
      expect(metrics.averageSpeed).toBeCloseTo(12.2, 1); // (30.5 / 150) * 60
      expect(metrics.stopEfficiency).toBeCloseTo(80, 0); // (120 / 150) * 100, where 120 = 150 - 30 (2 stops * 15 min)
      expect(metrics.complianceScore).toBe(100); // No violations
    });

    it('should use estimated values when actual values not available', () => {
      delete routeModel.actualDistance;
      delete routeModel.actualDuration;
      delete routeModel.actualFuelConsumption;
      
      const metrics = routeModel.calculateEfficiencyMetrics();
      
      expect(metrics.totalDistance).toBe(routeModel.estimatedDistance);
      expect(metrics.totalDuration).toBe(routeModel.estimatedDuration);
    });

    it('should calculate compliance score with violations', () => {
      routeModel.complianceValidation.violations = [
        {
          type: 'time_restriction',
          description: 'Test violation',
          severity: 'medium',
          location: { latitude: 28.6139, longitude: 77.2090 },
          timestamp: new Date()
        }
      ];
      
      const metrics = routeModel.calculateEfficiencyMetrics();
      
      expect(metrics.complianceScore).toBe(50); // 1 violation out of 2 stops = 50%
    });
  });

  describe('Optimization Suggestions', () => {
    it('should suggest stop reordering for routes with many stops', () => {
      // Add more stops to trigger reordering suggestion
      const additionalStops: RouteStop[] = [
        {
          id: 'stop-3',
          sequence: 3,
          location: { latitude: 28.5355, longitude: 77.3910 },
          type: 'delivery',
          estimatedArrivalTime: new Date(Date.now() + 7200000),
          estimatedDepartureTime: new Date(Date.now() + 7500000),
          duration: 10,
          status: 'pending'
        },
        {
          id: 'stop-4',
          sequence: 4,
          location: { latitude: 28.4595, longitude: 77.0266 },
          type: 'delivery',
          estimatedArrivalTime: new Date(Date.now() + 9000000),
          estimatedDepartureTime: new Date(Date.now() + 9300000),
          duration: 10,
          status: 'pending'
        }
      ];
      
      routeModel.stops.push(...additionalStops);
      
      const suggestions = routeModel.generateOptimizationSuggestions();
      
      const reorderSuggestion = suggestions.find(s => s.type === 'reorder_stops');
      expect(reorderSuggestion).toBeDefined();
      expect(reorderSuggestion!.estimatedImprovement.timeSavingMinutes).toBeGreaterThan(10);
    });

    it('should suggest alternative routes for heavy traffic', () => {
      const heavyTrafficFactor: TrafficFactor = {
        segmentId: 'segment-1',
        fromLocation: { latitude: 28.6139, longitude: 77.2090 },
        toLocation: { latitude: 28.7041, longitude: 77.1025 },
        trafficLevel: 'severe',
        delayMinutes: 25,
        alternativeAvailable: true,
        timestamp: new Date()
      };
      
      routeModel.addTrafficFactor(heavyTrafficFactor);
      
      const suggestions = routeModel.generateOptimizationSuggestions();
      
      const alternativeRouteSuggestion = suggestions.find(s => s.type === 'alternative_route');
      expect(alternativeRouteSuggestion).toBeDefined();
      expect(alternativeRouteSuggestion!.description).toContain('avoid heavy traffic');
    });

    it('should suggest time adjustments for compliance violations', () => {
      routeModel.complianceValidation.violations = [
        {
          type: 'time_restriction',
          description: 'Critical violation',
          severity: 'critical',
          location: { latitude: 28.6139, longitude: 77.2090 },
          timestamp: new Date()
        }
      ];
      
      const suggestions = routeModel.generateOptimizationSuggestions();
      
      const timeAdjustmentSuggestion = suggestions.find(s => s.type === 'time_adjustment');
      expect(timeAdjustmentSuggestion).toBeDefined();
      expect(timeAdjustmentSuggestion!.description).toContain('Adjust departure time');
    });
  });

  describe('Compliance Validation', () => {
    it('should validate route compliance', () => {
      const zoneTypes: ZoneType[] = ['commercial', 'residential'];
      
      const result = routeModel.validateRouteCompliance(zoneTypes);
      
      expect(result.isCompliant).toBeDefined();
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should detect time restriction violations', () => {
      // Set stop arrival time during restricted hours
      routeModel.stops[1]!.estimatedArrivalTime = new Date('2024-01-15T02:00:00'); // 2 AM
      const zoneTypes: ZoneType[] = ['commercial', 'residential'];
      
      const result = routeModel.validateRouteCompliance(zoneTypes);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]!.type).toBe('time_restriction');
      expect(result.violations[0]!.description).toContain('restricted hours');
    });

    it('should generate traffic warnings', () => {
      const severeTrafficFactor: TrafficFactor = {
        segmentId: 'segment-1',
        fromLocation: { latitude: 28.6139, longitude: 77.2090 },
        toLocation: { latitude: 28.7041, longitude: 77.1025 },
        trafficLevel: 'severe',
        delayMinutes: 30,
        alternativeAvailable: true,
        timestamp: new Date()
      };
      
      routeModel.addTrafficFactor(severeTrafficFactor);
      const zoneTypes: ZoneType[] = ['commercial', 'commercial'];
      
      const result = routeModel.validateRouteCompliance(zoneTypes);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]!.type).toBe('traffic_delay');
      expect(result.warnings[0]!.description).toContain('Severe traffic expected');
    });
  });
});