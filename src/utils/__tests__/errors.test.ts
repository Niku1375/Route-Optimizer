/**
 * Unit tests for error handling utilities
 */

import {
  LogisticsError,
  ValidationError,
  VehicleNotFoundError,
  RouteOptimizationError,
  ComplianceViolationError,
  ExternalAPIError,
  HubCapacityError,
  BufferVehicleUnavailableError,
  isOperationalError,
  handleError,
  asyncHandler,
  withRetry,
  RetryOptions,
} from '../errors';

describe('Error Handling Utilities', () => {
  describe('LogisticsError', () => {
    it('should create error with default values', () => {
      const error = new LogisticsError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('LOGISTICS_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('LogisticsError');
    });

    it('should create error with custom values', () => {
      const error = new LogisticsError('Custom error', 'CUSTOM_CODE', 400, false);
      
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error without field', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.message).toBe('Validation failed: Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should create validation error with field', () => {
      const error = new ValidationError('Invalid value', 'email');
      
      expect(error.message).toBe('Validation failed for email: Invalid value');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('VehicleNotFoundError', () => {
    it('should create vehicle not found error', () => {
      const error = new VehicleNotFoundError('V123');
      
      expect(error.message).toBe('Vehicle with ID V123 not found');
      expect(error.code).toBe('VEHICLE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('RouteOptimizationError', () => {
    it('should create route optimization error without cause', () => {
      const error = new RouteOptimizationError('Solver failed');
      
      expect(error.message).toBe('Route optimization failed: Solver failed');
      expect(error.code).toBe('ROUTE_OPTIMIZATION_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should create route optimization error with cause', () => {
      const cause = new Error('Original error');
      const error = new RouteOptimizationError('Solver failed', cause);
      
      expect(error.message).toBe('Route optimization failed: Solver failed');
      expect(error.stack).toContain('Caused by:');
    });
  });

  describe('ComplianceViolationError', () => {
    it('should create compliance violation error', () => {
      const violations = ['Time restriction', 'Zone violation'];
      const error = new ComplianceViolationError(violations);
      
      expect(error.message).toBe('Compliance violations detected: Time restriction, Zone violation');
      expect(error.code).toBe('COMPLIANCE_VIOLATION');
      expect(error.statusCode).toBe(400);
      expect(error.violations).toEqual(violations);
    });
  });

  describe('ExternalAPIError', () => {
    it('should create external API error without original error', () => {
      const error = new ExternalAPIError('GoogleMaps', 'API timeout');
      
      expect(error.message).toBe('External API error from GoogleMaps: API timeout');
      expect(error.code).toBe('EXTERNAL_API_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.apiName).toBe('GoogleMaps');
      expect(error.originalError).toBeUndefined();
    });

    it('should create external API error with original error', () => {
      const originalError = new Error('Network error');
      const error = new ExternalAPIError('GoogleMaps', 'API timeout', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('HubCapacityError', () => {
    it('should create hub capacity error', () => {
      const error = new HubCapacityError('HUB001', 100, 80);
      
      expect(error.message).toBe('Hub HUB001 capacity exceeded. Requested: 100, Available: 80');
      expect(error.code).toBe('HUB_CAPACITY_ERROR');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('BufferVehicleUnavailableError', () => {
    it('should create buffer vehicle unavailable error', () => {
      const error = new BufferVehicleUnavailableError('HUB001');
      
      expect(error.message).toBe('No buffer vehicles available at hub HUB001');
      expect(error.code).toBe('BUFFER_VEHICLE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for operational LogisticsError', () => {
      const error = new LogisticsError('Test error', 'TEST', 500, true);
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational LogisticsError', () => {
      const error = new LogisticsError('Test error', 'TEST', 500, false);
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should handle LogisticsError in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new LogisticsError('Test error', 'TEST_CODE', 400);
      const result = handleError(error);
      
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('TEST_CODE');
      expect(result.statusCode).toBe(400);
      expect(result.stack).toBeDefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle LogisticsError in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new LogisticsError('Test error', 'TEST_CODE', 400);
      const result = handleError(error);
      
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('TEST_CODE');
      expect(result.statusCode).toBe(400);
      expect(result.stack).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle regular Error in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Regular error');
      const result = handleError(error);
      
      expect(result.message).toBe('Internal server error');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.statusCode).toBe(500);
      expect(result.stack).toBeDefined();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle regular Error in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Regular error');
      const result = handleError(error);
      
      expect(result.message).toBe('Internal server error');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.statusCode).toBe(500);
      expect(result.stack).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const mockNext = jest.fn();
      const handler = asyncHandler(mockFn);
      
      await handler('req', 'res', mockNext);
      
      expect(mockFn).toHaveBeenCalledWith('req', 'res', mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle async function that throws', async () => {
      const error = new Error('Async error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const mockNext = jest.fn();
      const handler = asyncHandler(mockFn);
      
      await handler('req', 'res', mockNext);
      
      expect(mockFn).toHaveBeenCalledWith('req', 'res', mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('withRetry', () => {
    const defaultOptions: RetryOptions = {
      maxRetries: 2,
      backoffStrategy: 'exponential',
      baseDelay: 100,
      maxDelay: 1000,
      retryableErrors: ['timeout', 'network'],
    };

    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(mockOperation, defaultOptions);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and eventually succeed', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('timeout error'))
        .mockResolvedValue('success');
      
      const result = await withRetry(mockOperation, defaultOptions);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('validation error');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(mockOperation, defaultOptions)).rejects.toThrow('validation error');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw last error', async () => {
      const error = new Error('timeout error');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(withRetry(mockOperation, defaultOptions)).rejects.toThrow('timeout error');
      expect(mockOperation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should use linear backoff strategy', async () => {
      const linearOptions: RetryOptions = {
        ...defaultOptions,
        backoffStrategy: 'linear',
        baseDelay: 50,
      };
      
      const error = new Error('network error');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      const startTime = Date.now();
      await expect(withRetry(mockOperation, linearOptions)).rejects.toThrow('network error');
      const endTime = Date.now();
      
      // Should have some delay (at least 50ms + 100ms for linear backoff)
      expect(endTime - startTime).toBeGreaterThan(100);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });
});