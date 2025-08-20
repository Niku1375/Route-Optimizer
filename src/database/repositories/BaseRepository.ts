import { PoolClient } from 'pg';
import { db } from '../connection';
import logger from '../../utils/logger';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  protected async query(text: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const result = await db.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      logger.error(`Query failed on table ${this.tableName}:`, error);
      throw error;
    }
  }

  protected async queryWithClient(client: PoolClient, text: string, params?: any[]): Promise<QueryResult<T>> {
    try {
      const result = await client.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      logger.error(`Query with client failed on table ${this.tableName}:`, error);
      throw error;
    }
  }

  public async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  public async findAll(options?: PaginationOptions): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];

    if (options) {
      if (options.sortBy) {
        query += ` ORDER BY ${options.sortBy} ${options.sortOrder || 'ASC'}`;
      }

      if (options.limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(options.limit);

        if (options.page && options.page > 1) {
          const offset = (options.page - 1) * options.limit;
          query += ` OFFSET $${params.length + 1}`;
          params.push(offset);
        }
      }
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  public async findPaginated(options: PaginationOptions): Promise<PaginatedResult<T>> {
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    const countResult = await this.query(countQuery) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total);

    const data = await this.findAll(options);
    const totalPages = Math.ceil(total / options.limit);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages,
    };
  }

  public async create(data: Partial<T>): Promise<T> {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, index) => `$${index + 1}`).join(', ');
    const values = Object.values(data);

    const query = `
      INSERT INTO ${this.tableName} (${columns}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  public async update(id: string, data: Partial<T>): Promise<T | null> {
    const columns = Object.keys(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(data)];

    const query = `
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0] || null;
  }

  public async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id]);
    return result.rowCount > 0;
  }

  public async softDelete(id: string): Promise<T | null> {
    const query = `
      UPDATE ${this.tableName} 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `;
    const result = await this.query(query, [id]);
    return result.rows[0] || null;
  }

  public async findByCondition(condition: string, params: any[]): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName} WHERE ${condition}`;
    const result = await this.query(query, params);
    return result.rows;
  }

  public async count(condition?: string, params?: any[]): Promise<number> {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    if (condition) {
      query += ` WHERE ${condition}`;
    }
    const result = await this.query(query, params);
    return parseInt((result.rows[0] as { total: string }).total);
  }

  public async exists(id: string): Promise<boolean> {
    const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const result = await this.query(query, [id]);
    return result.rowCount > 0;
  }

  protected buildWhereClause(filters: Record<string, any>): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    Object.entries(filters).forEach(([key, value], index) => {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${index + 1}`);
        params.push(value);
      }
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }
}