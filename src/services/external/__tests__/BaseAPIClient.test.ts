/**
 * Unit tests for BaseAPIClient
 */

import { BaseAPIClient } from '../BaseAPIClient';
import { APIClientConfig } from '../../../models/Traffic';

// Create a concrete implementation for testing
class TestAPIClient extends BaseAPIClient {
  constructor(config: APIClientConfig) {
    super(config);
  }

  // Expose protected methods for testing
  public async testMakeRequest<T>(endpoint: string, options?: RequestInit) {
    return this.makeRequest<T>(endpoint, options);
  }

  public testGetCachedData<T>(cacheKey: string) {
    return this.getCachedData<T>(cacheKey);
  }

  public testSetCachedData<T>(cacheKey: string, data: T) {
    return this.setCachedData(cacheKey, data);
  }

  public testGetCachedResponse<T>(cacheKey: string) {
    return this.getCachedResponse<T>(cacheKey);
  }

  public testGenerateCacheKey(prefix: string, params: Record<string, any>) {
    return this.generateCacheKey(prefix, params);
  }
}

// Mock fetch globally
global.fetch = jest.fn();

describe('BaseAPIClient', () => {
  let client: TestAPIClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const testConfig: APIClientConfig = {
    baseUrl: 'https://api.example.com',
    apiKey: 'test-api-key',
    timeout: 5000,
    retryAttempts: 2,
    retryDelay: 100,
    cacheTimeout: 300,
  };

  beforeEach(() => {
    client = new TestAPIClient(testConfig);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
  });

  describe('makeRequest', () => {
    it('should make successful HTTP request', async () => {
      const mockResponseData = { message: 'success' };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponseData),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await client.testMakeRequest('/test-endpoint');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponseData);
      expect(result.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await client.testMakeRequest('/test-endpoint');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should retry on failure with exponential backoff', async () => {
      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        } as any);

      const startTime = Date.now();
      const result = await client.testMakeRequest('/test-endpoint');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Should have some delay due to retries (at least 100ms + 200ms)
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const result = await client.testMakeRequest('/test-endpoint');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent network error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle timeout', async () => {
      // Mock a request that never resolves
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const shortTimeoutClient = new TestAPIClient({
        ...testConfig,
        timeout: 100, // Very short timeout
      });

      const result = await shortTimeoutClient.testMakeRequest('/test-endpoint');

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });
  });

  describe('caching', () => {
    it('should cache and retrieve data', () => {
      const testData = { value: 'test' };
      const cacheKey = 'test-key';

      // Initially no cached data
      expect(client.testGetCachedData(cacheKey)).toBeNull();

      // Set cached data
      client.testSetCachedData(cacheKey, testData);

      // Should retrieve cached data
      expect(client.testGetCachedData(cacheKey)).toEqual(testData);
    });

    it('should return null for expired cache', async () => {
      const testData = { value: 'test' };
      const cacheKey = 'test-key';

      // Create client with very short cache timeout
      const shortCacheClient = new TestAPIClient({
        ...testConfig,
        cacheTimeout: 0.1, // 0.1 seconds
      });

      shortCacheClient.testSetCachedData(cacheKey, testData);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(shortCacheClient.testGetCachedData(cacheKey)).toBeNull();
    });

    it('should return cached response with metadata', () => {
      const testData = { value: 'test' };
      const cacheKey = 'test-key';

      client.testSetCachedData(cacheKey, testData);

      const cachedResponse = client.testGetCachedResponse(cacheKey);

      expect(cachedResponse).not.toBeNull();
      expect(cachedResponse!.data).toEqual(testData);
      expect(cachedResponse!.success).toBe(true);
      expect(cachedResponse!.cached).toBe(true);
      expect(cachedResponse!.source).toBe('TestAPIClient');
    });

    it('should generate consistent cache keys', () => {
      const params1 = { lat: 28.6139, lng: 77.2090, type: 'traffic' };
      const params2 = { type: 'traffic', lng: 77.2090, lat: 28.6139 }; // Different order

      const key1 = client.testGenerateCacheKey('test', params1);
      const key2 = client.testGenerateCacheKey('test', params2);

      expect(key1).toBe(key2); // Should be same despite different parameter order
    });
  });

  describe('cache management', () => {
    it('should clear expired cache entries', async () => {
      const shortCacheClient = new TestAPIClient({
        ...testConfig,
        cacheTimeout: 0.1, // 0.1 seconds
      });

      // Add some cache entries
      shortCacheClient.testSetCachedData('key1', { value: 1 });
      shortCacheClient.testSetCachedData('key2', { value: 2 });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Add a fresh entry
      shortCacheClient.testSetCachedData('key3', { value: 3 });

      const statsBefore = shortCacheClient.getCacheStats();
      expect(statsBefore.total).toBe(3);

      // Clear expired cache
      shortCacheClient.clearExpiredCache();

      const statsAfter = shortCacheClient.getCacheStats();
      expect(statsAfter.total).toBe(1); // Only key3 should remain
      expect(statsAfter.active).toBe(1);
      expect(statsAfter.expired).toBe(0);
    });

    it('should provide accurate cache statistics', () => {
      // Add some cache entries
      client.testSetCachedData('key1', { value: 1 });
      client.testSetCachedData('key2', { value: 2 });
      client.testSetCachedData('key3', { value: 3 });

      const stats = client.getCacheStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(3);
      expect(stats.expired).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await client.testMakeRequest('/test-endpoint');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network unreachable'));

      const result = await client.testMakeRequest('/test-endpoint');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network unreachable');
    });
  });

  describe('configuration', () => {
    it('should work without API key', async () => {
      const clientWithoutKey = new TestAPIClient({
        ...testConfig,
        apiKey: '',
      });

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await clientWithoutKey.testMakeRequest('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test-endpoint',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should respect custom headers', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await client.testMakeRequest('/test-endpoint', {
        headers: {
          'Custom-Header': 'custom-value',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'custom-value',
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });
  });
});