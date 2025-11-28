/**
 * PIIMasking - Utility for masking Personally Identifiable Information (PII)
 * 
 * Provides functions to mask sensitive data in logs while maintaining
 * enough information for debugging and support.
 * 
 * Requirements: 18.1, 18.2, 18.4
 */

export class PIIMasking {
  /**
   * Mask a phone number, showing only the last 4 digits
   * 
   * Examples:
   * - +905551234567 -> *********4567
   * - +12125551234 -> ********1234
   * 
   * @param phone - Phone number to mask
   * @returns Masked phone number
   */
  static maskPhone(phone: string): string {
    if (!phone) {
      return '';
    }

    const phoneStr = phone.toString();
    
    if (phoneStr.length <= 4) {
      // If phone is 4 chars or less, mask all but last char
      return '*'.repeat(phoneStr.length - 1) + phoneStr.slice(-1);
    }

    // Show last 4 digits, mask the rest
    const visibleDigits = phoneStr.slice(-4);
    const maskedLength = phoneStr.length - 4;
    return '*'.repeat(maskedLength) + visibleDigits;
  }

  /**
   * Mask a token, showing first 4 and last 4 characters
   * 
   * Examples:
   * - ABC123DEF456 -> ABC1****F456
   * - SHORTTOKEN -> SHOR****OKEN
   * 
   * @param token - Token to mask
   * @returns Masked token
   */
  static maskToken(token: string): string {
    if (!token) {
      return '';
    }

    const tokenStr = token.toString();
    
    if (tokenStr.length <= 8) {
      // If token is 8 chars or less, show first 2 and last 2
      if (tokenStr.length <= 4) {
        return tokenStr; // Too short to mask meaningfully
      }
      const firstPart = tokenStr.slice(0, 2);
      const lastPart = tokenStr.slice(-2);
      const maskedLength = tokenStr.length - 4;
      return firstPart + '*'.repeat(maskedLength) + lastPart;
    }

    // Show first 4 and last 4 characters
    const firstPart = tokenStr.slice(0, 4);
    const lastPart = tokenStr.slice(-4);
    const maskedLength = tokenStr.length - 8;
    return firstPart + '*'.repeat(maskedLength) + lastPart;
  }

  /**
   * Mask an email address, showing first character and domain
   * 
   * Example:
   * - user@example.com -> u***@example.com
   * 
   * @param email - Email to mask
   * @returns Masked email
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }

    const [localPart, domain] = email.split('@');
    
    if (localPart.length <= 1) {
      return email;
    }

    const maskedLocal = localPart[0] + '*'.repeat(localPart.length - 1);
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask any string value, showing first and last 4 characters
   * Generic masking function for any sensitive data
   * 
   * @param value - Value to mask
   * @returns Masked value
   */
  static maskGeneric(value: string): string {
    if (!value) {
      return '';
    }

    const valueStr = value.toString();
    
    if (valueStr.length <= 8) {
      return '*'.repeat(valueStr.length);
    }

    const firstPart = valueStr.slice(0, 4);
    const lastPart = valueStr.slice(-4);
    const maskedLength = valueStr.length - 8;
    return firstPart + '*'.repeat(maskedLength) + lastPart;
  }
}
