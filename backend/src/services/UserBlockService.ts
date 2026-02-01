/**
 * User Block Service
 * Manages temporary blocking of users who send inappropriate messages
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface BlockedUser {
  id: string;
  platform: 'instagram' | 'whatsapp';
  platformUserId: string;
  username?: string;
  reason: string;
  blockedAt: string;
  expiresAt: string;
  blockCount: number;
  isActive: boolean;
  isPermanent?: boolean;
}

export interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  messageText: string;
  intent?: string;
  sentiment?: string;
  aiResponse?: string;
  createdAt: string;
}

export interface BlockCheckResult {
  isBlocked: boolean;
  expiresAt?: string;
  remainingMinutes?: number;
  blockCount?: number;
  reason?: string;
}

// Block duration escalation (in minutes)
const BLOCK_DURATIONS = [
  30,    // 1st offense: 30 minutes
  60,    // 2nd offense: 1 hour
  180,   // 3rd offense: 3 hours
  720,   // 4th offense: 12 hours
  1440,  // 5th+ offense: 24 hours
];

export class UserBlockService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTable();
  }

  /**
   * Ensure the blocked_users table exists
   */
  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL CHECK(platform IN ('instagram', 'whatsapp')),
        platform_user_id TEXT NOT NULL,
        reason TEXT,
        blocked_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        block_count INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(platform, platform_user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_blocked_users_lookup 
      ON blocked_users(platform, platform_user_id, is_active);
      
      CREATE INDEX IF NOT EXISTS idx_blocked_users_expires 
      ON blocked_users(expires_at);
    `);
  }

  /**
   * Check if a user is currently blocked
   */
  checkBlock(platform: string, platformUserId: string): BlockCheckResult {
    const now = new Date().toISOString();
    
    const block = this.db.prepare(`
      SELECT * FROM blocked_users 
      WHERE platform = ? AND platform_user_id = ? AND is_active = 1
    `).get(platform, platformUserId) as any;

    if (!block) {
      return { isBlocked: false };
    }

    // Check if block has expired
    if (block.expires_at < now) {
      // Deactivate expired block
      this.db.prepare(`
        UPDATE blocked_users SET is_active = 0, updated_at = ?
        WHERE id = ?
      `).run(now, block.id);
      
      return { isBlocked: false };
    }

    // Calculate remaining time
    const expiresAt = new Date(block.expires_at);
    const remainingMs = expiresAt.getTime() - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return {
      isBlocked: true,
      expiresAt: block.expires_at,
      remainingMinutes,
      blockCount: block.block_count,
      reason: block.reason
    };
  }

  /**
   * Block a user temporarily
   * Duration escalates with each offense
   */
  blockUser(platform: string, platformUserId: string, reason: string): BlockedUser {
    const now = new Date();
    const nowStr = now.toISOString();

    // Check for existing block record (even if expired)
    const existing = this.db.prepare(`
      SELECT * FROM blocked_users 
      WHERE platform = ? AND platform_user_id = ?
    `).get(platform, platformUserId) as any;

    let blockCount = 1;
    let id: string;

    if (existing) {
      blockCount = (existing.block_count || 0) + 1;
      id = existing.id;
    } else {
      id = randomUUID();
    }

    // Calculate block duration based on offense count
    const durationIndex = Math.min(blockCount - 1, BLOCK_DURATIONS.length - 1);
    const durationMinutes = BLOCK_DURATIONS[durationIndex];
    const expiresAt = new Date(now.getTime() + durationMinutes * 60000).toISOString();

    if (existing) {
      // Update existing record
      this.db.prepare(`
        UPDATE blocked_users SET
          reason = ?,
          blocked_at = ?,
          expires_at = ?,
          block_count = ?,
          is_active = 1,
          updated_at = ?
        WHERE id = ?
      `).run(reason, nowStr, expiresAt, blockCount, nowStr, id);
    } else {
      // Insert new record
      this.db.prepare(`
        INSERT INTO blocked_users 
        (id, platform, platform_user_id, reason, blocked_at, expires_at, block_count, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, platform, platformUserId, reason, nowStr, expiresAt, blockCount, nowStr, nowStr);
    }

    return {
      id,
      platform: platform as 'instagram' | 'whatsapp',
      platformUserId,
      reason,
      blockedAt: nowStr,
      expiresAt,
      blockCount,
      isActive: true
    };
  }

  /**
   * Manually unblock a user (admin action)
   */
  unblockUser(platform: string, platformUserId: string): boolean {
    const now = new Date().toISOString();
    
    const result = this.db.prepare(`
      UPDATE blocked_users SET is_active = 0, updated_at = ?
      WHERE platform = ? AND platform_user_id = ? AND is_active = 1
    `).run(now, platform, platformUserId);

    return result.changes > 0;
  }

  /**
   * Permanently block a user (no expiration)
   */
  permanentBlock(platform: string, platformUserId: string, reason: string): BlockedUser {
    const now = new Date();
    const nowStr = now.toISOString();
    // Set expiration to 100 years from now (effectively permanent)
    const expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

    const existing = this.db.prepare(`
      SELECT * FROM blocked_users 
      WHERE platform = ? AND platform_user_id = ?
    `).get(platform, platformUserId) as any;

    let id: string;
    let blockCount = 1;

    if (existing) {
      id = existing.id;
      blockCount = existing.block_count || 1;
      this.db.prepare(`
        UPDATE blocked_users SET
          reason = ?,
          blocked_at = ?,
          expires_at = ?,
          is_active = 1,
          updated_at = ?
        WHERE id = ?
      `).run(reason, nowStr, expiresAt, nowStr, id);
    } else {
      id = randomUUID();
      this.db.prepare(`
        INSERT INTO blocked_users 
        (id, platform, platform_user_id, reason, blocked_at, expires_at, block_count, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, platform, platformUserId, reason, nowStr, expiresAt, blockCount, nowStr, nowStr);
    }

    return {
      id,
      platform: platform as 'instagram' | 'whatsapp',
      platformUserId,
      reason,
      blockedAt: nowStr,
      expiresAt,
      blockCount,
      isActive: true,
      isPermanent: true
    };
  }

  /**
   * Get all currently blocked users with username from instagram_customers
   */
  getBlockedUsers(platform?: string): BlockedUser[] {
    const now = new Date().toISOString();
    // 50 years threshold for permanent blocks
    const permanentThreshold = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000).toISOString();
    
    let query = `
      SELECT b.*, c.name as username
      FROM blocked_users b
      LEFT JOIN instagram_customers c ON b.platform = 'instagram' AND b.platform_user_id = c.instagram_id
      WHERE b.is_active = 1 AND b.expires_at > ?
    `;
    const params: any[] = [now];

    if (platform) {
      query += ' AND b.platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY b.blocked_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      username: row.username || undefined,
      reason: row.reason,
      blockedAt: row.blocked_at,
      expiresAt: row.expires_at,
      blockCount: row.block_count,
      isActive: row.is_active === 1,
      isPermanent: row.expires_at > permanentThreshold
    }));
  }

  /**
   * Get chat history for a user
   */
  getChatHistory(platform: string, platformUserId: string, limit: number = 50): ChatMessage[] {
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
    } else if (platform === 'whatsapp') {
      const rows = this.db.prepare(`
        SELECT id, direction, message_text, intent, sentiment, ai_response, created_at
        FROM whatsapp_interactions
        WHERE phone = ?
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

  /**
   * Get block history for a user
   */
  getBlockHistory(platform: string, platformUserId: string): BlockedUser[] {
    const rows = this.db.prepare(`
      SELECT * FROM blocked_users 
      WHERE platform = ? AND platform_user_id = ?
      ORDER BY blocked_at DESC
    `).all(platform, platformUserId) as any[];

    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      reason: row.reason,
      blockedAt: row.blocked_at,
      expiresAt: row.expires_at,
      blockCount: row.block_count,
      isActive: row.is_active === 1
    }));
  }

  /**
   * Clean up expired blocks (maintenance task)
   */
  cleanupExpiredBlocks(): number {
    const now = new Date().toISOString();
    
    const result = this.db.prepare(`
      UPDATE blocked_users SET is_active = 0, updated_at = ?
      WHERE is_active = 1 AND expires_at < ?
    `).run(now, now);

    return result.changes;
  }
}
