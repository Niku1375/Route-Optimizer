import { GDPRComplianceService, GDPRRequestSubmission } from '../GDPRComplianceService';
import { DataPrivacyService } from '../DataPrivacyService';
import { DataMaskingService } from '../DataMaskingService';
import { DatabaseService } from '../../database/DatabaseService';
import { AuditLogger } from '../../utils/AuditLogger';

// Mock dependencies
jest.mock('../DataPrivacyService');
jest.mock('../DataMaskingService');
jest.mock('../../database/DatabaseService');
jest.mock('../../utils/AuditLogger');
jest.mock('../../utils/Logger');

describe('GDPRComplianceService', () => {
  let gdprService: GDPRComplianceService;
  let mockDbService: jest.Mocked<DatabaseService>;
  let mockDataPrivacyService: jest.Mocked<DataPrivacyService>;
  let mockDataMaskingService: jest.Mocked<DataMaskingService>;
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

    // Setup mock data privacy service
    mockDataPrivacyService = {
      processGDPRRequest: jest.fn(),
      getDataRetentionStatus: jest.fn()
    } as any;

    // Setup mock data masking service
    mockDataMaskingService = {} as any;

    // Setup mock audit logger
    mockAuditLogger = {
      logDataPrivacyEvent: jest.fn().mockResolvedValue(undefined),
      getAuditLogStats: jest.fn().mockResolvedValue([])
    } as any;

    // Mock AuditLogger.getInstance()
    (AuditLogger.getInstance as jest.Mock).mockReturnValue(mockAuditLogger);

    gdprService = new GDPRComplianceService(
      mockDbService,
      mockDataPrivacyService,
      mockDataMaskingService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitGDPRRequest', () => {
    const validSubmission: GDPRRequestSubmission = {
      customerId: 'customer-123',
      requestType: 'access',
      contactEmail: 'customer@example.com',
      reason: 'I want to see my data'
    };

    it('should successfully submit a valid GDPR request', async () => {
      // Mock customer exists
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Customer exists
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No duplicate requests
        .mockResolvedValueOnce({}); // Insert request

      const requestId = await gdprService.submitGDPRRequest(validSubmission);

      expect(requestId).toMatch(/^GDPR-/);
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'gdpr_request_submitted',
        customerId: validSubmission.customerId,
        requestId: expect.any(String),
        requestType: validSubmission.requestType,
        success: true
      });
    });

    it('should reject request for non-existent customer', async () => {
      // Mock customer doesn't exist
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await expect(gdprService.submitGDPRRequest(validSubmission))
        .rejects.toThrow('Customer not found in system');
    });

    it('should reject duplicate pending requests', async () => {
      // Mock customer exists but has pending request
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Customer exists
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Duplicate request exists

      await expect(gdprService.submitGDPRRequest(validSubmission))
        .rejects.toThrow('A access request is already pending for this customer');
    });

    it('should handle different request types', async () => {
      const deletionRequest: GDPRRequestSubmission = {
        ...validSubmission,
        requestType: 'deletion',
        reason: 'I want my data deleted'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({});

      const requestId = await gdprService.submitGDPRRequest(deletionRequest);

      expect(requestId).toMatch(/^GDPR-/);
      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'gdpr_request_submitted',
        customerId: deletionRequest.customerId,
        requestId: expect.any(String),
        requestType: 'deletion',
        success: true
      });
    });
  });

  describe('processGDPRRequest', () => {
    const mockRequestId = 'GDPR-TEST-123';
    const mockRequest = {
      id: mockRequestId,
      customerId: 'customer-123',
      requestType: 'access' as const,
      status: 'pending' as const,
      requestedAt: new Date()
    };

    it('should successfully process a pending GDPR request', async () => {
      // Mock get request
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockRequest] }) // Get request
        .mockResolvedValueOnce({}) // Update to processing
        .mockResolvedValueOnce({}); // Update to completed

      // Mock data privacy service response
      const mockResult = { data: 'processed data' };
      mockDataPrivacyService.processGDPRRequest.mockResolvedValue(mockResult);

      const result = await gdprService.processGDPRRequest(mockRequestId);

      expect(result).toBe(mockResult);
      expect(mockDataPrivacyService.processGDPRRequest).toHaveBeenCalledWith(mockRequest);
      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'gdpr_request_processed',
        customerId: mockRequest.customerId,
        requestId: mockRequestId,
        requestType: mockRequest.requestType,
        success: true
      });
    });

    it('should handle non-existent request', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(gdprService.processGDPRRequest(mockRequestId))
        .rejects.toThrow(`GDPR request ${mockRequestId} not found`);
    });

    it('should handle request not in pending status', async () => {
      const completedRequest = { ...mockRequest, status: 'completed' };
      mockClient.query.mockResolvedValueOnce({ rows: [completedRequest] });

      await expect(gdprService.processGDPRRequest(mockRequestId))
        .rejects.toThrow(`GDPR request ${mockRequestId} is not in pending status`);
    });

    it('should handle processing errors', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockRequest] })
        .mockResolvedValueOnce({}) // Update to processing
        .mockResolvedValueOnce({}); // Update to rejected

      const error = new Error('Processing failed');
      mockDataPrivacyService.processGDPRRequest.mockRejectedValue(error);

      await expect(gdprService.processGDPRRequest(mockRequestId))
        .rejects.toThrow('Processing failed');

      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'gdpr_request_failed',
        customerId: mockRequest.customerId,
        requestId: mockRequestId,
        requestType: mockRequest.requestType,
        error: 'Processing failed',
        success: false
      });
    });
  });

  describe('getGDPRRequestStatus', () => {
    it('should return request status for existing request', async () => {
      const mockDbRow = {
        id: 'GDPR-TEST-123',
        status: 'processing',
        requested_at: new Date('2024-01-01'),
        processed_at: null,
        request_type: 'access'
      };

      mockClient.query.mockResolvedValueOnce({ rows: [mockDbRow] });

      const status = await gdprService.getGDPRRequestStatus('GDPR-TEST-123');

      expect(status).toEqual({
        id: 'GDPR-TEST-123',
        status: 'processing',
        submittedAt: mockDbRow.requested_at,
        processedAt: null,
        estimatedCompletionDate: expect.any(Date),
        statusMessage: 'Your access request is currently being processed.'
      });
    });

    it('should return null for non-existent request', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const status = await gdprService.getGDPRRequestStatus('NON-EXISTENT');

      expect(status).toBeNull();
    });
  });

  describe('getCustomerGDPRRequests', () => {
    it('should return all requests for a customer', async () => {
      const mockRequests = [
        {
          id: 'GDPR-1',
          status: 'completed',
          requested_at: new Date('2024-01-01'),
          processed_at: new Date('2024-01-15'),
          request_type: 'access'
        },
        {
          id: 'GDPR-2',
          status: 'pending',
          requested_at: new Date('2024-02-01'),
          processed_at: null,
          request_type: 'deletion'
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockRequests });

      const requests = await gdprService.getCustomerGDPRRequests('customer-123');

      expect(requests).toHaveLength(2);
      expect(requests[0].id).toBe('GDPR-1');
      expect(requests[0].status).toBe('completed');
      expect(requests[1].id).toBe('GDPR-2');
      expect(requests[1].status).toBe('pending');
    });

    it('should return empty array for customer with no requests', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const requests = await gdprService.getCustomerGDPRRequests('customer-456');

      expect(requests).toEqual([]);
    });
  });

  describe('getDataSubjectRights', () => {
    it('should return supported data subject rights', () => {
      const rights = gdprService.getDataSubjectRights();

      expect(rights).toEqual({
        rightToAccess: true,
        rightToRectification: true,
        rightToErasure: true,
        rightToPortability: true,
        rightToRestriction: false,
        rightToObject: false
      });
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate comprehensive compliance report', async () => {
      const mockGdprStats = [
        { request_type: 'access', status: 'completed', count: '10', avg_processing_days: '5.5' },
        { request_type: 'deletion', status: 'completed', count: '3', avg_processing_days: '7.2' }
      ];

      const mockRetentionStatus = [
        { tableName: 'audit_logs', totalRecords: 1000, expiredRecords: 100 }
      ];

      const mockAuditStats = [
        { event_category: 'data_privacy', severity: 'info', count: 25 }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockGdprStats });
      mockDataPrivacyService.getDataRetentionStatus.mockResolvedValue(mockRetentionStatus);
      mockAuditLogger.getAuditLogStats.mockResolvedValue(mockAuditStats);

      const report = await gdprService.generateComplianceReport();

      expect(report).toHaveProperty('reportGeneratedAt');
      expect(report).toHaveProperty('gdprRequestStatistics', mockGdprStats);
      expect(report).toHaveProperty('dataRetentionStatus', mockRetentionStatus);
      expect(report).toHaveProperty('auditLogStatistics', mockAuditStats);
      expect(report).toHaveProperty('complianceConfiguration');
      expect(report).toHaveProperty('dataSubjectRights');
    });
  });

  describe('initializeGDPRTables', () => {
    it('should create GDPR tables and indexes', async () => {
      mockClient.query.mockResolvedValue({});

      await gdprService.initializeGDPRTables();

      expect(mockClient.query).toHaveBeenCalledTimes(2); // CREATE TABLE and CREATE INDEX
      
      const createTableCall = mockClient.query.mock.calls[0][0];
      expect(createTableCall).toContain('CREATE TABLE IF NOT EXISTS gdpr_requests');
      expect(createTableCall).toContain('request_type VARCHAR(20) NOT NULL CHECK');
      expect(createTableCall).toContain('status VARCHAR(20) NOT NULL DEFAULT \'pending\'');

      const createIndexCall = mockClient.query.mock.calls[1][0];
      expect(createIndexCall).toContain('CREATE INDEX IF NOT EXISTS idx_gdpr_requests_customer');
    });
  });

  describe('request ID generation', () => {
    it('should generate unique request IDs', () => {
      const service = gdprService as any;
      const id1 = service.generateRequestId();
      const id2 = service.generateRequestId();

      expect(id1).toMatch(/^GDPR-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(id2).toMatch(/^GDPR-[A-Z0-9]+-[A-Z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('status messages', () => {
    it('should return appropriate status messages', () => {
      const service = gdprService as any;

      expect(service.getStatusMessage('pending', 'access'))
        .toBe('Your access request has been received and is pending review.');
      
      expect(service.getStatusMessage('processing', 'deletion'))
        .toBe('Your deletion request is currently being processed.');
      
      expect(service.getStatusMessage('completed', 'portability'))
        .toBe('Your portability request has been completed successfully.');
      
      expect(service.getStatusMessage('rejected', 'rectification'))
        .toBe('Your rectification request has been rejected. Please contact support for more information.');
    });
  });

  describe('email notifications', () => {
    it('should log confirmation email sending', async () => {
      const service = gdprService as any;
      
      await service.sendConfirmationEmail('test@example.com', 'GDPR-123', 'access');

      expect(mockAuditLogger.logDataPrivacyEvent).toHaveBeenCalledWith({
        action: 'gdpr_confirmation_email_sent',
        requestId: 'GDPR-123',
        requestType: 'access',
        success: true
      });
    });
  });
});