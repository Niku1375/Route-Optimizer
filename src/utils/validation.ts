/**
 * Validation utilities for data models and API inputs
 */

import { ValidationError } from './errors';
import { GeoLocation } from '../models/GeoLocation';
import { TimeWindow, Capacity } from '../models/Common';

/**
 * Validate geographic coordinates
 */
export const validateGeoLocation = (location: GeoLocation): void => {
  if (!location) {
    throw new ValidationError('Location is required');
  }
  
  if (typeof location.latitude !== 'number' || 
      location.latitude < -90 || 
      location.latitude > 90) {
    throw new ValidationError('Invalid latitude. Must be between -90 and 90', 'latitude');
  }
  
  if (typeof location.longitude !== 'number' || 
      location.longitude < -180 || 
      location.longitude > 180) {
    throw new ValidationError('Invalid longitude. Must be between -180 and 180', 'longitude');
  }
};

/**
 * Validate time window
 */
export const validateTimeWindow = (timeWindow: TimeWindow): void => {
  if (!timeWindow) {
    throw new ValidationError('Time window is required');
  }
  
  if (!(timeWindow.earliest instanceof Date) || !(timeWindow.latest instanceof Date)) {
    throw new ValidationError('Time window must contain valid Date objects');
  }
  
  if (timeWindow.earliest >= timeWindow.latest) {
    throw new ValidationError('Time window earliest time must be before latest time');
  }
  
  if (timeWindow.earliest < new Date()) {
    throw new ValidationError('Time window cannot be in the past');
  }
};

/**
 * Validate capacity constraints
 */
export const validateCapacity = (capacity: Capacity): void => {
  if (!capacity) {
    throw new ValidationError('Capacity is required');
  }
  
  if (typeof capacity.weight !== 'number' || capacity.weight <= 0) {
    throw new ValidationError('Weight must be a positive number', 'weight');
  }
  
  if (typeof capacity.volume !== 'number' || capacity.volume <= 0) {
    throw new ValidationError('Volume must be a positive number', 'volume');
  }
};

/**
 * Validate vehicle plate number format (Delhi format)
 */
export const validatePlateNumber = (plateNumber: string): void => {
  if (!plateNumber) {
    throw new ValidationError('Plate number is required');
  }
  
  // Delhi plate number format: DL01AB1234 or DL-01-AB-1234
  const delhiPlateRegex = /^DL[-]?(\d{2})[-]?([A-Z]{1,2})[-]?(\d{4})$/i;
  
  if (!delhiPlateRegex.test(plateNumber)) {
    throw new ValidationError('Invalid Delhi plate number format. Expected format: DL01AB1234', 'plateNumber');
  }
};

/**
 * Validate phone number (Indian format)
 */
export const validatePhoneNumber = (phoneNumber: string): void => {
  if (!phoneNumber) {
    throw new ValidationError('Phone number is required');
  }
  
  // Indian phone number format: +91XXXXXXXXXX or XXXXXXXXXX
  const indianPhoneRegex = /^(\+91)?[6-9]\d{9}$/;
  
  if (!indianPhoneRegex.test(phoneNumber.replace(/\s|-/g, ''))) {
    throw new ValidationError('Invalid Indian phone number format', 'phoneNumber');
  }
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): void => {
  if (!email) {
    throw new ValidationError('Email is required');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format', 'email');
  }
};

/**
 * Validate required string field
 */
export const validateRequiredString = (value: string, fieldName: string): void => {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required and must be a non-empty string`, fieldName);
  }
};

/**
 * Validate positive number
 */
export const validatePositiveNumber = (value: number, fieldName: string): void => {
  if (typeof value !== 'number' || value <= 0 || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a positive number`, fieldName);
  }
};

/**
 * Validate non-negative number
 */
export const validateNonNegativeNumber = (value: number, fieldName: string): void => {
  if (typeof value !== 'number' || value < 0 || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a non-negative number`, fieldName);
  }
};

/**
 * Validate array is not empty
 */
export const validateNonEmptyArray = <T>(array: T[], fieldName: string): void => {
  if (!Array.isArray(array) || array.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty array`, fieldName);
  }
};

/**
 * Validate enum value
 */
export const validateEnumValue = <T>(value: T, allowedValues: T[], fieldName: string): void => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`, 
      fieldName
    );
  }
};