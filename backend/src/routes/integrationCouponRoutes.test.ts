/**
 * Integration Coupon Routes Tests
 * 
 * Tests for n8n integration endpoints:
 * - Token consumption
 * - Redemption claims
 * - Wallet lookup
 * - Opt-out
 * 
 * Requirements: 2.4, 4.2-4.3, 7.1-7.5, 9.1-9.2, 10.2, 13.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import Database from 'better-sqlite3';
import { createIntegrationCouponRoutes } from './integrationCouponRoutes.js';
import { CouponService } from '../services/CouponService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { initializeDatabase } from '../database/init.js';

describe('Integration Coupon Routes', () => {
  let app: Express;
  let db: Database.Database;
  let dbService: DatabaseService;
  let couponService: CouponService;
  const validApiKey = 'test-api-key-12345';

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Initialize schema directly (initializeDatabase expects a path, not a db instance)
    const schema = `
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
      
      CREATE TABLE IF NOT EXISTS coupon_rate_limits (
        phone TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        count INTEGER DEFAULT 1,
        reset_at DATETIME NOT NULL,
        PRIMARY KEY (phone, endpoint)
      );
      
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
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
    `;
    
    db.exec(schema);
    dbService = new DatabaseService(db);
    couponService = new CouponService(db, '+905551234567');

    // Set up Express app
    app = express();
    app.use(express.json());

    // Set API key in environment
    process.env.N8N_API_KEY = validApiKey;

    // Mount routes
    app.use('/api/integrations/coupons', createIntegrationCouponRoutes(db, dbService, couponService));
  });

  afterEach(() => {
    db.close();
    delete process.env.N8N_API_KEY;
  });

  describe('POST /api/integrations/coupons/consume', () => {
    it('should consume a valid token and return balance', () => {
      // Issue a token
      const { token } = couponService.issueToken('kiosk-1', 'test-session');

      // Consume token
      const response = request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          phone: '+905551234567',
          token: token,
        })
        .expect(200);

      return response.then((res) => {
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('balance', 1);
        expect(res.body).toHaveProperty('remainingToFree', 3);
      });
    });

    it('should return error for invalid token', () => {
      const response = request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          phone: '+905551234567',
          token: 'INVALID123',
        })
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'INVALID_TOKEN');
      });
    });

    it('should return error for expired token', () => {
      // Issue a token
      const { token } = couponService.issueToken('kiosk-1', 'test-session');

      // Manually expire the token
      db.prepare("UPDATE coupon_tokens SET expires_at = datetime('now', '-1 day') WHERE token = ?").run(token);

      const response = request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          phone: '+905551234567',
          token: token,
        })
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'EXPIRED_TOKEN');
      });
    });

    it('should return 401 without API key', () => {
      return request(app)
        .post('/api/integrations/coupons/consume')
        .send({
          phone: '+905551234567',
          token: 'ABC123DEF456',
        })
        .expect(401);
    });

    it('should return 401 with invalid API key', () => {
      return request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', 'Bearer invalid-key')
        .send({
          phone: '+905551234567',
          token: 'ABC123DEF456',
        })
        .expect(401);
    });

    it('should return 400 without phone', () => {
      const response = request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          token: 'ABC123DEF456',
        })
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'MISSING_PHONE');
      });
    });

    it('should return 400 without token', () => {
      const response = request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          phone: '+905551234567',
        })
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'MISSING_TOKEN');
      });
    });

    it('should be idempotent - consuming same token twice returns same balance', () => {
      // Issue a token
      const { token } = couponService.issueToken('kiosk-1', 'test-session');

      // Consume token first time
      return request(app)
        .post('/api/integrations/coupons/consume')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({
          phone: '+905551234567',
          token: token,
        })
        .expect(200)
        .then((res1) => {
          expect(res1.body.balance).toBe(1);

          // Consume same token second time - should be idempotent
          // According to Requirements 19.2: "WHEN a token has already been consumed THEN the Backend SHALL return a success response with the existing wallet balance without incrementing"
          return request(app)
            .post('/api/integrations/coupons/consume')
            .set('Authorization', `Bearer ${validApiKey}`)
            .send({
              phone: '+905551234567',
              token: token,
            })
            .expect(200)
            .then((res2) => {
              // Should return same balance without incrementing
              expect(res2.body.ok).toBe(true);
              expect(res2.body.balance).toBe(1); // Same as first call
            });
        });
    });
  });

  describe('POST /api/integrations/coupons/claim', () => {
    it('should claim redemption with sufficient coupons', () => {
      const phone = '+905551234567';

      // Issue and consume 4 tokens
      for (let i = 0; i < 4; i++) {
        const { token } = couponService.issueToken('kiosk-1', `session-${i}`);
        couponService.consumeToken(phone, token);
      }

      // Claim redemption
      const response = request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({ phone })
        .expect(200);

      return response.then((res) => {
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('redemptionId');
        expect(typeof res.body.redemptionId).toBe('string');
      });
    });

    it('should return error with insufficient coupons', () => {
      const phone = '+905551234567';

      // Issue and consume only 2 tokens
      for (let i = 0; i < 2; i++) {
        const { token } = couponService.issueToken('kiosk-1', `session-${i}`);
        couponService.consumeToken(phone, token);
      }

      // Try to claim redemption
      const response = request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({ phone })
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'INSUFFICIENT_COUPONS');
        expect(res.body.error).toHaveProperty('balance', 2);
        expect(res.body.error).toHaveProperty('needed', 2);
      });
    });

    it('should be idempotent - claiming twice returns same redemption ID', () => {
      const phone = '+905551234567';

      // Issue and consume 4 tokens
      for (let i = 0; i < 4; i++) {
        const { token } = couponService.issueToken('kiosk-1', `session-${i}`);
        couponService.consumeToken(phone, token);
      }

      // Claim redemption first time
      return request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({ phone })
        .expect(200)
        .then((res1) => {
          const redemptionId1 = res1.body.redemptionId;

          // Claim redemption second time
          return request(app)
            .post('/api/integrations/coupons/claim')
            .set('Authorization', `Bearer ${validApiKey}`)
            .send({ phone })
            .expect(200)
            .then((res2) => {
              // Should return same redemption ID
              expect(res2.body.redemptionId).toBe(redemptionId1);
            });
        });
    });

    it('should return 401 without API key', () => {
      return request(app)
        .post('/api/integrations/coupons/claim')
        .send({ phone: '+905551234567' })
        .expect(401);
    });

    it('should return 400 without phone', () => {
      const response = request(app)
        .post('/api/integrations/coupons/claim')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({})
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'MISSING_PHONE');
      });
    });
  });

  describe('GET /api/integrations/coupons/wallet/:phone', () => {
    it('should return wallet details for existing customer', () => {
      const phone = '+905551234567';

      // Create wallet by consuming a token
      const { token } = couponService.issueToken('kiosk-1', 'test-session');
      couponService.consumeToken(phone, token);

      // Get wallet
      const response = request(app)
        .get(`/api/integrations/coupons/wallet/${encodeURIComponent(phone)}`)
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(200);

      return response.then((res) => {
        expect(res.body).toHaveProperty('phone', phone);
        expect(res.body).toHaveProperty('couponCount', 1);
        expect(res.body).toHaveProperty('totalEarned', 1);
        expect(res.body).toHaveProperty('totalRedeemed', 0);
        expect(res.body).toHaveProperty('optedInMarketing', false);
        expect(res.body).toHaveProperty('updatedAt');
      });
    });

    it('should return 404 for non-existent wallet', () => {
      const response = request(app)
        .get('/api/integrations/coupons/wallet/%2B905559999999')
        .set('Authorization', `Bearer ${validApiKey}`)
        .expect(404);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'WALLET_NOT_FOUND');
      });
    });

    it('should return 401 without API key', () => {
      return request(app)
        .get('/api/integrations/coupons/wallet/%2B905551234567')
        .expect(401);
    });
  });

  describe('POST /api/integrations/coupons/opt-out', () => {
    it('should opt out customer from marketing', () => {
      const phone = '+905551234567';

      // Create wallet by consuming a token
      const { token } = couponService.issueToken('kiosk-1', 'test-session');
      couponService.consumeToken(phone, token);

      // Opt out
      const response = request(app)
        .post('/api/integrations/coupons/opt-out')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({ phone })
        .expect(200);

      return response.then((res) => {
        expect(res.body).toHaveProperty('success', true);

        // Verify wallet was updated
        const wallet = couponService.getWallet(phone);
        expect(wallet?.optedInMarketing).toBe(false);
      });
    });

    it('should return 401 without API key', () => {
      return request(app)
        .post('/api/integrations/coupons/opt-out')
        .send({ phone: '+905551234567' })
        .expect(401);
    });

    it('should return 400 without phone', () => {
      const response = request(app)
        .post('/api/integrations/coupons/opt-out')
        .set('Authorization', `Bearer ${validApiKey}`)
        .send({})
        .expect(400);

      return response.then((res) => {
        expect(res.body.error).toHaveProperty('code', 'MISSING_PHONE');
      });
    });
  });

  describe('GET /api/integrations/coupons/health', () => {
    it('should return healthy status when database is accessible', async () => {
      const response = await request(app)
        .get('/api/integrations/coupons/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('components');
      expect(response.body.components).toHaveProperty('database');
      expect(response.body.components.database).toHaveProperty('status', 'up');
      expect(response.body.components).toHaveProperty('n8nWebhook');
      expect(response.body.components.n8nWebhook).toHaveProperty('status', 'not_configured');
    });

    it('should return degraded status when n8n webhook is down', async () => {
      // Set a fake n8n webhook URL that will fail
      process.env.N8N_WEBHOOK_URL = 'http://localhost:99999/webhook';

      const response = await request(app)
        .get('/api/integrations/coupons/health')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.components.database.status).toBe('up');
      expect(response.body.components.n8nWebhook.status).toBe('down');

      delete process.env.N8N_WEBHOOK_URL;
    });

    it('should return unhealthy status when database is down', async () => {
      // Close the database to simulate failure
      db.close();

      const response = await request(app)
        .get('/api/integrations/coupons/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.components.database.status).toBe('down');

      // Recreate database for cleanup
      db = new Database(':memory:');
    });
  });
});
