/**
 * RateLimitService Tests
 * 
 * Tests rate limiting functionality including counter management,
 * Istanbul timezone calculations, and expired counter cleanup.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { RateLimitService } from './RateLimitService.js';
import fs from 'fs';
import path from 'path';

describe('RateLimitService', () => {
  let db: Database.Database;
  let service: RateLimitService;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Create rate limits table
    db.exec(`
      CREATE TABLE coupon_rate_limits (
        phone TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        reset_at DATETIME NOT NULL,
        PRIMARY KEY (phone, endpoint)
      );
    `);

    // Create system_logs table for abuse detection
    db.exec(`
      CREATE TABLE system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    service = new RateLimitService(db);
  });

  describe('checkLimit', () => {
    it('should allow request when no counter exists', () => {
      const result = service.checkLimit('+905551234567', 'consume', 10);
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should allow request when under limit', () => {
      // Create counter with count = 5, limit = 10
      const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 5, resetAt.toISOString());

      const result = service.checkLimit('+905551234567', 'consume', 10);
      expect(result.allowed).toBe(true);
    });

    it('should block request when at limit', () => {
      // Create counter with count = 10, limit = 10
      const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, resetAt.toISOString());

      const result = service.checkLimit('+905551234567', 'consume', 10);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should allow request when reset time has passed', () => {
      // Create counter with reset time in the past
      const resetAt = new Date(Date.now() - 1000); // 1 second ago
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, resetAt.toISOString());

      const result = service.checkLimit('+905551234567', 'consume', 10);
      expect(result.allowed).toBe(true);
    });

    it('should calculate correct retryAfter seconds', () => {
      // Create counter that resets in 1 hour
      const resetAt = new Date(Date.now() + 60 * 60 * 1000);
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, resetAt.toISOString());

      const result = service.checkLimit('+905551234567', 'consume', 10);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(3500); // ~1 hour in seconds
      expect(result.retryAfter).toBeLessThan(3700);
    });

    it('should handle different endpoints independently', () => {
      const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Block consume endpoint
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, resetAt.toISOString());

      // Claim endpoint should still be allowed
      const result = service.checkLimit('+905551234567', 'claim', 5);
      expect(result.allowed).toBe(true);
    });
  });

  describe('incrementCounter', () => {
    it('should create new counter when none exists', () => {
      service.incrementCounter('+905551234567', 'consume');

      const counter = service.getCounter('+905551234567', 'consume');
      expect(counter).not.toBeNull();
      expect(counter!.count).toBe(1);
      expect(counter!.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should increment existing counter', () => {
      // Create initial counter
      service.incrementCounter('+905551234567', 'consume');
      
      // Increment again
      service.incrementCounter('+905551234567', 'consume');

      const counter = service.getCounter('+905551234567', 'consume');
      expect(counter!.count).toBe(2);
    });

    it('should reset counter when reset time has passed', () => {
      // Create counter with reset time in the past
      const resetAt = new Date(Date.now() - 1000);
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, resetAt.toISOString());

      // Increment should reset to 1
      service.incrementCounter('+905551234567', 'consume');

      const counter = service.getCounter('+905551234567', 'consume');
      expect(counter!.count).toBe(1);
      expect(counter!.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle multiple phone numbers independently', () => {
      service.incrementCounter('+905551234567', 'consume');
      service.incrementCounter('+905559876543', 'consume');

      const counter1 = service.getCounter('+905551234567', 'consume');
      const counter2 = service.getCounter('+905559876543', 'consume');

      expect(counter1!.count).toBe(1);
      expect(counter2!.count).toBe(1);
    });
  });

  describe('resetExpiredCounters', () => {
    it('should delete expired counters', () => {
      // Create expired counter
      const expiredResetAt = new Date(Date.now() - 1000);
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, expiredResetAt.toISOString());

      // Create valid counter
      const validResetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905559876543', 'consume', 5, validResetAt.toISOString());

      service.resetExpiredCounters();

      // Expired counter should be deleted
      const expiredCounter = service.getCounter('+905551234567', 'consume');
      expect(expiredCounter).toBeNull();

      // Valid counter should remain
      const validCounter = service.getCounter('+905559876543', 'consume');
      expect(validCounter).not.toBeNull();
      expect(validCounter!.count).toBe(5);
    });

    it('should handle empty table', () => {
      expect(() => service.resetExpiredCounters()).not.toThrow();
    });
  });

  describe('getCounter', () => {
    it('should return null when counter does not exist', () => {
      const counter = service.getCounter('+905551234567', 'consume');
      expect(counter).toBeNull();
    });

    it('should return counter when it exists', () => {
      const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 7, resetAt.toISOString());

      const counter = service.getCounter('+905551234567', 'consume');
      expect(counter).not.toBeNull();
      expect(counter!.phone).toBe('+905551234567');
      expect(counter!.endpoint).toBe('consume');
      expect(counter!.count).toBe(7);
      expect(counter!.resetAt).toBeInstanceOf(Date);
    });
  });

  describe('Istanbul timezone calculations', () => {
    it('should calculate midnight Istanbul time in the future', () => {
      service.incrementCounter('+905551234567', 'consume');
      
      const counter = service.getCounter('+905551234567', 'consume');
      expect(counter).not.toBeNull();
      
      // Reset time should be in the future
      expect(counter!.resetAt.getTime()).toBeGreaterThan(Date.now());
      
      // Reset time should be within 24 hours
      const hoursUntilReset = (counter!.resetAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursUntilReset).toBeGreaterThan(0);
      expect(hoursUntilReset).toBeLessThanOrEqual(24);
    });

    it('should set reset time to next midnight Istanbul time', () => {
      service.incrementCounter('+905551234567', 'consume');
      
      const counter = service.getCounter('+905551234567', 'consume');
      
      // Convert reset time to Istanbul timezone and check it's midnight
      const istanbulTime = counter!.resetAt.toLocaleString('en-US', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      // Should be 00:00:00 (midnight) or 24:00:00 (which is also midnight of next day)
      expect(['00:00:00', '24:00:00']).toContain(istanbulTime);
    });
  });

  describe('Rate limiting scenarios', () => {
    it('should enforce consume endpoint limit of 10 requests per day', () => {
      const phone = '+905551234567';
      const limit = 10;

      // Make 10 requests - all should be allowed
      for (let i = 0; i < limit; i++) {
        const check = service.checkLimit(phone, 'consume', limit);
        expect(check.allowed).toBe(true);
        service.incrementCounter(phone, 'consume');
      }

      // 11th request should be blocked
      const check = service.checkLimit(phone, 'consume', limit);
      expect(check.allowed).toBe(false);
      expect(check.retryAfter).toBeGreaterThan(0);
    });

    it('should enforce claim endpoint limit of 5 requests per day', () => {
      const phone = '+905551234567';
      const limit = 5;

      // Make 5 requests - all should be allowed
      for (let i = 0; i < limit; i++) {
        const check = service.checkLimit(phone, 'claim', limit);
        expect(check.allowed).toBe(true);
        service.incrementCounter(phone, 'claim');
      }

      // 6th request should be blocked
      const check = service.checkLimit(phone, 'claim', limit);
      expect(check.allowed).toBe(false);
      expect(check.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Abuse detection', () => {
    beforeEach(() => {
      service.clearAbuseCache();
    });

    it('should log when rate limit rejections exceed 50 per hour', () => {
      const phone = '+905551234567';
      const limit = 10;

      // First, hit the rate limit
      for (let i = 0; i < limit; i++) {
        service.incrementCounter(phone, 'consume');
      }

      // Now make 50 more requests that will be rejected
      for (let i = 0; i < 50; i++) {
        service.checkLimit(phone, 'consume', limit);
      }

      // Check that abuse was logged
      const logs = db
        .prepare(
          `SELECT * FROM system_logs
           WHERE level = 'warn' AND message = 'Rate limit abuse detected'
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .get() as any;

      expect(logs).toBeDefined();
      expect(logs.level).toBe('warn');
      expect(logs.message).toBe('Rate limit abuse detected');
      
      const details = JSON.parse(logs.details);
      expect(details.endpoint).toBe('consume');
      expect(details.rejectionCount).toBe(50);
    });

    it('should track abuse statistics', () => {
      const phone = '+905551234567';
      const limit = 10;

      // Hit rate limit
      for (let i = 0; i < limit; i++) {
        service.incrementCounter(phone, 'consume');
      }

      // Make 50 rejected requests
      for (let i = 0; i < 50; i++) {
        service.checkLimit(phone, 'consume', limit);
      }

      // Get abuse statistics
      const stats = service.getAbuseStatistics();
      
      expect(stats.length).toBe(1);
      expect(stats[0].phone).toContain('****'); // Masked
      expect(stats[0].endpoint).toBe('consume');
      expect(stats[0].count).toBe(50);
    });

    it('should log every 10 rejections after threshold', () => {
      const phone = '+905551234567';
      const limit = 10;

      // Hit rate limit
      for (let i = 0; i < limit; i++) {
        service.incrementCounter(phone, 'consume');
      }

      // Make 70 rejected requests (50 + 20 more)
      for (let i = 0; i < 70; i++) {
        service.checkLimit(phone, 'consume', limit);
      }

      // Check that continued abuse was logged
      const logs = db
        .prepare(
          `SELECT COUNT(*) as count FROM system_logs
           WHERE level = 'warn' AND message IN ('Rate limit abuse detected', 'Continued rate limit abuse')`
        )
        .get() as any;

      // Should have: 1 initial log at 50, then logs at 60 and 70 = 3 total
      expect(logs.count).toBe(3);
    });

    it('should reset abuse tracking after 1 hour window', () => {
      const phone = '+905551234567';
      const limit = 10;

      // Hit rate limit
      for (let i = 0; i < limit; i++) {
        service.incrementCounter(phone, 'consume');
      }

      // Make 30 rejected requests
      for (let i = 0; i < 30; i++) {
        service.checkLimit(phone, 'consume', limit);
      }

      // Clear cache to simulate time passing
      service.clearAbuseCache();

      // Make 30 more rejected requests (should not trigger abuse log yet)
      for (let i = 0; i < 30; i++) {
        service.checkLimit(phone, 'consume', limit);
      }

      // Should not have abuse log yet (only 30 in new window)
      const logs = db
        .prepare(
          `SELECT COUNT(*) as count FROM system_logs
           WHERE level = 'warn' AND message = 'Rate limit abuse detected'`
        )
        .get() as any;

      expect(logs.count).toBe(0);
    });

    it('should track abuse separately per endpoint', () => {
      const phone = '+905551234567';
      const consumeLimit = 10;
      const claimLimit = 5;

      // Hit consume rate limit
      for (let i = 0; i < consumeLimit; i++) {
        service.incrementCounter(phone, 'consume');
      }

      // Hit claim rate limit
      for (let i = 0; i < claimLimit; i++) {
        service.incrementCounter(phone, 'claim');
      }

      // Make 50 rejected requests on each endpoint
      for (let i = 0; i < 50; i++) {
        service.checkLimit(phone, 'consume', consumeLimit);
        service.checkLimit(phone, 'claim', claimLimit);
      }

      // Should have 2 abuse logs (one per endpoint)
      const logs = db
        .prepare(
          `SELECT COUNT(*) as count FROM system_logs
           WHERE level = 'warn' AND message = 'Rate limit abuse detected'`
        )
        .get() as any;

      expect(logs.count).toBe(2);

      // Check statistics
      const stats = service.getAbuseStatistics();
      expect(stats.length).toBe(2);
    });
  });
});
