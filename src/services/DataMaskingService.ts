import Logger from '../utils/logger';

export interface MaskingRule {
  fieldName: string;
  pattern: RegExp;
  maskingFunction: (value: string) => string;
  environments: string[]; // ['development', 'staging', 'test']
}

export interface MaskingConfig {
  enabled: boolean;
  environment: string;
  logMasking: boolean;
  databaseMasking: boolean;
  apiResponseMasking: boolean;
}

export class DataMaskingService {
  private readonly logger = Logger;
  private readonly config: MaskingConfig;
  
  // Predefined masking rules for common PII patterns
  private readonly maskingRules: MaskingRule[] = [
    {
      fieldName: 'email',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      maskingFunction: this.maskEmail,
      environments: ['development', 'staging', 'test']
    },
    {
      fieldName: 'phone',
      pattern: /(\+91|91)?[-.\s]?[6-9]\d{9}/g,
      maskingFunction: this.maskPhone,
      environments: ['development', 'staging', 'test']
    },
    {
      fieldName: 'plateNumber',
      pattern: /[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}/g,
      maskingFunction: this.maskPlateNumber,
      environments: ['development', 'staging', 'test']
    },
    {
      fieldName: 'ipAddress',
      pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      maskingFunction: this.maskIPAddress,
      environments: ['development', 'staging', 'test']
    },
    {
      fieldName: 'address',
      pattern: /\b\d+[\w\s,.-]+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|place|pl|court|ct|circle|cir)\b/gi,
      maskingFunction: this.maskAddress,
      environments: ['development', 'staging', 'test']
    },
    {
      fieldName: 'uuid',
      pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      maskingFunction: this.maskUUID,
      environments: ['development', 'staging', 'test']
    }
  ];

  constructor(config: MaskingConfig) {
    this.config = config;
  }

  /**
   * Mask sensitive data in any object or string
   */
  maskSensitiveData(data: any): any {
    if (!this.config.enabled || !this.shouldMaskForEnvironment()) {
      return data;
    }

    if (typeof data === 'string') {
      return this.maskString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    if (typeof data === 'object' && data !== null) {
      return this.maskObject(data);
    }

    return data;
  }

  /**
   * Mask sensitive data in log messages
   */
  maskLogData(logMessage: string, logData?: any): { message: string; data?: any } {
    if (!this.config.enabled || !this.config.logMasking || !this.shouldMaskForEnvironment()) {
      return { message: logMessage, data: logData };
    }

    const maskedMessage = this.maskString(logMessage);
    const maskedData = logData ? this.maskSensitiveData(logData) : undefined;

    return { message: maskedMessage, data: maskedData };
  }

  /**
   * Mask sensitive data in API responses for non-production environments
   */
  maskApiResponse(response: any): any {
    if (!this.config.enabled || !this.config.apiResponseMasking || !this.shouldMaskForEnvironment()) {
      return response;
    }

    return this.maskSensitiveData(response);
  }

  /**
   * Mask sensitive data in database query results for non-production environments
   */
  maskDatabaseResult(result: any): any {
    if (!this.config.enabled || !this.config.databaseMasking || !this.shouldMaskForEnvironment()) {
      return result;
    }

    return this.maskSensitiveData(result);
  }

  /**
   * Check if masking should be applied for current environment
   */
  private shouldMaskForEnvironment(): boolean {
    return this.maskingRules.some(rule => 
      rule.environments.includes(this.config.environment)
    );
  }

  /**
   * Mask sensitive data in a string using all applicable rules
   */
  private maskString(text: string): string {
    let maskedText = text;

    for (const rule of this.maskingRules) {
      if (rule.environments.includes(this.config.environment)) {
        maskedText = maskedText.replace(rule.pattern, (match) => rule.maskingFunction(match));
      }
    }

    return maskedText;
  }

  /**
   * Mask sensitive data in an object recursively
   */
  private maskObject(obj: any): any {
    const masked: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if the key indicates sensitive data
      const sensitiveKey = this.isSensitiveKey(key);
      
      if (sensitiveKey) {
        masked[key] = this.maskValueByKey(value, key);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else if (typeof value === 'string') {
        masked[key] = this.maskString(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Check if a key name indicates sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeyPatterns = [
      /email/i,
      /phone/i,
      /mobile/i,
      /address/i,
      /plate.*number/i,
      /license/i,
      /driver.*id/i,
      /customer.*id/i,
      /user.*id/i,
      /ip.*address/i,
      /password/i,
      /token/i,
      /secret/i,
      /key/i
    ];

    return sensitiveKeyPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Mask value based on key name
   */
  private maskValueByKey(value: any, key: string): any {
    if (typeof value !== 'string') {
      return value;
    }

    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('email')) {
      return this.maskEmail(value);
    } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
      return this.maskPhone(value);
    } else if (lowerKey.includes('address')) {
      return this.maskAddress(value);
    } else if (lowerKey.includes('plate')) {
      return this.maskPlateNumber(value);
    } else if (lowerKey.includes('ip')) {
      return this.maskIPAddress(value);
    } else if (lowerKey.includes('id')) {
      return this.maskUUID(value);
    } else if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')) {
      return '[REDACTED]';
    }

    return this.maskString(value);
  }

  /**
   * Mask email addresses
   */
  private maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email;

    const username = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    if (username.length <= 2) {
      return `**${domain}`;
    }

    return `${username.substring(0, 2)}***${domain}`;
  }

  /**
   * Mask phone numbers
   */
  private maskPhone(phone: string): string {
    // Remove all non-digit characters for processing
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length < 4) {
      return '***';
    }

    // Keep the format but mask middle digits
    const maskedDigits = digits.substring(0, 2) + '*'.repeat(digits.length - 4) + digits.slice(-2);
    
    // Try to preserve original formatting
    let result = phone;
    let digitIndex = 0;
    
    for (let i = 0; i < phone.length; i++) {
      const char = phone[i];
      if (char && /\d/.test(char)) {
        result = result.substring(0, i) + maskedDigits[digitIndex] + result.substring(i + 1);
        digitIndex++;
      }
    }
    
    return result;
  }

  /**
   * Mask vehicle plate numbers
   */
  private maskPlateNumber(plateNumber: string): string {
    if (plateNumber.length < 4) {
      return '***';
    }

    // For Indian plate numbers (e.g., DL01AB1234)
    if (plateNumber.length >= 8) {
      return `${plateNumber.substring(0, 2)  }**${  plateNumber.substring(4, 6)  }****`;
    }

    return plateNumber.substring(0, 2) + '*'.repeat(plateNumber.length - 4) + plateNumber.slice(-2);
  }

  /**
   * Mask IP addresses
   */
  private maskIPAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return '***.***.***.**';
    }

    return `${parts[0]}.***.***.${parts[3]}`;
  }

  /**
   * Mask street addresses
   */
  private maskAddress(address: string): string {
    const words = address.split(' ');
    
    if (words.length <= 2) {
      return '*** ***';
    }

    // Keep first and last word, mask the middle
    const maskedWords = [
      words[0],
      ...Array(words.length - 2).fill('***'),
      words[words.length - 1]
    ];

    return maskedWords.join(' ');
  }

  /**
   * Mask UUIDs and other IDs
   */
  private maskUUID(uuid: string): string {
    if (uuid.length < 8) {
      return '***';
    }

    // For UUIDs, keep first 4 and last 4 characters
    if (uuid.includes('-')) {
      const parts = uuid.split('-');
      const firstPart = parts[0] || '';
      const lastPart = parts[parts.length - 1] || '';
      return `${firstPart.substring(0, 4)}-****-****-****-${lastPart.slice(-4)}`;
    }

        return `${uuid.substring(0, 4)}${'*'.repeat(uuid.length - 8)}${uuid.slice(-4)}`;
  }

  /**
   * Add custom masking rule
   */
  addMaskingRule(rule: MaskingRule): void {
    this.maskingRules.push(rule);
    this.logger.info(`Added custom masking rule for ${rule.fieldName}`);
  }

  /**
   * Remove masking rule by field name
   */
  removeMaskingRule(fieldName: string): void {
    const index = this.maskingRules.findIndex(rule => rule.fieldName === fieldName);
    if (index !== -1) {
      this.maskingRules.splice(index, 1);
      this.logger.info(`Removed masking rule for ${fieldName}`);
    }
  }

  /**
   * Get current masking configuration
   */
  getConfig(): MaskingConfig {
    return { ...this.config };
  }

  /**
   * Update masking configuration
   */
  updateConfig(newConfig: Partial<MaskingConfig>): void {
    Object.assign(this.config, newConfig);
    this.logger.info('Updated data masking configuration', { config: this.config });
  }

  /**
   * Test masking rules with sample data
   */
  testMaskingRules(sampleData: any): { original: any; masked: any } {
    return {
      original: sampleData,
      masked: this.maskSensitiveData(sampleData)
    };
  }
}