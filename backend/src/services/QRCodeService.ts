import QRCode from 'qrcode';

/**
 * QRCodeService handles QR code generation operations
 * - QR code generation using qrcode library
 * - Returns base64 data URL for embedding
 * - Error handling for invalid URLs
 * Requirements: 8.2, 8.4
 */
export class QRCodeService {
  /**
   * Generate QR code from URL and return as base64 data URL
   * Requirements: 8.2 - QR code generation
   * 
   * @param url - The URL to encode in the QR code
   * @returns Promise resolving to base64 data URL (e.g., "data:image/png;base64,...")
   * @throws Error if URL is invalid or QR generation fails
   */
  async generateQR(url: string): Promise<string> {
    try {
      // Validate URL
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        throw new Error('URL is required and must be a non-empty string');
      }

      // Basic URL validation - check if it's a valid URL format
      try {
        new URL(url);
      } catch {
        throw new Error('Invalid URL format');
      }

      // Generate QR code as base64 data URL
      // Options:
      // - type: 'image/png' - Generate PNG image
      // - errorCorrectionLevel: 'M' - Medium error correction (15% recovery)
      // - margin: 4 - Quiet zone around QR code (default)
      // - width: 300 - Size in pixels for better scanning
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 4,
      });

      return dataUrl;
    } catch (error) {
      // Handle errors from validation or QR generation
      if (error instanceof Error) {
        throw new Error(`Failed to generate QR code: ${error.message}`);
      }
      throw new Error('Failed to generate QR code: Unknown error');
    }
  }

  /**
   * Generate QR code and return as buffer (for file saving)
   * 
   * @param url - The URL to encode in the QR code
   * @returns Promise resolving to PNG buffer
   * @throws Error if URL is invalid or QR generation fails
   */
  async generateQRBuffer(url: string): Promise<Buffer> {
    try {
      // Validate URL
      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        throw new Error('URL is required and must be a non-empty string');
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        throw new Error('Invalid URL format');
      }

      // Generate QR code as buffer
      const buffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'M',
        type: 'png',
        width: 300,
        margin: 4,
      });

      return buffer;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate QR code buffer: ${error.message}`);
      }
      throw new Error('Failed to generate QR code buffer: Unknown error');
    }
  }
}
