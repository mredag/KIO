import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter for login attempts
 * Limits to 5 attempts per 15 minutes per IP
 * Whitelists localhost for kiosk operations
 * Requirements: 12.1, 33.1
 */

interface RateLimitEntry {
  attempts: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Localhost whitelist - kiosk runs on localhost and should not be rate limited
const LOCALHOST_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];

/**
 * Check if IP is localhost
 */
function isLocalhost(ip: string): boolean {
  return LOCALHOST_IPS.includes(ip);
}

/**
 * Rate limiting middleware for login endpoint
 * Allows 5 attempts per 15 minutes
 * Whitelists localhost to allow kiosk operations
 * Requirements: 33.1 - Rate limiting with localhost whitelist
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  // Whitelist localhost - kiosk should not be rate limited
  if (isLocalhost(ip)) {
    next();
    return;
  }
  
  const now = Date.now();

  // Get or create rate limit entry for this IP
  let entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      attempts: 0,
      resetTime: now + WINDOW_MS,
    };
    rateLimitStore.set(ip, entry);
  }

  // Check if limit exceeded
  if (entry.attempts >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((entry.resetTime - now) / 1000 / 60);
    res.status(429).json({
      error: `Too many login attempts. Please try again in ${remainingTime} minutes.`,
    });
    return;
  }

  // Increment attempt counter
  entry.attempts++;

  next();
}

/**
 * Reset rate limit for an IP (called on successful login)
 */
export function resetRateLimit(ip: string): void {
  rateLimitStore.delete(ip);
}

/**
 * Cleanup old entries periodically to prevent memory leak
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60 * 1000); // Clean up every minute
