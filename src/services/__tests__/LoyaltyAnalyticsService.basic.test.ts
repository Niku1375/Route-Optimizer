/**
 * Basic test for LoyaltyAnalyticsService
 */

import { LoyaltyAnalyticsService } from '../LoyaltyAnalyticsService';
import { CustomerLoyaltyService } from '../CustomerLoyaltyService';

describe('LoyaltyAnalyticsService Basic Test', () => {
  let loyaltyAnalyticsService: LoyaltyAnalyticsService;
  let mockLoyaltyService: jest.Mocked<CustomerLoyaltyService>;

  beforeEach(() => {
    mockLoyaltyService = {
      getCustomerProfile: jest.fn(),
      createOrUpdateProfile: jest.fn(),
    } as any;

    loyaltyAnalyticsService = new LoyaltyAnalyticsService(mockLoyaltyService);
  });

  it('should be defined', () => {
    expect(loyaltyAnalyticsService).toBeDefined();
  });

  it('should generate loyalty program metrics', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const metrics = await loyaltyAnalyticsService.generateLoyaltyProgramMetrics(
      'monthly',
      startDate,
      endDate
    );

    expect(metrics).toBeDefined();
    expect(metrics.period).toBe('monthly');
    expect(metrics.totalCustomers).toBeGreaterThan(0);
    expect(metrics.tierDistribution).toBeDefined();
    expect(metrics.programPerformance).toBeDefined();
    expect(metrics.retentionMetrics).toBeDefined();
    expect(metrics.poolingAdoption).toBeDefined();
    expect(metrics.environmentalImpact).toBeDefined();
    expect(metrics.msmeProgram).toBeDefined();
  });
});