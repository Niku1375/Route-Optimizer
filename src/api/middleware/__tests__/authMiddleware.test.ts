import { NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware, authMiddleware, requirePermission, requireRole } from '../authMiddleware';
import { SecurityService } from '../../../services/SecurityService';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../services/SecurityService');
jest.mock('../../../utils/logger');

describe('AuthMiddleware', () => {
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockSecurityService = new SecurityService({} as any) as jest.Mocked<SecurityService>;
    mockSecurityService.logAuditEvent = jest.fn().mockResolvedValue(undefined);
    mockSecurityService.detectSuspiciousActivity = jest.fn().mockResolvedValue(false);

    mockRequest = {
      headers: {},
      ip: '192.168.1.1',
      path: '/api/test',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      connection: { remoteAddress: '192.168.1.1' }
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Reset JWT mock
    (jwt.verify as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Auth Middleware', () => {
    test('should authenticate valid token and log audit event', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read']
      });
      expect(mockSecurityService.logAuditEvent).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'authentication_success',
        resource: '/api/test',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        details: { role: 'user' },
        severity: 'low'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject request without token and log audit event', async () => {
      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockSecurityService.logAuditEvent).toHaveBeenCalledWith({
        action: 'authentication_failed',
        resource: '/api/test',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: false,
        details: { reason: 'missing_token' },
        severity: 'medium'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject invalid token and log audit event', async () => {
      const token = 'invalid-jwt-token';
      mockRequest.headers.authorization = `Bearer ${token}`;
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockSecurityService.logAuditEvent).toHaveBeenCalledWith({
        action: 'authentication_failed',
        resource: '/api/test',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: false,
        details: { reason: 'invalid_token', error: 'Invalid token' },
        severity: 'medium'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should detect and log suspicious activity', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);
      mockSecurityService.detectSuspiciousActivity.mockResolvedValue(true);

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockSecurityService.detectSuspiciousActivity).toHaveBeenCalledWith('user-123', '192.168.1.1');
      expect(mockSecurityService.logSecurityEvent).toHaveBeenCalledWith({
        type: 'suspicious_activity',
        severity: 'high',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        timestamp: expect.any(Date),
        details: {
          reason: 'suspicious_login_pattern',
          endpoint: '/api/test',
          userAgent: 'Mozilla/5.0'
        }
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Legacy Auth Middleware', () => {
    test('should authenticate valid token', () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      authMiddleware(mockRequest, mockResponse, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read']
      });
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject request without token', () => {
      authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject invalid token', () => {
      const token = 'invalid-jwt-token';
      mockRequest.headers.authorization = `Bearer ${token}`;
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Permission Middleware', () => {
    test('should allow user with required permission', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read', 'write']
      };

      const middleware = requirePermission('read');
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should allow admin user regardless of permissions', () => {
      mockRequest.user = {
        id: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        permissions: []
      };

      const middleware = requirePermission('super-secret-permission');
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should reject user without required permission', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read']
      };

      const middleware = requirePermission('write');
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Permission required: write' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject unauthenticated user', () => {
      const middleware = requirePermission('read');
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Role Middleware', () => {
    test('should allow user with required role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'manager',
        permissions: []
      };

      const middleware = requireRole(['manager', 'admin']);
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('should reject user without required role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: []
      };

      const middleware = requireRole(['manager', 'admin']);
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Role required: manager or admin' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject unauthenticated user', () => {
      const middleware = requireRole(['admin']);
      middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Token Extraction', () => {
    test('should extract token from Authorization header', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle malformed Authorization header', async () => {
      mockRequest.headers.authorization = 'InvalidFormat token';

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle missing Authorization header', async () => {
      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('IP Address Extraction', () => {
    test('should extract IP from request.ip', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockRequest.ip = '203.0.113.1';
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockSecurityService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.1'
        })
      );
    });

    test('should fallback to connection.remoteAddress', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockRequest.ip = undefined;
      mockRequest.connection.remoteAddress = '203.0.113.2';
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockSecurityService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.2'
        })
      );
    });

    test('should use unknown when no IP available', async () => {
      const token = 'valid-jwt-token';
      const decodedToken = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        permissions: ['read'],
        iat: Date.now(),
        exp: Date.now() + 3600
      };

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockRequest.ip = undefined;
      mockRequest.connection = {};
      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const middleware = createAuthMiddleware(mockSecurityService);
      await middleware(mockRequest, mockResponse, mockNext);

      expect(mockSecurityService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: 'unknown'
        })
      );
    });
  });
});