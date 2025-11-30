/**
 * CouponPolicyService - Manages configurable coupon redemption policies
 * 
 * Instead of hardcoding "4 coupons = 1 free massage", this service
 * provides dynamic, admin-configurable reward tiers.
 * 
 * Features:
 * - Multiple reward tiers (e.g., 4 coupons = basic massage, 8 = premium)
 * - Admin can modify thresholds without code changes
 * - API endpoint for n8n/frontend to fetch current policy
 * - Cached for performance, refreshed on update
 */

import Database from 'better-sqlite3';

export interface RewardTier {
  id: number;
  name: string;
  nameTr: string;  // Turkish name
  couponsRequired: number;
  description: string;
  descriptionTr: string;  // Turkish description
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponPolicy {
  defaultRedemptionThreshold: number;  // Default coupons needed (e.g., 4)
  tokenExpirationHours: number;        // How long tokens are valid (e.g., 24)
  maxCouponsPerDay: number;            // Rate limit per customer per day
  rewardTiers: RewardTier[];           // Available reward options
}

export class CouponPolicyService {
  private db: Database.Database;
  private cachedPolicy: CouponPolicy | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTablesExist();
    this.ensureDefaultPolicy();
  }

  /**
   * Create policy tables if they don't exist
   */
  private ensureTablesExist(): void {
    // Coupon settings table (key-value store for simple settings)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS coupon_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reward tiers table (for multiple redemption options)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS coupon_reward_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_tr TEXT NOT NULL,
        coupons_required INTEGER NOT NULL,
        description TEXT,
        description_tr TEXT,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Ensure default policy exists
   */
  private ensureDefaultPolicy(): void {
    const existingThreshold = this.db
      .prepare("SELECT value FROM coupon_settings WHERE key = 'default_redemption_threshold'")
      .get();

    if (!existingThreshold) {
      // Insert default settings
      const defaults = [
        { key: 'default_redemption_threshold', value: '4', description: 'Default coupons needed for redemption' },
        { key: 'token_expiration_hours', value: '24', description: 'Hours until token expires' },
        { key: 'max_coupons_per_day', value: '10', description: 'Max coupons a customer can earn per day' },
      ];

      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO coupon_settings (key, value, description) VALUES (?, ?, ?)'
      );

      for (const setting of defaults) {
        stmt.run(setting.key, setting.value, setting.description);
      }
    }

    // Ensure default reward tier exists
    const existingTier = this.db
      .prepare('SELECT id FROM coupon_reward_tiers LIMIT 1')
      .get();

    if (!existingTier) {
      this.db.prepare(`
        INSERT INTO coupon_reward_tiers (name, name_tr, coupons_required, description, description_tr, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Free Massage',
        'Ücretsiz Masaj',
        4,
        'Redeem 4 coupons for a free massage session',
        '4 kupon karşılığında ücretsiz masaj hakkı',
        1,
        1
      );
    }
  }

  /**
   * Get current coupon policy (cached)
   */
  getPolicy(): CouponPolicy {
    const now = Date.now();
    
    if (this.cachedPolicy && now < this.cacheExpiry) {
      return this.cachedPolicy;
    }

    // Fetch settings
    const settings = this.db
      .prepare('SELECT key, value FROM coupon_settings')
      .all() as { key: string; value: string }[];

    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    // Fetch active reward tiers
    const tiers = this.db
      .prepare('SELECT * FROM coupon_reward_tiers WHERE is_active = 1 ORDER BY sort_order, coupons_required')
      .all() as any[];

    this.cachedPolicy = {
      defaultRedemptionThreshold: parseInt(settingsMap.get('default_redemption_threshold') || '4', 10),
      tokenExpirationHours: parseInt(settingsMap.get('token_expiration_hours') || '24', 10),
      maxCouponsPerDay: parseInt(settingsMap.get('max_coupons_per_day') || '10', 10),
      rewardTiers: tiers.map(t => ({
        id: t.id,
        name: t.name,
        nameTr: t.name_tr,
        couponsRequired: t.coupons_required,
        description: t.description,
        descriptionTr: t.description_tr,
        isActive: t.is_active === 1,
        sortOrder: t.sort_order,
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at),
      })),
    };

    this.cacheExpiry = now + this.CACHE_TTL_MS;
    return this.cachedPolicy;
  }

  /**
   * Get the default redemption threshold
   */
  getRedemptionThreshold(): number {
    return this.getPolicy().defaultRedemptionThreshold;
  }

  /**
   * Get token expiration in hours
   */
  getTokenExpirationHours(): number {
    return this.getPolicy().tokenExpirationHours;
  }

  /**
   * Get available reward tiers for a given coupon count
   */
  getAvailableRewards(couponCount: number): RewardTier[] {
    const policy = this.getPolicy();
    return policy.rewardTiers.filter(tier => couponCount >= tier.couponsRequired);
  }

  /**
   * Get the cheapest reward tier (minimum coupons required)
   */
  getMinimumRewardTier(): RewardTier | null {
    const policy = this.getPolicy();
    if (policy.rewardTiers.length === 0) return null;
    return policy.rewardTiers.reduce((min, tier) => 
      tier.couponsRequired < min.couponsRequired ? tier : min
    );
  }

  /**
   * Calculate remaining coupons needed for next reward
   */
  getRemainingForNextReward(couponCount: number): { needed: number; nextTier: RewardTier | null } {
    const policy = this.getPolicy();
    
    // Find the next tier the customer can reach
    const nextTier = policy.rewardTiers
      .filter(tier => tier.couponsRequired > couponCount)
      .sort((a, b) => a.couponsRequired - b.couponsRequired)[0] || null;

    if (!nextTier) {
      // Customer has enough for all tiers
      const minTier = this.getMinimumRewardTier();
      return { needed: 0, nextTier: minTier };
    }

    return {
      needed: nextTier.couponsRequired - couponCount,
      nextTier,
    };
  }

  /**
   * Update a setting
   */
  updateSetting(key: string, value: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE coupon_settings SET value = ?, updated_at = ? WHERE key = ?')
      .run(value, now, key);
    
    // Invalidate cache
    this.cachedPolicy = null;
  }

  /**
   * Create a new reward tier
   */
  createRewardTier(tier: Omit<RewardTier, 'id' | 'createdAt' | 'updatedAt'>): RewardTier {
    const now = new Date().toISOString();
    
    const result = this.db.prepare(`
      INSERT INTO coupon_reward_tiers (name, name_tr, coupons_required, description, description_tr, is_active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tier.name,
      tier.nameTr,
      tier.couponsRequired,
      tier.description,
      tier.descriptionTr,
      tier.isActive ? 1 : 0,
      tier.sortOrder,
      now,
      now
    );

    // Invalidate cache
    this.cachedPolicy = null;

    return {
      ...tier,
      id: result.lastInsertRowid as number,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
  }

  /**
   * Update a reward tier
   */
  updateRewardTier(id: number, updates: Partial<Omit<RewardTier, 'id' | 'createdAt' | 'updatedAt'>>): void {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.nameTr !== undefined) { fields.push('name_tr = ?'); values.push(updates.nameTr); }
    if (updates.couponsRequired !== undefined) { fields.push('coupons_required = ?'); values.push(updates.couponsRequired); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.descriptionTr !== undefined) { fields.push('description_tr = ?'); values.push(updates.descriptionTr); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }

    values.push(id);

    this.db.prepare(`UPDATE coupon_reward_tiers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    
    // Invalidate cache
    this.cachedPolicy = null;
  }

  /**
   * Delete a reward tier
   */
  deleteRewardTier(id: number): void {
    this.db.prepare('DELETE FROM coupon_reward_tiers WHERE id = ?').run(id);
    this.cachedPolicy = null;
  }

  /**
   * Get all reward tiers (including inactive)
   */
  getAllRewardTiers(): RewardTier[] {
    const tiers = this.db
      .prepare('SELECT * FROM coupon_reward_tiers ORDER BY sort_order, coupons_required')
      .all() as any[];

    return tiers.map(t => ({
      id: t.id,
      name: t.name,
      nameTr: t.name_tr,
      couponsRequired: t.coupons_required,
      description: t.description,
      descriptionTr: t.description_tr,
      isActive: t.is_active === 1,
      sortOrder: t.sort_order,
      createdAt: new Date(t.created_at),
      updatedAt: new Date(t.updated_at),
    }));
  }
}
