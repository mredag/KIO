import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/DatabaseService.js';
import { QRCodeService } from '../services/QRCodeService.js';
import { kioskEventService } from '../services/KioskEventService.js';
import {
  validateSurveyResponse,
  handleValidationErrors,
} from '../middleware/validationMiddleware.js';
import i18n from '../i18n/config.js';

/**
 * Create kiosk routes
 * Handles all kiosk-facing API endpoints
 * Requirements: 1.2, 1.3, 2.1, 5.3, 6.3, 8.1, 10.3, 13.5
 */
export function createKioskRoutes(
  db: DatabaseService,
  qrService: QRCodeService
): Router {
  const router = Router();

  /**
   * Middleware to update heartbeat on every kiosk request
   * Requirements: 13.5 - Update heartbeat timestamp on every kiosk request
   */
  router.use((req: Request, _res: Response, next) => {
    try {
      console.log(`[Heartbeat] Updating heartbeat for ${req.path}`);
      db.updateKioskHeartbeat();
      console.log('[Heartbeat] Updated successfully');
    } catch (error) {
      console.error('[Heartbeat] Failed to update heartbeat:', error);
      // Don't fail the request if heartbeat update fails
    }
    next();
  });

  /**
   * GET /api/kiosk/events
   * Server-Sent Events endpoint for real-time kiosk updates
   * Provides instant notifications for mode changes, survey updates, etc.
   */
  router.get('/events', (req: Request, res: Response) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Generate unique client ID
    const clientId = randomUUID();

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ 
      type: 'connected', 
      timestamp: new Date().toISOString() 
    })}\n\n`);

    // Register client
    kioskEventService.addClient(clientId, res);

    // Clean up on disconnect
    req.on('close', () => {
      kioskEventService.removeClient(clientId);
    });
  });

  /**
   * GET /api/kiosk/health
   * Simple health check for offline detection
   * Requirements: 19.2 - Backend availability check
   */
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * GET /api/kiosk/state
   * Fetch current kiosk mode and configuration
   * Requirements: 1.2 - Return current mode state within 3 seconds
   * Requirements: 1.3 - Kiosk polls for mode updates
   * Requirements: 10.3 - Response time optimization (<3s for state)
   */
  router.get('/state', async (_req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Get kiosk state
      const kioskState = db.getKioskState();

      // Get system settings for timeout configurations
      const settings = db.getSettings();

      // Prepare response
      const response = {
        mode: kioskState.mode,
        activeSurveyId: kioskState.active_survey_id,
        config: {
          slideshowTimeout: settings.slideshow_timeout,
          surveyTimeout: settings.survey_timeout,
          googleQrDisplayDuration: settings.google_qr_display_duration,
        },
        timestamp: new Date().toISOString(),
      };

      const responseTime = Date.now() - startTime;

      // Log if response time exceeds 3 seconds (requirement violation)
      if (responseTime > 3000) {
        db.createLog({
          level: 'warn',
          message: 'Kiosk state endpoint exceeded 3s response time',
          details: { responseTime },
        });
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching kiosk state:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/kiosk/menu
   * Fetch massage list with featured sorting
   * Requirements: 2.1 - Display massage list
   * Requirements: 2.2 - Show featured massages at top
   * Requirements: 10.3 - Response time optimization (<1s for menu)
   */
  router.get('/menu', async (_req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Get all massages (already sorted by sort_order)
      const allMassages = db.getMassages();

      // Separate featured and non-featured massages
      const featured = allMassages.filter((m) => m.is_featured === 1);
      const regular = allMassages.filter((m) => m.is_featured === 0);

      // Format response with featured massages first
      const response = {
        featured,
        regular,
        timestamp: new Date().toISOString(),
      };

      const responseTime = Date.now() - startTime;

      // Log if response time exceeds 1 second (requirement violation)
      if (responseTime > 1000) {
        db.createLog({
          level: 'warn',
          message: 'Kiosk menu endpoint exceeded 1s response time',
          details: { responseTime, massageCount: allMassages.length },
        });
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching menu:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/kiosk/survey/:id
   * Fetch survey template by ID
   * Requirements: 5.1, 6.1 - Display survey questions
   * Requirements: 10.3 - Response time optimization (<1s)
   */
  router.get('/survey/:id', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const { id } = req.params;

      // Get survey template
      const survey = db.getSurveyById(id);

      if (!survey) {
        res.status(404).json({ error: i18n.t('errors:surveyNotFound') });
        return;
      }

      const responseTime = Date.now() - startTime;

      // Log if response time exceeds 1 second
      if (responseTime > 1000) {
        db.createLog({
          level: 'warn',
          message: 'Kiosk survey endpoint exceeded 1s response time',
          details: { responseTime, surveyId: id },
        });
      }

      res.json(survey);
    } catch (error) {
      console.error('Error fetching survey:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * POST /api/kiosk/survey-response
   * Submit survey response and add to sync queue
   * Requirements: 5.3 - Store survey response with timestamp
   * Requirements: 6.3 - Store discovery survey responses
   * Requirements: 5.7, 6.4 - Add to Google Sheets sync queue
   * Requirements: 10.2 - Store in local database immediately
   * Requirements: 33.1 - Input validation
   */
  router.post('/survey-response', validateSurveyResponse, handleValidationErrors, async (req: Request, res: Response) => {
    try {
      const { surveyId, answers } = req.body;

      // Validate input
      if (!surveyId || !answers) {
        res.status(400).json({ error: i18n.t('validation:surveyDataRequired') });
        return;
      }

      // Verify survey exists
      const survey = db.getSurveyById(surveyId);
      if (!survey) {
        res.status(404).json({ error: i18n.t('errors:surveyNotFound') });
        return;
      }

      // Create survey response (automatically added to sync queue with synced=0)
      // Requirements: 10.2 - Data persistence before response
      const response = db.createSurveyResponse({
        survey_id: surveyId,
        answers,
      });

      // Log survey submission
      db.createLog({
        level: 'info',
        message: 'Survey response submitted',
        details: {
          responseId: response.id,
          surveyId,
          surveyType: survey.type,
        },
      });

      res.status(201).json({
        success: true,
        responseId: response.id,
        timestamp: response.created_at,
      });
    } catch (error) {
      console.error('Error submitting survey response:', error);
      res.status(500).json({ error: i18n.t('errors:submitFailed') });
    }
  });

  /**
   * GET /api/kiosk/google-review
   * Fetch Google review QR code configuration
   * Requirements: 8.1 - Display Google review QR screen
   * Requirements: 8.2 - Generate QR code from configured URL
   * Requirements: 8.5 - Return configured title and description
   */
  router.get('/google-review', async (_req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Get Google review settings
      const settings = db.getSettings();

      // Check if Google review is configured
      if (!settings.google_review_url) {
        res.status(404).json({ error: i18n.t('errors:googleReviewNotConfigured') });
        return;
      }

      // Generate QR code
      const qrCode = await qrService.generateQR(settings.google_review_url);

      const response = {
        url: settings.google_review_url,
        title: settings.google_review_title || 'Leave us a review',
        description: settings.google_review_description || 'Scan to review us on Google',
        qrCode, // Base64 data URL
        displayDuration: settings.google_qr_display_duration,
        timestamp: new Date().toISOString(),
      };

      const responseTime = Date.now() - startTime;

      // Log if response time exceeds 1 second
      if (responseTime > 1000) {
        db.createLog({
          level: 'warn',
          message: 'Kiosk google-review endpoint exceeded 1s response time',
          details: { responseTime },
        });
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching Google review config:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  return router;
}
