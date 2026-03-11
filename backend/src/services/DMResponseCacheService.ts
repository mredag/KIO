import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { normalizeTurkish } from './InstagramContextService.js';
import {
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
  isGenericInfoRequest,
  normalizeTemplateText,
} from './DMPipelineHeuristics.js';
import { hasAgePolicySignals } from './PolicySignalService.js';
import { hasRoomAvailabilitySignals } from './RoomAvailabilitySignalService.js';

export const DM_RESPONSE_CACHE_VERSION = 'v1';
const CACHE_TTL_DAYS = 30;
const PROMOTION_MIN_OBSERVATIONS = 3;
const PROMOTION_MIN_LEAD = 2;

export type DMResponseCacheClass =
  | 'direct_location'
  | 'direct_phone'
  | 'direct_hours'
  | 'general_info'
  | 'gratitude_closeout'
  | 'service_list'
  | 'service_definition'
  | 'topic_price_list'
  | 'exact_price_answer';

export interface DMResponseCacheLookupParams {
  cacheClass: DMResponseCacheClass;
  normalizedMessage: string;
  kbSignature: string;
  configSignature: string;
  conductState: string;
  cacheVersion?: string;
}

export interface DMResponseCacheHit {
  id: string;
  lookupKey: string;
  cacheClass: DMResponseCacheClass;
  responseText: string;
  sourceExecutionId: string | null;
  observationCount: number;
  status: 'candidate' | 'active';
}

export interface DMResponseCacheRecordParams extends DMResponseCacheLookupParams {
  responseText: string;
  sourceExecutionId: string | null;
  observedAt?: string;
}

export interface DMResponseCacheSeedTrace {
  sexualIntent?: {
    action?: 'allow' | 'retry_question' | 'block_message' | string;
  };
  conductControl?: {
    state?: string;
  };
  intentCategories?: string[];
  matchedKeywords?: string[];
  modelTier?: 'light' | 'standard' | 'advanced' | string;
  modelId?: string;
  metaSendStatus?: 'success' | 'fail' | 'skipped' | string;
  openclawSessionKey?: string;
  fastLane?: {
    kind?: string;
  };
  policyValidation?: {
    status?: 'pass' | 'fail' | 'corrected' | 'fallback' | 'skipped' | string;
    attempts?: number;
  };
  directResponse?: {
    used?: boolean;
    modelId?: string;
  };
  conversationHistory?: {
    followUpHint?: {
      topicLabel?: string;
      rewrittenQuestion?: string;
    } | null;
    activeState?: {
      usedForPlanning?: boolean;
      repairedFromState?: boolean;
    } | null;
  };
}

export interface DMResponseCacheSeedCandidateParams {
  messageText: string;
  responseText: string;
  trace: DMResponseCacheSeedTrace | null;
  pipelineError?: unknown;
  configSignature: string;
  kbSignature: string;
  observedAt?: string;
  sourceExecutionId?: string | null;
}

export interface DMResponseCacheSeedResult {
  days: number;
  dryRun: boolean;
  directOnly: boolean;
  kbSignature: string;
  configSignature: string;
  scanned: number;
  eligible: number;
  recorded: number;
  skipped: Record<string, number>;
  stats?: {
    total: number;
    active: number;
    candidate: number;
    classes: Array<{ cacheClass: string; count: number }>;
  };
}

interface CacheRow {
  id: string;
  lookup_key: string;
  cache_class: DMResponseCacheClass;
  response_text: string;
  source_execution_id: string | null;
  observation_count: number;
  status: 'candidate' | 'active';
}

interface HistoricalSeedRow {
  execution_id: string | null;
  inbound_message_text: string | null;
  response_text: string | null;
  pipeline_trace: string | null;
  pipeline_error: string | null;
  created_at: string;
}

type SeedCandidateBuildResult = {
  cacheClass: DMResponseCacheClass;
  record: DMResponseCacheRecordParams;
} | null;

const COMPLAINT_SIGNAL_PATTERN = /\b(?:sikayet|memnun degil|kotu|berbat|rezalet|iade|geri|sorun|problem|complaint)\b/;
const APPOINTMENT_SIGNAL_PATTERN = /\b(?:randevu|rezervasyon|uygun|musait)\b/;

export class DMResponseCacheService {
  private db: Database.Database;
  private static lastSeedSkipReason = 'ineligible';

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTable();
  }

  static normalizeMessage(text: string): string {
    return normalizeTurkish(text.toLocaleLowerCase('tr-TR'))
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static normalizeResponse(text: string): string {
    return text
      .replace(/\r/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static buildSeedCandidate(
    params: DMResponseCacheSeedCandidateParams,
    options?: { directOnly?: boolean },
  ): SeedCandidateBuildResult {
    const markSkipped = (reason: string): null => {
      DMResponseCacheService.lastSeedSkipReason = reason;
      return null;
    };

    const messageText = params.messageText.trim();
    const responseText = DMResponseCacheService.normalizeResponse(params.responseText);
    if (!messageText) {
      return markSkipped('missing_inbound');
    }
    if (!responseText) {
      return markSkipped('missing_response');
    }

    const trace = params.trace;
    if (!trace) {
      return markSkipped('missing_trace');
    }
    if (params.pipelineError) {
      return markSkipped('pipeline_error');
    }

    const cacheClass = DMResponseCacheService.inferCacheClass({
      messageText,
      intentCategories: trace.intentCategories || [],
      matchedKeywords: trace.matchedKeywords || [],
    });
    if (!cacheClass) {
      return markSkipped('unsupported_class');
    }

    const normalizedMessage = normalizeTemplateText(messageText);
    const conductState = String(trace.conductControl?.state || 'normal');
    const sexualAction = String(trace.sexualIntent?.action || 'allow');
    const modelTier = String(trace.modelTier || '');
    const policyStatus = String(trace.policyValidation?.status || '');
    const policyAttempts = Number(trace.policyValidation?.attempts || 0);
    const metaSendStatus = String(trace.metaSendStatus || '');
    const followUpHint = trace.conversationHistory?.followUpHint || null;
    const activeState = trace.conversationHistory?.activeState || null;
    const modelId = String(trace.modelId || trace.directResponse?.modelId || '');
    const directOnly = options?.directOnly !== false;
    const isDirectResponse = trace.directResponse?.used === true
      || trace.openclawSessionKey === 'direct';
    const hasComplaintSignal = (trace.intentCategories || []).includes('complaint')
      || COMPLAINT_SIGNAL_PATTERN.test(normalizedMessage);

    if (conductState !== 'normal') {
      return markSkipped('conduct_state');
    }
    if (sexualAction !== 'allow') {
      return markSkipped('sexual_intent');
    }
    if (metaSendStatus !== 'success') {
      return markSkipped('meta_send');
    }
    if (policyStatus !== 'pass' || policyAttempts !== 1) {
      return markSkipped('policy');
    }
    if (followUpHint || activeState?.usedForPlanning || activeState?.repairedFromState) {
      return markSkipped('follow_up_dependency');
    }
    if (modelTier === 'advanced') {
      return markSkipped('advanced_tier');
    }
    if (hasComplaintSignal) {
      return markSkipped('complaint');
    }
    if (hasAgePolicySignals(messageText, followUpHint?.rewrittenQuestion, null)) {
      return markSkipped('age_policy');
    }
    if (hasRoomAvailabilitySignals(messageText, followUpHint?.rewrittenQuestion, null)) {
      return markSkipped('room_availability');
    }
    if (APPOINTMENT_SIGNAL_PATTERN.test(normalizedMessage)) {
      return markSkipped('reservation');
    }
    if (modelId.startsWith('deterministic/') || modelId.startsWith('cache/')) {
      return markSkipped('non_ai_response');
    }
    if (trace.fastLane?.kind?.startsWith('deterministic')) {
      return markSkipped('non_ai_response');
    }
    if (directOnly && !isDirectResponse) {
      return markSkipped('non_direct');
    }

    DMResponseCacheService.lastSeedSkipReason = 'eligible';
    return {
      cacheClass,
      record: {
        cacheClass,
        normalizedMessage: DMResponseCacheService.normalizeMessage(messageText),
        kbSignature: params.kbSignature,
        configSignature: params.configSignature,
        conductState,
        responseText,
        sourceExecutionId: params.sourceExecutionId || null,
        observedAt: params.observedAt,
      },
    };
  }

  private static inferCacheClass(params: {
    messageText: string;
    intentCategories: string[];
    matchedKeywords: string[];
  }): DMResponseCacheClass | null {
    const normalized = normalizeTemplateText(params.messageText);

    if (params.matchedKeywords.includes('gratitude_message')) {
      return 'gratitude_closeout';
    }
    if (isDirectLocationQuestion(params.messageText)) {
      return 'direct_location';
    }
    if (isDirectPhoneQuestion(params.messageText)) {
      return 'direct_phone';
    }
    if (params.matchedKeywords.includes('standalone_hours_request')) {
      return 'direct_hours';
    }
    if (isGenericInfoRequest(params.messageText)) {
      return 'general_info';
    }
    if (params.intentCategories.includes('services')
      && params.intentCategories.every(category => ['services', 'general', 'faq'].includes(category))
      && /\b(?:nedir|nasil bir|ne ise yarar|detay|detaylari|icerik|icerigi|anlatir misiniz|var mi|neler var)\b/.test(normalized)) {
      return /\bneler var\b/.test(normalized) ? 'service_list' : 'service_definition';
    }
    if (params.intentCategories.includes('pricing') && params.intentCategories.includes('services')) {
      return /fiyatlar|ucretler|price|fiyat list/.test(normalized)
        ? 'topic_price_list'
        : 'exact_price_answer';
    }

    return null;
  }

  buildLookupKey(params: DMResponseCacheLookupParams): string {
    return [
      params.cacheClass,
      params.normalizedMessage,
      params.kbSignature,
      params.configSignature,
      params.conductState,
      params.cacheVersion || DM_RESPONSE_CACHE_VERSION,
    ].join('|');
  }

  lookupActive(params: DMResponseCacheLookupParams): DMResponseCacheHit | null {
    const lookupKey = this.buildLookupKey(params);
    const now = new Date().toISOString();
    const row = this.db.prepare(`
      SELECT id, lookup_key, cache_class, response_text, source_execution_id, observation_count, status
      FROM dm_response_cache
      WHERE lookup_key = ?
        AND status = 'active'
        AND expires_at >= ?
      ORDER BY observation_count DESC, last_seen_at DESC
      LIMIT 1
    `).get(lookupKey, now) as CacheRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      lookupKey: row.lookup_key,
      cacheClass: row.cache_class,
      responseText: row.response_text,
      sourceExecutionId: row.source_execution_id,
      observationCount: row.observation_count,
      status: row.status,
    };
  }

  recordObservation(params: DMResponseCacheRecordParams): void {
    const observedAt = params.observedAt || new Date().toISOString();
    const expiresAt = new Date(new Date(observedAt).getTime() + (CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)).toISOString();
    const lookupKey = this.buildLookupKey(params);
    const responseText = DMResponseCacheService.normalizeResponse(params.responseText);
    const responseHash = this.hashText(responseText);

    const existing = this.db.prepare(`
      SELECT id, observation_count
      FROM dm_response_cache
      WHERE lookup_key = ? AND response_hash = ?
      LIMIT 1
    `).get(lookupKey, responseHash) as { id: string; observation_count: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE dm_response_cache
        SET response_text = ?,
            source_execution_id = ?,
            observation_count = observation_count + 1,
            last_seen_at = ?,
            expires_at = ?
        WHERE id = ?
      `).run(responseText, params.sourceExecutionId, observedAt, expiresAt, existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO dm_response_cache (
          id, lookup_key, cache_class, normalized_message, kb_signature, config_signature,
          conduct_state, cache_version, response_hash, response_text, source_execution_id,
          observation_count, status, first_seen_at, last_seen_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'candidate', ?, ?, ?)
      `).run(
        randomUUID(),
        lookupKey,
        params.cacheClass,
        params.normalizedMessage,
        params.kbSignature,
        params.configSignature,
        params.conductState,
        params.cacheVersion || DM_RESPONSE_CACHE_VERSION,
        responseHash,
        responseText,
        params.sourceExecutionId,
        observedAt,
        observedAt,
        expiresAt,
      );
    }

    this.reconcileActivation(lookupKey, observedAt);
  }

  getStats(): {
    total: number;
    active: number;
    candidate: number;
    classes: Array<{ cacheClass: string; count: number }>;
  } {
    const totals = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'candidate' THEN 1 ELSE 0 END) as candidate
      FROM dm_response_cache
      WHERE expires_at >= ?
    `).get(new Date().toISOString()) as {
      total: number;
      active: number | null;
      candidate: number | null;
    };

    const classes = this.db.prepare(`
      SELECT cache_class as cacheClass, COUNT(*) as count
      FROM dm_response_cache
      WHERE expires_at >= ?
      GROUP BY cache_class
      ORDER BY count DESC, cache_class ASC
    `).all(new Date().toISOString()) as Array<{ cacheClass: string; count: number }>;

    return {
      total: totals.total || 0,
      active: totals.active || 0,
      candidate: totals.candidate || 0,
      classes,
    };
  }

  clear(): { deleted: number } {
    const result = this.db.prepare('DELETE FROM dm_response_cache').run();
    return { deleted: result.changes };
  }

  seedFromInstagramHistory(params: {
    configSignature: string;
    days?: number;
    dryRun?: boolean;
    directOnly?: boolean;
    limit?: number;
  }): DMResponseCacheSeedResult {
    const days = Math.max(1, Math.min(params.days || 30, 90));
    const dryRun = params.dryRun === true;
    const directOnly = params.directOnly !== false;
    const limit = Math.max(1, Math.min(params.limit || 5000, 20000));
    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
    const kbSignature = this.getActiveKnowledgeSignature();
    const rows = this.db.prepare(`
      SELECT
        outbound.execution_id,
        COALESCE(outbound.ai_response, outbound.message_text) as response_text,
        outbound.pipeline_trace,
        outbound.pipeline_error,
        outbound.created_at,
        (
          SELECT inbound.message_text
          FROM instagram_interactions inbound
          WHERE inbound.execution_id = outbound.execution_id
            AND inbound.direction = 'inbound'
          ORDER BY inbound.created_at ASC
          LIMIT 1
        ) as inbound_message_text
      FROM instagram_interactions outbound
      WHERE outbound.direction = 'outbound'
        AND outbound.execution_id IS NOT NULL
        AND outbound.created_at >= ?
        AND outbound.instagram_id NOT LIKE 'sim_%'
      ORDER BY outbound.created_at ASC
      LIMIT ?
    `).all(since, limit) as HistoricalSeedRow[];

    const skipped: Record<string, number> = {};
    let eligible = 0;
    let recorded = 0;

    for (const row of rows) {
      const candidate = DMResponseCacheService.buildSeedCandidate({
        messageText: row.inbound_message_text || '',
        responseText: row.response_text || '',
        trace: this.safeJsonParse(row.pipeline_trace),
        pipelineError: this.safeJsonParse(row.pipeline_error) || row.pipeline_error,
        configSignature: params.configSignature,
        kbSignature,
        observedAt: row.created_at,
        sourceExecutionId: row.execution_id,
      }, { directOnly });

      if (!candidate) {
        const reason = DMResponseCacheService.lastSeedSkipReason;
        skipped[reason] = (skipped[reason] || 0) + 1;
        continue;
      }

      eligible += 1;
      if (!dryRun) {
        this.recordObservation(candidate.record);
      }
      recorded += 1;
    }

    return {
      days,
      dryRun,
      directOnly,
      kbSignature,
      configSignature: params.configSignature,
      scanned: rows.length,
      eligible,
      recorded,
      skipped,
      stats: dryRun ? undefined : this.getStats(),
    };
  }

  private reconcileActivation(lookupKey: string, now: string): void {
    const rows = this.db.prepare(`
      SELECT id, observation_count
      FROM dm_response_cache
      WHERE lookup_key = ?
        AND expires_at >= ?
      ORDER BY observation_count DESC, last_seen_at DESC, id ASC
    `).all(lookupKey, now) as Array<{ id: string; observation_count: number }>;

    if (rows.length === 0) {
      return;
    }

    const leader = rows[0];
    const runnerUp = rows[1];
    const shouldActivate = leader.observation_count >= PROMOTION_MIN_OBSERVATIONS
      && (!runnerUp || leader.observation_count >= (runnerUp.observation_count + PROMOTION_MIN_LEAD));

    if (!shouldActivate) {
      this.db.prepare(`
        UPDATE dm_response_cache
        SET status = 'candidate'
        WHERE lookup_key = ?
      `).run(lookupKey);
      return;
    }

    this.db.prepare(`
      UPDATE dm_response_cache
      SET status = CASE WHEN id = ? THEN 'active' ELSE 'candidate' END
      WHERE lookup_key = ?
    `).run(leader.id, lookupKey);
  }

  private hashText(text: string): string {
    return createHash('sha1').update(text).digest('hex');
  }

  private getActiveKnowledgeSignature(): string {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(MAX(updated_at), 'none') as maxUpdatedAt
      FROM knowledge_base
      WHERE is_active = 1
    `).get() as { count: number; maxUpdatedAt: string | null };

    return `${row.count || 0}:${row.maxUpdatedAt || 'none'}`;
  }

  private safeJsonParse(value: string | null): any {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dm_response_cache (
        id TEXT PRIMARY KEY,
        lookup_key TEXT NOT NULL,
        cache_class TEXT NOT NULL,
        normalized_message TEXT NOT NULL,
        kb_signature TEXT NOT NULL,
        config_signature TEXT NOT NULL,
        conduct_state TEXT NOT NULL,
        cache_version TEXT NOT NULL,
        response_hash TEXT NOT NULL,
        response_text TEXT NOT NULL,
        source_execution_id TEXT,
        observation_count INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL CHECK(status IN ('candidate', 'active')) DEFAULT 'candidate',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        UNIQUE(lookup_key, response_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_dm_response_cache_lookup ON dm_response_cache(lookup_key, status);
      CREATE INDEX IF NOT EXISTS idx_dm_response_cache_expires ON dm_response_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_dm_response_cache_class ON dm_response_cache(cache_class, status);
    `);
  }
}
