import { describe, it, expect, beforeAll } from 'vitest';
import i18n from './config';

describe('i18n Performance', () => {
  beforeAll(async () => {
    // Wait for i18n to initialize
    if (!i18n.isInitialized) {
      await i18n.init();
    }
  });

  it('should load translations within 500ms', async () => {
    const startTime = performance.now();
    
    // Reinitialize to measure load time
    await i18n.init();
    
    const loadTime = performance.now() - startTime;
    
    console.log(`Translation load time: ${loadTime.toFixed(2)}ms`);
    
    // Requirement 14.1: Translations should load within 500ms
    expect(loadTime).toBeLessThan(500);
  });

  it('should have all namespaces loaded', () => {
    const namespaces = ['kiosk', 'admin', 'common', 'validation'];
    
    namespaces.forEach(ns => {
      expect(i18n.hasResourceBundle('tr', ns)).toBe(true);
    });
  });

  it('should cache translations', () => {
    // First access
    const start1 = performance.now();
    const text1 = i18n.t('common:actions.save');
    const time1 = performance.now() - start1;
    
    // Second access (should be cached)
    const start2 = performance.now();
    const text2 = i18n.t('common:actions.save');
    const time2 = performance.now() - start2;
    
    expect(text1).toBe(text2);
    // Cached access should be faster
    expect(time2).toBeLessThanOrEqual(time1);
  });

  it('should translate common keys quickly', () => {
    const keys = [
      'common:actions.save',
      'common:actions.cancel',
      'common:status.active',
      'validation:required',
    ];
    
    keys.forEach(key => {
      const start = performance.now();
      const translation = i18n.t(key);
      const time = performance.now() - start;
      
      expect(translation).toBeTruthy();
      expect(time).toBeLessThan(10); // Each translation should be < 10ms
    });
  });

  it('should handle interpolation efficiently', () => {
    const start = performance.now();
    const translation = i18n.t('validation:fileSize', { max: 50 });
    const time = performance.now() - start;
    
    expect(translation).toContain('50');
    expect(time).toBeLessThan(10);
  });
});
