/**
 * Unit tests for Vehicle model
 */

import { Vehicle, VehicleModel } from '../Vehicle';
import { VehicleType, VehicleStatus, PollutionLevel, FuelType } from '../Common';

describe('Vehicle Model', () => {
  let mockVehicle: Vehicle;
  let vehicleModel: VehicleModel;

  beforeEach(() => {
    mockVehicle = global.testUtils.generateTestVehicle();
    vehicleModel = new VehicleModel(mockVehicle);
  });

  describe('Vehicle Interface', () => {
    it('should have all required properties', () => {
      expect(mockVehicle).toHaveProperty('id');
      expect(mockVehicle).toHaveProperty('type');
      expect(mockVehicle).toHaveProperty('subType');
      expect(mockVehicle).toHaveProperty('capacity');
      expect(mockVehicle).toHaveProperty('location');
      expect(mockVehicle).toHaveProperty('status');
      expect(mockVehicle).toHaveProperty('compliance');
      expect(mockVehicle).toHaveProperty('vehicleSpecs');
      expect(mockVehicle).toHaveProperty('accessPrivileges');
      expect(mockVehicle).toHaveProperty('driverInfo');
      expect(mockVehicle).toHaveProperty('lastUpdated');
    });

    it('should have valid vehicle type', () => {
      const validTypes: VehicleType[] = ['truck', 'tempo', 'van', 'three-wheeler', 'electric'];
      expect(validTypes).toContain(mockVehicle.type);
    });

    it('should have valid vehicle status', () => {
      const validStatuses: VehicleStatus[] = ['available', 'in-transit', 'loading', 'maintenance', 'breakdown'];
      expect(validStatuses).toContain(mockVehicle.status);
    });

    it('should have positive capacity values', () => {
      expect(mockVehicle.capacity.weight).toBeGreaterThan(0);
      expect(mockVehicle.capacity.volume).toBeGreaterThan(0);
      expect(mockVehicle.capacity.maxDimensions.length).toBeGreaterThan(0);
      expect(mockVehicle.capacity.maxDimensions.width).toBeGreaterThan(0);
      expect(mockVehicle.capacity.maxDimensions.height).toBeGreaterThan(0);
    });
  });

  describe('ComplianceInfo', () => {
    it('should have valid pollution level', () => {
      const validLevels: PollutionLevel[] = ['BS6', 'BS4', 'BS3', 'electric'];
      expect(validLevels).toContain(mockVehicle.compliance.pollutionLevel);
    });

    it('should have boolean compliance flags', () => {
      expect(typeof mockVehicle.compliance.pollutionCertificate).toBe('boolean');
      expect(typeof mockVehicle.compliance.permitValid).toBe('boolean');
      expect(typeof mockVehicle.compliance.oddEvenCompliant).toBe('boolean');
    });

    it('should have arrays for restrictions', () => {
      expect(Array.isArray(mockVehicle.compliance.zoneRestrictions)).toBe(true);
      expect(Array.isArray(mockVehicle.compliance.timeRestrictions)).toBe(true);
    });
  });

  describe('VehicleSpecs', () => {
    it('should have valid Delhi plate number format', () => {
      const delhiPlateRegex = /^DL[-]?(\d{2})[-]?([A-Z]{1,2})[-]?(\d{4})$/i;
      expect(delhiPlateRegex.test(mockVehicle.vehicleSpecs.plateNumber)).toBe(true);
    });

    it('should have valid fuel type', () => {
      const validFuelTypes: FuelType[] = ['diesel', 'petrol', 'cng', 'electric'];
      expect(validFuelTypes).toContain(mockVehicle.vehicleSpecs.fuelType);
    });

    it('should have reasonable vehicle age', () => {
      expect(mockVehicle.vehicleSpecs.vehicleAge).toBeGreaterThanOrEqual(0);
      expect(mockVehicle.vehicleSpecs.vehicleAge).toBeLessThanOrEqual(30);
    });
  });

  describe('AccessPrivileges', () => {
    it('should have boolean access flags', () => {
      expect(typeof mockVehicle.accessPrivileges.residentialZones).toBe('boolean');
      expect(typeof mockVehicle.accessPrivileges.commercialZones).toBe('boolean');
      expect(typeof mockVehicle.accessPrivileges.industrialZones).toBe('boolean');
      expect(typeof mockVehicle.accessPrivileges.restrictedHours).toBe('boolean');
      expect(typeof mockVehicle.accessPrivileges.pollutionSensitiveZones).toBe('boolean');
      expect(typeof mockVehicle.accessPrivileges.narrowLanes).toBe('boolean');
    });
  });

  describe('DriverInfo', () => {
    it('should have valid working hours', () => {
      expect(mockVehicle.driverInfo.workingHours).toBeGreaterThanOrEqual(0);
      expect(mockVehicle.driverInfo.maxWorkingHours).toBeGreaterThan(0);
      expect(mockVehicle.driverInfo.workingHours).toBeLessThanOrEqual(mockVehicle.driverInfo.maxWorkingHours);
    });

    it('should have valid contact number format', () => {
      const indianPhoneRegex = /^(\+91)?[6-9]\d{9}$/;
      const cleanNumber = mockVehicle.driverInfo.contactNumber.replace(/\s|-/g, '');
      expect(indianPhoneRegex.test(cleanNumber)).toBe(true);
    });
  });

  describe('VehicleModel Class', () => {
    it('should create instance from vehicle data', () => {
      expect(vehicleModel).toBeInstanceOf(VehicleModel);
      expect(vehicleModel.id).toBe(mockVehicle.id);
      expect(vehicleModel.type).toBe(mockVehicle.type);
    });

    it('should update location with timestamp', async () => {
      const newLocation = { latitude: 28.7041, longitude: 77.1025 };
      const beforeUpdate = vehicleModel.lastUpdated;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      vehicleModel.updateLocation(newLocation);
      
      expect(vehicleModel.location.latitude).toBe(newLocation.latitude);
      expect(vehicleModel.location.longitude).toBe(newLocation.longitude);
      expect(vehicleModel.location.timestamp).toBeInstanceOf(Date);
      expect(vehicleModel.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should update status with timestamp', async () => {
      const beforeUpdate = vehicleModel.lastUpdated;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      vehicleModel.updateStatus('in-transit');
      
      expect(vehicleModel.status).toBe('in-transit');
      expect(vehicleModel.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('Odd-Even Compliance Validation', () => {
    beforeEach(() => {
      // Reset to a known state
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1234'; // Odd plate (ends in 4, but we check last digit)
      vehicleModel.vehicleSpecs.fuelType = 'diesel';
      vehicleModel.type = 'van';
    });

    it('should validate odd plate on odd date as compliant', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate (ends in 5)
      const oddDate = new Date('2024-01-15'); // 15th is odd
      
      const result = vehicleModel.validateOddEvenCompliance(oddDate);
      
      expect(result.isCompliant).toBe(true);
      expect(result.isOddPlate).toBe(true);
      expect(result.isOddDate).toBe(true);
      expect(result.plateNumber).toBe('DL01AB1235');
    });

    it('should validate even plate on even date as compliant', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1234'; // Even plate (ends in 4)
      const evenDate = new Date('2024-01-16'); // 16th is even
      
      const result = vehicleModel.validateOddEvenCompliance(evenDate);
      
      expect(result.isCompliant).toBe(true);
      expect(result.isOddPlate).toBe(false);
      expect(result.isOddDate).toBe(false);
    });

    it('should validate odd plate on even date as non-compliant', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate (ends in 5)
      const evenDate = new Date('2024-01-16'); // 16th is even
      
      const result = vehicleModel.validateOddEvenCompliance(evenDate);
      
      expect(result.isCompliant).toBe(false);
      expect(result.isOddPlate).toBe(true);
      expect(result.isOddDate).toBe(false);
    });

    it('should exempt electric vehicles from odd-even rules', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate
      vehicleModel.vehicleSpecs.fuelType = 'electric';
      const evenDate = new Date('2024-01-16'); // Even date - should normally violate
      
      const result = vehicleModel.validateOddEvenCompliance(evenDate);
      
      expect(result.isCompliant).toBe(true);
      expect(result.isExempt).toBe(true);
      expect(result.exemptionReason).toBe('Electric vehicle exemption');
    });

    it('should exempt three-wheelers from odd-even rules', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate
      vehicleModel.type = 'three-wheeler';
      const evenDate = new Date('2024-01-16'); // Even date - should normally violate
      
      const result = vehicleModel.validateOddEvenCompliance(evenDate);
      
      expect(result.isCompliant).toBe(true);
      expect(result.isExempt).toBe(true);
      expect(result.exemptionReason).toBe('Three-wheeler exemption');
    });

    it('should exempt CNG vehicles from odd-even rules', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate
      vehicleModel.vehicleSpecs.fuelType = 'cng';
      const evenDate = new Date('2024-01-16'); // Even date - should normally violate
      
      const result = vehicleModel.validateOddEvenCompliance(evenDate);
      
      expect(result.isCompliant).toBe(true);
      expect(result.isExempt).toBe(true);
      expect(result.exemptionReason).toBe('CNG vehicle exemption');
    });
  });

  describe('Time Restriction Validation', () => {
    beforeEach(() => {
      // Set up time restrictions for trucks in residential zones
      vehicleModel.type = 'truck';
      vehicleModel.compliance.timeRestrictions = [
        {
          zoneType: 'residential',
          restrictedHours: { start: '23:00', end: '07:00' },
          daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          exceptions: []
        }
      ];
    });

    it('should allow truck in residential zone during allowed hours', () => {
      const allowedTime = new Date('2024-01-15T10:00:00'); // 10 AM
      
      const result = vehicleModel.validateTimeRestrictions('residential', allowedTime);
      
      expect(result.isAllowed).toBe(true);
      expect(result.currentTime).toBe('10:00');
      expect(result.zoneType).toBe('residential');
      expect(result.vehicleType).toBe('truck');
    });

    it('should restrict truck in residential zone during restricted hours', () => {
      const restrictedTime = new Date('2024-01-15T02:00:00'); // 2 AM
      
      const result = vehicleModel.validateTimeRestrictions('residential', restrictedTime);
      
      expect(result.isAllowed).toBe(false);
      expect(result.currentTime).toBe('02:00');
      expect(result.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
      expect(result.alternativeTimeWindows).toBeDefined();
      expect(result.alternativeTimeWindows!.length).toBeGreaterThan(0);
    });

    it('should handle overnight restrictions correctly', () => {
      const lateNightTime = new Date('2024-01-15T23:30:00'); // 11:30 PM
      
      const result = vehicleModel.validateTimeRestrictions('residential', lateNightTime);
      
      expect(result.isAllowed).toBe(false);
      expect(result.currentTime).toBe('23:30');
    });

    it('should allow vehicles with no applicable restrictions', () => {
      const commercialTime = new Date('2024-01-15T02:00:00'); // 2 AM in commercial zone
      
      const result = vehicleModel.validateTimeRestrictions('commercial', commercialTime);
      
      expect(result.isAllowed).toBe(true);
      expect(result.zoneType).toBe('commercial');
    });

    it('should provide alternative time windows for restricted periods', () => {
      const restrictedTime = new Date('2024-01-15T02:00:00'); // 2 AM
      
      const result = vehicleModel.validateTimeRestrictions('residential', restrictedTime);
      
      expect(result.alternativeTimeWindows).toBeDefined();
      expect(result.alternativeTimeWindows!.length).toBeGreaterThan(0);
      expect(result.alternativeTimeWindows![0]).toHaveProperty('start');
      expect(result.alternativeTimeWindows![0]).toHaveProperty('end');
    });
  });

  describe('Comprehensive Compliance Validation', () => {
    beforeEach(() => {
      // Set up a compliant vehicle
      vehicleModel.compliance.pollutionCertificate = true;
      vehicleModel.compliance.permitValid = true;
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1234'; // Even plate
      vehicleModel.vehicleSpecs.vehicleAge = 5;
      vehicleModel.accessPrivileges.residentialZones = true;
      vehicleModel.compliance.timeRestrictions = [];
    });

    it('should validate fully compliant vehicle', () => {
      const evenDate = new Date('2024-01-16'); // Even date
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.isCompliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing pollution certificate', () => {
      vehicleModel.compliance.pollutionCertificate = false;
      const evenDate = new Date('2024-01-16');
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('Missing valid pollution certificate');
      expect(result.suggestedActions).toContain('Obtain valid pollution certificate');
    });

    it('should detect invalid permit', () => {
      vehicleModel.compliance.permitValid = false;
      const evenDate = new Date('2024-01-16');
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('Invalid or expired permit');
      expect(result.suggestedActions).toContain('Renew vehicle permit');
    });

    it('should detect odd-even violations', () => {
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate
      vehicleModel.vehicleSpecs.fuelType = 'diesel'; // Not exempt
      vehicleModel.type = 'van'; // Not exempt
      const evenDate = new Date('2024-01-16'); // Even date
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations.some(v => v.includes('Odd-even rule violation'))).toBe(true);
      expect(result.suggestedActions).toContain('Use alternative vehicle or wait for compliant date');
    });

    it('should detect zone access violations', () => {
      vehicleModel.accessPrivileges.residentialZones = false;
      const evenDate = new Date('2024-01-16');
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('No access privilege for residential zone');
      expect(result.suggestedActions).toContain('Use vehicle with appropriate zone access');
    });

    it('should warn about old vehicles', () => {
      vehicleModel.vehicleSpecs.vehicleAge = 16; // Over 15 years
      const evenDate = new Date('2024-01-16');
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.warnings).toContain('Vehicle age exceeds 15 years, may face additional restrictions');
      expect(result.suggestedActions).toContain('Consider vehicle replacement');
    });

    it('should warn about BS3 vehicles in commercial zones', () => {
      vehicleModel.compliance.pollutionLevel = 'BS3';
      const evenDate = new Date('2024-01-16');
      
      const result = vehicleModel.validateCompliance('commercial', evenDate);
      
      expect(result.warnings).toContain('BS3 vehicle may face restrictions in commercial zones');
      expect(result.suggestedActions).toContain('Consider upgrading to BS6 vehicle');
    });

    it('should handle multiple violations and provide comprehensive feedback', () => {
      vehicleModel.compliance.pollutionCertificate = false;
      vehicleModel.compliance.permitValid = false;
      vehicleModel.vehicleSpecs.plateNumber = 'DL01AB1235'; // Odd plate
      vehicleModel.vehicleSpecs.fuelType = 'diesel'; // Not exempt
      vehicleModel.type = 'van'; // Not exempt
      vehicleModel.accessPrivileges.residentialZones = false;
      const evenDate = new Date('2024-01-16'); // Even date
      
      const result = vehicleModel.validateCompliance('residential', evenDate);
      
      expect(result.isCompliant).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(4);
      expect(result.suggestedActions.length).toBeGreaterThanOrEqual(4);
    });
  });
});