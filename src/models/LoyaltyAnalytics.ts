/**
 * Loyalty analytics and reporting data models
 */

import { LoyaltyTier, CustomerType } from './Common';

export interface LoyaltyProgramMetrics {
  timestamp: Date;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  totalCustomers: number;
  activeCustomers: number; // Customers with activity in the period
  newCustomers: number;
  tierDistribution: TierDistribution;
  programPerformance: ProgramPerformance;
  retentionMetrics: RetentionMetrics;
  poolingAdoption: PoolingAdoptionMetrics;
  environmentalImpact: AggregateEnvironmentalImpact;
  msmeProgram: MSMEProgramMetrics;
}

export interface TierDistribution {
  bronze: {
    count: number;
    percentage: number;
    averageMonthlySpend: number;
    averagePoolingFrequency: number;
  };
  silver: {
    count: number;
    percentage: number;
    averageMonthlySpend: number;
    averagePoolingFrequency: number;
  };
  gold: {
    count: number;
    percentage: number;
    averageMonthlySpend: number;
    averagePoolingFrequency: number;
  };
  platinum: {
    count: number;
    percentage: number;
    averageMonthlySpend: number;
    averagePoolingFrequency: number;
  };
}

export interface ProgramPerformance {
  totalDiscountsGiven: number; // INR
  totalBonusCreditsIssued: number;
  totalBonusCreditsRedeemed: number;
  averageDiscountPerCustomer: number; // INR
  discountRedemptionRate: number; // %
  bonusCreditsRedemptionRate: number; // %
  programROI: number; // Return on investment %
  customerLifetimeValueIncrease: number; // %
}

export interface RetentionMetrics {
  overallRetentionRate: number; // %
  retentionByTier: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  churnRate: number; // %
  churnByTier: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  averageCustomerLifespan: number; // months
  reactivationRate: number; // % of churned customers who returned
}

export interface PoolingAdoptionMetrics {
  overallPoolingRate: number; // % of total deliveries that are pooled
  poolingRateByTier: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  poolingRateByCustomerType: {
    individual: number;
    msme: number;
    enterprise: number;
  };
  poolingGrowthRate: number; // % growth in pooling adoption
  averagePoolingFrequency: number; // % per customer
  poolingConversionRate: number; // % of customers who started pooling
}

export interface AggregateEnvironmentalImpact {
  totalCO2SavedKg: number;
  totalFuelSavedLiters: number;
  totalCostSavingsINR: number;
  treesEquivalent: number;
  impactByTier: {
    bronze: EnvironmentalImpactByTier;
    silver: EnvironmentalImpactByTier;
    gold: EnvironmentalImpactByTier;
    platinum: EnvironmentalImpactByTier;
  };
  impactByCustomerType: {
    individual: EnvironmentalImpactByTier;
    msme: EnvironmentalImpactByTier;
    enterprise: EnvironmentalImpactByTier;
  };
  averageImpactPerCustomer: EnvironmentalImpactByTier;
  environmentalTrend: EnvironmentalTrendData[];
}

export interface EnvironmentalImpactByTier {
  co2SavedKg: number;
  fuelSavedLiters: number;
  costSavingsINR: number;
  treesEquivalent: number;
  customerCount: number;
  averagePerCustomer: number;
}

export interface EnvironmentalTrendData {
  date: Date;
  co2SavedKg: number;
  fuelSavedLiters: number;
  costSavingsINR: number;
  activeCustomers: number;
}

export interface MSMEProgramMetrics {
  totalMSMECustomers: number;
  activeMSMECustomers: number;
  msmeRetentionRate: number; // %
  bulkBookingAdoption: {
    tier1: { customers: number; totalBookings: number; averageDiscount: number; };
    tier2: { customers: number; totalBookings: number; averageDiscount: number; };
    tier3: { customers: number; totalBookings: number; averageDiscount: number; };
  };
  msmeROI: {
    totalIncentivesGiven: number; // INR
    additionalRevenueGenerated: number; // INR
    roi: number; // %
  };
  sustainabilityProgram: {
    certificatesIssued: number;
    badgesAwarded: number;
    customReportsGenerated: number;
    environmentalImpactTracked: number; // Total CO2 saved by MSMEs
  };
  averageMSMELifetimeValue: number; // INR
  msmePoolingRate: number; // %
}

export interface CustomerLoyaltyAnalytics {
  customerId: string;
  customerType: CustomerType;
  loyaltyTier: LoyaltyTier;
  joinDate: Date;
  lastActivityDate: Date;
  totalSpend: number; // INR
  totalSavings: number; // INR from loyalty discounts
  lifetimeValue: number; // INR
  retentionScore: number; // 0-100
  poolingMetrics: CustomerPoolingMetrics;
  environmentalImpact: CustomerEnvironmentalImpact;
  engagementMetrics: CustomerEngagementMetrics;
  tierProgression: TierProgressionHistory[];
}

export interface CustomerPoolingMetrics {
  totalDeliveries: number;
  pooledDeliveries: number;
  poolingFrequency: number; // %
  poolingTrend: number[]; // Last 12 months
  firstPooledDelivery?: Date;
  longestPoolingStreak: number; // consecutive pooled deliveries
  currentPoolingStreak: number;
}

export interface CustomerEnvironmentalImpact {
  totalCO2SavedKg: number;
  totalFuelSavedLiters: number;
  totalCostSavingsINR: number;
  treesEquivalent: number;
  impactTrend: number[]; // Last 12 months CO2 savings
  milestones: EnvironmentalMilestone[];
  sustainabilityScore: number; // 0-100
}

export interface CustomerEngagementMetrics {
  notificationsReceived: number;
  notificationsOpened: number;
  bonusCreditsEarned: number;
  bonusCreditsRedeemed: number;
  referralsMade: number;
  referralsSuccessful: number;
  loyaltyProgramInteractions: number;
}

export interface TierProgressionHistory {
  tier: LoyaltyTier;
  achievedDate: Date;
  daysInTier: number;
  deliveriesInTier: number;
  spendInTier: number;
}

export interface EnvironmentalMilestone {
  type: 'co2_saved' | 'fuel_saved' | 'trees_equivalent' | 'cost_saved';
  value: number;
  achievedDate: Date;
  description: string;
}

export interface LoyaltyAnalyticsReport {
  id: string;
  title: string;
  period: {
    start: Date;
    end: Date;
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  };
  generatedAt: Date;
  summary: LoyaltyProgramMetrics;
  customerAnalytics: CustomerLoyaltyAnalytics[];
  insights: LoyaltyInsights;
  recommendations: LoyaltyRecommendations;
  benchmarks: LoyaltyBenchmarks;
}

export interface LoyaltyInsights {
  topPerformingTiers: string[];
  fastestGrowingSegments: string[];
  highestRetentionFactors: string[];
  poolingDrivers: string[];
  environmentalLeaders: string[];
  msmeSuccessStories: string[];
  churnRiskFactors: string[];
}

export interface LoyaltyRecommendations {
  tierOptimizations: string[];
  retentionStrategies: string[];
  poolingIncentives: string[];
  environmentalInitiatives: string[];
  msmeProgram: string[];
  engagementImprovements: string[];
}

export interface LoyaltyBenchmarks {
  industryAverages: {
    retentionRate: number;
    poolingAdoption: number;
    tierDistribution: Record<LoyaltyTier, number>;
    programROI: number;
  };
  performanceRating: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  competitivePosition: string;
  improvementAreas: string[];
}

export interface LoyaltyKPITarget {
  metric: string;
  currentValue: number;
  targetValue: number;
  timeframe: string;
  priority: 'high' | 'medium' | 'low';
  status: 'on_track' | 'at_risk' | 'behind';
}

export interface LoyaltySegmentAnalysis {
  segmentName: string;
  customerCount: number;
  characteristics: string[];
  averageLifetimeValue: number;
  retentionRate: number;
  poolingRate: number;
  environmentalImpact: number;
  growthPotential: 'high' | 'medium' | 'low';
  recommendedActions: string[];
}