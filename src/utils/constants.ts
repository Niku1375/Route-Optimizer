/**
 * System-wide constants and configuration values
 */

// Delhi-specific constants
export const DELHI_CONSTANTS = {
  // Vehicle movement restrictions
  TRUCK_RESTRICTED_HOURS: {
    START: '23:00',
    END: '07:00',
  },
  
  // Zone types
  ZONE_TYPES: {
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial',
    MIXED: 'mixed',
  } as const,
  
  // Vehicle access privileges
  ACCESS_ZONES: {
    NARROW_LANES: 'narrow_lanes',
    POLLUTION_SENSITIVE: 'pollution_sensitive',
    RESTRICTED_HOURS: 'restricted_hours',
  } as const,
  
  // Pollution levels
  POLLUTION_LEVELS: {
    BS6: 'BS6',
    BS4: 'BS4',
    BS3: 'BS3',
    ELECTRIC: 'electric',
  } as const,
};

// System performance constants
export const PERFORMANCE_CONSTANTS = {
  // Route optimization targets
  MAX_OPTIMIZATION_TIME_MS: 10000, // 10 seconds
  MAX_API_RESPONSE_TIME_MS: 5000,  // 5 seconds
  
  // Cache TTL values (in seconds)
  VEHICLE_SEARCH_CACHE_TTL: 300,    // 5 minutes
  TRAFFIC_DATA_CACHE_TTL: 600,      // 10 minutes
  ROUTE_CACHE_TTL: 1800,            // 30 minutes
  
  // Retry configuration
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 5000,
  
  // Coverage targets
  MIN_CODE_COVERAGE_PERCENT: 90,
};

// Business logic constants
export const BUSINESS_CONSTANTS = {
  // Capacity limits
  MAX_VEHICLE_CAPACITY_KG: 10000,
  MAX_VEHICLE_CAPACITY_M3: 50,
  
  // Time windows
  MIN_DELIVERY_WINDOW_HOURS: 1,
  MAX_DELIVERY_WINDOW_HOURS: 24,
  
  // Hub operations
  DEFAULT_BUFFER_VEHICLE_RATIO: 0.1, // 10% of fleet as buffer
  MAX_HUB_CAPACITY_UTILIZATION: 0.9, // 90% max utilization
  
  // Driver working hours
  MAX_DRIVER_WORKING_HOURS: 10,
  MIN_DRIVER_REST_HOURS: 8,
  
  // Route optimization
  MIN_EFFICIENCY_IMPROVEMENT_PERCENT: 20,
  MAX_ROUTE_STOPS: 50,
  
  // Loyalty program
  LOYALTY_TIERS: {
    BRONZE: { MIN_DELIVERIES: 0, MAX_DELIVERIES: 10, DISCOUNT: 5 },
    SILVER: { MIN_DELIVERIES: 11, MAX_DELIVERIES: 25, DISCOUNT: 10 },
    GOLD: { MIN_DELIVERIES: 26, MAX_DELIVERIES: 50, DISCOUNT: 15 },
    PLATINUM: { MIN_DELIVERIES: 51, MAX_DELIVERIES: Infinity, DISCOUNT: 25 },
  },
  
  // Premium service pricing
  PREMIUM_SERVICE_MULTIPLIER: 1.8,
  EXCLUSIVITY_FEE_PERCENT: 0.4,
};

// API endpoints and external services
export const API_CONSTANTS = {
  // External API endpoints
  GOOGLE_MAPS_API: 'https://maps.googleapis.com/maps/api',
  MAPMYINDIA_API: 'https://apis.mapmyindia.com/advancedmaps/v1',
  IMD_WEATHER_API: 'https://mausam.imd.gov.in/api',
  AMBEE_AIR_QUALITY_API: 'https://api.ambeedata.com',
  MAPBOX_API: 'https://api.mapbox.com',
  GRAPHHOPPER_API: 'https://graphhopper.com/api',
  
  // Rate limiting
  DEFAULT_RATE_LIMIT: 100, // requests per minute
  PREMIUM_RATE_LIMIT: 500, // requests per minute
  
  // Timeouts
  EXTERNAL_API_TIMEOUT_MS: 10000, // 10 seconds
  DATABASE_TIMEOUT_MS: 5000,      // 5 seconds
};

// Error codes
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  INVALID_TIME_WINDOW: 'INVALID_TIME_WINDOW',
  INVALID_CAPACITY: 'INVALID_CAPACITY',
  
  // Business logic errors
  VEHICLE_NOT_FOUND: 'VEHICLE_NOT_FOUND',
  ROUTE_OPTIMIZATION_FAILED: 'ROUTE_OPTIMIZATION_FAILED',
  COMPLIANCE_VIOLATION: 'COMPLIANCE_VIOLATION',
  HUB_CAPACITY_EXCEEDED: 'HUB_CAPACITY_EXCEEDED',
  BUFFER_VEHICLE_UNAVAILABLE: 'BUFFER_VEHICLE_UNAVAILABLE',
  
  // External service errors
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  TRAFFIC_API_UNAVAILABLE: 'TRAFFIC_API_UNAVAILABLE',
  MAPS_API_ERROR: 'MAPS_API_ERROR',
  
  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;