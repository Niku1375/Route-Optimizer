import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../cache/RedisService';
import Logger from '../../utils/logger';
import { SecurityService } from '../../services/SecurityService';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsPerWindow: number;
  resetTime: Date;
  remaining: number;
}

export class RateLimitMiddleware {
  private redisService: RedisService;
  private securityService: SecurityService;
  private config: RateLimitConfig;

  constructor(
    redisService: RedisService,
    securityService: SecurityService,
    config: RateLimitConfig
  ) {
    this.redisService = redisService;
    this.securityService = securityService;
    this.config = config;
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.generateKey(req);
        const rateLimitInfo = await this.checkRateLimit(key);

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
          'X-RateLimit-Reset': rateLimitInfo.resetTime.toISOString()
        });

        if (rateLimitInfo.totalHitsPerWindow >= this.config.maxRequests) {
          // Log rate limit violation
          await this.securityService.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'medium',
            ipAddress: this.getClientIP(req),
            timestamp: new Date(),
            details: {
              reason: 'rate_limit_exceeded',
              endpoint: req.path,
              method: req.method,
              userAgent: req.get('User-Agent'),
              totalHits: rateLimitInfo.totalHitsPerWindow
            }
          });

          if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res);
          } else {
            res.status(429).json({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter: Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000)
            });
          }
          return;
        }

        next();
      } catch (error) {
        Logger.error('Rate limiting error:', error);
        // Don't block request on rate limiting errors
        next();
      }
    };
  }

  private async checkRateLimit(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const resetTime = new Date(now + this.config.windowMs);

    // Use Redis sorted set to track requests in time window
    const pipeline = this.redisService.pipeline();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Count requests in current window
    pipeline.zcard(key);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));
    
    const results = await pipeline.exec();
    const totalHitsPerWindow = results?.[2]?.[1] as number || 0;
    
    return {
      totalHits: totalHitsPerWindow,
      totalHitsPerWindow,
      resetTime,
      remaining: Math.max(0, this.config.maxRequests - totalHitsPerWindow)
    };
  }

  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    
    const ip = this.getClientIP(req);
    const userId = (req as any).user?.id || 'anonymous';
    return `rate_limit:${ip}:${userId}:${req.path}`;
  }

  private getClientIP(req: Request): string {
    // Check various headers for the real IP
    const xForwardedFor = req.get('X-Forwarded-For');
    const xRealIP = req.get('X-Real-IP');
    const xClientIP = req.get('X-Client-IP');
    
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return xForwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    
    if (xRealIP) {
      return xRealIP;
    }
    
    if (xClientIP) {
      return xClientIP;
    }
    
    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // General API rate limit
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
    skipSuccessfulRequests: false
  },

  // Authentication endpoints (more restrictive)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    skipSuccessfulRequests: true
  },

  // Vehicle search (moderate restriction)
  vehicleSearch: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    skipSuccessfulRequests: false
  },

  // Route optimization (more restrictive due to computational cost)
  routeOptimization: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    skipSuccessfulRequests: false
  },

  // Internal services (less restrictive)
  internal: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10000,
    skipSuccessfulRequests: false,
    keyGenerator: (req: Request) => `internal:${req.ip}`
  }
};

// Factory function to create rate limit middleware
export function createRateLimitMiddleware(
  redisService: RedisService,
  securityService: SecurityService,
  configName: keyof typeof rateLimitConfigs
) {
  const config = rateLimitConfigs[configName];
  const rateLimiter = new RateLimitMiddleware(redisService, securityService, config);
  return rateLimiter.middleware();
}