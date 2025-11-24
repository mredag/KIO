import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { DatabaseService } from '../database/DatabaseService.js';
import { QRCodeService } from '../services/QRCodeService.js';
import { createKioskRoutes } from './kioskRoutes.js';
import { initializeDatabase } from '../database/init.js';

describe('Kiosk Routes', () => {
  let app: Express;
  let db: Database.Database;
  let dbService: DatabaseService;
  let qrService: QRCodeService;

  beforeEach(() => {
    // Initialize test database in memory
    db = initializeDatabase(':memory:');
    dbService = new DatabaseService(db);
    qrService = new QRCodeService();

    // Create Express app with kiosk routes
    app = express();
    app.use(express.json());
    app.use('/api/kiosk', createKioskRoutes(dbService, qrService));
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/kiosk/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/kiosk/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/kiosk/state', () => {
    it('should return kiosk state with mode and config', async () => {
      const response = await request(app).get('/api/kiosk/state');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mode');
      expect(response.body).toHaveProperty('activeSurveyId');
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('slideshowTimeout');
      expect(response.body.config).toHaveProperty('surveyTimeout');
      expect(response.body.config).toHaveProperty('googleQrDisplayDuration');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should respond within 3 seconds', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/api/kiosk/state');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000);
    });

    it('should update heartbeat timestamp', async () => {
      const stateBefore = dbService.getKioskState();
      const heartbeatBefore = stateBefore.last_heartbeat;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await request(app).get('/api/kiosk/state');

      const stateAfter = dbService.getKioskState();
      const heartbeatAfter = stateAfter.last_heartbeat;

      expect(heartbeatAfter).not.toBe(heartbeatBefore);
    });
  });

  describe('GET /api/kiosk/menu', () => {
    it('should return massage list with featured and regular sections', async () => {
      const response = await request(app).get('/api/kiosk/menu');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('featured');
      expect(response.body).toHaveProperty('regular');
      expect(response.body).toHaveProperty('timestamp');
      expect(Array.isArray(response.body.featured)).toBe(true);
      expect(Array.isArray(response.body.regular)).toBe(true);
    });

    it('should respond within 1 second', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/api/kiosk/menu');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });

    it('should separate featured massages from regular ones', async () => {
      // Create a featured massage
      dbService.createMassage({
        name: 'Featured Massage',
        short_description: 'A featured massage',
        is_featured: true,
        is_campaign: false,
      });

      // Create a regular massage
      dbService.createMassage({
        name: 'Regular Massage',
        short_description: 'A regular massage',
        is_featured: false,
        is_campaign: false,
      });

      const response = await request(app).get('/api/kiosk/menu');

      expect(response.status).toBe(200);
      expect(response.body.featured.length).toBeGreaterThan(0);
      expect(response.body.regular.length).toBeGreaterThan(0);

      // Verify featured massages have is_featured = 1
      response.body.featured.forEach((massage: any) => {
        expect(massage.is_featured).toBe(1);
      });

      // Verify regular massages have is_featured = 0
      response.body.regular.forEach((massage: any) => {
        expect(massage.is_featured).toBe(0);
      });
    });
  });

  describe('GET /api/kiosk/survey/:id', () => {
    it('should return survey template by ID', async () => {
      // Get existing survey from seed data
      const surveys = dbService.getSurveyTemplates();
      expect(surveys.length).toBeGreaterThan(0);

      const surveyId = surveys[0].id;
      const response = await request(app).get(`/api/kiosk/survey/${surveyId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', surveyId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
    });

    it('should return 404 for non-existent survey', async () => {
      const response = await request(app).get('/api/kiosk/survey/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Survey not found');
    });

    it('should respond within 1 second', async () => {
      const surveys = dbService.getSurveyTemplates();
      const surveyId = surveys[0].id;

      const startTime = Date.now();
      const response = await request(app).get(`/api/kiosk/survey/${surveyId}`);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('POST /api/kiosk/survey-response', () => {
    it('should create survey response successfully', async () => {
      const surveys = dbService.getSurveyTemplates();
      const surveyId = surveys[0].id;

      const response = await request(app)
        .post('/api/kiosk/survey-response')
        .send({
          surveyId,
          answers: {
            question1: 'answer1',
            question2: 'answer2',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('responseId');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 400 if surveyId is missing', async () => {
      const response = await request(app)
        .post('/api/kiosk/survey-response')
        .send({
          answers: { question1: 'answer1' },
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 400 if answers are missing', async () => {
      const response = await request(app)
        .post('/api/kiosk/survey-response')
        .send({
          surveyId: 'some-id',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 404 if survey does not exist', async () => {
      const response = await request(app)
        .post('/api/kiosk/survey-response')
        .send({
          surveyId: 'non-existent-id',
          answers: { question1: 'answer1' },
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Survey not found');
    });

    it('should store response in database with synced=0', async () => {
      const surveys = dbService.getSurveyTemplates();
      const surveyId = surveys[0].id;

      const response = await request(app)
        .post('/api/kiosk/survey-response')
        .send({
          surveyId,
          answers: { question1: 'answer1' },
        });

      expect(response.status).toBe(201);

      // Verify response is stored in database
      const storedResponse = dbService.getSurveyResponseById(response.body.responseId);
      expect(storedResponse).toBeTruthy();
      expect(storedResponse?.synced).toBe(0); // Not synced yet
      expect(storedResponse?.survey_id).toBe(surveyId);
    });
  });

  describe('GET /api/kiosk/google-review', () => {
    it('should return Google review config with QR code', async () => {
      // Set up Google review URL in settings
      dbService.updateSettings({
        google_review_url: 'https://g.page/r/CdXXXXXXXXXXXXXX/review',
        google_review_title: 'Leave us a review',
        google_review_description: 'Scan to review us on Google',
      });

      const response = await request(app).get('/api/kiosk/google-review');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('title', 'Leave us a review');
      expect(response.body).toHaveProperty('description', 'Scan to review us on Google');
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(response.body).toHaveProperty('displayDuration');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should use default Google review URL from seed data', async () => {
      // The seed data sets a default Google review URL
      const response = await request(app).get('/api/kiosk/google-review');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('g.page');
      expect(response.body).toHaveProperty('qrCode');
    });

    it('should respond within 1 second', async () => {
      dbService.updateSettings({
        google_review_url: 'https://g.page/r/CdXXXXXXXXXXXXXX/review',
      });

      const startTime = Date.now();
      const response = await request(app).get('/api/kiosk/google-review');
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Heartbeat updates', () => {
    it('should update heartbeat on all kiosk endpoints', async () => {
      const endpoints = [
        '/api/kiosk/health',
        '/api/kiosk/state',
        '/api/kiosk/menu',
      ];

      for (const endpoint of endpoints) {
        const stateBefore = dbService.getKioskState();
        const heartbeatBefore = stateBefore.last_heartbeat;

        // Wait a bit to ensure timestamp changes
        await new Promise((resolve) => setTimeout(resolve, 10));

        await request(app).get(endpoint);

        const stateAfter = dbService.getKioskState();
        const heartbeatAfter = stateAfter.last_heartbeat;

        expect(heartbeatAfter).not.toBe(heartbeatBefore);
      }
    });
  });
});
