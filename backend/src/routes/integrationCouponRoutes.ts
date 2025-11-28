/**
 * Integration Coupon Routes
 * 
 * Handles n8n integration operations for the WhatsApp coupon loyalty system:
 * - Token consumption (when customer sends token via WhatsApp)
 * - Redemption claims (when customer requests to use coupons)
 * - Wallet lookup (for balance checks)
 * - Opt-out (marketing preferences)
 * 
 * All routes require API key authentication.
 * Consume and claim routes have rate limiting.
 * 
 * Requirements: 2.4, 4.2-4.3, 7.1-7.5, 9.1-9.2, 10.2, 13.1
 */

import { Router, Request, Response } from 'express';
import { CouponService } from '../services/CouponService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { createCouponRateLimitMiddleware } from '../middleware/couponRateLimitMiddleware.js';
import Database from 'better-sqlite3';
import i18n from '../i18n/config.js';

/**
 * Create integration coupon routes
 * 
 * @param db - Database instance for rate limiting
 * @param dbService - Database service instance for logging
 * @param couponService - Coupon service instance
 * @returns Express router with integration coupon routes
 */
export function createIntegrationCouponRoutes(
  db: Database.Database,
  dbService: DatabaseService,
  couponService: CouponService
): Router {
  const router = Router();
  const couponRateLimit = createCouponRateLimitMiddleware(db);

  /**
   * GET /api/integrations/coupons/health
   * Health check endpoint for coupon system monitoring
   * 
   * Requirements: 26.1, 26.2
   * 
   * Checks:
   * - Database connectivity (can query coupon tables)
   * - n8n webhook reachability (if N8N_WEBHOOK_URL is configured)
   * 
   * Response:
   * - status: 'healthy' | 'degraded' | 'unhealthy'
   * - timestamp: string (ISO 8601)
   * - components: object with component health status
   *   - database: { status: 'up' | 'down', message?: string }
   *   - n8nWebhook: { status: 'up' | 'down' | 'not_configured', message?: string }
   */
  router.get('/health', async (req: Request, res: Response) => {
    const healthCheck = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      timestamp: new Date().toISOString(),
      components: {
        database: { status: 'up' as 'up' | 'down', message: undefined as string | undefined },
        n8nWebhook: { status: 'not_configured' as 'up' | 'down' | 'not_configured', message: undefined as string | undefined },
      },
    };

    // Check database connectivity
    try {
      // Try to query coupon_tokens table
      const stmt = db.prepare('SELECT COUNT(*) as count FROM coupon_tokens LIMIT 1');
      stmt.get();
      healthCheck.components.database.status = 'up';
    } catch (error: any) {
      healthCheck.components.database.status = 'down';
      healthCheck.components.database.message = error.message;
      healthCheck.status = 'unhealthy';
    }

    // Check n8n webhook reachability (if configured)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        // Try to reach n8n webhook with a HEAD request (non-intrusive)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(n8nWebhookUrl, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok || response.status === 404 || response.status === 405) {
          // 404/405 means n8n is reachable but endpoint doesn't accept HEAD
          healthCheck.components.n8nWebhook.status = 'up';
        } else {
          healthCheck.components.n8nWebhook.status = 'down';
          healthCheck.components.n8nWebhook.message = `HTTP ${response.status}`;
          healthCheck.status = healthCheck.status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
      } catch (error: any) {
        healthCheck.components.n8nWebhook.status = 'down';
        healthCheck.components.n8nWebhook.message = error.message;
        healthCheck.status = healthCheck.status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    }

    // Return appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : healthCheck.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  });

  /**
   * POST /api/integrations/coupons/consume
   * Consume a coupon token and add to customer's wallet
   * 
   * Requirements: 2.4, 7.1, 7.2, 7.3, 7.4, 7.5, 9.1
   * 
   * Request body:
   * - phone: string (required) - Customer phone number (will be normalized)
   * - token: string (required) - Coupon token to consume
   * 
   * Response (success):
   * - ok: true
   * - balance: number - Current coupon count
   * - remainingToFree: number - Coupons needed for free massage
   * 
   * Response (error):
   * - error.code: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'RATE_LIMIT_EXCEEDED'
   * - error.message: string
   */
  router.post('/consume', apiKeyAuth, couponRateLimit, (req: Request, res: Response) => {
    try {
      const { phone, token } = req.body;

      // Validate required fields
      if (!phone || typeof phone !== 'string') {
        res.status(400).json({
          error: {
            code: 'MISSING_PHONE',
            message: 'Phone number is required',
          },
        });
        return;
      }

      if (!token || typeof token !== 'string') {
        res.status(400).json({
          error: {
            code: 'MISSING_TOKEN',
            message: 'Token is required',
          },
        });
        return;
      }

      // Consume token
      const result = couponService.consumeToken(phone, token);

      // Check if consumption failed
      if (!result.ok) {
        if (result.error === 'INVALID_TOKEN') {
          res.status(400).json({
            error: {
              code: 'INVALID_TOKEN',
              message: i18n.t('errors:invalidToken', {
                defaultValue: 'Token is invalid or has already been used',
              }),
            },
          });
          return;
        } else if (result.error === 'EXPIRED_TOKEN') {
          res.status(400).json({
            error: {
              code: 'EXPIRED_TOKEN',
              message: i18n.t('errors:expiredToken', {
                defaultValue: 'Token has expired',
              }),
            },
          });
          return;
        }
      }

      // Log consumption
      dbService.createLog({
        level: 'info',
        message: 'Token consumed via integration',
        details: {
          phone: '****' + phone.slice(-4), // Masked
          token: token.substring(0, 4) + '****' + token.substring(8), // Masked
          balance: result.balance,
          apiClient: req.apiClient,
        },
      });

      res.json({
        ok: result.ok,
        balance: result.balance,
        remainingToFree: result.remainingToFree,
      });
    } catch (error: any) {
      console.error('Error consuming token:', error);

      // Handle specific error cases
      if (error.message === 'Token not found or already used') {
        res.status(400).json({
          error: {
            code: 'INVALID_TOKEN',
            message: i18n.t('errors:invalidToken', {
              defaultValue: 'Token is invalid or has already been used',
            }),
          },
        });
      } else if (error.message === 'Token has expired') {
        res.status(400).json({
          error: {
            code: 'EXPIRED_TOKEN',
            message: i18n.t('errors:expiredToken', {
              defaultValue: 'Token has expired',
            }),
          },
        });
      } else {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: i18n.t('errors:internalError', {
              defaultValue: 'Internal server error',
            }),
          },
        });
      }
    }
  });

  /**
   * POST /api/integrations/coupons/claim
   * Claim a redemption (exchange 4 coupons for free massage)
   * 
   * Requirements: 4.2, 4.3, 9.2
   * 
   * Request body:
   * - phone: string (required) - Customer phone number (will be normalized)
   * 
   * Response (success):
   * - ok: true
   * - redemptionId: string - Unique redemption identifier
   * 
   * Response (insufficient coupons):
   * - ok: false
   * - balance: number - Current coupon count
   * - needed: number - Additional coupons needed
   * 
   * Response (error):
   * - error.code: 'INSUFFICIENT_COUPONS' | 'RATE_LIMIT_EXCEEDED'
   * - error.message: string
   */
  router.post('/claim', apiKeyAuth, couponRateLimit, (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      // Validate required fields
      if (!phone || typeof phone !== 'string') {
        res.status(400).json({
          error: {
            code: 'MISSING_PHONE',
            message: 'Phone number is required',
          },
        });
        return;
      }

      // Claim redemption
      const result = couponService.claimRedemption(phone);

      // Log claim attempt
      dbService.createLog({
        level: 'info',
        message: result.ok ? 'Redemption claimed via integration' : 'Redemption claim failed - insufficient coupons',
        details: {
          phone: '****' + phone.slice(-4), // Masked
          ok: result.ok,
          redemptionId: result.redemptionId,
          balance: result.balance,
          needed: result.needed,
          apiClient: req.apiClient,
        },
      });

      if (result.ok) {
        res.json({
          ok: true,
          redemptionId: result.redemptionId,
        });
      } else {
        res.status(400).json({
          error: {
            code: 'INSUFFICIENT_COUPONS',
            message: i18n.t('errors:insufficientCoupons', {
              defaultValue: 'Insufficient coupons for redemption',
            }),
            balance: result.balance,
            needed: result.needed,
          },
        });
      }
    } catch (error: any) {
      console.error('Error claiming redemption:', error);

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: i18n.t('errors:internalError', {
            defaultValue: 'Internal server error',
          }),
        },
      });
    }
  });

  /**
   * GET /api/integrations/coupons/wallet/:phone
   * Get wallet details for a customer
   * 
   * Requirements: 13.1
   * 
   * URL params:
   * - phone: string - Customer phone number (will be normalized)
   * 
   * Response (success):
   * - phone: string
   * - couponCount: number
   * - totalEarned: number
   * - totalRedeemed: number
   * - optedInMarketing: boolean
   * - lastMessageAt: string (ISO 8601)
   * - updatedAt: string (ISO 8601)
   * 
   * Response (not found):
   * - error.code: 'WALLET_NOT_FOUND'
   * - error.message: string
   */
  router.get('/wallet/:phone', apiKeyAuth, (req: Request, res: Response) => {
    try {
      const { phone } = req.params;

      if (!phone) {
        res.status(400).json({
          error: {
            code: 'MISSING_PHONE',
            message: 'Phone number is required',
          },
        });
        return;
      }

      // Get wallet
      const wallet = couponService.getWallet(phone);

      if (!wallet) {
        res.status(404).json({
          error: {
            code: 'WALLET_NOT_FOUND',
            message: i18n.t('errors:walletNotFound', {
              defaultValue: 'Wallet not found',
            }),
          },
        });
        return;
      }

      // Transform to camelCase for response
      res.json({
        phone: wallet.phone,
        couponCount: wallet.couponCount,
        totalEarned: wallet.totalEarned,
        totalRedeemed: wallet.totalRedeemed,
        optedInMarketing: wallet.optedInMarketing,
        lastMessageAt: wallet.lastMessageAt?.toISOString() || null,
        updatedAt: wallet.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error('Error fetching wallet:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: i18n.t('errors:internalError', {
            defaultValue: 'Internal server error',
          }),
        },
      });
    }
  });

  /**
   * POST /api/integrations/coupons/opt-out
   * Opt out of marketing messages
   * 
   * Requirements: 10.2
   * 
   * Request body:
   * - phone: string (required) - Customer phone number (will be normalized)
   * 
   * Response (success):
   * - success: true
   * - message: string
   */
  router.post('/opt-out', apiKeyAuth, (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      // Validate required fields
      if (!phone || typeof phone !== 'string') {
        res.status(400).json({
          error: {
            code: 'MISSING_PHONE',
            message: 'Phone number is required',
          },
        });
        return;
      }

      // Opt out
      couponService.optOut(phone);

      // Log opt-out
      dbService.createLog({
        level: 'info',
        message: 'Customer opted out via integration',
        details: {
          phone: '****' + phone.slice(-4), // Masked
          apiClient: req.apiClient,
        },
      });

      res.json({
        success: true,
        message: i18n.t('success:optedOut', {
          defaultValue: 'Successfully opted out of marketing messages',
        }),
      });
    } catch (error) {
      console.error('Error opting out:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: i18n.t('errors:internalError', {
            defaultValue: 'Internal server error',
          }),
        },
      });
    }
  });

  return router;
}
