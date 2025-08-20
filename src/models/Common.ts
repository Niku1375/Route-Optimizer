/**
 * Common types and enums used across the logistics routing system
 */

export type VehicleType = 'truck' | 'tempo' | 'van' | 'three-wheeler' | 'electric';

export type VehicleSubType = 
  | 'heavy-truck' 
  | 'light-truck' 
  | 'mini-truck' 
  | 'tempo-traveller' 
  | 'pickup-van' 
  | 'auto-rickshaw' 
  | 'e-rickshaw';

export type VehicleStatus = 'available' | 'in-transit' | 'loading' | 'maintenance' | 'breakdown' | 'reserved';

export type PollutionLevel = 'BS6' | 'BS4' | 'BS3' | 'electric';

export type FuelType = 'diesel' | 'petrol' | 'cng' | 'electric';

export type ZoneType = 'residential' | 'commercial' | 'industrial' | 'mixed';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type RouteStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export type ServiceType = 'shared' | 'dedicated_premium';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type CustomerType = 'individual' | 'msme' | 'enterprise';

/**
 * Capacity constraints for vehicles and shipments
 */
export interface Capacity {
  weight: number; // in kg
  volume: number; // in cubic meters
}

/**
 * Dimensional constraints for vehicles
 */
export interface Dimensions {
  length: number; // in meters
  width: number;  // in meters
  height: number; // in meters
}

/**
 * Time window for deliveries and operations
 */
export interface TimeWindow {
  earliest?: Date;
  latest?: Date;
  start?: Date | string;
  end?: Date | string;
}

/**
 * Time restriction for vehicle operations
 */
export interface TimeRestriction {
  zoneType: ZoneType;
  restrictedHours: {
    start: string; // "23:00"
    end: string;   // "07:00"
  };
  daysApplicable: string[]; // ['monday', 'tuesday', ...]
  exceptions: string[]; // Emergency services, etc.
}