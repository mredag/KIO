import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatTime, formatRelativeTime } from './dateFormatter';

describe('dateFormatter', () => {
  const testDate = new Date('2024-11-23T14:30:00');

  describe('formatDate', () => {
    it('should format date in DD.MM.YYYY format', () => {
      const result = formatDate(testDate);
      expect(result).toBe('23.11.2024');
    });

    it('should handle ISO string input', () => {
      const result = formatDate('2024-11-23T14:30:00');
      expect(result).toBe('23.11.2024');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time in DD.MM.YYYY HH:mm format', () => {
      const result = formatDateTime(testDate);
      expect(result).toBe('23.11.2024 14:30');
    });

    it('should handle ISO string input', () => {
      const result = formatDateTime('2024-11-23T14:30:00');
      expect(result).toBe('23.11.2024 14:30');
    });
  });

  describe('formatTime', () => {
    it('should format time in 24-hour HH:mm format', () => {
      const result = formatTime(testDate);
      expect(result).toBe('14:30');
    });

    it('should handle ISO string input', () => {
      const result = formatTime('2024-11-23T14:30:00');
      expect(result).toBe('14:30');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time in Turkish', () => {
      const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = formatRelativeTime(recentDate);
      expect(result).toContain('saat');
      expect(result).toContain('önce');
    });

    it('should handle ISO string input', () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const result = formatRelativeTime(recentDate.toISOString());
      expect(result).toContain('dakika');
      expect(result).toContain('önce');
    });
  });
});
