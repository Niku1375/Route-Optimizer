/**
 * Unit tests for Delhi Compliance Service
 */

import { DelhiComplianceService } from '../DelhiComplianceService';
import { Vehicle } from '../../models/Vehicle';
import { VehicleType, ZoneType, PollutionLevel } from '../../models/Common';
import { PollutionZone, GeoArea } from '../../models/GeoLocation';

describe('DelhiComplianceService', () => {
  let service: DelhiComplianceService;
  let mockVehicle: Vehicle;

  beforeEach(() => {
    service = new DelhiComplianceService();
    
    // Create a mock vehicle for testing
    mockVehicle = {
      id: 'V001',
      type: 'truck',
      subType: 'heavy-truck',
      capacity: {
        weight: 5000,
        volume: 20,
        maxDimensions: { length: 8, width: 2.5, height: 3 }
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
        registrationState: 'DL',
        manufacturingYear: 2021
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
        id: 'D001',
        name: 'Test Driver',
        licenseNumber: 'DL123456',
        workingHours: 8,
        maxWorkingHours: 10,
        contactNumber: '9876543210'
      },
      lastUpdated: new Date()
    };
  });

  describe('validateTimeRestrictions', () => {
    describe('Truck restrictions in residential areas', () => {
      it('should allow truck in residential area during allowed hours (8 AM)', () => {
        const testTime = new Date('2024-01-15T08:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.vehicleType).toBe('truck');
        expect(result.zoneType).toBe('residential');
        expect(result.currentTime).toBe('08:00');
        expect(result.restrictedHours).toBeUndefined();
      });

      it('should restrict truck in residential area during restricted hours (2 AM)', () => {
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(false);
        expect(result.vehicleType).toBe('truck');
        expect(result.zoneType).toBe('residential');
        expect(result.currentTime).toBe('02:00');
        expect(result.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
        expect(result.alternativeTimeWindows).toBeDefined();
        expect(result.alternativeTimeWindows).toHaveLength(1);
        expect(result.alternativeTimeWindows![0]).toEqual({ start: '07:00', end: '23:00' });
      });

      it('should restrict truck in residential area at 11 PM (start of restriction)', () => {
        const testTime = new Date('2024-01-15T23:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(false);
        expect(result.currentTime).toBe('23:00');
        expect(result.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
      });

      it('should allow truck in residential area at 7 AM (end of restriction)', () => {
        const testTime = new Date('2024-01-15T07:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.currentTime).toBe('07:00');
        expect(result.restrictedHours).toBeUndefined();
      });

      it('should restrict truck in mixed zone during restricted hours', () => {
        const testTime = new Date('2024-01-15T01:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'mixed', testTime);
        
        expect(result.isAllowed).toBe(false);
        expect(result.zoneType).toBe('mixed');
        expect(result.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
      });
    });

    describe('Truck restrictions in commercial areas', () => {
      it('should restrict truck in commercial area during peak hours (9 AM)', () => {
        const testTime = new Date('2024-01-15T09:00:00'); // Monday
        
        const result = service.validateTimeRestrictions(mockVehicle, 'commercial', testTime);
        
        expect(result.isAllowed).toBe(false);
        expect(result.zoneType).toBe('commercial');
        expect(result.restrictedHours).toEqual({ start: '08:00', end: '10:00' });
      });

      it('should allow truck in commercial area outside peak hours (11 AM)', () => {
        const testTime = new Date('2024-01-15T11:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'commercial', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.zoneType).toBe('commercial');
      });

      it('should allow truck in commercial area on weekends during peak hours', () => {
        const testTime = new Date('2024-01-14T09:00:00'); // Sunday
        
        const result = service.validateTimeRestrictions(mockVehicle, 'commercial', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.zoneType).toBe('commercial');
      });
    });

    describe('Non-truck vehicles', () => {
      it('should allow tempo in residential area during restricted hours', () => {
        const tempoVehicle = { ...mockVehicle, type: 'tempo' as VehicleType };
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(tempoVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.vehicleType).toBe('tempo');
      });

      it('should allow van in residential area during restricted hours', () => {
        const vanVehicle = { ...mockVehicle, type: 'van' as VehicleType };
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(vanVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.vehicleType).toBe('van');
      });

      it('should allow three-wheeler in residential area during restricted hours', () => {
        const threeWheelerVehicle = { ...mockVehicle, type: 'three-wheeler' as VehicleType };
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(threeWheelerVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.vehicleType).toBe('three-wheeler');
      });
    });

    describe('Vehicle exemptions', () => {
      it('should allow emergency vehicle during restricted hours', () => {
        const emergencyVehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            timeRestrictions: [{
              zoneType: 'residential' as ZoneType,
              restrictedHours: { start: '23:00', end: '07:00' },
              daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
              exceptions: ['emergency']
            }]
          }
        };
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(emergencyVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.exemptionReason).toBe('Emergency vehicle exemption');
      });

      it('should allow essential services vehicle during restricted hours', () => {
        const essentialVehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            timeRestrictions: [{
              zoneType: 'residential' as ZoneType,
              restrictedHours: { start: '23:00', end: '07:00' },
              daysApplicable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
              exceptions: ['essential_services']
            }]
          }
        };
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(essentialVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.exemptionReason).toBe('Essential services exemption');
      });

      it('should allow electric vehicle with extended access during restricted hours', () => {
        const electricVehicle = {
          ...mockVehicle,
          type: 'electric' as VehicleType,
          vehicleSpecs: {
            ...mockVehicle.vehicleSpecs,
            fuelType: 'electric' as const
          }
        };
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(electricVehicle, 'residential', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.exemptionReason).toBe('Electric vehicle extended access');
      });
    });

    describe('Industrial zone access', () => {
      it('should allow truck in industrial area during any time', () => {
        const testTime = new Date('2024-01-15T02:00:00');
        
        const result = service.validateTimeRestrictions(mockVehicle, 'industrial', testTime);
        
        expect(result.isAllowed).toBe(true);
        expect(result.zoneType).toBe('industrial');
      });
    });
  });

  describe('getTimeRestrictions', () => {
    it('should return truck restrictions for residential zone', () => {
      const restriction = service.getTimeRestrictions('truck', 'residential');
      
      expect(restriction).not.toBeNull();
      expect(restriction!.zoneType).toBe('residential');
      expect(restriction!.restrictedHours).toEqual({ start: '23:00', end: '07:00' });
      expect(restriction!.daysApplicable).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
      expect(restriction!.exceptions).toContain('emergency');
      expect(restriction!.exceptions).toContain('essential_services');
    });

    it('should return truck restrictions for commercial zone', () => {
      const restriction = service.getTimeRestrictions('truck', 'commercial');
      
      expect(restriction).not.toBeNull();
      expect(restriction!.zoneType).toBe('commercial');
      expect(restriction!.restrictedHours).toEqual({ start: '08:00', end: '10:00' });
      expect(restriction!.daysApplicable).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    });

    it('should return null for tempo in residential zone', () => {
      const restriction = service.getTimeRestrictions('tempo', 'residential');
      
      expect(restriction).toBeNull();
    });

    it('should return null for truck in industrial zone', () => {
      const restriction = service.getTimeRestrictions('truck', 'industrial');
      
      expect(restriction).toBeNull();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle midnight crossing correctly (23:30)', () => {
      const testTime = new Date('2024-01-15T23:30:00');
      
      const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
      
      expect(result.isAllowed).toBe(false);
      expect(result.currentTime).toBe('23:30');
    });

    it('should handle midnight crossing correctly (00:30)', () => {
      const testTime = new Date('2024-01-15T00:30:00');
      
      const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
      
      expect(result.isAllowed).toBe(false);
      expect(result.currentTime).toBe('00:30');
    });

    it('should handle edge case at exactly 23:00', () => {
      const testTime = new Date('2024-01-15T23:00:00');
      
      const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
      
      expect(result.isAllowed).toBe(false);
      expect(result.currentTime).toBe('23:00');
    });

    it('should handle edge case at exactly 07:00', () => {
      const testTime = new Date('2024-01-15T07:00:00');
      
      const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
      
      expect(result.isAllowed).toBe(true);
      expect(result.currentTime).toBe('07:00');
    });

    it('should use current time when no timestamp provided', () => {
      // Mock current time to be during restricted hours
      const mockDate = new Date('2024-01-15T02:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      const result = service.validateTimeRestrictions(mockVehicle, 'residential');
      
      expect(result.currentTime).toBe('02:00');
      expect(result.isAllowed).toBe(false);
      
      // Restore original Date
      jest.restoreAllMocks();
    });
  });

  describe('Alternative time windows', () => {
    it('should provide correct alternative time windows for overnight restrictions', () => {
      const testTime = new Date('2024-01-15T02:00:00');
      
      const result = service.validateTimeRestrictions(mockVehicle, 'residential', testTime);
      
      expect(result.alternativeTimeWindows).toBeDefined();
      expect(result.alternativeTimeWindows).toHaveLength(1);
      expect(result.alternativeTimeWindows![0]).toEqual({ start: '07:00', end: '23:00' });
    });

    it('should provide correct alternative time windows for daytime restrictions', () => {
      const testTime = new Date('2024-01-15T09:00:00'); // Monday during peak hours
      
      const result = service.validateTimeRestrictions(mockVehicle, 'commercial', testTime);
      
      expect(result.alternativeTimeWindows).toBeDefined();
      expect(result.alternativeTimeWindows).toHaveLength(2);
      expect(result.alternativeTimeWindows![0]).toEqual({ start: '06:00', end: '08:00' });
      expect(result.alternativeTimeWindows![1]).toEqual({ start: '10:00', end: '22:00' });
    });
  });

  describe('checkOddEvenCompliance', () => {
    describe('Basic odd-even validation', () => {
      it('should allow odd plate on odd date', () => {
        const oddDate = new Date('2024-01-15'); // 15th is odd
        const oddPlate = 'DL01AB1235'; // ends with 5 (odd)
        
        const result = service.checkOddEvenCompliance(oddPlate, oddDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.plateNumber).toBe(oddPlate);
        expect(result.isOddDate).toBe(true);
        expect(result.isOddPlate).toBe(true);
        expect(result.isExempt).toBe(false);
        expect(result.exemptionReason).toBeUndefined();
      });

      it('should allow even plate on even date', () => {
        const evenDate = new Date('2024-01-16'); // 16th is even
        const evenPlate = 'DL01AB1234'; // ends with 4 (even)
        
        const result = service.checkOddEvenCompliance(evenPlate, evenDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.plateNumber).toBe(evenPlate);
        expect(result.isOddDate).toBe(false);
        expect(result.isOddPlate).toBe(false);
        expect(result.isExempt).toBe(false);
      });

      it('should restrict odd plate on even date', () => {
        const evenDate = new Date('2024-01-16'); // 16th is even
        const oddPlate = 'DL01AB1235'; // ends with 5 (odd)
        
        const result = service.checkOddEvenCompliance(oddPlate, evenDate);
        
        expect(result.isCompliant).toBe(false);
        expect(result.isOddDate).toBe(false);
        expect(result.isOddPlate).toBe(true);
        expect(result.isExempt).toBe(false);
      });

      it('should restrict even plate on odd date', () => {
        const oddDate = new Date('2024-01-15'); // 15th is odd
        const evenPlate = 'DL01AB1234'; // ends with 4 (even)
        
        const result = service.checkOddEvenCompliance(evenPlate, oddDate);
        
        expect(result.isCompliant).toBe(false);
        expect(result.isOddDate).toBe(true);
        expect(result.isOddPlate).toBe(false);
        expect(result.isExempt).toBe(false);
      });
    });

    describe('Electric vehicle exemptions', () => {
      it('should exempt electric vehicle with EV in plate number', () => {
        const oddDate = new Date('2024-01-15');
        const evPlate = 'DL01EV1234'; // Electric vehicle plate
        
        const result = service.checkOddEvenCompliance(evPlate, oddDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('Electric vehicle exemption');
      });

      it('should exempt electric vehicle with E- in plate number', () => {
        const evenDate = new Date('2024-01-16');
        const evPlate = 'DL01E-1235'; // Electric vehicle plate with E- prefix
        
        const result = service.checkOddEvenCompliance(evPlate, evenDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('Electric vehicle exemption');
      });
    });

    describe('CNG vehicle exemptions', () => {
      it('should exempt CNG vehicle', () => {
        const oddDate = new Date('2024-01-15');
        const cngPlate = 'DL01CNG1234'; // CNG vehicle plate
        
        const result = service.checkOddEvenCompliance(cngPlate, oddDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('CNG vehicle exemption');
      });
    });

    describe('Emergency vehicle exemptions', () => {
      it('should exempt emergency vehicle with EMR in plate', () => {
        const oddDate = new Date('2024-01-15');
        const emergencyPlate = 'DL01EMR1234'; // Emergency vehicle plate
        
        const result = service.checkOddEvenCompliance(emergencyPlate, oddDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('Emergency vehicle exemption');
      });

      it('should exempt ambulance with AMB in plate', () => {
        const evenDate = new Date('2024-01-16');
        const ambulancePlate = 'DL01AMB1235'; // Ambulance plate
        
        const result = service.checkOddEvenCompliance(ambulancePlate, evenDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('Emergency vehicle exemption');
      });
    });

    describe('Edge cases and plate number variations', () => {
      it('should handle plate numbers with multiple digits', () => {
        const oddDate = new Date('2024-01-15');
        const plateWithMultipleDigits = 'DL01AB123456'; // ends with 6 (even)
        
        const result = service.checkOddEvenCompliance(plateWithMultipleDigits, oddDate);
        
        expect(result.isCompliant).toBe(false);
        expect(result.isOddPlate).toBe(false); // last digit is 6 (even)
        expect(result.isOddDate).toBe(true);
      });

      it('should handle plate numbers with letters at the end', () => {
        const oddDate = new Date('2024-01-15');
        const plateWithLettersAtEnd = 'DL01AB1234XY'; // last digit is 4 (even)
        
        const result = service.checkOddEvenCompliance(plateWithLettersAtEnd, oddDate);
        
        expect(result.isCompliant).toBe(false);
        expect(result.isOddPlate).toBe(false);
      });

      it('should handle plate numbers with zero as last digit', () => {
        const evenDate = new Date('2024-01-16');
        const plateWithZero = 'DL01AB1230'; // ends with 0 (even)
        
        const result = service.checkOddEvenCompliance(plateWithZero, evenDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isOddPlate).toBe(false); // 0 is even
        expect(result.isOddDate).toBe(false);
      });

      it('should throw error for plate number with no digits', () => {
        const oddDate = new Date('2024-01-15');
        const plateWithNoDigits = 'DLABCDEF'; // no digits
        
        expect(() => {
          service.checkOddEvenCompliance(plateWithNoDigits, oddDate);
        }).toThrow('Invalid plate number: no digits found');
      });
    });

    describe('Date variations', () => {
      it('should handle end of month odd date (31st)', () => {
        const oddDate = new Date('2024-01-31'); // 31st is odd
        const oddPlate = 'DL01AB1235';
        
        const result = service.checkOddEvenCompliance(oddPlate, oddDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isOddDate).toBe(true);
      });

      it('should handle end of month even date (30th)', () => {
        const evenDate = new Date('2024-04-30'); // 30th is even
        const evenPlate = 'DL01AB1234';
        
        const result = service.checkOddEvenCompliance(evenPlate, evenDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isOddDate).toBe(false);
      });

      it('should use current date when no date provided', () => {
        const mockDate = new Date('2024-01-15T10:00:00'); // 15th is odd
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        const oddPlate = 'DL01AB1235';
        const result = service.checkOddEvenCompliance(oddPlate);
        
        expect(result.date.getDate()).toBe(15);
        expect(result.isOddDate).toBe(true);
        
        jest.restoreAllMocks();
      });
    });

    describe('Complex exemption scenarios', () => {
      it('should handle electric vehicle that would otherwise violate odd-even', () => {
        const oddDate = new Date('2024-01-15'); // odd date
        const evenElectricPlate = 'DL01EV1234'; // even plate but electric
        
        const result = service.checkOddEvenCompliance(evenElectricPlate, oddDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isOddDate).toBe(true);
        expect(result.isOddPlate).toBe(false);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('Electric vehicle exemption');
      });

      it('should handle CNG vehicle that would otherwise violate odd-even', () => {
        const evenDate = new Date('2024-01-16'); // even date
        const oddCngPlate = 'DL01CNG1235'; // odd plate but CNG
        
        const result = service.checkOddEvenCompliance(oddCngPlate, evenDate);
        
        expect(result.isCompliant).toBe(true);
        expect(result.isOddDate).toBe(false);
        expect(result.isOddPlate).toBe(true);
        expect(result.isExempt).toBe(true);
        expect(result.exemptionReason).toBe('CNG vehicle exemption');
      });
    });
  });

  describe('suggestCompliantAlternatives', () => {
    describe('Time restriction alternatives', () => {
      it('should suggest smaller vehicles for truck during restricted hours', () => {
        const testTime = new Date('2024-01-15T02:00:00'); // restricted hours
        
        const suggestions = service.suggestCompliantAlternatives(mockVehicle, 'residential', testTime);
        
        expect(suggestions).toContain('Use tempo or van for deliveries during restricted hours (11 PM - 7 AM)');
        expect(suggestions).toContain('Use three-wheeler for narrow residential areas');
        expect(suggestions).toContain('Alternative time windows: 07:00-23:00');
      });

      it('should not suggest time alternatives when vehicle is allowed', () => {
        const testTime = new Date('2024-01-15T10:00:00'); // allowed hours
        
        const suggestions = service.suggestCompliantAlternatives(mockVehicle, 'residential', testTime);
        
        expect(suggestions.filter(s => s.includes('restricted hours'))).toHaveLength(0);
      });
    });

    describe('Odd-even rule alternatives', () => {
      it('should suggest alternatives for odd-even violation', () => {
        const evenDate = new Date('2024-01-16'); // even date
        const oddPlateVehicle = {
          ...mockVehicle,
          vehicleSpecs: {
            ...mockVehicle.vehicleSpecs,
            plateNumber: 'DL01AB1235' // odd plate
          }
        };
        
        const suggestions = service.suggestCompliantAlternatives(oddPlateVehicle, 'residential', evenDate);
        
        expect(suggestions).toContain('Use electric vehicle (exempt from odd-even rules)');
        expect(suggestions).toContain('Use CNG vehicle (often exempt from odd-even rules)');
        expect(suggestions).toContain('Use three-wheeler (typically exempt from odd-even rules)');
        expect(suggestions).toContain('Wait for compliant date or use alternative vehicle');
      });

      it('should not suggest odd-even alternatives when compliant', () => {
        const oddDate = new Date('2024-01-15'); // odd date
        const oddPlateVehicle = {
          ...mockVehicle,
          vehicleSpecs: {
            ...mockVehicle.vehicleSpecs,
            plateNumber: 'DL01AB1235' // odd plate - compliant
          }
        };
        
        const suggestions = service.suggestCompliantAlternatives(oddPlateVehicle, 'residential', oddDate);
        
        expect(suggestions.filter(s => s.includes('odd-even'))).toHaveLength(0);
      });
    });

    describe('Pollution zone alternatives', () => {
      it('should suggest electric vehicle for commercial zones', () => {
        const nonElectricVehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS4' as PollutionLevel
          }
        };
        
        const suggestions = service.suggestCompliantAlternatives(nonElectricVehicle, 'commercial');
        
        expect(suggestions).toContain('Use electric vehicle for priority access in pollution-sensitive zones');
      });

      it('should not suggest electric vehicle for non-commercial zones', () => {
        const nonElectricVehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS4' as PollutionLevel
          }
        };
        
        const suggestions = service.suggestCompliantAlternatives(nonElectricVehicle, 'industrial');
        
        expect(suggestions.filter(s => s.includes('electric vehicle for priority access'))).toHaveLength(0);
      });
    });

    describe('Combined violation scenarios', () => {
      it('should suggest alternatives for both time and odd-even violations', () => {
        const evenDate = new Date('2024-01-16T02:00:00'); // even date, restricted hours
        const oddPlateVehicle = {
          ...mockVehicle,
          vehicleSpecs: {
            ...mockVehicle.vehicleSpecs,
            plateNumber: 'DL01AB1235' // odd plate
          }
        };
        
        const suggestions = service.suggestCompliantAlternatives(oddPlateVehicle, 'residential', evenDate);
        
        // Should include both time and odd-even suggestions
        expect(suggestions.some(s => s.includes('restricted hours'))).toBe(true);
        expect(suggestions.some(s => s.includes('odd-even'))).toBe(true);
        expect(suggestions.length).toBeGreaterThan(4); // Multiple suggestions
      });
    });
  });

  describe('validatePollutionZoneAccess', () => {
    let mockPollutionZone: PollutionZone;
    let mockGeoArea: GeoArea;

    beforeEach(() => {
      mockGeoArea = {
        id: 'area_001',
        name: 'Connaught Place',
        boundaries: [
          { latitude: 28.6304, longitude: 77.2177 },
          { latitude: 28.6290, longitude: 77.2200 }
        ],
        zoneType: 'commercial',
        restrictions: ['pollution_sensitive']
      };

      mockPollutionZone = {
        id: 'zone_001',
        area: mockGeoArea,
        level: 'high',
        restrictions: ['BS3_prohibited', 'BS4_restricted'],
        activeHours: { start: '06:00', end: '22:00' }
      };
    });

    describe('BS6 vehicle compliance', () => {
      it('should allow BS6 vehicle in high pollution zone', () => {
        const bs6Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS6' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs6Vehicle, mockPollutionZone);

        expect(result.isCompliant).toBe(true);
        expect(result.vehiclePollutionLevel).toBe('BS6');
        expect(result.zoneRequirement).toBe('BS6');
        expect(result.isPrioritized).toBe(false);
        expect(result.restrictions).toHaveLength(0);
      });

      it('should allow BS6 vehicle in severe pollution zone', () => {
        const severePollutionZone = {
          ...mockPollutionZone,
          level: 'severe' as const
        };
        
        const bs6Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS6' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs6Vehicle, severePollutionZone);

        expect(result.isCompliant).toBe(false); // Severe zones require electric
        expect(result.zoneRequirement).toBe('electric');
      });
    });

    describe('Electric vehicle compliance and prioritization', () => {
      it('should allow and prioritize electric vehicle in high pollution zone', () => {
        const electricVehicle = {
          ...mockVehicle,
          type: 'electric' as VehicleType,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'electric' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(electricVehicle, mockPollutionZone);

        expect(result.isCompliant).toBe(true);
        expect(result.vehiclePollutionLevel).toBe('electric');
        expect(result.isPrioritized).toBe(true);
        expect(result.restrictions).toHaveLength(0);
      });

      it('should allow and prioritize electric vehicle in severe pollution zone', () => {
        const severePollutionZone = {
          ...mockPollutionZone,
          level: 'severe' as const
        };
        
        const electricVehicle = {
          ...mockVehicle,
          type: 'electric' as VehicleType,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'electric' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(electricVehicle, severePollutionZone);

        expect(result.isCompliant).toBe(true);
        expect(result.vehiclePollutionLevel).toBe('electric');
        expect(result.zoneRequirement).toBe('electric');
        expect(result.isPrioritized).toBe(true);
        expect(result.restrictions).toHaveLength(0);
      });

      it('should not prioritize electric vehicle in low pollution zone', () => {
        const lowPollutionZone = {
          ...mockPollutionZone,
          level: 'low' as const
        };
        
        const electricVehicle = {
          ...mockVehicle,
          type: 'electric' as VehicleType,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'electric' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(electricVehicle, lowPollutionZone);

        expect(result.isCompliant).toBe(true);
        expect(result.isPrioritized).toBe(false); // No priority in low pollution zones
      });
    });

    describe('BS4 vehicle compliance', () => {
      it('should allow BS4 vehicle in moderate pollution zone', () => {
        const moderatePollutionZone = {
          ...mockPollutionZone,
          level: 'moderate' as const
        };
        
        const bs4Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS4' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs4Vehicle, moderatePollutionZone);

        expect(result.isCompliant).toBe(true);
        expect(result.vehiclePollutionLevel).toBe('BS4');
        expect(result.zoneRequirement).toBe('BS4');
        expect(result.isPrioritized).toBe(false);
      });

      it('should restrict BS4 vehicle in severe pollution zone with restrictions', () => {
        const severePollutionZone = {
          ...mockPollutionZone,
          level: 'severe' as const
        };
        
        const bs4Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS4' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs4Vehicle, severePollutionZone);

        expect(result.isCompliant).toBe(false);
        expect(result.restrictions).toContain('BS4 vehicles restricted during peak pollution hours');
        expect(result.restrictions).toContain('Non-electric vehicles may face additional charges');
      });

      it('should not comply BS4 vehicle in high pollution zone', () => {
        const bs4Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS4' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs4Vehicle, mockPollutionZone);

        expect(result.isCompliant).toBe(false);
        expect(result.vehiclePollutionLevel).toBe('BS4');
        expect(result.zoneRequirement).toBe('BS6');
      });
    });

    describe('BS3 vehicle compliance', () => {
      it('should allow BS3 vehicle in low pollution zone', () => {
        const lowPollutionZone = {
          ...mockPollutionZone,
          level: 'low' as const
        };
        
        const bs3Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS3' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs3Vehicle, lowPollutionZone);

        expect(result.isCompliant).toBe(true);
        expect(result.vehiclePollutionLevel).toBe('BS3');
        expect(result.zoneRequirement).toBe('BS3');
      });

      it('should prohibit BS3 vehicle in severe pollution zone', () => {
        const severePollutionZone = {
          ...mockPollutionZone,
          level: 'severe' as const
        };
        
        const bs3Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS3' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs3Vehicle, severePollutionZone);

        expect(result.isCompliant).toBe(false);
        expect(result.restrictions).toContain('BS3 vehicles prohibited in severe pollution zones');
        expect(result.restrictions).toContain('Non-electric vehicles may face additional charges');
      });

      it('should not comply BS3 vehicle in high pollution zone', () => {
        const bs3Vehicle = {
          ...mockVehicle,
          compliance: {
            ...mockVehicle.compliance,
            pollutionLevel: 'BS3' as PollutionLevel
          }
        };

        const result = service.validatePollutionZoneAccess(bs3Vehicle, mockPollutionZone);

        expect(result.isCompliant).toBe(false);
        expect(result.vehiclePollutionLevel).toBe('BS3');
        expect(result.zoneRequirement).toBe('BS6');
      });
    });

    describe('Zone requirement mapping', () => {
      it('should require electric for severe pollution zones', () => {
        const severePollutionZone = {
          ...mockPollutionZone,
          level: 'severe' as const
        };
        
        const result = service.validatePollutionZoneAccess(mockVehicle, severePollutionZone);
        
        expect(result.zoneRequirement).toBe('electric');
      });

      it('should require BS6 for high pollution zones', () => {
        const result = service.validatePollutionZoneAccess(mockVehicle, mockPollutionZone);
        
        expect(result.zoneRequirement).toBe('BS6');
      });

      it('should require BS4 for moderate pollution zones', () => {
        const moderatePollutionZone = {
          ...mockPollutionZone,
          level: 'moderate' as const
        };
        
        const result = service.validatePollutionZoneAccess(mockVehicle, moderatePollutionZone);
        
        expect(result.zoneRequirement).toBe('BS4');
      });

      it('should require BS3 for low pollution zones', () => {
        const lowPollutionZone = {
          ...mockPollutionZone,
          level: 'low' as const
        };
        
        const result = service.validatePollutionZoneAccess(mockVehicle, lowPollutionZone);
        
        expect(result.zoneRequirement).toBe('BS3');
      });
    });
  });

  describe('getActiveRestrictions', () => {
    let mockGeoArea: GeoArea;

    beforeEach(() => {
      mockGeoArea = {
        id: 'area_001',
        name: 'Test Area',
        boundaries: [
          { latitude: 28.6304, longitude: 77.2177 }
        ],
        zoneType: 'residential'
      };
    });

    describe('Odd-even restrictions', () => {
      it('should include odd-even restriction on weekdays', () => {
        const mondayDate = new Date('2024-01-15T10:00:00'); // Monday
        
        const restrictions = service.getActiveRestrictions(mondayDate, mockGeoArea);
        
        const oddEvenRestriction = restrictions.find(r => r.type === 'odd_even');
        expect(oddEvenRestriction).toBeDefined();
        expect(oddEvenRestriction!.description).toBe('Odd-even vehicle restriction active');
        expect(oddEvenRestriction!.severity).toBe('medium');
      });

      it('should not include odd-even restriction on weekends', () => {
        const sundayDate = new Date('2024-01-14T10:00:00'); // Sunday
        
        const restrictions = service.getActiveRestrictions(sundayDate, mockGeoArea);
        
        const oddEvenRestriction = restrictions.find(r => r.type === 'odd_even');
        expect(oddEvenRestriction).toBeUndefined();
      });
    });

    describe('Time-based truck restrictions', () => {
      it('should include truck restriction during restricted hours in residential area', () => {
        const restrictedHourDate = new Date('2024-01-15T02:00:00'); // 2 AM
        
        const restrictions = service.getActiveRestrictions(restrictedHourDate, mockGeoArea);
        
        const timeRestriction = restrictions.find(r => r.type === 'time_restriction');
        expect(timeRestriction).toBeDefined();
        expect(timeRestriction!.description).toBe('Truck movement restricted in residential areas (11 PM - 7 AM)');
        expect(timeRestriction!.severity).toBe('high');
        expect(timeRestriction!.activeUntil.getHours()).toBe(7);
      });

      it('should not include truck restriction during allowed hours', () => {
        const allowedHourDate = new Date('2024-01-15T10:00:00'); // 10 AM
        
        const restrictions = service.getActiveRestrictions(allowedHourDate, mockGeoArea);
        
        const timeRestriction = restrictions.find(r => r.type === 'time_restriction');
        expect(timeRestriction).toBeUndefined();
      });

      it('should not include truck restriction in non-residential areas during restricted hours', () => {
        const commercialArea = {
          ...mockGeoArea,
          zoneType: 'commercial' as const
        };
        const restrictedHourDate = new Date('2024-01-15T02:00:00');
        
        const restrictions = service.getActiveRestrictions(restrictedHourDate, commercialArea);
        
        const timeRestriction = restrictions.find(r => r.type === 'time_restriction');
        expect(timeRestriction).toBeUndefined();
      });
    });

    describe('Pollution-based restrictions', () => {
      it('should include pollution restriction during winter months (high pollution season)', () => {
        const winterDate = new Date('2024-01-15T10:00:00'); // January (winter)
        
        const restrictions = service.getActiveRestrictions(winterDate, mockGeoArea);
        
        const pollutionRestriction = restrictions.find(r => r.type === 'pollution_restriction');
        expect(pollutionRestriction).toBeDefined();
        expect(pollutionRestriction!.description).toBe('Enhanced pollution restrictions due to poor air quality');
        expect(pollutionRestriction!.severity).toBe('critical');
      });

      it('should include pollution restriction in November', () => {
        const novemberDate = new Date('2024-11-15T10:00:00'); // November
        
        const restrictions = service.getActiveRestrictions(novemberDate, mockGeoArea);
        
        const pollutionRestriction = restrictions.find(r => r.type === 'pollution_restriction');
        expect(pollutionRestriction).toBeDefined();
      });

      it('should not include pollution restriction during summer months', () => {
        const summerDate = new Date('2024-06-15T10:00:00'); // June (summer)
        
        const restrictions = service.getActiveRestrictions(summerDate, mockGeoArea);
        
        const pollutionRestriction = restrictions.find(r => r.type === 'pollution_restriction');
        expect(pollutionRestriction).toBeUndefined();
      });
    });

    describe('Combined restrictions', () => {
      it('should include multiple restrictions when applicable', () => {
        const winterWeekdayRestrictedHour = new Date('2024-01-15T02:00:00'); // Monday, 2 AM, January
        
        const restrictions = service.getActiveRestrictions(winterWeekdayRestrictedHour, mockGeoArea);
        
        expect(restrictions).toHaveLength(3); // odd-even, time, pollution
        expect(restrictions.map(r => r.type)).toContain('odd_even');
        expect(restrictions.map(r => r.type)).toContain('time_restriction');
        expect(restrictions.map(r => r.type)).toContain('pollution_restriction');
      });

      it('should include only applicable restrictions', () => {
        const summerWeekendAllowedHour = new Date('2024-06-16T10:00:00'); // Sunday, 10 AM, June
        const commercialArea = {
          ...mockGeoArea,
          zoneType: 'commercial' as const
        };
        
        const restrictions = service.getActiveRestrictions(summerWeekendAllowedHour, commercialArea);
        
        expect(restrictions).toHaveLength(0); // No restrictions apply
      });
    });
  });
});