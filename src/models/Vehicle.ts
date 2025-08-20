/**
 * Vehicle model with Delhi-specific compliance features
 */

import { 
  VehicleType, 
  VehicleSubType, 
  VehicleStatus, 
  PollutionLevel, 
  FuelType,
  Capacity,
  Dimensions,
  TimeRestriction,
  ZoneType 
} from './Common';
import { GeoLocation } from './GeoLocation';

export interface Vehicle {
  id: string;
  type: VehicleType;
  subType: VehicleSubType;
  capacity: Capacity & {
    maxDimensions: Dimensions;
  };
  location: GeoLocation;
  status: VehicleStatus;
  compliance: ComplianceInfo;
  vehicleSpecs: VehicleSpecs;
  accessPrivileges: AccessPrivileges;
  driverInfo: DriverInfo;
  lastUpdated: Date;
}

export interface ComplianceInfo {
  pollutionCertificate: boolean;
  pollutionLevel: PollutionLevel;
  permitValid: boolean;
  oddEvenCompliant: boolean;
  zoneRestrictions: string[];
  timeRestrictions: TimeRestriction[];
}

export interface VehicleSpecs {
  plateNumber: string;
  fuelType: FuelType;
  vehicleAge: number;
  registrationState: string;
  engineCapacity?: number;
  manufacturingYear: number;
}

export interface AccessPrivileges {
  residentialZones: boolean;
  commercialZones: boolean;
  industrialZones: boolean;
  restrictedHours: boolean;
  pollutionSensitiveZones: boolean;
  narrowLanes: boolean;
}

export interface DriverInfo {
  id: string;
  name: string;
  licenseNumber: string;
  workingHours: number;
  maxWorkingHours: number;
  contactNumber: string;
}

export interface ComplianceValidationResult {
  isCompliant: boolean;
  violations: string[];
  warnings: string[];
  suggestedActions: string[];
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

export interface TimeRestrictionValidationResult {
  isAllowed: boolean;
  currentTime: string;
  zoneType: ZoneType;
  vehicleType: VehicleType;
  restrictedHours?: { start: string; end: string };
  alternativeTimeWindows?: { start: string; end: string }[];
}

/**
 * Vehicle class with Delhi-specific compliance validation methods
 */
export class VehicleModel implements Vehicle {
  id: string;
  type: VehicleType;
  subType: VehicleSubType;
  capacity: Capacity & { maxDimensions: Dimensions };
  location: GeoLocation;
  status: VehicleStatus;
  compliance: ComplianceInfo;
  vehicleSpecs: VehicleSpecs;
  accessPrivileges: AccessPrivileges;
  driverInfo: DriverInfo;
  lastUpdated: Date;

  constructor(vehicleData: Vehicle) {
    this.id = vehicleData.id;
    this.type = vehicleData.type;
    this.subType = vehicleData.subType;
    this.capacity = vehicleData.capacity;
    this.location = vehicleData.location;
    this.status = vehicleData.status;
    this.compliance = vehicleData.compliance;
    this.vehicleSpecs = vehicleData.vehicleSpecs;
    this.accessPrivileges = vehicleData.accessPrivileges;
    this.driverInfo = vehicleData.driverInfo;
    this.lastUpdated = vehicleData.lastUpdated;
  }

  /**
   * Validates odd-even rule compliance for Delhi
   * @param date - Date to check compliance for (defaults to current date)
   * @returns OddEvenValidationResult with compliance status and details
   */
  validateOddEvenCompliance(date: Date = new Date()): OddEvenValidationResult {
    const plateNumber = this.vehicleSpecs.plateNumber;
    
    // Extract last digit from plate number for odd-even check
    const plateDigits = plateNumber.replace(/[^0-9]/g, '');
    const lastDigit = parseInt(plateDigits.slice(-1));
    const isOddPlate = lastDigit % 2 === 1;
    
    // Check if date is odd or even
    const dayOfMonth = date.getDate();
    const isOddDate = dayOfMonth % 2 === 1;
    
    // Check for exemptions
    const isExempt = this.isOddEvenExempt();
    let exemptionReason: string | undefined;
    
    if (isExempt) {
      if (this.vehicleSpecs.fuelType === 'electric') {
        exemptionReason = 'Electric vehicle exemption';
      } else if (this.type === 'three-wheeler') {
        exemptionReason = 'Three-wheeler exemption';
      } else if (this.vehicleSpecs.fuelType === 'cng') {
        exemptionReason = 'CNG vehicle exemption';
      }
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
   * Validates time-based movement restrictions for Delhi
   * @param zoneType - Type of zone (residential, commercial, etc.)
   * @param currentTime - Time to check (defaults to current time)
   * @returns TimeRestrictionValidationResult with validation details
   */
  validateTimeRestrictions(
    zoneType: ZoneType, 
    currentTime: Date = new Date()
  ): TimeRestrictionValidationResult {
    const timeString = currentTime.toTimeString().slice(0, 5); // HH:MM format
    
    // Get applicable time restrictions for this vehicle type and zone
    const applicableRestrictions = this.compliance.timeRestrictions.filter(
      restriction => restriction.zoneType === zoneType
    );
    
    // Check if current day is applicable
    const currentDay = currentTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    for (const restriction of applicableRestrictions) {
      if (restriction.daysApplicable.includes(currentDay)) {
        const isInRestrictedHours = this.isTimeInRange(
          timeString, 
          restriction.restrictedHours.start, 
          restriction.restrictedHours.end
        );
        
        if (isInRestrictedHours && !this.hasTimeRestrictionExemption()) {
          return {
            isAllowed: false,
            currentTime: timeString,
            zoneType,
            vehicleType: this.type,
            restrictedHours: restriction.restrictedHours,
            alternativeTimeWindows: this.getAlternativeTimeWindows(restriction.restrictedHours)
          };
        }
      }
    }
    
    return {
      isAllowed: true,
      currentTime: timeString,
      zoneType,
      vehicleType: this.type
    };
  }

  /**
   * Comprehensive compliance validation combining all Delhi-specific rules
   * @param zoneType - Zone type for validation
   * @param date - Date for validation (defaults to current date)
   * @returns ComplianceValidationResult with overall compliance status
   */
  validateCompliance(
    zoneType: ZoneType, 
    date: Date = new Date()
  ): ComplianceValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    const suggestedActions: string[] = [];
    
    // Check basic compliance requirements
    if (!this.compliance.pollutionCertificate) {
      violations.push('Missing valid pollution certificate');
      suggestedActions.push('Obtain valid pollution certificate');
    }
    
    if (!this.compliance.permitValid) {
      violations.push('Invalid or expired permit');
      suggestedActions.push('Renew vehicle permit');
    }
    
    // Check odd-even compliance
    const oddEvenResult = this.validateOddEvenCompliance(date);
    if (!oddEvenResult.isCompliant) {
      violations.push(`Odd-even rule violation: ${oddEvenResult.isOddPlate ? 'Odd' : 'Even'} plate on ${oddEvenResult.isOddDate ? 'odd' : 'even'} date`);
      suggestedActions.push('Use alternative vehicle or wait for compliant date');
    }
    
    // Check time restrictions
    const timeResult = this.validateTimeRestrictions(zoneType, date);
    if (!timeResult.isAllowed) {
      violations.push(`Time restriction violation: ${this.type} not allowed in ${zoneType} zone at ${timeResult.currentTime}`);
      if (timeResult.alternativeTimeWindows) {
        suggestedActions.push(`Alternative time windows: ${timeResult.alternativeTimeWindows.map(tw => `${tw.start}-${tw.end}`).join(', ')}`);
      }
    }
    
    // Check zone access privileges
    if (!this.hasZoneAccess(zoneType)) {
      violations.push(`No access privilege for ${zoneType} zone`);
      suggestedActions.push('Use vehicle with appropriate zone access');
    }
    
    // Check pollution level compliance
    if (this.compliance.pollutionLevel === 'BS3' && zoneType === 'commercial') {
      warnings.push('BS3 vehicle may face restrictions in commercial zones');
      suggestedActions.push('Consider upgrading to BS6 vehicle');
    }
    
    // Check vehicle age
    if (this.vehicleSpecs.vehicleAge > 15) {
      warnings.push('Vehicle age exceeds 15 years, may face additional restrictions');
      suggestedActions.push('Consider vehicle replacement');
    }
    
    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      suggestedActions
    };
  }

  /**
   * Updates vehicle location with timestamp
   * @param location - New location coordinates
   */
  updateLocation(location: GeoLocation): void {
    this.location = {
      ...location,
      timestamp: new Date()
    };
    this.lastUpdated = new Date();
  }

  /**
   * Updates vehicle status
   * @param status - New vehicle status
   */
  updateStatus(status: VehicleStatus): void {
    this.status = status;
    this.lastUpdated = new Date();
  }

  /**
   * Checks if vehicle is exempt from odd-even rules
   * @returns boolean indicating exemption status
   */
  private isOddEvenExempt(): boolean {
    // Electric vehicles are typically exempt
    if (this.vehicleSpecs.fuelType === 'electric') {
      return true;
    }
    
    // Three-wheelers are often exempt
    if (this.type === 'three-wheeler') {
      return true;
    }
    
    // CNG vehicles may have exemptions
    if (this.vehicleSpecs.fuelType === 'cng') {
      return true;
    }
    
    // Emergency vehicles (check if in exceptions)
    if (this.compliance.timeRestrictions.some(tr => tr.exceptions.includes('emergency'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if vehicle has time restriction exemptions
   * @returns boolean indicating exemption status
   */
  private hasTimeRestrictionExemption(): boolean {
    // Emergency vehicles
    if (this.compliance.timeRestrictions.some(tr => tr.exceptions.includes('emergency'))) {
      return true;
    }
    
    // Essential services
    if (this.compliance.timeRestrictions.some(tr => tr.exceptions.includes('essential_services'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Checks if vehicle has access to specific zone type
   * @param zoneType - Zone type to check access for
   * @returns boolean indicating access permission
   */
  private hasZoneAccess(zoneType: ZoneType): boolean {
    switch (zoneType) {
      case 'residential':
        return this.accessPrivileges.residentialZones;
      case 'commercial':
        return this.accessPrivileges.commercialZones;
      case 'industrial':
        return this.accessPrivileges.industrialZones;
      case 'mixed':
        return this.accessPrivileges.residentialZones && this.accessPrivileges.commercialZones;
      default:
        return false;
    }
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
      return current >= start || current <= end;
    }
    
    return current >= start && current <= end;
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
  private getAlternativeTimeWindows(restrictedHours: { start: string; end: string }): { start: string; end: string }[] {
    const alternatives: { start: string; end: string }[] = [];
    
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
}