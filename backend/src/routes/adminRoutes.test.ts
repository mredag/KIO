import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { initializeDatabase } from '../database/init.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { AuthService } from '../services/AuthService.js';
import { BackupService } from '../services/BackupService.js';
import { MediaService } from '../services/MediaService.js';
import { GoogleSheetsService } from '../services/GoogleSheetsService.js';
import { createAdminRoutes } from './adminRoutes.js';
import Database from 'better-sqlite3';
import { unlinkSync, existsSync } from 'fs';

describe('Admin Routes', () => {
  let app: express.Application;
  let db: Database.Database;
  let dbService: DatabaseService;
  let authService: AuthService;
  let agent: ReturnType<typeof request.agent>;
  const TEST_DB_PATH = './test-admin-routes.db';

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    // Initialize test database
    db = initializeDatabase(TEST_DB_PATH);
    dbService = new DatabaseService(db);
    authService = new AuthService(dbService);

    // Create Express app with session
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

    // Create admin routes
    const backupService = new BackupService(dbService, './test-backups');
    const mediaService = new MediaService('./test-uploads');
    const googleSheetsService = new GoogleSheetsService();

    app.use('/api/admin', createAdminRoutes(
      dbService,
      authService,
      backupService,
      mediaService,
      googleSheetsService
    ));

    // Create agent for session persistence
    agent = request.agent(app);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe('POST /api/admin/login', () => {
    it('should login with valid credentials', async () => {
      const response = await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      const response = await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should require username and password', async () => {
      const response = await agent
        .post('/api/admin/login')
        .send({ username: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/admin/logout', () => {
    it('should logout authenticated user', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      // Logout
      const response = await agent.post('/api/admin/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/admin/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return dashboard data for authenticated user', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent.get('/api/admin/dashboard');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('todaySurveyCount');
      expect(response.body).toHaveProperty('totalSurveyCount');
      expect(response.body).toHaveProperty('currentKioskMode');
      expect(response.body).toHaveProperty('kioskOnline');
      expect(response.body).toHaveProperty('pendingSyncCount');
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/admin/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/massages', () => {
    it('should return list of massages', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent.get('/api/admin/massages');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/admin/massages');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/massages', () => {
    it('should create a new massage', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const massageData = {
        name: 'Test Massage',
        shortDescription: 'A test massage',
        longDescription: 'A longer description',
        duration: '60 minutes',
        sessions: [{ name: 'Single Session', price: 100 }],
        purposeTags: ['Relaxation'],
        isFeatured: false,
        isCampaign: false,
      };

      const response = await agent
        .post('/api/admin/massages')
        .send(massageData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Test Massage');
      expect(response.body.id).toBeDefined();
    });

    it('should require name and short_description', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .post('/api/admin/massages')
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should validate sessions array', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .post('/api/admin/massages')
        .send({
          name: 'Test',
          short_description: 'Test',
          sessions: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('PUT /api/admin/kiosk/mode', () => {
    it('should update kiosk mode', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .put('/api/admin/kiosk/mode')
        .send({ mode: 'digital-menu' });

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('digital-menu');
    });

    it('should require valid mode', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .put('/api/admin/kiosk/mode')
        .send({ mode: 'invalid-mode' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require active_survey_id for survey mode', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .put('/api/admin/kiosk/mode')
        .send({ mode: 'survey' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('survey template');
    });
  });

  describe('GET /api/admin/surveys', () => {
    it('should return list of survey templates', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent.get('/api/admin/surveys');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/settings', () => {
    it('should return system settings without password hash', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent.get('/api/admin/settings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('slideshow_timeout');
      expect(response.body).toHaveProperty('survey_timeout');
      expect(response.body).not.toHaveProperty('admin_password_hash');
    });
  });

  describe('PUT /api/admin/settings', () => {
    it('should update timing settings', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .put('/api/admin/settings')
        .send({ slideshow_timeout: 120 });

      expect(response.status).toBe(200);
      expect(response.body.slideshow_timeout).toBe(120);
    });

    it('should validate timeout ranges', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .put('/api/admin/settings')
        .send({ slideshow_timeout: 400 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 5 and 300');
    });
  });

  describe('GET /api/admin/survey-responses', () => {
    it('should return survey responses', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent.get('/api/admin/survey-responses');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by synced status', async () => {
      // Login first
      await agent
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      const response = await agent
        .get('/api/admin/survey-responses')
        .query({ synced: 'false' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
