import { DatabaseMigrations } from '../migrations';
import { readFileSync } from 'fs';

// Mock dependencies
jest.mock('fs');
jest.mock('../connection', () => ({
  db: {
    transaction: jest.fn(),
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

import { db } from '../connection';

describe('DatabaseMigrations', () => {
  let mockTransaction: jest.MockedFunction<typeof db.transaction>;
  let mockQuery: jest.MockedFunction<typeof db.query>;
  let mockConnect: jest.MockedFunction<typeof db.connect>;
  let mockReadFileSync: jest.MockedFunction<typeof readFileSync>;

  beforeEach(() => {
    mockTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;
    mockQuery = db.query as jest.MockedFunction<typeof db.query>;
    mockConnect = db.connect as jest.MockedFunction<typeof db.connect>;
    mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
    jest.clearAllMocks();
  });

  describe('createMigrationTable', () => {
    it('should create migration table successfully', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await DatabaseMigrations.createMigrationTable();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
      );
    });

    it('should handle errors when creating migration table', async () => {
      const error = new Error('Table creation failed');
      mockQuery.mockRejectedValue(error);

      await expect(DatabaseMigrations.createMigrationTable()).rejects.toThrow('Table creation failed');
    });
  });

  describe('recordMigration', () => {
    it('should record migration version', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      await DatabaseMigrations.recordMigration('001_initial_schema');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        ['001_initial_schema']
      );
    });

    it('should handle errors when recording migration', async () => {
      const error = new Error('Insert failed');
      mockQuery.mockRejectedValue(error);

      await expect(DatabaseMigrations.recordMigration('001_initial_schema')).rejects.toThrow('Insert failed');
    });
  });

  describe('isMigrationApplied', () => {
    it('should return true when migration is applied', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '1' }], rowCount: 1 });

      const result = await DatabaseMigrations.isMigrationApplied('001_initial_schema');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count'),
        ['001_initial_schema']
      );
    });

    it('should return false when migration is not applied', async () => {
      mockQuery.mockResolvedValue({ rows: [{ count: '0' }], rowCount: 1 });

      const result = await DatabaseMigrations.isMigrationApplied('001_initial_schema');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const error = new Error('Query failed');
      mockQuery.mockRejectedValue(error);

      const result = await DatabaseMigrations.isMigrationApplied('001_initial_schema');

      expect(result).toBe(false);
    });
  });

  describe('runMigrations', () => {
    it('should run migrations successfully', async () => {
      const mockSchemaSQL = `
        CREATE TABLE test1 (id UUID PRIMARY KEY);
        CREATE TABLE test2 (id UUID PRIMARY KEY);
        -- This is a comment
        CREATE INDEX idx_test ON test1(id);
      `;

      mockReadFileSync.mockReturnValue(mockSchemaSQL);
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        };
        return callback(mockClient as any);
      });

      await DatabaseMigrations.runMigrations();

      expect(mockReadFileSync).toHaveBeenCalled();
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      const error = new Error('Migration failed');
      mockReadFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(DatabaseMigrations.runMigrations()).rejects.toThrow('Migration failed');
    });
  });

  describe('initializeDatabase', () => {
    it('should initialize database when migration not applied', async () => {
      mockConnect.mockResolvedValue();
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // createMigrationTable
        .mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 }) // isMigrationApplied
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // recordMigration

      mockReadFileSync.mockReturnValue('CREATE TABLE test (id UUID PRIMARY KEY);');
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        };
        return callback(mockClient as any);
      });

      await DatabaseMigrations.initializeDatabase();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should skip migration when already applied', async () => {
      mockConnect.mockResolvedValue();
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // createMigrationTable
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }); // isMigrationApplied

      await DatabaseMigrations.initializeDatabase();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockConnect.mockRejectedValue(error);

      await expect(DatabaseMigrations.initializeDatabase()).rejects.toThrow('Initialization failed');
    });
  });

  describe('dropAllTables', () => {
    it('should drop all tables successfully', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

      await DatabaseMigrations.dropAllTables();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE IF EXISTS')
      );
    });

    it('should handle errors when dropping tables', async () => {
      const error = new Error('Drop failed');
      mockQuery.mockRejectedValue(error);

      await expect(DatabaseMigrations.dropAllTables()).rejects.toThrow('Drop failed');
    });
  });
});