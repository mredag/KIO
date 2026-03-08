import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../middleware/sexualIntentFilter.js', () => ({
  evaluateSexualIntent: vi.fn(),
}));

import { evaluateSexualIntent } from '../middleware/sexualIntentFilter.js';
import { DMSafetyPhraseService } from './DMSafetyPhraseService.js';

interface PolicyRow {
  id: string;
  conditions: string;
}

interface ReviewRow {
  id: string;
  channel: string;
  customer_id: string | null;
  original_phrase: string;
  normalized_phrase: string;
  ai_action: string;
  ai_confidence: number;
  ai_reason: string;
  review_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

class FakeDb {
  policies = new Map<string, PolicyRow>();
  reviews = new Map<string, ReviewRow>();
  events: Array<Record<string, unknown>> = [];

  exec(_sql: string): void {
    // No-op for CREATE TABLE / CREATE INDEX in tests.
  }

  prepare(sql: string): { get?: (...args: any[]) => any; run?: (...args: any[]) => any } {
    const compact = sql.replace(/\s+/g, ' ').trim();

    if (compact.startsWith('SELECT id FROM mc_policies WHERE id = ?')) {
      return {
        get: (id: string) => (this.policies.has(id) ? { id } : undefined),
      };
    }

    if (compact.startsWith('INSERT INTO mc_policies')) {
      return {
        run: (id: string, _name: string, conditions: string) => {
          this.policies.set(id, { id, conditions });
          return { changes: 1 };
        },
      };
    }

    if (compact.startsWith('SELECT conditions FROM mc_policies WHERE id = ?')) {
      return {
        get: (id: string) => {
          const row = this.policies.get(id);
          return row ? { conditions: row.conditions } : undefined;
        },
      };
    }

    if (compact.startsWith('UPDATE mc_policies SET conditions = ?')) {
      return {
        run: (conditions: string, id: string) => {
          const row = this.policies.get(id);
          if (row) {
            row.conditions = conditions;
          }
          return { changes: row ? 1 : 0 };
        },
      };
    }

    if (compact.includes('SELECT id FROM dm_safety_phrase_reviews') && compact.includes("review_status = 'pending'")) {
      return {
        get: (normalizedPhrase: string) => {
          const pending = [...this.reviews.values()]
            .reverse()
            .find((row) => row.normalized_phrase === normalizedPhrase && row.review_status === 'pending');
          return pending ? { id: pending.id } : undefined;
        },
      };
    }

    if (compact.startsWith('INSERT INTO dm_safety_phrase_reviews')) {
      return {
        run: (
          id: string,
          channel: string,
          customerId: string | null,
          originalPhrase: string,
          normalizedPhrase: string,
          aiAction: string,
          aiConfidence: number,
          aiReason: string,
          createdAt: string,
        ) => {
          this.reviews.set(id, {
            id,
            channel,
            customer_id: customerId,
            original_phrase: originalPhrase,
            normalized_phrase: normalizedPhrase,
            ai_action: aiAction,
            ai_confidence: aiConfidence,
            ai_reason: aiReason,
            review_status: 'pending',
            created_at: createdAt,
            reviewed_at: null,
            reviewed_by: null,
          });
          return { changes: 1 };
        },
      };
    }

    if (compact.startsWith('DELETE FROM dm_safety_phrase_reviews WHERE id = ?')) {
      return {
        run: (id: string) => {
          const existed = this.reviews.delete(id);
          return { changes: existed ? 1 : 0 };
        },
      };
    }

    if (compact.startsWith('SELECT id, original_phrase, normalized_phrase, ai_action, ai_confidence, ai_reason, review_status FROM dm_safety_phrase_reviews')) {
      return {
        get: (id: string) => this.reviews.get(id),
      };
    }

    if (compact.startsWith("UPDATE dm_safety_phrase_reviews SET review_status = 'approved'")) {
      return {
        run: (reviewedAt: string, id: string) => {
          const row = this.reviews.get(id);
          if (row) {
            row.review_status = 'approved';
            row.reviewed_at = reviewedAt;
            row.reviewed_by = 'telegram_admin';
          }
          return { changes: row ? 1 : 0 };
        },
      };
    }

    if (compact.startsWith("UPDATE dm_safety_phrase_reviews SET review_status = 'rejected'")) {
      return {
        run: (reviewedAt: string, id: string) => {
          const row = this.reviews.get(id);
          if (row) {
            row.review_status = 'rejected';
            row.reviewed_at = reviewedAt;
            row.reviewed_by = 'telegram_admin';
          }
          return { changes: row ? 1 : 0 };
        },
      };
    }

    if (compact.startsWith('INSERT INTO mc_events')) {
      return {
        run: (_entityId: string, eventType: string, message: string, metadata: string) => {
          this.events.push({ eventType, message, metadata });
          return { changes: 1 };
        },
      };
    }

    throw new Error(`Unexpected SQL in test: ${compact}`);
  }
}

function createDb(config?: Record<string, unknown>): FakeDb {
  const db = new FakeDb();
  if (config) {
    db.policies.set('dm_safety_phrase_config', {
      id: 'dm_safety_phrase_config',
      conditions: JSON.stringify(config),
    });
  }
  return db;
}

describe('DMSafetyPhraseService', () => {
  beforeEach(() => {
    vi.mocked(evaluateSexualIntent).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hard-blocks immediately when a configured phrase is matched', async () => {
    const db = createDb({
      hardBlockPhrases: ['muamele nasil'],
      reviewedSafePhrases: [],
      telegramReviewEnabled: true,
      reviewTriggerActions: ['retry_question'],
      maxCandidateChars: 120,
      maxCandidateTokens: 10,
    });
    const service = new DMSafetyPhraseService(db as any, null);

    const result = await service.evaluateMessage({
      messageText: 'Bu muamele nasil oluyor?',
      allowReviewAlerts: false,
    });

    expect(result.decision.action).toBe('block_message');
    expect(result.decision.modelUsed).toBe('hard-block-phrase-list');
    expect(result.matchedPhrase).toBe('muamele nasil');
    expect(vi.mocked(evaluateSexualIntent)).not.toHaveBeenCalled();
  });

  it('does not hard-block when a configured phrase only appears inside a larger word', async () => {
    vi.mocked(evaluateSexualIntent).mockResolvedValue({
      action: 'allow',
      confidence: 0.11,
      reason: 'Not inappropriate',
      modelUsed: 'openai/gpt-4o-mini',
    });

    const db = createDb({
      hardBlockPhrases: ['amele'],
      reviewedSafePhrases: [],
      telegramReviewEnabled: true,
      reviewTriggerActions: ['retry_question'],
      maxCandidateChars: 120,
      maxCandidateTokens: 10,
    });
    const service = new DMSafetyPhraseService(db as any, null);

    const result = await service.evaluateMessage({
      messageText: 'muamele nasil',
      allowReviewAlerts: false,
    });

    expect(result.decision.action).toBe('allow');
    expect(result.matchedPhrase).toBeNull();
    expect(vi.mocked(evaluateSexualIntent)).toHaveBeenCalledTimes(1);
  });

  it('allows exact phrases that an admin previously marked safe', async () => {
    const db = createDb({
      hardBlockPhrases: [],
      reviewedSafePhrases: ['muamele nasil'],
      telegramReviewEnabled: true,
      reviewTriggerActions: ['retry_question'],
      maxCandidateChars: 120,
      maxCandidateTokens: 10,
    });
    const service = new DMSafetyPhraseService(db as any, null);

    const result = await service.evaluateMessage({
      messageText: 'muamele nasil',
      allowReviewAlerts: false,
    });

    expect(result.decision.action).toBe('allow');
    expect(result.decision.modelUsed).toBe('reviewed-safe-phrase-list');
    expect(result.reviewRequest.status).toBe('suppressed');
    expect(vi.mocked(evaluateSexualIntent)).not.toHaveBeenCalled();
  });

  it('suppresses Telegram review for benign preparation questions before hitting the classifier', async () => {
    const telegram = {
      isEnabled: vi.fn().mockReturnValue(true),
      notifySafetyPhraseReview: vi.fn().mockResolvedValue(true),
    } as any;

    const db = createDb();
    const service = new DMSafetyPhraseService(db as any, telegram);

    const result = await service.evaluateMessage({
      messageText: 'yanımızda birşey getiriyor muyuz ?',
      channel: 'instagram',
      senderId: 'ig-1',
      allowReviewAlerts: true,
    });

    expect(result.decision.action).toBe('allow');
    expect(result.decision.modelUsed).toBe('dm-safety-benign-preparation-guard');
    expect(result.reviewRequest.triggered).toBe(false);
    expect(result.reviewRequest.status).toBe('suppressed');
    expect(telegram.notifySafetyPhraseReview).not.toHaveBeenCalled();
    expect(vi.mocked(evaluateSexualIntent)).not.toHaveBeenCalled();
  });

  it('creates a Telegram review when AI returns retry_question for a short candidate phrase', async () => {
    vi.mocked(evaluateSexualIntent).mockResolvedValue({
      action: 'retry_question',
      confidence: 0.76,
      reason: 'Ambiguous suspicious phrase',
      modelUsed: 'openai/gpt-4o-mini',
    });

    const telegram = {
      isEnabled: vi.fn().mockReturnValue(true),
      notifySafetyPhraseReview: vi.fn().mockResolvedValue(true),
    } as any;

    const db = createDb();
    const service = new DMSafetyPhraseService(db as any, telegram);

    const result = await service.evaluateMessage({
      messageText: 'muamele nasil',
      channel: 'instagram',
      senderId: 'ig-1',
      allowReviewAlerts: true,
    });

    expect(result.decision.action).toBe('retry_question');
    expect(result.reviewRequest.triggered).toBe(true);
    expect(result.reviewRequest.status).toBe('sent');
    expect(result.reviewRequest.reviewId).toMatch(/^DMR-/);
    expect(telegram.notifySafetyPhraseReview).toHaveBeenCalledTimes(1);

    const review = db.reviews.get(result.reviewRequest.reviewId!);
    expect(review?.review_status).toBe('pending');
    expect(review?.normalized_phrase).toBe('muamele nasil');
  });

  it('suppresses duplicate Telegram reviews while the same phrase is still pending', async () => {
    vi.mocked(evaluateSexualIntent).mockResolvedValue({
      action: 'retry_question',
      confidence: 0.76,
      reason: 'Ambiguous suspicious phrase',
      modelUsed: 'openai/gpt-4o-mini',
    });

    const telegram = {
      isEnabled: vi.fn().mockReturnValue(true),
      notifySafetyPhraseReview: vi.fn().mockResolvedValue(true),
    } as any;

    const db = createDb();
    const service = new DMSafetyPhraseService(db as any, telegram);

    const first = await service.evaluateMessage({
      messageText: 'muamele nasil',
      channel: 'instagram',
      senderId: 'ig-1',
      allowReviewAlerts: true,
    });
    const second = await service.evaluateMessage({
      messageText: 'muamele nasil',
      channel: 'instagram',
      senderId: 'ig-1',
      allowReviewAlerts: true,
    });

    expect(first.reviewRequest.status).toBe('sent');
    expect(second.reviewRequest.triggered).toBe(false);
    expect(second.reviewRequest.status).toBe('already_pending');
    expect(second.reviewRequest.reviewId).toBe(first.reviewRequest.reviewId);
    expect(telegram.notifySafetyPhraseReview).toHaveBeenCalledTimes(1);
    expect(db.reviews.size).toBe(1);
  });

  it('promotes an approved review into the instant hard-block list', async () => {
    vi.mocked(evaluateSexualIntent).mockResolvedValue({
      action: 'retry_question',
      confidence: 0.76,
      reason: 'Ambiguous suspicious phrase',
      modelUsed: 'openai/gpt-4o-mini',
    });

    const telegram = {
      isEnabled: vi.fn().mockReturnValue(true),
      notifySafetyPhraseReview: vi.fn().mockResolvedValue(true),
    } as any;

    const db = createDb();
    const service = new DMSafetyPhraseService(db as any, telegram);

    const first = await service.evaluateMessage({
      messageText: 'muamele nasil',
      channel: 'instagram',
      senderId: 'ig-1',
      allowReviewAlerts: true,
    });

    const response = service.handleReviewDecision(first.reviewRequest.reviewId!, 'block');
    expect(response).toContain('added to instant hard-block list');

    vi.mocked(evaluateSexualIntent).mockClear();

    const second = await service.evaluateMessage({
      messageText: 'bu muamele nasil peki',
      allowReviewAlerts: false,
    });

    expect(second.decision.action).toBe('block_message');
    expect(second.decision.modelUsed).toBe('hard-block-phrase-list');
    expect(vi.mocked(evaluateSexualIntent)).not.toHaveBeenCalled();
  });
});

