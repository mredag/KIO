import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isOffline, getCacheStats } from './serviceWorkerRegistration';

describe('Service Worker Registration', () => {
  let originalNavigator: any;

  beforeEach(() => {
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  describe('isOffline', () => {
    it('should return true when navigator.onLine is false', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: false,
      });

      expect(isOffline()).toBe(true);
    });

    it('should return false when navigator.onLine is true', () => {
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      expect(isOffline()).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return null if caches API is not available', async () => {
      const originalCaches = (global as any).caches;
      delete (global as any).caches;

      const stats = await getCacheStats();
      expect(stats).toBeNull();

      (global as any).caches = originalCaches;
    });

    it('should return cache statistics when caches API is available', async () => {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([
          new Request('/test1'),
          new Request('/test2'),
        ]),
      };

      (global as any).caches = {
        keys: vi.fn().mockResolvedValue(['cache-v1', 'cache-v2']),
        open: vi.fn().mockResolvedValue(mockCache),
      };

      const stats = await getCacheStats();
      
      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats?.length).toBe(2);
      expect(stats?.[0]).toHaveProperty('name');
      expect(stats?.[0]).toHaveProperty('size');
    });
  });
});
