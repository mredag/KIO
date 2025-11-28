/**
 * Coupon Rate Limit Middleware
 * 
 * Provides rate limiting for coupon endpoints using SQLite persistence.
 * Enforces different limits for consume and claim endpoints.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from '../services/RateLimitService.js';
import Database from 'better-sqlite3';

// Rate limit configuration
const RATE_LIMITS = {
  consume: 10, // 10 requests per day
  claim: 5,    // 5 requests per day
};

/**
 * Create coupon rate limit middleware
 * 
 * @param db - Database instance for RateLimitService
 * @returns Express middleware function
 */
export function createCouponRateLimitMiddleware(db: Database.Database) {
  const rateLimitService = new RateLimitService(db);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract phone from request body
    const phone = req.body?.phone;

    if (!phone) {
      res.status(400).json({
        error: {
          code: 'MISSING_PHONE',
          message: 'Phone number is required',
        },
      });
      return;
    }

    // Determine endpoint from request path
    let endpoint: 'consume' | 'claim';
    let limit: number;

    if (req.path.includes('/consume')) {
      endpoint = 'consume';
      limit = RATE_LIMITS.consume;
    } else if (req.path.includes('/claim')) {
      endpoint = 'claim';
      limit = RATE_LIMITS.claim;
    } else {
      // If path doesn't match known endpoints, skip rate limiting
      next();
      return;
    }

    // Check rate limit
    const { allowed, retryAfter } = rateLimitService.checkLimit(phone, endpoint, limit);

    if (!allowed) {
      // Rate limit exceeded
      res.status(429)
        .set('Retry-After', retryAfter!.toString())
        .json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again later.`,
            retryAfter: retryAfter,
          },
        });
      return;
    }

    // Increment counter
    rateLimitService.incrementCounter(phone, endpoint);

    // Allow request to proceed
    next();
  };
}

/**
 * Cleanup expired rate limit counters
 * Should be called periodically (e.g., daily at midnight)
 * 
 * @param db - Database instance
 */
export function cleanupExpiredRateLimits(db: Database.Database): void {
  const rateLimitService = new RateLimitService(db);
  rateLimitService.resetExpiredCounters();
}
