#!/usr/bin/env ts-node

/**
 * Database Migration Script
 * Runs database migrations for the logistics routing system
 */


import { DatabaseMigrations } from '../database/migrations';
import logger from '../utils/logger';
import { config } from 'dotenv';

// Load environment variables
config();

console.log(process.env.DATABASE_PASSWORD);

async function runMigrations() {
  try {
    logger.info('Starting database migration process...');
    
    // Initialize and run migrations
    await DatabaseMigrations.initializeDatabase();
    
    logger.info('Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };