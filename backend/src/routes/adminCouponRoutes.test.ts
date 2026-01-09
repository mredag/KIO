/**
 * Admin Coupon Routes Tests
 * 
 * Tests the admin API endpoints for the WhatsApp coupon system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import { DatabaseService } from '../database/DatabaseService.js';
import { CouponService } from '../services/CouponService.js';
import { EventLogService } from '../services/EventLogService.js';
import { createAdminCouponRoutes } from './adminCouponRoutes.js';

describe('Admin Coupon Routes', () => {
  let app: Express;
  let db: Database.Database;
  let dbService: DatabaseService;
  let couponService: CouponService;
  let eventLogService: EventLogService;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupon_tokens (
        token TEXT PRIMARY KEY,
        status TEXT CHECK(status IN ('issued','used','expired')) DEFAULT 'issued',
        issued_for TEXT,
        kiosk_id TEXT,
        phone TEXT,
        expires_at DATETIME,
        used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coupon_wallets (
        phone TEXT PRIMARY KEY,
        coupon_count INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_redeemed INTEGER DEFAULT 0,
        opted_in_marketing INTEGER DEFAULT 0,
        last_message_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        coupons_used INTEGER DEFAULT 4,
        status TEXT CHECK(status IN ('pending','completed','rejected')) DEFAULT 'pending',
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notified_at DATETIME,
        completed_at DATETIME,
        rejected_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS coupon_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        event TEXT,
        token TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize services
    dbService = new DatabaseService(db);
    couponService = new CouponService(db, '905551234567');
    eventLogService = new EventLogService(db);

    // Create Express app
    app = express();
    app.use(express.json());

    // Mock session middleware
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
      })
    );

    // Mock authentication - set user in session
    app.use((req, _res, next) => {
      req.session.user = { username: 'test-admin' };
      next();
    });

    // Mount routes
    app.use('/api/admin/coupons', createAdminCouponRoutes(dbService, couponService, eventLogService));
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/admin/coupons/issue', () => {
    it('should issue a new token', async () => {
      const response = await request(app)
        .post('/api/admin/coupons/issue')
        .send({ kioskId: 'kiosk-1', issuedFor: 'massage-123' })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('waUrl');
      expect(response.body).toHaveProperty('waText');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.token).toHaveLength(12);
      expect(response.body.waUrl).toContain('wa.me');
      expect(response.body.waText).toContain('KUPON');
    });

    it('should return 400 if kioskId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/coupons/issue')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/admin/coupons/wallet/:phone', () => {
    it('should return 404 for non-existent wallet', async () => {
      await request(app)
        .get('/api/admin/coupons/wallet/+905551234567')
        .expect(404);
    });

    it('should return wallet details', async () => {
      // Create a wallet by consuming a token
      const token = couponService.issueToken('kiosk-1');
      couponService.consumeToken('+905551234567', token.token);

      const response = await request(app)
        .get('/api/admin/coupons/wallet/+905551234567')
        .expect(200);

      expect(response.body).toHaveProperty('phone', '+905551234567');
      expect(response.body).toHaveProperty('couponCount', 1);
      expect(response.body).toHaveProperty('totalEarned', 1);
      expect(response.body).toHaveProperty('totalRedeemed', 0);
    });
  });

  describe('GET /api/admin/coupons/redemptions', () => {
    it('should return empty array when no redemptions', async () => {
      const response = await request(app)
        .get('/api/admin/coupons/redemptions')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return redemptions with filters', async () => {
      // Create wallet with 4 coupons
      for (let i = 0; i < 4; i++) {
        const token = couponService.issueToken('kiosk-1');
        couponService.consumeToken('+905551234567', token.token);
      }

      // Claim redemption
      couponService.claimRedemption('+905551234567');

      const response = await request(app)
        .get('/api/admin/coupons/redemptions?status=pending')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('status', 'pending');
      expect(response.body[0]).toHaveProperty('phoneMasked');
    });
  });

  describe('POST /api/admin/coupons/redemptions/:id/complete', () => {
    it('should complete a redemption', async () => {
      // Create wallet with 4 coupons and claim redemption
      for (let i = 0; i < 4; i++) {
        const token = couponService.issueToken('kiosk-1');
        couponService.consumeToken('+905551234567', token.token);
      }

      const claim = couponService.claimRedemption('+905551234567');

      const response = await request(app)
        .post(`/api/admin/coupons/redemptions/${claim.redemptionId}/complete`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 404 for non-existent redemption', async () => {
      await request(app)
        .post('/api/admin/coupons/redemptions/invalid-id/complete')
        .expect(404);
    });
  });

  describe('POST /api/admin/coupons/redemptions/:id/reject', () => {
    it('should reject a redemption and refund coupons', async () => {
      // Create wallet with 4 coupons and claim redemption
      for (let i = 0; i < 4; i++) {
        const token = couponService.issueToken('kiosk-1');
        couponService.consumeToken('+905551234567', token.token);
      }

      const claim = couponService.claimRedemption('+905551234567');

      const response = await request(app)
        .post(`/api/admin/coupons/redemptions/${claim.redemptionId}/reject`)
        .send({ note: 'Test rejection reason' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify coupons were refunded
      const wallet = couponService.getWallet('+905551234567');
      expect(wallet?.couponCount).toBe(4);
    });

    it('should return 400 if note is missing', async () => {
      // Create wallet with 4 coupons and claim redemption
      for (let i = 0; i < 4; i++) {
        const token = couponService.issueToken('kiosk-1');
        couponService.consumeToken('+905551234567', token.token);
      }

      const claim = couponService.claimRedemption('+905551234567');

      await request(app)
        .post(`/api/admin/coupons/redemptions/${claim.redemptionId}/reject`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/admin/coupons/events/:phone', () => {
    it('should return event history for a phone', async () => {
      // Create some events
      const token = couponService.issueToken('kiosk-1');
      couponService.consumeToken('+905551234567', token.token);

      const response = await request(app)
        .get('/api/admin/coupons/events/+905551234567')
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('event');
      expect(response.body[0]).toHaveProperty('phoneMasked');
    });

    it('should return empty array for phone with no events', async () => {
      const response = await request(app)
        .get('/api/admin/coupons/events/+905550000000')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
