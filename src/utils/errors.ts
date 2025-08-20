/**
 * Custom error classes and error handling utilities
 */

export class LogisticsError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'LOGISTICS_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends LogisticsError {
  constructor(message: string, field?: string) {
    super(
      field ? `Validation failed for ${field}: ${message}` : `Validation failed: ${message}`,
      'VALIDATION_ERROR',
      400
    );
  }
}

export class NotFoundError extends LogisticsError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
  }
}

export class VehicleNotFoundError extends LogisticsError {
  constructor(vehicleId: string) {
    super(
      `Vehicle with ID ${vehicleId} not found`,
      'VEHICLE_NOT_FOUND',
      404
    );
  }
}

export class RouteOptimizationError extends LogisticsError {
  constructor(message: string, cause?: Error) {
    super(
      `Route optimization failed: ${message}`,
      'ROUTE_OPTIMIZATION_ERROR',
      500
    );
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class ComplianceViolationError extends LogisticsError {
  public readonly violations: string[];

  constructor(violations: string[]) {
    super(
      `Compliance violations detected: ${violations.join(', ')}`,
      'COMPLIANCE_VIOLATION',
      400
    );
    this.violations = violations;
  }
}

export class ExternalAPIError extends LogisticsError {
  public readonly apiName: string;
  public readonly originalError: Error | undefined;

  constructor(apiName: string, message: string, originalError?: Error) {
    super(
      `External API error from ${apiName}: ${message}`,
      'EXTERNAL_API_ERROR',
      503
    );
    this.apiName = apiName;
    this.originalError = originalError;
  }
}

export class HubCapacityError extends LogisticsError {
  constructor(hubId: string, requestedCapacity: number, availableCapacity: number) {
    super(
      `Hub ${hubId} capacity exceeded. Requested: ${requestedCapacity}, Available: ${availableCapacity}`,
      'HUB_CAPACITY_ERROR',
      409
    );
  }
}

export class BufferVehicleUnavailableError extends LogisticsError {
  constructor(hubId: string) {
    super(
      `No buffer vehicles available at hub ${hubId}`,
      'BUFFER_VEHICLE_UNAVAILABLE',
      503
    );
  }
}

/**
 * Error handler utility functions
 */
export const isOperationalError = (error: Error): boolean => {
  if (error instanceof LogisticsError) {
    return error.isOperational;
  }
  return false;
};

export const handleError = (error: Error): {
  message: string;
  code: string;
  statusCode: number;
  stack?: string;
} => {
  if (error instanceof LogisticsError) {
    const result: {
      message: string;
      code: string;
      statusCode: number;
      stack?: string;
    } = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
    
    if (process.env.NODE_ENV === 'development' && error.stack) {
      result.stack = error.stack;
    }
    
    return result;
  }

  // Handle unknown errors
  const result: {
    message: string;
    code: string;
    statusCode: number;
    stack?: string;
  } = {
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
  
  if (process.env.NODE_ENV === 'development' && error.stack) {
    result.stack = error.stack;
  }
  
  return result;
};

/**
 * Async error wrapper for handling promises
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Retry mechanism for external API calls
 */
export interface RetryOptions {
  maxRetries: number;
  backoffStrategy: 'exponential' | 'linear';
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = options.retryableErrors.some(retryableError => 
        error instanceof Error && error.message.includes(retryableError)
      );
      
      if (!isRetryable || attempt === options.maxRetries) {
        throw error;
      }
      
      // Calculate delay
      const delay = options.backoffStrategy === 'exponential'
        ? Math.min(options.baseDelay * Math.pow(2, attempt), options.maxDelay)
        : Math.min(options.baseDelay * (attempt + 1), options.maxDelay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};