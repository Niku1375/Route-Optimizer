/**
 * Simple test for LoyaltyAnalyticsService
 */

describe('LoyaltyAnalyticsService Simple Test', () => {
  it('should be able to import the service', async () => {
    const { LoyaltyAnalyticsService } = await import('../LoyaltyAnalyticsService');
    expect(LoyaltyAnalyticsService).toBeDefined();
  });
});