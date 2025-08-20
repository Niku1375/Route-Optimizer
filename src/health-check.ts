#!/usr/bin/env node

/**
 * Health Check Script for Docker Container
 * 
 * Performs comprehensive health checks for the logistics routing system
 * Used by Docker healthcheck and Kubernetes readiness/liveness probes
 */

import http from 'http';
import { DatabaseService } from './database/DatabaseService';
import { RedisService } from './cache/RedisService';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    api: 'healthy' | 'unhealthy';
    database: 'healthy' | 'unhealthy';
    cache: 'healthy' | 'unhealthy';
  };
  details?: {
    api?: string;
    database?: string;
    cache?: string;
  };
}

class HealthChecker {
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
  }

  async checkAPI(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: process.env.PORT || 3000,
        path: '/api/health',
        method: 'GET',
        timeout: this.timeout
      }, (res) => {
        if (res.statusCode === 200) {
          resolve({ status: 'healthy' });
        } else {
          resolve({ 
            status: 'unhealthy', 
            details: `HTTP ${res.statusCode}` 
          });
        }
      });

      req.on('error', (error) => {
        resolve({ 
          status: 'unhealthy', 
          details: error.message 
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ 
          status: 'unhealthy', 
          details: 'Request timeout' 
        });
      });

      req.end();
    });
  }

  async checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    try {
      const dbService = new DatabaseService();
      await dbService.connect();
      
      // Simple query to test database connectivity
      const result = await (dbService.query as any)('SELECT 1 as health_check');
      await dbService.disconnect();
      
      if (result.rows && result.rows.length > 0) {
        return { status: 'healthy' };
      } else {
        return { 
          status: 'unhealthy', 
          details: 'Query returned no results' 
        };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: error instanceof Error ? error.message : 'Unknown database error' 
      };
    }
  }

  async checkCache(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    try {
      const redisService = new RedisService();
      await redisService.connect();
      
      // Test Redis connectivity with ping
      // eslint-disable-next-line prefer-template
      const testKey = `health_check_${Date.now()}`;
      await redisService.set(testKey, 'ok', 10);
      const result = await redisService.get(testKey);
      await redisService.del(testKey);
      await redisService.disconnect();
      
      if (result === 'ok') {
        return { status: 'healthy' };
      } else {
        return { 
          status: 'unhealthy', 
          details: 'Cache test failed' 
        };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        details: error instanceof Error ? error.message : 'Unknown cache error' 
      };
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // Run all health checks in parallel with timeout
      const [apiCheck, dbCheck, cacheCheck] = await Promise.allSettled([
        this.checkAPI(),
        this.checkDatabase(),
        this.checkCache()
      ]);

      const result: HealthCheckResult = {
        status: 'healthy',
        timestamp,
        services: {
          api: 'unhealthy',
          database: 'unhealthy',
          cache: 'unhealthy'
        },
        details: {}
      };

      // Process API check result
      if (apiCheck.status === 'fulfilled') {
        result.services.api = apiCheck.value.status;
        if (apiCheck.value.details) {
          result.details!.api = apiCheck.value.details;
        }
      } else {
        result.details!.api = 'Health check failed';
      }

      // Process database check result
      if (dbCheck.status === 'fulfilled') {
        result.services.database = dbCheck.value.status;
        if (dbCheck.value.details) {
          result.details!.database = dbCheck.value.details;
        }
      } else {
        result.details!.database = 'Health check failed';
      }

      // Process cache check result
      if (cacheCheck.status === 'fulfilled') {
        result.services.cache = cacheCheck.value.status;
        if (cacheCheck.value.details) {
          result.details!.cache = cacheCheck.value.details;
        }
      } else {
        result.details!.cache = 'Health check failed';
      }

      // Determine overall health status
      const allHealthy = result.services.api === 'healthy' && 
                        result.services.database === 'healthy' && 
                        result.services.cache === 'healthy';
      
      result.status = allHealthy ? 'healthy' : 'unhealthy';

      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp,
        services: {
          api: 'unhealthy',
          database: 'unhealthy',
          cache: 'unhealthy'
        },
        details: {
          api: 'Health check error',
          database: 'Health check error',
          cache: 'Health check error'
        }
      };
    }
  }
}

// Main execution
async function main() {
  const healthChecker = new HealthChecker(5000);
  
  try {
    const result = await healthChecker.performHealthCheck();
    
    // Output result for logging
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with appropriate code
    if (result.status === 'healthy') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in health check:', error);
    process.exit(1);
  });
}

export { HealthChecker };