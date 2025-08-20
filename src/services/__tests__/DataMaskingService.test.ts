import { DataMaskingService, MaskingConfig } from '../DataMaskingService';

describe('DataMaskingService', () => {
  let dataMaskingService: DataMaskingService;
  let mockConfig: MaskingConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      environment: 'development',
      logMasking: true,
      databaseMasking: true,
      apiResponseMasking: true
    };

    dataMaskingService = new DataMaskingService(mockConfig);
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive data in strings', () => {
      const testString = 'User email: john.doe@example.com, phone: +919876543210, plate: DL01AB1234';
      const masked = dataMaskingService.maskSensitiveData(testString);

      expect(masked).toContain('jo***@example.com');
      expect(masked).toContain('+9***-***-10');
      expect(masked).toContain('DL***34');
    });

    it('should mask sensitive data in objects', () => {
      const testObject = {
        user: {
          email: 'user@test.com',
          phone: '9876543210',
          address: '123 Main Street Delhi'
        },
        vehicle: {
          plateNumber: 'DL01AB1234',
          driverId: 'driver-12345'
        },
        metadata: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/91.0'
        }
      };

      const masked = dataMaskingService.maskSensitiveData(testObject);

      expect(masked.user.email).toBe('us***@test.com');
      expect(masked.user.phone).toBe('98***10');
      expect(masked.user.address).toBe('123 *** Delhi');
      expect(masked.vehicle.plateNumber).toBe('DL***34');
      expect(masked.vehicle.driverId).toBe('driv***345');
      expect(masked.metadata.ipAddress).toBe('192.***.***100');
    });

    it('should mask sensitive data in arrays', () => {
      const testArray = [
        { email: 'user1@test.com', phone: '9876543210' },
        { email: 'user2@test.com', phone: '9876543211' },
        'Contact: admin@company.com'
      ];

      const masked = dataMaskingService.maskSensitiveData(testArray);

      expect(masked[0].email).toBe('us***@test.com');
      expect(masked[1].email).toBe('us***@test.com');
      expect(masked[2]).toContain('ad***@company.com');
    });

    it('should not mask data when disabled', () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      const service = new DataMaskingService(disabledConfig);
      
      const testData = { email: 'test@example.com' };
      const result = service.maskSensitiveData(testData);

      expect(result.email).toBe('test@example.com');
    });

    it('should not mask data for production environment', () => {
      const prodConfig = { ...mockConfig, environment: 'production' };
      const service = new DataMaskingService(prodConfig);
      
      const testData = { email: 'test@example.com' };
      const result = service.maskSensitiveData(testData);

      expect(result.email).toBe('test@example.com');
    });
  });

  describe('maskLogData', () => {
    it('should mask sensitive data in log messages and data', () => {
      const logMessage = 'User login: john@example.com from IP 192.168.1.100';
      const logData = {
        userId: 'user-123',
        email: 'john@example.com',
        ipAddress: '192.168.1.100'
      };

      const result = dataMaskingService.maskLogData(logMessage, logData);

      expect(result.message).toContain('jo***@example.com');
      expect(result.message).toContain('192.***.***100');
      expect(result.data?.email).toBe('jo***@example.com');
      expect(result.data?.ipAddress).toBe('192.***.***100');
    });

    it('should not mask log data when log masking is disabled', () => {
      const config = { ...mockConfig, logMasking: false };
      const service = new DataMaskingService(config);
      
      const logMessage = 'User: test@example.com';
      const result = service.maskLogData(logMessage);

      expect(result.message).toBe('User: test@example.com');
    });
  });

  describe('maskApiResponse', () => {
    it('should mask sensitive data in API responses', () => {
      const apiResponse = {
        success: true,
        data: {
          users: [
            { id: 1, email: 'user1@test.com', phone: '9876543210' },
            { id: 2, email: 'user2@test.com', phone: '9876543211' }
          ]
        }
      };

      const masked = dataMaskingService.maskApiResponse(apiResponse);

      expect(masked.data.users[0].email).toBe('us***@test.com');
      expect(masked.data.users[1].email).toBe('us***@test.com');
    });

    it('should not mask API responses when disabled', () => {
      const config = { ...mockConfig, apiResponseMasking: false };
      const service = new DataMaskingService(config);
      
      const response = { email: 'test@example.com' };
      const result = service.maskApiResponse(response);

      expect(result.email).toBe('test@example.com');
    });
  });

  describe('maskDatabaseResult', () => {
    it('should mask sensitive data in database results', () => {
      const dbResult = {
        rows: [
          { id: 1, email: 'user@test.com', plate_number: 'DL01AB1234' },
          { id: 2, email: 'admin@test.com', plate_number: 'DL02CD5678' }
        ]
      };

      const masked = dataMaskingService.maskDatabaseResult(dbResult);

      expect(masked.rows[0].email).toBe('us***@test.com');
      expect(masked.rows[0].plate_number).toBe('DL***34');
      expect(masked.rows[1].email).toBe('ad***@test.com');
      expect(masked.rows[1].plate_number).toBe('DL***78');
    });
  });

  describe('specific masking functions', () => {
    it('should mask email addresses correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.maskEmail('john@example.com')).toBe('jo***@example.com');
      expect(service.maskEmail('a@test.com')).toBe('**@test.com');
      expect(service.maskEmail('admin@company.co.in')).toBe('ad***@company.co.in');
    });

    it('should mask phone numbers correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.maskPhone('9876543210')).toBe('98***10');
      expect(service.maskPhone('+91-9876-543210')).toBe('+9***-***-10');
      expect(service.maskPhone('91 9876 543210')).toBe('91***10');
    });

    it('should mask plate numbers correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.maskPlateNumber('DL01AB1234')).toBe('DL**AB****');
      expect(service.maskPlateNumber('MH12CD5678')).toBe('MH**CD****');
      expect(service.maskPlateNumber('ABC123')).toBe('AB***3');
    });

    it('should mask IP addresses correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.maskIPAddress('192.168.1.100')).toBe('192.***.***100');
      expect(service.maskIPAddress('10.0.0.1')).toBe('10.***.***1');
    });

    it('should mask addresses correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.maskAddress('123 Main Street Delhi')).toBe('123 *** Delhi');
      expect(service.maskAddress('Flat 4B, Tower 2, Sector 18, Noida')).toBe('Flat *** Noida');
      expect(service.maskAddress('Short')).toBe('*** ***');
    });

    it('should mask UUIDs correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.maskUUID('123e4567-e89b-12d3-a456-426614174000')).toBe('123e-****-****-****-4000');
      expect(service.maskUUID('abcd1234efgh5678')).toBe('abcd****5678');
    });
  });

  describe('sensitive key detection', () => {
    it('should identify sensitive keys correctly', () => {
      const service = dataMaskingService as any;
      
      expect(service.isSensitiveKey('email')).toBe(true);
      expect(service.isSensitiveKey('userEmail')).toBe(true);
      expect(service.isSensitiveKey('phone')).toBe(true);
      expect(service.isSensitiveKey('mobileNumber')).toBe(true);
      expect(service.isSensitiveKey('address')).toBe(true);
      expect(service.isSensitiveKey('plateNumber')).toBe(true);
      expect(service.isSensitiveKey('driverId')).toBe(true);
      expect(service.isSensitiveKey('customerId')).toBe(true);
      expect(service.isSensitiveKey('ipAddress')).toBe(true);
      expect(service.isSensitiveKey('password')).toBe(true);
      expect(service.isSensitiveKey('token')).toBe(true);
      expect(service.isSensitiveKey('secret')).toBe(true);
      
      expect(service.isSensitiveKey('name')).toBe(false);
      expect(service.isSensitiveKey('id')).toBe(false);
      expect(service.isSensitiveKey('status')).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should allow adding custom masking rules', () => {
      const customRule = {
        fieldName: 'customField',
        pattern: /custom-\d+/g,
        maskingFunction: (value: string) => value.replace(/\d/g, '*'),
        environments: ['development', 'test']
      };

      dataMaskingService.addMaskingRule(customRule);

      const testData = 'Value: custom-12345';
      const masked = dataMaskingService.maskSensitiveData(testData);

      expect(masked).toBe('Value: custom-*****');
    });

    it('should allow removing masking rules', () => {
      dataMaskingService.removeMaskingRule('email');

      const testData = 'Email: test@example.com';
      const masked = dataMaskingService.maskSensitiveData(testData);

      // Email should not be masked after removing the rule
      expect(masked).toBe('Email: test@example.com');
    });

    it('should allow updating configuration', () => {
      dataMaskingService.updateConfig({ logMasking: false });

      const config = dataMaskingService.getConfig();
      expect(config.logMasking).toBe(false);
    });

    it('should provide test functionality for masking rules', () => {
      const sampleData = {
        email: 'test@example.com',
        phone: '9876543210'
      };

      const testResult = dataMaskingService.testMaskingRules(sampleData);

      expect(testResult.original).toEqual(sampleData);
      expect(testResult.masked.email).toBe('te***@example.com');
      expect(testResult.masked.phone).toBe('98***10');
    });
  });

  describe('environment-specific behavior', () => {
    it('should mask data in development environment', () => {
      const devConfig = { ...mockConfig, environment: 'development' };
      const service = new DataMaskingService(devConfig);
      
      const testData = { email: 'test@example.com' };
      const result = service.maskSensitiveData(testData);

      expect(result.email).toBe('te***@example.com');
    });

    it('should mask data in staging environment', () => {
      const stagingConfig = { ...mockConfig, environment: 'staging' };
      const service = new DataMaskingService(stagingConfig);
      
      const testData = { email: 'test@example.com' };
      const result = service.maskSensitiveData(testData);

      expect(result.email).toBe('te***@example.com');
    });

    it('should mask data in test environment', () => {
      const testConfig = { ...mockConfig, environment: 'test' };
      const service = new DataMaskingService(testConfig);
      
      const testData = { email: 'test@example.com' };
      const result = service.maskSensitiveData(testData);

      expect(result.email).toBe('te***@example.com');
    });

    it('should not mask data in production environment', () => {
      const prodConfig = { ...mockConfig, environment: 'production' };
      const service = new DataMaskingService(prodConfig);
      
      const testData = { email: 'test@example.com' };
      const result = service.maskSensitiveData(testData);

      expect(result.email).toBe('test@example.com');
    });
  });
});