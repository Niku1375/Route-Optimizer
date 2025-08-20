import { RedisClient } from './RedisClient';

const redisClient = RedisClient.getInstance();
import Logger from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  fallbackValue?: any;
  skipCache?: boolean;
}

export interface CacheInvalidationStrategy {
  pattern?: string;
  keys?: string[];
  tags?: string[];
}

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly VEHICLE_SEARCH_TTL = 300; // 5 minutes
  private static readonly TRAFFIC_DATA_TTL = 600; // 10 minutes
  private static readonly ROUTE_OPTIMIZATION_TTL = 1800; // 30 minutes

  async connect(): Promise<void> {
    // Connection logic
    Logger.info('CacheService connected');
  }

  async disconnect(): Promise<void> {
    // Disconnection logic
    Logger.info('CacheService disconnected');
  }

  async flushAll(): Promise<void> {
    // Flush all cached data
    try {
      await redisClient.flushAll();
      Logger.info('Cache flushed successfully');
    } catch (error) {
      Logger.error('Failed to flush cache:', error);
    }
  }

  // Vehicle search caching
  public static async cacheVehicleSearchResults(
    searchCriteria: any,
    results: any,
    ttl: number = this.VEHICLE_SEARCH_TTL
  ): Promise<void> {
    try {
      const cacheKey = this.generateVehicleSearchKey(searchCriteria);
      const serializedResults = JSON.stringify(results);
      await redisClient.set(cacheKey, serializedResults, ttl);
      
      // Add to search index for invalidation
      await redisClient.sAdd('vehicle_search_keys', cacheKey);
      
      Logger.debug(`Cached vehicle search results for key: ${cacheKey}`);
    } catch (error) {
      Logger.error('Failed to cache vehicle search results:', error);
    }
  }

  public static async getCachedVehicleSearchResults(searchCriteria: any): Promise<any | null> {
    try {
      const cacheKey = this.generateVehicleSearchKey(searchCriteria);
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        Logger.debug(`Cache hit for vehicle search key: ${cacheKey}`);
        return JSON.parse(cachedData);
      }
      
      Logger.debug(`Cache miss for vehicle search key: ${cacheKey}`);
      return null;
    } catch (error) {
      Logger.error('Failed to get cached vehicle search results:', error);
      return null;
    }
  }

  public static async invalidateVehicleSearchCache(vehicleId?: string): Promise<void> {
    try {
      if (vehicleId) {
        // Invalidate specific vehicle-related searches
        await redisClient.flushPattern(`vehicle_search:*:vehicle_${vehicleId}:*`);
      } else {
        // Invalidate all vehicle search results
        const searchKeys = await redisClient.sMembers('vehicle_search_keys');
        if (searchKeys.length > 0) {
          
          await redisClient.del(searchKeys.join(' '));
          await redisClient.del('vehicle_search_keys');
        }
      }
      
      Logger.info(`Invalidated vehicle search cache${vehicleId ? ` for vehicle ${vehicleId}` : ''}`);
    } catch (error) {
      Logger.error('Failed to invalidate vehicle search cache:', error);
    }
  }

  // Traffic data caching
  public static async cacheTrafficData(
    areaId: string,
    trafficData: any,
    ttl: number = this.TRAFFIC_DATA_TTL
  ): Promise<void> {
    try {
      const cacheKey = `traffic_data:${areaId}`;
      const serializedData = JSON.stringify({
        ...trafficData,
        cachedAt: new Date().toISOString(),
      });
      
      await redisClient.set(cacheKey, serializedData, ttl);
      await redisClient.sAdd('traffic_data_keys', cacheKey);
      
      Logger.debug(`Cached traffic data for area: ${areaId}`);
    } catch (error) {
      Logger.error('Failed to cache traffic data:', error);
    }
  }

  public static async getCachedTrafficData(areaId: string): Promise<any | null> {
    try {
      const cacheKey = `traffic_data:${areaId}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        const data = JSON.parse(cachedData);
        Logger.debug(`Cache hit for traffic data area: ${areaId}`);
        return data;
      }
      
      Logger.debug(`Cache miss for traffic data area: ${areaId}`);
      return null;
    } catch (error) {
      Logger.error('Failed to get cached traffic data:', error);
      return null;
    }
  }

  public static async invalidateTrafficDataCache(areaId?: string): Promise<void> {
    try {
      if (areaId) {
        await redisClient.del(`traffic_data:${areaId}`);
        await redisClient.sRem('traffic_data_keys', `traffic_data:${areaId}`);
      } else {
        const trafficKeys = await redisClient.sMembers('traffic_data_keys');
        if (trafficKeys.length > 0) {
          await redisClient.del(trafficKeys.join(' '));
          await redisClient.del('traffic_data_keys');
        }
      }
      
      Logger.info(`Invalidated traffic data cache${areaId ? ` for area ${areaId}` : ''}`);
    } catch (error) {
      Logger.error('Failed to invalidate traffic data cache:', error);
    }
  }

  // Route optimization caching
  public static async cacheRouteOptimization(
    requestHash: string,
    optimizationResult: any,
    ttl: number = this.ROUTE_OPTIMIZATION_TTL
  ): Promise<void> {
    try {
      const cacheKey = `route_optimization:${requestHash}`;
      const serializedResult = JSON.stringify({
        ...optimizationResult,
        cachedAt: new Date().toISOString(),
      });
      
      await redisClient.set(cacheKey, serializedResult, ttl);
      await redisClient.sAdd('route_optimization_keys', cacheKey);
      
      Logger.debug(`Cached route optimization result for hash: ${requestHash}`);
    } catch (error) {
      Logger.error('Failed to cache route optimization result:', error);
    }
  }

  public static async getCachedRouteOptimization(requestHash: string): Promise<any | null> {
    try {
      const cacheKey = `route_optimization:${requestHash}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        const data = JSON.parse(cachedData);
        Logger.debug(`Cache hit for route optimization hash: ${requestHash}`);
        return data;
      }
      
      Logger.debug(`Cache miss for route optimization hash: ${requestHash}`);
      return null;
    } catch (error) {
      Logger.error('Failed to get cached route optimization result:', error);
      return null;
    }
  }

  public static async invalidateRouteOptimizationCache(vehicleIds?: string[]): Promise<void> {
    try {
      if (vehicleIds && vehicleIds.length > 0) {
        // Invalidate optimizations involving specific vehicles
        for (const vehicleId of vehicleIds) {
          await redisClient.flushPattern(`route_optimization:*:vehicle_${vehicleId}:*`);
        }
      } else {
        // Invalidate all route optimizations
        const optimizationKeys = await redisClient.sMembers('route_optimization_keys');
        if (optimizationKeys.length > 0) {
          await redisClient.del(optimizationKeys.join(' '));
          await redisClient.del('route_optimization_keys');
        }
      }
      
      Logger.info(`Invalidated route optimization cache${vehicleIds ? ` for vehicles ${vehicleIds.join(', ')}` : ''}`);
    } catch (error) {
      Logger.error('Failed to invalidate route optimization cache:', error);
    }
  }

  // Generic caching methods
  public static async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      if (options.skipCache) return;
      
      const ttl = options.ttl || this.DEFAULT_TTL;
      const serializedValue = JSON.stringify(value);
      await redisClient.set(key, serializedValue, ttl);
      
      Logger.debug(`Cached data for key: ${key}`);
    } catch (error) {
      Logger.error(`Failed to cache data for key ${key}:`, error);
    }
  }

  public static async get<T>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    try {
      if (options.skipCache) return options.fallbackValue || null;
      
      const cachedData = await redisClient.get(key);
      
      if (cachedData) {
        Logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(cachedData);
      }
      
      Logger.debug(`Cache miss for key: ${key}`);
      return options.fallbackValue || null;
    } catch (error) {
      Logger.error(`Failed to get cached data for key ${key}:`, error);
      return options.fallbackValue || null;
    }
  }

  public static async invalidate(strategy: CacheInvalidationStrategy): Promise<void> {
    try {
      if (strategy.keys) {
        for (const key of strategy.keys) {
          await redisClient.del(key);
        }
      }
      
      if (strategy.pattern) {
        await redisClient.flushPattern(strategy.pattern);
      }
      
      if (strategy.tags) {
        for (const tag of strategy.tags) {
          const taggedKeys = await redisClient.sMembers(`tag:${tag}`);
          if (taggedKeys.length > 0) {
            await redisClient.del(taggedKeys.join(' '));
            await redisClient.del(`tag:${tag}`);
          }
        }
      }
      
      Logger.info('Cache invalidation completed');
    } catch (error) {
      Logger.error('Failed to invalidate cache:', error);
    }
  }

  // Utility methods
  public static async isHealthy(): Promise<boolean> {
    try {
      const response = await redisClient.ping();
      return response === 'PONG';
    } catch (error) {
      Logger.error('Redis health check failed:', error);
      return false;
    }
  }

  public static async getCacheStats(): Promise<any> {
    try {
      const vehicleSearchKeys = await redisClient.sMembers('vehicle_search_keys');
      const trafficDataKeys = await redisClient.sMembers('traffic_data_keys');
      const routeOptimizationKeys = await redisClient.sMembers('route_optimization_keys');
      
      return {
        vehicleSearchCacheSize: vehicleSearchKeys.length,
        trafficDataCacheSize: trafficDataKeys.length,
        routeOptimizationCacheSize: routeOptimizationKeys.length,
        isHealthy: await this.isHealthy(),
      };
    } catch (error) {
      Logger.error('Failed to get cache stats:', error);
      return {
        vehicleSearchCacheSize: 0,
        trafficDataCacheSize: 0,
        routeOptimizationCacheSize: 0,
        isHealthy: false,
      };
    }
  }

  // Private helper methods
  private static generateVehicleSearchKey(searchCriteria: any): string {
    const {
      pickupLocation,
      deliveryLocation,
      timeWindow,
      capacity,
      serviceType,
      vehicleTypePreference,
    } = searchCriteria;
    
    const keyParts = [
      'vehicle_search',
      `pickup_${pickupLocation?.latitude}_${pickupLocation?.longitude}`,
      `delivery_${deliveryLocation?.latitude}_${deliveryLocation?.longitude}`,
      `time_${timeWindow?.start}_${timeWindow?.end}`,
      `capacity_${capacity?.weight}_${capacity?.volume}`,
      `service_${serviceType}`,
      `types_${vehicleTypePreference?.join('_') || 'any'}`,
    ];
    
    return keyParts.join(':');
  }

  public static generateRequestHash(request: any): string {
    const requestString = JSON.stringify(request, Object.keys(request).sort());
    const hash = Buffer.from(requestString).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    // Pad with zeros if needed to ensure 32 characters
    return (hash + '0'.repeat(32)).substring(0, 32);
  }
}