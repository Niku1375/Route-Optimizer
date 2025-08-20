import { Request, Response, NextFunction } from 'express';
import { IPWhitelistMiddleware, ipWhitelistConfigs } from '../ipWhitelistMiddleware';
import { SecurityService } from '../../../services/SecurityService';

// Mock dependencies
jest.mock('../../../services/SecurityService');

describe('IPWhitelistMiddleware', () => {
  let ipWhitelistMiddleware: IPWhitelistMiddleware;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockSecurityService = new SecurityService({} as any) as jest.Mocked<SecurityService>;
    mockSecurityService.isIPWhitelisted = jest.fn();
    mockSecurityService.logSecurityEvent = jest.fn().mockResolvedValue(undefined);

    mockRequest = {
      ip: '192.168.1.1',
      path: '/api/test',
      method: 'GET',
      get: jest.fn(),
      headers: {
        'user-agent': 'Mozilla/5.0',
        'authorization': 'Bearer token123'
      },
      connection: { remoteAddress: '192.168.1.1' } as any
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('IP Whitelist Validation', () => {
    test('should allow whitelisted IP addresses', async () => {
      const config = {
        whitelist: ['192.168.1.1', '10.0.0.0/8']
      };
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(true);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should block non-whitelisted IP addresses', async () => {
      const config = {
        whitelist: ['10.0.0.1']
      };
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(false);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Access denied from this IP address'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'unauthorized_access',
        severity: 'high',
        ipAddress: '192.168.1.1',
        timestamp: expect.any(Date),
        details: {
          reason: 'ip_not_whitelisted',
          endpoint: '/api/test',
          method: 'GET',
          userAgent: undefined,
          headers: {
            'user-agent': 'Mozilla/5.0',
            'authorization': '[REDACTED]'
          }
        }
      });
    });

    test('should allow localhost when configured', async () => {
      const config = {
        whitelist: [],
        allowLocalhost: true
      };
      
      (mockRequest as any).ip = '127.0.0.1';
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(false);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should allow private networks when configured', async () => {
      const config = {
        whitelist: [],
        allowPrivateNetworks: true
      };
      
      (mockRequest as any).ip = '10.1.1.1';
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(false);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should use custom validator when provided', async () => {
      const customValidator = jest.fn().mockReturnValue(true);
      const config = {
        whitelist: [],
        customValidator
      };
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(false);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(customValidator).toHaveBeenCalledWith('192.168.1.1');
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('IP Address Extraction', () => {
    test('should extract IP from X-Forwarded-For header', async () => {
      const config = { whitelist: ['203.0.113.1'] };
      (mockRequest as any).get = jest.fn((header: string) => {
        return header === 'X-Forwarded-For' ? '203.0.113.1, 192.168.1.1' : undefined;
      });
      (mockRequest as any).ip = undefined;
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(true);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSecurityService.isIPWhitelisted).toHaveBeenCalledWith('203.0.113.1', ['203.0.113.1']);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should extract IP from X-Real-IP header', async () => {
      const config = { whitelist: ['203.0.113.2'] };
      (mockRequest as any).get = jest.fn((header: string) => {
        return header === 'X-Real-IP' ? '203.0.113.2' : undefined;
      });
      (mockRequest as any).ip = undefined;
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(true);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSecurityService.isIPWhitelisted).toHaveBeenCalledWith('203.0.113.2', ['203.0.113.2']);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should fallback to connection remote address', async () => {
      const config = { whitelist: ['203.0.113.3'] };
      (mockRequest as any).get = jest.fn().mockReturnValue(undefined);
      (mockRequest as any).ip = undefined;
      mockRequest.connection = { remoteAddress: '203.0.113.3' } as any;
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(true);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSecurityService.isIPWhitelisted).toHaveBeenCalledWith('203.0.113.3', ['203.0.113.3']);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Localhost Detection', () => {
    test('should detect various localhost formats', async () => {
      const config = { whitelist: [], allowLocalhost: true };
      const localhostIPs = ['127.0.0.1', '::1', 'localhost', '0.0.0.0'];
      
      for (const ip of localhostIPs) {
        (mockRequest as any).ip = ip;
        ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
        mockSecurityService.isIPWhitelisted.mockReturnValue(false);

        const middleware = ipWhitelistMiddleware.middleware();
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        
        jest.clearAllMocks();
      }
    });
  });

  describe('Private Network Detection', () => {
    test('should detect private IPv4 ranges', async () => {
      const config = { whitelist: [], allowPrivateNetworks: true };
      const privateIPs = [
        '10.0.0.1',      // 10.0.0.0/8
        '172.16.0.1',    // 172.16.0.0/12
        '172.31.255.1',  // 172.16.0.0/12
        '192.168.1.1',   // 192.168.0.0/16
        '169.254.1.1'    // 169.254.0.0/16 (link-local)
      ];
      
      for (const ip of privateIPs) {
        (mockRequest as any).ip = ip;
        ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
        mockSecurityService.isIPWhitelisted.mockReturnValue(false);

        const middleware = ipWhitelistMiddleware.middleware();
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
        
        jest.clearAllMocks();
      }
    });

    test('should not detect public IPs as private', async () => {
      const config = { whitelist: [], allowPrivateNetworks: true };
      const publicIPs = ['8.8.8.8', '203.0.113.1', '172.15.0.1', '172.32.0.1'];
      
      for (const ip of publicIPs) {
        (mockRequest as any).ip = ip;
        ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
        mockSecurityService.isIPWhitelisted.mockReturnValue(false);

        const middleware = ipWhitelistMiddleware.middleware();
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
        
        jest.clearAllMocks();
      }
    });
  });

  describe('CIDR Range Validation', () => {
    test('should validate IP against CIDR ranges', async () => {
      const config = { whitelist: ['192.168.1.0/24', '10.0.0.0/8'] };
      const testCases = [
        { ip: '192.168.1.100', shouldAllow: true },
        { ip: '192.168.1.255', shouldAllow: true },
        { ip: '192.168.2.1', shouldAllow: false },
        { ip: '10.1.1.1', shouldAllow: true },
        { ip: '11.0.0.1', shouldAllow: false }
      ];
      
      for (const testCase of testCases) {
        (mockRequest as any).ip = testCase.ip;
        ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
        mockSecurityService.isIPWhitelisted.mockReturnValue(false);

        const middleware = ipWhitelistMiddleware.middleware();
        await middleware(mockRequest as Request, mockResponse as Response, mockNext);

        if (testCase.shouldAllow) {
          expect(mockNext).toHaveBeenCalled();
          expect(mockResponse.status).not.toHaveBeenCalled();
        } else {
          expect(mockResponse.status).toHaveBeenCalledWith(403);
          expect(mockNext).not.toHaveBeenCalled();
        }
        
        jest.clearAllMocks();
      }
    });
  });

  describe('Header Sanitization', () => {
    test('should sanitize sensitive headers in logs', async () => {
      const config = { whitelist: ['10.0.0.1'] };
      mockRequest.headers = {
        'authorization': 'Bearer secret-token',
        'cookie': 'session=secret-session',
        'x-api-key': 'secret-api-key',
        'user-agent': 'Mozilla/5.0'
      };
      
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      mockSecurityService.isIPWhitelisted.mockReturnValue(false);

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'unauthorized_access',
        severity: 'high',
        ipAddress: '192.168.1.1',
        timestamp: expect.any(Date),
        details: {
          reason: 'ip_not_whitelisted',
          endpoint: '/api/test',
          method: 'GET',
          userAgent: undefined,
          headers: {
            'authorization': '[REDACTED]',
            'cookie': '[REDACTED]',
            'x-api-key': '[REDACTED]',
            'user-agent': 'Mozilla/5.0'
          }
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle middleware errors gracefully', async () => {
      const config = { whitelist: ['192.168.1.1'] };
      ipWhitelistMiddleware = new IPWhitelistMiddleware(mockSecurityService, config);
      
      // Mock an error in the middleware
      mockSecurityService.isIPWhitelisted.mockImplementation(() => {
        throw new Error('Security service error');
      });

      const middleware = ipWhitelistMiddleware.middleware();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Security validation failed'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Predefined Configurations', () => {
    test('should have correct internal configuration', () => {
      const internalConfig = ipWhitelistConfigs.internal;
      expect(internalConfig.allowPrivateNetworks).toBe(true);
      expect(internalConfig.allowLocalhost).toBe(true);
      expect(internalConfig.whitelist).toContain('127.0.0.1');
      expect(internalConfig.whitelist).toContain('10.0.0.0/8');
    });

    test('should have correct production configuration', () => {
      const productionConfig = ipWhitelistConfigs.production;
      expect(productionConfig.allowPrivateNetworks).toBe(false);
      expect(productionConfig.allowLocalhost).toBe(false);
      expect(productionConfig.whitelist).toBeDefined();
    });

    test('should have correct development configuration', () => {
      const devConfig = ipWhitelistConfigs.development;
      expect(devConfig.allowPrivateNetworks).toBe(true);
      expect(devConfig.allowLocalhost).toBe(true);
      expect(devConfig.whitelist).toContain('*');
    });
  });
});