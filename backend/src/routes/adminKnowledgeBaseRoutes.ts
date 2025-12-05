import { Router, Request, Response } from 'express';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { body, param, validationResult } from 'express-validator';
import i18n from '../i18n/config.js';

/**
 * Validation middleware for knowledge base entry creation
 */
const validateKnowledgeEntry = [
  body('category')
    .isIn(['services', 'pricing', 'hours', 'policies', 'contact', 'general'])
    .withMessage('Invalid category'),
  body('key_name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Key name must be between 1 and 100 characters'),
  body('value')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Value must be between 1 and 5000 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

/**
 * Validation middleware for knowledge base entry update
 */
const validateKnowledgeEntryUpdate = [
  body('category')
    .optional()
    .isIn(['services', 'pricing', 'hours', 'policies', 'contact', 'general'])
    .withMessage('Invalid category'),
  body('key_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Key name must be between 1 and 100 characters'),
  body('value')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Value must be between 1 and 5000 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

/**
 * Validation middleware for ID parameter
 */
const validateIdParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
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
 * Create admin knowledge base routes
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export function createAdminKnowledgeBaseRoutes(db: DatabaseService): Router {
  const router = Router();
  const knowledgeBaseService = new KnowledgeBaseService(db);

  /**
   * GET /api/admin/knowledge-base
   * List all knowledge base entries
   * Requirements: 3.1
   */
  router.get('/', authMiddleware, (_req: Request, res: Response) => {
    try {
      const entries = knowledgeBaseService.getAll();
      
      // Transform snake_case to camelCase for frontend
      const transformedEntries = entries.map(entry => ({
        id: entry.id,
        category: entry.category,
        keyName: entry.key_name,
        value: entry.value,
        description: entry.description,
        isActive: entry.is_active === 1,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }));

      res.json(transformedEntries);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * GET /api/admin/knowledge-base/:id
   * Get a single knowledge base entry
   * Requirements: 3.2
   */
  router.get('/:id', authMiddleware, validateIdParam, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const entry = knowledgeBaseService.getById(id);

      if (!entry) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      // Transform snake_case to camelCase for frontend
      const transformedEntry = {
        id: entry.id,
        category: entry.category,
        keyName: entry.key_name,
        value: entry.value,
        description: entry.description,
        isActive: entry.is_active === 1,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      };

      res.json(transformedEntry);
    } catch (error) {
      console.error('Error fetching knowledge base entry:', error);
      res.status(500).json({ error: i18n.t('errors:fetchFailed') });
    }
  });

  /**
   * POST /api/admin/knowledge-base
   * Create a new knowledge base entry
   * Requirements: 3.2
   */
  router.post('/', authMiddleware, validateKnowledgeEntry, handleValidationErrors, (req: Request, res: Response) => {
    try {
      // Transform camelCase to snake_case for service
      const entryInput = {
        category: req.body.category,
        key_name: req.body.keyName || req.body.key_name,
        value: req.body.value,
        description: req.body.description,
        is_active: req.body.isActive !== undefined ? req.body.isActive : req.body.is_active,
      };

      const entry = knowledgeBaseService.create(entryInput);

      // Log creation
      db.createLog({
        level: 'info',
        message: 'Knowledge base entry created',
        details: { 
          entryId: entry.id, 
          category: entry.category,
          keyName: entry.key_name,
          user: req.session.user?.username 
        },
      });

      // Transform snake_case to camelCase for frontend
      const transformedEntry = {
        id: entry.id,
        category: entry.category,
        keyName: entry.key_name,
        value: entry.value,
        description: entry.description,
        isActive: entry.is_active === 1,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      };

      res.status(201).json(transformedEntry);
    } catch (error: any) {
      console.error('Error creating knowledge base entry:', error);
      
      // Handle unique constraint violation
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'A knowledge entry with this category and key already exists' });
        return;
      }

      res.status(500).json({ error: i18n.t('errors:createFailed') });
    }
  });

  /**
   * PUT /api/admin/knowledge-base/:id
   * Update a knowledge base entry
   * Requirements: 3.3
   */
  router.put('/:id', authMiddleware, validateIdParam, validateKnowledgeEntryUpdate, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if entry exists
      const existing = knowledgeBaseService.getById(id);
      if (!existing) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      // Transform camelCase to snake_case for service
      const updates: any = {};
      if (req.body.category !== undefined) updates.category = req.body.category;
      if (req.body.keyName !== undefined) updates.key_name = req.body.keyName;
      if (req.body.key_name !== undefined) updates.key_name = req.body.key_name;
      if (req.body.value !== undefined) updates.value = req.body.value;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;

      const entry = knowledgeBaseService.update(id, updates);

      // Log update
      db.createLog({
        level: 'info',
        message: 'Knowledge base entry updated',
        details: { 
          entryId: id, 
          category: entry.category,
          keyName: entry.key_name,
          version: entry.version,
          user: req.session.user?.username 
        },
      });

      // Transform snake_case to camelCase for frontend
      const transformedEntry = {
        id: entry.id,
        category: entry.category,
        keyName: entry.key_name,
        value: entry.value,
        description: entry.description,
        isActive: entry.is_active === 1,
        version: entry.version,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      };

      res.json(transformedEntry);
    } catch (error: any) {
      console.error('Error updating knowledge base entry:', error);
      
      // Handle unique constraint violation
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'A knowledge entry with this category and key already exists' });
        return;
      }

      res.status(500).json({ error: i18n.t('errors:updateFailed') });
    }
  });

  /**
   * DELETE /api/admin/knowledge-base/:id
   * Delete a knowledge base entry
   * Requirements: 3.4
   */
  router.delete('/:id', authMiddleware, validateIdParam, handleValidationErrors, (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check if entry exists
      const existing = knowledgeBaseService.getById(id);
      if (!existing) {
        res.status(404).json({ error: i18n.t('errors:notFound') });
        return;
      }

      const success = knowledgeBaseService.delete(id);

      if (!success) {
        res.status(500).json({ error: i18n.t('errors:deleteFailed') });
        return;
      }

      // Log deletion
      db.createLog({
        level: 'info',
        message: 'Knowledge base entry deleted',
        details: { 
          entryId: id, 
          category: existing.category,
          keyName: existing.key_name,
          user: req.session.user?.username 
        },
      });

      res.json({ success: true, message: i18n.t('success:deleted') });
    } catch (error) {
      console.error('Error deleting knowledge base entry:', error);
      res.status(500).json({ error: i18n.t('errors:deleteFailed') });
    }
  });

  return router;
}
