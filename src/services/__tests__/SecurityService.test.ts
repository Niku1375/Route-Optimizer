import { SecurityService, AuditLogEntry, SecurityEvent, DataMaskingRule } from '../SecurityService';
import { DatabaseService } from '../../database/DatabaseService';
import Logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../database/DatabaseService');
jest.mock('../../utils/logger');

describe('SecurityService', () => {
  let securityService: SecurityService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockDatabaseService.query = jest.fn();
    securityService = new SecurityService(mockDatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Encryption', () => {
    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive-data-123';
      
      const encrypted = securityService.encryptData(plaintext);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      
      const decrypted = securityService.decryptData(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should generate different encrypted values for same plaintext', () => {
      const plaintext = 'test-data';
      
      const encrypted1 = securityService.encryptData(plaintext);
      const encrypted2 = securityService.encryptData(plaintext);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    test('should throw error for invalid decryption data', () => {
      const invalidData = {
        encrypted: 'invalid',
        iv: 'invalid',
        tag: 'invalid'
      };
      
      expect(() => securityService.decryptData(invalidData)).toThrow('Data decryption failed');
    });
  });

  describe('Password Hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'test-password-123';
      
      const hash = await securityService.hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should verify password correctly', async () => {
      const password = 'test-password-123';
      const hash = await securityService.hashPassword(password);
      
      const isValid = await securityService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await securityService.verifyPassword('wrong-password', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    test('should log audit event successfully', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const auditEntry: Omit<AuditLogEntry, 'id' | 'timestamp'> = {
        userId: 'user-123',
        action: 'login',
        resource: '/api/auth/login',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        details: { method: 'oauth' },
        severity: 'low'
      };
      
      await securityService.logAuditEvent(auditEntry);
      
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'user-123',
          'login',
          '/api/auth/login',
          expect.any(Date), // timestamp
          '192.168.1.1',
          'Mozilla/5.0',
          true,
          JSON.stringify({ method: 'oauth' }),
          'low'
        ])
      );
    });

    test('should handle audit logging errors gracefully', async () => {
      mockDatabaseService.query.mockRejectedValueOnce(new Error('Database error'));
      
      const auditEntry: Omit<AuditLogEntry, 'id' | 'timestamp'> = {
        action: 'test',
        resource: '/test',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        success: false,
        severity: 'low'
      };
      
      // Should not throw error
      await expect(securityService.logAuditEvent(auditEntry)).resolves.not.toThrow();
      expect(Logger.error).toHaveBeenCalledWith('Failed to log audit event:', expect.any(Error));
    });
  });

  describe('Security Event Logging', () => {
    test('should log security event successfully', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const securityEvent: SecurityEvent = {
        type: 'unauthorized_access',
        severity: 'high',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
        details: { endpoint: '/api/admin' }
      };
      
      await securityService.logSecurityEvent(securityEvent);
      
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_events'),
        expect.arrayContaining([
          expect.any(String), // id
          'unauthorized_access',
          'high',
          'user-123',
          '192.168.1.1',
          securityEvent.timestamp,
          JSON.stringify({ endpoint: '/api/admin' })
        ])
      );
    });

    test('should trigger immediate alert for critical events', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const criticalEvent: SecurityEvent = {
        type: 'data_breach',
        severity: 'critical',
        ipAddress: '192.168.1.1',
        timestamp: new Date(),
        details: { affected_records: 1000 }
      };
      
      await securityService.logSecurityEvent(criticalEvent);
      
      expect(Logger.error).toHaveBeenCalledWith('CRITICAL SECURITY EVENT', expect.any(Object));
    });
  });

  describe('Data Masking', () => {
    test('should mask data according to rules', () => {
      const data = {
        email: 'user@example.com',
        phone: '1234567890',
        ssn: '123-45-6789',
        name: 'John Doe'
      };
      
      const rules: DataMaskingRule[] = [
        { field: 'email', maskType: 'partial' },
        { field: 'phone', maskType: 'full' },
        { field: 'ssn', maskType: 'hash' },
        { field: 'name', maskType: 'redact' }
      ];
      
      const maskedData = securityService.maskSensitiveData(data, rules);
      
      expect(maskedData.email).toMatch(/^us.*om$/); // Partial masking
      expect(maskedData.phone).toBe('**********'); // Full masking
      expect(maskedData.ssn).toMatch(/^[a-f0-9]{8}$/); // Hash
      expect(maskedData.name).toBe('[REDACTED]'); // Redacted
    });

    test('should handle non-object data', () => {
      const rules: DataMaskingRule[] = [{ field: 'test', maskType: 'full' }];
      
      expect(securityService.maskSensitiveData('string', rules)).toBe('string');
      expect(securityService.maskSensitiveData(123, rules)).toBe(123);
      expect(securityService.maskSensitiveData(null, rules)).toBe(null);
    });
  });

  describe('Token Generation', () => {
    test('should generate secure random tokens', () => {
      const token1 = securityService.generateSecureToken();
      const token2 = securityService.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    test('should generate tokens of specified length', () => {
      const token = securityService.generateSecureToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });
  });

  describe('IP Whitelisting', () => {
    test('should validate IP against whitelist', () => {
      const whitelist = ['192.168.1.1', '10.0.0.0/8', '*'];
      
      expect(securityService.isIPWhitelisted('192.168.1.1', whitelist)).toBe(true);
      expect(securityService.isIPWhitelisted('10.1.1.1', whitelist)).toBe(true); // Wildcard
      expect(securityService.isIPWhitelisted('172.16.1.1', whitelist)).toBe(true); // Wildcard
    });

    test('should reject non-whitelisted IPs', () => {
      const whitelist = ['192.168.1.1'];
      
      expect(securityService.isIPWhitelisted('192.168.1.2', whitelist)).toBe(false);
      expect(securityService.isIPWhitelisted('10.0.0.1', whitelist)).toBe(false);
    });
  });

  describe('Suspicious Activity Detection', () => {
    test('should detect multiple failed login attempts', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '6' }], rowCount: 1 }) // Failed attempts
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Recent IPs
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 }); // Rapid calls
      
      const isSuspicious = await securityService.detectSuspiciousActivity('user-123', '192.168.1.1');
      expect(isSuspicious).toBe(true);
    });

    test('should detect unusual IP patterns', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }) // Failed attempts
        .mockResolvedValueOnce({ rows: [
          { ip_address: '192.168.1.1' },
          { ip_address: '192.168.1.2' },
          { ip_address: '192.168.1.3' },
          { ip_address: '192.168.1.4' }
        ], rowCount: 4 }) // Recent IPs
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 }); // Rapid calls
      
      const isSuspicious = await securityService.detectSuspiciousActivity('user-123', '192.168.1.1');
      expect(isSuspicious).toBe(true);
    });

    test('should detect rapid API calls', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }) // Failed attempts
        .mockResolvedValueOnce({ rows: [{ ip_address: '192.168.1.1' }], rowCount: 1 }) // Recent IPs
        .mockResolvedValueOnce({ rows: [{ count: '150' }], rowCount: 1 }); // Rapid calls
      
      const isSuspicious = await securityService.detectSuspiciousActivity('user-123', '192.168.1.1');
      expect(isSuspicious).toBe(true);
    });

    test('should not flag normal activity as suspicious', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }) // Failed attempts
        .mockResolvedValueOnce({ rows: [{ ip_address: '192.168.1.1' }], rowCount: 1 }) // Recent IPs
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 }); // Rapid calls
      
      const isSuspicious = await securityService.detectSuspiciousActivity('user-123', '192.168.1.1');
      expect(isSuspicious).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      mockDatabaseService.query.mockRejectedValueOnce(new Error('Database error'));
      
      const isSuspicious = await securityService.detectSuspiciousActivity('user-123', '192.168.1.1');
      expect(isSuspicious).toBe(false);
      expect(Logger.error).toHaveBeenCalledWith('Error detecting suspicious activity:', expect.any(Error));
    });
  });

  describe('Security Metrics', () => {
    test('should return security metrics', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 }) // Failed logins
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 }) // Security events
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }) // Suspicious activity
        .mockResolvedValueOnce({ rows: [{ count: '100' }], rowCount: 1 }); // Audit log count
      
      const metrics = await securityService.getSecurityMetrics();
      
      expect(metrics).toEqual({
        failedLogins: 5,
        securityEvents: 3,
        suspiciousActivity: 2,
        auditLogCount: 100
      });
    });

    test('should handle database errors in metrics', async () => {
      mockDatabaseService.query.mockRejectedValue(new Error('Database error'));
      
      const metrics = await securityService.getSecurityMetrics();
      
      expect(metrics).toEqual({
        failedLogins: 0,
        securityEvents: 0,
        suspiciousActivity: 0,
        auditLogCount: 0
      });
    });
  });
});