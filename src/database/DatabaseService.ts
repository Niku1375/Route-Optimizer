import { PoolClient } from 'pg';
import { db, DatabaseConnection } from './connection';

export interface QueryResult {
  rows: any[];
  rowCount: number;
}

export class DatabaseService {
  private dbConnection: DatabaseConnection;

  constructor() {
    this.dbConnection = db; // Use the singleton instance
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    return this.dbConnection.query(sql, params);
  }

  async connect(): Promise<void> {
    await this.dbConnection.connect();
  }

  async disconnect(): Promise<void> {
    await this.dbConnection.disconnect();
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.dbConnection.transaction(callback);
  }

  isHealthy(): boolean {
    return this.dbConnection.isHealthy();
  }

  getPoolStats() {
    return this.dbConnection.getPoolStats();
  }
}
