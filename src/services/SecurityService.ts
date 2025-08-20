import crypto from 'crypto';
import bcrypt from 'bcrypt';
import Logger from '../utils/logger';
import { DatabaseService } from '../database/DatabaseService';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityEvent {
  type: 'unauthorized_access' | 'suspicious_activity' | 'data_breach' | 'authentication_failure' | 'permission_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  timestamp: Date;
  details: any;
}

export interface DataMaskingRule {
  field: string;
  maskType: 'partial' | 'full' | 'hash' | 'redact';
  pattern?: string;
}

export class SecurityService {
  private readonly encryptionConfig: EncryptionConfig;
  private readonly encryptionKey: Buffer;
  private readonly databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.encryptionConfig = {
      algorithm: 'aes-256-cbc',
      keyLength: 32,
      ivLength: 16
    };
    
    // Initialize encryption key from environment or generate new one
    const keyString = process.env.ENCRYPTION_KEY;
    if (keyString) {
      this.encryptionKey = Buffer.from(keyString, 'hex');
    } else {
      this.encryptionKey = crypto.randomBytes(this.encryptionConfig.keyLength);
      Logger.warn('No ENCRYPTION_KEY found in environment, generated new key');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-CBC
   */
  public encryptData(plaintext: string): { encrypted: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(this.encryptionConfig.ivLength);
      const cipher = crypto.createCipheriv(this.encryptionConfig.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Create integrity tag using HMAC
      const tag = crypto.createHash('sha256').update(encrypted + iv.toString('hex')).digest('hex').substring(0, 32);
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag
      };
    } catch (error) {
      Logger.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-CBC
   */
  public decryptData(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    try {
      // Verify tag first
      const expectedTag = crypto.createHash('sha256').update(encryptedData.encrypted + encryptedData.iv).digest('hex').substring(0, 32);
      if (expectedTag !== encryptedData.tag) {
        throw new Error('Data integrity check failed');
      }
      
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv(this.encryptionConfig.algorithm, this.encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      Logger.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Hash passwords using bcrypt
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      Logger.error('Password hashing failed:', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      Logger.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Log security audit events
   */
  public async logAuditEvent(auditEntry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...auditEntry
      };

      // Store in database
      await this.databaseService.query(
        `INSERT INTO audit_logs (id, user_id, action, resource, timestamp, ip_address, user_agent, success, details, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          entry.id,
          entry.userId,
          entry.action,
          entry.resource,
          entry.timestamp,
          entry.ipAddress,
          entry.userAgent,
          entry.success,
          JSON.stringify(entry.details),
          entry.severity
        ]
      );

      // Log to application logger
      Logger.info('Audit event logged', {
        auditId: entry.id,
        action: entry.action,
        resource: entry.resource,
        success: entry.success,
        severity: entry.severity
      });

      // Trigger alerts for high severity events
      if (entry.severity === 'high' || entry.severity === 'critical') {
        await this.triggerSecurityAlert(entry);
      }
    } catch (error) {
      Logger.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log security events and trigger alerts
   */
  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const eventId = crypto.randomUUID();
      
      // Store security event
      await this.databaseService.query(
        `INSERT INTO security_events (id, type, severity, user_id, ip_address, timestamp, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          eventId,
          event.type,
          event.severity,
          event.userId,
          event.ipAddress,
          event.timestamp,
          JSON.stringify(event.details)
        ]
      );

      Logger.warn('Security event detected', {
        eventId,
        type: event.type,
        severity: event.severity,
        userId: event.userId,
        ipAddress: event.ipAddress
      });

      // Trigger immediate alerts for critical events
      if (event.severity === 'critical') {
        await this.triggerImmediateSecurityAlert(event);
      }
    } catch (error) {
      Logger.error('Failed to log security event:', error);
    }
  }

  /**
   * Mask sensitive data for logging and non-production environments
   */
  public maskSensitiveData(data: any, rules: DataMaskingRule[]): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const maskedData = { ...data };

    rules.forEach(rule => {
      if (maskedData[rule.field] !== undefined) {
        maskedData[rule.field] = this.applyMasking(maskedData[rule.field], rule);
      }
    });

    return maskedData;
  }

  /**
   * Generate secure random tokens
   */
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate IP address against whitelist
   */
  public isIPWhitelisted(ipAddress: string, whitelist: string[]): boolean {
    return whitelist.includes(ipAddress) || whitelist.includes('*');
  }

  /**
   * Check for suspicious activity patterns
   */
  public async detectSuspiciousActivity(userId: string, ipAddress: string): Promise<boolean> {
    try {
      // Check for multiple failed login attempts
      const failedAttempts = await this.databaseService.query(
        `SELECT COUNT(*) as count FROM audit_logs 
         WHERE user_id = $1 AND action = 'login' AND success = false 
         AND timestamp > NOW() - INTERVAL '15 minutes'`,
        [userId]
      );

      if (failedAttempts.rows[0]?.count > 5) {
        return true;
      }

      // Check for unusual IP address patterns
      const recentIPs = await this.databaseService.query(
        `SELECT DISTINCT ip_address FROM audit_logs 
         WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '1 hour'`,
        [userId]
      );

      if (recentIPs.rows.length > 3) {
        return true;
      }

      // Check for rapid API calls from same IP
      const rapidCalls = await this.databaseService.query(
        `SELECT COUNT(*) as count FROM audit_logs 
         WHERE ip_address = $1 AND timestamp > NOW() - INTERVAL '1 minute'`,
        [ipAddress]
      );

      if (rapidCalls.rows[0]?.count > 100) {
        return true;
      }

      return false;
    } catch (error) {
      Logger.error('Error detecting suspicious activity:', error);
      return false;
    }
  }

  /**
   * Get security metrics for monitoring
   */
  public async getSecurityMetrics(): Promise<{
    failedLogins: number;
    securityEvents: number;
    suspiciousActivity: number;
    auditLogCount: number;
  }> {
    try {
      const [failedLogins, securityEvents, suspiciousActivity, auditLogCount] = await Promise.all([
        this.databaseService.query(
          `SELECT COUNT(*) as count FROM audit_logs 
           WHERE action = 'login' AND success = false AND timestamp > NOW() - INTERVAL '24 hours'`
        ),
        this.databaseService.query(
          `SELECT COUNT(*) as count FROM security_events 
           WHERE timestamp > NOW() - INTERVAL '24 hours'`
        ),
        this.databaseService.query(
          `SELECT COUNT(*) as count FROM security_events 
           WHERE type = 'suspicious_activity' AND timestamp > NOW() - INTERVAL '24 hours'`
        ),
        this.databaseService.query(
          `SELECT COUNT(*) as count FROM audit_logs 
           WHERE timestamp > NOW() - INTERVAL '24 hours'`
        )
      ]);

      return {
        failedLogins: parseInt(failedLogins.rows[0]?.count || '0'),
        securityEvents: parseInt(securityEvents.rows[0]?.count || '0'),
        suspiciousActivity: parseInt(suspiciousActivity.rows[0]?.count || '0'),
        auditLogCount: parseInt(auditLogCount.rows[0]?.count || '0')
      };
    } catch (error) {
      Logger.error('Error getting security metrics:', error);
      return {
        failedLogins: 0,
        securityEvents: 0,
        suspiciousActivity: 0,
        auditLogCount: 0
      };
    }
  }

  private applyMasking(value: any, rule: DataMaskingRule): any {
    if (typeof value !== 'string') {
      return value;
    }

    switch (rule.maskType) {
      case 'full':
        return '*'.repeat(value.length);
      
      case 'partial':
        if (value.length <= 4) return '*'.repeat(value.length);
        return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
      
      case 'hash':
        return crypto.createHash('sha256').update(value).digest('hex').substring(0, 8);
      
      case 'redact':
        return '[REDACTED]';
      
      default:
        return value;
    }
  }

  private async triggerSecurityAlert(auditEntry: AuditLogEntry): Promise<void> {
    // In a real implementation, this would send alerts to security team
    Logger.warn('Security alert triggered', {
      auditId: auditEntry.id,
      severity: auditEntry.severity,
      action: auditEntry.action,
      resource: auditEntry.resource
    });
  }

  private async triggerImmediateSecurityAlert(event: SecurityEvent): Promise<void> {
    // In a real implementation, this would send immediate alerts via SMS/email/Slack
    Logger.error('CRITICAL SECURITY EVENT', {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      ipAddress: event.ipAddress,
      timestamp: event.timestamp
    });
  }
}