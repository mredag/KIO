import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AuthService } from '../services/AuthService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { BackupService } from '../services/BackupService.js';
import { MediaService } from '../services/MediaService.js';
import { GoogleSheetsService } from '../services/GoogleSheetsService.js';
import { kioskEventService } from '../services/KioskEventService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  rateLimitMiddleware,
  resetRateLimit,
} from '../middleware/rateLimitMiddleware.js';
import {
  validateLogin,
  validateMassage,
  validateMassageUpdate,
  validateKioskMode,
  validateSurveyTemplate,
  validateSettings,
  validateIdParam,
  handleValidationErrors,
} from '../middleware/validationMiddleware.js';
import i18n from '../i18n/config.js';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

/**
 * Helper function to generate timeline data from responses
 */
function generateTimeline(responses: any[]): any[] {
  if (responses.length === 0) return [];

  // Group responses by date
  const dateGroups: Record<string, number> = {};
  
  responses.forEach(response => {
    const date = new Date(response.created_at);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    dateGroups[dateKey] = (dateGroups[dateKey] || 0) + 1;
  });

  // Convert to array and sort by date
  return Object.entries(dateGroups)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Create admin routes
 * Handles authentication and admin panel operations
 */
export function createAdminRoutes(
  db: DatabaseService,
  authService: AuthService,
  backupService?: BackupService,
  mediaService?: MediaService,
  googleSheetsService?: GoogleSheetsService
): Router {
  const router = Router();

  /**
   * POST /api/admin/login
   * Authenticate user and create session
   * Requirements: 12.1, 12.2, 12.3, 12.4, 33.1
   */
  router.post('/login', rateLimitMiddleware, validateLogin, handleValidationErrors, async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      // Verify credentials
      const isValid = await authService.verifyCredentials(username, password);

      if (!isValid) {
        // Log failed login attempt
        db.createLog({
          level: 'warn',
          message: 'Failed login attempt',
          details: { username, ip: req.ip },
        });

        res.status(401).json({ error: i18n.t('errors:invalidCredentials') });
        return;
      }

      // Create session
      req.session.user = { username };

      // Reset rate limit on successful login
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      resetRateLimit(ip);

      // Log successful login
      db.createLog({
        level: 'info',
        message: 'User logged in',
        details: { username },
      });

      res.json({
        success: true,
        user: { username },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * POST /api/admin/logout
   * Invalidate session and log out user
   * Requirements: 12.6
   */
  router.post('/logout', authMiddleware, (req: Request, res: Response) => {
    const username = req.session.user?.username;

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: i18n.t('errors:internalError') });
        return;
      }

      // Log logout
      if (username) {
        db.createLog({
          level: 'info',
          message: 'User logged out',
          details: { username },
        });
      }

      res.json({ success: true });
    });
  });

  /**
   * GET /api/admin/session
   * Check if user has valid session
   */
  router.get('/session', (req: Request, res: Response) => {
    if (req.session && req.session.user) {
      res.json({
        authenticated: true,
        user: req.session.user,
      });
    } else {
      res.json({
        authenticated: false,
      });
    }
  });

  /**
   * GET /api/admin/backup
   * Trigger manual backup and download backup file
   * Requirements: 14.2, 14.5
   */
  router.get('/backup', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!backupService) {
        res.status(503).json({ error: i18n.t('errors:serviceUnavailable') });
        return;
      }

      // Create backup
      const filepath = await backupService.createBackup();

      // Log backup request
      db.createLog({
        level: 'info',
        message: 'Manual backup triggered',
        details: { user: req.session.user?.username, filepath },
      });

      // Send file for download
      res.download(filepath, (err) => {
        if (err) {
          console.error('Error sending backup file:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: i18n.t('errors:backupDownloadFailed') });
          }
        }
      });
    } catch (error) {
      console.error('Backup error:', error);
      res.status(500).json({ error: i18n.t('errors:backupFailed') });
    }
  });

  /**
   * GET /api/admin/backup/info
   * Get information about the last backup
   * Requirements: 14.4
   */
  router.get('/backup/info', authMiddleware, (_req: Request, res: Response) => {
    try {
      if (!backupService) {
        res.status(503).json({ error: i18n.t('errors:serviceUnavailable') });
        return;
      }

      const lastBackupInfo = backupService.getLastBackupInfo();
      const backupFiles = backupService.getBackupFiles();

      // Get detailed info about last backup including contents summary
      let lastBackup = null;
      if (lastBackupInfo && backupFiles.length > 0) {
        const lastFile = backupFiles[0];
        
        // Try to read the backup file to get summary
        let summary = null;
        try {
          const fs = require('fs');
          const backupContent = JSON.parse(fs.readFileSync(lastFile.filepath, 'utf-8'));
          summary = {
            massages: backupContent.data?.massages?.length || 0,
            surveyTemplates: backupContent.data?.survey_templates?.length || 0,
            surveyResponses: backupContent.data?.survey_responses?.length || 0,
            settings: !!backupContent.data?.system_settings,
          };
        } catch (err) {
          console.error('Error reading backup file for summary:', err);
        }

        lastBackup = {
          filename: lastFile.filename,
          timestamp: lastFile.created.toISOString(),
          size: lastFile.size,
          summary,
        };
      }

      res.json({
        lastBackup,
        totalBackups: backupFiles.length,
        backupFiles: backupFiles.slice(0, 10).map(f => ({
          filename: f.filename,
          timestamp: f.created.toISOString(),
          size: f.size,
        })), // Return last 10 backups
      });
    } catch (error) {
      console.error('Error getting backup info:', error);
      res.status(500).json({ error: i18n.t('errors:backupInfoFailed') });
    }
  });

  /**
   * GET /api/admin/alerts
   * Get low satisfaction alerts from recent survey responses
   */
  router.get('/alerts', authMiddleware, (_req: Request, res: Response) => {
    try {
      const alerts: any[] = [];
      
      // Get all responses
      const recentResponses = db.getSurveyResponses();

      // Check each response for alerts
      recentResponses.forEach(response => {
        const survey = db.getSurveyById(response.survey_id);
        if (!survey) return;

        Object.entries(response.answers).forEach(([questionId, answer]) => {
          const question = survey.questions.find((q: any) => q.id === questionId);
          if (!question) return;

          let shouldAlert = false;
          let severity: 'critical' | 'warning' | 'info' = 'info';
          let alertType = 'tracked';

          // Check if question is marked as important to track
          if (question.trackImportant) {
            shouldAlert = true;
            severity = 'info';
            alertType = 'tracked';
          }

          // Check for low ratings (overrides trackImportant)
          if (question.type === 'rating') {
            const rating = parseFloat(answer as string);
            if (rating <= 2) {
              shouldAlert = true;
              severity = rating === 1 ? 'critical' : 'warning';
              alertType = 'low_rating';
            }
          }

          if (shouldAlert) {
            alerts.push({
              id: `${response.id}-${questionId}`,
              type: alertType,
              severity,
              surveyId: survey.id,
              surveyName: survey.name,
              surveyTitle: survey.title,
              questionText: question.text,
              answer: question.type === 'rating' ? parseFloat(answer as string) : answer,
              timestamp: response.created_at,
            });
          }
        });
      });

      // Sort by severity and timestamp
      alerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      res.json(alerts.slice(0, 10)); // Return top 10 alerts
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/admin/dashboard
   * Return system status and metrics
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 2.1, 3.1, 3.2, 5.1
   */
  router.get('/dashboard', authMiddleware, (_req: Request, res: Response) => {
    try {
      const kioskState = db.getKioskState();

      // Get survey counts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const todayResponses = db.getSurveyResponses({ startDate: todayStr });
      const allResponses = db.getSurveyResponses();
      const unsyncedResponses = db.getSurveyResponses({ synced: false });

      // Get current content name based on mode
      let currentContent = '';
      if (kioskState.mode === 'digital-menu') {
        currentContent = 'Digital Menu';
      } else if (kioskState.mode === 'survey' && kioskState.active_survey_id) {
        const survey = db.getSurveyById(kioskState.active_survey_id);
        currentContent = survey ? survey.name : 'Unknown Survey';
      } else if (kioskState.mode === 'google-qr') {
        currentContent = 'Google Review QR';
      }

      // Check if kiosk is online (heartbeat within last 30 seconds)
      const lastHeartbeat = new Date(kioskState.last_heartbeat);
      const now = new Date();
      const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
      const kioskOnline = timeSinceHeartbeat < 30000; // 30 seconds

      // Get last sync timestamp (most recent synced response)
      const syncedResponses = db.getSurveyResponses({ synced: true });
      const sheetsLastSync = syncedResponses.length > 0 
        ? syncedResponses[0].last_sync_attempt 
        : null;

      // Generate survey trend data (last 7 days)
      const surveyTrend: Array<{ date: string; value: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dateStr = date.toISOString();
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString();
        
        const dayResponses = db.getSurveyResponses({ 
          startDate: dateStr,
          endDate: nextDateStr 
        });
        
        surveyTrend.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: dayResponses.length,
        });
      }

      // Generate coupon trend data (this week) - mock data for now
      // TODO: Replace with actual coupon data when coupon system is integrated
      const couponTrend: Array<{ date: string; value: number }> = [];
      const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        couponTrend.push({
          date: daysOfWeek[date.getDay()],
          value: Math.floor(Math.random() * 10), // Mock data
        });
      }

      // Get recent activity (last 10 events)
      const recentActivity: Array<{
        id: string;
        type: string;
        message: string;
        timestamp: string;
        href?: string;
      }> = [];

      // Add recent survey responses
      const recentResponses = allResponses.slice(0, 5);
      recentResponses.forEach((response: any) => {
        const survey = db.getSurveyById(response.survey_id);
        recentActivity.push({
          id: `survey-${response.id}`,
          type: 'survey',
          message: `New survey response: ${survey?.name || 'Unknown Survey'}`,
          timestamp: response.created_at,
          href: `/admin/survey-responses`,
        });
      });

      // Add kiosk mode changes from logs
      const logs = db.getLogs({ limit: 20 });
      logs.forEach((log: any) => {
        if (log.message.includes('Kiosk mode changed')) {
          recentActivity.push({
            id: `kiosk-${log.id}`,
            type: 'kiosk',
            message: log.message,
            timestamp: log.timestamp,
            href: '/admin/kiosk-control',
          });
        }
      });

      // Sort by timestamp and limit to 10
      recentActivity.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const limitedActivity = recentActivity.slice(0, 10);

      // Get active coupons count (mock for now)
      const activeCoupons = 0; // TODO: Replace with actual coupon count

      res.json({
        todaySurveyCount: todayResponses.length,
        totalSurveyCount: allResponses.length,
        activeCoupons,
        currentKioskMode: kioskState.mode,
        activeSurveyId: kioskState.active_survey_id,
        currentContent,
        kioskLastSeen: kioskState.last_heartbeat,
        kioskOnline,
        sheetsLastSync,
        pendingSyncCount: unsyncedResponses.length,
        surveyTrend,
        couponTrend,
        recentActivity: limitedActivity,
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: i18n.t('errors:dashboardFailed') });
    }
  });

  /**
   * POST /api/admin/upload
   * Upload media file (video or image)
   * Requirements: 4.3
   */
  router.post('/upload', authMiddleware, upload.single('media'), async (req: Request, res: Response) => {
    try {
      if (!mediaService) {
        res.status(503).json({ error: i18n.t('errors:serviceUnavailable') });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: i18n.t('errors:noFileUploaded') });
        return;
      }

      // Upload the file
      const url = await mediaService.uploadMedia(req.file);

      // Log media upload
      db.createLog({
        level: 'info',
        message: 'Media file uploaded',
        details: { 
          filename: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype,
          url,
          user: req.session.user?.username 
        },
      });

      res.json({ url });
    } catch (error: any) {
      console.error('Error uploading media:', error);
      res.status(400).json({ error: error.message || i18n.t('errors:uploadFailed') });
    }
  });

  /**
   * GET /api/admin/massages
   * List all massages
   * Requirements: 4.1
   */
  router.get('/massages', authMiddleware, (_req: Request, res: Response) => {
    try {
      const massages = db.getMassages();
      res.json(massages);
    } catch (error) {
      console.error('Error fetching massages:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * POST /api/admin/massages
   * Create a new massage
   * Requirements: 4.1, 4.2, 33.1
   */
  router.post('/massages', authMiddleware, validateMassage, handleValidationErrors, async (req: Request, res: Response) => {
    try {
      // Transform camelCase to snake_case for database
      // Accept both camelCase (from frontend) and snake_case (from tests/legacy)
      const massageData = {
        name: req.body.name,
        short_description: req.body.shortDescription || req.body.short_description,
        long_description: req.body.longDescription || req.body.long_description,
        duration: req.body.duration,
        media_type: req.body.mediaType || req.body.media_type,
        media_url: req.body.mediaUrl || req.body.media_url,
        purpose_tags: req.body.purposeTags || req.body.purpose_tags,
        sessions: req.body.sessions,
        is_featured: req.body.isFeatured !== undefined ? req.body.isFeatured : req.body.is_featured,
        is_campaign: req.body.isCampaign !== undefined ? req.body.isCampaign : req.body.is_campaign,
        layout_template: req.body.layoutTemplate || req.body.layout_template,
        sort_order: req.body.sortOrder !== undefined ? req.body.sortOrder : req.body.sort_order,
      };

      const massage = db.createMassage(massageData);

      // Broadcast menu update to kiosks
      kioskEventService.broadcastMenuUpdate();

      // Log massage creation
      db.createLog({
        level: 'info',
        message: 'Massage created',
        details: { massageId: massage.id, user: req.session.user?.username },
      });

      res.status(201).json(massage);
    } catch (error) {
      console.error('Error creating massage:', error);
      res.status(500).json({ error: i18n.t('errors:createFailed') });
    }
  });

  /**
   * PUT /api/admin/massages/:id
   * Update an existing massage
   * Requirements: 4.2, 33.1
   */
  router.put('/massages/:id', authMiddleware, validateIdParam, validateMassageUpdate, handleValidationErrors, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if massage exists
      const existing = db.getMassageById(id);
      if (!existing) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      // Validate fields if provided
      if (req.body.name !== undefined) {
        if (req.body.name.length < 1 || req.body.name.length > 100) {
          res.status(400).json({ error: i18n.t('validation:outOfRange', { field: 'İsim', min: 1, max: 100 }) });
          return;
        }
      }

      if (req.body.short_description !== undefined) {
        if (req.body.short_description.length < 1 || req.body.short_description.length > 200) {
          res.status(400).json({ error: i18n.t('validation:outOfRange', { field: 'Kısa açıklama', min: 1, max: 200 }) });
          return;
        }
      }

      if (req.body.long_description !== undefined && req.body.long_description.length > 2000) {
        res.status(400).json({ error: i18n.t('validation:tooLong', { field: 'Uzun açıklama', max: 2000 }) });
        return;
      }

      if (req.body.sessions !== undefined) {
        if (!Array.isArray(req.body.sessions) || req.body.sessions.length === 0) {
          res.status(400).json({ error: i18n.t('validation:mustBeArray', { field: 'Seanslar' }) });
          return;
        }

        for (const session of req.body.sessions) {
          if (!session.name || typeof session.price !== 'number' || session.price <= 0) {
            res.status(400).json({ error: i18n.t('validation:sessionInvalid') });
            return;
          }
        }
      }

      if (req.body.layout_template !== undefined) {
        const allowedLayouts = ['price-list', 'info-tags', 'media-focus', 'immersive-showcase'];
        if (!allowedLayouts.includes(req.body.layout_template)) {
          res.status(400).json({ error: i18n.t('validation:outOfRange', { field: 'Düzen', min: 1, max: allowedLayouts.length }) });
          return;
        }
      }

      const massage = db.updateMassage(id, req.body);

      // Broadcast menu update to kiosks
      kioskEventService.broadcastMenuUpdate();

      // Log massage update
      db.createLog({
        level: 'info',
        message: 'Massage updated',
        details: { massageId: id, user: req.session.user?.username },
      });

      res.json(massage);
    } catch (error) {
      console.error('Error updating massage:', error);
      res.status(500).json({ error: i18n.t('errors:updateFailed') });
    }
  });

  /**
   * DELETE /api/admin/massages/:id
   * Delete a massage and its associated media
   * Requirements: 4.2
   */
  router.delete('/massages/:id', authMiddleware, validateIdParam, handleValidationErrors, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if massage exists
      const massage = db.getMassageById(id);
      if (!massage) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      // Delete associated media file if exists
      if (massage.media_url && mediaService) {
        try {
          await mediaService.deleteMedia(massage.media_url);
        } catch (error) {
          console.error('Error deleting media file:', error);
          // Continue with massage deletion even if media deletion fails
        }
      }

      // Delete massage from database
      db.deleteMassage(id);

      // Broadcast menu update to kiosks
      kioskEventService.broadcastMenuUpdate();

      // Log massage deletion
      db.createLog({
        level: 'info',
        message: 'Massage deleted',
        details: { massageId: id, user: req.session.user?.username },
      });

      res.json({ success: true, message: i18n.t('success:deleted') });
    } catch (error) {
      console.error('Error deleting massage:', error);
      res.status(500).json({ error: i18n.t('errors:deleteFailed') });
    }
  });

  /**
   * PUT /api/admin/kiosk/mode
   * Update kiosk mode with validation
   * Requirements: 1.1, 1.4, 33.1
   */
  router.put('/kiosk/mode', authMiddleware, validateKioskMode, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { mode, active_survey_id, coupon_qr_url, coupon_token } = req.body;

      // Validate mode
      if (!mode || !['digital-menu', 'survey', 'google-qr', 'coupon-qr'].includes(mode)) {
        res.status(400).json({ error: i18n.t('validation:invalidMode') });
        return;
      }

      // Validate survey mode requires active_survey_id
      if (mode === 'survey' && !active_survey_id) {
        res.status(400).json({ error: i18n.t('validation:surveyRequired') });
        return;
      }

      // Validate coupon-qr mode requires coupon_qr_url
      if (mode === 'coupon-qr' && !coupon_qr_url) {
        res.status(400).json({ error: 'Coupon QR URL is required for coupon-qr mode' });
        return;
      }

      // Validate survey exists if provided
      if (active_survey_id) {
        const survey = db.getSurveyById(active_survey_id);
        if (!survey) {
          res.status(400).json({ error: i18n.t('errors:surveyNotFound') });
          return;
        }
      }

      // Update kiosk state
      const kioskState = db.updateKioskState({
        mode,
        active_survey_id: mode === 'survey' ? active_survey_id : null,
        coupon_qr_url: mode === 'coupon-qr' ? coupon_qr_url : null,
        coupon_token: mode === 'coupon-qr' ? coupon_token : null,
      });

      // Broadcast mode change via SSE to all connected kiosks
      kioskEventService.broadcastModeChange(
        mode, 
        mode === 'survey' ? active_survey_id : null,
        mode === 'coupon-qr' ? { couponQrUrl: coupon_qr_url, couponToken: coupon_token } : undefined
      );

      // Log mode change
      db.createLog({
        level: 'info',
        message: 'Kiosk mode changed',
        details: { 
          mode, 
          active_survey_id: mode === 'survey' ? active_survey_id : null,
          coupon_token: mode === 'coupon-qr' ? coupon_token : null,
          user: req.session.user?.username 
        },
      });

      res.json(kioskState);
    } catch (error) {
      console.error('Error updating kiosk mode:', error);
      res.status(500).json({ error: i18n.t('errors:updateFailed') });
    }
  });

  /**
   * GET /api/admin/surveys
   * List all survey templates
   * Requirements: 9.1
   */
  router.get('/surveys', authMiddleware, (_req: Request, res: Response) => {
    try {
      const surveys = db.getSurveyTemplates();
      res.json(surveys);
    } catch (error) {
      console.error('Error fetching surveys:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * POST /api/admin/surveys
   * Create a new survey template
   * Requirements: 9.1, 33.1
   */
  router.post('/surveys', authMiddleware, validateSurveyTemplate, handleValidationErrors, (req: Request, res: Response) => {
    try {
      // Validate required fields
      if (!req.body.name || req.body.name.length < 1 || req.body.name.length > 100) {
        res.status(400).json({ error: i18n.t('validation:outOfRange', { field: 'İsim', min: 1, max: 100 }) });
        return;
      }

      if (!req.body.type || !['satisfaction', 'discovery'].includes(req.body.type)) {
        res.status(400).json({ error: i18n.t('validation:invalidType') });
        return;
      }

      if (!req.body.title || req.body.title.length < 1) {
        res.status(400).json({ error: i18n.t('validation:required', { field: 'Başlık' }) });
        return;
      }

      if (!req.body.questions || !Array.isArray(req.body.questions) || req.body.questions.length === 0) {
        res.status(400).json({ error: i18n.t('validation:questionRequired') });
        return;
      }

      // Validate questions
      for (const question of req.body.questions) {
        if (!question.text || !question.type) {
          res.status(400).json({ error: i18n.t('validation:questionTextTypeRequired') });
          return;
        }

        if (!['rating', 'single-choice'].includes(question.type)) {
          res.status(400).json({ error: i18n.t('validation:invalidQuestionType') });
          return;
        }

        if (question.type === 'single-choice' && (!question.options || question.options.length === 0)) {
          res.status(400).json({ error: i18n.t('validation:optionsRequired') });
          return;
        }
      }

      const survey = db.createSurvey(req.body);

      // Broadcast survey update to kiosks
      kioskEventService.broadcastSurveyUpdate(survey.id);

      // Log survey creation
      db.createLog({
        level: 'info',
        message: 'Survey template created',
        details: { surveyId: survey.id, user: req.session.user?.username },
      });

      res.status(201).json(survey);
    } catch (error) {
      console.error('Error creating survey:', error);
      res.status(500).json({ error: i18n.t('errors:createFailed') });
    }
  });

  /**
   * PUT /api/admin/surveys/:id
   * Update a survey template
   * Requirements: 9.2, 9.3, 33.1
   */
  router.put('/surveys/:id', authMiddleware, validateIdParam, validateSurveyTemplate, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if survey exists
      const existing = db.getSurveyById(id);
      if (!existing) {
        res.status(404).json({ error: i18n.t('errors:surveyNotFound') });
        return;
      }

      // Validate name if provided
      if (req.body.name !== undefined) {
        if (req.body.name.length < 1 || req.body.name.length > 100) {
          res.status(400).json({ error: i18n.t('validation:outOfRange', { field: 'İsim', min: 1, max: 100 }) });
          return;
        }
      }

      // Validate questions if provided
      if (req.body.questions !== undefined) {
        if (!Array.isArray(req.body.questions) || req.body.questions.length === 0) {
          res.status(400).json({ error: i18n.t('validation:mustBeArray', { field: 'Sorular' }) });
          return;
        }

        for (const question of req.body.questions) {
          if (!question.text || !question.type) {
            res.status(400).json({ error: i18n.t('validation:questionTextTypeRequired') });
            return;
          }

          if (!['rating', 'single-choice'].includes(question.type)) {
            res.status(400).json({ error: i18n.t('validation:invalidQuestionType') });
            return;
          }

          if (question.type === 'single-choice' && (!question.options || question.options.length === 0)) {
            res.status(400).json({ error: i18n.t('validation:optionsRequired') });
            return;
          }
        }
      }

      const survey = db.updateSurvey(id, req.body);

      // Broadcast survey update to kiosks
      kioskEventService.broadcastSurveyUpdate(id);

      // Log survey update
      db.createLog({
        level: 'info',
        message: 'Survey template updated',
        details: { surveyId: id, user: req.session.user?.username },
      });

      res.json(survey);
    } catch (error) {
      console.error('Error updating survey:', error);
      res.status(500).json({ error: i18n.t('errors:updateFailed') });
    }
  });

  /**
   * DELETE /api/admin/surveys/:id
   * Delete a survey template
   * Requirements: 9.1, 33.1
   */
  router.delete('/surveys/:id', authMiddleware, validateIdParam, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if survey exists
      const existing = db.getSurveyById(id);
      if (!existing) {
        res.status(404).json({ error: i18n.t('errors:surveyNotFound') });
        return;
      }

      // Check if survey is currently active in kiosk
      const kioskState = db.getKioskState();
      if (kioskState.mode === 'survey' && kioskState.active_survey_id === id) {
        res.status(400).json({ error: i18n.t('errors:surveyInUse') });
        return;
      }

      db.deleteSurvey(id);

      // Log survey deletion
      db.createLog({
        level: 'info',
        message: 'Survey template deleted',
        details: { surveyId: id, surveyName: existing.name, user: req.session.user?.username },
      });

      res.json({ success: true, message: i18n.t('success:deleted') });
    } catch (error) {
      console.error('Error deleting survey:', error);
      res.status(500).json({ error: i18n.t('errors:deleteFailed') });
    }
  });

  /**
   * GET /api/admin/survey-responses
   * List survey responses with optional filters
   * Requirements: 11.6
   */
  router.get('/survey-responses', authMiddleware, (req: Request, res: Response) => {
    try {
      const { surveyId, synced, startDate, endDate } = req.query;

      const filters: any = {};

      if (surveyId) {
        filters.surveyId = surveyId as string;
      }

      if (synced !== undefined) {
        filters.synced = synced === 'true';
      }

      if (startDate) {
        filters.startDate = startDate as string;
      }

      if (endDate) {
        filters.endDate = endDate as string;
      }

      const responses = db.getSurveyResponses(filters);
      res.json(responses);
    } catch (error) {
      console.error('Error fetching survey responses:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * DELETE /api/admin/survey-responses/:surveyId
   * Delete all responses for a specific survey
   */
  router.delete('/survey-responses/:surveyId', authMiddleware, (req: Request, res: Response) => {
    try {
      const { surveyId } = req.params;

      // Check if survey exists
      const survey = db.getSurveyById(surveyId);
      if (!survey) {
        res.status(404).json({ error: i18n.t('errors:surveyNotFound') });
        return;
      }

      // Delete responses
      const deletedCount = db.deleteSurveyResponses(surveyId);

      // Log deletion
      db.createLog({
        level: 'info',
        message: 'Survey responses deleted',
        details: { 
          surveyId, 
          surveyName: survey.name,
          deletedCount,
          user: req.session.user?.username 
        },
      });

      res.json({ 
        success: true, 
        message: i18n.t('success:deleted'),
        deletedCount 
      });
    } catch (error) {
      console.error('Error deleting survey responses:', error);
      res.status(500).json({ error: i18n.t('errors:deleteFailed') });
    }
  });

  /**
   * DELETE /api/admin/survey-responses
   * Delete all survey responses (all surveys)
   */
  router.delete('/survey-responses', authMiddleware, (req: Request, res: Response) => {
    try {
      // Delete all responses
      const deletedCount = db.deleteAllSurveyResponses();

      // Log deletion
      db.createLog({
        level: 'warn',
        message: 'All survey responses deleted',
        details: { 
          deletedCount,
          user: req.session.user?.username 
        },
      });

      res.json({ 
        success: true, 
        message: i18n.t('success:deleted'),
        deletedCount 
      });
    } catch (error) {
      console.error('Error deleting all survey responses:', error);
      res.status(500).json({ error: i18n.t('errors:deleteFailed') });
    }
  });

  /**
   * GET /api/admin/survey-analytics/:id
   * Get analytics data for a specific survey
   * Provides aggregated statistics and answer distributions
   */
  router.get('/survey-analytics/:id', authMiddleware, validateIdParam, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      // Check if survey exists
      const survey = db.getSurveyById(id);
      if (!survey) {
        res.status(404).json({ error: i18n.t('errors:surveyNotFound') });
        return;
      }

      // Get responses for this survey
      const filters: any = { surveyId: id };
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;

      const responses = db.getSurveyResponses(filters);

      // Calculate analytics
      const analytics = {
        survey: {
          id: survey.id,
          name: survey.name,
          type: survey.type,
          title: survey.title,
        },
        totalResponses: responses.length,
        dateRange: {
          start: startDate || null,
          end: endDate || null,
        },
        questions: survey.questions.map(question => {
          // Collect all answers for this question
          const answers = responses
            .map(r => r.answers[question.id])
            .filter(a => a !== undefined && a !== null);

          const totalAnswers = answers.length;
          const responseRate = responses.length > 0 
            ? ((totalAnswers / responses.length) * 100).toFixed(1)
            : '0.0';

          if (question.type === 'rating') {
            // Calculate rating statistics
            const numericAnswers = answers.map(a => parseFloat(a)).filter(a => !isNaN(a));
            const sum = numericAnswers.reduce((acc, val) => acc + val, 0);
            const average = numericAnswers.length > 0 ? (sum / numericAnswers.length).toFixed(2) : '0.00';
            
            // Count distribution
            const distribution: Record<string, number> = {};
            numericAnswers.forEach(answer => {
              const key = answer.toString();
              distribution[key] = (distribution[key] || 0) + 1;
            });

            return {
              id: question.id,
              text: question.text,
              type: question.type,
              totalAnswers,
              responseRate,
              statistics: {
                average: parseFloat(average),
                min: numericAnswers.length > 0 ? Math.min(...numericAnswers) : 0,
                max: numericAnswers.length > 0 ? Math.max(...numericAnswers) : 0,
                distribution: Object.entries(distribution)
                  .map(([value, count]) => ({
                    value: parseFloat(value),
                    count,
                    percentage: ((count / numericAnswers.length) * 100).toFixed(1),
                  }))
                  .sort((a, b) => a.value - b.value),
              },
            };
          } else if (question.type === 'single-choice') {
            // Calculate choice distribution
            const distribution: Record<string, number> = {};
            answers.forEach(answer => {
              const key = answer.toString();
              distribution[key] = (distribution[key] || 0) + 1;
            });

            // Find most selected option
            const sortedOptions = Object.entries(distribution)
              .sort((a, b) => b[1] - a[1]);
            const mostSelected = sortedOptions.length > 0 ? sortedOptions[0][0] : null;

            return {
              id: question.id,
              text: question.text,
              type: question.type,
              options: question.options,
              totalAnswers,
              responseRate,
              statistics: {
                mostSelected,
                distribution: Object.entries(distribution)
                  .map(([value, count]) => ({
                    value,
                    count,
                    percentage: ((count / totalAnswers) * 100).toFixed(1),
                  }))
                  .sort((a, b) => b.count - a.count),
              },
            };
          }

          return {
            id: question.id,
            text: question.text,
            type: question.type,
            totalAnswers,
            responseRate,
          };
        }),
        timeline: generateTimeline(responses),
      };

      res.json(analytics);
    } catch (error) {
      console.error('Error fetching survey analytics:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/admin/settings
   * Fetch system settings
   * Requirements: 18.1
   */
  router.get('/settings', authMiddleware, (_req: Request, res: Response) => {
    try {
      const settings = db.getSettings();
      
      // Don't send password hash to client
      const { admin_password_hash, ...safeSettings } = settings;

      res.json(safeSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * PUT /api/admin/settings
   * Update system settings with validation
   * Requirements: 18.2, 18.3, 11.7, 12.5, 33.1
   */
  router.put('/settings', authMiddleware, validateSettings, handleValidationErrors, async (req: Request, res: Response) => {
    try {
      const updates: any = {};

      // Validate timing settings (5-300 seconds)
      if (req.body.slideshow_timeout !== undefined) {
        const timeout = parseInt(req.body.slideshow_timeout);
        if (isNaN(timeout) || timeout < 5 || timeout > 300) {
          res.status(400).json({ error: i18n.t('validation:invalidTimeout') });
          return;
        }
        updates.slideshow_timeout = timeout;
      }

      if (req.body.survey_timeout !== undefined) {
        const timeout = parseInt(req.body.survey_timeout);
        if (isNaN(timeout) || timeout < 5 || timeout > 300) {
          res.status(400).json({ error: i18n.t('validation:invalidTimeout') });
          return;
        }
        updates.survey_timeout = timeout;
      }

      if (req.body.google_qr_display_duration !== undefined) {
        const duration = parseInt(req.body.google_qr_display_duration);
        if (isNaN(duration) || duration < 5 || duration > 300) {
          res.status(400).json({ error: i18n.t('validation:invalidTimeout') });
          return;
        }
        updates.google_qr_display_duration = duration;
      }

      // Google Review settings
      if (req.body.google_review_url !== undefined) {
        updates.google_review_url = req.body.google_review_url;
      }

      if (req.body.google_review_title !== undefined) {
        updates.google_review_title = req.body.google_review_title;
      }

      if (req.body.google_review_description !== undefined) {
        updates.google_review_description = req.body.google_review_description;
      }

      if (req.body.kioskTheme !== undefined) {
        updates.kiosk_theme = req.body.kioskTheme;
      } else if (req.body.kiosk_theme !== undefined) {
        updates.kiosk_theme = req.body.kiosk_theme;
      }

      // Google Sheets settings
      if (req.body.sheets_sheet_id !== undefined) {
        updates.sheets_sheet_id = req.body.sheets_sheet_id;
      }

      if (req.body.sheets_sheet_name !== undefined) {
        updates.sheets_sheet_name = req.body.sheets_sheet_name;
      }

      if (req.body.sheets_credentials !== undefined) {
        // Validate JSON format
        try {
          JSON.parse(req.body.sheets_credentials);
          updates.sheets_credentials = req.body.sheets_credentials;

          // Reinitialize Google Sheets service with new credentials
          if (googleSheetsService) {
            try {
              await googleSheetsService.initialize(req.body.sheets_credentials);
            } catch (error) {
              res.status(400).json({ error: i18n.t('errors:invalidCredentials') });
              return;
            }
          }
        } catch (error) {
          res.status(400).json({ error: i18n.t('errors:invalidJson') });
          return;
        }
      }

      // Password change
      if (req.body.new_password) {
        if (req.body.new_password.length < 8) {
          res.status(400).json({ error: i18n.t('validation:passwordTooShort') });
          return;
        }

        const hashedPassword = await authService.hashPassword(req.body.new_password);
        updates.admin_password_hash = hashedPassword;

        // Log password change
        db.createLog({
          level: 'info',
          message: 'Admin password changed',
          details: { user: req.session.user?.username },
        });
      }

      // Update settings
      const settings = db.updateSettings(updates);

      // Broadcast settings update to kiosks
      kioskEventService.broadcastSettingsUpdate();

      // Log settings update
      db.createLog({
        level: 'info',
        message: 'System settings updated',
        details: { 
          updatedFields: Object.keys(updates).filter(k => k !== 'admin_password_hash'),
          user: req.session.user?.username 
        },
      });

      // Don't send password hash to client
      const { admin_password_hash, ...safeSettings } = settings;

      res.json(safeSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: i18n.t('errors:updateFailed') });
    }
  });

  /**
   * GET /api/admin/logs
   * Get system logs with optional filters
   * Requirements: 1.5
   */
  router.get('/logs', authMiddleware, (req: Request, res: Response) => {
    try {
      const { level, startDate, endDate, limit, search } = req.query;

      const filters: any = {};

      if (level && ['info', 'warn', 'error'].includes(level as string)) {
        filters.level = level as 'info' | 'warn' | 'error';
      }

      if (startDate) {
        filters.startDate = startDate as string;
      }

      if (endDate) {
        filters.endDate = endDate as string;
      }

      if (limit) {
        filters.limit = parseInt(limit as string, 10);
      } else {
        filters.limit = 100; // Default limit
      }

      let logs = db.getLogs(filters);

      // Apply search filter if provided
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        logs = logs.filter(log => 
          log.message.toLowerCase().includes(searchLower) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
        );
      }

      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * POST /api/admin/test-sheets
   * Test Google Sheets connection
   * Requirements: 11.7, 11.8
   */
  router.post('/test-sheets', authMiddleware, async (req: Request, res: Response) => {
    try {
      if (!googleSheetsService) {
        res.status(503).json({ error: i18n.t('errors:serviceUnavailable') });
        return;
      }

      const { sheetId, sheetName, credentials } = req.body;

      if (!sheetId || !sheetName) {
        res.status(400).json({ error: i18n.t('validation:sheetInfoRequired') });
        return;
      }

      // If credentials provided, initialize with them temporarily
      if (credentials) {
        try {
          await googleSheetsService.initialize(credentials);
        } catch (error) {
          res.status(400).json({ 
            success: false, 
            error: i18n.t('errors:invalidCredentials')
          });
          return;
        }
      }

      // Test connection
      const startTime = Date.now();
      const success = await googleSheetsService.testConnection(sheetId, sheetName);
      const duration = Date.now() - startTime;

      if (success) {
        // Log successful test
        db.createLog({
          level: 'info',
          message: 'Google Sheets connection test successful',
          details: { sheetId, sheetName, duration, user: req.session.user?.username },
        });

        res.json({ 
          success: true, 
          message: i18n.t('success:connectionSuccessful'),
          duration 
        });
      } else {
        res.json({ 
          success: false, 
          error: i18n.t('errors:connectionFailed')
        });
      }
    } catch (error) {
      console.error('Error testing Google Sheets connection:', error);
      res.status(500).json({ 
        success: false, 
        error: i18n.t('errors:testFailed')
      });
    }
  });

  return router;
}
