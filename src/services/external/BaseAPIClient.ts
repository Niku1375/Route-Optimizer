/**
 * Base API client with common functionality for external API integrations
 */

import { APIClientConfig, ExternalAPIResponse } from '../../models/Traffic';

export abstract class BaseAPIClient {
  protected config: APIClientConfig;
  protected cache: Map<string, any> = new Map();

  constructor(config: APIClientConfig) {
    this.config = config;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ExternalAPIResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as T;
        
        return {
          data,
          success: true,
          timestamp: new Date(),
          source: this.constructor.name,
          cached: false,
        };

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    // All retries failed, return error response
    return {
      data: null as any,
      success: false,
      error: lastError?.message || 'Unknown error',
      timestamp: new Date(),
      source: this.constructor.name,
      cached: false,
    };
  }

  /**
   * Get cached data if available and not expired
   */
  protected getCachedData<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(cacheKey); // Remove expired cache
    }
    
    return null;
  }

  /**
   * Cache data with expiration
   */
  protected setCachedData<T>(cacheKey: string, data: T): void {
    const expiresAt = new Date(Date.now() + this.config.cacheTimeout * 1000);
    this.cache.set(cacheKey, {
      data,
      timestamp: new Date(),
      expiresAt,
      source: this.constructor.name,
    });
  }

  /**
   * Get cached response with proper metadata
   */
  protected getCachedResponse<T>(cacheKey: string): ExternalAPIResponse<T> | null {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return {
        data: cached.data,
        success: true,
        timestamp: cached.timestamp,
        source: this.constructor.name,
        cached: true,
      };
    }
    return null;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate cache key from parameters
   */
  protected generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): void {
    const now = new Date();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { total: number; expired: number; active: number } {
    const now = new Date();
    let expired = 0;
    let active = 0;

    for (const [, value] of this.cache.entries()) {
      if (value.expiresAt <= now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      expired,
      active,
    };
  }
}