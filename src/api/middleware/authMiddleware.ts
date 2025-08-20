import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Logger from '../../utils/logger';
import { SecurityService } from '../../services/SecurityService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export const createAuthMiddleware = (securityService: SecurityService) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const clientIP = getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    
    try {
      const token = extractToken(req);
      
      if (!token) {
        await securityService.logAuditEvent({
          action: 'authentication_failed',
          resource: req.path,
          ipAddress: clientIP,
          userAgent,
          success: false,
          details: { reason: 'missing_token' },
          severity: 'medium'
        });
        
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      const secret = process.env.JWT_SECRET || 'default-secret-key';
      const decoded = jwt.verify(token, secret) as JWTPayload;
      
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions
      };

      // Check for suspicious activity
      const isSuspicious = await securityService.detectSuspiciousActivity(decoded.id, clientIP);
      if (isSuspicious) {
        await securityService.logSecurityEvent({
          type: 'suspicious_activity',
          severity: 'high',
          userId: decoded.id,
          ipAddress: clientIP,
          timestamp: new Date(),
          details: {
            reason: 'suspicious_login_pattern',
            endpoint: req.path,
            userAgent
          }
        });
      }

      // Log successful authentication
      await securityService.logAuditEvent({
        userId: decoded.id,
        action: 'authentication_success',
        resource: req.path,
        ipAddress: clientIP,
        userAgent,
        success: true,
        details: { role: decoded.role },
        severity: 'low'
      });

      Logger.info('User authenticated', { userId: decoded.id, role: decoded.role });
      next();
    } catch (error) {
      await securityService.logAuditEvent({
        action: 'authentication_failed',
        resource: req.path,
        ipAddress: clientIP,
        userAgent,
        success: false,
        details: { reason: 'invalid_token', error: error instanceof Error ? error.message : 'unknown' },
        severity: 'medium'
      });

      Logger.error('Authentication failed:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};

// Legacy middleware for backward compatibility
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'default-secret-key';
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions
    };

    Logger.info('User authenticated', { userId: decoded.id, role: decoded.role });
    next();
  } catch (error) {
    Logger.error('Authentication failed:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== 'admin') {
      res.status(403).json({ error: `Permission required: ${permission}` });
      return;
    }

    next();
  };
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Role required: ${roles.join(' or ')}` });
      return;
    }

    next();
  };
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    (req as any).socket?.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    'unknown'
  );
}