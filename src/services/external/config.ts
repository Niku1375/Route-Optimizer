/**
 * External API Configuration
 * Loads API configurations from environment variables
 */

import { config } from '../../config/environment';
import { APIClientConfig } from '../../models/Traffic';

export const externalAPIConfigs = {
  googleMaps: {
    baseUrl: config.apis.googleMaps.baseUrl,
    apiKey: config.apis.googleMaps.apiKey,
    timeout: 10000,
    retryAttempts: 3,
    cacheTimeout: 600, // 10 minutes
  } as APIClientConfig,

  mapbox: {
    baseUrl: config.apis.mapbox.baseUrl,
    apiKey: config.apis.mapbox.accessToken,
    timeout: 8000,
    retryAttempts: 2,
    cacheTimeout: 300, // 5 minutes
  } as APIClientConfig,

  graphHopper: {
    baseUrl: config.apis.graphHopper.baseUrl,
    apiKey: config.apis.graphHopper.apiKey,
    timeout: 12000,
    retryAttempts: 2,
    cacheTimeout: 900, // 15 minutes
  } as APIClientConfig,

  mapmyindia: {
    baseUrl: config.apis.mapmyindia.baseUrl,
    apiKey: config.apis.mapmyindia.apiKey,
    timeout: 10000,
    retryAttempts: 3,
    cacheTimeout: 300, // 5 minutes for real-time traffic
  } as APIClientConfig,

  openWeatherMap: {
    baseUrl: config.apis.openWeatherMap.baseUrl,
    apiKey: config.apis.openWeatherMap.apiKey,
    timeout: 8000,
    retryAttempts: 2,
    cacheTimeout: 1800, // 30 minutes
  } as APIClientConfig,

  ambee: {
    baseUrl: config.apis.ambee.baseUrl,
    apiKey: config.apis.ambee.apiKey,
    timeout: 8000,
    retryAttempts: 2,
    cacheTimeout: 3600, // 1 hour
  } as APIClientConfig,
};

export default externalAPIConfigs;