/**
 * Delhi Compliance Service
 * Handles Delhi-specific vehicle movement restrictions and compliance validation
 */

import { Vehicle } from '../models/Vehicle';
import { GeoLocation, GeoArea, PollutionZone } from '../models/GeoLocation';
import { VehicleType, ZoneType, TimeRestriction, PollutionLevel } from '../models/Common';
import { DELHI_CONSTANTS } from '../utils/constants';

export interface ComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  warnings: ComplianceWarning[];
  suggestedActions: string[];
  alternativeOptions: AlternativeOptions;
}

export interface ComplianceViolation {
  type: 'time_restriction' | 'zone_restriction' | 'pollution_violation' | 'odd_even_violation' | 'weight_limit_violation';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  penalty: number;
  location: GeoLocation;
  timestamp: Date;
}

export interface ComplianceWarning {
  type: string;
  description: string;
  recommendation: string;
}

export interface AlternativeOptions {
  alternativeVehicles: Vehicle[];
  alternativeTimeWindows: TimeWindow[];
  alternativeRoutes: Route[];
  loadSplittingOptions: LoadSplitOption[];
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Route {
  id: string;
  description: string;
  estimatedTime: number;
  distance: number;
}

export interface LoadSplitOption {
  vehicleCount: number;
  vehicleTypes: VehicleType[];
  description: string;
}

export interface TimeRestrictionValidationResult {
  isAllowed: boolean;
  vehicleType: VehicleType;
  zoneType: ZoneType;
  currentTime: string;
  restrictedHours?: { start: string; end: string };
  alternativeTimeWindows?: TimeWindow[];
  exemptionReason?: string;
}

export interface OddEvenValidationResult {
  isCompliant: boolean;
  plateNumber: string;
  date: Date;
  isOddDate: boolean;
  isOddPlate: boolean;
  isExempt: boolean;
  exemptionReason?: string | undefined;
}

export interface PollutionComplianceResult {
  isCompliant: boolean;
  vehiclePollutionLevel: PollutionLevel;
  zoneRequirement: PollutionLevel;
  isPrioritized: boolean;
  restrictions: string[];
}

export interface ActiveRestriction {
  type: string;
  description: string;
  area: GeoArea;
  activeUntil: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Delhi Compliance Service for vehicle movement restrictions
 */
export class DelhiComplianceService {
  
  /**
   * Validates time-based movement restrictions for Delhi vehicles
   * @param vehicle - Vehicle to validate
   * @param zoneType - Type of zone (residential, commercial, etc.)
   * @param timestamp - Time to check (defaults to current time)
   * @returns TimeRestrictionValidationResult with validation details
   */
  validateTimeRestrictions(
    vehicle: Vehicle,
    zoneType: ZoneType,
    timestamp: Date = new Date()
  ): TimeRestrictionValidationResult {
    const timeString = timestamp.toTimeString().slice(0, 5); // HH:MM format
    
    // Check for exemptions first
    const exemptionReason = this.getTimeRestrictionExemption(vehicle);
    if (exemptionReason) {
      return {
        isAllowed: true,
        vehicleType: vehicle.type,
        zoneType,
        currentTime: timeString,
        exemptionReason
      };
    }
    
    // Get applicable time restrictions for this vehicle type and zone
    const restriction = this.getTimeRestrictionForVehicleAndZone(vehicle.type, zoneType);
    
    if (!restriction) {
      return {
        isAllowed: true,
        vehicleType: vehicle.type,
        zoneType,
        currentTime: timeString
      };
    }
    
    // Check if current day is applicable
    const currentDay = timestamp.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (!restriction.daysApplicable.includes(currentDay)) {
      return {
        isAllowed: true,
        vehicleType: vehicle.type,
        zoneType,
        currentTime: timeString
      };
    }
    
    // Check if current time falls within restricted hours
    const isInRestrictedHours = this.isTimeInRange(
      timeString,
      restriction.restrictedHours.start,
      restriction.restrictedHours.end
    );
    
    if (isInRestrictedHours) {
      return {
        isAllowed: false,
        vehicleType: vehicle.type,
        zoneType,
        currentTime: timeString,
        restrictedHours: restriction.restrictedHours,
        alternativeTimeWindows: this.getAlternativeTimeWindows(restriction.restrictedHours)
      };
    }
    
    return {
      isAllowed: true,
      vehicleType: vehicle.type,
      zoneType,
      currentTime: timeString
    };
  }

  /**
   * Validates odd-even rule compliance for Delhi
   * @param plateNumber - Vehicle plate number
   * @param date - Date to check compliance for (defaults to current date)
   * @returns OddEvenValidationResult with compliance status and details
   */
  checkOddEvenCompliance(plateNumber: string, date: Date = new Date()): OddEvenValidationResult {
    // Extract last digit from plate number for odd-even check
    const plateDigits = plateNumber.replace(/[^0-9]/g, '');
    if (plateDigits.length === 0) {
      throw new Error('Invalid plate number: no digits found');
    }
    
    const lastDigit = parseInt(plateDigits.slice(-1));
    const isOddPlate = lastDigit % 2 === 1;
    
    // Check if date is odd or even
    const dayOfMonth = date.getDate();
    const isOddDate = dayOfMonth % 2 === 1;
    
    // Check for exemptions based on plate number patterns
    const isExempt = this.isOddEvenExemptByPlate(plateNumber);
    let exemptionReason: string | undefined;
    
    if (isExempt) {
      exemptionReason = this.getOddEvenExemptionReason(plateNumber);
    }
    
    const isCompliant = isExempt || (isOddDate === isOddPlate);
    
    return {
      isCompliant,
      plateNumber,
      date,
      isOddDate,
      isOddPlate,
      isExempt,
      exemptionReason
    };
  }

  /**
   * Validates pollution zone access based on vehicle emission standards
   * @param vehicle - Vehicle to validate
   * @param zone - Pollution zone to check access for
   * @returns PollutionComplianceResult with compliance details
   */
  validatePollutionZoneAccess(vehicle: Vehicle, zone: PollutionZone): PollutionComplianceResult {
    const vehiclePollutionLevel = vehicle.compliance.pollutionLevel;
    const zoneLevel = zone.level;
    
    // Determine minimum required pollution standard for the zone
    const zoneRequirement = this.getRequiredPollutionStandardForZone(zone);
    
    // Check if vehicle meets the requirement
    const isCompliant = this.isPollutionLevelCompliant(vehiclePollutionLevel, zoneRequirement);
    
    // Check if electric vehicles get priority
    const isPrioritized = vehiclePollutionLevel === 'electric' && 
                         (zoneLevel === 'high' || zoneLevel === 'severe');
    
    // Get applicable restrictions
    const restrictions = this.getPollutionRestrictions(vehiclePollutionLevel, zone);
    
    return {
      isCompliant,
      vehiclePollutionLevel,
      zoneRequirement,
      isPrioritized,
      restrictions
    };
  }

  /**
   * Gets time restrictions for specific vehicle type and zone combination
   * @param vehicleType - Type of vehicle
   * @param zoneType - Type of zone
   * @returns TimeRestriction or null if no restrictions apply
   */
  getTimeRestrictions(vehicleType: VehicleType, zoneType: ZoneType): TimeRestriction | null {
    return this.getTimeRestrictionForVehicleAndZone(vehicleType, zoneType);
  }

  /**
   * Validates vehicle movement for a complete route with comprehensive compliance checking
   * @param vehicle - Vehicle to validate
   * @param route - Route with stops and timing
   * @param timestamp - Time for the operation
   * @returns ComplianceResult with comprehensive validation details
   */
  validateVehicleMovement(vehicle: Vehicle, route: any, timestamp: Date = new Date()): ComplianceResult {
    const violations: ComplianceViolation[] = [];
    const warnings: ComplianceWarning[] = [];
    const suggestedActions: string[] = [];
    
    // Validate each stop in the route
    for (const stop of route.stops) {
      const zoneType: ZoneType = this.determineZoneType(stop.location);
      
      // Check time restrictions
      const timeResult = this.validateTimeRestrictions(vehicle, zoneType, timestamp);
      if (!timeResult.isAllowed) {
        violations.push({
          type: 'time_restriction',
          description: `Vehicle ${vehicle.type} not allowed in ${zoneType} zone during ${timeResult.currentTime}`,
          severity: 'high',
          penalty: 5000,
          location: stop.location,
          timestamp
        });
      }
      
      // Check odd-even compliance
      const oddEvenResult = this.checkOddEvenCompliance(vehicle.vehicleSpecs.plateNumber, timestamp);
      if (!oddEvenResult.isCompliant) {
        violations.push({
          type: 'odd_even_violation',
          description: `Vehicle plate ${vehicle.vehicleSpecs.plateNumber} violates odd-even rule on ${timestamp.toDateString()}`,
          severity: 'medium',
          penalty: 2000,
          location: stop.location,
          timestamp
        });
      }
    }
    
    // Generate suggested actions based on violations
    if (violations.length > 0) {
      const zoneType = this.determineZoneType(route.stops[0]?.location);
      suggestedActions.push(...this.suggestCompliantAlternatives(vehicle, zoneType, timestamp));
    }
    
    // Generate alternative options
    const alternativeOptions: AlternativeOptions = {
      alternativeVehicles: [],
      alternativeTimeWindows: [],
      alternativeRoutes: [],
      loadSplittingOptions: []
    };
    
    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      suggestedActions,
      alternativeOptions
    };
  }

  /**
   * Determines zone type based on location (simplified implementation)
   * @param location - Geographic location
   * @returns ZoneType - Determined zone type
   */
  private determineZoneType(location: GeoLocation): ZoneType {
    // This is a simplified implementation
    // In a real system, this would use geographic data to determine zone type
    if (location.address?.toLowerCase().includes('residential')) {
      return 'residential';
    }
    if (location.address?.toLowerCase().includes('industrial')) {
      return 'industrial';
    }
    if (location.address?.toLowerCase().includes('commercial')) {
      return 'commercial';
    }
    return 'mixed'; // Default to mixed zone
  }

  /**
   * Suggests compliant alternative vehicles when violations occur
   * @param originalVehicle - Vehicle that has compliance issues
   * @param zoneType - Target zone type
   * @param timestamp - Time for the operation
   * @returns Array of alternative vehicle suggestions
   */
  suggestCompliantAlternatives(
    originalVehicle: Vehicle,
    zoneType: ZoneType,
    timestamp: Date = new Date()
  ): string[] {
    const suggestions: string[] = [];
    
    // Check what type of violations exist
    const timeResult = this.validateTimeRestrictions(originalVehicle, zoneType, timestamp);
    const oddEvenResult = this.checkOddEvenCompliance(originalVehicle.vehicleSpecs.plateNumber, timestamp);
    
    if (!timeResult.isAllowed) {
      // Suggest smaller vehicles that can operate during restricted hours
      if (originalVehicle.type === 'truck') {
        suggestions.push('Use tempo or van for deliveries during restricted hours (11 PM - 7 AM)');
        suggestions.push('Use three-wheeler for narrow residential areas');
      }
      
      // Suggest alternative time windows
      if (timeResult.alternativeTimeWindows) {
        const timeWindows = timeResult.alternativeTimeWindows
          .map(tw => `${tw.start}-${tw.end}`)
          .join(', ');
        suggestions.push(`Alternative time windows: ${timeWindows}`);
      }
    }
    
    if (!oddEvenResult.isCompliant) {
      suggestions.push('Use electric vehicle (exempt from odd-even rules)');
      suggestions.push('Use CNG vehicle (often exempt from odd-even rules)');
      suggestions.push('Use three-wheeler (typically exempt from odd-even rules)');
      suggestions.push('Wait for compliant date or use alternative vehicle');
    }
    
    // Suggest electric vehicles for pollution-sensitive areas
    if (zoneType === 'commercial' && originalVehicle.compliance.pollutionLevel !== 'electric') {
      suggestions.push('Use electric vehicle for priority access in pollution-sensitive zones');
    }
    
    return suggestions;
  }

  /**
   * Gets currently active restrictions for a specific area and date
   * @param date - Date to check restrictions for
   * @param area - Geographic area to check
   * @returns Array of active restrictions
   */
  getActiveRestrictions(date: Date, area: GeoArea): ActiveRestriction[] {
    const restrictions: ActiveRestriction[] = [];
    
    // Check for odd-even restrictions (typically active on weekdays)
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
      restrictions.push({
        type: 'odd_even',
        description: 'Odd-even vehicle restriction active',
        area,
        activeUntil: new Date(date.getTime() + 24 * 60 * 60 * 1000), // Next day
        severity: 'medium'
      });
    }
    
    // Check for time-based truck restrictions
    const currentHour = date.getHours();
    if ((currentHour >= 23 || currentHour < 7) && area.zoneType === 'residential') {
      restrictions.push({
        type: 'time_restriction',
        description: 'Truck movement restricted in residential areas (11 PM - 7 AM)',
        area,
        activeUntil: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0),
        severity: 'high'
      });
    }
    
    // Check for pollution-based restrictions (example: during high pollution days)
    if (this.isHighPollutionDay(date)) {
      restrictions.push({
        type: 'pollution_restriction',
        description: 'Enhanced pollution restrictions due to poor air quality',
        area,
        activeUntil: new Date(date.getTime() + 24 * 60 * 60 * 1000),
        severity: 'critical'
      });
    }
    
    return restrictions;
  }

  // Private helper methods

  /**
   * Gets time restriction exemption reason for a vehicle
   * @param vehicle - Vehicle to check
   * @returns Exemption reason or null
   */
  private getTimeRestrictionExemption(vehicle: Vehicle): string | null {
    // Emergency vehicles
    if (vehicle.compliance.timeRestrictions.some(tr => tr.exceptions.includes('emergency'))) {
      return 'Emergency vehicle exemption';
    }
    
    // Essential services
    if (vehicle.compliance.timeRestrictions.some(tr => tr.exceptions.includes('essential_services'))) {
      return 'Essential services exemption';
    }
    
    // Electric vehicles may have extended access
    if (vehicle.vehicleSpecs.fuelType === 'electric') {
      return 'Electric vehicle extended access';
    }
    
    return null;
  }

  /**
   * Gets time restriction for specific vehicle type and zone
   * @param vehicleType - Type of vehicle
   * @param zoneType - Type of zone
   * @returns TimeRestriction or null
   */
  private getTimeRestrictionForVehicleAndZone(vehicleType: VehicleType, zoneType: ZoneType): TimeRestriction | null {
    // Truck restrictions in residential areas (11 PM to 7 AM)
    if (vehicleType === 'truck' && (zoneType === 'residential' || zoneType === 'mixed')) {
      return {
        zoneType,
        restrictedHours: {
          start: DELHI_CONSTANTS.TRUCK_RESTRICTED_HOURS.START,
          end: DELHI_CONSTANTS.TRUCK_RESTRICTED_HOURS.END
        },
        daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        exceptions: ['emergency', 'essential_services']
      };
    }
    
    // Heavy trucks may have additional restrictions in commercial areas during peak hours
    if (vehicleType === 'truck' && zoneType === 'commercial') {
      return {
        zoneType,
        restrictedHours: {
          start: '08:00',
          end: '10:00'
        },
        daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        exceptions: ['emergency', 'essential_services']
      };
    }
    
    return null;
  }

  /**
   * Checks if a time falls within a restricted range
   * @param currentTime - Current time in HH:MM format
   * @param startTime - Start of restricted period in HH:MM format
   * @param endTime - End of restricted period in HH:MM format
   * @returns boolean indicating if time is in restricted range
   */
  private isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    
    // Handle overnight restrictions (e.g., 23:00 to 07:00)
    if (start > end) {
      return current >= start || current < end; // Use < instead of <= for end time
    }
    
    return current >= start && current < end; // Use < instead of <= for end time
  }

  /**
   * Converts time string to minutes since midnight
   * @param time - Time in HH:MM format
   * @returns number of minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const timeParts = time.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    return hours * 60 + minutes;
  }

  /**
   * Generates alternative time windows when current time is restricted
   * @param restrictedHours - The restricted time period
   * @returns array of alternative time windows
   */
  private getAlternativeTimeWindows(restrictedHours: { start: string; end: string }): TimeWindow[] {
    const alternatives: TimeWindow[] = [];
    
    // If restriction is overnight (e.g., 23:00-07:00), suggest daytime
    if (this.timeToMinutes(restrictedHours.start) > this.timeToMinutes(restrictedHours.end)) {
      alternatives.push({ start: restrictedHours.end, end: restrictedHours.start });
    } else {
      // If restriction is during day, suggest early morning and evening
      alternatives.push({ start: '06:00', end: restrictedHours.start });
      alternatives.push({ start: restrictedHours.end, end: '22:00' });
    }
    
    return alternatives;
  }

  /**
   * Checks if plate number is exempt from odd-even rules
   * @param plateNumber - Vehicle plate number
   * @returns boolean indicating exemption status
   */
  private isOddEvenExemptByPlate(plateNumber: string): boolean {
    // Electric vehicle plates (often start with specific patterns)
    if (plateNumber.includes('EV') || plateNumber.includes('E-')) {
      return true;
    }
    
    // CNG vehicle plates (may have specific patterns)
    if (plateNumber.includes('CNG')) {
      return true;
    }
    
    // Emergency service plates
    if (plateNumber.includes('EMR') || plateNumber.includes('AMB')) {
      return true;
    }
    
    return false;
  }

  /**
   * Gets exemption reason for odd-even rules
   * @param plateNumber - Vehicle plate number
   * @returns exemption reason
   */
  private getOddEvenExemptionReason(plateNumber: string): string {
    if (plateNumber.includes('EV') || plateNumber.includes('E-')) {
      return 'Electric vehicle exemption';
    }
    
    if (plateNumber.includes('CNG')) {
      return 'CNG vehicle exemption';
    }
    
    if (plateNumber.includes('EMR') || plateNumber.includes('AMB')) {
      return 'Emergency vehicle exemption';
    }
    
    return 'Special exemption';
  }

  /**
   * Gets required pollution standard for a zone
   * @param zone - Pollution zone
   * @returns required pollution level
   */
  private getRequiredPollutionStandardForZone(zone: PollutionZone): PollutionLevel {
    switch (zone.level) {
      case 'severe':
        return 'electric';
      case 'high':
        return 'BS6';
      case 'moderate':
        return 'BS4';
      case 'low':
      default:
        return 'BS3';
    }
  }

  /**
   * Checks if vehicle pollution level meets zone requirement
   * @param vehicleLevel - Vehicle's pollution level
   * @param requiredLevel - Required pollution level for zone
   * @returns boolean indicating compliance
   */
  private isPollutionLevelCompliant(vehicleLevel: PollutionLevel, requiredLevel: PollutionLevel): boolean {
    const levelHierarchy: Record<PollutionLevel, number> = {
      'BS3': 1,
      'BS4': 2,
      'BS6': 3,
      'electric': 4
    };
    
    return levelHierarchy[vehicleLevel] >= levelHierarchy[requiredLevel];
  }

  /**
   * Gets pollution restrictions for vehicle in zone
   * @param vehicleLevel - Vehicle's pollution level
   * @param zone - Pollution zone
   * @returns array of applicable restrictions
   */
  private getPollutionRestrictions(vehicleLevel: PollutionLevel, zone: PollutionZone): string[] {
    const restrictions: string[] = [];
    
    if (vehicleLevel === 'BS3' && zone.level === 'severe') {
      restrictions.push('BS3 vehicles prohibited in severe pollution zones');
    }
    
    if (vehicleLevel === 'BS4' && zone.level === 'severe') {
      restrictions.push('BS4 vehicles restricted during peak pollution hours');
    }
    
    if (vehicleLevel !== 'electric' && zone.level === 'severe') {
      restrictions.push('Non-electric vehicles may face additional charges');
    }
    
    return restrictions;
  }

  /**
   * Checks if the given date is a high pollution day
   * @param date - Date to check
   * @returns boolean indicating if it's a high pollution day
   */
  private isHighPollutionDay(date: Date): boolean {
    // This would typically integrate with real pollution monitoring APIs
    // For now, we'll simulate based on winter months when pollution is typically higher
    const month = date.getMonth();
    const winterMonths = [10, 11, 0, 1]; // Nov, Dec, Jan, Feb
    
    return winterMonths.includes(month);
  }
}