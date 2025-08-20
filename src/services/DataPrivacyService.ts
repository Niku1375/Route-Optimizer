
import { DatabaseConnection } from '../database/connection';
import Logger from '../utils/logger';
import { AuditLogger } from '../utils/AuditLogger';

export interface DataRetentionPolicy {
  tableName: string;
  retentionPeriodMonths: number;
  dateColumn: string;
  conditions?: Record<string, any>;
  cascadeDelete?: boolean;
}

export interface GDPRRequest {
  id: string;
  customerId: string;
  requestType: 'access' | 'deletion' | 'portability' | 'rectification';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  processedAt?: Date;
  requestedData?: string[] | undefined;
  reason?: string | undefined;
}

export interface DataPurgeResult {
  tableName: string;
  recordsDeleted: number;
  success: boolean;
  error?: string;
  executedAt: Date;
}

export interface PIIField {
  tableName: string;
  columnName: string;
  dataType: 'email' | 'phone' | 'name' | 'address' | 'plate_number' | 'driver_id';
  maskingStrategy: 'partial' | 'hash' | 'encrypt' | 'remove';
}

export class DataPrivacyService {

  private readonly logger: typeof Logger;
  private readonly auditLogger: AuditLogger;
  private readonly dbConnection: DatabaseConnection;

  // Default retention policies (12 months for sensitive data)
  private readonly defaultRetentionPolicies: DataRetentionPolicy[] = [
    {
      tableName: 'audit_logs',
      retentionPeriodMonths: 12,
      dateColumn: 'created_at'
    },
    {
      tableName: 'user_sessions',
      retentionPeriodMonths: 3,
      dateColumn: 'created_at',
      conditions: { is_active: false }
    },
    {
      tableName: 'security_events',
      retentionPeriodMonths: 24, // Keep security events longer
      dateColumn: 'created_at',
      conditions: { resolved: true }
    },
    {
      tableName: 'deliveries',
      retentionPeriodMonths: 12,
      dateColumn: 'created_at',
      conditions: { status: 'delivered' }
    },
    {
      tableName: 'routes',
      retentionPeriodMonths: 12,
      dateColumn: 'created_at',
      conditions: { status: 'completed' }
    },
    {
      tableName: 'traffic_data',
      retentionPeriodMonths: 6,
      dateColumn: 'created_at'
    },
    {
      tableName: 'rate_limit_violations',
      retentionPeriodMonths: 6,
      dateColumn: 'created_at'
    }
  ];

  // PII fields that need special handling
  private readonly piiFields: PIIField[] = [
    { tableName: 'vehicles', columnName: 'plate_number', dataType: 'plate_number', maskingStrategy: 'partial' },
    { tableName: 'vehicles', columnName: 'driver_id', dataType: 'driver_id', maskingStrategy: 'hash' },
    { tableName: 'deliveries', columnName: 'pickup_address', dataType: 'address', maskingStrategy: 'partial' },
    { tableName: 'deliveries', columnName: 'delivery_address', dataType: 'address', maskingStrategy: 'partial' },
    { tableName: 'deliveries', columnName: 'customer_id', dataType: 'driver_id', maskingStrategy: 'hash' },
    { tableName: 'audit_logs', columnName: 'ip_address', dataType: 'address', maskingStrategy: 'partial' },
    { tableName: 'audit_logs', columnName: 'user_agent', dataType: 'name', maskingStrategy: 'partial' },
    { tableName: 'user_sessions', columnName: 'ip_address', dataType: 'address', maskingStrategy: 'partial' },
    { tableName: 'user_sessions', columnName: 'user_agent', dataType: 'name', maskingStrategy: 'partial' }
  ];


  constructor(dbConnection: DatabaseConnection) {
    this.dbConnection = dbConnection;
    this.logger = Logger;
    this.auditLogger = AuditLogger.getInstance();
  }

  /**
   * Execute automatic data purging based on retention policies
   */
  async executeDataPurging(): Promise<DataPurgeResult[]> {
    this.logger.info('Starting automatic data purging process');
    const results: DataPurgeResult[] = [];

    for (const policy of this.defaultRetentionPolicies) {
      try {
        const result = await this.purgeTableData(policy);
        results.push(result);

        // Log successful purge
        await this.auditLogger.logDataPrivacyEvent({
          action: 'data_purge',
          tableName: policy.tableName,
          recordsAffected: result.recordsDeleted,
          retentionPeriod: policy.retentionPeriodMonths,
          success: result.success
        });
      } catch (error: any) {
        const errorResult: DataPurgeResult = {
          tableName: policy.tableName,
          recordsDeleted: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executedAt: new Date()
        };
        results.push(errorResult);
        this.logger.error(`Failed to purge data from ${policy.tableName}:`, error);
      }
    }

    this.logger.info(`Data purging completed. Processed ${results.length} tables`);
    return results;
  }

  /**
   * Purge data from a specific table based on retention policy
   */
  private async purgeTableData(policy: DataRetentionPolicy): Promise<DataPurgeResult> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriodMonths);

    let query = `DELETE FROM ${policy.tableName} WHERE ${policy.dateColumn} < $1`;
    const params: any[] = [cutoffDate];

    // Add additional conditions if specified
    if (policy.conditions) {
      let paramIndex = 2;
      for (const [column, value] of Object.entries(policy.conditions)) {
        query += ` AND ${column} = $${paramIndex}`;
        params.push(value);
        paramIndex++;
      }
    }

    const client = await this.dbConnection.getClient();
    try {
      const result = await client.query(query, params);
      return {
        tableName: policy.tableName,
        recordsDeleted: result.rowCount || 0,
        success: true,
        executedAt: new Date()
      };
    } catch (error: any) {
      return {
        tableName: policy.tableName,
        recordsDeleted: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Process GDPR data subject requests
   */
  async processGDPRRequest(request: GDPRRequest): Promise<any> {
    this.logger.info(`Processing GDPR request ${request.id} for customer ${request.customerId}`);
    try {
      switch (request.requestType) {
        case 'access':
          return await this.handleDataAccessRequest(request);
        case 'deletion':
          return await this.handleDataDeletionRequest(request);
        case 'portability':
          return await this.handleDataPortabilityRequest(request);
        case 'rectification':
          return await this.handleDataRectificationRequest(request);
        default:
          throw new Error(`Unsupported GDPR request type: ${request.requestType}`);
      }
    } catch (error: any) {
      await this.auditLogger.logDataPrivacyEvent({
        action: 'gdpr_request_failed',
        customerId: request.customerId,
        requestType: request.requestType,
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Handle data access request (Right to Access)
   */
  private async handleDataAccessRequest(request: GDPRRequest): Promise<any> {
    const customerData: any = {};
    const client = await this.dbConnection.getClient();
    try {
      // Get customer delivery data
      const deliveriesResult = await client.query(
        'SELECT * FROM deliveries WHERE customer_id = $1',
        [request.customerId]
      );
      customerData.deliveries = deliveriesResult.rows;

      // Get customer loyalty data
      const loyaltyResult = await client.query(
        'SELECT * FROM customer_loyalty_profiles WHERE customer_id = $1',
        [request.customerId]
      );
      customerData.loyaltyProfile = loyaltyResult.rows[0] || null;

      // Get audit logs related to customer
      const auditResult = await client.query(
        'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 100',
        [request.customerId]
      );
      customerData.auditLogs = auditResult.rows;

      // Mask sensitive data before returning
      customerData.deliveries = customerData.deliveries.map((delivery: any) =>
        this.maskSensitiveData(delivery, 'deliveries')
      );

      await this.auditLogger.logDataPrivacyEvent({
        action: 'gdpr_data_access',
        customerId: request.customerId,
        requestId: request.id,
        dataReturned: Object.keys(customerData)
      });

      return customerData;
    } catch (error: any) {
      this.logger.error('Error in handleDataAccessRequest:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle data deletion request (Right to be Forgotten)
   */
  private async handleDataDeletionRequest(request: GDPRRequest): Promise<void> {
    const client = await this.dbConnection.getClient();
    try {
      await client.query('BEGIN');

      // Delete customer deliveries (anonymize rather than delete for business records)
      await client.query(
        "UPDATE deliveries SET customer_id = NULL, pickup_address = '[DELETED]', delivery_address = '[DELETED]' WHERE customer_id = $1",
        [request.customerId]
      );

      // Delete loyalty profile
      await client.query(
        'DELETE FROM customer_loyalty_profiles WHERE customer_id = $1',
        [request.customerId]
      );

      // Anonymize audit logs
      await client.query(
        "UPDATE audit_logs SET user_id = NULL, ip_address = NULL, user_agent = '[DELETED]' WHERE user_id = $1",
        [request.customerId]
      );

      // Delete user sessions
      await client.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [request.customerId]
      );

      await client.query('COMMIT');

      await this.auditLogger.logDataPrivacyEvent({
        action: 'gdpr_data_deletion',
        customerId: request.customerId,
        requestId: request.id,
        success: true
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      this.logger.error('Error in handleDataDeletionRequest:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle data portability request (Right to Data Portability)
   */
  private async handleDataPortabilityRequest(request: GDPRRequest): Promise<any> {
    // Similar to access request but in a structured, machine-readable format
    const data = await this.handleDataAccessRequest(request);
    // Convert to standardized format (JSON)
    const portableData = {
      customerId: request.customerId,
      exportedAt: new Date().toISOString(),
      format: 'JSON',
      data
    };

    await this.auditLogger.logDataPrivacyEvent({
      action: 'gdpr_data_portability',
      customerId: request.customerId,
      requestId: request.id,
      exportFormat: 'JSON'
    });

    return portableData;
  }

  /**
   * Handle data rectification request (Right to Rectification)
   */
  private async handleDataRectificationRequest(request: GDPRRequest): Promise<void> {
    // This would typically involve updating specific fields
    // Implementation depends on the specific rectification requested
    // You may want to implement actual update logic here
    await this.auditLogger.logDataPrivacyEvent({
      action: 'gdpr_data_rectification',
      customerId: request.customerId,
      requestId: request.id,
      fieldsUpdated: request.requestedData || []
    });
  }

  /**
   * Mask sensitive data based on field type and masking strategy
   */
  private maskSensitiveData(data: any, tableName: string): any {
    const maskedData = { ...data };
    const relevantFields = this.piiFields.filter(field => field.tableName === tableName);
    for (const field of relevantFields) {
      if (Object.prototype.hasOwnProperty.call(maskedData, field.columnName) && maskedData[field.columnName]) {
        maskedData[field.columnName] = this.applyMasking(
          maskedData[field.columnName],
          field.maskingStrategy,
          field.dataType
        );
      }
    }
    return maskedData;
  }

  /**
   * Apply specific masking strategy to a value
   */
  private applyMasking(value: string, strategy: string, dataType: string): string {
    if (!value) return value;
    switch (strategy) {
      case 'partial':
        return this.partialMask(value, dataType);
      case 'hash':
        return this.hashValue(value);
      case 'encrypt':
        return '[ENCRYPTED]';
      case 'remove':
        return '[REMOVED]';
      default:
        return value;
    }
  }

  /**
   * Apply partial masking based on data type
   */
  private partialMask(value: string, dataType: string): string {
    switch (dataType) {
      case 'email': {
        const emailParts = value.split('@');
        if (emailParts.length === 2) {
          const username = emailParts[0] || '';
          const domain = emailParts[1] || '';
          return `${username.substring(0, 2)}***@${domain}`;
        }
        return value;
      }
      case 'phone':
        return value.length > 4 ? `***-***-${value.slice(-4)}` : value;
      case 'plate_number':
        return value.length > 4 ? `${value.substring(0, 2)}***${value.slice(-2)}` : value;
      case 'address': {
        const words = value.split(' ');
        if (words.length > 2) {
          return `${words[0]} *** ${words[words.length - 1]}`;
        }
        return '*** ***';
      }
      case 'name': {
        const nameParts = value.split(' ');
        return nameParts.map(part => part.length > 2 ? `${part[0]}***` : part).join(' ');
      }
      default:
        return value.length > 4 ? `${value.substring(0, 2)}***${value.slice(-2)}` : '***';
    }
  }

  /**
   * Create a hash of the value for anonymization
   */
  private hashValue(value: string): string {
    // Simple hash for demonstration - in production, use crypto.createHash
    let hash = 0, i: number, chr: number;
    if (value.length === 0) return '';
    for (i = 0; i < value.length; i++) {
      chr = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return `HASH_${Math.abs(hash)}`;
  }
}
