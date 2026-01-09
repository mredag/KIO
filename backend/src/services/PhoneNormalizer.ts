/**
 * PhoneNormalizer - Utility for normalizing phone numbers to E.164 format
 * 
 * Handles various input formats:
 * - +905551234567 (already E.164)
 * - 905551234567 (missing +)
 * - 05551234567 (Turkish format with leading 0)
 * - 5551234567 (Turkish format without country code)
 * 
 * Requirements: 2.2, 8.2, 8.3, 8.4
 */

export class PhoneNormalizer {
  /**
   * Normalize a phone number to E.164 format
   * Assumes Turkey (+90) as default country code
   * 
   * @param phone - Phone number in various formats
   * @returns Phone number in E.164 format (e.g., +905551234567)
   * @throws Error if phone number is invalid
   */
  static normalize(phone: string): string {
    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Remove all non-digit characters except leading +
    let cleaned = phone.trim();
    const hasPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/\D/g, '');

    if (!cleaned) {
      throw new Error('Phone number contains no digits');
    }

    // Handle different formats
    let normalized: string;

    if (hasPlus) {
      // Already has +, just ensure it's properly formatted
      normalized = '+' + cleaned;
    } else if (cleaned.startsWith('90')) {
      // Starts with country code 90
      normalized = '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      // Turkish format with leading 0 (e.g., 05551234567)
      // Remove leading 0 and add +90
      normalized = '+90' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      // Turkish format without country code (e.g., 5551234567)
      normalized = '+90' + cleaned;
    } else {
      // Assume it already has country code, just add +
      normalized = '+' + cleaned;
    }

    // Validate E.164 format (+ followed by 1-15 digits)
    if (!/^\+\d{1,15}$/.test(normalized)) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }

    // Additional validation for Turkish numbers (should be +90 followed by 10 digits)
    if (normalized.startsWith('+90') && normalized.length !== 13) {
      throw new Error(`Invalid Turkish phone number: ${phone} (expected 10 digits after +90)`);
    }

    return normalized;
  }

  /**
   * Check if a phone number is already in E.164 format
   * 
   * @param phone - Phone number to check
   * @returns true if phone is in E.164 format
   */
  static isE164(phone: string): boolean {
    return /^\+\d{1,15}$/.test(phone);
  }
}
