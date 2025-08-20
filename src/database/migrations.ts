import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './connection';
import logger from '../utils/logger';

export class DatabaseMigrations {
  private static readonly SCHEMA_FILE = join(__dirname, 'schema.sql');

  public static async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');
      
      // Read and execute schema file
      const schemaSQL = readFileSync(this.SCHEMA_FILE, 'utf8');
      
      // Execute the entire schema as one transaction
      await db.query(schemaSQL);

      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Database migration failed:', error);
      throw error;
    }
  }

  public static async createMigrationTable(): Promise<void> {
    const createMigrationTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await db.query(createMigrationTableSQL);
      logger.info('Migration table created or already exists');
    } catch (error) {
      logger.error('Failed to create migration table:', error);
      throw error;
    }
  }

  public static async recordMigration(version: string): Promise<void> {
    const insertMigrationSQL = `
      INSERT INTO schema_migrations (version) 
      VALUES ($1) 
      ON CONFLICT (version) DO NOTHING;
    `;

    try {
      await db.query(insertMigrationSQL, [version]);
      logger.info(`Migration ${version} recorded`);
    } catch (error) {
      logger.error(`Failed to record migration ${version}:`, error);
      throw error;
    }
  }

  public static async isMigrationApplied(version: string): Promise<boolean> {
    const checkMigrationSQL = `
      SELECT COUNT(*) as count 
      FROM schema_migrations 
      WHERE version = $1;
    `;

    try {
      const result = await db.query(checkMigrationSQL, [version]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      // If the table doesn't exist, the migration hasn't been applied
      logger.debug(`Migration table doesn't exist or migration ${version} not found:`, error);
      return false;
    }
  }

  public static async initializeDatabase(): Promise<void> {
    try {
      logger.info('Initializing database...');
      
      // Ensure database connection
      await db.connect();
      
      // Create migration tracking table
      await this.createMigrationTable();
      
      // Check if initial schema is already applied
      const schemaVersion = '001_initial_schema';
      const isApplied = await this.isMigrationApplied(schemaVersion);
      
      if (!isApplied) {
        // Run initial schema migration
        await this.runMigrations();
        await this.recordMigration(schemaVersion);
        logger.info('Initial database schema applied');
      } else {
        logger.info('Database schema already up to date');
      }
      
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  public static async dropAllTables(): Promise<void> {
    const dropTablesSQL = `
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS buffer_vehicles CASCADE;
      DROP TABLE IF EXISTS route_deliveries CASCADE;
      DROP TABLE IF EXISTS routes CASCADE;
      DROP TABLE IF EXISTS deliveries CASCADE;
      DROP TABLE IF EXISTS customer_loyalty_profiles CASCADE;
      DROP TABLE IF EXISTS traffic_data CASCADE;
      DROP TABLE IF EXISTS compliance_rules CASCADE;
      DROP TABLE IF EXISTS vehicles CASCADE;
      DROP TABLE IF EXISTS hubs CASCADE;
      DROP TABLE IF EXISTS schema_migrations CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `;

    try {
      await db.query(dropTablesSQL);
      logger.info('All tables dropped successfully');
    } catch (error) {
      logger.error('Failed to drop tables:', error);
      throw error;
    }
  }
}