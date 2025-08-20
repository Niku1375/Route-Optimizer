/**
 * Vehicle Search Service with compliance filtering and alternative suggestion engine
 * Implements requirements 2.1, 2.2, 3.1, 3.2 for real-time vehicle availability API
 * Implements requirements 2.4, 2.5, 10.4, 10.6 for alternative suggestion engine
 */

import { Vehicle } from '../models/Vehicle';
import { GeoLocation } from '../models/GeoLocation';
import { VehicleType, ServiceType, TimeWindow } from '../models/Common';
import { FleetService, FleetSearchCriteria } from './FleetService';
import { DelhiComplianceService, ComplianceResult } from './DelhiComplianceService';
import { CustomerLoyaltyService } from './CustomerLoyaltyService';
import { LoyaltyIncentiveCalculation, DiscountedPricing } from '../models/CustomerLoyalty';
import { ValidationError } from '../utils/errors';

export interface SearchCriteria {
  pickupLocation: GeoLocation;
  deliveryLocation: GeoLocation;
  timeWindow: TimeWindow;
  capacity: CapacityRequirement;
  serviceType: ServiceType;
  vehicleTypePreference?: VehicleType[];
  customerId?: string;
}

export interface CapacityRequirement {
  weight: number;
  volume: number;
}

export interface VehicleSearchCriteria {
  location?: GeoLocation;
  pickupLocation?: GeoLocation;
  deliveryLocation?: GeoLocation;
  timeWindow: TimeWindow;
  capacity: CapacityRequirement;
  serviceType?: 'shared' | 'dedicated_premium';
  priorityLevel?: 'high' | 'urgent';
  vehicleTypePreference?: VehicleType[];
  customerId?: string;
}

export interface VehicleSearchResult {
  availableVehicles: VehicleAvailabilityInfo[];
  premiumOptions: PremiumVehicleOption[];
  alternatives: AlternativeOption[];
  pricing: PricingInfo;
  searchMetadata: SearchMetadata;
}

export interface VehicleAvailabilityInfo {
  vehicle: Vehicle;
  estimatedPickupTime: Date;
  estimatedDeliveryTime: Date;
  distance: number;
  complianceStatus: ComplianceResult;
  pricing: VehiclePricing;
}

export interface PremiumVehicleOption {
  vehicle: Vehicle;
  dedicatedService: boolean;
  guaranteedTimeWindow: TimeWindow;
  premiumPricing: {
    basePrice: number;
    premiumMultiplier: number;
    totalPrice: number;
    exclusivityFee: number;
  };
  priorityLevel: 'high' | 'urgent';
}

export interface AlternativeOption {
  type: 'vehicle_type' | 'time_window' | 'pickup_location' | 'service_type';
  suggestion: string;
  estimatedSavings?: number;
  alternativeVehicles?: Vehicle[];
  alternativeTimeWindows?: TimeWindow[];
  alternativeLocations?: GeoLocation[];
}

export interface PricingInfo {
  basePrice: number;
  distancePrice: number;
  timePrice: number;
  totalPrice: number;
  total: number;
  currency: string;
  priceBreakdown: PriceBreakdown[];
  loyaltyDiscount?: DiscountedPricing;
  loyaltyIncentives?: LoyaltyIncentiveCalculation;
}

export interface PriceBreakdown {
  component: string;
  amount: number;
  description: string;
}

export interface VehiclePricing {
  baseRate: number;
  distanceRate: number;
  timeRate: number;
  totalEstimate: number;
  currency: string;
}

export interface SearchMetadata {
  searchDurationMs: number;
  totalVehiclesEvaluated: number;
  vehiclesEvaluated: number;
  filtersApplied: string[];
  complianceFiltersApplied: string[];
  cacheHit: boolean;
}

export interface ViolationAnalysis {
  totalVehicles: number;
  compliantVehicles: Vehicle[];
  violatedVehicles: Vehicle[];
  violationCounts: Record<string, number>;
  mostCommonViolation: string;
}

interface CachedSearchResult {
  result: VehicleSearchResult;
  timestamp: number;
}

/**
 * Vehicle Search Service implementation for real-time vehicle availability with alternative suggestions
 */
export class VehicleSearchService {
  private fleetService: FleetService;
  private complianceService: DelhiComplianceService;
  private loyaltyService: CustomerLoyaltyService;
  private pricingService: any; // Placeholder for pricing service
  private routingService: any; // Placeholder for routing service
  private searchCache: Map<string, CachedSearchResult> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache TTL
  private readonly SEARCH_TIMEOUT_MS = 5000; // 5 seconds search timeout

  constructor(
    fleetService: FleetService,
    complianceService: DelhiComplianceService,
    loyaltyService: CustomerLoyaltyService,
    pricingService?: any,
    routingService?: any
  ) {
    this.fleetService = fleetService;
    this.complianceService = complianceService;
    this.loyaltyService = loyaltyService;
    this.pricingService = pricingService || {
      calculateVehiclePricing: async (_vehicle: Vehicle) => ({
        baseRate: 100,
        distanceRate: 2.5,
        timeRate: 1.5,
        totalEstimate: 200,
        currency: 'INR'
      })
    };
    this.routingService = routingService || {
      calculateTravelTime: async (_from: any, _to: any) => 30 // 30 minutes default
    };
  }

  /**
   * Searches for available vehicles based on criteria with compliance filtering
   * @param criteria - Search criteria including location, capacity, and service type
   * @returns Promise<VehicleSearchResult> - Available vehicles with compliance status
   */
  async searchAvailableVehicles(criteria: SearchCriteria): Promise<VehicleSearchResult> {
    const searchStartTime = Date.now();
    const searchId = this.generateSearchId();

    try {
      // Validate search criteria
      this.validateSearchCriteria(criteria);

      // Check cache first
      const cacheKey = this.generateCacheKey(criteria);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult.result,
          searchMetadata: {
            ...cachedResult.result.searchMetadata,
            searchId,
            cacheHit: true
          }
        };
      }

      // Get available vehicles from fleet
      const fleetCriteria: FleetSearchCriteria = {
        status: ['available'],
        location: {
          center: criteria.pickupLocation,
          radiusKm: 50 // 50km search radius
        },
        capacity: {
          minWeight: criteria.capacity.weight,
          minVolume: criteria.capacity.volume
        }
      };

      // Add vehicle types if specified
      if (criteria.vehicleTypePreference && criteria.vehicleTypePreference.length > 0) {
        fleetCriteria.vehicleTypes = criteria.vehicleTypePreference;
      }

      const availableVehicles = await this.fleetService.getVehicles(fleetCriteria);

      // Filter vehicles by compliance
      const complianceFiltersApplied: string[] = [];
      const compliantVehicles: VehicleAvailabilityInfo[] = [];
      const premiumOptions: PremiumVehicleOption[] = [];

      for (const vehicle of availableVehicles) {
        // Check compliance for the route
        const complianceResult = await this.complianceService.validateVehicleMovement(
          vehicle,
          {
            id: 'temp-route',
            stops: [
              { location: criteria.pickupLocation, type: 'pickup' },
              { location: criteria.deliveryLocation, type: 'delivery' }
            ],
            vehicleId: vehicle.id,
            status: 'planned',
            estimatedDuration: 0,
            estimatedDistance: 0
          },
          (criteria.timeWindow.earliest || criteria.timeWindow.start || new Date())
        );

        if (complianceResult.isCompliant) {
          const distance = this.calculateDistance(vehicle.location, criteria.pickupLocation);
          const estimatedPickupTime = this.calculateEstimatedTime(
            new Date(),
            distance,
            30 // 30 km/h average speed
          );
          const deliveryDistance = this.calculateDistance(
            criteria.pickupLocation,
            criteria.deliveryLocation
          );
          const estimatedDeliveryTime = this.calculateEstimatedTime(
            estimatedPickupTime,
            deliveryDistance,
            25 // 25 km/h average delivery speed
          );

          const pricing = this.calculateVehiclePricing(vehicle, distance + deliveryDistance);

          const vehicleInfo: VehicleAvailabilityInfo = {
            vehicle,
            estimatedPickupTime,
            estimatedDeliveryTime,
            distance: distance + deliveryDistance,
            complianceStatus: complianceResult,
            pricing
          };

          if (criteria.serviceType === 'shared') {
            compliantVehicles.push(vehicleInfo);
          } else if (criteria.serviceType === 'dedicated_premium') {
            const premiumOption: PremiumVehicleOption = {
              vehicle,
              dedicatedService: true,
              guaranteedTimeWindow: {
                earliest: estimatedPickupTime,
                latest: new Date(estimatedDeliveryTime.getTime() + 30 * 60 * 1000) // +30 min buffer
              },
              premiumPricing: {
                basePrice: pricing.baseRate,
                premiumMultiplier: 1.8,
                totalPrice: pricing.totalEstimate * 1.8,
                exclusivityFee: pricing.totalEstimate * 0.8
              },
              priorityLevel: 'high'
            };
            premiumOptions.push(premiumOption);
          }
        } else {
          // Track compliance filters that excluded vehicles
          complianceResult.violations.forEach(violation => {
            if (!complianceFiltersApplied.includes(violation.type)) {
              complianceFiltersApplied.push(violation.type);
            }
          });
        }
      }

      // Generate alternatives using enhanced suggestion engine
      const alternatives = await this.generateAlternatives(criteria, availableVehicles);

      // Calculate overall pricing with loyalty discounts
      const pricing = await this.calculateOverallPricing(compliantVehicles, premiumOptions, criteria.customerId, criteria.serviceType);

      const searchDurationMs = Date.now() - searchStartTime;
      const result: VehicleSearchResult = {
        availableVehicles: compliantVehicles,
        premiumOptions,
        alternatives,
        pricing,
        searchMetadata: {
          searchId,
          timestamp: new Date(),
          searchDurationMs,
          totalVehiclesEvaluated: availableVehicles.length,
          complianceFiltersApplied,
          cacheHit: false
        }
      };

      // Cache the result
      this.cacheResult(cacheKey, result);

      return result;

    } catch (error) {
      const searchDurationMs = Date.now() - searchStartTime;
      throw new ValidationError(
        `Vehicle search failed after ${searchDurationMs}ms: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates vehicle compliance for a specific route
   * @param vehicleId - ID of vehicle to validate
   * @param route - Route to validate against
   * @returns Promise<ComplianceResult> - Compliance validation result
   */
  async validateCompliance(vehicleId: string, route: any): Promise<ComplianceResult> {
    const vehicle = await this.fleetService.getVehicle(vehicleId);
    return this.complianceService.validateVehicleMovement(vehicle, route, new Date());
  }

  /**
   * Gets cached search results if available and not expired
   * @param cacheKey - Cache key for the search
   * @returns VehicleSearchResult or null if not found/expired
   */
  getCachedResults(cacheKey: string): VehicleSearchResult | null {
    const cached = this.getCachedResult(cacheKey);
    return cached ? cached.result : null;
  }

  /**
   * Clears expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.searchCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL_MS) {
        this.searchCache.delete(key);
      }
    }
  }
  /**
    * Generates comprehensive alternatives when no compliant vehicles are found
    * Implements requirements 2.4, 2.5, 10.4, 10.6 for alternative suggestion engine
    * @param criteria - Original search criteria
    * @param availableVehicles - All available vehicles (including non-compliant)
    * @returns Promise<AlternativeOption[]> - Array of alternative options
    */
  private async generateAlternatives(
    criteria: SearchCriteria,
    availableVehicles: Vehicle[]
  ): Promise<AlternativeOption[]> {
    const alternatives: AlternativeOption[] = [];

    // Get compliance violations for analysis
    const violationAnalysis = await this.analyzeComplianceViolations(criteria, availableVehicles);

    // 1. Alternative vehicle types based on compliance analysis
    const vehicleTypeAlternatives = await this.suggestAlternativeVehicleTypes(
      criteria,
      availableVehicles,
      violationAnalysis
    );
    alternatives.push(...vehicleTypeAlternatives);

    // 2. Alternative time windows based on restrictions
    const timeWindowAlternatives = await this.suggestAlternativeTimeWindows(
      criteria,
      availableVehicles,
      violationAnalysis
    );
    alternatives.push(...timeWindowAlternatives);

    // 3. Alternative pickup locations for better vehicle availability
    const pickupLocationAlternatives = await this.suggestAlternativePickupLocations(
      criteria,
      availableVehicles
    );
    alternatives.push(...pickupLocationAlternatives);

    // 4. Alternative service types with cost implications
    const serviceTypeAlternatives = this.suggestAlternativeServiceTypes(criteria);
    alternatives.push(...serviceTypeAlternatives);

    // 5. Vehicle class substitution recommendations
    const classSubstitutionAlternatives = await this.suggestVehicleClassSubstitutions(
      criteria,
      availableVehicles,
      violationAnalysis
    );
    alternatives.push(...classSubstitutionAlternatives);

    return alternatives;
  }

  /**
   * Analyzes compliance violations across available vehicles to understand restriction patterns
   * @param criteria - Search criteria
   * @param availableVehicles - Available vehicles to analyze
   * @returns Promise<ViolationAnalysis> - Analysis of common violations
   */
  private async analyzeComplianceViolations(
    criteria: SearchCriteria,
    availableVehicles: Vehicle[]
  ): Promise<ViolationAnalysis> {
    const violationCounts: Record<string, number> = {};
    const violatedVehicles: Vehicle[] = [];
    const compliantVehicles: Vehicle[] = [];

    for (const vehicle of availableVehicles) {
      const complianceResult = await this.complianceService.validateVehicleMovement(
        vehicle,
        {
          id: 'temp-analysis-route',
          stops: [
            { location: criteria.pickupLocation, type: 'pickup' },
            { location: criteria.deliveryLocation, type: 'delivery' }
          ],
          vehicleId: vehicle.id,
          status: 'planned',
          estimatedDuration: 0,
          estimatedDistance: 0
        },
        (criteria.timeWindow.earliest || criteria.timeWindow.start || new Date())
      );

      if (complianceResult.isCompliant) {
        compliantVehicles.push(vehicle);
      } else {
        violatedVehicles.push(vehicle);
        complianceResult.violations.forEach(violation => {
          violationCounts[violation.type] = (violationCounts[violation.type] || 0) + 1;
        });
      }
    }

    return {
      totalVehicles: availableVehicles.length,
      compliantVehicles,
      violatedVehicles,
      violationCounts,
      mostCommonViolation: Object.keys(violationCounts).length > 0
        ? Object.keys(violationCounts).reduce((a, b) =>
          (violationCounts[a] || 0) > (violationCounts[b] || 0) ? a : b
        )
        : 'none'
    };
  }

  /**
   * Suggests alternative vehicle types based on compliance violations
   * @param criteria - Original search criteria
   * @param availableVehicles - Available vehicles
   * @param violationAnalysis - Analysis of compliance violations
   * @returns Promise<AlternativeOption[]> - Vehicle type alternatives
   */
  private async suggestAlternativeVehicleTypes(
    criteria: SearchCriteria,
    availableVehicles: Vehicle[],
    violationAnalysis: ViolationAnalysis
  ): Promise<AlternativeOption[]> {
    const alternatives: AlternativeOption[] = [];

    // If time restrictions are the main issue, suggest smaller vehicles
    if (violationAnalysis.mostCommonViolation === 'time_restriction') {
      const allowedTypes: VehicleType[] = ['tempo', 'van', 'three-wheeler', 'electric'];
      const suggestedVehicles = availableVehicles.filter(v =>
        allowedTypes.includes(v.type) &&
        !criteria.vehicleTypePreference?.includes(v.type)
      );

      if (suggestedVehicles.length > 0) {
        alternatives.push({
          type: 'vehicle_type',
          suggestion: 'Use smaller vehicles (tempo, van, three-wheeler) that can operate during restricted hours',
          alternativeVehicles: suggestedVehicles,
          estimatedSavings: 15 // Potential cost savings from using smaller vehicles
        });
      }
    }

    // If odd-even violations are common, suggest exempt vehicles
    if (violationAnalysis.mostCommonViolation === 'odd_even_violation') {
      const exemptVehicles = availableVehicles.filter(v =>
        v.type === 'electric' ||
        v.vehicleSpecs.fuelType === 'cng' ||
        v.type === 'three-wheeler'
      );

      if (exemptVehicles.length > 0) {
        alternatives.push({
          type: 'vehicle_type',
          suggestion: 'Use electric, CNG, or three-wheeler vehicles (exempt from odd-even rules)',
          alternativeVehicles: exemptVehicles
        });
      }
    }

    // If pollution violations are common, suggest cleaner vehicles
    if (violationAnalysis.mostCommonViolation === 'pollution_violation') {
      const cleanVehicles = availableVehicles.filter(v =>
        v.type === 'electric' ||
        v.compliance.pollutionLevel === 'BS6'
      );

      if (cleanVehicles.length > 0) {
        alternatives.push({
          type: 'vehicle_type',
          suggestion: 'Use electric or BS6 vehicles for better pollution compliance',
          alternativeVehicles: cleanVehicles
        });
      }
    }

    // General vehicle type alternatives if preferences are too restrictive
    if (criteria.vehicleTypePreference && criteria.vehicleTypePreference.length > 0) {
      const allTypes: VehicleType[] = ['truck', 'tempo', 'van', 'three-wheeler', 'electric'];
      const suggestedTypes = allTypes.filter(
        type => !criteria.vehicleTypePreference!.includes(type)
      );

      if (suggestedTypes.length > 0) {
        const alternativeVehicles = availableVehicles.filter(v => suggestedTypes.includes(v.type));
        if (alternativeVehicles.length > 0) {
          alternatives.push({
            type: 'vehicle_type',
            suggestion: `Consider ${suggestedTypes.join(', ')} vehicles for better availability`,
            alternativeVehicles
          });
        }
      }
    }

    return alternatives;
  }

  /**
   * Suggests alternative time windows based on restriction analysis
   * @param criteria - Original search criteria
   * @param availableVehicles - Available vehicles
   * @param violationAnalysis - Analysis of compliance violations
   * @returns Promise<AlternativeOption[]> - Time window alternatives
   */
  private async suggestAlternativeTimeWindows(
    criteria: SearchCriteria,
    availableVehicles: Vehicle[],
    violationAnalysis: ViolationAnalysis
  ): Promise<AlternativeOption[]> {
    const alternatives: AlternativeOption[] = [];
    const currentHour = (criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()).getHours();

    // If time restrictions are causing issues
    if (violationAnalysis.mostCommonViolation === 'time_restriction' ||
      (currentHour >= 23 || currentHour <= 7)) {

      const alternativeTimeWindows: TimeWindow[] = [];

      // Suggest morning window (7 AM - 11 AM)
      if (currentHour < 7 || currentHour >= 23) {
        const morningStart = new Date((criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()));
        morningStart.setHours(7, 0, 0, 0);
        if (morningStart.getDate() !== (criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()).getDate()) {
          morningStart.setDate(morningStart.getDate() + 1);
        }

        alternativeTimeWindows.push({
          earliest: morningStart,
          latest: new Date(morningStart.getTime() + 4 * 60 * 60 * 1000) // +4 hours
        });
      }

      // Suggest afternoon window (2 PM - 6 PM)
      const afternoonStart = new Date((criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()));
      afternoonStart.setHours(14, 0, 0, 0);
      if (afternoonStart <= (criteria.timeWindow.earliest || criteria.timeWindow.start || new Date())) {
        afternoonStart.setDate(afternoonStart.getDate() + 1);
      }

      alternativeTimeWindows.push({
        earliest: afternoonStart,
        latest: new Date(afternoonStart.getTime() + 4 * 60 * 60 * 1000) // +4 hours
      });

      if (alternativeTimeWindows.length > 0) {
        alternatives.push({
          type: 'time_window',
          suggestion: 'Schedule delivery during unrestricted hours (7 AM - 11 PM) for more vehicle options',
          alternativeTimeWindows
        });
      }
    }

    // Suggest next day delivery if odd-even is the issue
    if (violationAnalysis.mostCommonViolation === 'odd_even_violation') {
      const nextDay = new Date((criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()).getTime() + 24 * 60 * 60 * 1000);
      alternatives.push({
        type: 'time_window',
        suggestion: 'Schedule for next day to avoid odd-even restrictions',
        alternativeTimeWindows: [{
          earliest: nextDay,
          latest: new Date(nextDay.getTime() + 8 * 60 * 60 * 1000) // +8 hours window
        }]
      });
    }

    return alternatives;
  }

  /**
   * Suggests alternative pickup locations for better vehicle availability
   * @param criteria - Original search criteria
   * @param availableVehicles - Available vehicles
   * @returns Promise<AlternativeOption[]> - Pickup location alternatives
   */
  private async suggestAlternativePickupLocations(
    criteria: SearchCriteria,
    availableVehicles: Vehicle[]
  ): Promise<AlternativeOption[]> {
    const alternatives: AlternativeOption[] = [];

    // Find nearby locations with better vehicle availability
    const nearbyLocations = this.generateNearbyLocations(criteria.pickupLocation, 5); // 5km radius

    for (const location of nearbyLocations) {
      const nearbyVehicles = availableVehicles.filter(vehicle => {
        const distance = this.calculateDistance(vehicle.location, location);
        return distance <= 10; // Within 10km of alternative location
      });

      if (nearbyVehicles.length > 0) {
        alternatives.push({
          type: 'pickup_location',
          suggestion: `Consider pickup from ${location.address} (${nearbyVehicles.length} vehicles available)`,
          alternativeLocations: [location],
          alternativeVehicles: nearbyVehicles
        });
      }
    }

    // Suggest hub locations if available
    const hubLocations = await this.getAvailableHubLocations(criteria.pickupLocation);
    if (hubLocations.length > 0) {
      alternatives.push({
        type: 'pickup_location',
        suggestion: 'Consider pickup from nearby hub locations for guaranteed vehicle availability',
        alternativeLocations: hubLocations
      });
    }

    return alternatives;
  }

  /**
   * Suggests alternative service types with cost implications
   * @param criteria - Original search criteria
   * @returns AlternativeOption[] - Service type alternatives
   */
  private suggestAlternativeServiceTypes(criteria: SearchCriteria): AlternativeOption[] {
    const alternatives: AlternativeOption[] = [];

    if (criteria.serviceType === 'dedicated_premium') {
      alternatives.push({
        type: 'service_type',
        suggestion: 'Shared service available for 40-60% cost savings with flexible timing',
        estimatedSavings: 50 // percentage
      });
    } else if (criteria.serviceType === 'shared') {
      alternatives.push({
        type: 'service_type',
        suggestion: 'Premium dedicated service available for guaranteed delivery windows',
        estimatedSavings: -80 // negative indicates additional cost
      });
    }

    return alternatives;
  }

  /**
   * Suggests vehicle class substitutions based on capacity and compliance
   * @param criteria - Original search criteria
   * @param availableVehicles - Available vehicles
   * @param violationAnalysis - Analysis of compliance violations
   * @returns Promise<AlternativeOption[]> - Class substitution alternatives
   */
  private async suggestVehicleClassSubstitutions(
    criteria: SearchCriteria,
    availableVehicles: Vehicle[],
    _violationAnalysis: ViolationAnalysis
  ): Promise<AlternativeOption[]> {
    const alternatives: AlternativeOption[] = [];

    // Suggest load splitting if capacity is the issue
    const oversizedVehicles = availableVehicles.filter(v =>
      v.capacity.weight >= criteria.capacity.weight * 2 ||
      v.capacity.volume >= criteria.capacity.volume * 2
    );

    if (oversizedVehicles.length > 0) {
      alternatives.push({
        type: 'vehicle_type',
        suggestion: 'Split load across multiple smaller vehicles for better compliance and cost efficiency',
        alternativeVehicles: oversizedVehicles.slice(0, 2), // Suggest up to 2 vehicles
        estimatedSavings: 20
      });
    }

    // Suggest capacity optimization
    const rightSizedVehicles = availableVehicles.filter(v =>
      v.capacity.weight >= criteria.capacity.weight &&
      v.capacity.weight <= criteria.capacity.weight * 1.5 &&
      v.capacity.volume >= criteria.capacity.volume &&
      v.capacity.volume <= criteria.capacity.volume * 1.5
    );

    if (rightSizedVehicles.length > 0) {
      alternatives.push({
        type: 'vehicle_type',
        suggestion: 'Use right-sized vehicles to optimize cost and compliance',
        alternativeVehicles: rightSizedVehicles,
        estimatedSavings: 15
      });
    }

    // Suggest electric vehicle substitution for environmental benefits
    const electricVehicles = availableVehicles.filter(v => v.type === 'electric');
    if (electricVehicles.length > 0 && !criteria.vehicleTypePreference?.includes('electric')) {
      alternatives.push({
        type: 'vehicle_type',
        suggestion: 'Use electric vehicles for environmental benefits and regulatory advantages',
        alternativeVehicles: electricVehicles,
        estimatedSavings: 10 // Environmental and potential cost benefits
      });
    }

    return alternatives;
  }

  /**
   * Generates nearby locations within specified radius
   * @param centerLocation - Center location to search around
   * @param radiusKm - Search radius in kilometers
   * @returns GeoLocation[] - Array of nearby locations
   */
  private generateNearbyLocations(centerLocation: GeoLocation, _radiusKm: number): GeoLocation[] {
    // This is a simplified implementation - in production, this would query a location service
    const locations: GeoLocation[] = [];

    // Generate sample nearby locations (in production, this would be from a database/API)
    const offsets = [
      { lat: 0.01, lng: 0.01, name: 'Commercial Hub North' },
      { lat: -0.01, lng: 0.01, name: 'Commercial Hub South' },
      { lat: 0.01, lng: -0.01, name: 'Commercial Hub East' },
      { lat: -0.01, lng: -0.01, name: 'Commercial Hub West' }
    ];

    offsets.forEach(offset => {
      locations.push({
        latitude: centerLocation.latitude + offset.lat,
        longitude: centerLocation.longitude + offset.lng,
        address: offset.name,
        timestamp: new Date()
      });
    });

    return locations;
  }

  /**
   * Gets available hub locations near the pickup location
   * @param pickupLocation - Original pickup location
   * @returns Promise<GeoLocation[]> - Available hub locations
   */
  private async getAvailableHubLocations(pickupLocation: GeoLocation): Promise<GeoLocation[]> {
    // This would typically query a hub service - simplified for implementation
    const hubLocations: GeoLocation[] = [
      {
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Central Delhi Hub - Connaught Place',
        timestamp: new Date()
      },
      {
        latitude: 28.7041,
        longitude: 77.1025,
        address: 'North Delhi Hub - Rohini',
        timestamp: new Date()
      },
      {
        latitude: 28.5355,
        longitude: 77.3910,
        address: 'East Delhi Hub - Noida',
        timestamp: new Date()
      }
    ];

    // Filter hubs within reasonable distance (50km)
    return hubLocations.filter(hub => {
      const distance = this.calculateDistance(pickupLocation, hub);
      return distance <= 50;
    });
  }  /**

   * Validates search criteria
   * @param criteria - Search criteria to validate
   * @throws ValidationError if criteria is invalid
   */
  private validateSearchCriteria(criteria: SearchCriteria): void {
    if (!criteria.pickupLocation || !criteria.deliveryLocation) {
      throw new ValidationError('Pickup and delivery locations are required');
    }

    if (!criteria.timeWindow || !(criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()) || !(criteria.timeWindow.latest || criteria.timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000))) {
      throw new ValidationError('Valid time window is required');
    }

    if ((criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()) >= (criteria.timeWindow.latest || criteria.timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000))) {
      throw new ValidationError('Time window earliest must be before latest');
    }

    if (!criteria.capacity || criteria.capacity.weight <= 0 || criteria.capacity.volume <= 0) {
      throw new ValidationError('Valid capacity requirements are required');
    }

    if (!criteria.serviceType || !['shared', 'dedicated_premium'].includes(criteria.serviceType)) {
      throw new ValidationError('Valid service type is required (shared or dedicated_premium)');
    }
  }

  /**
   * Calculates distance between two geographic locations using Haversine formula
   * @param location1 - First location
   * @param location2 - Second location
   * @returns Distance in kilometers
   */
  private calculateDistance(location1: GeoLocation, location2: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(location2.latitude - location1.latitude);
    const dLon = this.toRadians(location2.longitude - location1.longitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(location1.latitude)) * Math.cos(this.toRadians(location2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converts degrees to radians
   * @param degrees - Degrees to convert
   * @returns Radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculates estimated time based on distance and speed
   * @param startTime - Start time
   * @param distanceKm - Distance in kilometers
   * @param speedKmh - Speed in km/h
   * @returns Estimated arrival time
   */
  private calculateEstimatedTime(startTime: Date, distanceKm: number, speedKmh: number): Date {
    const travelTimeHours = distanceKm / speedKmh;
    const travelTimeMs = travelTimeHours * 60 * 60 * 1000;
    return new Date(startTime.getTime() + travelTimeMs);
  }

  /**
   * Calculates vehicle-specific pricing
   * @param vehicle - Vehicle to calculate pricing for
   * @param totalDistance - Total distance in kilometers
   * @returns VehiclePricing - Pricing breakdown
   */
  private calculateVehiclePricing(vehicle: Vehicle, totalDistance: number): VehiclePricing {
    // Base rates by vehicle type (INR)
    const baseRates: Record<VehicleType, number> = {
      'truck': 500,
      'tempo': 300,
      'van': 250,
      'three-wheeler': 150,
      'electric': 200
    };

    // Distance rates by vehicle type (INR per km)
    const distanceRates: Record<VehicleType, number> = {
      'truck': 15,
      'tempo': 12,
      'van': 10,
      'three-wheeler': 8,
      'electric': 9
    };

    const baseRate = baseRates[vehicle.type] || 300;
    const distanceRate = distanceRates[vehicle.type] || 10;
    const timeRate = 50; // INR per hour (estimated 1 hour for pickup + delivery)

    return {
      baseRate,
      distanceRate,
      timeRate,
      totalEstimate: baseRate + (distanceRate * totalDistance) + timeRate,
      currency: 'INR'
    };
  }

  /**
   * Calculates overall pricing for the search result
   * @param availableVehicles - Available vehicles with pricing
   * @param premiumOptions - Premium options with pricing
   * @param customerId - Optional customer ID for loyalty calculations
   * @param serviceType - Service type for loyalty calculations
   * @returns Promise<PricingInfo> - Overall pricing information
   */
  private async calculateOverallPricing(
    availableVehicles: VehicleAvailabilityInfo[],
    premiumOptions: PremiumVehicleOption[],
    customerId?: string,
    serviceType?: ServiceType
  ): Promise<PricingInfo> {
    let minPrice = Infinity;
    let maxPrice = 0;

    // Find price range from available vehicles
    availableVehicles.forEach(vehicle => {
      minPrice = Math.min(minPrice, vehicle.pricing.totalEstimate);
      maxPrice = Math.max(maxPrice, vehicle.pricing.totalEstimate);
    });

    // Include premium options in price range
    premiumOptions.forEach(option => {
      minPrice = Math.min(minPrice, option.premiumPricing.totalPrice);
      maxPrice = Math.max(maxPrice, option.premiumPricing.totalPrice);
    });

    const averagePrice = availableVehicles.length > 0
      ? availableVehicles.reduce((sum, v) => sum + v.pricing.totalEstimate, 0) / availableVehicles.length
      : 0;

    // Calculate loyalty incentives and discounts if customer ID provided
    let loyaltyIncentives: LoyaltyIncentiveCalculation | undefined;
    let loyaltyDiscount: DiscountedPricing | undefined;

    if (customerId && serviceType && averagePrice > 0) {
      try {
        loyaltyIncentives = await this.loyaltyService.calculateIncentives(customerId, serviceType);
        loyaltyDiscount = await this.loyaltyService.applyLoyaltyDiscount(customerId, averagePrice);

        // Only keep loyalty data if there's an actual discount
        if (loyaltyDiscount.discountPercentage === 0 && loyaltyDiscount.bonusCreditsUsed === 0) {
          loyaltyDiscount = undefined;
        }
        if (loyaltyIncentives && loyaltyIncentives.totalDiscountPercentage === 0) {
          loyaltyIncentives = undefined;
        }
      } catch (error) {
        console.warn('Failed to calculate loyalty benefits:', error);
        loyaltyIncentives = undefined;
        loyaltyDiscount = undefined;
      }
    }

    const priceBreakdown: PriceBreakdown[] = [
      {
        component: 'Base Rate',
        amount: minPrice === Infinity ? 0 : minPrice,
        description: 'Minimum base rate across available vehicles'
      },
      {
        component: 'Distance Rate',
        amount: maxPrice - (minPrice === Infinity ? 0 : minPrice),
        description: 'Variable rate based on distance and vehicle type'
      }
    ];

    // Add loyalty discount to breakdown if applicable
    if (loyaltyDiscount && loyaltyDiscount.discountAmount > 0) {
      priceBreakdown.push({
        component: 'Loyalty Discount',
        amount: -loyaltyDiscount.discountAmount,
        description: `${loyaltyDiscount.discountPercentage}% loyalty discount applied`
      });
    }

    if (loyaltyDiscount && loyaltyDiscount.bonusCreditsUsed > 0) {
      priceBreakdown.push({
        component: 'Bonus Credits',
        amount: -loyaltyDiscount.bonusCreditsUsed,
        description: `${loyaltyDiscount.bonusCreditsUsed} bonus credits applied`
      });
    }

    const result: PricingInfo = {
      basePrice: minPrice === Infinity ? 0 : minPrice,
      distancePrice: 0, // Included in individual vehicle pricing
      timePrice: 0, // Included in individual vehicle pricing
      totalPrice: loyaltyDiscount ? loyaltyDiscount.finalPrice : averagePrice,
      currency: 'INR',
      priceBreakdown
    };

    if (loyaltyDiscount) {
      result.loyaltyDiscount = loyaltyDiscount;
    }

    if (loyaltyIncentives) {
      result.loyaltyIncentives = loyaltyIncentives;
    }

    return result;
  }

  /**
   * Generates a unique search ID
   * @returns Unique search identifier
   */
  private generateSearchId(): string {
    return `SEARCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates cache key for search criteria
   * @param criteria - Search criteria
   * @returns Cache key string
   */
  private generateCacheKey(criteria: SearchCriteria): string {
    const key = JSON.stringify({
      pickup: `${criteria.pickupLocation.latitude},${criteria.pickupLocation.longitude}`,
      delivery: `${criteria.deliveryLocation.latitude},${criteria.deliveryLocation.longitude}`,
      timeWindow: `${(criteria.timeWindow.earliest || criteria.timeWindow.start || new Date()).getTime()}-${(criteria.timeWindow.latest || criteria.timeWindow.end || new Date(Date.now() + 8 * 60 * 60 * 1000)).getTime()}`,
      capacity: `${criteria.capacity.weight}-${criteria.capacity.volume}`,
      serviceType: criteria.serviceType,
      vehicleTypes: criteria.vehicleTypePreference?.sort().join(',') || 'all'
    });

    // Create a simple hash of the key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `search_${Math.abs(hash)}`;
  }

  /**
   * Gets cached search result if available and not expired
   * @param cacheKey - Cache key
   * @returns Cached result or null
   */
  private getCachedResult(cacheKey: string): CachedSearchResult | null {
    const cached = this.searchCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL_MS) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Caches search result
   * @param cacheKey - Cache key
   * @param result - Search result to cache
   */
  private cacheResult(cacheKey: string, result: VehicleSearchResult): void {
    this.searchCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean up expired entries periodically
    if (this.searchCache.size > 100) {
      this.clearExpiredCache();
    }
  }

  /**
   * Search for premium vehicles with dedicated service
   */
  async searchPremiumVehicles(criteria: VehicleSearchCriteria): Promise<PremiumVehicleOption[]> {
    const location = criteria.location || criteria.pickupLocation || { latitude: 28.6139, longitude: 77.2090 };
    const vehicles = await this.fleetService.getAvailableVehicles(location, criteria.timeWindow);
    const premiumOptions: PremiumVehicleOption[] = [];

    for (const vehicle of vehicles) {
      if (this.isPremiumCapable(vehicle)) {
        const pricing = await this.calculatePremiumPricing(vehicle, criteria.priorityLevel || 'high');

        premiumOptions.push({
          vehicle,
          dedicatedService: true,
          guaranteedTimeWindow: this.calculateGuaranteedWindow(criteria.timeWindow),
          premiumPricing: {
            basePrice: pricing.baseRate,
            premiumMultiplier: (criteria.priorityLevel || 'high') === 'urgent' ? 2.0 : 1.5,
            totalPrice: pricing.totalEstimate * ((criteria.priorityLevel || 'high') === 'urgent' ? 2.0 : 1.5),
            exclusivityFee: pricing.totalEstimate * 0.5
          },
          priorityLevel: criteria.priorityLevel || 'high'
        });
      }
    }

    return premiumOptions.sort((a, b) => a.premiumPricing.totalPrice - b.premiumPricing.totalPrice);
  }

  /**
   * Calculate premium pricing for a vehicle
   */
  async calculatePremiumPricing(vehicle: Vehicle, priorityLevel: 'high' | 'urgent'): Promise<VehiclePricing> {
    const basePricing = await this.pricingService.calculateVehiclePricing(vehicle);
    const premiumMultiplier = priorityLevel === 'urgent' ? 2.0 : 1.5;

    return {
      baseRate: basePricing.baseRate * premiumMultiplier,
      distanceRate: basePricing.distanceRate * premiumMultiplier,
      timeRate: basePricing.timeRate * premiumMultiplier,
      totalEstimate: basePricing.totalEstimate * premiumMultiplier,
      currency: basePricing.currency
    };
  }

  /**
   * Validate guaranteed delivery window
   */
  async validateGuaranteedDeliveryWindow(
    vehicle: Vehicle,
    timeWindow: TimeWindow
  ): Promise<boolean> {
    // Check vehicle availability
    const isAvailable = await this.fleetService.isVehicleAvailable(vehicle.id, timeWindow);
    if (!isAvailable) return false;

    // Check if vehicle can reach location within time window
    const travelTime = await this.routingService.calculateTravelTime(vehicle.location, vehicle.location);
    const arrivalTime = new Date(Date.now() + travelTime * 60 * 1000);

    return arrivalTime <= (timeWindow.end || timeWindow.latest || new Date(Date.now() + 8 * 60 * 60 * 1000));
  }

  /**
   * Allocate dedicated vehicle for premium service
   */
  async allocateDedicatedVehicle(
    vehicleId: string,
    customerId: string,
    timeWindow: TimeWindow
  ): Promise<boolean> {
    try {
      // Check vehicle availability
      const isAvailable = await this.fleetService.isVehicleAvailable(vehicleId, timeWindow);
      if (!isAvailable) return false;

      // Reserve the vehicle
      await this.fleetService.reserveVehicle(vehicleId, timeWindow);
      
      // Update vehicle status
      await this.fleetService.updateVehicleStatus(vehicleId, 'in-transit');
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Search and allocate dedicated vehicle for premium service
   */
  async searchAndAllocateDedicatedVehicle(
    customerId: string,
    criteria: VehicleSearchCriteria
  ): Promise<VehicleSearchResult> {
    const premiumOptions = await this.searchPremiumVehicles(criteria);

    if (premiumOptions.length === 0) {
      throw new Error('No premium vehicles available for dedicated service');
    }

    const selectedOption = premiumOptions[0]!;

    // Reserve the vehicle
    await this.fleetService.reserveVehicle(selectedOption.vehicle.id, criteria.timeWindow);

    return {
      vehicles: [selectedOption.vehicle],
      alternatives: [],
      pricing: {
        priceBreakdown: [{
          component: 'Premium Dedicated Service',
          amount: selectedOption.premiumPricing.totalPrice,
          description: 'Dedicated vehicle with premium features'
        }],
        totalPrice: selectedOption.premiumPricing.totalPrice,
        total: selectedOption.premiumPricing.totalPrice,
        currency: 'INR'
      },
      searchMetadata: {
        searchDurationMs: 0,
        totalVehiclesEvaluated: premiumOptions.length,
        vehiclesEvaluated: premiumOptions.length,
        filtersApplied: ['premium', 'dedicated'],
        complianceFiltersApplied: [],
        cacheHit: false
      }
    };
  }

  /**
   * Calculate loyalty incentives for customer
   */
  async calculateLoyaltyIncentives(customerId: string, serviceType: "shared" | "dedicated_premium"): Promise<LoyaltyIncentiveCalculation> {
    if (!customerId) {
      throw new Error('Customer ID is required for loyalty calculations');
    }

    return this.loyaltyService.calculateIncentives(customerId, serviceType);
  }

  /**
   * Apply loyalty discount to pricing
   */
  async applyLoyaltyDiscount(customerId: string, baseAmount: number, discountPercentage?: number): Promise<DiscountedPricing> {
    if (!customerId) {
      throw new Error('Customer ID is required for loyalty discount');
    }

    if (baseAmount <= 0) {
      throw new Error('Base amount must be greater than zero');
    }

    return this.loyaltyService.applyLoyaltyDiscount(customerId, baseAmount, discountPercentage);
  }

  /**
   * Update customer pooling history
   */
  async updateCustomerPoolingHistory(customerId: string, deliveryDetails: any): Promise<void> {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    // Update customer's pooling history for future loyalty calculations
    await this.loyaltyService.updatePoolingHistory(customerId, deliveryDetails);
  }

  /**
   * Check if vehicle is capable of premium service
   */
  private isPremiumCapable(vehicle: Vehicle): boolean {
    return vehicle.type === 'van' || vehicle.type === 'truck' || vehicle.type === 'electric';
  }

  /**
   * Calculate guaranteed time window for premium service
   */
  private calculateGuaranteedWindow(requestedWindow: TimeWindow): TimeWindow {
    const buffer = 30 * 60 * 1000; // 30 minutes buffer
    return {
      start: new Date((requestedWindow.start || requestedWindow.earliest || new Date()).getTime() - buffer),
      end: new Date((requestedWindow.end || requestedWindow.latest || new Date(Date.now() + 8 * 60 * 60 * 1000)).getTime() + buffer)
    };
  }
}