import { describe, it, expect, beforeAll } from 'vitest';
import i18n from './config.js';

describe('Backend i18n Configuration', () => {
  beforeAll(async () => {
    // Wait for i18n to initialize
    if (!i18n.isInitialized) {
      await new Promise((resolve) => {
        i18n.on('initialized', resolve);
      });
    }
  });

  it('should be initialized with Turkish language', () => {
    expect(i18n.language).toBe('tr');
  });

  it('should have all required namespaces', () => {
    const namespaces = ['errors', 'validation', 'success', 'logs'];
    namespaces.forEach((ns) => {
      expect(i18n.hasResourceBundle('tr', ns)).toBe(true);
    });
  });

  it('should translate error messages', () => {
    expect(i18n.t('errors:notFound')).toBe('İstenen kaynak bulunamadı');
    expect(i18n.t('errors:unauthorized')).toBe('Bu işlem için yetkiniz yok');
    expect(i18n.t('errors:internalError')).toBe('Bir hata oluştu. Lütfen daha sonra tekrar deneyin');
  });

  it('should translate validation messages with parameters', () => {
    expect(i18n.t('validation:required', { field: 'Email' })).toBe('Email alanı zorunludur');
    expect(i18n.t('validation:tooShort', { field: 'Şifre', min: 8 })).toBe('Şifre en az 8 karakter olmalıdır');
  });

  it('should translate success messages', () => {
    expect(i18n.t('success:created')).toBe('Başarıyla oluşturuldu');
    expect(i18n.t('success:updated')).toBe('Başarıyla güncellendi');
    expect(i18n.t('success:deleted')).toBe('Başarıyla silindi');
  });

  it('should translate log messages', () => {
    expect(i18n.t('logs:serverStarted')).toBe('Sunucu başlatıldı');
    expect(i18n.t('logs:syncCompleted')).toBe('Senkronizasyon tamamlandı');
  });

  it('should handle interpolation correctly', () => {
    const message = i18n.t('validation:outOfRange', { field: 'Yaş', min: 18, max: 65 });
    expect(message).toBe('Yaş 18 ile 65 arasında olmalıdır');
  });
});
