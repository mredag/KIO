import { Router, Request, Response } from 'express';
import { UnifiedInteractionsService } from '../services/UnifiedInteractionsService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { query, validationResult } from 'express-validator';
import i18n from '../i18n/config.js';

/**
 * Validation middleware for interaction filters
 */
const validateFilters = [
  query('platform')
    .optional()
    .isIn(['whatsapp', 'instagram', 'all'])
    .withMessage('Invalid platform. Must be whatsapp, instagram, or all'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format. Must be ISO 8601'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format. Must be ISO 8601'),
  query('customerId')
    .optional()
    .isString()
    .trim()
    .withMessage('Customer ID must be a string'),
  query('intent')
    .optional()
    .isString()
    .trim()
    .withMessage('Intent must be a string'),
  query('sentiment')
    .optional()
    .isString()
    .trim()
    .withMessage('Sentiment must be a string'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
];

/**
 * Handle validation errors
 */
const handleValidationErrors = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      error: errors.array()[0].msg,
      errors: errors.array() 
    });
    return;
  }
  next();
};

/**
 * Create admin interactions routes
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2
 */
export function createAdminInteractionsRoutes(db: DatabaseService): Router {
  const router = Router();
  const unifiedInteractionsService = new UnifiedInteractionsService(db);

  /**
   * GET /api/admin/interactions
   * List unified interactions with filters
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   */
  router.get('/', authMiddleware, validateFilters, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const filters: any = {};

      if (req.query.platform) {
        filters.platform = req.query.platform as string;
      }

      if (req.query.startDate) {
        filters.startDate = req.query.startDate as string;
      }

      if (req.query.endDate) {
        filters.endDate = req.query.endDate as string;
      }

      if (req.query.customerId) {
        filters.customerId = req.query.customerId as string;
      }

      if (req.query.intent) {
        filters.intent = req.query.intent as string;
      }

      if (req.query.sentiment) {
        filters.sentiment = req.query.sentiment as string;
      }

      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string, 10);
      }

      if (req.query.offset) {
        filters.offset = parseInt(req.query.offset as string, 10);
      }

      const interactions = unifiedInteractionsService.getInteractions(filters);

      // Transform snake_case to camelCase for frontend
      const transformedInteractions = interactions.map(interaction => ({
        id: interaction.id,
        platform: interaction.platform,
        customerId: interaction.customer_id,
        direction: interaction.direction,
        messageText: interaction.message_text,
        intent: interaction.intent,
        sentiment: interaction.sentiment,
        aiResponse: interaction.ai_response,
        responseTimeMs: interaction.response_time_ms,
        createdAt: interaction.created_at,
      }));

      res.json(transformedInteractions);
    } catch (error) {
      console.error('Error fetching interactions:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/admin/interactions/analytics
   * Get analytics data for interactions
   * Requirements: 5.1, 5.2, 5.3, 5.4
   */
  router.get('/analytics', authMiddleware, validateFilters, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const filters: any = {};

      if (req.query.platform) {
        filters.platform = req.query.platform as string;
      }

      if (req.query.startDate) {
        filters.startDate = req.query.startDate as string;
      }

      if (req.query.endDate) {
        filters.endDate = req.query.endDate as string;
      }

      const analytics = unifiedInteractionsService.getAnalytics(filters);

      // Transform snake_case to camelCase for frontend
      const transformedAnalytics = {
        totalMessages: analytics.total_messages,
        uniqueCustomers: analytics.unique_customers,
        avgResponseTimeMs: analytics.avg_response_time_ms,
        intentBreakdown: analytics.intent_breakdown,
        sentimentBreakdown: analytics.sentiment_breakdown,
        dailyTrends: analytics.daily_trends,
      };

      res.json(transformedAnalytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/admin/interactions/export
   * Export interactions as CSV
   * Requirements: 6.1, 6.2
   */
  router.get('/export', authMiddleware, validateFilters, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const filters: any = {};

      if (req.query.platform) {
        filters.platform = req.query.platform as string;
      }

      if (req.query.startDate) {
        filters.startDate = req.query.startDate as string;
      }

      if (req.query.endDate) {
        filters.endDate = req.query.endDate as string;
      }

      if (req.query.customerId) {
        filters.customerId = req.query.customerId as string;
      }

      if (req.query.intent) {
        filters.intent = req.query.intent as string;
      }

      if (req.query.sentiment) {
        filters.sentiment = req.query.sentiment as string;
      }

      const csv = unifiedInteractionsService.exportCsv(filters);

      // Log export
      db.createLog({
        level: 'info',
        message: 'Interactions exported to CSV',
        details: { 
          filters,
          user: req.session.user?.username 
        },
      });

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="interactions-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Error exporting interactions:', error);
      res.status(500).json({ error: i18n.t('errors:exportFailed') });
    }
  });

  return router;
}
