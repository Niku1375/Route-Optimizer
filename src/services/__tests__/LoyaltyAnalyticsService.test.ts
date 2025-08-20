/**
 * Unit tests for LoyaltyAnalyticsService
 */

import { LoyaltyAnalyticsService } from '../LoyaltyAnalyticsService';
import { CustomerLoyaltyService } from '../CustomerLoyaltyService';
import {
  CustomerLoyaltyProfile,
  DeliveryDetails,
  ENVIRONMENTAL_CONSTANTS
} from '../../models/CustomerLoyalty';
import { LoyaltyTier, CustomerType } from '../../models/Common';

describe('LoyaltyAnalyticsService', () => {
  let loyaltyAnalyticsService: LoyaltyAnalyticsService;
  let mockLoyaltyService: jest.Mocked<CustomerLoyaltyService>;

  beforeEach(() => {
    mockLoyaltyService = {
      getCustomerProfile: jest.fn(),
      createOrUpdateProfile: jest.fn(),
      calculateLoyaltyTier: jest.fn(),
      updatePoolingHistory: jest.fn(),
      calculateIncentives: jest.fn(),
      applyLoyaltyDiscount: jest.fn(),
      trackEnvironmentalImpact: jest.fn(),
      sendLoyaltyNotifications: jest.fn(),
      getMSMEIncentives: jest.fn(),
      getCustomerNotifications: jest.fn()
    } as any;

    loyaltyAnalyticsService = new LoyaltyAnalyticsService(mockLoyaltyService);
  });

  describe('generateLoyaltyProgramMetrics', () => {
    it('should generate comprehensive loyalty program metrics', async () => {
      // Mock customer profiles
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('customer1', 'individual', 'bronze', 5, 25.5, 1200),
        createMockCustomerProfile('customer2', 'msme', 'silver', 15, 75.2, 3500),
        createMockCustomerProfile('customer3', 'individual', 'gold', 30, 150.8, 6200),
        createMockCustomerProfile('customer4', 'enterprise', 'platinum', 60, 320.4, 12000)
      ];

      // Mock the getAllCustomerProfiles method
      jest.spyOn(loyaltyAnalyticsService as any, 'getAllCustomerProfiles')
        .mockResolvedValue(mockProfiles);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = await loyaltyAnalyticsService.generateLoyaltyProgramMetrics(
        'monthly',
        startDate,
        endDate
      );

      expect(metrics).toBeDefined();
      expect(metrics.period).toBe('monthly');
      expect(metrics.totalCustomers).toBe(4);
      expect(metrics.tierDistribution).toBeDefined();
      expect(metrics.programPerformance).toBeDefined();
      expect(metrics.retentionMetrics).toBeDefined();
      expect(metrics.poolingAdoption).toBeDefined();
      expect(metrics.environmentalImpact).toBeDefined();
      expect(metrics.msmeProgram).toBeDefined();

      // Verify tier distribution
      expect(metrics.tierDistribution.bronze.count).toBe(1);
      expect(metrics.tierDistribution.silver.count).toBe(1);
      expect(metrics.tierDistribution.gold.count).toBe(1);
      expect(metrics.tierDistribution.platinum.count).toBe(1);

      // Verify percentages add up to 100
      const totalPercentage = 
        metrics.tierDistribution.bronze.percentage +
        metrics.tierDistribution.silver.percentage +
        metrics.tierDistribution.gold.percentage +
        metrics.tierDistribution.platinum.percentage;
      expect(totalPercentage).toBe(100);
    });

    it('should handle empty customer list', async () => {
      jest.spyOn(loyaltyAnalyticsService as any, 'getAllCustomerProfiles')
        .mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = await loyaltyAnalyticsService.generateLoyaltyProgramMetrics(
        'monthly',
        startDate,
        endDate
      );

      expect(metrics.totalCustomers).toBe(0);
      expect(metrics.activeCustomers).toBe(0);
      expect(metrics.newCustomers).toBe(0);
      expect(metrics.tierDistribution.bronze.count).toBe(0);
    });
  });

  describe('generateCustomerAnalytics', () => {
    it('should generate detailed customer analytics', async () => {
      const customerId = 'customer1';
      const mockProfile = createMockCustomerProfile(customerId, 'individual', 'gold', 25, 125.5, 5000);
      
      mockLoyaltyService.getCustomerProfile.mockResolvedValue(mockProfile);

      const analytics = await loyaltyAnalyticsService.generateCustomerAnalytics(customerId);

      expect(analytics).toBeDefined();
      expect(analytics.customerId).toBe(customerId);
      expect(analytics.loyaltyTier).toBe('gold');
      expect(analytics.customerType).toBe('individual');
      expect(analytics.poolingMetrics).toBeDefined();
      expect(analytics.environmentalImpact).toBeDefined();
      expect(analytics.engagementMetrics).toBeDefined();
      expect(analytics.tierProgression).toBeDefined();
      expect(analytics.retentionScore).toBeGreaterThanOrEqual(0);
      expect(analytics.retentionScore).toBeLessThanOrEqual(100);
    });

    it('should throw error for non-existent customer', async () => {
      const customerId = 'nonexistent';
      mockLoyaltyService.getCustomerProfile.mockResolvedValue(null);

      await expect(loyaltyAnalyticsService.generateCustomerAnalytics(customerId))
        .rejects.toThrow('Customer profile not found: nonexistent');
    });
  });

  describe('generateLoyaltyAnalyticsReport', () => {
    it('should generate comprehensive loyalty analytics report', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('customer1', 'individual', 'bronze', 5, 25.5, 1200),
        createMockCustomerProfile('customer2', 'msme', 'silver', 15, 75.2, 3500)
      ];

      jest.spyOn(loyaltyAnalyticsService as any, 'getAllCustomerProfiles')
        .mockResolvedValue(mockProfiles);

      mockLoyaltyService.getCustomerProfile
        .mockResolvedValueOnce(mockProfiles[0]!)
        .mockResolvedValueOnce(mockProfiles[1]!);

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        type: 'monthly' as const
      };

      const report = await loyaltyAnalyticsService.generateLoyaltyAnalyticsReport(
        'Monthly Loyalty Report',
        period
      );

      expect(report).toBeDefined();
      expect(report.title).toBe('Monthly Loyalty Report');
      expect(report.period).toEqual(period);
      expect(report.summary).toBeDefined();
      expect(report.customerAnalytics).toBeDefined();
      expect(report.insights).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.benchmarks).toBeDefined();
      expect(report.id).toMatch(/^loyalty-report-\d+$/);
    });
  });

  describe('Tier Distribution Calculations', () => {
    it('should correctly calculate tier distribution', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('c1', 'individual', 'bronze', 5, 25, 1000),
        createMockCustomerProfile('c2', 'individual', 'bronze', 8, 40, 1500),
        createMockCustomerProfile('c3', 'msme', 'silver', 15, 75, 3000),
        createMockCustomerProfile('c4', 'individual', 'gold', 30, 150, 5000),
        createMockCustomerProfile('c5', 'enterprise', 'platinum', 60, 300, 10000)
      ];

      const tierDistribution = await (loyaltyAnalyticsService as any).calculateTierDistribution(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(tierDistribution.bronze.count).toBe(2);
      expect(tierDistribution.bronze.percentage).toBe(40); // 2/5 * 100
      expect(tierDistribution.silver.count).toBe(1);
      expect(tierDistribution.silver.percentage).toBe(20); // 1/5 * 100
      expect(tierDistribution.gold.count).toBe(1);
      expect(tierDistribution.gold.percentage).toBe(20);
      expect(tierDistribution.platinum.count).toBe(1);
      expect(tierDistribution.platinum.percentage).toBe(20);

      // Check average pooling frequencies
      expect(tierDistribution.bronze.averagePoolingFrequency).toBe(32.5); // (25+40)/2
      expect(tierDistribution.silver.averagePoolingFrequency).toBe(75);
      expect(tierDistribution.gold.averagePoolingFrequency).toBe(150);
      expect(tierDistribution.platinum.averagePoolingFrequency).toBe(300);
    });
  });

  describe('Environmental Impact Calculations', () => {
    it('should correctly calculate aggregate environmental impact', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('c1', 'individual', 'bronze', 5, 50, 1000),
        createMockCustomerProfile('c2', 'msme', 'silver', 15, 100, 2000),
        createMockCustomerProfile('c3', 'individual', 'gold', 30, 200, 4000)
      ];

      const environmentalImpact = await (loyaltyAnalyticsService as any).calculateAggregateEnvironmentalImpact(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(environmentalImpact.totalCO2SavedKg).toBe(350); // 50+100+200
      expect(environmentalImpact.totalCostSavingsINR).toBe(7000); // 1000+2000+4000
      expect(environmentalImpact.totalFuelSavedLiters).toBeCloseTo(
        350 / ENVIRONMENTAL_CONSTANTS.co2PerLiterFuel
      );
      expect(environmentalImpact.treesEquivalent).toBe(
        Math.floor(350 / ENVIRONMENTAL_CONSTANTS.co2ToTreesRatio)
      );

      // Check average impact per customer
      expect(environmentalImpact.averageImpactPerCustomer.co2SavedKg).toBeCloseTo(116.67, 1);
      expect(environmentalImpact.averageImpactPerCustomer.customerCount).toBe(3);
    });

    it('should handle zero environmental impact', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('c1', 'individual', 'bronze', 0, 0, 0)
      ];

      const environmentalImpact = await (loyaltyAnalyticsService as any).calculateAggregateEnvironmentalImpact(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(environmentalImpact.totalCO2SavedKg).toBe(0);
      expect(environmentalImpact.totalFuelSavedLiters).toBe(0);
      expect(environmentalImpact.totalCostSavingsINR).toBe(0);
      expect(environmentalImpact.treesEquivalent).toBe(0);
    });
  });

  describe('MSME Program Metrics', () => {
    it('should correctly calculate MSME program metrics', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('c1', 'individual', 'bronze', 5, 25, 1000),
        createMockCustomerProfile('c2', 'msme', 'silver', 15, 75, 3000),
        createMockCustomerProfile('c3', 'msme', 'gold', 30, 150, 5000),
        createMockCustomerProfile('c4', 'enterprise', 'platinum', 60, 300, 10000)
      ];

      const msmeMetrics = await (loyaltyAnalyticsService as any).calculateMSMEProgramMetrics(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(msmeMetrics.totalMSMECustomers).toBe(2);
      expect(msmeMetrics.activeMSMECustomers).toBeLessThanOrEqual(2);
      expect(msmeMetrics.msmeRetentionRate).toBeGreaterThanOrEqual(0);
      expect(msmeMetrics.msmeRetentionRate).toBeLessThanOrEqual(100);

      // Check bulk booking adoption structure
      expect(msmeMetrics.bulkBookingAdoption.tier1).toBeDefined();
      expect(msmeMetrics.bulkBookingAdoption.tier2).toBeDefined();
      expect(msmeMetrics.bulkBookingAdoption.tier3).toBeDefined();

      // Check ROI calculation
      expect(msmeMetrics.msmeROI.totalIncentivesGiven).toBe(8000); // 3000+5000
      expect(msmeMetrics.msmeROI.additionalRevenueGenerated).toBe(10000); // 2 MSMEs * 5000
      expect(msmeMetrics.msmeROI.roi).toBe(25); // ((10000-8000)/8000)*100

      // Check sustainability program
      expect(msmeMetrics.sustainabilityProgram.certificatesIssued).toBeGreaterThanOrEqual(0);
      expect(msmeMetrics.sustainabilityProgram.environmentalImpactTracked).toBe(225); // 75+150
    });

    it('should handle no MSME customers', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('c1', 'individual', 'bronze', 5, 25, 1000),
        createMockCustomerProfile('c2', 'enterprise', 'gold', 30, 150, 5000)
      ];

      const msmeMetrics = await (loyaltyAnalyticsService as any).calculateMSMEProgramMetrics(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(msmeMetrics.totalMSMECustomers).toBe(0);
      expect(msmeMetrics.activeMSMECustomers).toBe(0);
      expect(msmeMetrics.msmePoolingRate).toBe(0);
      expect(msmeMetrics.averageMSMELifetimeValue).toBe(0);
    });
  });

  describe('Retention Metrics', () => {
    it('should correctly calculate retention metrics', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago

      const mockProfiles: CustomerLoyaltyProfile[] = [
        { ...createMockCustomerProfile('c1', 'individual', 'bronze', 5, 25, 1000), updatedAt: recentDate },
        { ...createMockCustomerProfile('c2', 'msme', 'silver', 15, 75, 3000), updatedAt: recentDate },
        { ...createMockCustomerProfile('c3', 'individual', 'gold', 30, 150, 5000), updatedAt: oldDate },
        { ...createMockCustomerProfile('c4', 'enterprise', 'platinum', 60, 300, 10000), updatedAt: recentDate }
      ];

      const retentionMetrics = await (loyaltyAnalyticsService as any).calculateRetentionMetrics(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(retentionMetrics.overallRetentionRate).toBe(75); // 3 out of 4 active
      expect(retentionMetrics.churnRate).toBe(25); // 100 - 75
      expect(retentionMetrics.retentionByTier).toBeDefined();
      expect(retentionMetrics.churnByTier).toBeDefined();
      expect(retentionMetrics.averageCustomerLifespan).toBeGreaterThan(0);
      expect(retentionMetrics.reactivationRate).toBe(15); // Assumed value
    });
  });

  describe('Pooling Adoption Metrics', () => {
    it('should correctly calculate pooling adoption metrics', async () => {
      const mockProfiles: CustomerLoyaltyProfile[] = [
        createMockCustomerProfile('c1', 'individual', 'bronze', 10, 50, 1000), // 50% pooling
        createMockCustomerProfile('c2', 'msme', 'silver', 20, 80, 3000), // 80% pooling
        createMockCustomerProfile('c3', 'enterprise', 'gold', 30, 120, 5000) // 120% pooling (capped at 100)
      ];

      // Adjust pooling frequencies to realistic values
      mockProfiles[0]!.poolingHistory.poolingFrequency = 50;
      mockProfiles[1]!.poolingHistory.poolingFrequency = 80;
      mockProfiles[2]!.poolingHistory.poolingFrequency = 75;

      const poolingMetrics = await (loyaltyAnalyticsService as any).calculatePoolingAdoptionMetrics(
        mockProfiles,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(poolingMetrics.overallPoolingRate).toBeCloseTo(83.33, 1); // (10+20+30)/(12+25+40)
      expect(poolingMetrics.averagePoolingFrequency).toBeCloseTo(68.33, 1); // (50+80+75)/3
      expect(poolingMetrics.poolingConversionRate).toBe(100); // All customers have pooled deliveries
      expect(poolingMetrics.poolingGrowthRate).toBe(15); // Assumed value

      // Check tier-based pooling rates
      expect(poolingMetrics.poolingRateByTier.bronze).toBeCloseTo(83.33, 1); // 10/12
      expect(poolingMetrics.poolingRateByTier.silver).toBe(80); // 20/25
      expect(poolingMetrics.poolingRateByTier.gold).toBe(75); // 30/40

      // Check customer type pooling rates
      expect(poolingMetrics.poolingRateByCustomerType.individual).toBeCloseTo(83.33, 1);
      expect(poolingMetrics.poolingRateByCustomerType.msme).toBe(80);
      expect(poolingMetrics.poolingRateByCustomerType.enterprise).toBe(75);
    });
  });

  describe('Customer Pooling Metrics', () => {
    it('should correctly calculate customer pooling metrics', async () => {
      const deliveries: DeliveryDetails[] = [
        createMockDelivery('d1', 'c1', true, new Date('2024-01-01')),
        createMockDelivery('d2', 'c1', false, new Date('2024-01-02')),
        createMockDelivery('d3', 'c1', true, new Date('2024-01-03')),
        createMockDelivery('d4', 'c1', true, new Date('2024-01-04')),
        createMockDelivery('d5', 'c1', false, new Date('2024-01-05'))
      ];

      const poolingMetrics = (loyaltyAnalyticsService as any).calculateCustomerPoolingMetrics(deliveries);

      expect(poolingMetrics.totalDeliveries).toBe(5);
      expect(poolingMetrics.pooledDeliveries).toBe(3);
      expect(poolingMetrics.poolingFrequency).toBe(60); // 3/5 * 100
      expect(poolingMetrics.firstPooledDelivery).toEqual(new Date('2024-01-01'));
      expect(poolingMetrics.longestPoolingStreak).toBe(2); // d3, d4
      expect(poolingMetrics.currentPoolingStreak).toBe(0); // Last delivery was not pooled
      expect(poolingMetrics.poolingTrend).toHaveLength(12); // 12 months of trend data
    });

    it('should handle no pooled deliveries', async () => {
      const deliveries: DeliveryDetails[] = [
        createMockDelivery('d1', 'c1', false, new Date('2024-01-01')),
        createMockDelivery('d2', 'c1', false, new Date('2024-01-02'))
      ];

      const poolingMetrics = (loyaltyAnalyticsService as any).calculateCustomerPoolingMetrics(deliveries);

      expect(poolingMetrics.totalDeliveries).toBe(2);
      expect(poolingMetrics.pooledDeliveries).toBe(0);
      expect(poolingMetrics.poolingFrequency).toBe(0);
      expect(poolingMetrics.firstPooledDelivery).toBeUndefined();
      expect(poolingMetrics.longestPoolingStreak).toBe(0);
      expect(poolingMetrics.currentPoolingStreak).toBe(0);
    });
  });

  describe('Customer Environmental Impact', () => {
    it('should correctly calculate customer environmental impact', async () => {
      const mockProfile = createMockCustomerProfile('c1', 'individual', 'gold', 25, 150, 3000);
      const deliveries: DeliveryDetails[] = [
        createMockDelivery('d1', 'c1', true, new Date('2024-01-01')),
        createMockDelivery('d2', 'c1', true, new Date('2024-01-15'))
      ];

      const environmentalImpact = (loyaltyAnalyticsService as any).calculateCustomerEnvironmentalImpact(
        deliveries,
        mockProfile
      );

      expect(environmentalImpact.totalCO2SavedKg).toBe(150);
      expect(environmentalImpact.totalFuelSavedLiters).toBeCloseTo(150 / ENVIRONMENTAL_CONSTANTS.co2PerLiterFuel);
      expect(environmentalImpact.totalCostSavingsINR).toBe(3000);
      expect(environmentalImpact.treesEquivalent).toBe(Math.floor(150 / ENVIRONMENTAL_CONSTANTS.co2ToTreesRatio));
      expect(environmentalImpact.impactTrend).toHaveLength(12);
      expect(environmentalImpact.milestones.length).toBeGreaterThan(0);
      expect(environmentalImpact.sustainabilityScore).toBeGreaterThanOrEqual(0);
      expect(environmentalImpact.sustainabilityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Insights and Recommendations', () => {
    it('should generate meaningful insights', async () => {
      const mockSummary = {
        tierDistribution: {
          bronze: { count: 50, percentage: 50, averagePoolingFrequency: 30 },
          silver: { count: 30, percentage: 30, averagePoolingFrequency: 60 },
          gold: { count: 15, percentage: 15, averagePoolingFrequency: 80 },
          platinum: { count: 5, percentage: 5, averagePoolingFrequency: 90 }
        }
      } as any;

      const mockCustomerAnalytics = [
        { customerId: 'c1', environmentalImpact: { totalCO2SavedKg: 200 } },
        { customerId: 'c2', environmentalImpact: { totalCO2SavedKg: 150 } }
      ] as any;

      const insights = (loyaltyAnalyticsService as any).generateLoyaltyInsights(
        mockSummary,
        mockCustomerAnalytics
      );

      expect(insights.topPerformingTiers).toBeDefined();
      expect(insights.fastestGrowingSegments).toBeDefined();
      expect(insights.highestRetentionFactors).toBeDefined();
      expect(insights.poolingDrivers).toBeDefined();
      expect(insights.environmentalLeaders).toBeDefined();
      expect(insights.msmeSuccessStories).toBeDefined();
      expect(insights.churnRiskFactors).toBeDefined();

      expect(insights.topPerformingTiers).toContain('platinum');
      expect(insights.environmentalLeaders.length).toBeGreaterThan(0);
    });

    it('should generate actionable recommendations', async () => {
      const mockSummary = {} as any;
      const mockCustomerAnalytics = [] as any;

      const recommendations = (loyaltyAnalyticsService as any).generateLoyaltyRecommendations(
        mockSummary,
        mockCustomerAnalytics
      );

      expect(recommendations.tierOptimizations).toBeDefined();
      expect(recommendations.retentionStrategies).toBeDefined();
      expect(recommendations.poolingIncentives).toBeDefined();
      expect(recommendations.environmentalInitiatives).toBeDefined();
      expect(recommendations.msmeProgram).toBeDefined();
      expect(recommendations.engagementImprovements).toBeDefined();

      expect(recommendations.tierOptimizations.length).toBeGreaterThan(0);
      expect(recommendations.retentionStrategies.length).toBeGreaterThan(0);
      expect(recommendations.poolingIncentives.length).toBeGreaterThan(0);
    });
  });

  describe('Benchmarks', () => {
    it('should generate performance benchmarks', async () => {
      const mockSummary = {
        retentionMetrics: { overallRetentionRate: 80 },
        poolingAdoption: { overallPoolingRate: 50 },
        programPerformance: { programROI: 200 },
        tierDistribution: { platinum: { percentage: 5 } }
      } as any;

      const benchmarks = (loyaltyAnalyticsService as any).generateLoyaltyBenchmarks(mockSummary);

      expect(benchmarks.industryAverages).toBeDefined();
      expect(benchmarks.performanceRating).toBeDefined();
      expect(benchmarks.competitivePosition).toBeDefined();
      expect(benchmarks.improvementAreas).toBeDefined();

      expect(['excellent', 'good', 'average', 'below_average', 'poor'])
        .toContain(benchmarks.performanceRating);
      expect(benchmarks.industryAverages.retentionRate).toBe(75);
      expect(benchmarks.industryAverages.poolingAdoption).toBe(45);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockLoyaltyService.getCustomerProfile.mockRejectedValue(new Error('Database error'));

      await expect(loyaltyAnalyticsService.generateCustomerAnalytics('customer1'))
        .rejects.toThrow('Database error');
    });

    it('should handle missing customer profiles in report generation', async () => {
      const mockProfiles = [createMockCustomerProfile('c1', 'individual', 'bronze', 5, 25, 1000)];
      
      jest.spyOn(loyaltyAnalyticsService as any, 'getAllCustomerProfiles')
        .mockResolvedValue(mockProfiles);

      mockLoyaltyService.getCustomerProfile.mockRejectedValue(new Error('Customer not found'));

      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        type: 'monthly' as const
      };

      const report = await loyaltyAnalyticsService.generateLoyaltyAnalyticsReport(
        'Test Report',
        period
      );

      // Should still generate report with empty customer analytics
      expect(report).toBeDefined();
      expect(report.customerAnalytics).toHaveLength(0);
    });
  });
});

// Helper functions for creating mock data
function createMockCustomerProfile(
  customerId: string,
  customerType: CustomerType,
  loyaltyTier: LoyaltyTier,
  pooledDeliveries: number,
  co2Saved: number,
  costSaved: number
): CustomerLoyaltyProfile {
  const totalDeliveries = Math.max(pooledDeliveries, Math.floor(pooledDeliveries / 0.6)); // Assume 60% pooling rate
  
  return {
    customerId,
    customerType,
    loyaltyTier,
    poolingHistory: {
      totalPooledDeliveries: pooledDeliveries,
      poolingFrequency: totalDeliveries > 0 ? (pooledDeliveries / totalDeliveries) * 100 : 0,
      co2SavedKg: co2Saved,
      costSavedINR: costSaved,
      lastSixMonthsPooling: pooledDeliveries,
      totalDeliveries,
      lastPooledDelivery: new Date()
    },
    incentives: {
      currentDiscountPercentage: 10,
      bonusCredits: 100,
      tierExpiryDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
      nextTierRequirement: 'Complete more deliveries',
      totalSavingsINR: costSaved
    },
    msmeIncentives: customerType === 'msme' ? {
      bulkBookingDiscount: 8,
      priorityScheduling: true,
      dedicatedAccountManager: false,
      customReporting: true,
      sustainabilityIncentives: {
        carbonNeutralCertificate: true,
        greenLogisticsPartnerBadge: true,
        sustainabilityReporting: true
      }
    } : undefined,
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    updatedAt: new Date()
  };
}

function createMockDelivery(
  deliveryId: string,
  customerId: string,
  wasPooled: boolean,
  deliveryDate: Date
): DeliveryDetails {
  return {
    deliveryId,
    customerId,
    serviceType: wasPooled ? 'shared' : 'dedicated_premium',
    weight: 10,
    volume: 0.5,
    distanceKm: 15,
    wasPooled,
    co2Saved: wasPooled ? 2.5 : 0,
    costSaved: wasPooled ? 50 : 0,
    deliveryDate
  };
}