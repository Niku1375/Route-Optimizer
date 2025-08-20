import { DataPrivacyService } from '../DataPrivacyService';
import { DataMaskingService, MaskingConfig } from '../DataMaskingService';
import { GDPRComplianceService } from '../GDPRComplianceService';
import { DatabaseService } from '../../database/DatabaseService';
import { AuditLogger } from '../../utils/AuditLogger';

// Mock dependencies for integration test
jest.mock('../../database/DatabaseService');
jest.mock('../../utils/Logger');

describe('Data Privacy Integration Tests', () => {
  let dataPrivacyService: DataPrivacyService;
  let dataMaskingService: DataMaskingService;
  let gdprComplianceService: GDPRComplianceService;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockClient: any;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    // Setup mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    // Setup mock database service
    mockDbService = {
      getClient: jest.fn().mockResolvedValue(mockClient)
    } as any;

    // Initialize services
    dataPrivacyService = new DataPrivacyService(mockDbService);
    
    const maskingConfig: MaskingConfig = {
      enabled: true,
      environment: 'test',
      logMasking: true,
      databaseMasking: true,
      apiResponseMasking: true
    };
    dataMaskingService = new DataMaskingService(maskingConfig);

    auditLogger = AuditLogger.getInstance();
    auditLogger.initialize(mockDbService);

    gdprComplianceService = new GDPRComplianceService(
      mockDbService,
      dataPrivacyService,
      dataMaskingService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete GDPR Data Access Workflow', () => {
    it('should handle complete data access request with masking', async () => {
      const customerId = 'customer-test-123';
      
      // Mock GDPR request submission
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Customer exists
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No duplicate requests
        .mockResolvedValueOnce({}) // Insert GDPR request
        .mockResolvedValueOnce({ // Get GDPR request for processing
          rows: [{
            id: 'GDPR-TEST-123',
            customer_id: customerId,
            request_type: 'access',
            status: 'pending',
            requested_at: new Date()
          }]
        })
        .mockResolvedValueOnce({}) // Update to processing
        .mockResolvedValueOnce({ // Get deliveries
          rows: [{
            id: 'delivery-1',
            customer_id: customerId,
            pickup_address: '123 Main Street, New Delhi',
            delivery_address: '456 Oak Avenue, Gurgaon',
            created_at: new Date()
          }]
        })
        .mockResolvedValueOnce({ // Get loyalty profile
          rows: [{
            customer_id: customerId,
            loyalty_tier: 'gold',
            total_pooled_deliveries: 25,
            co2_saved_kg: 150.5
          }]
        })
        .mockResolvedValueOnce({ // Get audit logs
          rows: [{
            user_id: customerId,
            event_type: 'delivery_created',
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 Chrome/91.0',
            timestamp: new Date()
          }]
        })
        .mockResolvedValueOnce({}) // Update to completed
        .mockResolvedValue({}); // Audit logging

      // Submit GDPR request
      const requestId = await gdprComplianceService.submitGDPRRequest({
        customerId,
        requestType: 'access',
        contactEmail: 'customer@example.com',
        reason: 'I want to access my data'
      });

      expect(requestId).toMatch(/^GDPR-/);

      // Process the request
      const result = await gdprComplianceService.processGDPRRequest(requestId);

      // Verify the result contains masked data
      expect(result).toHaveProperty('deliveries');
      expect(result).toHaveProperty('loyaltyProfile');
      expect(result).toHaveProperty('auditLogs');

      // Check that sensitive data is properly masked
      expect(result.deliveries[0].pickup_address).toBe('123 *** Delhi');
      expect(result.deliveries[0].delivery_address).toBe('456 *** Gurgaon');
      
      // Verify audit logging was called multiple times
      expect(mockClient.query).toHaveBeenCalledTimes(10);
    });
  });

  describe('Complete GDPR Data Deletion Workflow', () => {
    it('should handle complete data deletion request with audit trail', async () => {
      const customerId = 'customer-delete-123';
      
      // Mock GDPR request submission and processing
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Customer exists
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No duplicate requests
        .mockResolvedValueOnce({}) // Insert GDPR request
        .mockResolvedValueOnce({ // Get GDPR request for processing
          rows: [{
            id: 'GDPR-DELETE-123',
            customer_id: customerId,
            request_type: 'deletion',
            status: 'pending',
            requested_at: new Date()
          }]
        })
        .mockResolvedValueOnce({}) // Update to processing
        .mockResolvedValueOnce({}) // BEGIN transaction
        .mockResolvedValueOnce({ rowCount: 2 }) // Update deliveries
        .mockResolvedValueOnce({ rowCount: 1 }) // Delete loyalty profile
        .mockResolvedValueOnce({ rowCount: 5 }) // Anonymize audit logs
        .mockResolvedValueOnce({ rowCount: 1 }) // Delete user sessions
        .mockResolvedValueOnce({}) // COMMIT transaction
        .mockResolvedValueOnce({}) // Update to completed
        .mockResolvedValue({}); // Audit logging

      // Submit deletion request
      const requestId = await gdprComplianceService.submitGDPRRequest({
        customerId,
        requestType: 'deletion',
        contactEmail: 'customer@example.com',
        reason: 'I want my data deleted'
      });

      // Process the request
      await gdprComplianceService.processGDPRRequest(requestId);

      // Verify transaction was used
      const queries = mockClient.query.mock.calls.map(call => call[0]);
      expect(queries).toContain('BEGIN');
      expect(queries).toContain('COMMIT');

      // Verify anonymization queries were executed
      expect(queries.some(query => 
        query.includes('UPDATE deliveries') && query.includes('customer_id = NULL')
      )).toBe(true);
      
      expect(queries.some(query => 
        query.includes('DELETE FROM customer_loyalty_profiles')
      )).toBe(true);
    });
  });

  describe('Data Masking Integration', () => {
    it('should mask sensitive data in various contexts', () => {
      const sensitiveData = {
        customer: {
          email: 'john.doe@example.com',
          phone: '+919876543210',
          address: '123 Main Street, New Delhi'
        },
        vehicle: {
          plateNumber: 'DL01AB1234',
          driverId: 'driver-12345'
        },
        system: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      // Test API response masking
      const maskedApiResponse = dataMaskingService.maskApiResponse(sensitiveData);
      expect(maskedApiResponse.customer.email).toBe('jo***@example.com');
      expect(maskedApiResponse.vehicle.plateNumber).toBe('DL***34');
      expect(maskedApiResponse.system.ipAddress).toBe('192.***.***100');

      // Test log data masking
      const logMessage = 'User login: john.doe@example.com from IP 192.168.1.100';
      const maskedLog = dataMaskingService.maskLogData(logMessage, sensitiveData);
      expect(maskedLog.message).toContain('jo***@example.com');
      expect(maskedLog.message).toContain('192.***.***100');

      // Test database result masking
      const dbResult = {
        rows: [
          { email: 'user@test.com', plate_number: 'MH12CD5678' },
          { email: 'admin@test.com', plate_number: 'DL02EF9012' }
        ]
      };
      const maskedDbResult = dataMaskingService.maskDatabaseResult(dbResult);
      expect(maskedDbResult.rows[0].email).toBe('us***@test.com');
      expect(maskedDbResult.rows[0].plate_number).toBe('MH***78');
    });

    it('should not mask data in production environment', () => {
      const prodMaskingService = new DataMaskingService({
        enabled: true,
        environment: 'production',
        logMasking: true,
        databaseMasking: true,
        apiResponseMasking: true
      });

      const sensitiveData = { email: 'test@example.com' };
      const result = prodMaskingService.maskSensitiveData(sensitiveData);

      expect(result.email).toBe('test@example.com'); // Not masked in production
    });
  });

  describe('Automated Data Purging Integration', () => {
    it('should execute scheduled data purging with proper audit trail', async () => {
      // Mock successful purging for all tables
      mockClient.query.mockResolvedValue({ rowCount: 15 });

      await dataPrivacyService.scheduleDataPurging();

      // Verify purging was executed for all default retention policies
      const deleteQueries = mockClient.query.mock.calls.filter(call => 
        call[0].includes('DELETE FROM')
      );
      expect(deleteQueries.length).toBe(7); // Number of default retention policies

      // Verify audit logging was called for each table and summary
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'data_purge',
          'data_privacy',
          expect.any(String), // description
          expect.any(String), // entity_type
          null, // entity_id
          null, // user_id
          null, // session_id
          null, // ip_address
          null, // user_agent
          null, // old_values
          null, // new_values
          expect.any(String), // metadata
          expect.any(String), // severity
          'success' // status
        ])
      );
    });

    it('should handle partial failures during data purging', async () => {
      // Mock mixed success/failure results
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 10 }) // audit_logs success
        .mockRejectedValueOnce(new Error('Table locked')) // user_sessions failure
        .mockResolvedValue({ rowCount: 5 }); // remaining tables success

      await dataPrivacyService.scheduleDataPurging();

      // Should continue processing despite individual failures
      expect(mockClient.query).toHaveBeenCalledTimes(15); // 7 purge + 8 audit logs (7 individual + 1 summary)
    });
  });

  describe('Data Retention Status Integration', () => {
    it('should provide comprehensive retention status across all tables', async () => {
      // Mock retention status queries
      mockClient.query.mockResolvedValue({
        rows: [{ total_records: '1000', expired_records: '150' }]
      });

      const status = await dataPrivacyService.getDataRetentionStatus();

      expect(status).toHaveLength(7); // Default retention policies
      expect(status[0]).toHaveProperty('tableName');
      expect(status[0]).toHaveProperty('retentionPeriodMonths');
      expect(status[0]).toHaveProperty('totalRecords', 1000);
      expect(status[0]).toHaveProperty('expiredRecords', 150);
      expect(status[0]).toHaveProperty('cutoffDate');

      // Verify queries were made for all tables
      expect(mockClient.query).toHaveBeenCalledTimes(7);
    });
  });

  describe('GDPR Compliance Reporting Integration', () => {
    it('should generate comprehensive compliance report', async () => {
      // Mock various statistics
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { request_type: 'access', status: 'completed', count: '15', avg_processing_days: '3.2' },
          { request_type: 'deletion', status: 'completed', count: '5', avg_processing_days: '5.8' }
        ]
      });

      // Mock data retention status
      const mockRetentionStatus = [
        { tableName: 'audit_logs', totalRecords: 5000, expiredRecords: 500 },
        { tableName: 'deliveries', totalRecords: 10000, expiredRecords: 1200 }
      ];
      jest.spyOn(dataPrivacyService, 'getDataRetentionStatus')
        .mockResolvedValue(mockRetentionStatus);

      const report = await gdprComplianceService.generateComplianceReport();

      expect(report).toHaveProperty('reportGeneratedAt');
      expect(report).toHaveProperty('gdprRequestStatistics');
      expect(report).toHaveProperty('dataRetentionStatus', mockRetentionStatus);
      expect(report).toHaveProperty('auditLogStatistics');
      expect(report).toHaveProperty('complianceConfiguration');
      expect(report).toHaveProperty('dataSubjectRights');

      // Verify statistics are properly formatted
      expect(report.gdprRequestStatistics).toHaveLength(2);
      expect(report.gdprRequestStatistics[0].request_type).toBe('access');
      expect(report.gdprRequestStatistics[1].request_type).toBe('deletion');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database connection failure
      mockDbService.getClient.mockRejectedValue(new Error('Database connection failed'));

      await expect(dataPrivacyService.executeDataPurging())
        .rejects.toThrow('Database connection failed');

      // Verify error was logged (audit logger should handle errors gracefully)
      expect(mockDbService.getClient).toHaveBeenCalled();
    });

    it('should handle partial GDPR request processing failures', async () => {
      const customerId = 'customer-error-test';
      
      // Mock successful submission but failed processing
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Customer exists
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No duplicates
        .mockResolvedValueOnce({}) // Insert request
        .mockResolvedValueOnce({ // Get request
          rows: [{
            id: 'GDPR-ERROR-123',
            customer_id: customerId,
            request_type: 'access',
            status: 'pending',
            requested_at: new Date()
          }]
        })
        .mockResolvedValueOnce({}) // Update to processing
        .mockRejectedValueOnce(new Error('Data access failed')) // Processing fails
        .mockResolvedValueOnce({}) // Update to rejected
        .mockResolvedValue({}); // Audit logging

      // Submit request successfully
      const requestId = await gdprComplianceService.submitGDPRRequest({
        customerId,
        requestType: 'access',
        contactEmail: 'test@example.com'
      });

      // Processing should fail but be handled gracefully
      await expect(gdprComplianceService.processGDPRRequest(requestId))
        .rejects.toThrow('Data access failed');

      // Verify error was logged and status updated
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE gdpr_requests SET status = $1, processed_at = $2, status_message = $3 WHERE id = $4',
        ['rejected', expect.any(Date), 'Data access failed', requestId]
      );
    });
  });
});