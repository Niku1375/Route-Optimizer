/**
 * Unit tests for helper utilities
 */

import {
  calculateDistance,
  isTimeInWindow,
  doTimeWindowsOverlap,
  generateId,
  formatTime,
  parseTimeToMinutes,
  minutesToTimeString,
  isInRestrictedHours,
  isOddDate,
  getPlateNumberLastDigit,
  isOddEvenCompliant,
  calculateImprovement,
  deepClone,
} from '../helpers';
import { GeoLocation } from '../../models/GeoLocation';
import { TimeWindow } from '../../models/Common';

describe('Helper Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const point1: GeoLocation = { latitude: 28.6139, longitude: 77.2090 }; // Connaught Place
      const point2: GeoLocation = { latitude: 28.7041, longitude: 77.1025 }; // Rohini
      
      const distance = calculateDistance(point1, point2);
      
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(50); // Should be less than 50km
    });

    it('should return 0 for same points', () => {
      const point: GeoLocation = { latitude: 28.6139, longitude: 77.2090 };
      
      const distance = calculateDistance(point, point);
      
      expect(distance).toBe(0);
    });
  });

  describe('isTimeInWindow', () => {
    it('should return true when time is within window', () => {
      const window: TimeWindow = {
        earliest: new Date('2024-01-01T10:00:00Z'),
        latest: new Date('2024-01-01T12:00:00Z'),
      };
      const time = new Date('2024-01-01T11:00:00Z');
      
      expect(isTimeInWindow(time, window)).toBe(true);
    });

    it('should return false when time is outside window', () => {
      const window: TimeWindow = {
        earliest: new Date('2024-01-01T10:00:00Z'),
        latest: new Date('2024-01-01T12:00:00Z'),
      };
      const time = new Date('2024-01-01T13:00:00Z');
      
      expect(isTimeInWindow(time, window)).toBe(false);
    });

    it('should return true for boundary times', () => {
      const window: TimeWindow = {
        earliest: new Date('2024-01-01T10:00:00Z'),
        latest: new Date('2024-01-01T12:00:00Z'),
      };
      
      expect(isTimeInWindow(window.earliest, window)).toBe(true);
      expect(isTimeInWindow(window.latest, window)).toBe(true);
    });
  });

  describe('doTimeWindowsOverlap', () => {
    it('should return true for overlapping windows', () => {
      const window1: TimeWindow = {
        earliest: new Date('2024-01-01T10:00:00Z'),
        latest: new Date('2024-01-01T12:00:00Z'),
      };
      const window2: TimeWindow = {
        earliest: new Date('2024-01-01T11:00:00Z'),
        latest: new Date('2024-01-01T13:00:00Z'),
      };
      
      expect(doTimeWindowsOverlap(window1, window2)).toBe(true);
    });

    it('should return false for non-overlapping windows', () => {
      const window1: TimeWindow = {
        earliest: new Date('2024-01-01T10:00:00Z'),
        latest: new Date('2024-01-01T12:00:00Z'),
      };
      const window2: TimeWindow = {
        earliest: new Date('2024-01-01T13:00:00Z'),
        latest: new Date('2024-01-01T15:00:00Z'),
      };
      
      expect(doTimeWindowsOverlap(window1, window2)).toBe(false);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with prefix', () => {
      const id = generateId('vehicle');
      
      expect(id).toMatch(/^vehicle_/);
    });
  });

  describe('formatTime', () => {
    it('should format time as HH:MM', () => {
      const date = new Date('2024-01-01T14:30:45Z');
      const formatted = formatTime(date);
      
      expect(formatted).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('parseTimeToMinutes', () => {
    it('should convert time string to minutes', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('01:30')).toBe(90);
      expect(parseTimeToMinutes('12:00')).toBe(720);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('minutesToTimeString', () => {
    it('should convert minutes to time string', () => {
      expect(minutesToTimeString(0)).toBe('00:00');
      expect(minutesToTimeString(90)).toBe('01:30');
      expect(minutesToTimeString(720)).toBe('12:00');
      expect(minutesToTimeString(1439)).toBe('23:59');
    });
  });

  describe('isInRestrictedHours', () => {
    it('should detect time within restricted hours', () => {
      // Create a date with specific local time (1 AM)
      const currentTime = new Date();
      currentTime.setHours(1, 0, 0, 0); // 1 AM local time
      
      expect(isInRestrictedHours(currentTime, '23:00', '07:00')).toBe(true);
    });

    it('should detect time outside restricted hours', () => {
      // Create a date with specific local time (10 AM)
      const currentTime = new Date();
      currentTime.setHours(10, 0, 0, 0); // 10 AM local time
      
      expect(isInRestrictedHours(currentTime, '23:00', '07:00')).toBe(false);
    });

    it('should handle same-day restrictions', () => {
      // Create a date with specific local time (2 PM)
      const currentTime = new Date();
      currentTime.setHours(14, 0, 0, 0); // 2 PM local time
      
      expect(isInRestrictedHours(currentTime, '12:00', '16:00')).toBe(true);
      expect(isInRestrictedHours(currentTime, '16:00', '18:00')).toBe(false);
    });
  });

  describe('isOddDate', () => {
    it('should identify odd dates', () => {
      const oddDate = new Date('2024-01-01'); // 1st is odd
      const evenDate = new Date('2024-01-02'); // 2nd is even
      
      expect(isOddDate(oddDate)).toBe(true);
      expect(isOddDate(evenDate)).toBe(false);
    });
  });

  describe('getPlateNumberLastDigit', () => {
    it('should extract last digit from plate number', () => {
      expect(getPlateNumberLastDigit('DL01AB1234')).toBe(4);
      expect(getPlateNumberLastDigit('DL-02-CD-5678')).toBe(8);
      expect(getPlateNumberLastDigit('MH12EF9012')).toBe(2);
    });
  });

  describe('isOddEvenCompliant', () => {
    it('should check odd-even compliance correctly', () => {
      const oddDate = new Date('2024-01-01'); // Odd date
      const evenDate = new Date('2024-01-02'); // Even date
      
      // Odd plate on odd date - compliant
      expect(isOddEvenCompliant('DL01AB1235', oddDate)).toBe(true);
      
      // Even plate on even date - compliant
      expect(isOddEvenCompliant('DL01AB1234', evenDate)).toBe(true);
      
      // Odd plate on even date - non-compliant
      expect(isOddEvenCompliant('DL01AB1235', evenDate)).toBe(false);
      
      // Even plate on odd date - non-compliant
      expect(isOddEvenCompliant('DL01AB1234', oddDate)).toBe(false);
    });
  });

  describe('calculateImprovement', () => {
    it('should calculate percentage improvement', () => {
      expect(calculateImprovement(100, 80)).toBe(20);
      expect(calculateImprovement(200, 150)).toBe(25);
      expect(calculateImprovement(50, 60)).toBe(-20); // Negative improvement
    });

    it('should handle zero original value', () => {
      expect(calculateImprovement(0, 10)).toBe(0);
    });
  });

  describe('deepClone', () => {
    it('should create deep copy of object', () => {
      const original = {
        id: 'test',
        nested: {
          value: 42,
          array: [1, 2, 3],
        },
      };
      
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.nested.array).not.toBe(original.nested.array);
    });

    it('should handle arrays', () => {
      const original = [1, { value: 2 }, [3, 4]];
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[2]).not.toBe(original[2]);
    });
  });
});