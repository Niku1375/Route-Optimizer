import { DatabaseConnection } from '../database/connection';
import { DataPrivacyService, GDPRRequest } from './DataPrivacyService';
import { DataMaskingService } from './DataMaskingService';
import Logger from '../utils/logger';
import { AuditLogger } from '../utils/AuditLogger';

export interface GDPRRequestSubmission {
  customerId: string;
  requestType: 'access' | 'deletion' | 'portability' | 'rectification';
  requestedData?: string[];
  reason?: string;
  contactEmail?: string;
  verificationToken?: string;
}

export interface GDPRRequestStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  submittedAt: Date;
  processedAt?: Date;
  estimatedCompletionDate: Date;
  statusMessage: string;
}

export interface DataSubjectRights {
  rightToAccess: boolean;
  rightToRectification: boolean;
  rightToErasure: boolean;
  rightToPortability: boolean;
  rightToRestriction: boolean;
  rightToObject: boolean;
}

export class GDPRComplianceService {
  private readonly logger = Logger;
  private readonly auditLogger = AuditLogger.getInstance();
  private readonly dbConnection: DatabaseConnection;
  private readonly dataPrivacyService: DataPrivacyService;
  private readonly dataMaskingService: DataMaskingService;

  // GDPR compliance configuration
  private readonly gdprConfig = {
    responseTimeLimit: 30, // days
    verificationRequired: true,
    automaticProcessing: false,
    dataRetentionPeriod: 12, // months
    supportedLanguages: ['en', 'hi'],
    contactEmail: 'privacy@logistics-system.com'
  };

  constructor(
    dbConnection: DatabaseConnection,
    dataPrivacyService: DataPrivacyService,
    dataMaskingService: DataMaskingService
  ) {
    this.dbConnection = dbConnection;
    this.dataPrivacyService = dataPrivacyService;
    this.dataMaskingService = dataMaskingService;
  }

  /**
   * Submit a new GDPR request
   */
  async submitGDPRRequest(submission: GDPRRequestSubmission): Promise<string> {
    this.logger.info(`Received GDPR ${submission.requestType} request for customer ${submission.customerId}`);

    // Validate the request
    await this.validateGDPRRequest(submission);

    // Generate unique request ID
    const requestId = this.generateRequestId();

    // Calculate estimated completion date
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + this.gdprConfig.responseTimeLimit);

    // Create GDPR request record
    const gdprRequest: GDPRRequest = {
      id: requestId,
      customerId: submission.customerId,
      requestType: submission.requestType,
      status: 'pending',
      requestedAt: new Date(),
      requestedData: submission.requestedData,
      reason: submission.reason
    };

    // Store the request
    await this.storeGDPRRequest(gdprRequest, submission);

    // Send confirmation email (if email provided)
    if (submission.contactEmail) {
      await this.sendConfirmationEmail(submission.contactEmail, requestId, submission.requestType);
    }

    // Log the request submission
    await this.auditLogger.logDataPrivacyEvent({
      action: 'gdpr_request_submitted',
      customerId: submission.customerId,
      requestId,
      requestType: submission.requestType,
      success: true
    });

    return requestId;
  }

  /**
   * Process a GDPR request
   */
  async processGDPRRequest(requestId: string): Promise<any> {
    this.logger.info(`Processing GDPR request ${requestId}`);

    // Get the request details
    const request = await this.getGDPRRequest(requestId);
    if (!request) {
      throw new Error(`GDPR request ${requestId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error(`GDPR request ${requestId} is not in pending status`);
    }

    try {
      // Update status to processing
      await this.updateGDPRRequestStatus(requestId, 'processing');

      // Process the request using DataPrivacyService
      const result = await this.dataPrivacyService.processGDPRRequest(request);

      // Update status to completed
      await this.updateGDPRRequestStatus(requestId, 'completed');

      // Log successful processing
      await this.auditLogger.logDataPrivacyEvent({
        action: 'gdpr_request_processed',
        customerId: request.customerId,
        requestId,
        requestType: request.requestType,
        success: true
      });

      return result;

    } catch (error) {
      // Update status to rejected
      await this.updateGDPRRequestStatus(requestId, 'rejected', error instanceof Error ? error.message : 'Processing failed');

      // Log failed processing
      await this.auditLogger.logDataPrivacyEvent({
        action: 'gdpr_request_failed',
        customerId: request.customerId,
        requestId,
        requestType: request.requestType,
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      });

      throw error;
    }
  }

  /**
   * Get GDPR request status
   */
  async getGDPRRequestStatus(requestId: string): Promise<GDPRRequestStatus | null> {
    const client = await this.dbConnection.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM gdpr_requests WHERE id = $1',
        [requestId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const estimatedCompletion = new Date(row.requested_at);
      estimatedCompletion.setDate(estimatedCompletion.getDate() + this.gdprConfig.responseTimeLimit);

      return {
        id: row.id,
        status: row.status,
        submittedAt: row.requested_at,
        processedAt: row.processed_at,
        estimatedCompletionDate: estimatedCompletion,
        statusMessage: this.getStatusMessage(row.status, row.request_type)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get all GDPR requests for a customer
   */
  async getCustomerGDPRRequests(customerId: string): Promise<GDPRRequestStatus[]> {
    const client = await this.dbConnection.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM gdpr_requests WHERE customer_id = $1 ORDER BY requested_at DESC',
        [customerId]
      );

      return result.rows.map(row => {
        const estimatedCompletion = new Date(row.requested_at);
        estimatedCompletion.setDate(estimatedCompletion.getDate() + this.gdprConfig.responseTimeLimit);

        return {
          id: row.id,
          status: row.status,
          submittedAt: row.requested_at,
          processedAt: row.processed_at,
          estimatedCompletionDate: estimatedCompletion,
          statusMessage: this.getStatusMessage(row.status, row.request_type)
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Get data subject rights information
   */
  getDataSubjectRights(): DataSubjectRights {
    return {
      rightToAccess: true,
      rightToRectification: true,
      rightToErasure: true,
      rightToPortability: true,
      rightToRestriction: false, // Not implemented yet
      rightToObject: false // Not implemented yet
    };
  }

  /**
   * Generate privacy policy compliance report
   */
  async generateComplianceReport(): Promise<any> {
    const client = await this.dbConnection.getClient();
    try {
      // Get GDPR request statistics
      const gdprStats = await client.query(`
        SELECT 
          request_type,
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (processed_at - requested_at))/86400) as avg_processing_days
        FROM gdpr_requests 
        WHERE requested_at >= NOW() - INTERVAL '12 months'
        GROUP BY request_type, status
      `);

      // Get data retention status
      const retentionStatus = await this.dataPrivacyService.getDataRetentionStatus();

      // Get audit log statistics
      const auditStats = await this.auditLogger.getAuditLogStats('month');

      return {
        reportGeneratedAt: new Date(),
        gdprRequestStatistics: gdprStats.rows,
        dataRetentionStatus: retentionStatus,
        auditLogStatistics: auditStats,
        complianceConfiguration: this.gdprConfig,
        dataSubjectRights: this.getDataSubjectRights()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate GDPR request submission
   */
  private async validateGDPRRequest(submission: GDPRRequestSubmission): Promise<void> {
    // Check if customer exists
    const client = await this.dbConnection.getClient();
    try {
      const customerCheck = await client.query(
        'SELECT COUNT(*) FROM deliveries WHERE customer_id = $1',
        [submission.customerId]
      );

      if (parseInt(customerCheck.rows[0].count) === 0) {
        throw new Error('Customer not found in system');
      }

      // Check for duplicate pending requests
      const duplicateCheck = await client.query(
        'SELECT COUNT(*) FROM gdpr_requests WHERE customer_id = $1 AND request_type = $2 AND status IN (\'pending\', \'processing\')',
        [submission.customerId, submission.requestType]
      );

      if (parseInt(duplicateCheck.rows[0].count) > 0) {
        throw new Error(`A ${submission.requestType} request is already pending for this customer`);
      }

    } finally {
      client.release();
    }
  }

  /**
   * Store GDPR request in database
   */
  private async storeGDPRRequest(request: GDPRRequest, submission: GDPRRequestSubmission): Promise<void> {
    const client = await this.dbConnection.getClient();
    try {
      await client.query(`
        INSERT INTO gdpr_requests (
          id, customer_id, request_type, status, requested_at,
          requested_data, reason, contact_email, verification_token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        request.id,
        request.customerId,
        request.requestType,
        request.status,
        request.requestedAt,
        request.requestedData ? JSON.stringify(request.requestedData) : null,
        request.reason,
        submission.contactEmail,
        submission.verificationToken
      ]);
    } finally {
      client.release();
    }
  }

  /**
   * Get GDPR request from database
   */
  private async getGDPRRequest(requestId: string): Promise<GDPRRequest | null> {
    const client = await this.dbConnection.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM gdpr_requests WHERE id = $1',
        [requestId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        customerId: row.customer_id,
        requestType: row.request_type,
        status: row.status,
        requestedAt: row.requested_at,
        processedAt: row.processed_at,
        requestedData: row.requested_data ? JSON.parse(row.requested_data) : undefined,
        reason: row.reason
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update GDPR request status
   */
  private async updateGDPRRequestStatus(requestId: string, status: string, statusMessage?: string): Promise<void> {
    const client = await this.dbConnection.getClient();
    try {
      await client.query(
        'UPDATE gdpr_requests SET status = $1, processed_at = $2, status_message = $3 WHERE id = $4',
        [status, status === 'completed' || status === 'rejected' ? new Date() : null, statusMessage, requestId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `GDPR-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Get status message for GDPR request
   */
  private getStatusMessage(status: string, requestType: string): string {
    const messages = {
      pending: `Your ${requestType} request has been received and is pending review.`,
      processing: `Your ${requestType} request is currently being processed.`,
      completed: `Your ${requestType} request has been completed successfully.`,
      rejected: `Your ${requestType} request has been rejected. Please contact support for more information.`
    };

    return messages[status as keyof typeof messages] || 'Unknown status';
  }

  /**
   * Send confirmation email (mock implementation)
   */
  private async sendConfirmationEmail(email: string, requestId: string, requestType: string): Promise<void> {
    // Mock email sending - in production, integrate with email service
    this.logger.info(`Sending GDPR confirmation email to ${email} for request ${requestId} (${requestType})`);
    
    // Log email sent
    await this.auditLogger.logDataPrivacyEvent({
      action: 'gdpr_confirmation_email_sent',
      requestId,
      requestType,
      success: true
    });
  }

  /**
   * Create GDPR requests table if it doesn't exist
   */
  async initializeGDPRTables(): Promise<void> {
    const client = await this.dbConnection.getClient();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS gdpr_requests (
          id VARCHAR(50) PRIMARY KEY,
          customer_id UUID NOT NULL,
          request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('access', 'deletion', 'portability', 'rectification')),
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
          requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          processed_at TIMESTAMP WITH TIME ZONE,
          requested_data JSONB,
          reason TEXT,
          contact_email VARCHAR(255),
          verification_token VARCHAR(255),
          status_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_customer ON gdpr_requests(customer_id);
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON gdpr_requests(request_type);
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_requested_at ON gdpr_requests(requested_at);
      `);

      this.logger.info('GDPR tables initialized successfully');
    } finally {
      client.release();
    }
  }
}