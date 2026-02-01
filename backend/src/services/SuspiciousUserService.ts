/**
 * Suspicious User Service
 * Manages users who have sent inappropriate messages
 * Unlike blocking, suspicious users can still receive responses but with a more direct tone
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface SuspiciousUser {
  id: string;
  platform: 'instagram' | 'whatsapp';
  platformUserId: string;
  username?: string;
  reason: string;
  flaggedAt: string;
  offenseCount: number;
  isActive: boolean;
  lastOffenseAt: string;
}

export interface SuspiciousCheckResult {
  isSuspicious: boolean;
  offenseCount?: number;
  reason?: string;
  lastOffenseAt?: string;
}

export class SuspiciousUserService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTable();
  }

  /**
   * Ensure the suspicious_users table exists
   */
  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS suspicious_users (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL CHECK(platform IN ('instagram', 'whatsapp')),
        platform_user_id TEXT NOT NULL,
        reason TEXT,
        flagged_at TEXT NOT NULL,
        offense_count INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        last_offense_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(platform, platform_user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_suspicious_users_lookup 
      ON suspicious_users(platform, platform_user_id, is_active);
    `);
  }

  /**
   * Check if a user is flagged as suspicious
   */
  checkSuspicious(platform: string, platformUserId: string): SuspiciousCheckResult {
    const user = this.db.prepare(`
      SELECT * FROM suspicious_users 
      WHERE platform = ? AND platform_user_id = ? AND is_active = 1
    `).get(platform, platformUserId) as any;

    if (!user) {
      return { isSuspicious: false };
    }

    return {
      isSuspicious: true,
      offenseCount: user.offense_count,
      reason: user.reason,
      lastOffenseAt: user.last_offense_at
    };
  }

  /**
   * Flag a user as suspicious
   * Increments offense count if already flagged
   */
  flagUser(platform: string, platformUserId: string, reason: string): SuspiciousUser {
    const now = new Date();
    const nowStr = now.toISOString();

    // Check for existing record
    const existing = this.db.prepare(`
      SELECT * FROM suspicious_users 
      WHERE platform = ? AND platform_user_id = ?
    `).get(platform, platformUserId) as any;

    let id: string;
    let offenseCount = 1;

    if (existing) {
      id = existing.id;
      offenseCount = (existing.offense_count || 0) + 1;
      
      // Update existing record
      this.db.prepare(`
        UPDATE suspicious_users SET
          reason = ?,
          offense_count = ?,
          is_active = 1,
          last_offense_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(reason, offenseCount, nowStr, nowStr, id);
    } else {
      id = randomUUID();
      
      // Insert new record
      this.db.prepare(`
        INSERT INTO suspicious_users 
        (id, platform, platform_user_id, reason, flagged_at, offense_count, is_active, last_offense_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, platform, platformUserId, reason, nowStr, offenseCount, nowStr, nowStr, nowStr);
    }

    return {
      id,
      platform: platform as 'instagram' | 'whatsapp',
      platformUserId,
      reason,
      flaggedAt: existing?.flagged_at || nowStr,
      offenseCount,
      isActive: true,
      lastOffenseAt: nowStr
    };
  }

  /**
   * Remove suspicious flag from user (admin action)
   */
  unflagUser(platform: string, platformUserId: string): boolean {
    const now = new Date().toISOString();
    
    const result = this.db.prepare(`
      UPDATE suspicious_users SET is_active = 0, updated_at = ?
      WHERE platform = ? AND platform_user_id = ? AND is_active = 1
    `).run(now, platform, platformUserId);

    return result.changes > 0;
  }

  /**
   * Get all suspicious users with username from instagram_customers
   */
  getSuspiciousUsers(platform?: string): SuspiciousUser[] {
    let query = `
      SELECT s.*, c.name as username
      FROM suspicious_users s
      LEFT JOIN instagram_customers c ON s.platform = 'instagram' AND s.platform_user_id = c.instagram_id
      WHERE s.is_active = 1
    `;
    const params: any[] = [];

    if (platform) {
      query += ' AND s.platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY s.last_offense_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      username: row.username || undefined,
      reason: row.reason,
      flaggedAt: row.flagged_at,
      offenseCount: row.offense_count,
      isActive: row.is_active === 1,
      lastOffenseAt: row.last_offense_at
    }));
  }

  /**
   * Get chat history for a user (reuse from UserBlockService pattern)
   */
  getChatHistory(platform: string, platformUserId: string, limit: number = 50): any[] {
    if (platform === 'instagram') {
      const rows = this.db.prepare(`
        SELECT id, direction, message_text, intent, sentiment, ai_response, created_at
        FROM instagram_interactions
        WHERE instagram_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(platformUserId, limit) as any[];

      return rows.map(row => ({
        id: row.id,
        direction: row.direction,
        messageText: row.message_text,
        intent: row.intent || undefined,
        sentiment: row.sentiment || undefined,
        aiResponse: row.ai_response || undefined,
        createdAt: row.created_at
      }));
    }
    
    return [];
  }
}
