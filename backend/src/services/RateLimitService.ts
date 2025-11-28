/**
 * RateLimitService - Service for managing rate limits on coupon endpoints
 * 
 * Provides rate limiting functionality with SQLite persistence to survive
 * service restarts. Calculates midnight Istanbul time for daily resets.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.5, 24.1, 24.2, 24.3, 24.5, 28.1
 */

import Database from 'better-sqlite3';
import { CouponRateLimit, CouponRateLimitDb } from '../database/types.js';

export class RateLimitService {
  private db: Database.Database;
  private abuseDetectionCache: Map<string, { count: number; windowStart: Date }>;

  constructor(db: Database.Database) {
    this.db = db;
    this.abuseDetectionCache = new Map();
  }

  /**
   * Check if a request is allowed under rate limiting rules
   * 
   * @param phone - Phone number making the request
   * @param endpoint - Endpoint being accessed ('consume' or 'claim')
   * @param limit - Maximum requests allowed per day
   * @returns Object with allowed status and optional retryAfter seconds
   */
  checkLimit(
    phone: string,
    endpoint: 'consume' | 'claim',
    limit: number
  ): { allowed: boolean; retryAfter?: number } {
    const now = new Date();
    
    // Get current counter
    const row = this.db
      .prepare(
        `SELECT * FROM coupon_rate_limits
         WHERE phone = ? AND endpoint = ?`
      )
      .get(phone, endpoint) as CouponRateLimitDb | undefined;

    // If no record exists, request is allowed
    if (!row) {
      return { allowed: true };
    }

    const resetAt = new Date(row.reset_at);

    // If reset time has passed, request is allowed (counter will be reset)
    if (now >= resetAt) {
      return { allowed: true };
    }

    // Check if under limit
    if (row.count < limit) {
      return { allowed: true };
    }

    // Rate limit exceeded - calculate retry after in seconds
    const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000);
    
    // Track rate limit rejection for abuse detection
    // Requirements: 26.5 - Log when rate limit rejections exceed 50/hour
    this.trackRateLimitRejection(phone, endpoint);
    
    return { allowed: false, retryAfter };
  }

  /**
   * Track rate limit rejections and log when abuse threshold is exceeded
   * Logs when a phone number has more than 50 rate limit rejections in an hour
   * 
   * Requirements: 26.5 - Log when rate limit rejections exceed 50/hour
   * 
   * @param phone - Phone number being rate limited
   * @param endpoint - Endpoint being accessed
   */
  private trackRateLimitRejection(phone: string, endpoint: 'consume' | 'claim'): void {
    const now = new Date();
    const cacheKey = `${phone}:${endpoint}`;
    const abuseThreshold = 50;
    const windowDurationMs = 60 * 60 * 1000; // 1 hour

    // Get or create tracking entry
    let tracking = this.abuseDetectionCache.get(cacheKey);
    
    if (!tracking) {
      tracking = { count: 0, windowStart: now };
      this.abuseDetectionCache.set(cacheKey, tracking);
    }

    // Check if we're still in the same window
    const windowAge = now.getTime() - tracking.windowStart.getTime();
    if (windowAge > windowDurationMs) {
      // Start new window
      tracking = { count: 0, windowStart: now };
      this.abuseDetectionCache.set(cacheKey, tracking);
    }

    // Increment rejection count
    tracking.count++;

    // Log if threshold exceeded
    if (tracking.count === abuseThreshold) {
      // Log to database
      this.db
        .prepare(
          `INSERT INTO system_logs (level, message, details, created_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(
          'warn',
          'Rate limit abuse detected',
          JSON.stringify({
            phone: '****' + phone.slice(-4), // Masked
            endpoint,
            rejectionCount: tracking.count,
            windowStart: tracking.windowStart.toISOString(),
            windowDurationMinutes: windowDurationMs / 60000,
          }),
          now.toISOString()
        );

      // Also log to console for immediate visibility
      console.warn(`[ABUSE DETECTION] Phone ${phone.slice(-4)} exceeded ${abuseThreshold} rate limit rejections in 1 hour on ${endpoint} endpoint`);
    } else if (tracking.count > abuseThreshold && tracking.count % 10 === 0) {
      // Log every 10 rejections after threshold
      this.db
        .prepare(
          `INSERT INTO system_logs (level, message, details, created_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(
          'warn',
          'Continued rate limit abuse',
          JSON.stringify({
            phone: '****' + phone.slice(-4), // Masked
            endpoint,
            rejectionCount: tracking.count,
            windowStart: tracking.windowStart.toISOString(),
          }),
          now.toISOString()
        );
    }
  }

  /**
   * Get abuse detection statistics for monitoring
   * Returns phones that have exceeded the abuse threshold
   * 
   * @returns Array of abuse detection entries
   */
  getAbuseStatistics(): Array<{ phone: string; endpoint: string; count: number; windowStart: Date }> {
    const stats: Array<{ phone: string; endpoint: string; count: number; windowStart: Date }> = [];
    const abuseThreshold = 50;

    for (const [key, tracking] of this.abuseDetectionCache.entries()) {
      if (tracking.count >= abuseThreshold) {
        const [phone, endpoint] = key.split(':');
        stats.push({
          phone: '****' + phone.slice(-4), // Masked
          endpoint,
          count: tracking.count,
          windowStart: tracking.windowStart,
        });
      }
    }

    return stats;
  }

  /**
   * Clear abuse detection cache (for testing or manual reset)
   */
  clearAbuseCache(): void {
    this.abuseDetectionCache.clear();
  }

  /**
   * Increment the request counter for a phone/endpoint combination
   * Creates a new counter if one doesn't exist or if the reset time has passed
   * 
   * @param phone - Phone number making the request
   * @param endpoint - Endpoint being accessed ('consume' or 'claim')
   */
  incrementCounter(phone: string, endpoint: 'consume' | 'claim'): void {
    const now = new Date();
    const resetAt = this.calculateMidnightIstanbul(now);

    // Try to get existing counter
    const existing = this.db
      .prepare(
        `SELECT * FROM coupon_rate_limits
         WHERE phone = ? AND endpoint = ?`
      )
      .get(phone, endpoint) as CouponRateLimitDb | undefined;

    if (!existing) {
      // Create new counter
      this.db
        .prepare(
          `INSERT INTO coupon_rate_limits (phone, endpoint, count, reset_at)
           VALUES (?, ?, 1, ?)`
        )
        .run(phone, endpoint, resetAt.toISOString());
    } else {
      const existingResetAt = new Date(existing.reset_at);
      
      // If reset time has passed, reset counter to 1
      if (now >= existingResetAt) {
        this.db
          .prepare(
            `UPDATE coupon_rate_limits
             SET count = 1, reset_at = ?
             WHERE phone = ? AND endpoint = ?`
          )
          .run(resetAt.toISOString(), phone, endpoint);
      } else {
        // Increment existing counter
        this.db
          .prepare(
            `UPDATE coupon_rate_limits
             SET count = count + 1
             WHERE phone = ? AND endpoint = ?`
          )
          .run(phone, endpoint);
      }
    }
  }

  /**
   * Delete expired rate limit counters
   * Should be called periodically (e.g., daily at midnight)
   */
  resetExpiredCounters(): void {
    const now = new Date().toISOString();
    
    const result = this.db
      .prepare(
        `DELETE FROM coupon_rate_limits
         WHERE reset_at <= ?`
      )
      .run(now);

    return;
  }

  /**
   * Get current counter for a phone/endpoint (for testing/debugging)
   * 
   * @param phone - Phone number
   * @param endpoint - Endpoint
   * @returns Current rate limit record or null
   */
  getCounter(phone: string, endpoint: 'consume' | 'claim'): CouponRateLimit | null {
    const row = this.db
      .prepare(
        `SELECT * FROM coupon_rate_limits
         WHERE phone = ? AND endpoint = ?`
      )
      .get(phone, endpoint) as CouponRateLimitDb | undefined;

    if (!row) {
      return null;
    }

    return {
      phone: row.phone,
      endpoint: row.endpoint as 'consume' | 'claim',
      count: row.count,
      resetAt: new Date(row.reset_at),
    };
  }

  /**
   * Calculate the next midnight in Istanbul timezone (Europe/Istanbul)
   * Accounts for DST changes automatically
   * 
   * @param from - Date to calculate from (defaults to now)
   * @returns Date object representing midnight Istanbul time (in UTC)
   */
  private calculateMidnightIstanbul(from: Date = new Date()): Date {
    // Format the current time in Istanbul timezone to get date components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(from);
    const year = parseInt(parts.find(p => p.type === 'year')!.value);
    const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // JS months are 0-indexed
    const day = parseInt(parts.find(p => p.type === 'day')!.value);

    // Create tomorrow's date at midnight in Istanbul
    // We create it as a local date first, then adjust for timezone
    const tomorrowIstanbulStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${(day + 1).toString().padStart(2, '0')}T00:00:00`;
    
    // Parse this as if it were in Istanbul timezone
    // To do this, we need to find what UTC time corresponds to midnight Istanbul
    // We'll use the fact that we can format a date in Istanbul timezone and compare
    
    // Create a date object for tomorrow at noon UTC (arbitrary time)
    const testDate = new Date(Date.UTC(year, month, day + 1, 12, 0, 0));
    
    // Format it in Istanbul timezone
    const testInIstanbul = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(testDate);
    
    // Extract hour from Istanbul time
    const testParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(testDate);
    const istanbulHour = parseInt(testParts.find(p => p.type === 'hour')!.value);
    
    // Calculate offset: if it's 12:00 UTC and shows as 15:00 in Istanbul, offset is +3 hours
    const offsetHours = istanbulHour - 12;
    
    // Midnight Istanbul = midnight - offset in UTC
    // If Istanbul is UTC+3, then midnight Istanbul = 21:00 previous day UTC
    const midnightUTC = new Date(Date.UTC(year, month, day + 1, 0 - offsetHours, 0, 0));
    
    return midnightUTC;
  }
}
