/**
 * TokenGenerator - Utility for generating cryptographically secure coupon tokens
 * 
 * Generates 12-character uppercase alphanumeric tokens using crypto.randomBytes
 * for cryptographic security.
 * 
 * Requirements: 1.1, 21.1, 21.2
 */

import crypto from 'crypto';

export class TokenGenerator {
  // Character set: uppercase letters and digits (A-Z, 0-9)
  private static readonly CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private static readonly TOKEN_LENGTH = 12;

  /**
   * Generate a cryptographically secure random token
   * 
   * @returns 12-character uppercase alphanumeric token
   */
  static generate(): string {
    const bytes = crypto.randomBytes(this.TOKEN_LENGTH);
    let token = '';

    for (let i = 0; i < this.TOKEN_LENGTH; i++) {
      // Use modulo to map byte value to charset index
      const index = bytes[i] % this.CHARSET.length;
      token += this.CHARSET[index];
    }

    return token;
  }

  /**
   * Validate token format
   * 
   * @param token - Token to validate
   * @returns true if token matches expected format
   */
  static isValidFormat(token: string): boolean {
    if (!token || token.length !== this.TOKEN_LENGTH) {
      return false;
    }

    // Check if all characters are in the charset
    return /^[A-Z0-9]{12}$/.test(token);
  }
}
