/**
 * Suspicious User Service
 *
 * Legacy name retained for compatibility. This service now implements the
 * progressive DM conduct ladder:
 * - guarded
 * - final_warning
 * - silent
 *
 * It also supports temporary manual overrides so test accounts can be lifted
 * back to normal behavior without deleting history.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export type ConductState = 'normal' | 'guarded' | 'final_warning' | 'silent';
export type ManualConductMode = 'auto' | 'force_normal' | 'force_silent';
export type ConductSeverity = 'medium' | 'high';

export interface ConductEvent {
  id: string;
  platform: 'instagram' | 'whatsapp';
  platformUserId: string;
  eventType: 'violation' | 'manual_reset' | 'manual_override';
  stateBefore: ConductState;
  stateAfter: ConductState;
  scoreDelta: number;
  offenseCount: number;
  reason: string;
  source?: string;
  messageExcerpt?: string;
  createdAt: string;
}

export interface ConductOverrideInput {
  mode: ManualConductMode;
  durationHours?: number | null;
  note?: string | null;
}

export interface FlagUserOptions {
  severity?: ConductSeverity;
  action?: 'retry_question' | 'block_message';
  source?: string;
  messageText?: string;
}

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
  conductScore: number;
  conductState: ConductState;
  shouldReply: boolean;
  responseStyle: ConductState;
  silentUntil: string | null;
  manualMode: ManualConductMode;
  manualModeUntil: string | null;
  manualNote: string | null;
  lastAction: string | null;
  lastSource: string | null;
}

export interface SuspiciousCheckResult {
  isSuspicious: boolean;
  offenseCount?: number;
  reason?: string;
  lastOffenseAt?: string;
  conductScore?: number;
  conductState?: ConductState;
  shouldReply?: boolean;
  responseStyle?: ConductState;
  silentUntil?: string | null;
  manualMode?: ManualConductMode;
  manualModeUntil?: string | null;
  manualNote?: string | null;
}

interface SuspiciousUserRow {
  id: string;
  platform: 'instagram' | 'whatsapp';
  platform_user_id: string;
  reason: string | null;
  flagged_at: string;
  offense_count: number;
  is_active: number;
  last_offense_at: string;
  created_at: string;
  updated_at: string;
  conduct_state?: string | null;
  conduct_score?: number | null;
  silent_until?: string | null;
  manual_mode?: string | null;
  manual_mode_until?: string | null;
  manual_note?: string | null;
  last_action?: string | null;
  last_source?: string | null;
  username?: string | null;
}

const GUARDED_SCORE = 1;
const FINAL_WARNING_SCORE = 2;
const SILENT_SCORE = 3;
const FIRST_SILENT_HOURS = 24;
const REPEAT_SILENT_HOURS = 7 * 24;

export class SuspiciousUserService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTable();
  }

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

      CREATE TABLE IF NOT EXISTS suspicious_user_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        platform TEXT NOT NULL CHECK(platform IN ('instagram', 'whatsapp')),
        platform_user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        state_before TEXT NOT NULL,
        state_after TEXT NOT NULL,
        score_delta REAL DEFAULT 0,
        offense_count INTEGER DEFAULT 0,
        reason TEXT,
        source TEXT,
        message_excerpt TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_suspicious_user_events_lookup
      ON suspicious_user_events(platform, platform_user_id, created_at DESC);
    `);

    this.ensureColumn('suspicious_users', 'conduct_state', `TEXT DEFAULT 'guarded'`);
    this.ensureColumn('suspicious_users', 'conduct_score', 'REAL DEFAULT 1');
    this.ensureColumn('suspicious_users', 'silent_until', 'TEXT');
    this.ensureColumn('suspicious_users', 'manual_mode', `TEXT DEFAULT 'auto'`);
    this.ensureColumn('suspicious_users', 'manual_mode_until', 'TEXT');
    this.ensureColumn('suspicious_users', 'manual_note', 'TEXT');
    this.ensureColumn('suspicious_users', 'last_action', 'TEXT');
    this.ensureColumn('suspicious_users', 'last_source', 'TEXT');
  }

  private ensureColumn(tableName: string, columnName: string, columnSql: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some(column => column.name === columnName)) {
      this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
    }
  }

  private normalizeManualMode(rawMode: string | null | undefined): ManualConductMode {
    if (rawMode === 'force_normal' || rawMode === 'force_silent') {
      return rawMode;
    }
    return 'auto';
  }

  private normalizeStoredState(row: SuspiciousUserRow): ConductState {
    const score = Number(row.conduct_score ?? row.offense_count ?? 0);
    if (row.conduct_state === 'silent' || score >= SILENT_SCORE) {
      return 'silent';
    }
    if (row.conduct_state === 'final_warning' || score >= FINAL_WARNING_SCORE) {
      return 'final_warning';
    }
    if ((row.conduct_state === 'guarded') || score >= GUARDED_SCORE) {
      return 'guarded';
    }
    return 'normal';
  }

  private isFutureTimestamp(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp > Date.now();
  }

  private clearExpiredManualMode(row: SuspiciousUserRow): SuspiciousUserRow {
    const manualMode = this.normalizeManualMode(row.manual_mode);
    if (manualMode === 'auto') {
      return row;
    }

    if (this.isFutureTimestamp(row.manual_mode_until)) {
      return row;
    }

    const updatedAt = new Date().toISOString();
    this.db.prepare(`
      UPDATE suspicious_users
      SET manual_mode = 'auto',
          manual_mode_until = NULL,
          manual_note = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(updatedAt, row.id);

    return {
      ...row,
      manual_mode: 'auto',
      manual_mode_until: null,
      manual_note: null,
      updated_at: updatedAt,
    };
  }

  private toEffectiveState(row: SuspiciousUserRow): ConductState {
    const syncedRow = this.clearExpiredManualMode(row);
    const manualMode = this.normalizeManualMode(syncedRow.manual_mode);

    if (manualMode === 'force_normal') {
      return 'normal';
    }

    if (manualMode === 'force_silent') {
      return 'silent';
    }

    if (syncedRow.is_active !== 1) {
      return 'normal';
    }

    const storedState = this.normalizeStoredState(syncedRow);
    if (storedState === 'silent') {
      return this.isFutureTimestamp(syncedRow.silent_until) ? 'silent' : 'final_warning';
    }

    return storedState;
  }

  private shouldReplyForState(state: ConductState): boolean {
    return state !== 'silent';
  }

  private hydrateUser(row: SuspiciousUserRow): SuspiciousUser {
    const effectiveState = this.toEffectiveState(row);

    return {
      id: row.id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      username: row.username || undefined,
      reason: row.reason || 'Inappropriate message',
      flaggedAt: row.flagged_at,
      offenseCount: Number(row.offense_count) || 0,
      isActive: row.is_active === 1,
      lastOffenseAt: row.last_offense_at,
      conductScore: Number(row.conduct_score ?? row.offense_count ?? 0),
      conductState: effectiveState,
      shouldReply: this.shouldReplyForState(effectiveState),
      responseStyle: effectiveState,
      silentUntil: row.silent_until || null,
      manualMode: this.normalizeManualMode(row.manual_mode),
      manualModeUntil: row.manual_mode_until || null,
      manualNote: row.manual_note || null,
      lastAction: row.last_action || null,
      lastSource: row.last_source || null,
    };
  }

  private loadRow(platform: string, platformUserId: string): SuspiciousUserRow | null {
    const row = this.db.prepare(`
      SELECT *
      FROM suspicious_users
      WHERE platform = ? AND platform_user_id = ?
    `).get(platform, platformUserId) as SuspiciousUserRow | undefined;

    return row || null;
  }

  private calculateNewState(score: number): ConductState {
    if (score >= SILENT_SCORE) {
      return 'silent';
    }
    if (score >= FINAL_WARNING_SCORE) {
      return 'final_warning';
    }
    if (score >= GUARDED_SCORE) {
      return 'guarded';
    }
    return 'normal';
  }

  private calculateScoreDelta(options?: FlagUserOptions): number {
    if (options?.severity === 'high' || options?.action === 'block_message') {
      return 2;
    }
    return 1;
  }

  private calculateSilentHours(existing: SuspiciousUserRow | null, offenseCount: number): number {
    if (existing?.conduct_state === 'silent' || this.isFutureTimestamp(existing?.silent_until) || offenseCount >= 5) {
      return REPEAT_SILENT_HOURS;
    }
    return FIRST_SILENT_HOURS;
  }

  private recordEvent(params: {
    userId: string | null;
    platform: string;
    platformUserId: string;
    eventType: ConductEvent['eventType'];
    stateBefore: ConductState;
    stateAfter: ConductState;
    scoreDelta: number;
    offenseCount: number;
    reason: string;
    source?: string | null;
    messageExcerpt?: string | null;
  }): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO suspicious_user_events (
        id,
        user_id,
        platform,
        platform_user_id,
        event_type,
        state_before,
        state_after,
        score_delta,
        offense_count,
        reason,
        source,
        message_excerpt,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      params.userId,
      params.platform,
      params.platformUserId,
      params.eventType,
      params.stateBefore,
      params.stateAfter,
      params.scoreDelta,
      params.offenseCount,
      params.reason,
      params.source || null,
      params.messageExcerpt || null,
      now,
    );
  }

  checkSuspicious(platform: string, platformUserId: string): SuspiciousCheckResult {
    const row = this.loadRow(platform, platformUserId);
    if (!row) {
      return { isSuspicious: false, conductState: 'normal', shouldReply: true, responseStyle: 'normal' };
    }

    const user = this.hydrateUser(row);
    if (!user.isActive && user.manualMode === 'auto') {
      return { isSuspicious: false, conductState: 'normal', shouldReply: true, responseStyle: 'normal' };
    }

    return {
      isSuspicious: true,
      offenseCount: user.offenseCount,
      reason: user.reason,
      lastOffenseAt: user.lastOffenseAt,
      conductScore: user.conductScore,
      conductState: user.conductState,
      shouldReply: user.shouldReply,
      responseStyle: user.responseStyle,
      silentUntil: user.silentUntil,
      manualMode: user.manualMode,
      manualModeUntil: user.manualModeUntil,
      manualNote: user.manualNote,
    };
  }

  flagUser(platform: string, platformUserId: string, reason: string, options?: FlagUserOptions): SuspiciousUser {
    const now = new Date().toISOString();
    const existing = this.loadRow(platform, platformUserId);
    const stateBefore = existing ? this.toEffectiveState(existing) : 'normal';
    const scoreDelta = this.calculateScoreDelta(options);
    const offenseCount = (Number(existing?.offense_count) || 0) + 1;
    const currentScore = Number(existing?.conduct_score ?? existing?.offense_count ?? 0) || 0;
    const nextScore = currentScore + scoreDelta;
    const nextState = this.calculateNewState(nextScore);
    const silentUntil = nextState === 'silent'
      ? new Date(Date.now() + (this.calculateSilentHours(existing, offenseCount) * 60 * 60 * 1000)).toISOString()
      : null;

    let userId = existing?.id || randomUUID();

    if (existing) {
      this.db.prepare(`
        UPDATE suspicious_users SET
          reason = ?,
          offense_count = ?,
          is_active = 1,
          last_offense_at = ?,
          updated_at = ?,
          conduct_state = ?,
          conduct_score = ?,
          silent_until = ?,
          last_action = ?,
          last_source = ?
        WHERE id = ?
      `).run(
        reason,
        offenseCount,
        now,
        now,
        nextState,
        nextScore,
        silentUntil,
        options?.action || null,
        options?.source || null,
        userId,
      );
    } else {
      this.db.prepare(`
        INSERT INTO suspicious_users (
          id,
          platform,
          platform_user_id,
          reason,
          flagged_at,
          offense_count,
          is_active,
          last_offense_at,
          created_at,
          updated_at,
          conduct_state,
          conduct_score,
          silent_until,
          manual_mode,
          manual_mode_until,
          manual_note,
          last_action,
          last_source
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'auto', NULL, NULL, ?, ?)
      `).run(
        userId,
        platform,
        platformUserId,
        reason,
        now,
        offenseCount,
        now,
        now,
        now,
        nextState,
        nextScore,
        silentUntil,
        options?.action || null,
        options?.source || null,
      );
    }

    this.recordEvent({
      userId,
      platform,
      platformUserId,
      eventType: 'violation',
      stateBefore,
      stateAfter: nextState,
      scoreDelta,
      offenseCount,
      reason,
      source: options?.source || null,
      messageExcerpt: options?.messageText || null,
    });

    const updatedRow = this.loadRow(platform, platformUserId);
    if (!updatedRow) {
      throw new Error('Failed to reload suspicious user after update');
    }

    return this.hydrateUser(updatedRow);
  }

  setManualMode(platform: string, platformUserId: string, input: ConductOverrideInput): SuspiciousUser {
    const now = new Date().toISOString();
    const mode = input.mode;
    const durationHours = typeof input.durationHours === 'number' && Number.isFinite(input.durationHours)
      ? Math.max(1, input.durationHours)
      : null;
    const modeUntil = mode === 'auto' || durationHours === null
      ? null
      : new Date(Date.now() + (durationHours * 60 * 60 * 1000)).toISOString();

    const existing = this.loadRow(platform, platformUserId);
    if (!existing && mode === 'auto') {
      throw new Error('Suspicious user not found');
    }

    if (!existing) {
      const userId = randomUUID();
      this.db.prepare(`
        INSERT INTO suspicious_users (
          id,
          platform,
          platform_user_id,
          reason,
          flagged_at,
          offense_count,
          is_active,
          last_offense_at,
          created_at,
          updated_at,
          conduct_state,
          conduct_score,
          silent_until,
          manual_mode,
          manual_mode_until,
          manual_note,
          last_action,
          last_source
        ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'normal', 0, NULL, 'auto', NULL, NULL, NULL, 'admin')
      `).run(
        userId,
        platform,
        platformUserId,
        input.note || 'manual override',
        now,
        now,
        now,
        now,
      );
    }

    const targetRow = existing || this.loadRow(platform, platformUserId);
    if (!targetRow) {
      throw new Error('Failed to create conduct override');
    }

    const stateBefore = this.toEffectiveState(targetRow);

    this.db.prepare(`
      UPDATE suspicious_users SET
        is_active = CASE WHEN ? = 'force_normal' THEN is_active ELSE 1 END,
        manual_mode = ?,
        manual_mode_until = ?,
        manual_note = ?,
        updated_at = ?
      WHERE id = ?
    `).run(mode, mode, modeUntil, input.note || null, now, targetRow.id);

    const updatedRow = this.loadRow(platform, platformUserId);
    if (!updatedRow) {
      throw new Error('Failed to reload suspicious user after override');
    }

    const user = this.hydrateUser(updatedRow);
    this.recordEvent({
      userId: targetRow.id,
      platform,
      platformUserId,
      eventType: 'manual_override',
      stateBefore,
      stateAfter: user.conductState,
      scoreDelta: 0,
      offenseCount: user.offenseCount,
      reason: input.note || `manual_mode:${mode}`,
      source: 'admin',
    });

    return user;
  }

  unflagUser(platform: string, platformUserId: string): boolean {
    const now = new Date().toISOString();
    const existing = this.loadRow(platform, platformUserId);
    if (!existing) {
      return false;
    }

    const stateBefore = this.toEffectiveState(existing);
    const result = this.db.prepare(`
      UPDATE suspicious_users SET
        is_active = 0,
        offense_count = 0,
        conduct_score = 0,
        conduct_state = 'normal',
        silent_until = NULL,
        manual_mode = 'auto',
        manual_mode_until = NULL,
        manual_note = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(now, existing.id);

    if (result.changes > 0) {
      this.recordEvent({
        userId: existing.id,
        platform,
        platformUserId,
        eventType: 'manual_reset',
        stateBefore,
        stateAfter: 'normal',
        scoreDelta: 0,
        offenseCount: 0,
        reason: 'manual reset',
        source: 'admin',
      });
    }

    return result.changes > 0;
  }

  getSuspiciousUsers(platform?: string): SuspiciousUser[] {
    let query = `
      SELECT s.*, c.name as username
      FROM suspicious_users s
      LEFT JOIN instagram_customers c ON s.platform = 'instagram' AND s.platform_user_id = c.instagram_id
      WHERE s.is_active = 1 OR COALESCE(s.manual_mode, 'auto') != 'auto'
    `;
    const params: unknown[] = [];

    if (platform) {
      query += ' AND s.platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY s.last_offense_at DESC';

    const rows = this.db.prepare(query).all(...params) as SuspiciousUserRow[];
    return rows.map(row => this.hydrateUser(row));
  }

  getConductEvents(platform: string, platformUserId: string, limit: number = 20): ConductEvent[] {
    const rows = this.db.prepare(`
      SELECT *
      FROM suspicious_user_events
      WHERE platform = ? AND platform_user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(platform, platformUserId, limit) as Array<{
      id: string;
      platform: 'instagram' | 'whatsapp';
      platform_user_id: string;
      event_type: ConductEvent['eventType'];
      state_before: ConductState;
      state_after: ConductState;
      score_delta: number;
      offense_count: number;
      reason: string;
      source: string | null;
      message_excerpt: string | null;
      created_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      eventType: row.event_type,
      stateBefore: row.state_before,
      stateAfter: row.state_after,
      scoreDelta: Number(row.score_delta) || 0,
      offenseCount: Number(row.offense_count) || 0,
      reason: row.reason,
      source: row.source || undefined,
      messageExcerpt: row.message_excerpt || undefined,
      createdAt: row.created_at,
    }));
  }

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
        createdAt: row.created_at,
      }));
    }

    if (platform === 'whatsapp') {
      const rows = this.db.prepare(`
        SELECT id, direction, message_text, ai_response, created_at
        FROM whatsapp_interactions
        WHERE phone = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(platformUserId, limit) as any[];

      return rows.map(row => ({
        id: row.id,
        direction: row.direction,
        messageText: row.message_text,
        aiResponse: row.ai_response || undefined,
        createdAt: row.created_at,
      }));
    }

    return [];
  }
}
