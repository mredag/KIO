/**
 * Admin Policy Routes
 * 
 * Handles admin operations for coupon policy management:
 * - Get/update settings
 * - CRUD for reward tiers
 * 
 * All routes require authenticated admin session.
 */

import { Router, Request, Response } from 'express';
import { CouponPolicyService } from '../services/CouponPolicyService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import i18n from '../i18n/config.js';

export function createAdminPolicyRoutes(
  db: DatabaseService,
  policyService: CouponPolicyService
): Router {
  const router = Router();

  /**
   * GET /api/admin/policy
   * Get current coupon policy settings
   */
  router.get('/', authMiddleware, (_req: Request, res: Response) => {
    try {
      const policy = policyService.getPolicy();
      const allTiers = policyService.getAllRewardTiers();
      
      res.json({
        defaultRedemptionThreshold: policy.defaultRedemptionThreshold,
        tokenExpirationHours: policy.tokenExpirationHours,
        maxCouponsPerDay: policy.maxCouponsPerDay,
        rewardTiers: allTiers,
      });
    } catch (error) {
      console.error('Error fetching policy:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * PUT /api/admin/policy/settings
   * Update policy settings
   */
  router.put('/settings', authMiddleware, (req: Request, res: Response) => {
    try {
      const { defaultRedemptionThreshold, tokenExpirationHours, maxCouponsPerDay } = req.body;
      const username = req.session.user?.username || 'unknown';

      // Validate
      if (defaultRedemptionThreshold !== undefined) {
        const val = parseInt(defaultRedemptionThreshold, 10);
        if (isNaN(val) || val < 1 || val > 100) {
          res.status(400).json({ error: 'Geçersiz kupon eşiği (1-100 arası olmalı)' });
          return;
        }
        policyService.updateSetting('default_redemption_threshold', String(val));
      }

      if (tokenExpirationHours !== undefined) {
        const val = parseInt(tokenExpirationHours, 10);
        if (isNaN(val) || val < 1 || val > 168) {
          res.status(400).json({ error: 'Geçersiz token süresi (1-168 saat arası olmalı)' });
          return;
        }
        policyService.updateSetting('token_expiration_hours', String(val));
      }

      if (maxCouponsPerDay !== undefined) {
        const val = parseInt(maxCouponsPerDay, 10);
        if (isNaN(val) || val < 1 || val > 50) {
          res.status(400).json({ error: 'Geçersiz günlük limit (1-50 arası olmalı)' });
          return;
        }
        policyService.updateSetting('max_coupons_per_day', String(val));
      }

      // Log
      db.createLog({
        level: 'info',
        message: 'Kupon politikası güncellendi',
        details: { user: username, changes: req.body },
      });

      res.json({ success: true, message: 'Ayarlar güncellendi' });
    } catch (error) {
      console.error('Error updating policy settings:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * POST /api/admin/policy/tiers
   * Create a new reward tier
   */
  router.post('/tiers', authMiddleware, (req: Request, res: Response) => {
    try {
      const { name, nameTr, couponsRequired, description, descriptionTr, isActive, sortOrder } = req.body;
      const username = req.session.user?.username || 'unknown';

      // Validate required fields
      if (!name || !nameTr || couponsRequired === undefined) {
        res.status(400).json({ error: 'Ad, Türkçe ad ve kupon sayısı zorunludur' });
        return;
      }

      const coupons = parseInt(couponsRequired, 10);
      if (isNaN(coupons) || coupons < 1 || coupons > 100) {
        res.status(400).json({ error: 'Geçersiz kupon sayısı (1-100 arası olmalı)' });
        return;
      }

      const tier = policyService.createRewardTier({
        name,
        nameTr,
        couponsRequired: coupons,
        description: description || '',
        descriptionTr: descriptionTr || '',
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      });

      db.createLog({
        level: 'info',
        message: 'Yeni ödül seviyesi oluşturuldu',
        details: { user: username, tier: tier.nameTr },
      });

      res.status(201).json(tier);
    } catch (error) {
      console.error('Error creating reward tier:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * PUT /api/admin/policy/tiers/:id
   * Update a reward tier
   */
  router.put('/tiers/:id', authMiddleware, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, nameTr, couponsRequired, description, descriptionTr, isActive, sortOrder } = req.body;
      const username = req.session.user?.username || 'unknown';

      const tierId = parseInt(id, 10);
      if (isNaN(tierId)) {
        res.status(400).json({ error: 'Geçersiz ID' });
        return;
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (nameTr !== undefined) updates.nameTr = nameTr;
      if (couponsRequired !== undefined) {
        const coupons = parseInt(couponsRequired, 10);
        if (isNaN(coupons) || coupons < 1 || coupons > 100) {
          res.status(400).json({ error: 'Geçersiz kupon sayısı' });
          return;
        }
        updates.couponsRequired = coupons;
      }
      if (description !== undefined) updates.description = description;
      if (descriptionTr !== undefined) updates.descriptionTr = descriptionTr;
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      policyService.updateRewardTier(tierId, updates);

      db.createLog({
        level: 'info',
        message: 'Ödül seviyesi güncellendi',
        details: { user: username, tierId, updates },
      });

      res.json({ success: true, message: 'Ödül seviyesi güncellendi' });
    } catch (error) {
      console.error('Error updating reward tier:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  /**
   * DELETE /api/admin/policy/tiers/:id
   * Delete a reward tier
   */
  router.delete('/tiers/:id', authMiddleware, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const username = req.session.user?.username || 'unknown';

      const tierId = parseInt(id, 10);
      if (isNaN(tierId)) {
        res.status(400).json({ error: 'Geçersiz ID' });
        return;
      }

      // Check if this is the last tier
      const allTiers = policyService.getAllRewardTiers();
      if (allTiers.length <= 1) {
        res.status(400).json({ error: 'En az bir ödül seviyesi olmalıdır' });
        return;
      }

      policyService.deleteRewardTier(tierId);

      db.createLog({
        level: 'info',
        message: 'Ödül seviyesi silindi',
        details: { user: username, tierId },
      });

      res.json({ success: true, message: 'Ödül seviyesi silindi' });
    } catch (error) {
      console.error('Error deleting reward tier:', error);
      res.status(500).json({ error: i18n.t('errors:internalError') });
    }
  });

  return router;
}
