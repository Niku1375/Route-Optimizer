/**
 * Environment Configuration Loader
 * Securely loads API keys and configuration from environment variables
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Fallback to default .env file
dotenv.config();

export interface EnvironmentConfig {
  // Application
  nodeEnv: string;
  port: number;
  websocketPort: number;

  // Database
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };

  // Redis
  redis: {
    host: string;
    port: number;
    password?: string;
    database: number;
  };

  // External APIs
  apis: {
    googleMaps: {
      apiKey: string;
      baseUrl: string;
    };
    mapbox: {
      accessToken: string;
      baseUrl: string;
    };
    graphHopper: {
      apiKey: string;
      baseUrl: string;
    };
    mapmyindia: {
      apiKey: string;
      baseUrl: string;
    };
    openWeatherMap: {
      apiKey: string;
      baseUrl: string;
    };
    ambee: {
      apiKey: string;
      baseUrl: string;
    };
  };

  // Security
  jwt: {
    secret: string;
    expiry: string;
    refreshExpiry: string;
  };

  // Monitoring
  monitoring: {
    slackWebhook?: string;
    alertEmail?: string;
  };

  // Rate Limiting
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
}

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

export const config: EnvironmentConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  websocketPort: parseInt(process.env.WEBSOCKET_PORT || '3001', 10),

  database: {
    host: getRequiredEnvVar('DATABASE_HOST'),
    port: parseInt(getRequiredEnvVar('DATABASE_PORT'), 10),
    name: getRequiredEnvVar('DATABASE_NAME'),
    user: getRequiredEnvVar('DATABASE_USER'),
    password: getRequiredEnvVar('DATABASE_PASSWORD'),
    ssl: process.env.DATABASE_SSL === 'true',
  },

  redis: {
    host: getRequiredEnvVar('REDIS_HOST'),
    port: parseInt(getRequiredEnvVar('REDIS_PORT'), 10),
    password: getOptionalEnvVar('REDIS_PASSWORD'),
    database: parseInt(getOptionalEnvVar('REDIS_DATABASE', '0'), 10),
  },

  apis: {
    googleMaps: {
      apiKey: getRequiredEnvVar('GOOGLE_MAPS_API_KEY'),
      baseUrl: 'https://maps.googleapis.com/maps/api',
    },
    mapbox: {
      accessToken: getRequiredEnvVar('MAPBOX_ACCESS_TOKEN'),
      baseUrl: 'https://api.mapbox.com',
    },
    graphHopper: {
      apiKey: getRequiredEnvVar('GRAPHHOPPER_API_KEY'),
      baseUrl: 'https://graphhopper.com/api/1',
    },
    mapmyindia: {
      apiKey: getOptionalEnvVar('MAPMYINDIA_API_KEY'),
      baseUrl: 'https://apis.mapmyindia.com/advancedmaps/v1',
    },
    openWeatherMap: {
      apiKey: getOptionalEnvVar('OPENWEATHERMAP_API_KEY'),
      baseUrl: 'https://api.openweathermap.org/data/2.5',
    },
    ambee: {
      apiKey: getOptionalEnvVar('AMBEE_API_KEY'),
      baseUrl: 'https://api.ambeedata.com',
    },
  },

  jwt: {
    secret: getRequiredEnvVar('JWT_SECRET'),
    expiry: getOptionalEnvVar('JWT_EXPIRY', '24h'),
    refreshExpiry: getOptionalEnvVar('JWT_REFRESH_EXPIRY', '7d'),
  },

  monitoring: {
    slackWebhook: getOptionalEnvVar('SLACK_WEBHOOK_URL'),
    alertEmail: getOptionalEnvVar('ALERT_EMAIL'),
  },

  rateLimiting: {
    windowMs: parseInt(getOptionalEnvVar('RATE_LIMIT_WINDOW', '15'), 10) * 60 * 1000,
    maxRequests: parseInt(getOptionalEnvVar('RATE_LIMIT_MAX_REQUESTS', '1000'), 10),
  },
};

// Validate critical configuration on startup
export function validateConfig(): void {
  const requiredApis = ['googleMaps', 'mapbox', 'graphHopper', 'mapmyindia', 'openWeatherMap', 'ambee'];
  
  for (const apiName of requiredApis) {
    const apiConfig = config.apis[apiName as keyof typeof config.apis];

    if (apiName === 'mapbox') {
      if (!('accessToken' in apiConfig) || !apiConfig.accessToken) {
        throw new Error(`${apiName} API configuration is missing required 'accessToken'`);
      }
    } else {
      if (!('apiKey' in apiConfig) || !apiConfig.apiKey) {
        throw new Error(`${apiName} API configuration is missing required 'apiKey'`);
      }
    }
  }

  console.log('✅ Environment configuration validated successfully');
  console.log(`🚀 Running in ${config.nodeEnv} mode`);
  console.log(`📡 Application will start on port ${config.port}`);
}

export default config;