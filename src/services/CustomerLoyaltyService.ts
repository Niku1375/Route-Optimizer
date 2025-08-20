/**
 * Customer Loyalty Service
 * Manages customer loyalty tiers, incentives, and environmental impact tracking
 */

import {
  CustomerLoyaltyProfile,
  PoolingHistory,
  MSMEIncentives,
  LoyaltyIncentiveCalculation,
  EnvironmentalImpact,
  DiscountedPricing,
  LoyaltyTierCalculation,
  TierBenefits,
  NextTierRequirements,
  DeliveryDetails,
  LoyaltyNotification,
  LOYALTY_TIER_THRESHOLDS,
  TIER_BENEFITS,
  ENVIRONMENTAL_CONSTANTS
} from '../models/CustomerLoyalty';
import { LoyaltyTier, CustomerType, ServiceType } from '../models/Common';
import { ValidationError, NotFoundError } from '../utils/errors';

export class CustomerLoyaltyService {
  private loyaltyProfiles: Map<string, CustomerLoyaltyProfile> = new Map();
  private notifications: Map<string, LoyaltyNotification[]> = new Map();

  /**
   * Creates or updates a customer loyalty profile
   * @param customerId - Customer identifier
   * @param customerType - Type of customer (individual, msme, enterprise)
   * @returns Promise<CustomerLoyaltyProfile>
   */
  async createOrUpdateProfile(
    customerId: string, 
    customerType: CustomerType
  ): Promise<CustomerLoyaltyProfile> {
    if (!customerId) {
      throw new ValidationError('Customer ID is required');
    }

    const existingProfile = this.loyaltyProfiles.get(customerId);
    
    if (existingProfile) {
      existingProfile.customerType = customerType;
      existingProfile.updatedAt = new Date();
      return existingProfile;
    }

    const newProfile: CustomerLoyaltyProfile = {
      customerId,
      customerType,
      loyaltyTier: 'bronze',
      poolingHistory: {
        totalPooledDeliveries: 0,
        poolingFrequency: 0,
        co2SavedKg: 0,
        costSavedINR: 0,
        lastSixMonthsPooling: 0,
        totalDeliveries: 0
      },
      incentives: {
        currentDiscountPercentage: TIER_BENEFITS.bronze.discountPercentage,
        bonusCredits: 0,
        tierExpiryDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000), // 6 months
        nextTierRequirement: 'Complete 11 pooled deliveries to reach Silver tier',
        totalSavingsINR: 0
      },
      msmeIncentives: customerType === 'msme' ? {
        bulkBookingDiscount: 0,
        priorityScheduling: false,
        dedicatedAccountManager: false,
        customReporting: false,
        sustainabilityIncentives: {
          carbonNeutralCertificate: false,
          greenLogisticsPartnerBadge: false,
          sustainabilityReporting: false
        }
      } as MSMEIncentives : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.loyaltyProfiles.set(customerId, newProfile);
    return newProfile;
  }

  /**
   * Calculates customer loyalty tier based on pooling history
   * @param customerId - Customer identifier
   * @returns Promise<LoyaltyTierCalculation>
   */
  async calculateLoyaltyTier(customerId: string): Promise<LoyaltyTierCalculation> {
    const profile = this.loyaltyProfiles.get(customerId);
    if (!profile) {
      throw new NotFoundError(`Customer profile not found: ${customerId}`);
    }

    const { lastSixMonthsPooling, co2SavedKg } = profile.poolingHistory;
    
    // Determine current tier based on thresholds
    let currentTier: LoyaltyTier = 'bronze';
    if (lastSixMonthsPooling >= LOYALTY_TIER_THRESHOLDS.platinum.minDeliveries && 
        co2SavedKg >= LOYALTY_TIER_THRESHOLDS.platinum.minCO2Saved) {
      currentTier = 'platinum';
    } else if (lastSixMonthsPooling >= LOYALTY_TIER_THRESHOLDS.gold.minDeliveries && 
               co2SavedKg >= LOYALTY_TIER_THRESHOLDS.gold.minCO2Saved) {
      currentTier = 'gold';
    } else if (lastSixMonthsPooling >= LOYALTY_TIER_THRESHOLDS.silver.minDeliveries && 
               co2SavedKg >= LOYALTY_TIER_THRESHOLDS.silver.minCO2Saved) {
      currentTier = 'silver';
    }

    // Get tier benefits
    const tierBenefits: TierBenefits = {
      discountPercentage: TIER_BENEFITS[currentTier].discountPercentage,
      bonusCreditsMultiplier: TIER_BENEFITS[currentTier].bonusCreditsMultiplier,
      prioritySupport: TIER_BENEFITS[currentTier].prioritySupport,
      premiumServiceDiscount: TIER_BENEFITS[currentTier].premiumServiceDiscount,
      specialFeatures: TIER_BENEFITS[currentTier].specialFeatures
    };

    // Calculate next tier requirements
    const nextTierRequirements = this.calculateNextTierRequirements(currentTier, profile.poolingHistory);
    
    // Calculate progress towards next tier
    const tierProgress = this.calculateTierProgress(currentTier, profile.poolingHistory);

    // Update profile if tier changed
    if (profile.loyaltyTier !== currentTier) {
      profile.loyaltyTier = currentTier;
      profile.incentives.currentDiscountPercentage = tierBenefits.discountPercentage;
      profile.updatedAt = new Date();
      
      // Send tier upgrade notification
      await this.sendTierUpgradeNotification(customerId, currentTier);
    }

    // Always update the profile with current tier (in case it was just calculated)
    profile.loyaltyTier = currentTier;
    profile.incentives.currentDiscountPercentage = tierBenefits.discountPercentage;

    return {
      currentTier,
      tierBenefits,
      nextTierRequirements,
      tierProgress
    };
  }

  /**
   * Updates customer pooling history after a delivery
   * @param customerId - Customer identifier
   * @param deliveryDetails - Details of the completed delivery
   * @returns Promise<void>
   */
  async updatePoolingHistory(customerId: string, deliveryDetails: DeliveryDetails): Promise<void> {
    if (!customerId || !deliveryDetails) {
      throw new ValidationError('Customer ID and delivery details are required');
    }

    let profile = this.loyaltyProfiles.get(customerId);
    if (!profile) {
      // Create new profile if it doesn't exist
      profile = await this.createOrUpdateProfile(customerId, 'individual');
    }

    // Update total deliveries
    profile.poolingHistory.totalDeliveries += 1;

    // Update pooled delivery statistics if this was a shared service
    if (deliveryDetails.serviceType === 'shared' && deliveryDetails.wasPooled) {
      profile.poolingHistory.totalPooledDeliveries += 1;
      profile.poolingHistory.lastPooledDelivery = deliveryDetails.deliveryDate;
      
      // Update last 6 months pooling count
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (deliveryDetails.deliveryDate >= sixMonthsAgo) {
        profile.poolingHistory.lastSixMonthsPooling += 1;
      }

      // Calculate and add environmental impact
      const environmentalImpact = this.calculateEnvironmentalImpact(deliveryDetails);
      profile.poolingHistory.co2SavedKg += environmentalImpact.co2SavedThisBooking;
      profile.poolingHistory.costSavedINR += environmentalImpact.costSavingsINR;
    }

    // Recalculate pooling frequency
    profile.poolingHistory.poolingFrequency = 
      (profile.poolingHistory.totalPooledDeliveries / profile.poolingHistory.totalDeliveries) * 100;

    profile.updatedAt = new Date();

    // Recalculate tier after update
    await this.calculateLoyaltyTier(customerId);
  }

  /**
   * Calculates loyalty incentives for a booking
   * @param customerId - Customer identifier
   * @param serviceType - Type of service being booked
   * @param deliveryDetails - Optional delivery details for environmental impact
   * @returns Promise<LoyaltyIncentiveCalculation>
   */
  async calculateIncentives(
    customerId: string, 
    serviceType: ServiceType,
    deliveryDetails?: DeliveryDetails
  ): Promise<LoyaltyIncentiveCalculation> {
    const profile = this.loyaltyProfiles.get(customerId);
    if (!profile) {
      throw new NotFoundError(`Customer profile not found: ${customerId}`);
    }

    const tierCalculation = await this.calculateLoyaltyTier(customerId);
    const tierBenefits = tierCalculation.tierBenefits;

    // Base discount from tier
    const baseDiscount = tierBenefits.discountPercentage;

    // Tier bonus for premium services
    const tierBonus = serviceType === 'dedicated_premium' ? tierBenefits.premiumServiceDiscount : 0;

    // Pooling frequency bonus (additional discount for frequent poolers)
    const poolingFrequencyBonus = this.calculatePoolingFrequencyBonus(profile.poolingHistory.poolingFrequency);

    // MSME bonus
    const msmeBonus = await this.calculateMSMEBonus(customerId);

    // Total discount percentage
    const totalDiscountPercentage = Math.min(
      baseDiscount + tierBonus + poolingFrequencyBonus + msmeBonus,
      30 // Cap at 30% total discount
    );

    // Calculate bonus credits earned
    const bonusCreditsEarned = serviceType === 'shared' ? 
      Math.floor(tierBenefits.bonusCreditsMultiplier * 10) : 0;

    // Calculate environmental impact if delivery details provided
    const environmentalImpact = deliveryDetails ? 
      this.calculateEnvironmentalImpact(deliveryDetails) : 
      {
        co2SavedThisBooking: 0,
        cumulativeCo2Saved: profile.poolingHistory.co2SavedKg,
        fuelSavedLiters: 0,
        costSavingsINR: 0,
        treesEquivalent: Math.floor(profile.poolingHistory.co2SavedKg / ENVIRONMENTAL_CONSTANTS.co2ToTreesRatio)
      };

    return {
      baseDiscount,
      tierBonus,
      poolingFrequencyBonus,
      msmeBonus,
      totalDiscountPercentage,
      bonusCreditsEarned,
      environmentalImpact
    };
  }

  /**
   * Applies loyalty discount to pricing
   * @param customerId - Customer identifier
   * @param originalPrice - Original price before discount
   * @param bonusCreditsToUse - Optional bonus credits to apply
   * @returns Promise<DiscountedPricing>
   */
  async applyLoyaltyDiscount(
    customerId: string, 
    originalPrice: number,
    bonusCreditsToUse: number = 0
  ): Promise<DiscountedPricing> {
    if (originalPrice <= 0) {
      throw new ValidationError('Original price must be positive');
    }

    const profile = this.loyaltyProfiles.get(customerId);
    if (!profile) {
      throw new NotFoundError(`Customer profile not found: ${customerId}`);
    }

    const incentives = await this.calculateIncentives(customerId, 'shared');
    const discountPercentage = incentives.totalDiscountPercentage;
    const discountAmount = (originalPrice * discountPercentage) / 100;

    // Apply bonus credits (1 credit = 1 INR)
    const maxCreditsUsable = Math.min(bonusCreditsToUse, profile.incentives.bonusCredits, originalPrice * 0.1); // Max 10% of price
    const bonusCreditsUsed = Math.floor(maxCreditsUsable);

    const finalPrice = Math.max(0, originalPrice - discountAmount - bonusCreditsUsed);

    // Update profile
    profile.incentives.bonusCredits -= bonusCreditsUsed;
    profile.incentives.bonusCredits += incentives.bonusCreditsEarned;
    profile.incentives.totalSavingsINR += discountAmount + bonusCreditsUsed;
    profile.updatedAt = new Date();

    return {
      originalPrice,
      discountPercentage,
      discountAmount,
      finalPrice,
      bonusCreditsUsed,
      bonusCreditsEarned: incentives.bonusCreditsEarned
    };
  }

  /**
   * Tracks environmental impact of a delivery
   * @param customerId - Customer identifier
   * @param deliveryDetails - Details of the delivery
   * @returns Promise<EnvironmentalImpact>
   */
  async trackEnvironmentalImpact(
    customerId: string, 
    deliveryDetails: DeliveryDetails
  ): Promise<EnvironmentalImpact> {
    const impact = this.calculateEnvironmentalImpact(deliveryDetails);
    
    // Update customer profile
    const profile = this.loyaltyProfiles.get(customerId);
    if (profile && deliveryDetails.wasPooled) {
      profile.poolingHistory.co2SavedKg += impact.co2SavedThisBooking;
      profile.poolingHistory.costSavedINR += impact.costSavingsINR;
      profile.updatedAt = new Date();
    }

    return impact;
  }

  /**
   * Sends loyalty notifications to customer
   * @param customerId - Customer identifier
   * @returns Promise<void>
   */
  async sendLoyaltyNotifications(customerId: string): Promise<void> {
    const profile = this.loyaltyProfiles.get(customerId);
    if (!profile) {
      return;
    }

    const notifications: LoyaltyNotification[] = [];

    // Check for tier expiry warning (30 days before expiry)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    if (profile.incentives.tierExpiryDate <= thirtyDaysFromNow) {
      notifications.push({
        customerId,
        type: 'tier_expiry_warning',
        title: 'Loyalty Tier Expiring Soon',
        message: `Your ${profile.loyaltyTier} tier will expire on ${profile.incentives.tierExpiryDate.toDateString()}. Complete more pooled deliveries to maintain your benefits.`,
        actionRequired: 'Book shared deliveries to maintain tier',
        expiryDate: profile.incentives.tierExpiryDate,
        createdAt: new Date()
      });
    }

    // Check for milestone achievements
    const co2Milestones = [50, 100, 250, 500, 1000];
    const currentCO2 = Math.floor(profile.poolingHistory.co2SavedKg);
    
    for (const milestone of co2Milestones) {
      if (currentCO2 >= milestone && currentCO2 < milestone + 10) { // Recently achieved
        notifications.push({
          customerId,
          type: 'milestone_achieved',
          title: 'Environmental Milestone Achieved!',
          message: `Congratulations! You've saved ${milestone}kg of CO2 through pooled deliveries. That's equivalent to planting ${Math.floor(milestone / ENVIRONMENTAL_CONSTANTS.co2ToTreesRatio)} trees!`,
          createdAt: new Date()
        });
      }
    }

    // Store notifications
    this.notifications.set(customerId, [
      ...(this.notifications.get(customerId) || []),
      ...notifications
    ]);
  }

  /**
   * Gets MSME-specific incentives for a customer
   * @param customerId - Customer identifier
   * @returns Promise<MSMEIncentives | null>
   */
  async getMSMEIncentives(customerId: string): Promise<MSMEIncentives | null> {
    const profile = this.loyaltyProfiles.get(customerId);
    if (!profile || profile.customerType !== 'msme') {
      return null;
    }

    return profile.msmeIncentives || null;
  }

  /**
   * Gets customer loyalty profile
   * @param customerId - Customer identifier
   * @returns Promise<CustomerLoyaltyProfile | null>
   */
  async getCustomerProfile(customerId: string): Promise<CustomerLoyaltyProfile | null> {
    return this.loyaltyProfiles.get(customerId) || null;
  }

  /**
   * Gets customer notifications
   * @param customerId - Customer identifier
   * @returns Promise<LoyaltyNotification[]>
   */
  async getCustomerNotifications(customerId: string): Promise<LoyaltyNotification[]> {
    return this.notifications.get(customerId) || [];
  }

  /**
   * Calculates environmental impact of a delivery
   * @param deliveryDetails - Details of the delivery
   * @returns EnvironmentalImpact
   */
  private calculateEnvironmentalImpact(deliveryDetails: DeliveryDetails): EnvironmentalImpact {
    const { distanceKm, serviceType, wasPooled } = deliveryDetails;
    
    let co2SavedThisBooking = 0;
    let fuelSavedLiters = 0;
    let costSavingsINR = 0;

    if (serviceType === 'shared' && wasPooled) {
      // Calculate savings compared to individual delivery
      const sharedCO2 = distanceKm * ENVIRONMENTAL_CONSTANTS.sharedDelivery.co2PerKm;
      const individualCO2 = distanceKm * ENVIRONMENTAL_CONSTANTS.individualDelivery.co2PerKm;
      co2SavedThisBooking = individualCO2 - sharedCO2;

      // Calculate fuel savings
      fuelSavedLiters = co2SavedThisBooking / ENVIRONMENTAL_CONSTANTS.co2PerLiterFuel;

      // Calculate cost savings
      const sharedCost = distanceKm * ENVIRONMENTAL_CONSTANTS.sharedDelivery.costPerKm;
      const individualCost = distanceKm * ENVIRONMENTAL_CONSTANTS.individualDelivery.costPerKm;
      costSavingsINR = individualCost - sharedCost;
    }

    // Get cumulative CO2 saved from profile
    const profile = this.loyaltyProfiles.get(deliveryDetails.customerId);
    const cumulativeCo2Saved = (profile?.poolingHistory.co2SavedKg || 0) + co2SavedThisBooking;

    return {
      co2SavedThisBooking: Math.round(co2SavedThisBooking * 100) / 100,
      cumulativeCo2Saved: Math.round(cumulativeCo2Saved * 100) / 100,
      fuelSavedLiters: Math.round(fuelSavedLiters * 100) / 100,
      costSavingsINR: Math.round(costSavingsINR * 100) / 100,
      treesEquivalent: Math.floor(cumulativeCo2Saved / ENVIRONMENTAL_CONSTANTS.co2ToTreesRatio)
    };
  }

  /**
   * Calculates next tier requirements
   * @param currentTier - Current loyalty tier
   * @param poolingHistory - Customer's pooling history
   * @returns NextTierRequirements
   */
  private calculateNextTierRequirements(
    currentTier: LoyaltyTier, 
    poolingHistory: PoolingHistory
  ): NextTierRequirements {
    const nextTierMap: Record<LoyaltyTier, LoyaltyTier | null> = {
      bronze: 'silver',
      silver: 'gold',
      gold: 'platinum',
      platinum: null
    };

    const nextTier = nextTierMap[currentTier];
    
    if (!nextTier) {
      return {
        pooledDeliveriesNeeded: 0,
        co2SavingsNeeded: 0,
        timeframeMonths: 6,
        currentProgress: 100
      };
    }

    const nextThreshold = LOYALTY_TIER_THRESHOLDS[nextTier];
    const pooledDeliveriesNeeded = Math.max(0, nextThreshold.minDeliveries - poolingHistory.lastSixMonthsPooling);
    const co2SavingsNeeded = Math.max(0, nextThreshold.minCO2Saved - poolingHistory.co2SavedKg);

    // Calculate progress (based on the requirement that's furthest from completion)
    const deliveryProgress = (poolingHistory.lastSixMonthsPooling / nextThreshold.minDeliveries) * 100;
    const co2Progress = (poolingHistory.co2SavedKg / nextThreshold.minCO2Saved) * 100;
    const currentProgress = Math.min(deliveryProgress, co2Progress);

    return {
      pooledDeliveriesNeeded,
      co2SavingsNeeded,
      timeframeMonths: 6,
      currentProgress: Math.min(100, Math.max(0, currentProgress))
    };
  }

  /**
   * Calculates tier progress percentage
   * @param currentTier - Current loyalty tier
   * @param poolingHistory - Customer's pooling history
   * @returns Progress percentage (0-100)
   */
  private calculateTierProgress(currentTier: LoyaltyTier, poolingHistory: PoolingHistory): number {
    const requirements = this.calculateNextTierRequirements(currentTier, poolingHistory);
    return requirements.currentProgress;
  }

  /**
   * Calculates pooling frequency bonus
   * @param poolingFrequency - Customer's pooling frequency percentage
   * @returns Bonus percentage
   */
  private calculatePoolingFrequencyBonus(poolingFrequency: number): number {
    if (poolingFrequency >= 80) return 5; // 5% bonus for 80%+ pooling
    if (poolingFrequency >= 60) return 3; // 3% bonus for 60%+ pooling
    if (poolingFrequency >= 40) return 2; // 2% bonus for 40%+ pooling
    return 0;
  }

  /**
   * Calculates MSME-specific bonus
   * @param customerId - Customer identifier
   * @returns Promise<number> - Bonus percentage
   */
  private async calculateMSMEBonus(customerId: string): Promise<number> {
    const profile = this.loyaltyProfiles.get(customerId);
    if (!profile || profile.customerType !== 'msme' || !profile.msmeIncentives) {
      return 0;
    }

    return profile.msmeIncentives.bulkBookingDiscount;
  }

  /**
   * Sends tier upgrade notification
   * @param customerId - Customer identifier
   * @param newTier - New loyalty tier
   * @returns Promise<void>
   */
  private async sendTierUpgradeNotification(customerId: string, newTier: LoyaltyTier): Promise<void> {
    const notification: LoyaltyNotification = {
      customerId,
      type: 'tier_upgrade',
      title: 'Loyalty Tier Upgraded!',
      message: `Congratulations! You've been upgraded to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} tier. Enjoy your new benefits including ${TIER_BENEFITS[newTier].discountPercentage}% discount on all services.`,
      createdAt: new Date()
    };

    const existingNotifications = this.notifications.get(customerId) || [];
    this.notifications.set(customerId, [...existingNotifications, notification]);
  }

}