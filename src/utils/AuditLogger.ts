import { DatabaseConnection } from '../database/connection';
import Logger from './logger';

export interface DataPrivacyEvent {
  action: string;
  customerId?: string;
  requestId?: string;
  requestType?: string;
  tableName?: string;
  recordsAffected?: number;
  retentionPeriod?: number;
  totalTablesProcessed?: number;
  totalRecordsDeleted?: number;
  dataReturned?: string[];
  fieldsUpdated?: string[];
  exportFormat?: string;
  success?: boolean;
  error?: string;
}

export interface AuditLogEntry {
  eventType: string;
  eventCategory: string;
  eventDescription: string;
  entityType?: string;
  entityId?: string | undefined;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  status: 'success' | 'failure' | 'partial';
}

export class AuditLogger {
  private static instance: AuditLogger;
  private readonly logger = Logger;
  private dbConnection?: DatabaseConnection;

  private constructor() {}

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Initialize with database connection
   */
  initialize(dbConnection: DatabaseConnection): void {
    this.dbConnection = dbConnection;
  }

  /**
   * Log data privacy related events
   */
  async logDataPrivacyEvent(event: DataPrivacyEvent): Promise<void> {
    const auditEntry: AuditLogEntry = {
      eventType: event.action,
      eventCategory: 'data_privacy',
      eventDescription: this.generateDataPrivacyDescription(event),
      entityType: event.customerId ? 'customer' : 'system',
      entityId: event.customerId,
      metadata: {
        ...event,
        timestamp: new Date().toISOString()
      },
      severity: this.determineSeverity(event),
      status: event.success !== false ? 'success' : 'failure'
    };

    await this.logAuditEvent(auditEntry);
  }

  /**
   * Log general audit events
   */
  async logAuditEvent(entry: AuditLogEntry): Promise<void> {
    try {
      // Log to application logger first
      this.logger.info(`Audit: ${entry.eventType}`, {
        category: entry.eventCategory,
        description: entry.eventDescription,
        severity: entry.severity,
        status: entry.status,
        metadata: entry.metadata
      });

      // Store in database if available
      if (this.dbConnection) {
        await this.storeAuditLog(entry);
      }
    } catch (error) {
      this.logger.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Store audit log in database
   */
  private async storeAuditLog(entry: AuditLogEntry): Promise<void> {
    if (!this.dbConnection) {
      throw new Error('Database connection not initialized');
    }

    const client = await this.dbConnection.getClient();
    try {
      await client.query(`
        INSERT INTO audit_logs (
          event_type, event_category, event_description,
          entity_type, entity_id, user_id, session_id,
          ip_address, user_agent, old_values, new_values,
          metadata, severity, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        entry.eventType,
        entry.eventCategory,
        entry.eventDescription,
        entry.entityType,
        entry.entityId,
        entry.userId,
        entry.sessionId,
        entry.ipAddress,
        entry.userAgent,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.severity,
        entry.status
      ]);
    } finally {
      client.release();
    }
  }

  /**
   * Generate human-readable description for data privacy events
   */
  private generateDataPrivacyDescription(event: DataPrivacyEvent): string {
    switch (event.action) {
      case 'data_purge':
        return `Purged ${event.recordsAffected || 0} records from ${event.tableName} (retention: ${event.retentionPeriod} months)`;
      
      case 'scheduled_data_purge':
        return `Scheduled data purge completed: ${event.totalTablesProcessed} tables processed, ${event.totalRecordsDeleted} total records deleted`;
      
      case 'gdpr_data_access':
        return `GDPR data access request processed for customer ${event.customerId}. Data returned: ${event.dataReturned?.join(', ') || 'none'}`;
      
      case 'gdpr_data_deletion':
        return `GDPR data deletion request processed for customer ${event.customerId}`;
      
      case 'gdpr_data_portability':
        return `GDPR data portability request processed for customer ${event.customerId} in ${event.exportFormat} format`;
      
      case 'gdpr_data_rectification':
        return `GDPR data rectification request processed for customer ${event.customerId}. Fields updated: ${event.fieldsUpdated?.join(', ') || 'none'}`;
      
      case 'gdpr_request_failed':
        return `GDPR ${event.requestType} request failed for customer ${event.customerId}: ${event.error}`;
      
      default:
        return `Data privacy event: ${event.action}`;
    }
  }

  /**
   * Determine severity level for data privacy events
   */
  private determineSeverity(event: DataPrivacyEvent): 'debug' | 'info' | 'warning' | 'error' | 'critical' {
    if (event.success === false) {
      return 'error';
    }

    switch (event.action) {
      case 'gdpr_data_deletion':
      case 'data_purge':
        return 'warning'; // Data deletion is significant
      
      case 'gdpr_data_access':
      case 'gdpr_data_portability':
        return 'info';
      
      case 'scheduled_data_purge':
        return 'info';
      
      case 'gdpr_request_failed':
        return 'error';
      
      default:
        return 'info';
    }
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filters: {
    eventType?: string;
    eventCategory?: string;
    entityId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    if (!this.dbConnection) {
      throw new Error('Database connection not initialized');
    }

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.eventType) {
      query += ` AND event_type = $${paramIndex}`;
      params.push(filters.eventType);
      paramIndex++;
    }

    if (filters.eventCategory) {
      query += ` AND event_category = $${paramIndex}`;
      params.push(filters.eventCategory);
      paramIndex++;
    }

    if (filters.entityId) {
      query += ` AND entity_id = $${paramIndex}`;
      params.push(filters.entityId);
      paramIndex++;
    }

    if (filters.userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND timestamp >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND timestamp <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const client = await this.dbConnection.getClient();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get audit log statistics
   */
  async getAuditLogStats(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    if (!this.dbConnection) {
      throw new Error('Database connection not initialized');
    }

    const intervals = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const client = await this.dbConnection.getClient();
    try {
      const result = await client.query(`
        SELECT 
          event_category,
          severity,
          status,
          COUNT(*) as count
        FROM audit_logs 
        WHERE timestamp >= NOW() - INTERVAL '${intervals[timeframe]}'
        GROUP BY event_category, severity, status
        ORDER BY count DESC
      `);

      return result.rows;
    } finally {
      client.release();
    }
  }
}