import { Request, Response, NextFunction } from 'express';
import { RateLimitMiddleware, rateLimitConfigs } from '../rateLimitMiddleware';
import { RedisService } from '../../../cache/RedisService';
import { SecurityService } from '../../../services/SecurityService';

// Mock dependencies
jest.mock('../../../cache/RedisService');
jest.mock('../../../services/SecurityService');

describe('RateLimitMiddleware', () => {
  let rateLimitMiddleware: RateLimitMiddleware;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRedisService = new RedisService({} as any) as jest.Mocked<RedisService>;
    mockSecurityService = new SecurityService({} as any) as jest.Mocked<SecurityService>;
    
    // Mock Redis pipeline
    const mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    };
    mockRedisService.pipeline = jest.fn().mockReturnValue(mockPipeline);

    rateLimitMiddleware = new RateLimitMiddleware(
      mockRedisService,
      mockSecurityService,
      rateLimitConfigs.general
    );

    mockRequest = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET',
      get: jest.fn(),
      user: { id: 'user-123' }
    } as any;

    mockResponse = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting Logic', () => {
    test('should allow request when under rate limit', async () => {
      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], // zremrangebyscore
        [null, 1], // zadd
        [null, 5], // zcard - 5 requests in window
        [null, 1]  // expire
      ]);

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '995',
        'X-RateLimit-Reset': expect.any(String)
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should block request when rate limit exceeded', async () => {
      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], // zremrangebyscore
        [null, 1], // zadd
        [null, 1001], // zcard - 1001 requests in window (exceeds limit of 1000)
        [null, 1]  // expire
      ]);

      mockSecurityService.logSecurityEvent = jest.fn().mockResolvedValueOnce(undefined);

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: expect.any(Number)
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'suspicious_activity',
        severity: 'medium',
        ipAddress: '192.168.1.1',
        timestamp: expect.any(Date),
        details: {
          reason: 'rate_limit_exceeded',
          endpoint: '/api/test',
          method: 'GET',
          userAgent: undefined,
          totalHits: 1001
        }
      });
    });

    test('should handle Redis errors gracefully', async () => {
      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockRejectedValueOnce(new Error('Redis connection error'));

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should continue with request when Redis fails
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Key Generation', () => {
    test('should generate key with IP and user ID', async () => {
      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], [null, 1], [null, 5], [null, 1]
      ]);

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'rate_limit:192.168.1.1:user-123:/api/test',
        0,
        expect.any(Number)
      );
    });

    test('should handle anonymous users', async () => {
      (mockRequest as any).user = undefined;
      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], [null, 1], [null, 5], [null, 1]
      ]);

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'rate_limit:192.168.1.1:anonymous:/api/test',
        0,
        expect.any(Number)
      );
    });

    test('should use custom key generator when provided', async () => {
      const customConfig = {
        ...rateLimitConfigs.general,
        keyGenerator: (req: Request) => `custom:${req.ip}`
      };

      const customRateLimiter = new RateLimitMiddleware(
        mockRedisService,
        mockSecurityService,
        customConfig
      );

      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], [null, 1], [null, 5], [null, 1]
      ]);

      const middleware = customRateLimiter.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'custom:192.168.1.1',
        0,
        expect.any(Number)
      );
    });
  });

  describe('IP Address Detection', () => {
    test('should extract IP from X-Forwarded-For header', async () => {
      (mockRequest as any).get = jest.fn((header: string) => {
        return header === 'X-Forwarded-For' ? '203.0.113.1, 192.168.1.1' : undefined;
      });
      (mockRequest as any).ip = undefined;

      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], [null, 1], [null, 5], [null, 1]
      ]);

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.1'),
        0,
        expect.any(Number)
      );
    });

    test('should fallback to connection remote address', async () => {
      (mockRequest as any).get = jest.fn().mockReturnValue(undefined);
      (mockRequest as any).ip = undefined;
      (mockRequest as any).connection = { remoteAddress: '203.0.113.4' };

      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], [null, 1], [null, 5], [null, 1]
      ]);

      const middleware = rateLimitMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        expect.stringContaining('203.0.113.4'),
        0,
        expect.any(Number)
      );
    });
  });

  describe('Rate Limit Configurations', () => {
    test('should have correct configuration for auth endpoints', () => {
      const authConfig = rateLimitConfigs.auth;
      expect(authConfig.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(authConfig.maxRequests).toBe(10);
      expect(authConfig.skipSuccessfulRequests).toBe(true);
    });

    test('should have correct configuration for route optimization', () => {
      const routeConfig = rateLimitConfigs.routeOptimization;
      expect(routeConfig.windowMs).toBe(60 * 1000); // 1 minute
      expect(routeConfig.maxRequests).toBe(10);
      expect(routeConfig.skipSuccessfulRequests).toBe(false);
    });

    test('should have correct configuration for internal services', () => {
      const internalConfig = rateLimitConfigs.internal;
      expect(internalConfig.windowMs).toBe(60 * 1000); // 1 minute
      expect(internalConfig.maxRequests).toBe(10000);
      expect(internalConfig.keyGenerator).toBeDefined();
    });
  });

  describe('Custom Rate Limit Handlers', () => {
    test('should call custom onLimitReached handler', async () => {
      const customHandler = jest.fn();
      const customConfig = {
        ...rateLimitConfigs.general,
        onLimitReached: customHandler
      };

      const customRateLimiter = new RateLimitMiddleware(
        mockRedisService,
        mockSecurityService,
        customConfig
      );

      const mockPipeline = mockRedisService.pipeline();
      (mockPipeline.exec as jest.Mock).mockResolvedValueOnce([
        [null, 0], [null, 1], [null, 1001], [null, 1]
      ]);

      const middleware = customRateLimiter.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(customHandler).toHaveBeenCalledWith(mockRequest, mockResponse);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});