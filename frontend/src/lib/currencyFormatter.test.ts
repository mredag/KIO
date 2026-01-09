import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyWithDecimals,
  formatCurrencyWithoutDecimals,
} from './currencyFormatter';

describe('currencyFormatter', () => {
  describe('formatCurrency', () => {
    it('should format whole numbers without decimals by default', () => {
      expect(formatCurrency(1250)).toBe('₺1.250');
      expect(formatCurrency(100)).toBe('₺100');
      expect(formatCurrency(1000000)).toBe('₺1.000.000');
    });

    it('should format numbers with decimals when they have non-zero decimal part', () => {
      expect(formatCurrency(1250.50)).toBe('₺1.250,50');
      expect(formatCurrency(1250.99)).toBe('₺1.250,99');
      expect(formatCurrency(100.01)).toBe('₺100,01');
    });

    it('should handle zero correctly', () => {
      expect(formatCurrency(0)).toBe('₺0');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-1250)).toBe('-₺1.250');
      expect(formatCurrency(-1250.50)).toBe('-₺1.250,50');
    });

    it('should respect showDecimals option', () => {
      expect(formatCurrency(1250, { showDecimals: true })).toBe('₺1.250,00');
      expect(formatCurrency(1250.50, { showDecimals: true })).toBe('₺1.250,50');
    });

    it('should respect custom fraction digits', () => {
      expect(
        formatCurrency(1250.123, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3,
        })
      ).toBe('₺1.250,123');
    });
  });

  describe('formatCurrencyWithDecimals', () => {
    it('should always show 2 decimal places', () => {
      expect(formatCurrencyWithDecimals(1250)).toBe('₺1.250,00');
      expect(formatCurrencyWithDecimals(1250.5)).toBe('₺1.250,50');
      expect(formatCurrencyWithDecimals(1250.99)).toBe('₺1.250,99');
    });

    it('should handle zero with decimals', () => {
      expect(formatCurrencyWithDecimals(0)).toBe('₺0,00');
    });
  });

  describe('formatCurrencyWithoutDecimals', () => {
    it('should never show decimal places', () => {
      expect(formatCurrencyWithoutDecimals(1250)).toBe('₺1.250');
      expect(formatCurrencyWithoutDecimals(1250.99)).toBe('₺1.251'); // Rounded
      expect(formatCurrencyWithoutDecimals(1250.49)).toBe('₺1.250'); // Rounded down
    });

    it('should handle zero without decimals', () => {
      expect(formatCurrencyWithoutDecimals(0)).toBe('₺0');
    });
  });

  describe('Turkish locale formatting', () => {
    it('should use dot as thousands separator', () => {
      expect(formatCurrency(1000)).toBe('₺1.000');
      expect(formatCurrency(1000000)).toBe('₺1.000.000');
    });

    it('should use comma as decimal separator', () => {
      expect(formatCurrency(1250.50)).toBe('₺1.250,50');
      expect(formatCurrency(99.99)).toBe('₺99,99');
    });

    it('should use Turkish Lira symbol (₺)', () => {
      expect(formatCurrency(100)).toContain('₺');
      expect(formatCurrency(100)).not.toContain('TRY');
      expect(formatCurrency(100)).not.toContain('TL');
    });
  });
});
