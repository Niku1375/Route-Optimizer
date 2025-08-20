import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../../services/SecurityService';
import Logger from '../../utils/logger';

export interface IPWhitelistConfig {
  whitelist: string[];
  allowPrivateNetworks?: boolean;
  allowLocalhost?: boolean;
  customValidator?: (ip: string) => boolean;
}

export class IPWhitelistMiddleware {
  private securityService: SecurityService;
  private config: IPWhitelistConfig;

  constructor(securityService: SecurityService, config: IPWhitelistConfig) {
    this.securityService = securityService;
    this.config = {
      allowPrivateNetworks: false,
      allowLocalhost: true,
      ...config
    };
  }

  public middleware() {
    return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const clientIP = this.getClientIP(_req);
        const isAllowed = await this.isIPAllowed(clientIP, _req);

        if (!isAllowed) {
          // Log unauthorized access attempt
          await this.securityService.logSecurityEvent({
            type: 'unauthorized_access',
            severity: 'high',
            ipAddress: clientIP,
            timestamp: new Date(),
            details: {
              reason: 'ip_not_whitelisted',
              endpoint: _req.path,
              method: _req.method,
              userAgent: _req.get('User-Agent'),
              headers: this.sanitizeHeaders(_req.headers)
            }
          });

          Logger.warn('IP not whitelisted', {
            ip: clientIP,
            endpoint: _req.path,
            method: _req.method,
            userAgent: _req.get('User-Agent')
          });

          res.status(403).json({
            error: 'Forbidden',
            message: 'Access denied from this IP address'
          });
          return;
        }

        next();
      } catch (error) {
        Logger.error('IP whitelist middleware error:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Security validation failed'
        });
      }
    };
  }

  private async isIPAllowed(ip: string, _req: Request): Promise<boolean> {
    // Check custom validator first
    if (this.config.customValidator && this.config.customValidator(ip)) {
      return true;
    }

    // Check explicit whitelist
    if (this.securityService.isIPWhitelisted(ip, this.config.whitelist)) {
      return true;
    }

    // Check localhost
    if (this.config.allowLocalhost && this.isLocalhost(ip)) {
      return true;
    }

    // Check private networks
    if (this.config.allowPrivateNetworks && this.isPrivateNetwork(ip)) {
      return true;
    }

    // Check for CIDR ranges in whitelist
    for (const whitelistEntry of this.config.whitelist) {
      if (this.isIPInCIDR(ip, whitelistEntry)) {
        return true;
      }
    }

    return false;
  }

  private getClientIP(_req: Request): string {
    // Check various headers for the real IP
    const xForwardedFor = _req.get('X-Forwarded-For');
    const xRealIP = _req.get('X-Real-IP');
    const xClientIP = _req.get('X-Client-IP');
    
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return xForwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    
    if (xRealIP) {
      return xRealIP;
    }
    
    if (xClientIP) {
      return xClientIP;
    }
    
    return (
            _req.ip ||
      _req.connection.remoteAddress ||
      _req.socket.remoteAddress ||
      (_req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  private isLocalhost(ip: string): boolean {
    const localhostPatterns = [
      '127.0.0.1',
      '::1',
      'localhost',
      '0.0.0.0'
    ];
    return localhostPatterns.includes(ip);
  }

  private isPrivateNetwork(ip: string): boolean {
    // Check for private IP ranges
    const privateRanges = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^169\.254\./,              // 169.254.0.0/16 (link-local)
      /^fc00:/,                   // IPv6 unique local addresses
      /^fe80:/                    // IPv6 link-local addresses
    ];

    return privateRanges.some(pattern => pattern.test(ip));
  }

  private isIPInCIDR(ip: string, cidr: string): boolean {
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    try {
      const [network, prefixLength] = cidr.split('/');
      if (!network || !prefixLength) {
        return false;
      }
      
      const prefixLen = parseInt(prefixLength, 10);
      if (isNaN(prefixLen)) {
        return false;
      }
      
      // Simple IPv4 CIDR check (for production, use a proper library like 'ip-range-check')
      if (this.isIPv4(ip) && this.isIPv4(network)) {
        const ipNum = this.ipToNumber(ip);
        const networkNum = this.ipToNumber(network);
        const mask = (0xffffffff << (32 - prefixLen)) >>> 0;
        
        return (ipNum & mask) === (networkNum & mask);
      }
      
      return false;
    } catch (error) {
      Logger.error('Error checking CIDR range:', error);
      return false;
    }
  }

  private isIPv4(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Regex.test(ip);
  }

  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}

// Predefined IP whitelist configurations
export const ipWhitelistConfigs = {
  // Internal services only
  internal: {
    whitelist: [
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ],
    allowPrivateNetworks: true,
    allowLocalhost: true
  },

  // Production API (specific IPs only)
  production: {
    whitelist: [
      // Add specific production IPs here
      '203.0.113.0/24', // Example production network
    ],
    allowPrivateNetworks: false,
    allowLocalhost: false
  },

  // Development environment
  development: {
    whitelist: ['*'], // Allow all in development
    allowPrivateNetworks: true,
    allowLocalhost: true
  }
};

// Factory function to create IP whitelist middleware
export function createIPWhitelistMiddleware(
  securityService: SecurityService,
  configName: keyof typeof ipWhitelistConfigs
) {
  const config = ipWhitelistConfigs[configName];
  const ipWhitelist = new IPWhitelistMiddleware(securityService, config);
  return ipWhitelist.middleware();
}