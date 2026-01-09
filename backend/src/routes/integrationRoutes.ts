import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { ServiceControlService } from '../services/ServiceControlService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { body, param, validationResult } from 'express-validator';

/**
 * Validation middleware for WhatsApp interaction logging
 */
const validateWhatsAppInteraction = [
  body('phone')
    .isString()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone must be between 10 and 20 characters'),
  body('direction')
    .isIn(['inbound', 'outbound'])
    .withMessage('Direction must be inbound or outbound'),
  body('messageText')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message text must be between 1 and 5000 characters'),
  body('intent')
    .optional()
    .isString()
    .trim()
    .withMessage('Intent must be a string'),
  body('sentiment')
    .optional()
    .isString()
    .trim()
    .withMessage('Sentiment must be a string'),
  body('aiResponse')
    .optional()
    .isString()
    .trim()
    .withMessage('AI response must be a string'),
  body('responseTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Response time must be a non-negative integer'),
];

/**
 * Validation middleware for service name parameter
 */
const validateServiceName = [
  param('name')
    .isIn(['whatsapp', 'instagram'])
    .withMessage('Invalid service name. Must be whatsapp or instagram'),
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
 * Create integration routes for n8n workflows
 * Requirements: 7.1, 7.2, 7.3, 2.4, 2.5, 8.1
 */
export function createIntegrationRoutes(db: DatabaseService): Router {
  const router = Router();
  const knowledgeBaseService = new KnowledgeBaseService(db);
  const serviceControlService = new ServiceControlService(db);

  // All routes require API key authentication
  router.use(apiKeyAuth);

  /**
   * GET /api/integrations/knowledge/context
   * Get formatted knowledge context for AI workflows
   * Supports optional category filtering via query params
   * Requirements: 7.1, 7.2, 7.3
   * 
   * Query params:
   * - categories: comma-separated list (e.g., "pricing,services,contact")
   * - intent: auto-select categories based on intent (e.g., "pricing", "hours", "general_info")
   */
  router.get('/knowledge/context', (req: Request, res: Response) => {
    try {
      const { categories, intent } = req.query;
      let context = knowledgeBaseService.getContext();

      // Intent-based category mapping
      const intentCategoryMap: Record<string, string[]> = {
        'pricing': ['pricing', 'services'],
        'hours': ['hours', 'contact'],
        'location': ['contact'],
        'booking': ['contact', 'hours'],
        'campaign': ['pricing'],
        'services': ['services', 'pricing'],
        'membership': ['pricing', 'services'],
        'kids': ['services', 'hours', 'pricing'],
        'general_info': ['pricing', 'services', 'contact'],
        'thanks': ['contact'],
      };

      // Determine which categories to return
      let requestedCategories: string[] | null = null;

      if (intent && typeof intent === 'string' && intentCategoryMap[intent]) {
        requestedCategories = intentCategoryMap[intent];
      } else if (categories && typeof categories === 'string') {
        requestedCategories = categories.split(',').map(c => c.trim().toLowerCase());
      }

      // Filter context if categories specified
      if (requestedCategories) {
        const filteredContext: Record<string, Record<string, string>> = {};
        for (const cat of requestedCategories) {
          if (context[cat]) {
            filteredContext[cat] = context[cat];
          }
        }
        context = filteredContext;
      }

      // Log context request
      db.createLog({
        level: 'info',
        message: 'Knowledge context requested by n8n workflow',
        details: { 
          intent: intent || null,
          requestedCategories: requestedCategories || 'all',
          returnedCategories: Object.keys(context),
          totalEntries: Object.values(context).reduce((sum, cat) => sum + Object.keys(cat).length, 0)
        },
      });

      res.json(context);
    } catch (error) {
      console.error('[Integration API] Error fetching knowledge context:', error);
      res.status(500).json({ error: 'Failed to fetch knowledge context' });
    }
  });

  /**
   * GET /api/integrations/services/:name/status
   * Check if a service is enabled
   * Requirements: 2.4, 2.5
   */
  router.get('/services/:name/status', validateServiceName, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const service = serviceControlService.getStatus(name);

      if (!service) {
        res.status(404).json({ 
          error: 'Service not found',
          enabled: false 
        });
        return;
      }

      // Return simple enabled status for n8n workflow
      res.json({
        serviceName: service.service_name,
        enabled: service.enabled === 1,
        lastActivity: service.last_activity,
        messageCount24h: service.message_count_24h,
      });
    } catch (error) {
      console.error('[Integration API] Error checking service status:', error);
      res.status(500).json({ 
        error: 'Failed to check service status',
        enabled: false 
      });
    }
  });

  /**
   * POST /api/integrations/whatsapp/interaction
   * Log a WhatsApp interaction
   * Requirements: 8.1, 8.2
   */
  router.post('/whatsapp/interaction', validateWhatsAppInteraction, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const {
        phone,
        direction,
        messageText,
        intent,
        sentiment,
        aiResponse,
        responseTime
      } = req.body;

      const id = randomUUID();
      const now = new Date().toISOString();

      // Insert interaction into whatsapp_interactions table
      const query = `
        INSERT INTO whatsapp_interactions 
        (id, phone, direction, message_text, intent, sentiment, ai_response, response_time_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db['db'].prepare(query).run(
        id,
        phone,
        direction,
        messageText,
        intent || null,
        sentiment || null,
        aiResponse || null,
        responseTime || null,
        now
      );

      // Update service last activity
      serviceControlService.updateLastActivity('whatsapp');

      // Log interaction
      db.createLog({
        level: 'info',
        message: 'WhatsApp interaction logged',
        details: { 
          interactionId: id,
          direction,
          intent,
          sentiment,
          hasAiResponse: !!aiResponse
        },
      });

      res.json({ 
        success: true, 
        interactionId: id,
        message: 'Interaction logged successfully' 
      });
    } catch (error) {
      console.error('[Integration API] Error logging WhatsApp interaction:', error);
      res.status(500).json({ error: 'Failed to log interaction' });
    }
  });

  return router;
}
