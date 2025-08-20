/**
 * Simple test for hub-and-spoke routing functionality
 */

import { RoutingService } from '../RoutingService';

describe('RoutingService - Hub and Spoke Routing (Simple)', () => {
  let routingService: RoutingService;

  beforeEach(() => {
    routingService = new RoutingService();
  });

  describe('optimizeHubAndSpokeRoutes', () => {
    it('should have the optimizeHubAndSpokeRoutes method', () => {
      expect(typeof routingService.optimizeHubAndSpokeRoutes).toBe('function');
    });

    it('should handle empty hub list gracefully', async () => {
      const mockRequest = {
        vehicles: [],
        deliveries: [],
        hubs: [],
        constraints: {
          vehicleCapacityConstraints: true,
          timeWindowConstraints: true,
          hubSequencing: true
        },
        timeWindow: {
          earliest: new Date('2024-01-15T08:00:00Z'),
          latest: new Date('2024-01-15T20:00:00Z')
        }
      };

      const result = await routingService.optimizeHubAndSpokeRoutes(mockRequest);

      // Should fallback to regular routing when no hubs are provided
      expect(result.success).toBe(true);
      expect(result.algorithmUsed).not.toBe('HUB_AND_SPOKE_ROUTING');
    });
  });
});