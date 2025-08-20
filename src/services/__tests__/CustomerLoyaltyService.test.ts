/**
 * Unit tests for CustomerLoyaltyService
 */

import { CustomerLoyaltyService } from '../CustomerLoyaltyService';
import {

  DeliveryDetails,
  
  TIER_BENEFITS,
  ENVIRONMENTAL_CONSTANTS
} from '../../models/CustomerLoyalty';
import { ValidationError, NotFoundError } from '../../utils/errors';

describe('CustomerLoyaltyService', () => {
  let service: CustomerLoyaltyService;
  const mockCustomerId = 'customer-123';
  const mockMSMECustomerId = 'msme-456';

  beforeEach(() => {
    service = new CustomerLoyaltyService();
  });

  describe('createOrUpdateProfile', () => {
    it('should create a new customer profile with default bronze tier', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');

      expect(profile).toMatchObject({
        customerId: mockCustomerId,
        customerType: 'individual',
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
          totalSavingsINR: 0
        }
      });
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
      expect(profile.msmeIncentives).toBeUndefined();
    });

    it('should create MSME profile with MSME incentives', async () => {
      const profile = await service.createOrUpdateProfile(mockMSMECustomerId, 'msme');

      expect(profile.customerType).toBe('msme');
      expect(profile.msmeIncentives).toMatchObject({
        bulkBookingDiscount: 0,
        priorityScheduling: false,
        dedicatedAccountManager: false,
        customReporting: false,
        sustainabilityIncentives: {
          carbonNeutralCertificate: false,
          greenLogisticsPartnerBadge: false,
          sustainabilityReporting: false
        }
      });
    });

    it('should update existing profile customer type', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      const updatedProfile = await service.createOrUpdateProfile(mockCustomerId, 'enterprise');

      expect(updatedProfile.customerType).toBe('enterprise');
      expect(updatedProfile.customerId).toBe(mockCustomerId);
    });

    it('should throw ValidationError for empty customer ID', async () => {
      await expect(service.createOrUpdateProfile('', 'individual'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('calculateLoyaltyTier', () => {
    it('should calculate bronze tier for new customer', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      const tierCalculation = await service.calculateLoyaltyTier(mockCustomerId);

      expect(tierCalculation.currentTier).toBe('bronze');
      expect(tierCalculation.tierBenefits).toMatchObject(TIER_BENEFITS.bronze);
      expect(tierCalculation.nextTierRequirements.pooledDeliveriesNeeded).toBe(11);
      expect(tierCalculation.tierProgress).toBe(0);
    });

    it('should calculate silver tier for qualifying customer', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Update profile to meet silver tier requirements
      profile.poolingHistory.lastSixMonthsPooling = 15;
      profile.poolingHistory.co2SavedKg = 60;

      const tierCalculation = await service.calculateLoyaltyTier(mockCustomerId);

      expect(tierCalculation.currentTier).toBe('silver');
      expect(tierCalculation.tierBenefits).toMatchObject(TIER_BENEFITS.silver);
      expect(tierCalculation.nextTierRequirements.pooledDeliveriesNeeded).toBe(11); // 26 - 15
    });

    it('should calculate gold tier for qualifying customer', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Update profile to meet gold tier requirements
      profile.poolingHistory.lastSixMonthsPooling = 30;
      profile.poolingHistory.co2SavedKg = 200;

      const tierCalculation = await service.calculateLoyaltyTier(mockCustomerId);

      expect(tierCalculation.currentTier).toBe('gold');
      expect(tierCalculation.tierBenefits).toMatchObject(TIER_BENEFITS.gold);
    });

    it('should calculate platinum tier for qualifying customer', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Update profile to meet platinum tier requirements
      profile.poolingHistory.lastSixMonthsPooling = 55;
      profile.poolingHistory.co2SavedKg = 350;

      const tierCalculation = await service.calculateLoyaltyTier(mockCustomerId);

      expect(tierCalculation.currentTier).toBe('platinum');
      expect(tierCalculation.tierBenefits).toMatchObject(TIER_BENEFITS.platinum);
      expect(tierCalculation.nextTierRequirements.pooledDeliveriesNeeded).toBe(0);
      expect(tierCalculation.nextTierRequirements.currentProgress).toBe(100);
    });

    it('should throw NotFoundError for non-existent customer', async () => {
      await expect(service.calculateLoyaltyTier('non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePoolingHistory', () => {
    const mockDeliveryDetails: DeliveryDetails = {
      deliveryId: 'delivery-123',
      customerId: mockCustomerId,
      serviceType: 'shared',
      weight: 500,
      volume: 2,
      distanceKm: 10,
      wasPooled: true,
      deliveryDate: new Date()
    };

    it('should update pooling history for shared delivery', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      await service.updatePoolingHistory(mockCustomerId, mockDeliveryDetails);

      const profile = await service.getCustomerProfile(mockCustomerId);
      expect(profile?.poolingHistory.totalDeliveries).toBe(1);
      expect(profile?.poolingHistory.totalPooledDeliveries).toBe(1);
      expect(profile?.poolingHistory.lastSixMonthsPooling).toBe(1);
      expect(profile?.poolingHistory.poolingFrequency).toBe(100);
      expect(profile?.poolingHistory.co2SavedKg).toBeGreaterThan(0);
      expect(profile?.poolingHistory.costSavedINR).toBeGreaterThan(0);
    });

    it('should not update pooled statistics for non-pooled delivery', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      const nonPooledDelivery = {
        ...mockDeliveryDetails,
        serviceType: 'dedicated_premium' as const,
        wasPooled: false
      };

      await service.updatePoolingHistory(mockCustomerId, nonPooledDelivery);

      const profile = await service.getCustomerProfile(mockCustomerId);
      expect(profile?.poolingHistory.totalDeliveries).toBe(1);
      expect(profile?.poolingHistory.totalPooledDeliveries).toBe(0);
      expect(profile?.poolingHistory.poolingFrequency).toBe(0);
      expect(profile?.poolingHistory.co2SavedKg).toBe(0);
    });

    it('should create profile if customer does not exist', async () => {
      await service.updatePoolingHistory('new-customer', mockDeliveryDetails);

      const profile = await service.getCustomerProfile('new-customer');
      expect(profile).toBeTruthy();
      expect(profile?.customerId).toBe('new-customer');
      expect(profile?.customerType).toBe('individual');
    });

    it('should throw ValidationError for missing parameters', async () => {
      await expect(service.updatePoolingHistory('', mockDeliveryDetails))
        .rejects.toThrow(ValidationError);
      
      await expect(service.updatePoolingHistory(mockCustomerId, null as any))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('calculateIncentives', () => {
    it('should calculate basic incentives for bronze tier customer', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      const incentives = await service.calculateIncentives(mockCustomerId, 'shared');

      expect(incentives.baseDiscount).toBe(TIER_BENEFITS.bronze.discountPercentage);
      expect(incentives.tierBonus).toBe(0); // No premium service discount for shared
      expect(incentives.poolingFrequencyBonus).toBe(0); // No pooling history yet
      expect(incentives.msmeBonus).toBe(0); // Not MSME customer
      expect(incentives.totalDiscountPercentage).toBe(TIER_BENEFITS.bronze.discountPercentage);
      expect(incentives.bonusCreditsEarned).toBeGreaterThan(0);
    });

    it('should calculate premium service incentives', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Update profile to meet gold tier requirements
      profile.poolingHistory.lastSixMonthsPooling = 30;
      profile.poolingHistory.co2SavedKg = 200;
      
      const incentives = await service.calculateIncentives(mockCustomerId, 'dedicated_premium');

      expect(incentives.baseDiscount).toBe(TIER_BENEFITS.gold.discountPercentage);
      expect(incentives.tierBonus).toBe(TIER_BENEFITS.gold.premiumServiceDiscount);
      expect(incentives.bonusCreditsEarned).toBe(0); // No bonus credits for premium service
    });

    it('should calculate pooling frequency bonus', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      profile.poolingHistory.poolingFrequency = 85; // High pooling frequency
      
      const incentives = await service.calculateIncentives(mockCustomerId, 'shared');

      expect(incentives.poolingFrequencyBonus).toBe(5); // 5% bonus for 80%+ pooling
    });

    it('should cap total discount at 30%', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      profile.loyaltyTier = 'platinum';
      profile.poolingHistory.poolingFrequency = 90;
      
      const incentives = await service.calculateIncentives(mockCustomerId, 'dedicated_premium');

      expect(incentives.totalDiscountPercentage).toBeLessThanOrEqual(30);
    });

    it('should throw NotFoundError for non-existent customer', async () => {
      await expect(service.calculateIncentives('non-existent', 'shared'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('applyLoyaltyDiscount', () => {
    it('should apply discount correctly', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Update profile to meet silver tier requirements
      profile.poolingHistory.lastSixMonthsPooling = 15;
      profile.poolingHistory.co2SavedKg = 60;
      profile.incentives.bonusCredits = 50;

      const originalPrice = 1000;
      const bonusCreditsToUse = 20;

      const discountedPricing = await service.applyLoyaltyDiscount(
        mockCustomerId, 
        originalPrice, 
        bonusCreditsToUse
      );

      expect(discountedPricing.originalPrice).toBe(originalPrice);
      expect(discountedPricing.discountPercentage).toBe(TIER_BENEFITS.silver.discountPercentage);
      expect(discountedPricing.discountAmount).toBe(originalPrice * TIER_BENEFITS.silver.discountPercentage / 100);
      expect(discountedPricing.bonusCreditsUsed).toBe(bonusCreditsToUse);
      expect(discountedPricing.finalPrice).toBe(
        originalPrice - discountedPricing.discountAmount - bonusCreditsToUse
      );

      // Check that bonus credits were deducted from profile
      const updatedProfile = await service.getCustomerProfile(mockCustomerId);
      expect(updatedProfile?.incentives.bonusCredits).toBe(50 - bonusCreditsToUse + discountedPricing.bonusCreditsEarned);
    });

    it('should limit bonus credits usage to 10% of price', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      profile.incentives.bonusCredits = 200;

      const originalPrice = 500;
      const bonusCreditsToUse = 100; // Trying to use 20% of price

      const discountedPricing = await service.applyLoyaltyDiscount(
        mockCustomerId, 
        originalPrice, 
        bonusCreditsToUse
      );

      expect(discountedPricing.bonusCreditsUsed).toBe(50); // Limited to 10% of 500
    });

    it('should not allow negative final price', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      profile.loyaltyTier = 'platinum';
      profile.incentives.bonusCredits = 1000;

      const originalPrice = 100;
      const bonusCreditsToUse = 50;

      const discountedPricing = await service.applyLoyaltyDiscount(
        mockCustomerId, 
        originalPrice, 
        bonusCreditsToUse
      );

      expect(discountedPricing.finalPrice).toBeGreaterThanOrEqual(0);
    });

    it('should throw ValidationError for invalid price', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      await expect(service.applyLoyaltyDiscount(mockCustomerId, 0))
        .rejects.toThrow(ValidationError);
      
      await expect(service.applyLoyaltyDiscount(mockCustomerId, -100))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('trackEnvironmentalImpact', () => {
    const mockDeliveryDetails: DeliveryDetails = {
      deliveryId: 'delivery-123',
      customerId: mockCustomerId,
      serviceType: 'shared',
      weight: 500,
      volume: 2,
      distanceKm: 15,
      wasPooled: true,
      deliveryDate: new Date()
    };

    it('should calculate environmental impact for pooled delivery', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      const impact = await service.trackEnvironmentalImpact(mockCustomerId, mockDeliveryDetails);

      const expectedCO2Saved = mockDeliveryDetails.distanceKm * 
        (ENVIRONMENTAL_CONSTANTS.individualDelivery.co2PerKm - ENVIRONMENTAL_CONSTANTS.sharedDelivery.co2PerKm);
      const expectedCostSaved = mockDeliveryDetails.distanceKm * 
        (ENVIRONMENTAL_CONSTANTS.individualDelivery.costPerKm - ENVIRONMENTAL_CONSTANTS.sharedDelivery.costPerKm);

      expect(impact.co2SavedThisBooking).toBeCloseTo(expectedCO2Saved, 2);
      expect(impact.costSavingsINR).toBeCloseTo(expectedCostSaved, 2);
      expect(impact.fuelSavedLiters).toBeGreaterThan(0);
      expect(impact.treesEquivalent).toBeGreaterThanOrEqual(0);
    });

    it('should return zero impact for non-pooled delivery', async () => {
      const nonPooledDelivery = {
        ...mockDeliveryDetails,
        serviceType: 'dedicated_premium' as const,
        wasPooled: false
      };

      const impact = await service.trackEnvironmentalImpact(mockCustomerId, nonPooledDelivery);

      expect(impact.co2SavedThisBooking).toBe(0);
      expect(impact.costSavingsINR).toBe(0);
      expect(impact.fuelSavedLiters).toBe(0);
    });
  });

  describe('sendLoyaltyNotifications', () => {
    it('should send tier expiry warning notification', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Set tier expiry to 20 days from now (within 30-day warning period)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 20);
      profile.incentives.tierExpiryDate = expiryDate;

      await service.sendLoyaltyNotifications(mockCustomerId);

      const notifications = await service.getCustomerNotifications(mockCustomerId);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]?.type).toBe('tier_expiry_warning');
      expect(notifications[0]?.title).toBe('Loyalty Tier Expiring Soon');
    });

    it('should send milestone achievement notification', async () => {
      const profile = await service.createOrUpdateProfile(mockCustomerId, 'individual');
      profile.poolingHistory.co2SavedKg = 52; // Just achieved 50kg milestone

      await service.sendLoyaltyNotifications(mockCustomerId);

      const notifications = await service.getCustomerNotifications(mockCustomerId);
      const milestoneNotification = notifications.find(n => n.type === 'milestone_achieved');
      expect(milestoneNotification).toBeTruthy();
      expect(milestoneNotification?.title).toBe('Environmental Milestone Achieved!');
    });
  });

  describe('getMSMEIncentives', () => {
    it('should return MSME incentives for MSME customer', async () => {
      //const profile = await service.createOrUpdateProfile(mockMSMECustomerId, 'msme');
      const incentives = await service.getMSMEIncentives(mockMSMECustomerId);

      expect(incentives).toMatchObject({
        bulkBookingDiscount: 0,
        priorityScheduling: false,
        dedicatedAccountManager: false,
        customReporting: false,
        sustainabilityIncentives: {
          carbonNeutralCertificate: false,
          greenLogisticsPartnerBadge: false,
          sustainabilityReporting: false
        }
      });
    });

    it('should return null for non-MSME customer', async () => {
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      const incentives = await service.getMSMEIncentives(mockCustomerId);

      expect(incentives).toBeNull();
    });

    it('should return null for non-existent customer', async () => {
      const incentives = await service.getMSMEIncentives('non-existent');
      expect(incentives).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete customer journey from bronze to silver tier', async () => {
      // Create customer
      await service.createOrUpdateProfile(mockCustomerId, 'individual');
      
      // Simulate multiple pooled deliveries with longer distances to accumulate enough CO2 savings
      const deliveries: DeliveryDetails[] = [];
      for (let i = 0; i < 15; i++) {
        deliveries.push({
          deliveryId: `delivery-${i}`,
          customerId: mockCustomerId,
          serviceType: 'shared',
          weight: 300 + i * 10,
          volume: 1 + i * 0.1,
          distanceKm: 20 + i * 2, // Longer distances to accumulate more CO2 savings
          wasPooled: true,
          deliveryDate: new Date()
        });
      }

      // Process all deliveries
      for (const delivery of deliveries) {
        await service.updatePoolingHistory(mockCustomerId, delivery);
      }

      // Check the profile state before tier calculation
      const profileBeforeTier = await service.getCustomerProfile(mockCustomerId);
      console.log('Profile before tier calc:', {
        pooledDeliveries: profileBeforeTier?.poolingHistory.lastSixMonthsPooling,
        co2Saved: profileBeforeTier?.poolingHistory.co2SavedKg
      });

      // Check tier upgrade
      const tierCalculation = await service.calculateLoyaltyTier(mockCustomerId);
      expect(tierCalculation.currentTier).toBe('silver');

      // Check incentives
      const incentives = await service.calculateIncentives(mockCustomerId, 'shared');
      expect(incentives.baseDiscount).toBe(TIER_BENEFITS.silver.discountPercentage);
      expect(incentives.poolingFrequencyBonus).toBeGreaterThan(0); // Should have high pooling frequency

      // Check environmental impact
      const profile = await service.getCustomerProfile(mockCustomerId);
      expect(profile?.poolingHistory.co2SavedKg).toBeGreaterThan(50);
      expect(profile?.poolingHistory.costSavedINR).toBeGreaterThan(0);
    });

    it('should handle MSME customer with bulk booking incentives', async () => {
      // Create MSME customer
      const profile = await service.createOrUpdateProfile(mockMSMECustomerId, 'msme');
      
      // Simulate bulk booking discount eligibility
      if (profile.msmeIncentives) {
        profile.msmeIncentives.bulkBookingDiscount = 12; // Tier 2 discount
        profile.msmeIncentives.priorityScheduling = true;
      }

      // Calculate incentives
      const incentives = await service.calculateIncentives(mockMSMECustomerId, 'shared');
      expect(incentives.msmeBonus).toBe(12);
      expect(incentives.totalDiscountPercentage).toBeGreaterThan(TIER_BENEFITS.bronze.discountPercentage);

      // Get MSME-specific incentives
      const msmeIncentives = await service.getMSMEIncentives(mockMSMECustomerId);
      expect(msmeIncentives?.priorityScheduling).toBe(true);
      expect(msmeIncentives?.bulkBookingDiscount).toBe(12);
    });
  });
});