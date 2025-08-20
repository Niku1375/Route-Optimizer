import { CacheService } from '../CacheService';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  it('should create cache service instance', () => {
    expect(cacheService).toBeDefined();
  });

  it('should handle connect method', async () => {
    await expect(cacheService.connect()).resolves.not.toThrow();
  });

  it('should handle disconnect method', async () => {
    await expect(cacheService.disconnect()).resolves.not.toThrow();
  });

  it('should handle flushAll method', async () => {
    await expect(cacheService.flushAll()).resolves.not.toThrow();
  });
});