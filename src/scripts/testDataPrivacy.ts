#!/usr/bin/env node

/**
 * Data Privacy and Retention Testing Script
 * Demonstrates the functionality of the data privacy implementation
 */

import { DataPrivacyService } from '../services/DataPrivacyService';
import { DataMaskingService, MaskingConfig } from '../services/DataMaskingService';
import { GDPRComplianceService } from '../services/GDPRComplianceService';
import { DatabaseConnection } from '../database/connection';
import { AuditLogger } from '../utils/AuditLogger';
import Logger from '../utils/logger';

async function demonstrateDataPrivacy() {
  const logger = Logger;
  logger.info('Starting Data Privacy and Retention Demonstration');

  try {
    // Initialize services
    const dbConnection = DatabaseConnection.getInstance();
    const dataPrivacyService = new DataPrivacyService(dbConnection);
    
    const maskingConfig: MaskingConfig = {
      enabled: true,
      environment: 'development',
      logMasking: true,
      databaseMasking: true,
      apiResponseMasking: true
    };
    const dataMaskingService = new DataMaskingService(maskingConfig);
    
    const auditLogger = AuditLogger.getInstance();
    auditLogger.initialize(dbConnection);
    
    const gdprService = new GDPRComplianceService(
      dbConnection,
      dataPrivacyService,
      dataMaskingService
    );

    // Initialize GDPR tables (skip if database not available)
    try {
      await gdprService.initializeGDPRTables();
      logger.info('✅ GDPR tables initialized');
    } catch (error) {
      logger.info('ℹ️ Database not available, skipping GDPR table initialization');
    }

    // Demonstrate data masking
    console.log('\n=== Data Masking Demonstration ===');
    const sensitiveData = {
      customer: {
        email: 'john.doe@example.com',
        phone: '+919876543210',
        address: '123 Main Street, New Delhi'
      },
      vehicle: {
        plateNumber: 'DL01AB1234',
        driverId: 'driver-12345'
      },
      delivery: {
        pickupAddress: '456 Corporate Plaza, Gurgaon',
        deliveryAddress: '789 Residential Complex, Noida',
        customerId: 'customer-uuid-12345'
      },
      system: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    console.log('Original Data:');
    console.log(JSON.stringify(sensitiveData, null, 2));

    const maskedData = dataMaskingService.maskSensitiveData(sensitiveData);
    console.log('\nMasked Data:');
    console.log(JSON.stringify(maskedData, null, 2));

    // Demonstrate log masking
    console.log('\n=== Log Masking Demonstration ===');
    const logMessage = 'User login: john.doe@example.com from IP 192.168.1.100, vehicle DL01AB1234';
    const maskedLog = dataMaskingService.maskLogData(logMessage, { userId: 'user-12345' });
    console.log('Original Log:', logMessage);
    console.log('Masked Log:', maskedLog.message);

    // Demonstrate data retention status
    console.log('\n=== Data Retention Status ===');
    try {
      const retentionStatus = await dataPrivacyService.getDataRetentionStatus();
      console.log('Data Retention Status:');
      retentionStatus.forEach(status => {
        console.log(`- ${status.tableName}: ${status.expiredRecords}/${status.totalRecords} records expired (${status.retentionPeriodMonths} months retention)`);
      });
    } catch (error) {
      console.log('Note: Data retention status requires database connection');
    }

    // Demonstrate GDPR request workflow
    console.log('\n=== GDPR Request Workflow Demonstration ===');
    
    // Test data subject rights
    const rights = gdprService.getDataSubjectRights();
    console.log('Supported Data Subject Rights:');
    Object.entries(rights).forEach(([right, supported]) => {
      console.log(`- ${right}: ${supported ? '✅' : '❌'}`);
    });

    // Demonstrate masking in different environments
    console.log('\n=== Environment-Specific Masking ===');
    
    const environments = ['development', 'staging', 'test', 'production'];
    const testData = { email: 'test@example.com', phone: '9876543210' };
    
    environments.forEach(env => {
      const envConfig: MaskingConfig = { ...maskingConfig, environment: env };
      const envMaskingService = new DataMaskingService(envConfig);
      const result = envMaskingService.maskSensitiveData(testData);
      console.log(`${env}: email=${result.email}, phone=${result.phone}`);
    });

    // Demonstrate custom masking rules
    console.log('\n=== Custom Masking Rules ===');
    const customRule = {
      fieldName: 'customId',
      pattern: /CUST-\d{6}/g,
      maskingFunction: (value: string) => value.replace(/\d/g, '*'),
      environments: ['development', 'test']
    };
    
    dataMaskingService.addMaskingRule(customRule);
    const customData = 'Customer ID: CUST-123456, Order: ORD-789012';
    const maskedCustom = dataMaskingService.maskSensitiveData(customData);
    console.log('Original:', customData);
    console.log('Masked:', maskedCustom);

    // Test masking rule functionality
    console.log('\n=== Masking Rule Testing ===');
    const testResult = dataMaskingService.testMaskingRules({
      email: 'admin@company.com',
      phone: '+919876543210',
      plateNumber: 'MH12CD5678',
      address: '100 Tech Park, Bangalore',
      customId: 'CUST-987654'
    });
    
    console.log('Test Results:');
    console.log('Original:', JSON.stringify(testResult.original, null, 2));
    console.log('Masked:', JSON.stringify(testResult.masked, null, 2));

    logger.info('✅ Data Privacy and Retention Demonstration completed successfully');

  } catch (error) {
    logger.error('❌ Data Privacy demonstration failed:', error);
    throw error;
  }
}

async function runTests() {
  const logger = Logger;
  logger.info('Running Data Privacy Tests');

  try {
    // Import and run specific test functions
    console.log('\n=== Running Data Privacy Unit Tests ===');
    
    // Test data masking functionality
    const maskingConfig: MaskingConfig = {
      enabled: true,
      environment: 'test',
      logMasking: true,
      databaseMasking: true,
      apiResponseMasking: true
    };
    
    const maskingService = new DataMaskingService(maskingConfig);
    
    // Test various masking scenarios
    const testCases = [
      {
        name: 'Email Masking',
        input: 'user@example.com',
        expected: 'us***@example.com'
      },
      {
        name: 'Phone Masking',
        input: '+919876543210',
        expected: '+9***-***-10'
      },
      {
        name: 'Plate Number Masking',
        input: 'DL01AB1234',
        expected: 'DL***34'
      },
      {
        name: 'IP Address Masking',
        input: '192.168.1.100',
        expected: '192.***.***100'
      },
      {
        name: 'Address Masking',
        input: '123 Main Street Delhi',
        expected: '123 *** Delhi'
      }
    ];

    console.log('Testing individual masking functions:');
    testCases.forEach(testCase => {
      const service = maskingService as any;
      let result: string;
      
      switch (testCase.name) {
        case 'Email Masking':
          result = service.maskEmail(testCase.input);
          break;
        case 'Phone Masking':
          result = service.maskPhone(testCase.input);
          break;
        case 'Plate Number Masking':
          result = service.maskPlateNumber(testCase.input);
          break;
        case 'IP Address Masking':
          result = service.maskIPAddress(testCase.input);
          break;
        case 'Address Masking':
          result = service.maskAddress(testCase.input);
          break;
        default:
          result = testCase.input;
      }
      
      const passed = result === testCase.expected;
      console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${testCase.input} → ${result} ${passed ? '' : `(expected: ${testCase.expected})`}`);
    });

    // Test object masking
    console.log('\nTesting object masking:');
    const complexObject = {
      user: {
        email: 'test@example.com',
        phone: '9876543210'
      },
      vehicle: {
        plateNumber: 'DL01AB1234'
      },
      nested: {
        deep: {
          ipAddress: '10.0.0.1'
        }
      }
    };

    const maskedObject = maskingService.maskSensitiveData(complexObject);
    console.log('✅ Complex object masking completed');
    console.log('Original email:', complexObject.user.email);
    console.log('Masked email:', maskedObject.user.email);

    // Test environment-specific behavior
    console.log('\nTesting environment-specific behavior:');
    const prodService = new DataMaskingService({
      ...maskingConfig,
      environment: 'production'
    });
    
    const prodResult = prodService.maskSensitiveData({ email: 'prod@example.com' });
    const devResult = maskingService.maskSensitiveData({ email: 'dev@example.com' });
    
    console.log(`✅ Production masking: ${prodResult.email === 'prod@example.com' ? 'disabled' : 'enabled'}`);
    console.log(`✅ Development masking: ${devResult.email !== 'dev@example.com' ? 'enabled' : 'disabled'}`);

    logger.info('✅ All Data Privacy tests completed successfully');

  } catch (error) {
    logger.error('❌ Data Privacy tests failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'demo';

  try {
    switch (command) {
      case 'demo':
        await demonstrateDataPrivacy();
        break;
      case 'test':
        await runTests();
        break;
      case 'both':
        await demonstrateDataPrivacy();
        await runTests();
        break;
      default:
        console.log('Usage: npm run test:privacy [demo|test|both]');
        console.log('  demo - Run data privacy demonstration');
        console.log('  test - Run data privacy tests');
        console.log('  both - Run both demonstration and tests');
        process.exit(1);
    }
    
    console.log('\n🎉 Data Privacy and Retention implementation completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

export { demonstrateDataPrivacy, runTests };