import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  Massage,
  MassageInput,
  SurveyTemplate,
  SurveyTemplateInput,
  SurveyResponse,
  SurveyResponseInput,
  KioskState,
  KioskStateUpdate,
  SystemSettings,
  SystemSettingsUpdate,
  SystemLog,
  SystemLogInput,
} from './types.js';

/**
 * DatabaseService class for managing all database operations
 * Uses better-sqlite3 with WAL mode for concurrent access
 */
export class DatabaseService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Execute a function within a transaction
   * Ensures atomicity for multi-step operations
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  // ==================== MASSAGE OPERATIONS ====================

  /**
   * Get all massages ordered by sort_order
   */
  getMassages(): Massage[] {
    const rows = this.db
      .prepare('SELECT * FROM massages ORDER BY sort_order ASC, created_at DESC')
      .all() as any[];

    return rows.map(this.parseMassageRow);
  }

  /**
   * Get a single massage by ID
   */
  getMassageById(id: string): Massage | null {
    const row = this.db
      .prepare('SELECT * FROM massages WHERE id = ?')
      .get(id) as any;

    return row ? this.parseMassageRow(row) : null;
  }

  /**
   * Create a new massage
   */
  createMassage(data: MassageInput): Massage {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO massages (
          id, name, short_description, long_description, duration,
          media_type, media_url, purpose_tags, sessions,
          is_featured, is_campaign, layout_template, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.name,
        data.short_description,
        data.long_description || null,
        data.duration || null,
        data.media_type || null,
        data.media_url || null,
        JSON.stringify(data.purpose_tags || []),
        JSON.stringify(data.sessions || []),
        data.is_featured ? 1 : 0,
        data.is_campaign ? 1 : 0,
        data.layout_template || 'price-list',
        data.sort_order || 0,
        now,
        now
      );

    return this.getMassageById(id)!;
  }

  /**
   * Update an existing massage
   */
  updateMassage(id: string, data: Partial<MassageInput>): Massage {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.short_description !== undefined) {
      updates.push('short_description = ?');
      values.push(data.short_description);
    }
    if (data.long_description !== undefined) {
      updates.push('long_description = ?');
      values.push(data.long_description);
    }
    if (data.duration !== undefined) {
      updates.push('duration = ?');
      values.push(data.duration);
    }
    if (data.media_type !== undefined) {
      updates.push('media_type = ?');
      values.push(data.media_type);
    }
    if (data.media_url !== undefined) {
      updates.push('media_url = ?');
      values.push(data.media_url);
    }
    if (data.purpose_tags !== undefined) {
      updates.push('purpose_tags = ?');
      values.push(JSON.stringify(data.purpose_tags));
    }
    if (data.sessions !== undefined) {
      updates.push('sessions = ?');
      values.push(JSON.stringify(data.sessions));
    }
    if (data.is_featured !== undefined) {
      updates.push('is_featured = ?');
      values.push(data.is_featured ? 1 : 0);
    }
    if (data.is_campaign !== undefined) {
      updates.push('is_campaign = ?');
      values.push(data.is_campaign ? 1 : 0);
    }
    if (data.layout_template !== undefined) {
      updates.push('layout_template = ?');
      values.push(data.layout_template || 'price-list');
    }
    if (data.sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(data.sort_order);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE massages SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);

    return this.getMassageById(id)!;
  }

  /**
   * Delete a massage
   */
  deleteMassage(id: string): void {
    this.db.prepare('DELETE FROM massages WHERE id = ?').run(id);
  }

  private parseMassageRow(row: any): Massage {
    return {
      ...row,
      purpose_tags: JSON.parse(row.purpose_tags || '[]'),
      sessions: JSON.parse(row.sessions || '[]'),
      layout_template: row.layout_template || 'price-list',
    };
  }

  // ==================== SURVEY TEMPLATE OPERATIONS ====================

  /**
   * Get all survey templates
   */
  getSurveyTemplates(): SurveyTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM survey_templates ORDER BY created_at DESC')
      .all() as any[];

    return rows.map(this.parseSurveyTemplateRow);
  }

  /**
   * Get a single survey template by ID
   */
  getSurveyById(id: string): SurveyTemplate | null {
    const row = this.db
      .prepare('SELECT * FROM survey_templates WHERE id = ?')
      .get(id) as any;

    return row ? this.parseSurveyTemplateRow(row) : null;
  }

  /**
   * Create a new survey template
   */
  createSurvey(data: SurveyTemplateInput): SurveyTemplate {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO survey_templates (
          id, name, type, title, description, questions, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.name || 'New Survey',
        data.type || 'satisfaction',
        data.title || 'New Survey',
        data.description || null,
        JSON.stringify(data.questions || []),
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
        now,
        now
      );

    return this.getSurveyById(id)!;
  }

  /**
   * Update a survey template
   */
  updateSurvey(id: string, data: SurveyTemplateInput): SurveyTemplate {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.questions !== undefined) {
      updates.push('questions = ?');
      values.push(JSON.stringify(data.questions));
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db
      .prepare(`UPDATE survey_templates SET ${updates.join(', ')} WHERE id = ?`)
      .run(...values);

    return this.getSurveyById(id)!;
  }

  /**
   * Delete a survey template
   */
  deleteSurvey(id: string): void {
    this.db.prepare('DELETE FROM survey_templates WHERE id = ?').run(id);
  }

  private parseSurveyTemplateRow(row: any): SurveyTemplate {
    return {
      ...row,
      questions: JSON.parse(row.questions || '[]'),
    };
  }

  // ==================== SURVEY RESPONSE OPERATIONS ====================

  /**
   * Create a new survey response
   */
  createSurveyResponse(data: SurveyResponseInput): SurveyResponse {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO survey_responses (
          id, survey_id, answers, synced, sync_attempts, created_at
        ) VALUES (?, ?, ?, 0, 0, ?)`
      )
      .run(id, data.survey_id, JSON.stringify(data.answers), now);

    return this.getSurveyResponseById(id)!;
  }

  /**
   * Get a single survey response by ID
   */
  getSurveyResponseById(id: string): SurveyResponse | null {
    const row = this.db
      .prepare('SELECT * FROM survey_responses WHERE id = ?')
      .get(id) as any;

    return row ? this.parseSurveyResponseRow(row) : null;
  }

  /**
   * Get survey responses with optional filters
   */
  getSurveyResponses(filters?: {
    surveyId?: string;
    synced?: boolean;
    startDate?: string;
    endDate?: string;
  }): SurveyResponse[] {
    let query = 'SELECT * FROM survey_responses WHERE 1=1';
    const params: any[] = [];

    if (filters?.surveyId) {
      query += ' AND survey_id = ?';
      params.push(filters.surveyId);
    }

    if (filters?.synced !== undefined) {
      query += ' AND synced = ?';
      params.push(filters.synced ? 1 : 0);
    }

    if (filters?.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.parseSurveyResponseRow(row));
  }

  /**
   * Delete survey responses by survey ID
   */
  deleteSurveyResponses(surveyId: string): number {
    const result = this.db
      .prepare('DELETE FROM survey_responses WHERE survey_id = ?')
      .run(surveyId);
    return result.changes;
  }

  /**
   * Delete all survey responses
   */
  deleteAllSurveyResponses(): number {
    const result = this.db
      .prepare('DELETE FROM survey_responses')
      .run();
    return result.changes;
  }

  /**
   * Update survey response sync status
   */
  updateSurveyResponseSyncStatus(
    id: string,
    synced: boolean,
    incrementAttempts: boolean = false
  ): void {
    const now = new Date().toISOString();

    if (synced) {
      this.db
        .prepare(
          `UPDATE survey_responses 
           SET synced = 1, last_sync_attempt = ? 
           WHERE id = ?`
        )
        .run(now, id);
    } else if (incrementAttempts) {
      this.db
        .prepare(
          `UPDATE survey_responses 
           SET sync_attempts = sync_attempts + 1, last_sync_attempt = ? 
           WHERE id = ?`
        )
        .run(now, id);
    }
  }

  private parseSurveyResponseRow(row: any): SurveyResponse {
    return {
      ...row,
      answers: JSON.parse(row.answers || '{}'),
    };
  }

  // ==================== KIOSK STATE OPERATIONS ====================

  /**
   * Get current kiosk state
   */
  getKioskState(): KioskState {
    const row = this.db
      .prepare('SELECT * FROM kiosk_state WHERE id = 1')
      .get() as any;

    if (!row) {
      throw new Error('Kiosk state not initialized');
    }

    return row;
  }

  /**
   * Update kiosk state
   */
  updateKioskState(data: KioskStateUpdate): KioskState {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.mode !== undefined) {
      updates.push('mode = ?');
      values.push(data.mode);
    }

    if (data.active_survey_id !== undefined) {
      updates.push('active_survey_id = ?');
      values.push(data.active_survey_id);
    }

    updates.push('updated_at = ?');
    values.push(now);

    this.db
      .prepare(`UPDATE kiosk_state SET ${updates.join(', ')} WHERE id = 1`)
      .run(...values);

    return this.getKioskState();
  }

  /**
   * Update kiosk heartbeat timestamp
   */
  updateKioskHeartbeat(): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE kiosk_state SET last_heartbeat = ? WHERE id = 1')
      .run(now);
  }

  // ==================== SYSTEM SETTINGS OPERATIONS ====================

  /**
   * Get system settings
   */
  getSettings(): SystemSettings {
    const row = this.db
      .prepare('SELECT * FROM system_settings WHERE id = 1')
      .get() as any;

    if (!row) {
      throw new Error('System settings not initialized');
    }

    return row;
  }

  /**
   * Update system settings
   */
  updateSettings(data: SystemSettingsUpdate): SystemSettings {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.slideshow_timeout !== undefined) {
      updates.push('slideshow_timeout = ?');
      values.push(data.slideshow_timeout);
    }
    if (data.survey_timeout !== undefined) {
      updates.push('survey_timeout = ?');
      values.push(data.survey_timeout);
    }
    if (data.google_qr_display_duration !== undefined) {
      updates.push('google_qr_display_duration = ?');
      values.push(data.google_qr_display_duration);
    }
    if (data.google_review_url !== undefined) {
      updates.push('google_review_url = ?');
      values.push(data.google_review_url);
    }
    if (data.google_review_title !== undefined) {
      updates.push('google_review_title = ?');
      values.push(data.google_review_title);
    }
    if (data.google_review_description !== undefined) {
      updates.push('google_review_description = ?');
      values.push(data.google_review_description);
    }
    if (data.kiosk_theme !== undefined) {
      updates.push('kiosk_theme = ?');
      values.push(data.kiosk_theme);
    }
    if (data.sheets_sheet_id !== undefined) {
      updates.push('sheets_sheet_id = ?');
      values.push(data.sheets_sheet_id);
    }
    if (data.sheets_sheet_name !== undefined) {
      updates.push('sheets_sheet_name = ?');
      values.push(data.sheets_sheet_name);
    }
    if (data.sheets_credentials !== undefined) {
      updates.push('sheets_credentials = ?');
      values.push(data.sheets_credentials);
    }
    if (data.admin_password_hash !== undefined) {
      updates.push('admin_password_hash = ?');
      values.push(data.admin_password_hash);
    }

    updates.push('updated_at = ?');
    values.push(now);

    this.db
      .prepare(`UPDATE system_settings SET ${updates.join(', ')} WHERE id = 1`)
      .run(...values);

    return this.getSettings();
  }

  // ==================== SYSTEM LOGGING OPERATIONS ====================

  /**
   * Create a system log entry
   */
  createLog(data: SystemLogInput): SystemLog {
    const now = new Date().toISOString();

    const result = this.db
      .prepare(
        `INSERT INTO system_logs (level, message, details, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        data.level,
        data.message,
        data.details ? JSON.stringify(data.details) : null,
        now
      );

    return this.getLogById(result.lastInsertRowid as number)!;
  }

  /**
   * Get a single log entry by ID
   */
  getLogById(id: number): SystemLog | null {
    const row = this.db
      .prepare('SELECT * FROM system_logs WHERE id = ?')
      .get(id) as any;

    return row ? this.parseLogRow(row) : null;
  }

  /**
   * Get system logs with optional filters
   */
  getLogs(filters?: {
    level?: 'info' | 'warn' | 'error';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): SystemLog[] {
    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.level) {
      query += ' AND level = ?';
      params.push(filters.level);
    }

    if (filters?.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.parseLogRow);
  }

  private parseLogRow(row: any): SystemLog {
    return {
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
