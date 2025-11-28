/**
 * Admin Coupon Routes
 * 
 * Handles admin operations for the WhatsApp coupon loyalty system:
 * - Token issuance
 * - Wallet lookup
 * - Redemption management
 * - Event history
 * 
 * All routes require authenticated admin session.
 * 
 * Requirements: 1.1-1.4, 5.1-5.3, 6.1-6.5, 13.1, 23.2-23.3
 */

import { Router, Request, Response } from 'express';
import { CouponService } from '../services/CouponService.js';
import { EventLogService } from '../services/EventLogService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import i18n from '../i18n/config.js';

/**
 * Create admin coupon routes
 * 
 * @param db - Database service instance
 * @param couponService - Coupon service instance
 * @param eventLogService - Event log service instance
 * @returns Express router with admin coupon routes
 */
export function createAdminCouponRoutes(
  db: DatabaseService,
  couponService: CouponService,
  eventLogService: EventLogService
): Router {
  const router = Router();

  /**
   * POST /api/admin/coupons/issue
   * Issue a new coupon token
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4
   * 
   * Request body:
   * - kioskId: string (required) - Identifier of the kiosk
   * - issuedFor: string (optional) - Reference (e.g., massage session ID)
   * 
   * Response:
   * - token: string - The generated token
   * - waUrl: string - WhatsApp deep link
   * - waText: string - Pre-filled message text
   * - expiresAt: string - Expiration timestamp
   */
  router.post('/issue', authMiddleware, (req: Request, res: Response) => {
    try {
      const { kioskId, issuedFor } = req.body;

      // Validate required fields
      if (!kioskId || typeof kioskId !== 'string') {
        res.status(400).json({ 
          error: 'kioskId is required and must be a string' 
        });
        return;
      }

      // Issue token
      const result = couponService.issueToken(kioskId, issuedFor);

      // Log token issuance
      db.createLog({
        level: 'info',
        message: 'Coupon token issued',
        details: {
          token: result.token.substring(0, 4) + '****' + result.token.substring(8), // Masked
          kioskId,
          issuedFor,
          user: req.session.user?.username,
        },
      });

      res.status(201).json({
        token: result.token,
        waUrl: result.waUrl,
        waText: result.waText,
        expiresAt: result.expiresAt.toISOString(),
      });
    } catch (error: any) {
      console.error('Error issuing token:', error);
      
      if (error.message?.includes('Failed to generate unique token')) {
        res.status(500).json({ 
          error: 'Failed to generate unique token after 3 attempts' 
        });
      } else {
        res.status(500).json({ error: i18n.t('errors:internalError') });
      }
    }
  });

  /**
   * GET /api/admin/coupons/recent-tokens
   * Get recent tokens (last 10)
   * 
   * Requirements: 1.1
   * 
   * Response:
   * - tokens: Array of recent token objects
   */
  router.get('/recent-tokens', authMiddleware, (req: Request, res: Response) => {
    try {
      // Get recent tokens from database
      const tokens = db.getRecentTokens(10);

      res.json(tokens);
    } catch (error) {
      console.error('Error fetching recent tokens:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * GET /api/admin/coupons/wallet/:phone
   * Get wallet details for a customer
   * 
   * Requirements: 13.1
   * 
   * URL params:
   * - phone: string - Customer phone number (will be normalized)
   * 
   * Response:
   * - wallet: CouponWallet object or null if not found
   */
  router.get('/wallet/:phone', authMiddleware, (req: Request, res: Response) => {
    try {
      const { phone } = req.params;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      // Get wallet
      const wallet = couponService.getWallet(phone);

      if (!wallet) {
        res.status(404).json({ error: 'Wallet not found' });
        return;
      }

      // Transform to camelCase for frontend
      res.json({
        phone: wallet.phone,
        couponCount: wallet.couponCount,
        totalEarned: wallet.totalEarned,
        totalRedeemed: wallet.totalRedeemed,
        optedInMarketing: wallet.optedInMarketing,
        lastMessageAt: wallet.lastMessageAt?.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error('Error fetching wallet:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * GET /api/admin/coupons/redemptions
   * List redemptions with optional filters
   * 
   * Requirements: 5.1
   * 
   * Query params:
   * - status: 'pending' | 'completed' | 'rejected' (optional)
   * - limit: number (optional, default: 50)
   * - offset: number (optional, default: 0)
   * 
   * Response:
   * - redemptions: Array of redemption objects
   */
  router.get('/redemptions', authMiddleware, (req: Request, res: Response) => {
    try {
      const { status, limit, offset } = req.query;

      // Build filters
      const filters: any = {};

      if (status && ['pending', 'completed', 'rejected'].includes(status as string)) {
        filters.status = status as 'pending' | 'completed' | 'rejected';
      }

      if (limit) {
        const parsedLimit = parseInt(limit as string, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          filters.limit = parsedLimit;
        }
      } else {
        filters.limit = 50; // Default limit
      }

      if (offset) {
        const parsedOffset = parseInt(offset as string, 10);
        if (!isNaN(parsedOffset) && parsedOffset >= 0) {
          filters.offset = parsedOffset;
        }
      }

      // Get redemptions
      const redemptions = db.getRedemptions(filters);

      // Transform to camelCase and mask phone numbers
      const transformedRedemptions = redemptions.map((r: any) => ({
        id: r.id,
        phone: r.phone,
        phoneMasked: '****' + r.phone.slice(-4), // Mask phone for display
        couponsUsed: r.coupons_used,
        status: r.status,
        note: r.note,
        createdAt: r.created_at,
        notifiedAt: r.notified_at,
        completedAt: r.completed_at,
        rejectedAt: r.rejected_at,
      }));

      res.json(transformedRedemptions);
    } catch (error) {
      console.error('Error fetching redemptions:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * POST /api/admin/coupons/redemptions/:id/complete
   * Mark a redemption as completed
   * 
   * Requirements: 5.2, 5.3
   * 
   * URL params:
   * - id: string - Redemption ID
   * 
   * Response:
   * - success: boolean
   * - message: string
   */
  router.post('/redemptions/:id/complete', authMiddleware, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const username = req.session.user?.username || 'unknown';

      if (!id) {
        res.status(400).json({ error: 'Redemption ID is required' });
        return;
      }

      // Complete redemption
      couponService.completeRedemption(id, username);

      // Log completion
      db.createLog({
        level: 'info',
        message: 'Redemption completed',
        details: {
          redemptionId: id,
          user: username,
        },
      });

      res.json({
        success: true,
        message: 'Redemption completed successfully',
      });
    } catch (error: any) {
      console.error('Error completing redemption:', error);

      if (error.message === 'Redemption not found') {
        res.status(404).json({ error: 'Redemption not found' });
      } else {
        res.status(500).json({ error: i18n.t('errors:internalError') });
      }
    }
  });

  /**
   * POST /api/admin/coupons/redemptions/:id/reject
   * Reject a redemption and refund coupons
   * 
   * Requirements: 23.2, 23.3
   * 
   * URL params:
   * - id: string - Redemption ID
   * 
   * Request body:
   * - note: string (required) - Reason for rejection
   * 
   * Response:
   * - success: boolean
   * - message: string
   */
  router.post('/redemptions/:id/reject', authMiddleware, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const username = req.session.user?.username || 'unknown';

      if (!id) {
        res.status(400).json({ error: 'Redemption ID is required' });
        return;
      }

      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        res.status(400).json({ error: 'Rejection note is required' });
        return;
      }

      // Reject redemption
      couponService.rejectRedemption(id, note, username);

      // Log rejection
      db.createLog({
        level: 'info',
        message: 'Redemption rejected',
        details: {
          redemptionId: id,
          note,
          user: username,
        },
      });

      res.json({
        success: true,
        message: 'Redemption rejected and coupons refunded',
      });
    } catch (error: any) {
      console.error('Error rejecting redemption:', error);

      if (error.message === 'Redemption not found') {
        res.status(404).json({ error: 'Redemption not found' });
      } else if (error.message === 'Rejection note is required') {
        res.status(400).json({ error: 'Rejection note is required' });
      } else {
        res.status(500).json({ error: i18n.t('errors:internalError') });
      }
    }
  });

  /**
   * GET /api/admin/coupons/events/:phone
   * Get event history for a customer
   * 
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   * 
   * URL params:
   * - phone: string - Customer phone number (will be normalized)
   * 
   * Query params:
   * - limit: number (optional, default: 100)
   * 
   * Response:
   * - events: Array of event objects
   */
  router.get('/events/:phone', authMiddleware, (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const { limit } = req.query;

      if (!phone) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      // Parse limit
      let parsedLimit = 100;
      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          parsedLimit = limitNum;
        }
      }

      // Get events
      const events = eventLogService.getEventsByPhone(phone, parsedLimit);

      // Transform to camelCase
      const transformedEvents = events.map((e: any) => ({
        id: e.id,
        phone: e.phone,
        phoneMasked: e.phone ? '****' + e.phone.slice(-4) : null,
        event: e.event,
        token: e.token,
        tokenMasked: e.token ? e.token.substring(0, 4) + '****' + e.token.substring(8) : null,
        details: e.details,
        createdAt: e.createdAt.toISOString(),
      }));

      res.json(transformedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  return router;
}
