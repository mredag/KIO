/**
 * Tests for Coupon System Utilities
 * Tests PhoneNormalizer, TokenGenerator, and PIIMasking
 */

import { describe, it, expect } from 'vitest';
import { PhoneNormalizer } from './PhoneNormalizer.js';
import { TokenGenerator } from './TokenGenerator.js';
import { PIIMasking } from './PIIMasking.js';

describe('PhoneNormalizer', () => {
  describe('normalize', () => {
    it('should normalize Turkish phone with leading 0', () => {
      expect(PhoneNormalizer.normalize('05551234567')).toBe('+905551234567');
    });

    it('should normalize Turkish phone without country code', () => {
      expect(PhoneNormalizer.normalize('5551234567')).toBe('+905551234567');
    });

    it('should normalize Turkish phone with country code', () => {
      expect(PhoneNormalizer.normalize('905551234567')).toBe('+905551234567');
    });

    it('should keep already normalized E.164 format', () => {
      expect(PhoneNormalizer.normalize('+905551234567')).toBe('+905551234567');
    });

    it('should handle phone with spaces and dashes', () => {
      expect(PhoneNormalizer.normalize('+90 555 123 45 67')).toBe('+905551234567');
      expect(PhoneNormalizer.normalize('0555-123-45-67')).toBe('+905551234567');
    });

    it('should throw error for empty phone', () => {
      expect(() => PhoneNormalizer.normalize('')).toThrow('Phone number is required');
    });

    it('should throw error for phone with no digits', () => {
      expect(() => PhoneNormalizer.normalize('abc')).toThrow('Phone number contains no digits');
    });
  });

  describe('isE164', () => {
    it('should return true for valid E.164 format', () => {
      expect(PhoneNormalizer.isE164('+905551234567')).toBe(true);
      expect(PhoneNormalizer.isE164('+12125551234')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(PhoneNormalizer.isE164('905551234567')).toBe(false);
      expect(PhoneNormalizer.isE164('05551234567')).toBe(false);
      expect(PhoneNormalizer.isE164('+90 555 123 45 67')).toBe(false);
    });
  });
});

describe('TokenGenerator', () => {
  describe('generate', () => {
    it('should generate 12-character token', () => {
      const token = TokenGenerator.generate();
      expect(token).toHaveLength(12);
    });

    it('should generate uppercase alphanumeric token', () => {
      const token = TokenGenerator.generate();
      expect(token).toMatch(/^[A-Z0-9]{12}$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(TokenGenerator.generate());
      }
      // All 100 tokens should be unique
      expect(tokens.size).toBe(100);
    });

    it('should pass format validation', () => {
      const token = TokenGenerator.generate();
      expect(TokenGenerator.isValidFormat(token)).toBe(true);
    });
  });

  describe('isValidFormat', () => {
    it('should validate correct format', () => {
      expect(TokenGenerator.isValidFormat('ABC123DEF456')).toBe(true);
      expect(TokenGenerator.isValidFormat('ZZZZZZZZZZZZ')).toBe(true);
      expect(TokenGenerator.isValidFormat('000000000000')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(TokenGenerator.isValidFormat('abc123def456')).toBe(false); // lowercase
      expect(TokenGenerator.isValidFormat('ABC123DEF45')).toBe(false); // too short
      expect(TokenGenerator.isValidFormat('ABC123DEF4567')).toBe(false); // too long
      expect(TokenGenerator.isValidFormat('ABC123-DEF45')).toBe(false); // special char
      expect(TokenGenerator.isValidFormat('')).toBe(false); // empty
    });
  });
});

describe('PIIMasking', () => {
  describe('maskPhone', () => {
    it('should mask phone showing last 4 digits', () => {
      expect(PIIMasking.maskPhone('+905551234567')).toBe('*********4567');
      expect(PIIMasking.maskPhone('+12125551234')).toBe('********1234');
    });

    it('should handle short phone numbers', () => {
      expect(PIIMasking.maskPhone('1234')).toBe('***4'); // Shows last 1 char for 4-char phone
      expect(PIIMasking.maskPhone('123')).toBe('**3');
    });

    it('should handle empty phone', () => {
      expect(PIIMasking.maskPhone('')).toBe('');
    });
  });

  describe('maskToken', () => {
    it('should mask token showing first 4 and last 4 chars', () => {
      expect(PIIMasking.maskToken('ABC123DEF456')).toBe('ABC1****F456');
      expect(PIIMasking.maskToken('ABCDEFGHIJKL')).toBe('ABCD****IJKL');
    });

    it('should handle short tokens', () => {
      expect(PIIMasking.maskToken('ABCD')).toBe('ABCD');
      expect(PIIMasking.maskToken('ABCDEF')).toBe('AB**EF');
    });

    it('should handle empty token', () => {
      expect(PIIMasking.maskToken('')).toBe('');
    });
  });

  describe('maskEmail', () => {
    it('should mask email showing first char and domain', () => {
      expect(PIIMasking.maskEmail('user@example.com')).toBe('u***@example.com');
      expect(PIIMasking.maskEmail('admin@test.org')).toBe('a****@test.org');
    });

    it('should handle invalid email', () => {
      expect(PIIMasking.maskEmail('notanemail')).toBe('notanemail');
      expect(PIIMasking.maskEmail('')).toBe('');
    });
  });

  describe('maskGeneric', () => {
    it('should mask generic string showing first and last 4 chars', () => {
      expect(PIIMasking.maskGeneric('ABCDEFGHIJKL')).toBe('ABCD****IJKL');
      expect(PIIMasking.maskGeneric('1234567890123456')).toBe('1234********3456');
    });

    it('should fully mask short strings', () => {
      expect(PIIMasking.maskGeneric('SHORT')).toBe('*****');
      expect(PIIMasking.maskGeneric('12345678')).toBe('********');
    });

    it('should handle empty string', () => {
      expect(PIIMasking.maskGeneric('')).toBe('');
    });
  });
});
