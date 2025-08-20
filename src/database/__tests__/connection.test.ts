import { DatabaseConnection } from '../connection';
import { Pool } from 'pg';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
    on: jest.fn(),
    totalCount: 5,
    idleCount: 2,
    waitingCount: 0,
  })),
}));

describe('DatabaseConnection', () => {
  let dbConnection: DatabaseConnection;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    dbConnection = DatabaseConnection.getInstance();
    mockPool = dbConnection.getPool() as jest.Mocked<Pool>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DatabaseConnection.getInstance();
      const instance2 = DatabaseConnection.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('connect', () => {
    it('should establish database connection successfully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      await dbConnection.connect();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT NOW()');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(dbConnection.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should close database connection', async () => {
      mockPool.end.mockResolvedValue();

      await dbConnection.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle disconnection errors', async () => {
      const error = new Error('Disconnection failed');
      mockPool.end.mockRejectedValue(error);

      await expect(dbConnection.disconnect()).rejects.toThrow('Disconnection failed');
    });
  });

  describe('query', () => {
    it('should execute query successfully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 }),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const result = await dbConnection.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(result.rows).toEqual([{ id: 1 }]);
      expect(result.rowCount).toBe(1);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle query errors and release client', async () => {
      const mockClient = {
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      await expect(dbConnection.query('INVALID SQL')).rejects.toThrow('Query failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // callback query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }), // COMMIT
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const callback = jest.fn().mockResolvedValue({ id: 1 });
      const result = await dbConnection.transaction(callback);

      expect(result).toEqual({ id: 1 });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }), // ROLLBACK
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      const callback = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      await expect(dbConnection.transaction(callback)).rejects.toThrow('Transaction failed');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      const stats = dbConnection.getPoolStats();

      expect(stats).toEqual({
        totalCount: 5,
        idleCount: 2,
        waitingCount: 0,
        isConnected: false, // Initially false until connect() is called
      });
    });
  });

  describe('isHealthy', () => {
    it('should return false when not connected', () => {
      expect(dbConnection.isHealthy()).toBe(false);
    });

    it('should return true when connected and pool has connections', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ now: new Date() }] }),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(mockClient as any);

      await dbConnection.connect();
      expect(dbConnection.isHealthy()).toBe(true);
    });
  });
});