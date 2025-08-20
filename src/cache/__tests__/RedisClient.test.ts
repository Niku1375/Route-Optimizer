// Mock redis module
jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));


import { RedisClient } from '../RedisClient';
import { createClient } from 'redis';

describe('RedisClient', () => {
  let redisClient: RedisClient;
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      isReady: true,
      set: jest.fn(),
      setEx: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hSet: jest.fn(),
      hGet: jest.fn(),
      hGetAll: jest.fn(),
      hDel: jest.fn(),
      lPush: jest.fn(),
      rPush: jest.fn(),
      lPop: jest.fn(),
      lRange: jest.fn(),
      sAdd: jest.fn(),
      sMembers: jest.fn(),
      sRem: jest.fn(),
      keys: jest.fn(),
      ping: jest.fn(),
      flushDb: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockRedisClient);
    
    // Clear any existing instance
    (RedisClient as any).instance = undefined;
    
    redisClient = RedisClient.getInstance();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RedisClient.getInstance();
      const instance2 = RedisClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      mockRedisClient.connect.mockResolvedValue(undefined);

      await redisClient.connect();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(redisClient.connect()).rejects.toThrow('Connection failed');
    });

    it('should not connect if already connected', async () => {
      // Simulate already connected state
      (redisClient as any).isConnected = true;
      mockRedisClient.connect.mockResolvedValue(undefined);

      await redisClient.connect();

      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis successfully', async () => {
      (redisClient as any).isConnected = true;
      mockRedisClient.disconnect.mockResolvedValue(undefined);

      await redisClient.disconnect();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnection errors', async () => {
      (redisClient as any).isConnected = true;
      const error = new Error('Disconnection failed');
      mockRedisClient.disconnect.mockRejectedValue(error);

      await expect(redisClient.disconnect()).rejects.toThrow('Disconnection failed');
    });
  });

  describe('string operations', () => {
    describe('set', () => {
      it('should set value without TTL', async () => {
        mockRedisClient.set.mockResolvedValue('OK');

        await redisClient.set('test-key', 'test-value');

        expect(mockRedisClient.set).toHaveBeenCalledWith('logistics:test-key', 'test-value');
      });

      it('should set value with TTL', async () => {
        mockRedisClient.setEx.mockResolvedValue('OK');

        await redisClient.set('test-key', 'test-value', 300);

        expect(mockRedisClient.setEx).toHaveBeenCalledWith('logistics:test-key', 300, 'test-value');
      });

      it('should handle set errors', async () => {
        const error = new Error('Set failed');
        mockRedisClient.set.mockRejectedValue(error);

        await expect(redisClient.set('test-key', 'test-value')).rejects.toThrow('Set failed');
      });
    });

    describe('get', () => {
      it('should get value successfully', async () => {
        mockRedisClient.get.mockResolvedValue('test-value');

        const result = await redisClient.get('test-key');

        expect(mockRedisClient.get).toHaveBeenCalledWith('logistics:test-key');
        expect(result).toBe('test-value');
      });

      it('should return null for non-existent key', async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await redisClient.get('non-existent');

        expect(result).toBeNull();
      });

      it('should handle get errors', async () => {
        const error = new Error('Get failed');
        mockRedisClient.get.mockRejectedValue(error);

        await expect(redisClient.get('test-key')).rejects.toThrow('Get failed');
      });
    });

    describe('del', () => {
      it('should delete key successfully', async () => {
        mockRedisClient.del.mockResolvedValue(1);

        const result = await redisClient.del('test-key');

        expect(mockRedisClient.del).toHaveBeenCalledWith('logistics:test-key');
        expect(result).toBe(1);
      });
    });

    describe('exists', () => {
      it('should return true for existing key', async () => {
        mockRedisClient.exists.mockResolvedValue(1);

        const result = await redisClient.exists('test-key');

        expect(result).toBe(true);
      });

      it('should return false for non-existing key', async () => {
        mockRedisClient.exists.mockResolvedValue(0);

        const result = await redisClient.exists('test-key');

        expect(result).toBe(false);
      });
    });
  });

  describe('hash operations', () => {
    describe('hSet', () => {
      it('should set hash field successfully', async () => {
        mockRedisClient.hSet.mockResolvedValue(1);

        const result = await redisClient.hSet('test-hash', 'field1', 'value1');

        expect(mockRedisClient.hSet).toHaveBeenCalledWith('logistics:test-hash', 'field1', 'value1');
        expect(result).toBe(1);
      });
    });

    describe('hGet', () => {
      it('should get hash field successfully', async () => {
        mockRedisClient.hGet.mockResolvedValue('value1');

        const result = await redisClient.hGet('test-hash', 'field1');

        expect(mockRedisClient.hGet).toHaveBeenCalledWith('logistics:test-hash', 'field1');
        expect(result).toBe('value1');
      });
    });

    describe('hGetAll', () => {
      it('should get all hash fields successfully', async () => {
        const hashData = { field1: 'value1', field2: 'value2' };
        mockRedisClient.hGetAll.mockResolvedValue(hashData);

        const result = await redisClient.hGetAll('test-hash');

        expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('logistics:test-hash');
        expect(result).toEqual(hashData);
      });
    });
  });

  describe('list operations', () => {
    describe('lPush', () => {
      it('should push to list successfully', async () => {
        mockRedisClient.lPush.mockResolvedValue(2);

        const result = await redisClient.lPush('test-list', 'item1', 'item2');

        expect(mockRedisClient.lPush).toHaveBeenCalledWith('logistics:test-list', ['item1', 'item2']);
        expect(result).toBe(2);
      });
    });

    describe('lRange', () => {
      it('should get list range successfully', async () => {
        const listItems = ['item1', 'item2', 'item3'];
        mockRedisClient.lRange.mockResolvedValue(listItems);

        const result = await redisClient.lRange('test-list', 0, -1);

        expect(mockRedisClient.lRange).toHaveBeenCalledWith('logistics:test-list', 0, -1);
        expect(result).toEqual(listItems);
      });
    });
  });

  describe('set operations', () => {
    describe('sAdd', () => {
      it('should add to set successfully', async () => {
        mockRedisClient.sAdd.mockResolvedValue(2);

        const result = await redisClient.sAdd('test-set', 'member1', 'member2');

        expect(mockRedisClient.sAdd).toHaveBeenCalledWith('logistics:test-set', ['member1', 'member2']);
        expect(result).toBe(2);
      });
    });

    describe('sMembers', () => {
      it('should get set members successfully', async () => {
        const setMembers = ['member1', 'member2'];
        mockRedisClient.sMembers.mockResolvedValue(setMembers);

        const result = await redisClient.sMembers('test-set');

        expect(mockRedisClient.sMembers).toHaveBeenCalledWith('logistics:test-set');
        expect(result).toEqual(setMembers);
      });
    });
  });

  describe('pattern operations', () => {
    describe('keys', () => {
      it('should get keys by pattern successfully', async () => {
        mockRedisClient.keys.mockResolvedValue(['test1', 'test2']);

        const result = await redisClient.keys('test*');

        expect(mockRedisClient.keys).toHaveBeenCalledWith('logistics:test*');
        expect(result).toEqual(['test1', 'test2']); // Prefix removed
      });
    });

    describe('flushPattern', () => {
      it('should flush keys by pattern successfully', async () => {
        mockRedisClient.keys.mockResolvedValue(['logistics:test1', 'logistics:test2']);
        mockRedisClient.del.mockResolvedValue(2);

        const result = await redisClient.flushPattern('test*');

        expect(result).toBe(2);
      });

      it('should return 0 when no keys match pattern', async () => {
        mockRedisClient.keys.mockResolvedValue([]);

        const result = await redisClient.flushPattern('nonexistent*');

        expect(result).toBe(0);
        expect(mockRedisClient.del).not.toHaveBeenCalled();
      });
    });
  });

  describe('utility methods', () => {
    describe('ping', () => {
      it('should ping Redis successfully', async () => {
        mockRedisClient.ping.mockResolvedValue('PONG');

        const result = await redisClient.ping();

        expect(result).toBe('PONG');
      });
    });

    describe('isHealthy', () => {
      it('should return true when connected and ready', () => {
        (redisClient as any).isConnected = true;
        mockRedisClient.isReady = true;

        const result = redisClient.isHealthy();

        expect(result).toBe(true);
      });

      it('should return false when not connected', () => {
        (redisClient as any).isConnected = false;
        mockRedisClient.isReady = true;

        const result = redisClient.isHealthy();

        expect(result).toBe(false);
      });
    });
  });
});