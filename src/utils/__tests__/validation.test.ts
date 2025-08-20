/**
 * Unit tests for validation utilities
 */

import {
  validateGeoLocation,
  validateTimeWindow,
  validateCapacity,
  validatePlateNumber,
  validatePhoneNumber,
  validateEmail,
  validateRequiredString,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateNonEmptyArray,
  validateEnumValue,
} from '../validation';
import { ValidationError } from '../errors';
import { GeoLocation } from '../../models/GeoLocation';
import { TimeWindow, Capacity } from '../../models/Common';

describe('Validation Utilities', () => {
  describe('validateGeoLocation', () => {
    it('should validate correct coordinates', () => {
      const validLocation: GeoLocation = {
        latitude: 28.6139,
        longitude: 77.2090,
      };
      
      expect(() => validateGeoLocation(validLocation)).not.toThrow();
    });

    it('should throw error for invalid latitude', () => {
      const invalidLocation: GeoLocation = {
        latitude: 91, // Invalid: > 90
        longitude: 77.2090,
      };
      
      expect(() => validateGeoLocation(invalidLocation)).toThrow(ValidationError);
      expect(() => validateGeoLocation(invalidLocation)).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      const invalidLocation: GeoLocation = {
        latitude: 28.6139,
        longitude: 181, // Invalid: > 180
      };
      
      expect(() => validateGeoLocation(invalidLocation)).toThrow(ValidationError);
      expect(() => validateGeoLocation(invalidLocation)).toThrow('Invalid longitude');
    });

    it('should throw error for null location', () => {
      expect(() => validateGeoLocation(null as any)).toThrow(ValidationError);
      expect(() => validateGeoLocation(null as any)).toThrow('Location is required');
    });
  });

  describe('validateTimeWindow', () => {
    it('should validate correct time window', () => {
      const validWindow: TimeWindow = {
        earliest: new Date(Date.now() + 3600000), // 1 hour from now
        latest: new Date(Date.now() + 7200000),   // 2 hours from now
      };
      
      expect(() => validateTimeWindow(validWindow)).not.toThrow();
    });

    it('should throw error when earliest is after latest', () => {
      const invalidWindow: TimeWindow = {
        earliest: new Date(Date.now() + 7200000), // 2 hours from now
        latest: new Date(Date.now() + 3600000),   // 1 hour from now
      };
      
      expect(() => validateTimeWindow(invalidWindow)).toThrow(ValidationError);
      expect(() => validateTimeWindow(invalidWindow)).toThrow('earliest time must be before latest time');
    });

    it('should throw error for past time window', () => {
      const pastWindow: TimeWindow = {
        earliest: new Date(Date.now() - 7200000), // 2 hours ago
        latest: new Date(Date.now() - 3600000),   // 1 hour ago
      };
      
      expect(() => validateTimeWindow(pastWindow)).toThrow(ValidationError);
      expect(() => validateTimeWindow(pastWindow)).toThrow('cannot be in the past');
    });
  });

  describe('validateCapacity', () => {
    it('should validate correct capacity', () => {
      const validCapacity: Capacity = {
        weight: 1000,
        volume: 5,
      };
      
      expect(() => validateCapacity(validCapacity)).not.toThrow();
    });

    it('should throw error for negative weight', () => {
      const invalidCapacity: Capacity = {
        weight: -100,
        volume: 5,
      };
      
      expect(() => validateCapacity(invalidCapacity)).toThrow(ValidationError);
      expect(() => validateCapacity(invalidCapacity)).toThrow('Weight must be a positive number');
    });

    it('should throw error for zero volume', () => {
      const invalidCapacity: Capacity = {
        weight: 1000,
        volume: 0,
      };
      
      expect(() => validateCapacity(invalidCapacity)).toThrow(ValidationError);
      expect(() => validateCapacity(invalidCapacity)).toThrow('Volume must be a positive number');
    });
  });

  describe('validatePlateNumber', () => {
    it('should validate correct Delhi plate numbers', () => {
      const validPlates = ['DL01AB1234', 'DL-01-AB-1234', 'dl02cd5678'];
      
      validPlates.forEach(plate => {
        expect(() => validatePlateNumber(plate)).not.toThrow();
      });
    });

    it('should throw error for invalid plate format', () => {
      const invalidPlates = ['MH01AB1234', 'DL1AB1234', 'DL01ABC1234', 'DL01AB12345'];
      
      invalidPlates.forEach(plate => {
        expect(() => validatePlateNumber(plate)).toThrow(ValidationError);
        expect(() => validatePlateNumber(plate)).toThrow('Invalid Delhi plate number format');
      });
    });

    it('should throw error for empty plate number', () => {
      expect(() => validatePlateNumber('')).toThrow(ValidationError);
      expect(() => validatePlateNumber('')).toThrow('Plate number is required');
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct Indian phone numbers', () => {
      const validNumbers = ['+919876543210', '9876543210', '+91 9876543210', '98765-43210'];
      
      validNumbers.forEach(number => {
        expect(() => validatePhoneNumber(number)).not.toThrow();
      });
    });

    it('should throw error for invalid phone numbers', () => {
      const invalidNumbers = ['1234567890', '+919876543', '+919876543210123', '5876543210'];
      
      invalidNumbers.forEach(number => {
        expect(() => validatePhoneNumber(number)).toThrow(ValidationError);
        expect(() => validatePhoneNumber(number)).toThrow('Invalid Indian phone number format');
      });
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.in', 'admin+test@company.org'];
      
      validEmails.forEach(email => {
        expect(() => validateEmail(email)).not.toThrow();
      });
    });

    it('should throw error for invalid email addresses', () => {
      const invalidEmails = ['invalid-email', '@domain.com', 'user@', 'user@domain'];
      
      invalidEmails.forEach(email => {
        expect(() => validateEmail(email)).toThrow(ValidationError);
        expect(() => validateEmail(email)).toThrow('Invalid email format');
      });
    });
  });

  describe('validateRequiredString', () => {
    it('should validate non-empty strings', () => {
      expect(() => validateRequiredString('valid string', 'testField')).not.toThrow();
    });

    it('should throw error for empty or whitespace strings', () => {
      const invalidStrings = ['', '   ', null as any, undefined as any];
      
      invalidStrings.forEach(str => {
        expect(() => validateRequiredString(str, 'testField')).toThrow(ValidationError);
        expect(() => validateRequiredString(str, 'testField')).toThrow('testField is required');
      });
    });
  });

  describe('validatePositiveNumber', () => {
    it('should validate positive numbers', () => {
      expect(() => validatePositiveNumber(1, 'testField')).not.toThrow();
      expect(() => validatePositiveNumber(0.1, 'testField')).not.toThrow();
    });

    it('should throw error for non-positive numbers', () => {
      const invalidNumbers = [0, -1, NaN, null as any, 'string' as any];
      
      invalidNumbers.forEach(num => {
        expect(() => validatePositiveNumber(num, 'testField')).toThrow(ValidationError);
        expect(() => validatePositiveNumber(num, 'testField')).toThrow('testField must be a positive number');
      });
    });
  });

  describe('validateNonNegativeNumber', () => {
    it('should validate non-negative numbers', () => {
      expect(() => validateNonNegativeNumber(0, 'testField')).not.toThrow();
      expect(() => validateNonNegativeNumber(1, 'testField')).not.toThrow();
    });

    it('should throw error for negative numbers', () => {
      expect(() => validateNonNegativeNumber(-1, 'testField')).toThrow(ValidationError);
      expect(() => validateNonNegativeNumber(-1, 'testField')).toThrow('testField must be a non-negative number');
    });
  });

  describe('validateNonEmptyArray', () => {
    it('should validate non-empty arrays', () => {
      expect(() => validateNonEmptyArray([1, 2, 3], 'testField')).not.toThrow();
      expect(() => validateNonEmptyArray(['item'], 'testField')).not.toThrow();
    });

    it('should throw error for empty arrays', () => {
      expect(() => validateNonEmptyArray([], 'testField')).toThrow(ValidationError);
      expect(() => validateNonEmptyArray([], 'testField')).toThrow('testField must be a non-empty array');
    });

    it('should throw error for non-arrays', () => {
      expect(() => validateNonEmptyArray(null as any, 'testField')).toThrow(ValidationError);
      expect(() => validateNonEmptyArray('string' as any, 'testField')).toThrow(ValidationError);
    });
  });

  describe('validateEnumValue', () => {
    it('should validate enum values', () => {
      const allowedValues = ['option1', 'option2', 'option3'];
      expect(() => validateEnumValue('option1', allowedValues, 'testField')).not.toThrow();
    });

    it('should throw error for invalid enum values', () => {
      const allowedValues = ['option1', 'option2', 'option3'];
      expect(() => validateEnumValue('invalid', allowedValues, 'testField')).toThrow(ValidationError);
      expect(() => validateEnumValue('invalid', allowedValues, 'testField')).toThrow('testField must be one of: option1, option2, option3');
    });
  });
});