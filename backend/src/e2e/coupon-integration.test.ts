/**
 * Coupon System Integration Tests
 * 
 * This test suite validates the complete WhatsApp coupon system:
 * - End-to-end token issuance → consumption → redemption flow
 * - Rate limiting across multiple requests
 * - Authentication for all endpoints
 * - Database transaction integrity
 * - Event logging completeness
 * 
 * Requirements: All coupon system requirements (1-30)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { DatabaseService } from '../database/DatabaseService.js';
import { initializeDatabase } from '../database/init.js';
import { createAdminCouponRoutes } from '../routes/adminCouponRoutes.js';
import { createIntegrationCouponRoutes } from '../routes/integrationCouponRoutes.js';
import { CouponService } from '../services/CouponService.js';
import { EventLogService } from '../services/EventLogService.js';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Coupon System Integration Tests', () => {
  let app: express.Application;
  let db: DatabaseService;
  let testDbPath: string;
  let sessionCookie: string;
  let apiKey: string;

  // Helper function to access the underlying database
  const getDb = () => db['db'] as Database.Database;

  beforeAll(async () => {
    // Initialize test database
    testDbPath = path.join(__dirname, '../../test-coupon-integration.db');

    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbInstance = initializeDatabase(testDbPath);
    db = new DatabaseService(dbInstance);

    // Set API key for testing
    apiKey = 'test-api-key-12345';
    process.env.N8N_API_KEY = apiKey;

    // Initialize services - pass raw dbInstance, not DatabaseService wrapper
    const couponService = new CouponService(dbInstance);
    const eventLogService = new EventLogService(dbInstance);

    // Create Express app with routes
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      })
    );

    // Add login route manually for testing (simplified - just check username/password)
    const { Router } = await import('express');
    const authRouter = Router();
    authRouter.post('/login', (req, res) => {
      try {
        const { username, password } = req.body;
        
        // Simple check for test - in production this uses bcrypt
        if (username === 'admin' && password === 'admin123') {
          (req.session as any).user = { id: 1, username };
          res.json({ success: true, user: { id: 1, username } });
        } else {
          res.status(401).json({ error: { message: 'Invalid credentials' } });
        }
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: { message: 'Internal server error' } });
      }
    });

    app.use('/api/admin', authRouter);
    app.use('/api/admin/coupons', createAdminCouponRoutes(db, couponService, eventLogService));
    // Note: createIntegrationCouponRoutes expects (rawDb, dbService, couponService)
    app.use('/api/integrations/coupons', createIntegrationCouponRoutes(dbInstance, db, couponService));

    // Add error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      console.error('Express error:', err);
      res.status(500).json({ error: { message: err.message } });
    });
  });

  afterAll(() => {
    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    delete process.env.N8N_API_KEY;
  });

  beforeEach(async () => {
    // Clear coupon tables between tests
    db.transaction(() => {
      getDb().prepare('DELETE FROM coupon_tokens').run();
      getDb().prepare('DELETE FROM coupon_wallets').run();
      getDb().prepare('DELETE FROM coupon_redemptions').run();
      getDb().prepare('DELETE FROM coupon_events').run();
      getDb().prepare('DELETE FROM coupon_rate_limits').run();
    });
  });

  describe('1. End-to-End Token Flow: Issuance → Consumption → Redemption', () => {
    it('should complete full token lifecycle', async () => {
      // Step 1: Login to admin panel
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      expect(loginRes.status).toBe(200);
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Step 2: Issue a token
      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1', issuedFor: 'massage-session-123' });

      expect(issueRes.status).toBe(201);
      expect(issueRes.body).toHaveProperty('token');
      expect(issueRes.body).toHaveProperty('waUrl');
      expect(issueRes.body.token).toMatch(/^[A-Z0-9]{12}$/);
      
      const token = issueRes.body.token;

      // Step 3: Verify token is in database with correct status
      const tokenRecord = getDb().prepare('SELECT * FROM coupon_tokens WHERE token = ?').get(token);
      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.status).toBe('issued');

      // Step 4: Verify 'issued' event was logged
      const issuedEvents = getDb().prepare('SELECT * FROM coupon_events WHERE event = ? AND token = ?').all('issued', token);
      expect(issuedEvents.length).toBeGreaterThan(0);

      // Step 5: Consume the token (simulate WhatsApp message)
      const phone = '+905551234567';
      const consumeRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone, token });

      expect(consumeRes.status).toBe(200);
      expect(consumeRes.body.ok).toBe(true);
      expect(consumeRes.body.balance).toBe(1);
      expect(consumeRes.body.remainingToFree).toBe(3);

      // Step 6: Verify token status updated to 'used'
      const usedTokenRecord = getDb().prepare('SELECT * FROM coupon_tokens WHERE token = ?').get(token);
      expect(usedTokenRecord.status).toBe('used');
      expect(usedTokenRecord.phone).toBe(phone);
      expect(usedTokenRecord.used_at).toBeDefined();

      // Step 7: Verify wallet was created
      const wallet = getDb().prepare('SELECT * FROM coupon_wallets WHERE phone = ?').get(phone);
      expect(wallet).toBeDefined();
      expect(wallet.coupon_count).toBe(1);
      expect(wallet.total_earned).toBe(1);

      // Step 8: Verify 'coupon_awarded' event was logged
      const awardedEvents = getDb().prepare('SELECT * FROM coupon_events WHERE event = ? AND phone = ?').all('coupon_awarded', phone);
      expect(awardedEvents.length).toBe(1);

      // Step 9: Issue and consume 3 more tokens to reach 4 coupons
      for (let i = 0; i < 3; i++) {
        const issueRes2 = await request(app)
          .post('/api/admin/coupons/issue')
          .set('Cookie', sessionCookie)
          .send({ kioskId: 'kiosk-1' });

        await request(app)
          .post('/api/integrations/coupons/consume')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ phone, token: issueRes2.body.token });
      }

      // Step 10: Verify wallet has 4 coupons
      const walletAfter = getDb().prepare('SELECT * FROM coupon_wallets WHERE phone = ?').get(phone);
      expect(walletAfter.coupon_count).toBe(4);

      // Step 11: Claim redemption
      const claimRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.ok).toBe(true);
      expect(claimRes.body).toHaveProperty('redemptionId');

      const redemptionId = claimRes.body.redemptionId;

      // Step 12: Verify wallet balance reduced to 0
      const walletAfterClaim = getDb().prepare('SELECT * FROM coupon_wallets WHERE phone = ?').get(phone);
      expect(walletAfterClaim.coupon_count).toBe(0);
      expect(walletAfterClaim.total_redeemed).toBe(4);

      // Step 13: Verify redemption record created
      const redemption = getDb().prepare('SELECT * FROM coupon_redemptions WHERE id = ?').get(redemptionId);
      expect(redemption).toBeDefined();
      expect(redemption.status).toBe('pending');
      expect(redemption.phone).toBe(phone);

      // Step 14: Verify 'redemption_granted' event was logged
      const grantedEvents = getDb().prepare('SELECT * FROM coupon_events WHERE event = ? AND phone = ?').all('redemption_granted', phone);
      expect(grantedEvents.length).toBe(1);

      // Step 15: Complete the redemption (staff action)
      const completeRes = await request(app)
        .post(`/api/admin/coupons/redemptions/${redemptionId}/complete`)
        .set('Cookie', sessionCookie)
        .send({});

      expect(completeRes.status).toBe(200);

      // Step 16: Verify redemption status updated
      const completedRedemption = getDb().prepare('SELECT * FROM coupon_redemptions WHERE id = ?').get(redemptionId);
      expect(completedRedemption.status).toBe('completed');
      expect(completedRedemption.completed_at).toBeDefined();
    });
  });

  describe('2. Rate Limiting Integration', () => {
    it('should enforce rate limits on consume endpoint', async () => {
      // Login and issue tokens
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905551234567';
      const tokens: string[] = [];

      // Issue 11 tokens
      for (let i = 0; i < 11; i++) {
        const issueRes = await request(app)
          .post('/api/admin/coupons/issue')
          .set('Cookie', sessionCookie)
          .send({ kioskId: 'kiosk-1' });
        tokens.push(issueRes.body.token);
      }

      // Consume first 10 tokens (should succeed)
      for (let i = 0; i < 10; i++) {
        const consumeRes = await request(app)
          .post('/api/integrations/coupons/consume')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ phone, token: tokens[i] });

        expect(consumeRes.status).toBe(200);
        expect(consumeRes.body.ok).toBe(true);
      }

      // 11th request should be rate limited
      const rateLimitedRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone, token: tokens[10] });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(rateLimitedRes.headers).toHaveProperty('retry-after');
    });

    it('should enforce rate limits on claim endpoint', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905559876543';

      // Create wallet with 20 coupons (enough for 5 claims)
      getDb().prepare(`
        INSERT INTO coupon_wallets (phone, coupon_count, total_earned)
        VALUES (?, 20, 20)
      `).run(phone);

      // Make 5 claims (should succeed)
      for (let i = 0; i < 5; i++) {
        const claimRes = await request(app)
          .post('/api/integrations/coupons/claim')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ phone });

        expect(claimRes.status).toBe(200);
        expect(claimRes.body.ok).toBe(true);
      }

      // 6th request should be rate limited
      const rateLimitedRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
    });

    it('should track rate limits per phone number independently', async () => {
      // Login and issue tokens
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone1 = '+905551111111';
      const phone2 = '+905552222222';

      // Issue tokens for both phones
      const tokens1: string[] = [];
      const tokens2: string[] = [];

      for (let i = 0; i < 10; i++) {
        const issueRes1 = await request(app)
          .post('/api/admin/coupons/issue')
          .set('Cookie', sessionCookie)
          .send({ kioskId: 'kiosk-1' });
        tokens1.push(issueRes1.body.token);

        const issueRes2 = await request(app)
          .post('/api/admin/coupons/issue')
          .set('Cookie', sessionCookie)
          .send({ kioskId: 'kiosk-1' });
        tokens2.push(issueRes2.body.token);
      }

      // Consume 10 tokens for phone1
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/integrations/coupons/consume')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ phone: phone1, token: tokens1[i] });
      }

      // phone1 should be rate limited
      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1' });

      const rateLimitedRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: phone1, token: issueRes.body.token });

      expect(rateLimitedRes.status).toBe(429);

      // phone2 should still be able to consume
      const phone2Res = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: phone2, token: tokens2[0] });

      expect(phone2Res.status).toBe(200);
    });
  });

  describe('3. Authentication Integration', () => {
    it('should require admin session for admin endpoints', async () => {
      // Try to issue token without authentication
      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .send({ kioskId: 'kiosk-1' });

      expect(issueRes.status).toBe(401);

      // Try to get redemptions without authentication
      const redemptionsRes = await request(app)
        .get('/api/admin/coupons/redemptions');

      expect(redemptionsRes.status).toBe(401);

      // Try to complete redemption without authentication
      const completeRes = await request(app)
        .post('/api/admin/coupons/redemptions/test-id/complete')
        .send({});

      expect(completeRes.status).toBe(401);
    });

    it('should require API key for integration endpoints', async () => {
      // Try to consume without API key
      const consumeRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .send({ phone: '+905551234567', token: 'ABC123DEF456' });

      expect(consumeRes.status).toBe(401);

      // Try to claim without API key
      const claimRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .send({ phone: '+905551234567' });

      expect(claimRes.status).toBe(401);

      // Try with invalid API key
      const invalidKeyRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', 'Bearer wrong-key')
        .send({ phone: '+905551234567', token: 'ABC123DEF456' });

      expect(invalidKeyRes.status).toBe(401);
    });

    it('should allow authenticated requests', async () => {
      // Login for admin endpoints
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      sessionCookie = loginRes.headers['set-cookie'][0];

      // Admin endpoint should work
      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1' });

      expect(issueRes.status).toBe(201);

      // Integration endpoint should work with API key
      const consumeRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: '+905551234567', token: issueRes.body.token });

      expect(consumeRes.status).toBe(200);
    });
  });

  describe('4. Idempotency Integration', () => {
    it('should handle duplicate token consumption idempotently', async () => {
      // Login and issue token
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1' });

      const token = issueRes.body.token;
      const phone = '+905551234567';

      // First consumption
      const firstRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone, token });

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.balance).toBe(1);

      // Second consumption (duplicate)
      const secondRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone, token });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.balance).toBe(1); // Balance should not increase

      // Verify wallet still has only 1 coupon
      const wallet = getDb().prepare('SELECT * FROM coupon_wallets WHERE phone = ?').get(phone);
      expect(wallet.coupon_count).toBe(1);
      expect(wallet.total_earned).toBe(1);
    });

    it('should handle duplicate redemption claims idempotently', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905551234567';

      // Create wallet with 4 coupons
      getDb().prepare(`
        INSERT INTO coupon_wallets (phone, coupon_count, total_earned)
        VALUES (?, 4, 4)
      `).run(phone);

      // First claim
      const firstClaimRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      expect(firstClaimRes.status).toBe(200);
      expect(firstClaimRes.body.ok).toBe(true);
      const redemptionId = firstClaimRes.body.redemptionId;

      // Second claim (duplicate)
      const secondClaimRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      expect(secondClaimRes.status).toBe(200);
      expect(secondClaimRes.body.ok).toBe(true);
      expect(secondClaimRes.body.redemptionId).toBe(redemptionId); // Same redemption ID

      // Verify wallet balance is still 0 (not -4)
      const wallet = getDb().prepare('SELECT * FROM coupon_wallets WHERE phone = ?').get(phone);
      expect(wallet.coupon_count).toBe(0);

      // Verify only one redemption record exists
      const redemptions = getDb().prepare('SELECT * FROM coupon_redemptions WHERE phone = ?').all(phone);
      expect(redemptions.length).toBe(1);
    });
  });

  describe('5. Event Logging Integration', () => {
    it('should log all events in complete flow', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905551234567';

      // Issue token
      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1' });

      const token = issueRes.body.token;

      // Consume token
      await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone, token });

      // Issue 3 more tokens and consume
      for (let i = 0; i < 3; i++) {
        const issueRes2 = await request(app)
          .post('/api/admin/coupons/issue')
          .set('Cookie', sessionCookie)
          .send({ kioskId: 'kiosk-1' });

        await request(app)
          .post('/api/integrations/coupons/consume')
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ phone, token: issueRes2.body.token });
      }

      // Claim redemption
      await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      // Verify all events logged
      const events = getDb().prepare('SELECT * FROM coupon_events WHERE phone = ? ORDER BY created_at').all(phone);

      // Should have: 4 coupon_awarded + 1 redemption_attempt + 1 redemption_granted = 6 events
      expect(events.length).toBeGreaterThanOrEqual(6);

      const eventTypes = events.map((e: any) => e.event);
      expect(eventTypes.filter((t: string) => t === 'coupon_awarded').length).toBe(4);
      expect(eventTypes.filter((t: string) => t === 'redemption_attempt').length).toBeGreaterThanOrEqual(1);
      expect(eventTypes.filter((t: string) => t === 'redemption_granted').length).toBe(1);
    });

    it('should retrieve event history for a phone number', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905551234567';

      // Create some events
      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1' });

      await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone, token: issueRes.body.token });

      // Get event history
      const eventsRes = await request(app)
        .get(`/api/admin/coupons/events/${encodeURIComponent(phone)}`)
        .set('Cookie', sessionCookie);

      expect(eventsRes.status).toBe(200);
      expect(Array.isArray(eventsRes.body)).toBe(true);
      expect(eventsRes.body.length).toBeGreaterThan(0);
      expect(eventsRes.body[0]).toHaveProperty('event');
      expect(eventsRes.body[0]).toHaveProperty('createdAt');
    });
  });

  describe('6. Wallet Lookup Integration', () => {
    it('should retrieve wallet details by phone number', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905551234567';

      // Create wallet
      getDb().prepare(`
        INSERT INTO coupon_wallets (phone, coupon_count, total_earned, total_redeemed, opted_in_marketing)
        VALUES (?, 2, 6, 4, 1)
      `).run(phone);

      // Get wallet via admin endpoint
      const adminWalletRes = await request(app)
        .get(`/api/admin/coupons/wallet/${encodeURIComponent(phone)}`)
        .set('Cookie', sessionCookie);

      expect(adminWalletRes.status).toBe(200);
      expect(adminWalletRes.body.phone).toBe(phone);
      expect(adminWalletRes.body.couponCount).toBe(2);
      expect(adminWalletRes.body.totalEarned).toBe(6);
      expect(adminWalletRes.body.totalRedeemed).toBe(4);
      expect(adminWalletRes.body.optedInMarketing).toBe(true);

      // Get wallet via integration endpoint
      const integrationWalletRes = await request(app)
        .get(`/api/integrations/coupons/wallet/${encodeURIComponent(phone)}`)
        .set('Authorization', `Bearer ${apiKey}`);

      expect(integrationWalletRes.status).toBe(200);
      expect(integrationWalletRes.body.phone).toBe(phone);
      expect(integrationWalletRes.body.couponCount).toBe(2);
    });

    it('should return 404 for non-existent wallet', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905559999999';

      const walletRes = await request(app)
        .get(`/api/admin/coupons/wallet/${encodeURIComponent(phone)}`)
        .set('Cookie', sessionCookie);

      expect(walletRes.status).toBe(404);
    });
  });

  describe('7. Redemption Management Integration', () => {
    it('should list and filter redemptions', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Create test redemptions
      const phone1 = '+905551111111';
      const phone2 = '+905552222222';

      getDb().prepare(`
        INSERT INTO coupon_wallets (phone, coupon_count, total_earned)
        VALUES (?, 4, 4), (?, 4, 4)
      `).run(phone1, phone2);

      // Create 2 redemptions
      await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: phone1 });

      const claim2Res = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: phone2 });

      // Complete one redemption
      await request(app)
        .post(`/api/admin/coupons/redemptions/${claim2Res.body.redemptionId}/complete`)
        .set('Cookie', sessionCookie)
        .send({});

      // Get all redemptions
      const allRes = await request(app)
        .get('/api/admin/coupons/redemptions')
        .set('Cookie', sessionCookie);

      expect(allRes.status).toBe(200);
      expect(allRes.body.length).toBe(2);

      // Filter by pending status
      const pendingRes = await request(app)
        .get('/api/admin/coupons/redemptions?status=pending')
        .set('Cookie', sessionCookie);

      expect(pendingRes.status).toBe(200);
      expect(pendingRes.body.length).toBe(1);
      expect(pendingRes.body[0].status).toBe('pending');

      // Filter by completed status
      const completedRes = await request(app)
        .get('/api/admin/coupons/redemptions?status=completed')
        .set('Cookie', sessionCookie);

      expect(completedRes.status).toBe(200);
      expect(completedRes.body.length).toBe(1);
      expect(completedRes.body[0].status).toBe('completed');
    });

    it('should reject redemption and refund coupons', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const phone = '+905559999999'; // Use unique phone to avoid conflicts

      // Create wallet with 4 coupons (required for redemption)
      getDb().prepare(`
        INSERT OR REPLACE INTO coupon_wallets (phone, coupon_count, total_earned, total_redeemed)
        VALUES (?, 4, 4, 0)
      `).run(phone);

      const claimRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      const redemptionId = claimRes.body.redemptionId;

      // Reject redemption
      const rejectRes = await request(app)
        .post(`/api/admin/coupons/redemptions/${redemptionId}/reject`)
        .set('Cookie', sessionCookie)
        .send({ note: 'Customer did not show up' });

      expect(rejectRes.status).toBe(200);

      // Verify redemption status
      const redemption = getDb().prepare('SELECT * FROM coupon_redemptions WHERE id = ?').get(redemptionId);
      expect(redemption.status).toBe('rejected');
      expect(redemption.note).toBe('Customer did not show up');
      expect(redemption.rejected_at).toBeDefined();

      // Verify coupons refunded
      const wallet = getDb().prepare('SELECT * FROM coupon_wallets WHERE phone = ?').get(phone);
      expect(wallet.coupon_count).toBe(4);
    });
  });

  describe('8. Error Handling Integration', () => {
    it('should handle invalid token gracefully', async () => {
      const consumeRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: '+905551234567', token: 'INVALIDTOKEN' });

      expect(consumeRes.status).toBe(400);
      expect(consumeRes.body.error).toHaveProperty('code', 'INVALID_TOKEN');
    });

    it('should handle insufficient coupons for redemption', async () => {
      const phone = '+905551234567';

      // Create wallet with only 2 coupons
      getDb().prepare(`
        INSERT INTO coupon_wallets (phone, coupon_count, total_earned)
        VALUES (?, 2, 2)
      `).run(phone);

      const claimRes = await request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone });

      expect(claimRes.status).toBe(400);
      expect(claimRes.body.error).toHaveProperty('code', 'INSUFFICIENT_COUPONS');
      expect(claimRes.body.error).toHaveProperty('balance', 2);
      expect(claimRes.body.error).toHaveProperty('needed', 2);
    });

    it('should handle expired tokens', async () => {
      // Login and issue token
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const issueRes = await request(app)
        .post('/api/admin/coupons/issue')
        .set('Cookie', sessionCookie)
        .send({ kioskId: 'kiosk-1' });

      const token = issueRes.body.token;

      // Manually expire the token
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      getDb().prepare('UPDATE coupon_tokens SET expires_at = ? WHERE token = ?').run(yesterday, token);

      // Try to consume expired token
      const consumeRes = await request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ phone: '+905551234567', token });

      expect(consumeRes.status).toBe(400);
      expect(consumeRes.body.error).toHaveProperty('code', 'EXPIRED_TOKEN');
    });
  });
});

