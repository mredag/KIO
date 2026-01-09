import { Router, Request, Response } from 'express';
import { ServiceControlService } from '../services/ServiceControlService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { param, body, validationResult } from 'express-validator';
import i18n from '../i18n/config.js';

/**
 * Validation middleware for service name parameter
 */
const validateServiceName = [
  param('name')
    .isIn(['whatsapp', 'instagram'])
    .withMessage('Invalid service name. Must be whatsapp or instagram'),
];

/**
 * Validation middleware for toggle request
 */
const validateToggle = [
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled must be a boolean'),
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
 * Create admin service control routes
 * Requirements: 2.1, 2.2, 2.3, 9.1, 9.2
 */
export function createAdminServiceControlRoutes(db: DatabaseService): Router {
  const router = Router();
  const serviceControlService = new ServiceControlService(db);

  /**
   * GET /api/admin/services
   * List all services with status and health metrics
   * Requirements: 2.1, 9.1, 9.2
   */
  router.get('/', authMiddleware, (_req: Request, res: Response) => {
    try {
      const services = serviceControlService.getAll();

      // Transform snake_case to camelCase for frontend
      const transformedServices = services.map(service => ({
        serviceName: service.service_name,
        enabled: service.enabled === 1,
        lastActivity: service.last_activity,
        messageCount24h: service.message_count_24h,
        config: service.config ? JSON.parse(service.config) : null,
        updatedAt: service.updated_at,
      }));

      res.json(transformedServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/admin/services/:name
   * Get status for a specific service
   * Requirements: 2.1, 9.1, 9.2
   */
  router.get('/:name', authMiddleware, validateServiceName, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const service = serviceControlService.getStatus(name);

      if (!service) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      // Transform snake_case to camelCase for frontend
      const transformedService = {
        serviceName: service.service_name,
        enabled: service.enabled === 1,
        lastActivity: service.last_activity,
        messageCount24h: service.message_count_24h,
        config: service.config ? JSON.parse(service.config) : null,
        updatedAt: service.updated_at,
      };

      res.json(transformedService);
    } catch (error) {
      console.error('Error fetching service status:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * POST /api/admin/services/:name/toggle
   * Toggle service on/off
   * Requirements: 2.2, 2.3
   */
  router.post('/:name/toggle', authMiddleware, validateServiceName, validateToggle, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      // Check if service exists
      const existing = serviceControlService.getStatus(name);
      if (!existing) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      // Determine new enabled state
      // If enabled is provided in body, use it; otherwise toggle current state
      const newEnabledState = req.body.enabled !== undefined 
        ? req.body.enabled 
        : existing.enabled === 0;

      const service = serviceControlService.setEnabled(name, newEnabledState);

      // Log service toggle
      db.createLog({
        level: 'info',
        message: `Service ${name} ${newEnabledState ? 'enabled' : 'disabled'}`,
        details: { 
          serviceName: name,
          enabled: newEnabledState,
          user: req.session.user?.username 
        },
      });

      // Transform snake_case to camelCase for frontend
      const transformedService = {
        serviceName: service.service_name,
        enabled: service.enabled === 1,
        lastActivity: service.last_activity,
        messageCount24h: service.message_count_24h,
        config: service.config ? JSON.parse(service.config) : null,
        updatedAt: service.updated_at,
      };

      res.json(transformedService);
    } catch (error) {
      console.error('Error toggling service:', error);
      res.status(500).json({ error: i18n.t('errors:updateFailed') });
    }
  });

  return router;
}
