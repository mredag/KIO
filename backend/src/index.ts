import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';
import { UPLOADS_DIR, BACKUPS_DIR, DATABASE_PATH, FRONTEND_DIST } from './config/paths.js';
import { initializeDatabase } from './database/init.js';
import { DatabaseService } from './database/DatabaseService.js';
import { AuthService } from './services/AuthService.js';
import { MediaService } from './services/MediaService.js';
import { GoogleSheetsService } from './services/GoogleSheetsService.js';
import { SyncQueueService } from './services/SyncQueueService.js';
import { BackupService } from './services/BackupService.js';
import { QRCodeService } from './services/QRCodeService.js';
import { kioskEventService } from './services/KioskEventService.js';
import { LoggerService } from './services/LoggerService.js';
import { LogRotationService } from './services/LogRotationService.js';
import { CouponService } from './services/CouponService.js';
import { EventLogService } from './services/EventLogService.js';
import { RateLimitService } from './services/RateLimitService.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createKioskRoutes } from './routes/kioskRoutes.js';
import { createAdminCouponRoutes } from './routes/adminCouponRoutes.js';
import { createAdminPolicyRoutes } from './routes/adminPolicyRoutes.js';
import { createIntegrationCouponRoutes } from './routes/integrationCouponRoutes.js';
import { createWhatsappWebhookRoutes } from './routes/whatsappWebhookRoutes.js';
import { createInstagramWebhookRoutes } from './routes/instagramWebhookRoutes.js';
import { createInstagramIntegrationRoutes } from './routes/instagramIntegrationRoutes.js';
import { createAdminKnowledgeBaseRoutes } from './routes/adminKnowledgeBaseRoutes.js';
import { createAdminServiceControlRoutes } from './routes/adminServiceControlRoutes.js';
import { createAdminInteractionsRoutes } from './routes/adminInteractionsRoutes.js';
import { createIntegrationRoutes } from './routes/integrationRoutes.js';
import { CouponPolicyService } from './services/CouponPolicyService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import {
  securityHeaders,
  additionalSecurityHeaders,
  corsOptions,
  sessionConfig,
  requestLimits
} from './middleware/securityMiddleware.js';
import i18n from './i18n/config.js';

// Load environment variables
dotenv.config();

// Initialize i18n
// Requirements: 7.1, 7.2, 9.4 - Backend i18n configuration
i18n.on('initialized', () => {
  console.log('i18n initialized successfully');
});

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
// Requirements: 33.1 - Add security headers
app.use(securityHeaders);
app.use(additionalSecurityHeaders);

// CORS configuration
// Requirements: 33.1 - Implement CORS configuration
app.use(cors(corsOptions));

// Body parsing with size limits and error handling for malformed JSON
// Requirements: 33.1 - Configure file upload restrictions
app.use(express.json({ 
  limit: requestLimits.json,
  verify: (req: any, _res, buf) => {
    // Store raw body for debugging JSON parse errors
    req.rawBody = buf.toString('utf8');
  }
}));

// Handle JSON parse errors with detailed logging
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('[JSON Parse Error] Malformed JSON received:', {
      path: req.path,
      method: req.method,
      rawBody: req.rawBody?.substring(0, 500), // First 500 chars
      rawBodyHex: req.rawBody ? Buffer.from(req.rawBody.substring(0, 100)).toString('hex') : null,
      error: err.message,
    });
    return res.status(400).json({ 
      error: 'Invalid JSON format',
      details: err.message,
      hint: 'Check for special characters or encoding issues'
    });
  }
  next(err);
});

app.use(express.urlencoded({ extended: true, limit: requestLimits.urlencoded }));

// Session configuration
// Requirements: 12.4, 33.1 - Set up secure session configuration
app.use(session(sessionConfig));

// Initialize database - use centralized config
const dbPath = process.env.DATABASE_PATH || DATABASE_PATH;
const db = initializeDatabase(dbPath);
const dbService = new DatabaseService(db);
const authService = new AuthService(dbService);

// Initialize logger service
// Requirements: 32.1 - Structured logging with levels
const logger = new LoggerService(dbService);

// Initialize media service - use centralized config
const uploadDir = process.env.UPLOAD_DIR || UPLOADS_DIR;
console.log('MediaService upload directory:', uploadDir);
const mediaService = new MediaService(uploadDir);

// Initialize Google Sheets service
// Requirements: 11.2, 11.7, 11.8
const googleSheetsService = new GoogleSheetsService();

// Initialize Google Sheets with credentials if configured
const initializeGoogleSheets = async () => {
  try {
    const settings = dbService.getSettings();
    if (settings.sheets_credentials) {
      await googleSheetsService.initialize(settings.sheets_credentials);
      console.log('Google Sheets service initialized successfully');
    } else {
      console.log('Google Sheets credentials not configured, skipping initialization');
    }
  } catch (error) {
    console.error('Failed to initialize Google Sheets service:', error);
  }
};

// Initialize sync queue service
// Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
const syncQueueService = new SyncQueueService(dbService, googleSheetsService);

// Initialize backup service - use centralized config
// Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
const backupDir = process.env.BACKUP_DIR || BACKUPS_DIR;
const backupService = new BackupService(dbService, backupDir);

// Initialize QR code service
// Requirements: 8.2, 8.4
const qrCodeService = new QRCodeService();

// Initialize log rotation service
// Requirements: 32.1 - Log rotation
const logRotationService = new LogRotationService(dbService, 30);

// Initialize coupon service
// Requirements: WhatsApp Coupon System
const whatsappNumber = process.env.WHATSAPP_NUMBER || '';
const couponService = new CouponService(db, whatsappNumber);
const eventLogService = new EventLogService(db);
const rateLimitService = new RateLimitService(db);
const couponPolicyService = new CouponPolicyService(db);

// Start Google Sheets initialization and sync queue
initializeGoogleSheets().then(() => {
  logger.info('Application initialized successfully');

  // Schedule sync queue to run every 5 minutes
  syncQueueService.scheduleSync();

  // Schedule daily backups at 3 AM
  backupService.scheduleDaily();

  // Schedule log rotation daily at 2 AM
  logRotationService.scheduleRotation();

  // Schedule coupon system jobs
  // Requirements: 22.3, 23.5, 24.3, 28.1, 28.2
  
  // Token cleanup: daily at 3:00 AM Istanbul time
  cron.schedule('0 3 * * *', () => {
    try {
      const deletedCount = couponService.cleanupExpiredTokens();
      logger.info('Token cleanup job completed', { deletedCount });
    } catch (error: any) {
      logger.error('Token cleanup job failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }, {
    timezone: 'Europe/Istanbul'
  });

  // Redemption expiration: daily at 3:00 AM Istanbul time
  cron.schedule('0 3 * * *', () => {
    try {
      const expiredCount = couponService.expirePendingRedemptions();
      logger.info('Redemption expiration job completed', { expiredCount });
    } catch (error: any) {
      logger.error('Redemption expiration job failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }, {
    timezone: 'Europe/Istanbul'
  });

  // Rate limit counter cleanup: daily at 12:01 AM Istanbul time
  cron.schedule('1 0 * * *', () => {
    try {
      rateLimitService.resetExpiredCounters();
      logger.info('Rate limit counter cleanup job completed');
    } catch (error: any) {
      logger.error('Rate limit counter cleanup job failed', {
        error: error.message,
        stack: error.stack,
      });
    }
  }, {
    timezone: 'Europe/Istanbul'
  });

  logger.info('Coupon system scheduled jobs initialized');
}).catch((error) => {
  logger.error('Failed to initialize application', {
    error: error.message,
    stack: error.stack,
  });
});

// Request logging middleware
// Requirements: 32.1 - Request logging
app.use(requestLogger(logger));

// Configure static file serving for /uploads directory - use centralized config
// Requirements: 4.3
app.use('/uploads', express.static(UPLOADS_DIR));

// Routes
app.use('/api/admin', createAdminRoutes(dbService, authService, backupService, mediaService, googleSheetsService));
app.use('/api/admin/coupons', createAdminCouponRoutes(dbService, couponService, eventLogService));
app.use('/api/admin/policy', createAdminPolicyRoutes(dbService, couponPolicyService));
app.use('/api/admin/knowledge-base', createAdminKnowledgeBaseRoutes(dbService));
app.use('/api/admin/services', createAdminServiceControlRoutes(dbService));
app.use('/api/admin/interactions', createAdminInteractionsRoutes(dbService));
app.use('/api/integrations/coupons', createIntegrationCouponRoutes(db, dbService, couponService));
app.use('/api/integrations', createIntegrationRoutes(dbService));
app.use('/api/kiosk', createKioskRoutes(dbService, qrCodeService));
app.use('/webhook/whatsapp', createWhatsappWebhookRoutes());
app.use('/webhook/instagram', createInstagramWebhookRoutes());
app.use('/api/integrations/instagram', createInstagramIntegrationRoutes(db));

// Serve frontend static files in production - use centralized config
if (process.env.NODE_ENV === 'production') {
  // Serve static assets
  app.use(express.static(FRONTEND_DIST));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// 404 handler for unknown routes
// Requirements: 32.1 - User-friendly error messages
app.use(notFoundHandler);

// Error handling middleware
// Requirements: 32.1 - Backend error handling middleware
app.use(errorHandler(logger));

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  logger.info(`Backend server started on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
});

export { app, dbService, authService, mediaService, googleSheetsService, syncQueueService, backupService, qrCodeService, kioskEventService, logger, logRotationService, couponService, i18n };
