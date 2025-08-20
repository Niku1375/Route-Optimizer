/**
 * General utility helper functions
 */

import { GeoLocation } from '../models/GeoLocation';
import { TimeWindow } from '../models/Common';

/**
 * Calculate distance between two geographic points using Haversine formula
 */
export const calculateDistance = (point1: GeoLocation, point2: GeoLocation): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Check if a time falls within a time window
 */
export const isTimeInWindow = (time: Date, window: TimeWindow): boolean => {
  return time >= window.earliest && time <= window.latest;
};

/**
 * Check if two time windows overlap
 */
export const doTimeWindowsOverlap = (window1: TimeWindow, window2: TimeWindow): boolean => {
  return window1.earliest < window2.latest && window2.earliest < window1.latest;
};

/**
 * Generate a unique ID
 */
export const generateId = (prefix?: string): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${randomStr}` : `${timestamp}_${randomStr}`;
};

/**
 * Format time as HH:MM string
 */
export const formatTime = (date: Date): string => {
  return date.toTimeString().substring(0, 5);
};

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
export const minutesToTimeString = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Check if current time is within restricted hours
 */
export const isInRestrictedHours = (currentTime: Date, startTime: string, endTime: string): boolean => {
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  
  // Handle overnight restrictions (e.g., 23:00 to 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

/**
 * Check if a date is odd or even based on the date number
 */
export const isOddDate = (date: Date): boolean => {
  return date.getDate() % 2 === 1;
};

/**
 * Extract plate number digits for odd-even checking
 */
export const getPlateNumberLastDigit = (plateNumber: string): number => {
  const digits = plateNumber.replace(/\D/g, '');
  return parseInt(digits.slice(-1), 10);
};

/**
 * Check odd-even compliance
 */
export const isOddEvenCompliant = (plateNumber: string, date: Date): boolean => {
  const lastDigit = getPlateNumberLastDigit(plateNumber);
  const isDateOdd = isOddDate(date);
  const isPlateOdd = lastDigit % 2 === 1;
  
  return isDateOdd === isPlateOdd;
};

/**
 * Calculate percentage improvement
 */
export const calculateImprovement = (original: number, optimized: number): number => {
  if (original === 0) return 0;
  return ((original - optimized) / original) * 100;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Sleep utility for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry async operation with exponential backoff
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError!;
};