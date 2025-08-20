import { RedisClient } from './RedisClient';
import Logger from '../utils/logger';

export interface RedisPipeline {
  zremrangebyscore(key: string, min: number, max: number): RedisPipeline;
  zadd(key: string, score: number, member: string): RedisPipeline;
  zcard(key: string): RedisPipeline;
  expire(key: string, seconds: number): RedisPipeline;
  exec(): Promise<Array<[Error | null, any]>>;
}

export class RedisService {
  async connect(): Promise<void> {
    // Connection logic
  }

  async disconnect(): Promise<void> {
    // Disconnection logic
  }

  async flushAll(): Promise<void> {
    // Flush all data
  }
  private redisClient: RedisClient;

  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
  }

  public pipeline(): RedisPipeline {
    const client = this.redisClient.getClient();
    const multi = client.multi();
    
    const pipeline: RedisPipeline = {
      zremrangebyscore: (key: string, min: number, max: number) => {
        multi.zRemRangeByScore(key, min, max);
        return pipeline;
      },
      zadd: (key: string, score: number, member: string) => {
        multi.zAdd(key, { score, value: member });
        return pipeline;
      },
      zcard: (key: string) => {
        multi.zCard(key);
        return pipeline;
      },
      expire: (key: string, seconds: number) => {
        multi.expire(key, seconds);
        return pipeline;
      },
      exec: async () => {
        try {
          const results = await multi.exec();
          return results.map(result => [null, result]);
        } catch (error) {
          Logger.error('Redis pipeline execution error:', error);
          throw error;
        }
      }
    };
    
    return pipeline;
  }

  public async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return this.redisClient.set(key, value, ttlSeconds);
  }

  public async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    return this.redisClient.exists(key);
  }

  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return this.redisClient.expire(key, ttlSeconds);
  }

  public async hSet(key: string, field: string, value: string): Promise<number> {
    return this.redisClient.hSet(key, field, value);
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    return this.redisClient.hGet(key, field);
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    return this.redisClient.hGetAll(key);
  }

  public async ping(): Promise<string> {
    return this.redisClient.ping();
  }

  public isHealthy(): boolean {
    return this.redisClient.isHealthy();
  }
}