import { describe, it, expect } from 'vitest';
import { QRCodeService } from './QRCodeService.js';

describe('QRCodeService', () => {
  const qrService = new QRCodeService();

  describe('generateQR', () => {
    it('should generate QR code for valid URL', async () => {
      const url = 'https://www.google.com/maps/place/Example+Spa';
      const result = await qrService.generateQR(url);

      // Should return a data URL
      expect(result).toMatch(/^data:image\/png;base64,/);
      expect(result.length).toBeGreaterThan(100);
    });

    it('should generate QR code for Google review URL', async () => {
      const url = 'https://g.page/r/CdXXXXXXXXXXXXXX/review';
      const result = await qrService.generateQR(url);

      expect(result).toMatch(/^data:image\/png;base64,/);
      expect(result.length).toBeGreaterThan(100);
    });

    it('should throw error for empty URL', async () => {
      await expect(qrService.generateQR('')).rejects.toThrow('URL is required');
    });

    it('should throw error for invalid URL format', async () => {
      await expect(qrService.generateQR('not-a-valid-url')).rejects.toThrow('Invalid URL format');
    });

    it('should throw error for null URL', async () => {
      await expect(qrService.generateQR(null as any)).rejects.toThrow('URL is required');
    });

    it('should throw error for undefined URL', async () => {
      await expect(qrService.generateQR(undefined as any)).rejects.toThrow('URL is required');
    });

    it('should handle URLs with special characters', async () => {
      const url = 'https://example.com/path?param=value&other=123';
      const result = await qrService.generateQR(url);

      expect(result).toMatch(/^data:image\/png;base64,/);
      expect(result.length).toBeGreaterThan(100);
    });
  });

  describe('generateQRBuffer', () => {
    it('should generate QR code buffer for valid URL', async () => {
      const url = 'https://www.google.com/maps/place/Example+Spa';
      const result = await qrService.generateQRBuffer(url);

      // Should return a Buffer
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(100);
    });

    it('should throw error for empty URL', async () => {
      await expect(qrService.generateQRBuffer('')).rejects.toThrow('URL is required');
    });

    it('should throw error for invalid URL format', async () => {
      await expect(qrService.generateQRBuffer('invalid-url')).rejects.toThrow('Invalid URL format');
    });
  });
});
