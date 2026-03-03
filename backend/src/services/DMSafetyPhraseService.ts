import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { evaluateSexualIntent } from '../middleware/sexualIntentFilter.js';
import type { SexualIntentDecision } from '../middleware/sexualIntentFilter.js';
import { TelegramNotificationService } from './TelegramNotificationService.js';

type ReviewStatus = 'sent' | 'already_pending' | 'disabled' | 'suppressed' | 'not_needed' | 'not_candidate' | 'send_failed';
type ReviewDecision = 'block' | 'allow' | 'detail';

interface DMSafetyPhraseConfig {
  hardBlockPhrases: string[];
  reviewedSafePhrases: string[];
  telegramReviewEnabled: boolean;
  reviewTriggerActions: Array<SexualIntentDecision['action']>;
  maxCandidateChars: number;
  maxCandidateTokens: number;
}

export interface DMSafetyEvaluationResult {
  decision: SexualIntentDecision;
  matchedPhrase: string | null;
  reviewRequest: {
    triggered: boolean;
    status: ReviewStatus;
    reviewId: string | null;
  };
}

interface EvaluateMessageParams {
  messageText: string;
  channel?: 'instagram' | 'workflow_test' | 'intent_debug';
  senderId?: string | null;
  allowReviewAlerts?: boolean;
}

const POLICY_ID = 'dm_safety_phrase_config';
const DEFAULT_CONFIG: DMSafetyPhraseConfig = {
  hardBlockPhrases: [],
  reviewedSafePhrases: [],
  telegramReviewEnabled: true,
  reviewTriggerActions: ['retry_question'],
  maxCandidateChars: 120,
  maxCandidateTokens: 10,
};

function normalizePhrase(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/\u00E7/g, 'c')
    .replace(/\u011F/g, 'g')
    .replace(/\u0131/g, 'i')
    .replace(/\u00F6/g, 'o')
    .replace(/\u015F/g, 's')
    .replace(/\u00FC/g, 'u')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesConfiguredPhrase(normalizedMessage: string, normalizedPhrase: string): boolean {
  if (!normalizedMessage || !normalizedPhrase) {
    return false;
  }

  if (normalizedMessage === normalizedPhrase) {
    return true;
  }

  return ` ${normalizedMessage} `.includes(` ${normalizedPhrase} `);
}

export class DMSafetyPhraseService {
  private db: Database.Database;
  private telegram: TelegramNotificationService | null;
  private cachedConfig: DMSafetyPhraseConfig | null = null;

  constructor(db: Database.Database, telegram?: TelegramNotificationService | null) {
    this.db = db;
    this.telegram = telegram || null;
    this.ensureStorage();
    this.ensureConfigRow();
  }

  async evaluateMessage(params: EvaluateMessageParams): Promise<DMSafetyEvaluationResult> {
    const messageText = typeof params.messageText === 'string' ? params.messageText.trim() : '';
    const normalizedMessage = normalizePhrase(messageText);
    const config = this.loadConfig();

    if (!normalizedMessage) {
      return {
        decision: {
          action: 'allow',
          confidence: 0,
          reason: 'Empty message',
          modelUsed: 'dm-safety-phrase-service',
        },
        matchedPhrase: null,
        reviewRequest: {
          triggered: false,
          status: 'not_needed',
          reviewId: null,
        },
      };
    }

    if (config.reviewedSafePhrases.includes(normalizedMessage)) {
      return {
        decision: {
          action: 'allow',
          confidence: 1,
          reason: 'Exact phrase was previously reviewed as safe by admin.',
          modelUsed: 'reviewed-safe-phrase-list',
        },
        matchedPhrase: normalizedMessage,
        reviewRequest: {
          triggered: false,
          status: 'suppressed',
          reviewId: null,
        },
      };
    }

    const matchedHardBlockPhrase = config.hardBlockPhrases.find((phrase) => (
      matchesConfiguredPhrase(normalizedMessage, phrase)
    )) || null;
    if (matchedHardBlockPhrase) {
      return {
        decision: {
          action: 'block_message',
          confidence: 1,
          reason: 'Matched admin-approved hard-block phrase.',
          modelUsed: 'hard-block-phrase-list',
        },
        matchedPhrase: matchedHardBlockPhrase,
        reviewRequest: {
          triggered: false,
          status: 'not_needed',
          reviewId: null,
        },
      };
    }

    const decision = await evaluateSexualIntent(messageText);
    const reviewRequest = await this.maybeQueuePhraseReview({
      originalMessage: messageText,
      normalizedMessage,
      decision,
      channel: params.channel || 'instagram',
      senderId: params.senderId || null,
      allowReviewAlerts: params.allowReviewAlerts !== false,
      config,
    });

    return {
      decision,
      matchedPhrase: null,
      reviewRequest,
    };
  }

  handleReviewDecision(reviewId: string, decision: ReviewDecision): string {
    const review = this.db.prepare(`
      SELECT id, original_phrase, normalized_phrase, ai_action, ai_confidence, ai_reason, review_status
      FROM dm_safety_phrase_reviews
      WHERE id = ?
    `).get(reviewId) as {
      id: string;
      original_phrase: string;
      normalized_phrase: string;
      ai_action: string;
      ai_confidence: number;
      ai_reason: string | null;
      review_status: 'pending' | 'approved' | 'rejected';
    } | undefined;

    if (!review) {
      return 'Phrase review not found.';
    }

    if (decision === 'detail') {
      return [
        `Phrase: "${review.original_phrase}"`,
        `AI action: ${review.ai_action}`,
        `Confidence: ${Number(review.ai_confidence || 0).toFixed(2)}`,
        `Reason: ${review.ai_reason || 'No reason provided.'}`,
        `Status: ${review.review_status}`,
      ].join('\n');
    }

    if (review.review_status !== 'pending') {
      return `Phrase review already handled (${review.review_status}).`;
    }

    const config = this.loadConfig();
    const now = new Date().toISOString();

    if (decision === 'block') {
      const hardBlockSet = new Set(config.hardBlockPhrases);
      hardBlockSet.add(review.normalized_phrase);
      const safeSet = new Set(config.reviewedSafePhrases);
      safeSet.delete(review.normalized_phrase);

      this.saveConfig({
        ...config,
        hardBlockPhrases: [...hardBlockSet],
        reviewedSafePhrases: [...safeSet],
      });

      this.db.prepare(`
        UPDATE dm_safety_phrase_reviews
        SET review_status = 'approved', reviewed_at = ?, reviewed_by = 'telegram_admin'
        WHERE id = ?
      `).run(now, reviewId);

      this.logEvent('dm_safety_review_approved', `Hard-block phrase added: ${review.normalized_phrase}`, {
        reviewId,
        phrase: review.original_phrase,
      });

      return `"${review.original_phrase}" added to instant hard-block list. Future matches will be blocked.`;
    }

    const safeSet = new Set(config.reviewedSafePhrases);
    safeSet.add(review.normalized_phrase);
    this.saveConfig({
      ...config,
      reviewedSafePhrases: [...safeSet],
    });

    this.db.prepare(`
      UPDATE dm_safety_phrase_reviews
      SET review_status = 'rejected', reviewed_at = ?, reviewed_by = 'telegram_admin'
      WHERE id = ?
    `).run(now, reviewId);

    this.logEvent('dm_safety_review_rejected', `Phrase marked safe: ${review.normalized_phrase}`, {
      reviewId,
      phrase: review.original_phrase,
    });

    return `"${review.original_phrase}" marked safe. The exact same phrase will no longer trigger admin review.`;
  }

  private async maybeQueuePhraseReview(params: {
    originalMessage: string;
    normalizedMessage: string;
    decision: SexualIntentDecision;
    channel: string;
    senderId: string | null;
    allowReviewAlerts: boolean;
    config: DMSafetyPhraseConfig;
  }): Promise<DMSafetyEvaluationResult['reviewRequest']> {
    const { originalMessage, normalizedMessage, decision, channel, senderId, allowReviewAlerts, config } = params;

    if (!allowReviewAlerts) {
      return { triggered: false, status: 'disabled', reviewId: null };
    }

    if (!config.telegramReviewEnabled || !this.telegram?.isEnabled()) {
      return { triggered: false, status: 'disabled', reviewId: null };
    }

    if (!config.reviewTriggerActions.includes(decision.action)) {
      return { triggered: false, status: 'not_needed', reviewId: null };
    }

    if (!this.isCandidatePhrase(normalizedMessage, config)) {
      return { triggered: false, status: 'not_candidate', reviewId: null };
    }

    if (config.reviewedSafePhrases.includes(normalizedMessage) || config.hardBlockPhrases.includes(normalizedMessage)) {
      return { triggered: false, status: 'suppressed', reviewId: null };
    }

    const existingPending = this.db.prepare(`
      SELECT id FROM dm_safety_phrase_reviews
      WHERE normalized_phrase = ? AND review_status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(normalizedMessage) as { id: string } | undefined;

    if (existingPending) {
      return {
        triggered: false,
        status: 'already_pending',
        reviewId: existingPending.id,
      };
    }

    const reviewId = `DMR-${randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO dm_safety_phrase_reviews (
        id, channel, customer_id, original_phrase, normalized_phrase,
        ai_action, ai_confidence, ai_reason, review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      reviewId,
      channel,
      senderId,
      originalMessage,
      normalizedMessage,
      decision.action,
      decision.confidence,
      decision.reason,
      now,
    );

    const sent = await this.telegram.notifySafetyPhraseReview({
      reviewId,
      phrase: originalMessage,
      normalizedPhrase: normalizedMessage,
      aiAction: decision.action,
      confidence: decision.confidence,
      reason: decision.reason,
      customerId: senderId || undefined,
      channel,
    });

    if (!sent) {
      this.db.prepare('DELETE FROM dm_safety_phrase_reviews WHERE id = ?').run(reviewId);
      return {
        triggered: false,
        status: 'send_failed',
        reviewId: null,
      };
    }

    this.logEvent('dm_safety_review_created', `Admin review requested for phrase: ${normalizedMessage}`, {
      reviewId,
      channel,
      senderId,
      aiAction: decision.action,
      confidence: decision.confidence,
    });

    return {
      triggered: true,
      status: 'sent',
      reviewId,
    };
  }

  private isCandidatePhrase(normalizedMessage: string, config: DMSafetyPhraseConfig): boolean {
    if (!normalizedMessage) return false;
    if (normalizedMessage.length > config.maxCandidateChars) return false;

    const tokenCount = normalizedMessage.split(' ').filter(Boolean).length;
    return tokenCount > 0 && tokenCount <= config.maxCandidateTokens;
  }

  private ensureStorage(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dm_safety_phrase_reviews (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL DEFAULT 'instagram',
        customer_id TEXT,
        original_phrase TEXT NOT NULL,
        normalized_phrase TEXT NOT NULL,
        ai_action TEXT NOT NULL,
        ai_confidence REAL NOT NULL DEFAULT 0,
        ai_reason TEXT,
        review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending', 'approved', 'rejected')),
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by TEXT
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_dm_safety_phrase_reviews_status ON dm_safety_phrase_reviews(review_status, created_at)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_dm_safety_phrase_reviews_phrase ON dm_safety_phrase_reviews(normalized_phrase)');
  }

  private ensureConfigRow(): void {
    const existing = this.db.prepare('SELECT id FROM mc_policies WHERE id = ?').get(POLICY_ID);
    if (existing) return;

    this.db.prepare(`
      INSERT INTO mc_policies (id, name, type, conditions, actions, is_active, priority, created_at, updated_at)
      VALUES (?, ?, 'guardrail', ?, '{}', 1, 0, datetime('now'), datetime('now'))
    `).run(
      POLICY_ID,
      'DM Safety Phrase Config',
      JSON.stringify(DEFAULT_CONFIG),
    );
  }

  private loadConfig(): DMSafetyPhraseConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const row = this.db.prepare('SELECT conditions FROM mc_policies WHERE id = ?').get(POLICY_ID) as { conditions?: string | null } | undefined;

    try {
      const parsed = row?.conditions ? JSON.parse(row.conditions) as Partial<DMSafetyPhraseConfig> : {};
      this.cachedConfig = {
        hardBlockPhrases: this.normalizePhraseList(parsed.hardBlockPhrases),
        reviewedSafePhrases: this.normalizePhraseList(parsed.reviewedSafePhrases),
        telegramReviewEnabled: parsed.telegramReviewEnabled !== false,
        reviewTriggerActions: this.normalizeTriggerActions(parsed.reviewTriggerActions),
        maxCandidateChars: Number.isFinite(parsed.maxCandidateChars) ? Number(parsed.maxCandidateChars) : DEFAULT_CONFIG.maxCandidateChars,
        maxCandidateTokens: Number.isFinite(parsed.maxCandidateTokens) ? Number(parsed.maxCandidateTokens) : DEFAULT_CONFIG.maxCandidateTokens,
      };
    } catch {
      this.cachedConfig = { ...DEFAULT_CONFIG };
    }

    return this.cachedConfig;
  }

  private saveConfig(config: DMSafetyPhraseConfig): void {
    const normalizedConfig: DMSafetyPhraseConfig = {
      hardBlockPhrases: this.normalizePhraseList(config.hardBlockPhrases),
      reviewedSafePhrases: this.normalizePhraseList(config.reviewedSafePhrases),
      telegramReviewEnabled: config.telegramReviewEnabled !== false,
      reviewTriggerActions: this.normalizeTriggerActions(config.reviewTriggerActions),
      maxCandidateChars: Number.isFinite(config.maxCandidateChars) ? config.maxCandidateChars : DEFAULT_CONFIG.maxCandidateChars,
      maxCandidateTokens: Number.isFinite(config.maxCandidateTokens) ? config.maxCandidateTokens : DEFAULT_CONFIG.maxCandidateTokens,
    };

    this.db.prepare(`
      UPDATE mc_policies
      SET conditions = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(normalizedConfig), POLICY_ID);

    this.cachedConfig = normalizedConfig;
  }

  private normalizePhraseList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    const seen = new Set<string>();
    for (const value of values) {
      const normalized = normalizePhrase(String(value ?? ''));
      if (normalized) {
        seen.add(normalized);
      }
    }

    return [...seen];
  }

  private normalizeTriggerActions(values: unknown): Array<SexualIntentDecision['action']> {
    if (!Array.isArray(values)) {
      return [...DEFAULT_CONFIG.reviewTriggerActions];
    }

    const normalized = values
      .map((value) => String(value ?? '').trim())
      .filter((value): value is SexualIntentDecision['action'] => (
        value === 'allow' || value === 'retry_question' || value === 'block_message'
      ));

    return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_CONFIG.reviewTriggerActions];
  }

  private logEvent(eventType: string, message: string, metadata: Record<string, unknown>): void {
    try {
      this.db.prepare(`
        INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
        VALUES ('system', ?, ?, ?, ?)
      `).run('dm-safety', eventType, message, JSON.stringify(metadata));
    } catch {
      // Non-fatal in tests or minimal schemas.
    }
  }
}
