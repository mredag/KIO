/**
 * Coupon Rate Limit Middleware Tests
 * 
 * Tests rate limiting middleware for coupon endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { createCouponRateLimitMiddleware, cleanupExpiredRateLimits } from './couponRateLimitMiddleware.js';

describe('couponRateLimitMiddleware', () => {
  let db: Database.Database;
  let middleware: ReturnType<typeof createCouponRateLimitMiddleware>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

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

    middleware = createCouponRateLimitMiddleware(db);

    // Setup mock request, response, and next
    mockReq = {
      body: {},
      path: '',
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('consume endpoint', () => {
    beforeEach(() => {
      mockReq.path = '/api/integrations/coupons/consume';
      mockReq.body = { phone: '+905551234567', token: 'ABC123' };
    });

    it('should allow first request', () => {
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow requests under limit (10 per day)', () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        mockNext = vi.fn();
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }

      // All should succeed
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block 11th request', () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        mockNext = vi.fn();
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // 11th request should be blocked
      mockNext = vi.fn();
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.set = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: expect.any(String),
          retryAfter: expect.any(Number),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if phone is missing', () => {
      mockReq.body = { token: 'ABC123' }; // No phone

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_PHONE',
          message: 'Phone number is required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('claim endpoint', () => {
    beforeEach(() => {
      mockReq.path = '/api/integrations/coupons/claim';
      mockReq.body = { phone: '+905551234567' };
    });

    it('should allow first request', () => {
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow requests under limit (5 per day)', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        mockNext = vi.fn();
        middleware(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }

      // All should succeed
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block 6th request', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        mockNext = vi.fn();
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // 6th request should be blocked
      mockNext = vi.fn();
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.set = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('endpoint detection', () => {
    it('should skip rate limiting for unknown endpoints', () => {
      mockReq.path = '/api/admin/coupons/issue';
      mockReq.body = { phone: '+905551234567' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle consume endpoint correctly', () => {
      mockReq.path = '/api/integrations/coupons/consume';
      mockReq.body = { phone: '+905551234567', token: 'ABC123' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle claim endpoint correctly', () => {
      mockReq.path = '/api/integrations/coupons/claim';
      mockReq.body = { phone: '+905551234567' };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('independent phone numbers', () => {
    it('should track different phone numbers independently', () => {
      mockReq.path = '/api/integrations/coupons/consume';

      // Make 10 requests from first phone
      mockReq.body = { phone: '+905551234567', token: 'ABC123' };
      for (let i = 0; i < 10; i++) {
        mockNext = vi.fn();
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }

      // First phone should be at limit
      mockNext = vi.fn();
      mockRes.status = vi.fn().mockReturnThis();
      mockRes.set = vi.fn().mockReturnThis();
      mockRes.json = vi.fn().mockReturnThis();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Second phone should still be allowed
      mockReq.body = { phone: '+905559876543', token: 'DEF456' };
      mockNext = vi.fn();
      mockRes.status = vi.fn().mockReturnThis();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredRateLimits', () => {
    it('should remove expired rate limit entries', () => {
      // Create expired entry
      const expiredResetAt = new Date(Date.now() - 1000).toISOString();
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905551234567', 'consume', 10, expiredResetAt);

      // Create valid entry
      const validResetAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        'INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at) VALUES (?, ?, ?, ?)'
      ).run('+905559876543', 'consume', 5, validResetAt);

      // Cleanup
      cleanupExpiredRateLimits(db);

      // Check results
      const rows = db.prepare('SELECT * FROM coupon_rate_limits').all();
      expect(rows).toHaveLength(1);
      expect((rows[0] as any).phone).toBe('+905559876543');
    });
  });
});
