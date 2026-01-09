/**
 * CouponService Tests
 * 
 * Tests core coupon service functionality including token issuance,
 * consumption, wallet operations, and redemptions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { CouponService } from './CouponService.js';
import fs from 'fs';
import path from 'path';

describe('CouponService', () => {
  let db: Database.Database;
  let service: CouponService;
  const testDbPath = ':memory:';

  beforeEach(() => {
    // Create in-memory database
    db = new Database(testDbPath);
    
    // Read and execute schema
    const schemaPath = path.join(process.cwd(), 'src', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Create service
    service = new CouponService(db, '905551234567');
  });

  afterEach(() => {
    db.close();
  });

  describe('issueToken', () => {
    it('should generate a valid token', () => {
      const result = service.issueToken('kiosk-1', 'massage-123');

      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(12);
      expect(result.token).toMatch(/^[A-Z0-9]{12}$/);
      expect(result.status).toBe('issued');
      expect(result.kioskId).toBe('kiosk-1');
      expect(result.issuedFor).toBe('massage-123');
    });

    it('should generate WhatsApp deep link', () => {
      const result = service.issueToken('kiosk-1');

      expect(result.waUrl).toContain('https://wa.me/905551234567');
      expect(result.waUrl).toContain(`KUPON%20${result.token}`);
      expect(result.waText).toBe(`KUPON ${result.token}`);
    });

    it('should set expiration to 24 hours from now', () => {
      const before = new Date();
      const result = service.issueToken('kiosk-1');

      const expectedExpiry = new Date(before.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(result.expiresAt.getTime() - expectedExpiry.getTime());
      
      // Allow 1 second tolerance for test execution time
      expect(timeDiff).toBeLessThan(1000);
    });

    it('should create unique tokens', () => {
      const token1 = service.issueToken('kiosk-1');
      const token2 = service.issueToken('kiosk-1');

      expect(token1.token).not.toBe(token2.token);
    });
  });

  describe('consumeToken', () => {
    it('should consume a valid token and increment wallet', () => {
      const issued = service.issueToken('kiosk-1');
      const result = service.consumeToken('+905551234567', issued.token);

      expect(result.ok).toBe(true);
      expect(result.balance).toBe(1);
      expect(result.remainingToFree).toBe(3);
    });

    it('should normalize phone number before consumption', () => {
      const issued = service.issueToken('kiosk-1');
      
      // Try different phone formats
      const result1 = service.consumeToken('05551234567', issued.token);
      expect(result1.ok).toBe(true);
      
      // Check wallet was created with normalized phone
      const wallet = service.getWallet('+905551234567');
      expect(wallet).not.toBeNull();
      expect(wallet!.phone).toBe('+905551234567');
    });

    it('should reject invalid token', () => {
      const result = service.consumeToken('+905551234567', 'INVALIDTOKEN');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_TOKEN');
    });

    it('should reject expired token', () => {
      const issued = service.issueToken('kiosk-1');
      
      // Manually expire the token
      db.prepare(
        "UPDATE coupon_tokens SET expires_at = datetime('now', '-1 day') WHERE token = ?"
      ).run(issued.token);

      const result = service.consumeToken('+905551234567', issued.token);

      expect(result.ok).toBe(false);
      expect(result.error).toBe('EXPIRED_TOKEN');
    });

    it('should be idempotent - consuming same token twice returns same balance', () => {
      const issued = service.issueToken('kiosk-1');
      
      const result1 = service.consumeToken('+905551234567', issued.token);
      expect(result1.ok).toBe(true);
      expect(result1.balance).toBe(1);

      const result2 = service.consumeToken('+905551234567', issued.token);
      expect(result2.ok).toBe(true);
      expect(result2.balance).toBe(1); // Same balance, not incremented
    });

    it('should track total earned separately from balance', () => {
      const token1 = service.issueToken('kiosk-1');
      const token2 = service.issueToken('kiosk-1');

      service.consumeToken('+905551234567', token1.token);
      service.consumeToken('+905551234567', token2.token);

      const wallet = service.getWallet('+905551234567');
      expect(wallet!.couponCount).toBe(2);
      expect(wallet!.totalEarned).toBe(2);
    });
  });

  describe('getWallet', () => {
    it('should return null for non-existent wallet', () => {
      const wallet = service.getWallet('+905551234567');
      expect(wallet).toBeNull();
    });

    it('should return wallet after token consumption', () => {
      const issued = service.issueToken('kiosk-1');
      service.consumeToken('+905551234567', issued.token);

      const wallet = service.getWallet('+905551234567');
      expect(wallet).not.toBeNull();
      expect(wallet!.phone).toBe('+905551234567');
      expect(wallet!.couponCount).toBe(1);
      expect(wallet!.totalEarned).toBe(1);
      expect(wallet!.totalRedeemed).toBe(0);
      expect(wallet!.optedInMarketing).toBe(false);
    });

    it('should normalize phone number before lookup', () => {
      const issued = service.issueToken('kiosk-1');
      service.consumeToken('05551234567', issued.token);

      // Lookup with different format
      const wallet = service.getWallet('+905551234567');
      expect(wallet).not.toBeNull();
    });
  });

  describe('claimRedemption', () => {
    it('should reject claim with insufficient coupons', () => {
      const issued = service.issueToken('kiosk-1');
      service.consumeToken('+905551234567', issued.token);

      const result = service.claimRedemption('+905551234567');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_COUPONS');
      expect(result.balance).toBe(1);
      expect(result.needed).toBe(3);
    });

    it('should create redemption with 4+ coupons', () => {
      // Issue and consume 4 tokens
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }

      const result = service.claimRedemption('+905551234567');

      expect(result.ok).toBe(true);
      expect(result.redemptionId).toBeDefined();
      expect(result.redemptionId).toHaveLength(36); // UUID format
    });

    it('should subtract 4 coupons from wallet', () => {
      // Issue and consume 5 tokens
      for (let i = 0; i < 5; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }

      service.claimRedemption('+905551234567');

      const wallet = service.getWallet('+905551234567');
      expect(wallet!.couponCount).toBe(1); // 5 - 4 = 1
      expect(wallet!.totalRedeemed).toBe(4);
    });

    it('should be idempotent - claiming twice returns same redemption ID', () => {
      // Issue and consume 4 tokens
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }

      const result1 = service.claimRedemption('+905551234567');
      const result2 = service.claimRedemption('+905551234567');

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      expect(result1.redemptionId).toBe(result2.redemptionId);

      // Balance should not be subtracted twice
      const wallet = service.getWallet('+905551234567');
      expect(wallet!.couponCount).toBe(0); // Still 0, not negative
    });
  });

  describe('completeRedemption', () => {
    it('should mark redemption as completed', () => {
      // Setup: create redemption
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }
      const claim = service.claimRedemption('+905551234567');

      // Complete redemption
      service.completeRedemption(claim.redemptionId!, 'admin');

      // Verify status
      const redemption = db
        .prepare('SELECT * FROM coupon_redemptions WHERE id = ?')
        .get(claim.redemptionId!) as any;

      expect(redemption.status).toBe('completed');
      expect(redemption.completed_at).toBeDefined();
    });

    it('should throw error for non-existent redemption', () => {
      expect(() => {
        service.completeRedemption('non-existent-id', 'admin');
      }).toThrow('Redemption not found');
    });
  });

  describe('rejectRedemption', () => {
    it('should reject redemption and refund coupons', () => {
      // Setup: create redemption
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }
      const claim = service.claimRedemption('+905551234567');

      // Reject redemption
      service.rejectRedemption(claim.redemptionId!, 'Customer changed mind', 'admin');

      // Verify status
      const redemption = db
        .prepare('SELECT * FROM coupon_redemptions WHERE id = ?')
        .get(claim.redemptionId!) as any;

      expect(redemption.status).toBe('rejected');
      expect(redemption.rejected_at).toBeDefined();
      expect(redemption.note).toBe('Customer changed mind');

      // Verify coupons refunded
      const wallet = service.getWallet('+905551234567');
      expect(wallet!.couponCount).toBe(4); // Refunded
      expect(wallet!.totalRedeemed).toBe(0); // Reverted
    });

    it('should require rejection note', () => {
      // Setup: create redemption
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }
      const claim = service.claimRedemption('+905551234567');

      expect(() => {
        service.rejectRedemption(claim.redemptionId!, '', 'admin');
      }).toThrow('Rejection note is required');
    });
  });

  describe('optOut', () => {
    it('should set opted_in_marketing to false', () => {
      // Create wallet first
      const issued = service.issueToken('kiosk-1');
      service.consumeToken('+905551234567', issued.token);

      // Opt out
      service.optOut('+905551234567');

      // Verify
      const wallet = service.getWallet('+905551234567');
      expect(wallet!.optedInMarketing).toBe(false);
    });

    it('should not affect coupon balance', () => {
      // Create wallet with coupons
      const issued = service.issueToken('kiosk-1');
      service.consumeToken('+905551234567', issued.token);

      const beforeBalance = service.getWallet('+905551234567')!.couponCount;

      // Opt out
      service.optOut('+905551234567');

      // Verify balance unchanged
      const afterBalance = service.getWallet('+905551234567')!.couponCount;
      expect(afterBalance).toBe(beforeBalance);
    });

    it('should create wallet if it does not exist', () => {
      service.optOut('+905551234567');

      const wallet = service.getWallet('+905551234567');
      expect(wallet).not.toBeNull();
      expect(wallet!.optedInMarketing).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired issued tokens older than 7 days', () => {
      // Create a token and manually set it to expired 8 days ago
      const issued = service.issueToken('kiosk-1');
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      
      db.prepare(
        'UPDATE coupon_tokens SET expires_at = ? WHERE token = ?'
      ).run(eightDaysAgo.toISOString(), issued.token);

      // Run cleanup
      const deletedCount = service.cleanupExpiredTokens();

      // Verify token was deleted
      expect(deletedCount).toBe(1);
      const token = db.prepare('SELECT * FROM coupon_tokens WHERE token = ?').get(issued.token);
      expect(token).toBeUndefined();
    });

    it('should delete used tokens older than 90 days', () => {
      // Create and consume a token
      const issued = service.issueToken('kiosk-1');
      service.consumeToken('+905551234567', issued.token);

      // Manually set used_at to 91 days ago
      const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      db.prepare(
        'UPDATE coupon_tokens SET used_at = ? WHERE token = ?'
      ).run(ninetyOneDaysAgo.toISOString(), issued.token);

      // Run cleanup
      const deletedCount = service.cleanupExpiredTokens();

      // Verify token was deleted
      expect(deletedCount).toBe(1);
      const token = db.prepare('SELECT * FROM coupon_tokens WHERE token = ?').get(issued.token);
      expect(token).toBeUndefined();
    });

    it('should not delete recent tokens', () => {
      // Create a fresh token
      const issued = service.issueToken('kiosk-1');

      // Run cleanup
      const deletedCount = service.cleanupExpiredTokens();

      // Verify token was not deleted
      expect(deletedCount).toBe(0);
      const token = db.prepare('SELECT * FROM coupon_tokens WHERE token = ?').get(issued.token);
      expect(token).toBeDefined();
    });

    it('should return count of deleted tokens', () => {
      // Create multiple old tokens
      const token1 = service.issueToken('kiosk-1');
      const token2 = service.issueToken('kiosk-1');
      
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      db.prepare(
        'UPDATE coupon_tokens SET expires_at = ? WHERE token IN (?, ?)'
      ).run(eightDaysAgo.toISOString(), token1.token, token2.token);

      // Run cleanup
      const deletedCount = service.cleanupExpiredTokens();

      expect(deletedCount).toBe(2);
    });
  });

  describe('expirePendingRedemptions', () => {
    it('should expire redemptions older than 30 days', () => {
      // Create wallet with coupons and claim redemption
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }
      
      const claim = service.claimRedemption('+905551234567');
      expect(claim.ok).toBe(true);

      // Manually set created_at to 31 days ago
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      db.prepare(
        'UPDATE coupon_redemptions SET created_at = ? WHERE id = ?'
      ).run(thirtyOneDaysAgo.toISOString(), claim.redemptionId);

      // Run expiration
      const expiredCount = service.expirePendingRedemptions();

      // Verify redemption was rejected
      expect(expiredCount).toBe(1);
      const redemption = db.prepare(
        'SELECT * FROM coupon_redemptions WHERE id = ?'
      ).get(claim.redemptionId) as any;
      
      expect(redemption.status).toBe('rejected');
      expect(redemption.note).toBe('Auto-expired after 30 days');
    });

    it('should refund coupons to wallet', () => {
      // Create wallet with coupons and claim redemption
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }
      
      const claim = service.claimRedemption('+905551234567');
      
      // Wallet should have 0 coupons after claim
      let wallet = service.getWallet('+905551234567');
      expect(wallet!.couponCount).toBe(0);

      // Manually set created_at to 31 days ago
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      db.prepare(
        'UPDATE coupon_redemptions SET created_at = ? WHERE id = ?'
      ).run(thirtyOneDaysAgo.toISOString(), claim.redemptionId);

      // Run expiration
      service.expirePendingRedemptions();

      // Verify coupons were refunded
      wallet = service.getWallet('+905551234567');
      expect(wallet!.couponCount).toBe(4);
    });

    it('should not expire recent redemptions', () => {
      // Create wallet with coupons and claim redemption
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234567', issued.token);
      }
      
      const claim = service.claimRedemption('+905551234567');

      // Run expiration
      const expiredCount = service.expirePendingRedemptions();

      // Verify redemption was not expired
      expect(expiredCount).toBe(0);
      const redemption = db.prepare(
        'SELECT * FROM coupon_redemptions WHERE id = ?'
      ).get(claim.redemptionId) as any;
      
      expect(redemption.status).toBe('pending');
    });

    it('should return count of expired redemptions', () => {
      // Create multiple redemptions with valid Turkish phone numbers
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234560', issued.token);
      }
      
      for (let i = 0; i < 4; i++) {
        const issued = service.issueToken('kiosk-1');
        service.consumeToken('+905551234561', issued.token);
      }
      
      const claim1 = service.claimRedemption('+905551234560');
      const claim2 = service.claimRedemption('+905551234561');

      // Set both to 31 days ago
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      db.prepare(
        'UPDATE coupon_redemptions SET created_at = ? WHERE id IN (?, ?)'
      ).run(thirtyOneDaysAgo.toISOString(), claim1.redemptionId, claim2.redemptionId);

      // Run expiration
      const expiredCount = service.expirePendingRedemptions();

      expect(expiredCount).toBe(2);
    });
  });
});
