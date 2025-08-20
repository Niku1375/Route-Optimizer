/**
 * Customer loyalty and incentive system models
 */

import { LoyaltyTier, CustomerType, ServiceType } from './Common';

export interface CustomerLoyaltyProfile {
  customerId: string;
  customerType: CustomerType;
  loyaltyTier: LoyaltyTier;
  poolingHistory: PoolingHistory;
  incentives: LoyaltyIncentives;
  msmeIncentives?: MSMEIncentives | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface PoolingHistory {
  totalPooledDeliveries: number;
  poolingFrequency: number; // percentage of total deliveries that were pooled
  co2SavedKg: number;
  costSavedINR: number;
  lastSixMonthsPooling: number;
  totalDeliveries: number;
  lastPooledDelivery?: Date;
}

export interface LoyaltyIncentives {
  currentDiscountPercentage: number;
  bonusCredits: number;
  tierExpiryDate: Date;
  nextTierRequirement: string;
  totalSavingsINR: number;
}

export interface MSMEIncentives {
  bulkBookingDiscount: number;
  priorityScheduling: boolean;
  dedicatedAccountManager: boolean;
  customReporting: boolean;
  sustainabilityIncentives: SustainabilityIncentives;
}

export interface SustainabilityIncentives {
  carbonNeutralCertificate: boolean;
  greenLogisticsPartnerBadge: boolean;
  sustainabilityReporting: boolean;
}

export interface LoyaltyIncentiveCalculation {
  baseDiscount: number;
  tierBonus: number;
  poolingFrequencyBonus: number;
  msmeBonus: number;
  totalDiscountPercentage: number;
  bonusCreditsEarned: number;
  environmentalImpact: EnvironmentalImpact;
}

export interface EnvironmentalImpact {
  co2SavedThisBooking: number;
  cumulativeCo2Saved: number;
  fuelSavedLiters: number;
  costSavingsINR: number;
  treesEquivalent: number;
}

export interface DiscountedPricing {
  originalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  bonusCreditsUsed: number;
  bonusCreditsEarned: number;
}

export interface LoyaltyTierCalculation {
  currentTier: LoyaltyTier;
  tierBenefits: TierBenefits;
  nextTierRequirements: NextTierRequirements;
  tierProgress: number; // percentage towards next tier
}

export interface TierBenefits {
  discountPercentage: number;
  bonusCreditsMultiplier: number;
  prioritySupport: boolean;
  premiumServiceDiscount: number;
  specialFeatures: readonly string[];
}

export interface NextTierRequirements {
  pooledDeliveriesNeeded: number;
  co2SavingsNeeded: number;
  timeframeMonths: number;
  currentProgress: number;
}

export interface DeliveryDetails {
  deliveryId: string;
  customerId: string;
  serviceType: ServiceType;
  weight: number;
  volume: number;
  distanceKm: number;
  wasPooled: boolean;
  co2Saved?: number;
  costSaved?: number;
  deliveryDate: Date;
}

export interface MSMEBulkIncentive {
  tier: 'tier1' | 'tier2' | 'tier3';
  minBookings: number;
  discount: number;
  additionalBenefits: string[];
}

export interface LoyaltyNotification {
  customerId: string;
  type: 'tier_upgrade' | 'tier_expiry_warning' | 'bonus_earned' | 'milestone_achieved';
  title: string;
  message: string;
  actionRequired?: string;
  expiryDate?: Date;
  createdAt: Date;
}

// Constants for loyalty tier thresholds
export const LOYALTY_TIER_THRESHOLDS = {
  bronze: { minDeliveries: 0, minCO2Saved: 0 },
  silver: { minDeliveries: 11, minCO2Saved: 50 },
  gold: { minDeliveries: 26, minCO2Saved: 150 },
  platinum: { minDeliveries: 50, minCO2Saved: 300 }
} as const;

// Constants for tier benefits
export const TIER_BENEFITS = {
  bronze: {
    discountPercentage: 5,
    bonusCreditsMultiplier: 1.0,
    prioritySupport: false,
    premiumServiceDiscount: 0,
    specialFeatures: ['Basic environmental impact tracking']
  },
  silver: {
    discountPercentage: 10,
    bonusCreditsMultiplier: 1.2,
    prioritySupport: true,
    premiumServiceDiscount: 5,
    specialFeatures: ['Priority customer support', 'Quarterly environmental reports']
  },
  gold: {
    discountPercentage: 15,
    bonusCreditsMultiplier: 1.5,
    prioritySupport: true,
    premiumServiceDiscount: 10,
    specialFeatures: ['Priority scheduling during peak hours', 'Monthly environmental reports', 'Bonus credits for referrals']
  },
  platinum: {
    discountPercentage: 25,
    bonusCreditsMultiplier: 2.0,
    prioritySupport: true,
    premiumServiceDiscount: 15,
    specialFeatures: ['Guaranteed vehicle availability', 'Dedicated account manager', 'Real-time environmental dashboard']
  }
} as const;

// Constants for MSME bulk incentives
export const MSME_BULK_INCENTIVES = {
  tier1: { minBookings: 10, discount: 8, additionalBenefits: ['Priority scheduling'] },
  tier2: { minBookings: 25, discount: 12, additionalBenefits: ['Priority scheduling', 'Dedicated vehicle pool'] },
  tier3: { minBookings: 50, discount: 18, additionalBenefits: ['Priority scheduling', 'Dedicated vehicle pool', '24x7 support', 'Custom reporting'] }
} as const;

// Environmental impact calculation constants
export const ENVIRONMENTAL_CONSTANTS = {
  sharedDelivery: {
    co2PerKm: 0.12, // kg CO2 per km for shared vehicle
    costPerKm: 8    // INR per km for shared service
  },
  individualDelivery: {
    co2PerKm: 0.25, // kg CO2 per km for dedicated vehicle
    costPerKm: 15   // INR per km for premium service
  },
  co2ToTreesRatio: 22, // kg CO2 equivalent to one tree planted
  fuelDensity: 0.832, // kg per liter for diesel
  co2PerLiterFuel: 2.68 // kg CO2 per liter of diesel
} as const;