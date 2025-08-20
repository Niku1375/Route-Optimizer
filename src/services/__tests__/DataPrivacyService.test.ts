import { DataPrivacyService, GDPRRequest } from '../DataPrivacyService';
import { DatabaseService } from '../../database/DatabaseService';
import { AuditLogger } from '../../utils/AuditLogger';

// Mock dependencies
jest.mock('../../database/DatabaseService');
jest.mock('../../utils/AuditLogger');
jest.mock('../../utils/Logger');

describe('DataPrivacyService', () => {
  let dataPrivacyService: DataPrivacyService;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockClient: any;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

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

    // Setup mock audit logger
    mockAuditLogger = {
      logDataPrivacyEvent: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock AuditLogger.getInstance()
    (AuditLogger.getInstance as jest.Mock).mockReturnValue(mockAuditLogger);

    dataPrivacyService = new DataPrivacyService(mockDbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeDataPurging', () => {
    it('should successfully purge data from all tables', async () => {
      // Mock successful deletion results
      mockClient.query.mockResolvedValue({ rowCount: 10 });

      const results = await dataPrivacyService.executeDataPurging();

      expect(results).toHaveLength(7); // Number of default retention policies
      expect(results.every(result => result.success)).toBe(true);
      expect(results.reduce((sum, result) => sum + result.recordsDeleted, 0)).toBe(70); // 10 * 7 tables
      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledTimes(7);
    });

    it('should handle errors during data purging', async () => {
      // Mock error for one table
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 5 }) // audit_logs success
        .mockRejectedValueOnce(new Error('Database error')) // user_sessions error
        .mockResolvedValue({ rowCount: 3 }); // remaining tables success

      const results = await dataPrivacyService.executeDataPurging();

      expect(results).toHaveLength(7);
      expect(results.filter(result => result.success)).toHaveLength(6);
      expect(results.filter(result => !result.success)).toHaveLength(1);
      
      const failedResult = results.find(result => !result.success);
      expect(failedResult?.tableName).toBe('user_sessions');
      expect(failedResult?.error).toBe('Database error');
    });

    it('should apply correct retention periods and conditions', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 5 });

      await dataPrivacyService.executeDataPurging();

      // Check that queries were called with correct parameters
      const calls = mockClient.query.mock.calls;
      
      // Check audit_logs query (12 months retention)
      const auditLogsCall = calls.find(call => call[0].includes('audit_logs'));
      expect(auditLogsCall).toBeDefined();
      expect(auditLogsCall[0]).toContain('DELETE FROM audit_logs WHERE created_at < $1');
      
      // Check user_sessions query (3 months retention with condition)
      const userSessionsCall = calls.find(call => call[0].includes('user_sessions'));
      expect(userSessionsCall).toBeDefined();
      expect(userSessionsCall[0]).toContain('AND is_active = $2');
      expect(userSessionsCall[1]).toContain(false); // is_active condition
    });
  });

  describe('processGDPRRequest', () => {
    const mockCustomerId = 'customer-123';

    describe('handleDataAccessRequest', () => {
      it('should return customer data with masked sensitive information', async () => {
        const request: GDPRRequest = {
          id: 'req-123',
          customerId: mockCustomerId,
          requestType: 'access',
          status: 'pending',
          requestedAt: new Date()
        };

        // Mock database responses
        mockClient.query
          .mockResolvedValueOnce({ // deliveries query
            rows: [{
              id: 'delivery-1',
              customer_id: mockCustomerId,
              pickup_address: '123 Main Street, Delhi',
              delivery_address: '456 Oak Avenue, Gurgaon'
            }]
          })
          .mockResolvedValueOnce({ // loyalty profile query
            rows: [{
              customer_id: mockCustomerId,
              loyalty_tier: 'gold',
              total_pooled_deliveries: 25
            }]
          })
          .mockResolvedValueOnce({ // audit logs query
            rows: [{
              user_id: mockCustomerId,
              event_type: 'delivery_created',
              timestamp: new Date()
            }]
          });

        const result = await dataPrivacyService.processGDPRRequest(request);

        expect(result).toHaveProperty('deliveries');
        expect(result).toHaveProperty('loyaltyProfile');
        expect(result).toHaveProperty('auditLogs');
        
        // Check that sensitive data is masked
        expect(result.deliveries[0].pickup_address).toBe('123 *** Gurgaon');
        expect(result.deliveries[0].delivery_address).toBe('456 *** Gurgaon');
        
        expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
          action: 'gdpr_data_access',
          customerId: mockCustomerId,
          requestId: 'req-123',
          dataReturned: ['deliveries', 'loyaltyProfile', 'auditLogs']
        });
      });
    });

    describe('handleDataDeletionRequest', () => {
      it('should anonymize customer data instead of hard deletion', async () => {
        const request: GDPRRequest = {
          id: 'req-456',
          customerId: mockCustomerId,
          requestType: 'deletion',
          status: 'pending',
          requestedAt: new Date()
        };

        mockClient.query.mockResolvedValue({ rowCount: 1 });

        await dataPrivacyService.processGDPRRequest(request);

        // Verify transaction was used
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

        // Verify anonymization queries
        const calls = mockClient.query.mock.calls;
        const deliveriesUpdate = calls.find(call => 
          call[0].includes('UPDATE deliveries') && call[0].includes('customer_id = NULL')
        );
        expect(deliveriesUpdate).toBeDefined();

        const loyaltyDelete = calls.find(call => 
          call[0].includes('DELETE FROM customer_loyalty_profiles')
        );
        expect(loyaltyDelete).toBeDefined();

        expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
          action: 'gdpr_data_deletion',
          customerId: mockCustomerId,
          requestId: 'req-456',
          success: true
        });
      });

      it('should rollback transaction on error', async () => {
        const request: GDPRRequest = {
          id: 'req-789',
          customerId: mockCustomerId,
          requestType: 'deletion',
          status: 'pending',
          requestedAt: new Date()
        };

        mockClient.query
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockRejectedValueOnce(new Error('Database error')); // First update fails

        await expect(dataPrivacyService.processGDPRRequest(request)).rejects.toThrow('Database error');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('handleDataPortabilityRequest', () => {
      it('should return data in portable JSON format', async () => {
        const request: GDPRRequest = {
          id: 'req-portability',
          customerId: mockCustomerId,
          requestType: 'portability',
          status: 'pending',
          requestedAt: new Date()
        };

        // Mock the access request data
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ id: 'delivery-1' }] })
          .mockResolvedValueOnce({ rows: [{ loyalty_tier: 'silver' }] })
          .mockResolvedValueOnce({ rows: [{ event_type: 'login' }] });

        const result = await dataPrivacyService.processGDPRRequest(request);

        expect(result).toHaveProperty('customerId', mockCustomerId);
        expect(result).toHaveProperty('exportedAt');
        expect(result).toHaveProperty('format', 'JSON');
        expect(result).toHaveProperty('data');

        expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
          action: 'gdpr_data_portability',
          customerId: mockCustomerId,
          requestId: 'req-portability',
          exportFormat: 'JSON'
        });
      });
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask different types of sensitive data correctly', () => {
      const testData = {
        pickup_address: '123 Main Street, New Delhi',
        delivery_address: '456 Oak Avenue, Gurgaon',
        customer_id: 'customer-12345',
        plate_number: 'DL01AB1234'
      };

      const maskedData = (dataPrivacyService as any).maskSensitiveData(testData, 'deliveries');

      expect(maskedData.pickup_address).toBe('123 *** Delhi');
      expect(maskedData.delivery_address).toBe('456 *** Gurgaon');
      expect(maskedData.plate_number).toBe('DL***34');
    });
  });

  describe('getDataRetentionStatus', () => {
    it('should return retention status for all tables', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ total_records: '100', expired_records: '25' }]
      });

      const status = await dataPrivacyService.getDataRetentionStatus();

      expect(status).toHaveLength(7); // Number of default retention policies
      expect(status[0]).toHaveProperty('tableName');
      expect(status[0]).toHaveProperty('retentionPeriodMonths');
      expect(status[0]).toHaveProperty('totalRecords', 100);
      expect(status[0]).toHaveProperty('expiredRecords', 25);
      expect(status[0]).toHaveProperty('cutoffDate');
    });
  });

  describe('scheduleDataPurging', () => {
    it('should execute scheduled purging and log results', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 5 });

      await dataPrivacyService.scheduleDataPurging();

      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'scheduled_data_purge',
        totalTablesProcessed: 7,
        totalRecordsDeleted: 35, // 5 * 7 tables
        success: true
      });
    });

    it('should handle errors during scheduled purging', async () => {
      mockClient.query.mockRejectedValue(new Error('Scheduled purge failed'));

      await dataPrivacyService.scheduleDataPurging();

      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'scheduled_data_purge',
        success: false,
        error: 'Scheduled purge failed'
      });
    });
  });

  describe('data masking functionality', () => {
    it('should apply partial masking correctly', () => {
      const service = dataPrivacyService as any;
      
      expect(service.partialMask('test@example.com', 'email')).toBe('te***@example.com');
      expect(service.partialMask('+919876543210', 'phone')).toBe('***-***-3210');
      expect(service.partialMask('DL01AB1234', 'plate_number')).toBe('DL***34');
      expect(service.partialMask('123 Main Street Delhi', 'address')).toBe('123 *** Delhi');
      expect(service.partialMask('John Doe', 'name')).toBe('J*** D***');
    });

    it('should create hash values for anonymization', () => {
      const service = dataPrivacyService as any;
      const hash1 = service.hashValue('test-value-123');
      const hash2 = service.hashValue('test-value-123');
      const hash3 = service.hashValue('different-value');
      
      expect(hash1).toBe(hash2); // Same input should produce same hash
      expect(hash1).not.toBe(hash3); // Different input should produce different hash
      expect(hash1).toMatch(/^\[HASH:[a-f0-9]+\]$/); // Should match hash format
    });
  });
});