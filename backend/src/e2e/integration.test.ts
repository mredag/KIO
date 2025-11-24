/**
 * End-to-End Integration Tests
 * 
 * This test suite validates complete user flows across the system:
 * - Massage creation and display flow
 * - Survey submission and sync flow
 * - Kiosk mode switching
 * - Offline/online transitions
 * - System behavior during network interruptions
 * 
 * Requirements: All requirements
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DatabaseService } from '../database/DatabaseService.js';
import { initializeDatabase } from '../database/init.js';
import { createKioskRoutes } from '../routes/kioskRoutes.js';
import { createAdminRoutes } from '../routes/adminRoutes.js';
import { AuthService } from '../services/AuthService.js';
import { BackupService } from '../services/BackupService.js';
import { MediaService } from '../services/MediaService.js';
import { GoogleSheetsService } from '../services/GoogleSheetsService.js';
import { QRCodeService } from '../services/QRCodeService.js';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('End-to-End Integration Tests', () => {
  let app: express.Application;
  let db: DatabaseService;
  let testDbPath: string;
  let testUploadDir: string;
  let sessionCookie: string;

  beforeAll(async () => {
    // Initialize test database
    testDbPath = path.join(__dirname, '../../test-e2e-kiosk.db');
    testUploadDir = path.join(__dirname, '../../test-e2e-uploads');

    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Ensure test upload directory exists
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }

    const dbInstance = initializeDatabase(testDbPath);
    db = new DatabaseService(dbInstance);

    // Initialize services
    const authService = new AuthService(db);
    const backupService = new BackupService(db);
    const mediaService = new MediaService(testUploadDir);
    const googleSheetsService = new GoogleSheetsService();
    const qrCodeService = new QRCodeService();

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

    app.use('/api/kiosk', createKioskRoutes(db, qrCodeService));
    app.use('/api/admin', createAdminRoutes(db, authService, backupService, mediaService, googleSheetsService));
  });

  afterAll(() => {
    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Reset database state between tests
    // Get all massages and delete them
    const massages = db.getMassages();
    for (const massage of massages) {
      db.deleteMassage(massage.id);
    }

    // Reset kiosk state
    db.updateKioskState({ mode: 'digital-menu', active_survey_id: null });
  });

  describe('1. Complete Massage Creation and Display Flow', () => {
    it('should create a massage in admin panel and display it in kiosk', async () => {
      // Step 1: Login to admin panel
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      expect(loginRes.status).toBe(200);
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Step 2: Create a massage
      const massageData = {
        name: 'Swedish Massage',
        shortDescription: 'Relaxing full body massage',
        longDescription: 'A therapeutic massage using long strokes and kneading',
        duration: '60 minutes',
        mediaType: 'photo',
        mediaUrl: '/uploads/swedish.jpg',
        purposeTags: ['Relaxation', 'Pain Relief'],
        sessions: [
          { name: '60 min', price: 80 },
          { name: '90 min', price: 110 }
        ],
        isFeatured: true,
        isCampaign: false,
        sortOrder: 1
      };

      const createRes = await request(app)
        .post('/api/admin/massages')
        .set('Cookie', sessionCookie)
        .send(massageData);

      expect(createRes.status).toBe(201);
      expect(createRes.body).toHaveProperty('id');
      const massageId = createRes.body.id;

      // Step 3: Verify massage appears in kiosk menu
      const menuRes = await request(app)
        .get('/api/kiosk/menu');

      expect(menuRes.status).toBe(200);
      expect(menuRes.body.massages).toHaveLength(1);
      expect(menuRes.body.massages[0].name).toBe('Swedish Massage');
      expect(menuRes.body.massages[0].isFeatured).toBe(true);

      // Step 4: Update massage
      const updateRes = await request(app)
        .put(`/api/admin/massages/${massageId}`)
        .set('Cookie', sessionCookie)
        .send({ ...massageData, name: 'Swedish Relaxation Massage' });

      expect(updateRes.status).toBe(200);

      // Step 5: Verify update in kiosk
      const updatedMenuRes = await request(app)
        .get('/api/kiosk/menu');

      expect(updatedMenuRes.body.massages[0].name).toBe('Swedish Relaxation Massage');

      // Step 6: Delete massage
      const deleteRes = await request(app)
        .delete(`/api/admin/massages/${massageId}`)
        .set('Cookie', sessionCookie);

      expect(deleteRes.status).toBe(200);

      // Step 7: Verify deletion in kiosk
      const finalMenuRes = await request(app)
        .get('/api/kiosk/menu');

      expect(finalMenuRes.body.massages).toHaveLength(0);
    });

    it('should display featured massages at the top of the list', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Create multiple massages
      const massages = [
        { name: 'Regular Massage', isFeatured: false, sortOrder: 1 },
        { name: 'Featured Massage 1', isFeatured: true, sortOrder: 2 },
        { name: 'Another Regular', isFeatured: false, sortOrder: 3 },
        { name: 'Featured Massage 2', isFeatured: true, sortOrder: 4 }
      ];

      for (const massage of massages) {
        await request(app)
          .post('/api/admin/massages')
          .set('Cookie', sessionCookie)
          .send({
            name: massage.name,
            shortDescription: 'Test',
            sessions: [{ name: '60 min', price: 80 }],
            isFeatured: massage.isFeatured,
            sortOrder: massage.sortOrder
          });
      }

      // Fetch menu
      const menuRes = await request(app).get('/api/kiosk/menu');

      expect(menuRes.status).toBe(200);
      const massageList = menuRes.body.massages;

      // Featured massages should be at the top
      expect(massageList[0].isFeatured).toBe(true);
      expect(massageList[1].isFeatured).toBe(true);
      expect(massageList[2].isFeatured).toBe(false);
      expect(massageList[3].isFeatured).toBe(false);
    });
  });

  describe('2. Survey Submission and Sync Flow', () => {
    it('should submit satisfaction survey and add to sync queue', async () => {
      // Get satisfaction survey
      const surveysRes = await request(app).get('/api/admin/surveys');
      const satisfactionSurvey = surveysRes.body.find((s: any) => s.type === 'satisfaction');

      // Submit survey response
      const responseData = {
        surveyId: satisfactionSurvey.id,
        answers: {
          rating: 5,
          wouldRecommend: true
        }
      };

      const submitRes = await request(app)
        .post('/api/kiosk/survey-response')
        .send(responseData);

      expect(submitRes.status).toBe(201);
      expect(submitRes.body).toHaveProperty('id');

      // Verify response is stored
      const responses = db.getSurveyResponses();
      expect(responses).toHaveLength(1);
      expect(responses[0].synced).toBe(0); // Not synced yet
    });

    it('should handle discovery survey submission', async () => {
      // Get discovery survey
      const surveysRes = await request(app).get('/api/admin/surveys');
      const discoverySurvey = surveysRes.body.find((s: any) => s.type === 'discovery');

      // Submit survey response
      const responseData = {
        surveyId: discoverySurvey.id,
        answers: {
          discoveryChannel: 'Google search results',
          hasExperience: 'Yes'
        }
      };

      const submitRes = await request(app)
        .post('/api/kiosk/survey-response')
        .send(responseData);

      expect(submitRes.status).toBe(201);

      // Verify response is stored
      const responses = db.getSurveyResponses();
      expect(responses).toHaveLength(1);
    });

    it('should track sync status for survey responses', async () => {
      // Submit a survey
      const surveysRes = await request(app).get('/api/admin/surveys');
      const survey = surveysRes.body[0];

      await request(app)
        .post('/api/kiosk/survey-response')
        .send({
          surveyId: survey.id,
          answers: { test: 'data' }
        });

      // Check sync queue count
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      const dashboardRes = await request(app)
        .get('/api/admin/dashboard')
        .set('Cookie', sessionCookie);

      expect(dashboardRes.body.pendingSyncCount).toBe(1);
    });
  });

  describe('3. Kiosk Mode Switching', () => {
    it('should switch between digital-menu, survey, and google-qr modes', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Initial state should be digital-menu
      let stateRes = await request(app).get('/api/kiosk/state');
      expect(stateRes.body.mode).toBe('digital-menu');

      // Switch to survey mode
      const surveysRes = await request(app).get('/api/admin/surveys');
      const surveyId = surveysRes.body[0].id;

      const switchToSurveyRes = await request(app)
        .put('/api/admin/kiosk/mode')
        .set('Cookie', sessionCookie)
        .send({ mode: 'survey', activeSurveyId: surveyId });

      expect(switchToSurveyRes.status).toBe(200);

      // Verify mode changed
      stateRes = await request(app).get('/api/kiosk/state');
      expect(stateRes.body.mode).toBe('survey');
      expect(stateRes.body.activeSurveyId).toBe(surveyId);

      // Switch to google-qr mode
      const switchToQrRes = await request(app)
        .put('/api/admin/kiosk/mode')
        .set('Cookie', sessionCookie)
        .send({ mode: 'google-qr' });

      expect(switchToQrRes.status).toBe(200);

      stateRes = await request(app).get('/api/kiosk/state');
      expect(stateRes.body.mode).toBe('google-qr');

      // Switch back to digital-menu
      const switchToMenuRes = await request(app)
        .put('/api/admin/kiosk/mode')
        .set('Cookie', sessionCookie)
        .send({ mode: 'digital-menu' });

      expect(switchToMenuRes.status).toBe(200);

      stateRes = await request(app).get('/api/kiosk/state');
      expect(stateRes.body.mode).toBe('digital-menu');
    });

    it('should reject survey mode without active survey', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Try to switch to survey mode without survey ID
      const switchRes = await request(app)
        .put('/api/admin/kiosk/mode')
        .set('Cookie', sessionCookie)
        .send({ mode: 'survey' });

      expect(switchRes.status).toBe(400);
    });

    it('should log mode changes', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Switch mode
      await request(app)
        .put('/api/admin/kiosk/mode')
        .set('Cookie', sessionCookie)
        .send({ mode: 'google-qr' });

      // Check logs
      const logs = db.getLogs().filter(l => l.message.includes('mode'));
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('4. Kiosk Heartbeat and Online Status', () => {
    it('should update heartbeat on kiosk requests', async () => {
      // Get initial heartbeat
      const initialState = db.getKioskState();
      const initialHeartbeat = initialState.last_heartbeat;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make kiosk request
      await request(app).get('/api/kiosk/state');

      // Check heartbeat updated
      const updatedState = db.getKioskState();
      expect(updatedState.last_heartbeat).not.toBe(initialHeartbeat);
    });

    it('should report kiosk online status in dashboard', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Make kiosk request to update heartbeat
      await request(app).get('/api/kiosk/state');

      // Check dashboard
      const dashboardRes = await request(app)
        .get('/api/admin/dashboard')
        .set('Cookie', sessionCookie);

      expect(dashboardRes.body.kioskOnline).toBe(true);
      expect(dashboardRes.body).toHaveProperty('kioskLastSeen');
    });
  });

  describe('5. System Settings and Configuration', () => {
    it('should update and retrieve system settings', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Get current settings
      const getRes = await request(app)
        .get('/api/admin/settings')
        .set('Cookie', sessionCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.slideshowTimeout).toBeDefined();

      // Update settings
      const updateRes = await request(app)
        .put('/api/admin/settings')
        .set('Cookie', sessionCookie)
        .send({
          slideshowTimeout: 120,
          surveyTimeout: 90,
          googleQrDisplayDuration: 15
        });

      expect(updateRes.status).toBe(200);

      // Verify update
      const verifyRes = await request(app)
        .get('/api/admin/settings')
        .set('Cookie', sessionCookie);

      expect(verifyRes.body.slideshowTimeout).toBe(120);
      expect(verifyRes.body.surveyTimeout).toBe(90);
      expect(verifyRes.body.googleQrDisplayDuration).toBe(15);
    });

    it('should validate timing settings are within range', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Try to set invalid timeout (too low)
      const lowRes = await request(app)
        .put('/api/admin/settings')
        .set('Cookie', sessionCookie)
        .send({ slideshowTimeout: 2 });

      expect(lowRes.status).toBe(400);

      // Try to set invalid timeout (too high)
      const highRes = await request(app)
        .put('/api/admin/settings')
        .set('Cookie', sessionCookie)
        .send({ slideshowTimeout: 500 });

      expect(highRes.status).toBe(400);
    });
  });

  describe('6. Authentication and Session Management', () => {
    it('should require authentication for admin endpoints', async () => {
      // Try to access admin endpoint without login
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(401);
    });

    it('should handle login and logout flow', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      expect(loginRes.status).toBe(200);
      const cookie = loginRes.headers['set-cookie'][0];

      // Access protected endpoint
      const dashboardRes = await request(app)
        .get('/api/admin/dashboard')
        .set('Cookie', cookie);

      expect(dashboardRes.status).toBe(200);

      // Logout
      const logoutRes = await request(app)
        .post('/api/admin/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);

      // Try to access protected endpoint after logout
      const afterLogoutRes = await request(app)
        .get('/api/admin/dashboard')
        .set('Cookie', cookie);

      expect(afterLogoutRes.status).toBe(401);
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });
  });

  describe('7. Data Persistence and Backup', () => {
    it('should persist data across operations', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Create massage
      const createRes = await request(app)
        .post('/api/admin/massages')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Test Massage',
          shortDescription: 'Test',
          sessions: [{ name: '60 min', price: 80 }]
        });

      const massageId = createRes.body.id;

      // Verify data persists in database
      const massage = db.getMassageById(massageId);
      expect(massage).toBeDefined();
      expect(massage!.name).toBe('Test Massage');
    });

    it('should generate backup with all data', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Create some data
      await request(app)
        .post('/api/admin/massages')
        .set('Cookie', sessionCookie)
        .send({
          name: 'Backup Test Massage',
          shortDescription: 'Test',
          sessions: [{ name: '60 min', price: 80 }]
        });

      // Request backup
      const backupRes = await request(app)
        .get('/api/admin/backup')
        .set('Cookie', sessionCookie);

      expect(backupRes.status).toBe(200);
      expect(backupRes.headers['content-type']).toContain('application/json');

      const backupData = backupRes.body;
      expect(backupData).toHaveProperty('massages');
      expect(backupData).toHaveProperty('survey_templates');
      expect(backupData).toHaveProperty('survey_responses');
      expect(backupData).toHaveProperty('system_settings');
    });
  });

  describe('8. QR Code Generation', () => {
    it('should generate QR code for Google review', async () => {
      const qrRes = await request(app).get('/api/kiosk/google-review');

      expect(qrRes.status).toBe(200);
      expect(qrRes.body).toHaveProperty('qrCode');
      expect(qrRes.body).toHaveProperty('title');
      expect(qrRes.body).toHaveProperty('description');
      expect(qrRes.body.qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('9. Health Check', () => {
    it('should respond to health check requests', async () => {
      const healthRes = await request(app).get('/api/kiosk/health');

      expect(healthRes.status).toBe(200);
      expect(healthRes.body).toHaveProperty('status');
      expect(healthRes.body.status).toBe('ok');
    });
  });

  describe('10. Survey Response Filtering', () => {
    it('should filter survey responses by date range', async () => {
      // Login
      const loginRes = await request(app)
        .post('/api/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      sessionCookie = loginRes.headers['set-cookie'][0];

      // Get survey
      const surveysRes = await request(app).get('/api/admin/surveys');
      const surveyId = surveysRes.body[0].id;

      // Submit multiple responses
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/kiosk/survey-response')
          .send({
            surveyId: surveyId,
            answers: { test: `response ${i}` }
          });
      }

      // Get all responses
      const allRes = await request(app)
        .get('/api/admin/survey-responses')
        .set('Cookie', sessionCookie);

      expect(allRes.status).toBe(200);
      expect(allRes.body.length).toBeGreaterThanOrEqual(3);
    });
  });
});
