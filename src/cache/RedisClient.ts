import { createClient, RedisClientType } from 'redis';
import { getRedisConfig } from './config';
import Logger from '../utils/logger';

export class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType;
  private isConnected: boolean = false;
  private config = getRedisConfig();

  private constructor() {
    const clientOptions: any = {
      socket: {
        host: this.config.host,
        port: this.config.port,
        connectTimeout: this.config.connectTimeout || 10000,
      },
      database: this.config.db,
    };

    if (this.config.password) {
      clientOptions.password = this.config.password;
    }

    this.client = createClient(clientOptions);

    this.setupEventHandlers();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private setupEventHandlers(): void {
    if (!this.client) {
      Logger.warn('Redis client not initialized, skipping event handlers setup');
      return;
    }
    
    this.client.on('connect', () => {
      Logger.info('Redis client connecting...');
    });

    this.client.on('ready', () => {
      Logger.info('Redis client connected and ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      Logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      Logger.info('Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      Logger.info('Redis client reconnecting...');
    });
  }

  public async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
        Logger.info('Redis connection established successfully');
      }
    } catch (error) {
      Logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        Logger.info('Redis connection closed');
      }
    } catch (error) {
      Logger.error('Error closing Redis connection:', error);
      throw error;
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.client.isReady;
  }

  private getKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  // String operations
  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const redisKey = this.getKey(key);
      if (ttlSeconds) {
        await this.client.setEx(redisKey, ttlSeconds, value);
      } else {
        await this.client.set(redisKey, value);
      }
    } catch (error) {
      Logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.get(redisKey);
    } catch (error) {
      Logger.error(`Redis GET error for key ${key}:`, error);
      throw error;
    }
  }

  public async del(key: string): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.del(redisKey);
    } catch (error) {
      Logger.error(`Redis DEL error for key ${key}:`, error);
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const redisKey = this.getKey(key);
      const result = await this.client.exists(redisKey);
      return result === 1;
    } catch (error) {
      Logger.error(`Redis EXISTS error for key ${key}:`, error);
      throw error;
    }
  }

  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const redisKey = this.getKey(key);
      const result = await this.client.expire(redisKey, ttlSeconds);
      return result;
    } catch (error) {
      Logger.error(`Redis EXPIRE error for key ${key}:`, error);
      throw error;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.ttl(redisKey);
    } catch (error) {
      Logger.error(`Redis TTL error for key ${key}:`, error);
      throw error;
    }
  }

  // Hash operations
  public async hSet(key: string, field: string, value: string): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.hSet(redisKey, field, value);
    } catch (error) {
      Logger.error(`Redis HSET error for key ${key}, field ${field}:`, error);
      throw error;
    }
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.hGet(redisKey, field);
    } catch (error) {
      Logger.error(`Redis HGET error for key ${key}, field ${field}:`, error);
      throw error;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.hGetAll(redisKey);
    } catch (error) {
      Logger.error(`Redis HGETALL error for key ${key}:`, error);
      throw error;
    }
  }

  public async hDel(key: string, field: string): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.hDel(redisKey, field);
    } catch (error) {
      Logger.error(`Redis HDEL error for key ${key}, field ${field}:`, error);
      throw error;
    }
  }

  // List operations
  public async lPush(key: string, ...values: string[]): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.lPush(redisKey, values);
    } catch (error) {
      Logger.error(`Redis LPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  public async rPush(key: string, ...values: string[]): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.rPush(redisKey, values);
    } catch (error) {
      Logger.error(`Redis RPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  public async lPop(key: string): Promise<string | null> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.lPop(redisKey);
    } catch (error) {
      Logger.error(`Redis LPOP error for key ${key}:`, error);
      throw error;
    }
  }

  public async lRange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.lRange(redisKey, start, stop);
    } catch (error) {
      Logger.error(`Redis LRANGE error for key ${key}:`, error);
      throw error;
    }
  }

  // Set operations
  public async sAdd(key: string, ...members: string[]): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.sAdd(redisKey, members);
    } catch (error) {
      Logger.error(`Redis SADD error for key ${key}:`, error);
      throw error;
    }
  }

  public async sMembers(key: string): Promise<string[]> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.sMembers(redisKey);
    } catch (error) {
      Logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      throw error;
    }
  }

  public async sRem(key: string, ...members: string[]): Promise<number> {
    try {
      const redisKey = this.getKey(key);
      return await this.client.sRem(redisKey, members);
    } catch (error) {
      Logger.error(`Redis SREM error for key ${key}:`, error);
      throw error;
    }
  }

  // Pattern-based operations
  public async keys(pattern: string): Promise<string[]> {
    try {
      const redisPattern = this.getKey(pattern);
      const keys = await this.client.keys(redisPattern);
      // Remove prefix from returned keys
      return keys.map(key => key.replace(this.config.keyPrefix || '', ''));
    } catch (error) {
      Logger.error(`Redis KEYS error for pattern ${pattern}:`, error);
      throw error;
    }
  }

  public async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;
      
      const redisKeys = keys.map(key => this.getKey(key));
      return await this.client.del(redisKeys);
    } catch (error) {
      Logger.error(`Redis flush pattern error for ${pattern}:`, error);
      throw error;
    }
  }

  // Utility methods
  public async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      Logger.error('Redis PING error:', error);
      throw error;
    }
  }

  public async flushDb(): Promise<string> {
    try {
      return await this.client.flushDb();
    } catch (error) {
      Logger.error('Redis FLUSHDB error:', error);
      throw error;
    }
  }

  // Database operations
  public async flushAll(): Promise<void> {
    try {
      await this.client.flushAll();
      Logger.info('Redis database flushed');
    } catch (error) {
      Logger.error('Redis FLUSHALL error:', error);
      throw error;
    }
  }
}

export const redisClient = RedisClient.getInstance();