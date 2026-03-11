import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';
import { InstagramContextService, type AIUsageTrace, type MessageAnalysis } from '../services/InstagramContextService.js';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { ResponsePolicyService } from '../services/ResponsePolicyService.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { DirectResponseService } from '../services/DirectResponseService.js';
import { DMKnowledgeContextService } from '../services/DMKnowledgeContextService.js';
import { DMResponseCacheService, type DMResponseCacheClass } from '../services/DMResponseCacheService.js';
import { KnowledgeSelectionService } from '../services/KnowledgeSelectionService.js';
import { DMKnowledgeRetrievalService } from '../services/DMKnowledgeRetrievalService.js';
import { DMKnowledgeRerankerService, formatSelectedEvidenceBlock } from '../services/DMKnowledgeRerankerService.js';
import { UserBlockService } from '../services/UserBlockService.js';
import { evaluatePermanentBanCandidate } from '../services/PermanentBanHeuristics.js';
import {
  APPOINTMENT_MODEL_ID,
  buildClarifyExhaustedContactResponse,
  buildDeterministicClarifierResponse,
  buildDeterministicCloseoutResponse,
  CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
  HOURS_APPOINTMENT_MODEL_ID,
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
  isPilatesInfoRequest,
  isStandaloneAppointmentRequest,
  normalizeTemplateText as normalizeFastLaneText,
  PILATES_INFO_MODEL_ID,
} from '../services/DMPipelineHeuristics.js';
import { buildDMStyleProfile, getDeterministicConductResponse, sanitizeConductResponse } from '../services/DMResponseStyleService.js';
import { estimateTokens } from '../services/UsageMetrics.js';
import { hasAgePolicySignals } from '../services/PolicySignalService.js';
import { hasRoomAvailabilitySignals } from '../services/RoomAvailabilitySignalService.js';
import type { PolicyValidationResult } from '../services/ResponsePolicyService.js';
import { TurkishDMHumanizerService, type TurkishDMHumanizerTrace } from '../services/TurkishDMHumanizerService.js';
import { EscalationService } from '../services/EscalationService.js';
import {
  aggregateUsageByModel,
  splitEstimatedTokens,
  type ModelUsageEntry,
} from '../services/CostEstimationService.js';
import {
  evaluateSexualIntent,
  getSexualIntentReply,
  shouldEscalateConductForSexualDecision,
} from '../middleware/sexualIntentFilter.js';
import type { DMSafetyPhraseService } from '../services/DMSafetyPhraseService.js';
import type { ConductState, SuspiciousUserService } from '../services/SuspiciousUserService.js';

// Escalation service injection (set from index.ts)
let _escalationService: EscalationService | null = null;
export function setEscalationService(svc: EscalationService): void {
  _escalationService = svc;
}

let _dmSafetyPhraseService: DMSafetyPhraseService | null = null;
export function setDMSafetyPhraseService(svc: DMSafetyPhraseService | null): void {
  _dmSafetyPhraseService = svc;
}

let _dmConductService: SuspiciousUserService | null = null;
export function setDMConductService(svc: SuspiciousUserService | null): void {
  _dmConductService = svc;
}

function addModelUsageEntry(
  entries: ModelUsageEntry[],
  modelId: string | null | undefined,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): void {
  const normalizedModelId = String(modelId || '').trim();
  const safeInputTokens = Math.max(0, Math.round(inputTokens || 0));
  const safeOutputTokens = Math.max(0, Math.round(outputTokens || 0));

  if (!normalizedModelId || (safeInputTokens === 0 && safeOutputTokens === 0)) {
    return;
  }

  entries.push({
    modelId: normalizedModelId,
    inputTokens: safeInputTokens,
    outputTokens: safeOutputTokens,
  });
}

function addAIUsageTraceEntries(entries: ModelUsageEntry[], usageTrace: AIUsageTrace[] | undefined): void {
  for (const traceEntry of usageTrace || []) {
    addModelUsageEntry(entries, traceEntry.modelId, traceEntry.inputTokens, traceEntry.outputTokens);
  }
}

export interface PipelineTrace {
  // Sexual intent filter (pre-processing safety check)
  sexualIntent?: {
    action: 'allow' | 'retry_question' | 'block_message';
    confidence: number;
    reason: string;
    modelUsed: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  intentCategories: string[];
  matchedKeywords: string[];
  modelTier: 'light' | 'standard' | 'advanced';
  modelId: string;
  tierReason: string;
  // Conversation history (for debugging context issues)
  conversationHistory?: {
    messageCount: number;
    messages: Array<{
      direction: 'inbound' | 'outbound';
      text: string;
      timestamp: string;
      relativeTime: string;
    }>;
    formattedForAI: string;
    followUpHint?: {
      topicLabel: string;
      rewrittenQuestion: string;
      sourceMessage: string;
    } | null;
    activeState?: {
      activeTopic: string;
      activeTopicConfidence: number;
      topicSourceMessage: string | null;
      expiresAt: string;
      usedForPlanning: boolean;
      repairedFromState: boolean;
    } | null;
    responseDirective?: {
      mode: 'answer_directly' | 'answer_then_clarify' | 'clarify_only';
      instruction: string;
      rationale: string;
    };
  };
  knowledgeCategoriesFetched: string[];
  knowledgeFetchStatus: 'success' | 'fail' | 'skipped';
  knowledgeEntriesCount: number;
  semanticRetrieval?: {
    enabled: boolean;
    strategy: 'sparse_tfidf_chargram';
    queryText: string;
    candidateCount: number;
    selectedEntries: Array<{
      category: string;
      keyName: string;
      score: number;
    }>;
    latencyMs: number;
    refreshedIndex: boolean;
    skippedReason: string | null;
  };
  semanticRerank?: {
    enabled: boolean;
    modelId: string;
    candidateCount: number;
    selectedCount: number;
    selectedEntries: Array<{
      category: string;
      keyName: string;
      score: number;
    }>;
    latencyMs: number;
    skippedReason: string | null;
    rationale: string | null;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  conductControl?: {
    state: ConductState;
    shouldReply: boolean;
    offenseCount: number;
    manualMode: 'auto' | 'force_normal' | 'force_silent';
    silentUntil: string | null;
    reason?: string;
  };
  responseStyle?: {
    mode: 'normal' | 'guarded' | 'final_warning' | 'silent';
    greetingPolicy: 'normal' | 'skip_repeat_greeting' | 'minimal';
    emojiPolicy: 'none' | 'optional_single';
    ctaPolicy: 'only_when_needed' | 'minimal';
    antiRepeatSignals: string[];
  };
  humanizer?: TurkishDMHumanizerTrace;
  fastLane?: {
    used: boolean;
    kind: 'none' | 'deterministic_conduct' | 'deterministic_info_template' | 'deterministic_pilates_info' | 'deterministic_clarifier' | 'deterministic_contact_location' | 'deterministic_contact_phone' | 'deterministic_contact_fallback' | 'deterministic_hours' | 'deterministic_hours_appointment' | 'deterministic_appointment' | 'deterministic_closeout' | 'response_cache' | 'simple_analysis';
    skippedStages: string[];
  };
  cache?: {
    eligible: boolean;
    hit: boolean;
    cacheClass: string | null;
    lookupKey: string | null;
    sourceExecutionId: string | null;
    status: 'active' | 'candidate' | 'miss' | 'ineligible';
    observationCount: number | null;
  };
  openclawDispatchStatus: 'success' | 'fail' | 'skipped';
  openclawSessionKey: string;
  agentPollDurationMs: number;
  // Policy Agent validation (post-processing)
  policyValidation?: {
    status: 'pass' | 'fail' | 'corrected' | 'fallback' | 'skipped';
    attempts: number;
    totalLatencyMs: number;
    totalTokens: number;
    violations?: string[];
    reason?: string;
    modelUsed?: string;
    // Original rejection info (captured from first failed attempt, before correction)
    originalViolations?: string[];
    originalReason?: string;
  };
  // Direct response (bypassed OpenClaw)
  directResponse?: {
    used: boolean;
    latencyMs: number;
    modelId: string;
    tokensEstimated: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  timingBreakdown?: {
    ingestDelayMs?: number | null;
    customerPerceivedTotalMs?: number | null;
    safetyFilterMs: number;
    contextAnalysisMs: number;
    knowledgeAssemblyMs: number;
    openclawDispatchMs: number;
    metaSendMs: number;
    uncategorizedMs: number;
  };
  tokenBreakdown?: {
    safetyTokens?: number;
    contextTokens?: number;
    rerankTokens?: number;
    directTokens?: number;
    directInputTokens?: number;
    directOutputTokens?: number;
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
    policyTokens: number;
    totalTokens: number;
  };
  metaSendStatus: 'success' | 'fail' | 'skipped';
  metaSendError?: string;
  totalResponseTimeMs: number;
  tokensEstimated: number;
  isNewCustomer: boolean;
}

export interface PipelineError {
  stage: 'context_error' | 'knowledge_fetch_fail' | 'openclaw_timeout' | 'openclaw_dispatch_fail' | 'meta_send_fail' | 'policy_validation_fail';
  message: string;
  timestamp: string;
  partialTrace: Partial<PipelineTrace>;
}

/**
 * Instagram Webhook Routes
 * Handles Meta webhook verification and incoming DMs
 * Messages are processed via OpenClaw AI pipeline
 */
export function createInstagramWebhookRoutes(db: Database.Database): Router {
  const router = Router();
  const semanticKnowledgeService = new DMKnowledgeRetrievalService(db);
  const semanticReranker = new DMKnowledgeRerankerService();
  const knowledgeContextService = new DMKnowledgeContextService(db);
  const responseCacheService = new DMResponseCacheService(db);
  const humanizerService = new TurkishDMHumanizerService();
  const userBlockService = new UserBlockService(db);
  
  const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || 'kio-instagram-verify';
  const OPENCLAW_WEBHOOK_URL = process.env.OPENCLAW_IG_WEBHOOK_URL || '';
  const OPENCLAW_HOOKS_TOKEN = process.env.OPENCLAW_HOOKS_TOKEN || '';
  const OPENCLAW_SESSIONS_DIR = join(homedir(), '.openclaw', 'agents', 'main', 'sessions');

  // Dedup guard — Meta sends the same webhook multiple times (retries).
  // Track recently processed message IDs to avoid duplicate AI responses.
  const recentMessageIds = new Map<string, number>(); // mid → timestamp
  const DEDUP_WINDOW_MS = 60_000; // ignore duplicate within 60s
  const INSTAGRAM_MAX_MESSAGE_CHARS = 950;

  /**
   * Fetch Instagram user profile (name) via Graph API and upsert into instagram_customers.
   * Non-blocking, fire-and-forget — failure doesn't affect the DM pipeline.
   */
  async function fetchAndStoreInstagramProfile(senderId: string): Promise<void> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return;
    try {
      const url = `https://graph.instagram.com/${senderId}?fields=name,username&access_token=${token}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const data = await res.json() as { name?: string; username?: string };
      const name = data.name || data.username || null;
      if (!name) return;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO instagram_customers (instagram_id, name, interaction_count, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
        ON CONFLICT(instagram_id) DO UPDATE SET
          name = COALESCE(excluded.name, instagram_customers.name),
          updated_at = excluded.updated_at
      `).run(senderId, name, now, now);
      console.log('[Instagram Webhook] Profile fetched: %s → %s', senderId, name);
    } catch { /* non-critical */ }
  }

  /**
   * Test mode gate — when enabled, only whitelisted sender IDs get AI responses.
   * Others are silently ignored (webhook still returns 200 to Meta).
   */
  function isTestModeBlocked(senderId: string): boolean {
    const testMode = process.env.INSTAGRAM_TEST_MODE === 'true';
    if (!testMode) return false;
    const allowedIds = (process.env.INSTAGRAM_TEST_SENDER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allowedIds.length === 0) return false;
    return !allowedIds.includes(senderId);
  }

  function normalizeTemplateText(text: string): string {
    return text
      .toLocaleLowerCase('tr-TR')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isGenericInfoRequest(messageText: string): boolean {
    const normalized = normalizeTemplateText(messageText);
    if (!normalized) return false;

    const hasInfoIntent = /\b(bilgi|detay)\b/.test(normalized)
      || /\bbilgi\s+(al|ver)/.test(normalized);
    if (!hasInfoIntent) return false;

    const hasSpecificAnchor = /\b(fiyat|ucret|tl|lira|ne kadar|kac|masaj|hamam|sauna|havuz|fitness|pilates|reformer|pt|kurs|ders|uyelik|adres|telefon|konum|saat|acik|kapali|randevu)\b/.test(normalized);

    return !hasSpecificAnchor;
  }

  /*

      const sections: string[] = ['Elbette, size hızlıca temel bilgileri paylaşayım 👇'];

      if (massagePricing?.value) {
        sections.push(clipTemplateBlock(formatMassagePricingTemplate(massagePricing.value), 26, 2200));
      }
      if (therapistInfo?.value) {
        sections.push(`👩 Terapist Bilgisi:\n${clipTemplateBlock(therapistInfo.value, 4, 500)}`);
      }
      if (bringInfo?.value) {
        sections.push(`🧳 Yanınızda Ne Getirmelisiniz?\n${clipTemplateBlock(bringInfo.value, 10, 850)}`);
      }
      if (phoneInfo?.value) {
        sections.push(`📞 Detaylı bilgi ve randevu: ${clipTemplateBlock(phoneInfo.value, 2, 140)}`);
      }

      return sections.join('\n\n');
    } catch (error) {
      console.error('[Instagram Webhook] Failed to build deterministic info template:', error);
      return null;
    }
  }

  */

  function buildConductReply(
    action: 'retry_question' | 'block_message',
    conductState: ConductState,
  ): string | null {
    if (conductState === 'silent') {
      return action === 'block_message'
        ? 'Böyle bir hizmet yok.'
        : 'Sadece profesyonel spa ve spor hizmeti veriyoruz.';
    }

    return getSexualIntentReply(action);
  }

  function markFastLane(
    trace: Partial<PipelineTrace>,
    kind: NonNullable<PipelineTrace['fastLane']>['kind'],
    skippedStages: string[],
  ): void {
    trace.fastLane = {
      used: kind !== 'none',
      kind,
      skippedStages,
    };
  }

  function setCacheTrace(trace: Partial<PipelineTrace>, payload: Partial<NonNullable<PipelineTrace['cache']>>): void {
    trace.cache = {
      eligible: false,
      hit: false,
      cacheClass: null,
      lookupKey: null,
      sourceExecutionId: null,
      status: 'miss',
      observationCount: null,
      ...trace.cache,
      ...payload,
    };
  }

  function getResponseCacheClass(messageText: string, analysis: MessageAnalysis | null): DMResponseCacheClass | null {
    if (!analysis) {
      return null;
    }

    const normalized = normalizeFastLaneText(messageText);
    if (analysis.matchedKeywords.includes('gratitude_message')) {
      return 'gratitude_closeout';
    }
    if (isDirectLocationQuestion(messageText)) {
      return 'direct_location';
    }
    if (isDirectPhoneQuestion(messageText)) {
      return 'direct_phone';
    }
    if (analysis.matchedKeywords.includes('standalone_hours_request')) {
      return 'direct_hours';
    }
    if (isGenericInfoRequest(messageText)) {
      return 'general_info';
    }
    if (analysis.intentCategories.includes('services')
      && analysis.intentCategories.every(category => ['services', 'general', 'faq'].includes(category))
      && /\b(?:nedir|nasil bir|ne ise yarar|detay|detaylari|icerik|icerigi|anlatir misiniz|var mi|neler var)\b/.test(normalized)) {
      return /\bneler var\b/.test(normalized) ? 'service_list' : 'service_definition';
    }
    if (analysis.intentCategories.includes('pricing') && analysis.intentCategories.includes('services')) {
      return /fiyatlar|ucretler|price|fiyat list/.test(normalized)
        ? 'topic_price_list'
        : 'exact_price_answer';
    }

    return null;
  }

  function shouldLookupResponseCache(params: {
    messageText: string;
    analysis: MessageAnalysis;
    conductState: ConductState;
    sexualAction: 'allow' | 'retry_question' | 'block_message';
  }): boolean {
    const normalized = normalizeFastLaneText(params.messageText);
    return params.conductState === 'normal'
      && params.sexualAction === 'allow'
      && !params.analysis.followUpHint
      && params.analysis.modelTier !== 'advanced'
      && !hasAgePolicySignals(params.messageText, params.analysis.followUpHint?.rewrittenQuestion, params.analysis.activeTopicLabel)
      && !hasRoomAvailabilitySignals(params.messageText, params.analysis.followUpHint?.rewrittenQuestion, params.analysis.activeTopicLabel)
      && !/\b(?:randevu|rezervasyon|uygun musait)\b/.test(normalized);
  }

  function shouldWriteResponseCache(params: {
    cacheClass: DMResponseCacheClass | null;
    messageText: string;
    analysis: MessageAnalysis | null;
    conductState: ConductState;
    sexualAction: 'allow' | 'retry_question' | 'block_message';
    metaSendStatus: 'success' | 'fail' | 'skipped';
    policyStatus: 'pass' | 'fail' | 'corrected' | 'fallback' | 'skipped';
    policyAttempts: number;
    pipelineError: PipelineError | null;
    cacheHit: boolean;
  }): params is typeof params & {
    cacheClass: DMResponseCacheClass;
    analysis: NonNullable<typeof params.analysis>;
  } {
    return !!params.cacheClass
      && !!params.analysis
      && params.conductState === 'normal'
      && params.sexualAction === 'allow'
      && params.metaSendStatus === 'success'
      && params.policyStatus === 'pass'
      && params.policyAttempts === 1
      && !params.pipelineError
      && !params.cacheHit;
  }

  function shouldRunSemanticEnrichment(messageText: string, analysis: MessageAnalysis, simpleTurnUsed: boolean): boolean {
    const deterministicCloseout = buildDeterministicCloseoutResponse(messageText);
    if (deterministicCloseout?.action === 'skip_send') {
      return false;
    }

    if (!simpleTurnUsed) {
      return true;
    }

    if (analysis.matchedKeywords.includes('gratitude_message')
      || analysis.matchedKeywords.includes('standalone_hours_request')
      || isDirectLocationQuestion(messageText)
      || isDirectPhoneQuestion(messageText)) {
      return false;
    }

    if (analysis.intentCategories.every(category => ['general', 'faq'].includes(category))) {
      return false;
    }

    return !(analysis.intentCategories.includes('services')
      && analysis.intentCategories.every(category => ['services', 'general', 'faq'].includes(category)));
  }

  function normalizeMetaTimestampMs(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }

    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  /**
   * Poll OpenClaw session JSONL for the agent's final text response.
   * Returns the last assistant text message or null after timeout.
   * 
   * Strategy: Session creation takes ~5-10s, then LLM response takes ~10-20s.
   * The agent may produce toolUse responses before a final stop response.
   * We look for stopReason=stop first, then fall back to any assistant text
  /**
   * Poll OpenClaw session JSONL for the agent's response.
   * Uses timestamp-based filtering: only considers entries created AFTER dispatchTime.
   * OpenClaw rewrites JSONL files per session, so line-count-based skipping doesn't work.
   */
  async function pollAgentResponse(sessionKey: string, maxWaitMs = 45000, dispatchTime?: string): Promise<string | null> {
    const pollInterval = 2000;
    const startTime = Date.now();
    const dispatchTs = dispatchTime ? new Date(dispatchTime).getTime() : 0;
    let lastLineCount = 0;
    let stableAt = 0;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const sessionsFile = join(OPENCLAW_SESSIONS_DIR, 'sessions.json');
        if (!existsSync(sessionsFile)) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }
        const sessionsData = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
        const sessionInfo = sessionsData[sessionKey];
        if (!sessionInfo?.sessionId) {
          console.log('[Poll] Waiting for session key in sessions.json...');
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        const jsonlFile = join(OPENCLAW_SESSIONS_DIR, `${sessionInfo.sessionId}.jsonl`);
        if (!existsSync(jsonlFile)) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        const allLines = readFileSync(jsonlFile, 'utf-8').trim().split('\n');

        // Filter: only lines with timestamps >= dispatchTime
        const lines = dispatchTs > 0 ? allLines.filter(line => {
          try {
            const entry = JSON.parse(line);
            return entry.timestamp && new Date(entry.timestamp).getTime() >= dispatchTs;
          } catch { return false; }
        }) : allLines;

        if (lines.length === 0) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        // Track stability
        if (lines.length !== lastLineCount) {
          lastLineCount = lines.length;
          stableAt = Date.now();
        }

        // Look for stopReason=stop assistant message
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.type === 'message' && entry.message?.role === 'assistant' && entry.message?.stopReason === 'stop') {
              const content = entry.message.content;
              if (Array.isArray(content)) {
                const textPart = content.find((c: { type: string }) => c.type === 'text');
                if (textPart?.text) return textPart.text;
              } else if (typeof content === 'string' && content.trim()) {
                return content;
              }
            }
          } catch { /* skip */ }
        }

        // Fallback: stable for 5s (agent stuck in tool loop)
        const stableDuration = Date.now() - stableAt;
        if (stableAt > 0 && stableDuration > 5000) {
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const entry = JSON.parse(lines[i]);
              if (entry.type === 'message' && entry.message?.role === 'assistant') {
                const content = entry.message.content;
                if (Array.isArray(content)) {
                  const textPart = content.find((c: { type: string }) => c.type === 'text');
                  if (textPart?.text && textPart.text.length > 20) {
                    console.log('[Poll] Using fallback text (agent stuck in tool loop)');
                    return textPart.text;
                  }
                }
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        console.error('[Instagram Webhook] Poll error:', err);
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }
    return null;
  }

  function chunkInstagramMessage(message: string, maxChars = INSTAGRAM_MAX_MESSAGE_CHARS): string[] {
    const normalized = message.replace(/\r/g, '').trim();
    if (!normalized) return [''];
    if (normalized.length <= maxChars) return [normalized];

    const chunks: string[] = [];
    const paragraphs = normalized.split('\n\n').map(part => part.trim()).filter(Boolean);
    let currentChunk = '';

    const flushCurrent = () => {
      const value = currentChunk.trim();
      if (value) chunks.push(value);
      currentChunk = '';
    };

    const pushLongLine = (line: string) => {
      const words = line.split(/\s+/).filter(Boolean);
      let wordChunk = '';
      for (const word of words) {
        const candidate = wordChunk ? `${wordChunk} ${word}` : word;
        if (candidate.length <= maxChars) {
          wordChunk = candidate;
          continue;
        }

        if (wordChunk) {
          chunks.push(wordChunk);
          wordChunk = '';
        }

        if (word.length <= maxChars) {
          wordChunk = word;
          continue;
        }

        for (let i = 0; i < word.length; i += maxChars) {
          chunks.push(word.slice(i, i + maxChars));
        }
      }
      if (wordChunk) chunks.push(wordChunk);
    };

    for (const paragraph of paragraphs) {
      if (paragraph.length > maxChars) {
        flushCurrent();
        const lines = paragraph.split('\n').map(line => line.trim()).filter(Boolean);
        let lineChunk = '';
        for (const line of lines) {
          if (line.length > maxChars) {
            if (lineChunk) {
              chunks.push(lineChunk);
              lineChunk = '';
            }
            pushLongLine(line);
            continue;
          }

          const lineCandidate = lineChunk ? `${lineChunk}\n${line}` : line;
          if (lineCandidate.length <= maxChars) {
            lineChunk = lineCandidate;
          } else {
            if (lineChunk) chunks.push(lineChunk);
            lineChunk = line;
          }
        }
        if (lineChunk) chunks.push(lineChunk);
        continue;
      }

      const paragraphCandidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      if (paragraphCandidate.length <= maxChars) {
        currentChunk = paragraphCandidate;
      } else {
        flushCurrent();
        currentChunk = paragraph;
      }
    }

    flushCurrent();
    return chunks.filter(Boolean);
  }

  async function sendInstagramText(
    apiKey: string,
    recipientId: string,
    message: string,
  ): Promise<{
    ok: boolean;
    chunkCount: number;
    sentCount: number;
    failedChunk?: number;
    status?: number;
    errorBody?: string;
  }> {
    const chunks = chunkInstagramMessage(message);
    let sentCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const sendRes = await fetch('http://localhost:3001/api/integrations/instagram/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ recipientId, message: chunks[i] }),
        });
        const rawBody = await sendRes.text();
        if (!sendRes.ok) {
          return {
            ok: false,
            chunkCount: chunks.length,
            sentCount,
            failedChunk: i + 1,
            status: sendRes.status,
            errorBody: rawBody,
          };
        }
        sentCount += 1;
      } catch (sendErr: any) {
        return {
          ok: false,
          chunkCount: chunks.length,
          sentCount,
          failedChunk: i + 1,
          errorBody: sendErr?.message || String(sendErr),
        };
      }

      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    }

    return {
      ok: true,
      chunkCount: chunks.length,
      sentCount,
    };
  }

  /**
   * Store pipeline trace and error in the DB, then push SSE events.
   * Uses a subquery to find the most recent outbound interaction for the sender.
   */
  function storePipelineTraceAndPushSSE(
    senderId: string,
    trace: Partial<PipelineTrace>,
    pipelineError: PipelineError | null,
    modelTier: string | null,
    direction: 'inbound' | 'outbound',
    messageText: string,
    responseTimeMs: number | null,
    modelUsed: string | null,
  ): void {
    // Store pipeline trace directly in DB
    if (direction === 'outbound') {
      try {
        db.prepare(`
          UPDATE instagram_interactions 
          SET pipeline_trace = ?, pipeline_error = ?, model_tier = ?
          WHERE id = (
            SELECT id FROM instagram_interactions 
            WHERE instagram_id = ? AND direction = 'outbound'
            ORDER BY created_at DESC LIMIT 1
          )
        `).run(
          JSON.stringify(trace),
          pipelineError ? JSON.stringify(pipelineError) : null,
          modelTier,
          senderId
        );
      } catch (dbErr) {
        console.error('[Instagram Webhook] Failed to store pipeline trace:', dbErr);
      }
    }

    // Push SSE events
    try {
      const dmSSE = DmSSEManager.getInstance();
      dmSSE.pushEvent({
        type: 'dm:new',
        data: {
          id: `dm_${Date.now()}`,
          instagramId: senderId,
          direction,
          messageText: messageText.substring(0, 200),
          responseTimeMs,
          modelTier,
          modelUsed,
          pipelineTrace: trace,
          pipelineError,
          createdAt: new Date().toISOString(),
        },
      });
      dmSSE.pushEvent({ type: 'dm:health_update', data: { timestamp: new Date().toISOString() } });
    } catch (sseErr) {
      console.error('[Instagram Webhook] SSE push error (non-fatal):', sseErr);
    }
  }

  /**
   * GET /webhook/instagram - Webhook verification
   * Meta sends a GET request to verify the webhook URL
   */
  router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[Instagram Webhook] Verification request:', { 
      mode, 
      token: token ? '***' : 'missing', 
      challenge: challenge ? 'present' : 'missing' 
    });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verification successful');
      res.status(200).send(challenge);
    } else {
      console.log('[Instagram Webhook] Verification failed - token mismatch');
      res.status(403).send('Forbidden');
    }
  });

  /**
   * POST /webhook/instagram - Receive incoming DMs
   * Meta sends POST requests with message data
   * We acknowledge immediately and process via OpenClaw pipeline
   */
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body;

    // Acknowledge receipt immediately (Meta requires 200 within 20 seconds)
    res.status(200).send('EVENT_RECEIVED');

    // Log the message for debugging
    try {
      const entry = body?.entry?.[0];
      const messaging = entry?.messaging?.[0];
      
      if (messaging?.message?.text) {
        console.log('[Instagram Webhook] DM received:', {
          from: messaging.sender?.id,
          text: messaging.message.text.substring(0, 50) + '...',
          timestamp: messaging.timestamp
        });
        
        // Forward to OpenClaw /hooks/agent endpoint, then poll for response and handle send+log
        if (OPENCLAW_WEBHOOK_URL && OPENCLAW_HOOKS_TOKEN) {
          const senderId = messaging.sender?.id || 'unknown';
          const messageText = messaging.message.text;

          // Fetch Instagram profile (name) — fire-and-forget, non-blocking
          fetchAndStoreInstagramProfile(senderId).catch(() => {});

          // Echo-back filter — ignore messages sent BY the page itself
          // Meta sends echo webhooks for outbound messages (is_echo=true or sender=pageId)
          const pageId = entry?.id;
          if (messaging.message?.is_echo === true || (pageId && senderId === pageId)) {
            console.log('[Instagram Webhook] Ignoring echo-back (sender=%s, pageId=%s, is_echo=%s)', senderId, pageId, messaging.message?.is_echo);
            return;
          }

          // Test mode gate — skip non-whitelisted senders
          if (isTestModeBlocked(senderId)) {
            console.log('[Instagram Webhook] Test mode: ignoring sender %s (not in whitelist)', senderId);
            return;
          }

          // Dedup guard — Meta retries webhooks, causing duplicate AI responses
          const mid = messaging.message?.mid;
          if (mid) {
            // Clean old entries
            const now = Date.now();
            for (const [key, ts] of recentMessageIds) {
              if (now - ts > DEDUP_WINDOW_MS) recentMessageIds.delete(key);
            }
            if (recentMessageIds.has(mid)) {
              console.log('[Instagram Webhook] Duplicate message ignored (mid: %s)', mid);
              return;
            }
            recentMessageIds.set(mid, now);
          }

          const API_KEY = process.env.KIO_API_KEY || '';
          const startTime = Date.now();
          const metaTimestampMs = normalizeMetaTimestampMs(messaging.timestamp);
          const ingestDelayMs = metaTimestampMs ? Math.max(0, startTime - metaTimestampMs) : null;
          let contextAnalysisMs = 0;
          let knowledgeAssemblyMs = 0;
          let openclawDispatchMs = 0;
          let metaSendDurationMs = 0;
          let estimatedPrimaryInputTokens = 0;
          
          // Generate unique execution ID for this DM pipeline run
          const executionId = `EXE-${randomUUID().substring(0, 8)}`;
          console.log('[Instagram Webhook] Starting pipeline execution: %s', executionId);

          // Initialize trace and error tracking
          const trace: Partial<PipelineTrace> = {};
          let pipelineError: PipelineError | null = null;
          markFastLane(trace, 'none', []);
          setCacheTrace(trace, {});

          const activeBlock = userBlockService.checkBlock('instagram', senderId);
          if (activeBlock.isBlocked) {
            const now = new Date().toISOString();
            const blockedModelId = activeBlock.isPermanent ? 'blocked/permanent' : 'blocked/temporary';
            const blockedReason = activeBlock.reason || 'Blocked user';
            const totalResponseTimeMs = Date.now() - startTime;
            trace.conductControl = {
              state: 'silent',
              shouldReply: false,
              offenseCount: 0,
              manualMode: 'auto',
              silentUntil: activeBlock.expiresAt || null,
              reason: blockedReason,
            };
            trace.knowledgeCategoriesFetched = [];
            trace.knowledgeFetchStatus = 'skipped';
            trace.knowledgeEntriesCount = 0;
            trace.openclawDispatchStatus = 'skipped';
            trace.openclawSessionKey = 'blocked-user';
            trace.agentPollDurationMs = 0;
            trace.modelTier = 'light';
            trace.modelId = blockedModelId;
            trace.tierReason = activeBlock.isPermanent ? 'Active permanent block' : 'Active temporary block';
            trace.intentCategories = [];
            trace.matchedKeywords = [];
            trace.metaSendStatus = 'skipped';
            trace.totalResponseTimeMs = totalResponseTimeMs;
            trace.tokensEstimated = 0;
            trace.isNewCustomer = false;
            trace.policyValidation = {
              status: 'skipped',
              attempts: 0,
              totalLatencyMs: 0,
              totalTokens: 0,
            };
            trace.timingBreakdown = {
              ingestDelayMs,
              customerPerceivedTotalMs: ingestDelayMs != null ? ingestDelayMs + totalResponseTimeMs : null,
              safetyFilterMs: 0,
              contextAnalysisMs: 0,
              knowledgeAssemblyMs: 0,
              openclawDispatchMs: 0,
              metaSendMs: 0,
              uncategorizedMs: totalResponseTimeMs,
            };
            trace.tokenBreakdown = {
              policyTokens: 0,
              totalTokens: 0,
            };

            db.prepare(`
              INSERT INTO instagram_customers (instagram_id, interaction_count, created_at, updated_at)
              VALUES (?, 0, ?, ?)
              ON CONFLICT(instagram_id) DO UPDATE SET updated_at = excluded.updated_at
            `).run(senderId, now, now);

            db.prepare(`
              INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, execution_id, model_used, model_tier, pipeline_trace, created_at)
              VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?)
            `).run(
              randomUUID(),
              senderId,
              messageText,
              activeBlock.isPermanent ? 'hard_blocked_user' : 'blocked_user',
              executionId,
              blockedModelId,
              'light',
              JSON.stringify(trace),
              now,
            );

            console.log(
              '[Instagram Webhook] Ignoring blocked user %s (%s, permanent=%s)',
              senderId,
              blockedReason,
              activeBlock.isPermanent === true,
            );
            return;
          }

          const conductBefore = _dmConductService?.checkSuspicious('instagram', senderId);
          const permanentBanCheckStartedAt = Date.now();
          const permanentBanEvaluation = evaluatePermanentBanCandidate({
            messageText,
            conductStateBefore: conductBefore?.conductState || 'normal',
            offenseCountAfter: (conductBefore?.offenseCount || 0) + 1,
          });
          const permanentBanLatency = Date.now() - permanentBanCheckStartedAt;
          if (permanentBanEvaluation.shouldBan) {
            const now = new Date().toISOString();
            const permanentBanReason = permanentBanEvaluation.reason || 'Automatic permanent block';
            const conductAfter = _dmConductService?.flagUser('instagram', senderId, permanentBanReason, {
              action: 'block_message',
              severity: 'high',
              source: 'heuristic-permanent-ban',
              messageText,
            });
            const blockedUser = userBlockService.permanentBlock('instagram', senderId, permanentBanReason);
            const totalResponseTimeMs = Date.now() - startTime;
            trace.sexualIntent = {
              action: 'block_message',
              confidence: 1,
              reason: permanentBanReason,
              modelUsed: 'heuristic-permanent-ban',
              latencyMs: permanentBanLatency,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            };
            trace.conductControl = {
              state: conductAfter?.conductState || 'silent',
              shouldReply: false,
              offenseCount: conductAfter?.offenseCount || ((conductBefore?.offenseCount || 0) + 1),
              manualMode: conductAfter?.manualMode || conductBefore?.manualMode || 'auto',
              silentUntil: conductAfter?.silentUntil || blockedUser.expiresAt,
              reason: permanentBanReason,
            };
            trace.knowledgeCategoriesFetched = [];
            trace.knowledgeFetchStatus = 'skipped';
            trace.knowledgeEntriesCount = 0;
            trace.openclawDispatchStatus = 'skipped';
            trace.openclawSessionKey = 'blocked-user';
            trace.agentPollDurationMs = 0;
            trace.modelTier = 'light';
            trace.modelId = 'blocked/permanent';
            trace.tierReason = 'Automatic permanent block';
            trace.intentCategories = [];
            trace.matchedKeywords = [];
            trace.metaSendStatus = 'skipped';
            trace.totalResponseTimeMs = totalResponseTimeMs;
            trace.tokensEstimated = 0;
            trace.isNewCustomer = false;
            trace.policyValidation = {
              status: 'skipped',
              attempts: 0,
              totalLatencyMs: 0,
              totalTokens: 0,
            };
            trace.timingBreakdown = {
              ingestDelayMs,
              customerPerceivedTotalMs: ingestDelayMs != null ? ingestDelayMs + totalResponseTimeMs : null,
              safetyFilterMs: permanentBanLatency,
              contextAnalysisMs: 0,
              knowledgeAssemblyMs: 0,
              openclawDispatchMs: 0,
              metaSendMs: 0,
              uncategorizedMs: Math.max(0, totalResponseTimeMs - permanentBanLatency),
            };
            trace.tokenBreakdown = {
              policyTokens: 0,
              totalTokens: 0,
            };

            db.prepare(`
              INSERT INTO instagram_customers (instagram_id, interaction_count, created_at, updated_at)
              VALUES (?, 0, ?, ?)
              ON CONFLICT(instagram_id) DO UPDATE SET updated_at = excluded.updated_at
            `).run(senderId, now, now);

            db.prepare(`
              INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, execution_id, model_used, model_tier, pipeline_trace, created_at)
              VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, ?, ?)
            `).run(
              randomUUID(),
              senderId,
              messageText,
              'hard_blocked_user',
              executionId,
              'blocked/permanent',
              'light',
              JSON.stringify(trace),
              now,
            );

            console.log(
              '[Instagram Webhook] Permanent block applied to %s (%s, category=%s)',
              senderId,
              permanentBanReason,
              permanentBanEvaluation.category,
            );

            if (_escalationService) {
              void _escalationService.escalate({
                source: 'dm_pipeline',
                type: 'permanent_ban_applied',
                severity: 'critical',
                title: `Instagram kullanici kalici engellendi - ${senderId}`,
                details: permanentBanReason,
                metadata: {
                  sender_id: senderId,
                  platform: 'instagram',
                  reason: permanentBanReason,
                  message_excerpt: messageText.substring(0, 200),
                  matched_terms: permanentBanEvaluation.matchedTerms,
                  category: permanentBanEvaluation.category,
                  conduct_state_before: conductBefore?.conductState || 'normal',
                  offense_count_after: conductAfter?.offenseCount || ((conductBefore?.offenseCount || 0) + 1),
                },
              }).catch((escalationErr) => {
                console.error('[Instagram Webhook] Permanent ban escalation failed:', escalationErr);
              });
            }

            return;
          }

          // Safety filter + conduct ladder
          const sexualIntentStartTime = Date.now();
          try {
            const safetyResult = _dmSafetyPhraseService
              ? await _dmSafetyPhraseService.evaluateMessage({
                  messageText,
                  channel: 'instagram',
                  senderId,
                })
              : {
                  decision: await evaluateSexualIntent(messageText),
                  matchedPhrase: null,
                  reviewRequest: { triggered: false, status: 'disabled', reviewId: null },
                };
            const sexualDecision = safetyResult.decision;
            const sexualIntentLatency = Date.now() - sexualIntentStartTime;

            trace.sexualIntent = {
              action: sexualDecision.action,
              confidence: sexualDecision.confidence,
              reason: sexualDecision.reason,
              modelUsed: sexualDecision.modelUsed,
              latencyMs: sexualIntentLatency,
              inputTokens: sexualDecision.usage?.inputTokens,
              outputTokens: sexualDecision.usage?.outputTokens,
              totalTokens: sexualDecision.usage?.totalTokens,
            };
            if (conductBefore) {
              trace.conductControl = {
                state: conductBefore.conductState || 'normal',
                shouldReply: conductBefore.shouldReply !== false,
                offenseCount: conductBefore.offenseCount || 0,
                manualMode: conductBefore.manualMode || 'auto',
                silentUntil: conductBefore.silentUntil || null,
                reason: conductBefore.reason,
              };
            }

            if (sexualDecision.action !== 'allow') {
              const shouldEscalateConduct = shouldEscalateConductForSexualDecision(sexualDecision.action);
              const conductAfter = shouldEscalateConduct
                ? _dmConductService?.flagUser('instagram', senderId, sexualDecision.reason, {
                    action: sexualDecision.action,
                    severity: 'high',
                    source: sexualDecision.modelUsed,
                    messageText,
                  })
                : conductBefore;
              const effectiveState = conductAfter?.conductState || 'normal';
              const replyText = buildConductReply(sexualDecision.action, effectiveState);
              const now = new Date().toISOString();
              const interactionIntent = effectiveState === 'silent'
                ? 'blocked_silent'
                : (sexualDecision.action === 'block_message' ? 'security_block' : 'retry_question');

              trace.conductControl = {
                state: effectiveState,
                shouldReply: conductAfter?.shouldReply ?? true,
                offenseCount: conductAfter?.offenseCount || 0,
                manualMode: conductAfter?.manualMode || 'auto',
                silentUntil: conductAfter?.silentUntil || null,
                reason: conductAfter?.reason || sexualDecision.reason,
              };

              db.prepare(`
                INSERT INTO instagram_customers (instagram_id, interaction_count, created_at, updated_at)
                VALUES (?, 0, ?, ?)
                ON CONFLICT(instagram_id) DO UPDATE SET updated_at = excluded.updated_at
              `).run(senderId, now, now);

              const inboundId = randomUUID();
              db.prepare(`
                INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, execution_id, created_at)
                VALUES (?, ?, 'inbound', ?, ?, ?, ?)
              `).run(inboundId, senderId, messageText, interactionIntent, executionId, now);

              let sent = false;
              if (replyText) {
                const sendResult = await sendInstagramText(API_KEY, senderId, replyText);
                sent = sendResult.ok;
              }

              const outboundId = randomUUID();
              db.prepare(`
                INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, ai_response, model_used, execution_id, created_at, pipeline_trace)
                VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?)
              `).run(
                outboundId,
                senderId,
                replyText || '[sessiz engel]',
                interactionIntent,
                replyText || null,
                sexualDecision.modelUsed,
                executionId,
                now,
                JSON.stringify(trace),
              );

              console.log('[Instagram Webhook] Safety/conduct triggered:', {
                senderId,
                action: sexualDecision.action,
                escalatedConduct: shouldEscalateConduct,
                effectiveState,
                confidence: Number((sexualDecision.confidence * 100).toFixed(1)),
                reason: sexualDecision.reason,
                sent,
              });

              try {
                DmSSEManager.getInstance().pushEvent({
                  type: 'dm:response',
                  data: {
                    id: outboundId,
                    instagramId: senderId,
                    direction: 'outbound',
                    messageText: (replyText || '[sessiz engel]').substring(0, 200),
                    responseTimeMs: sexualIntentLatency,
                    modelTier: null,
                    modelUsed: sexualDecision.modelUsed,
                    pipelineTrace: trace,
                    pipelineError: null,
                    createdAt: now,
                  },
                });
              } catch { /* non-fatal */ }

              return;
            }

          } catch (intentErr) {
            const sexualIntentLatency = Date.now() - sexualIntentStartTime;
            console.error('[Instagram Webhook] Sexual intent classification failed, continuing normal flow:', intentErr);
            trace.sexualIntent = {
              action: 'allow',
              confidence: 0,
              reason: `Classification error: ${intentErr instanceof Error ? intentErr.message : String(intentErr)}`,
              modelUsed: 'error',
              latencyMs: sexualIntentLatency,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            };
          }

          // Context service: analyze message for intent, model routing, and conversation history
          const contextService = new InstagramContextService(db);
          let analysis: MessageAnalysis;
          let simpleTurnUsed = false;
          const contextStartTime = Date.now();
          let inboundInteractionId: string | null = null;
          try {
            const simpleAnalysis = contextService.analyzeSimpleTurn(senderId, messageText);
            if (simpleAnalysis) {
              analysis = simpleAnalysis;
              simpleTurnUsed = true;
              markFastLane(trace, 'simple_analysis', ['context_planner']);
            } else {
              analysis = await contextService.analyzeMessage(senderId, messageText);
            }
            // Initialize trace from analysis
            trace.intentCategories = analysis.intentCategories;
            trace.matchedKeywords = analysis.matchedKeywords;
            trace.modelTier = analysis.modelTier;
            trace.modelId = analysis.modelId;
            trace.tierReason = analysis.tierReason;
            trace.isNewCustomer = analysis.isNewCustomer;
            
            // Add conversation history to trace for debugging
            trace.conversationHistory = {
              messageCount: analysis.conversationHistory.length,
              messages: analysis.conversationHistory.map(entry => ({
                direction: entry.direction,
                text: entry.messageText.substring(0, 100), // Truncate for trace
                timestamp: entry.createdAt,
                relativeTime: entry.relativeTime,
              })),
              formattedForAI: analysis.formattedHistory.substring(0, 500), // Preview
              followUpHint: analysis.followUpHint,
              activeState: analysis.conversationState,
              responseDirective: analysis.responseDirective,
            };
          } catch (contextErr: any) {
            // Context service error — use defaults and record error
            analysis = {
              conversationHistory: [],
              formattedHistory: '',
              intentCategories: ['general', 'faq'],
              matchedKeywords: [],
              followUpHint: null,
              activeTopicLabel: null,
              conversationState: null,
              responseDirective: {
                mode: 'answer_directly' as const,
                instruction: 'Bu mesaji bagimsiz bir soru olarak ele al. Bildigin net bilgiyi dogrudan ver. Gerekirse en fazla bir kisa netlestirme sorusu sor.',
                rationale: 'Varsayilan guvenli davranis',
              },
              tierReason: 'Varsayılan model (hata durumu) → standard',
              modelTier: 'standard' as const,
              modelId: 'openai/gpt-4o-mini',
              isNewCustomer: true,
              totalInteractions: 0,
              usageTrace: [],
            };
            trace.intentCategories = analysis.intentCategories;
            trace.matchedKeywords = [];
            trace.modelTier = analysis.modelTier;
            trace.modelId = analysis.modelId;
            trace.tierReason = analysis.tierReason;
            trace.isNewCustomer = true;
            pipelineError = {
              stage: 'context_error',
              message: contextErr?.message || String(contextErr),
              timestamp: new Date().toISOString(),
              partialTrace: { ...trace },
            };
            console.error('[Instagram Webhook] Context service error (using defaults):', contextErr);
            // Continue with defaults - don't bail out
          } finally {
            contextAnalysisMs = Date.now() - contextStartTime;
          }

          // Log inbound message to DB FIRST — so conversation history is available
          // for the AI response. Without this, getConversationHistory() returns stale data.
          try {
            // Ensure customer exists (FK constraint) before logging interaction
            const now = new Date().toISOString();
            db.prepare(`
              INSERT INTO instagram_customers (instagram_id, interaction_count, created_at, updated_at)
              VALUES (?, 0, ?, ?)
              ON CONFLICT(instagram_id) DO UPDATE SET updated_at = excluded.updated_at
            `).run(senderId, now, now);

            const inboundId = randomUUID();
            const intentStr = analysis?.intentCategories?.join(',') || 'unknown';
            db.prepare(`
              INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, execution_id, created_at)
              VALUES (?, ?, 'inbound', ?, ?, ?, ?)
            `).run(inboundId, senderId, messageText, intentStr, executionId, now);
            inboundInteractionId = inboundId;
            console.log('[Instagram Webhook] Inbound message logged to DB (execution: %s)', executionId);
          } catch (inboundLogErr) {
            console.error('[Instagram Webhook] Failed to log inbound message:', inboundLogErr);
          }

          // Push inbound DM event
          try {
            DmSSEManager.getInstance().pushEvent({
              type: 'dm:new',
              data: {
                id: `dm_${Date.now()}`,
                instagramId: senderId,
                direction: 'inbound',
                messageText: messageText.substring(0, 200),
                responseTimeMs: null,
                modelTier: null,
                modelUsed: null,
                pipelineTrace: null,
                pipelineError: null,
                createdAt: new Date().toISOString(),
              },
            });
          } catch { /* non-fatal */ }

          const categories: Set<string> = new Set(analysis.intentCategories);
          if (hasAgePolicySignals(messageText, analysis.followUpHint?.rewrittenQuestion, analysis.activeTopicLabel)) {
            categories.add('policies');
          }
          categories.add('contact');

          const customerSummary = analysis.isNewCustomer
            ? 'YENI MUSTERI'
            : analysis.totalInteractions > 0 && analysis.conversationHistory.length === 0
              ? `Geri gelen musteri (toplam ${analysis.totalInteractions} mesaj, son 24 saatte mesaj yok)`
              : `Etkilesim: ${analysis.totalInteractions}`;
          const conductStateForReply = trace.conductControl?.state || 'normal';
          const pipelineConfigService = new PipelineConfigService(db);
          const pipelineConfig = pipelineConfigService.getConfig();
          let humanizerFirstInputLength: number | null = null;
          let humanizerLastOutputLength = 0;
          let humanizerApplied = false;
          const humanizerRuleIds = new Set<string>();
          const updateHumanizerTrace = (humanizerTrace: TurkishDMHumanizerTrace): void => {
            if (humanizerFirstInputLength === null) {
              humanizerFirstInputLength = humanizerTrace.inputLength;
            }
            humanizerLastOutputLength = humanizerTrace.outputLength;
            humanizerApplied = humanizerApplied || humanizerTrace.applied;
            humanizerTrace.ruleIds.forEach(ruleId => humanizerRuleIds.add(ruleId));

            if ((pipelineConfig.humanizer.enabled && pipelineConfig.humanizer.traceEnabled) || humanizerApplied) {
              trace.humanizer = {
                enabled: pipelineConfig.humanizer.enabled,
                mode: pipelineConfig.humanizer.mode,
                applied: humanizerApplied,
                ruleIds: Array.from(humanizerRuleIds),
                inputLength: humanizerFirstInputLength ?? humanizerTrace.inputLength,
                outputLength: humanizerLastOutputLength,
              };
            }
          };
          const finalizeResponseText = (responseText: string): string => {
            const result = humanizerService.humanize({
              text: sanitizeConductResponse(responseText, conductStateForReply),
              config: pipelineConfig.humanizer,
              conductState: conductStateForReply,
            });
            updateHumanizerTrace(result.trace);
            return result.text;
          };
          const styleProfile = buildDMStyleProfile({
            customerMessage: messageText,
            conversationHistory: analysis.conversationHistory,
            isNewCustomer: analysis.isNewCustomer,
            followUpHint: analysis.followUpHint,
            conductState: conductStateForReply,
            humanizerEnabled: pipelineConfig.humanizer.enabled,
          });
          trace.responseStyle = styleProfile.trace;
          const configSignature = pipelineConfigService.getConfigSignature(pipelineConfig);
          const useDirectResponse = pipelineConfigService.shouldUseDirectResponseForConfig(pipelineConfig, analysis.modelTier);
          let precomputedSkipPolicy = !pipelineConfig.policy.enabled;
          let precomputedAgentResponse: string | null = null;
          const deterministicTemplates = knowledgeContextService.getDeterministicTemplates();
          const responseCacheClass = simpleTurnUsed ? getResponseCacheClass(messageText, analysis) : null;

          trace.semanticRetrieval = {
            enabled: true,
            strategy: 'sparse_tfidf_chargram',
            queryText: '',
            candidateCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            refreshedIndex: false,
            skippedReason: 'not_run',
          };
          trace.semanticRerank = {
            enabled: true,
            modelId: 'disabled',
            candidateCount: 0,
            selectedCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            skippedReason: 'not_run',
            rationale: null,
          };

          const deterministicConductResponse = getDeterministicConductResponse({
            conductState: conductStateForReply,
            customerMessage: messageText,
            matchedKeywords: analysis.matchedKeywords,
            intentCategories: analysis.intentCategories,
          });

          if (deterministicConductResponse) {
            console.log('[Instagram Webhook] Using deterministic conduct response (%s)', deterministicConductResponse.modelId);
            precomputedAgentResponse = deterministicConductResponse.response;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: deterministicConductResponse.modelId,
              tokensEstimated: estimateTokens(deterministicConductResponse.response),
              inputTokens: 0,
              outputTokens: estimateTokens(deterministicConductResponse.response),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-conduct';
            trace.agentPollDurationMs = 0;
            trace.modelId = deterministicConductResponse.modelId;
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_conduct', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal' && deterministicTemplates.genericInfo && isGenericInfoRequest(messageText)) {
            console.log('[Instagram Webhook] Using deterministic info template response');
            precomputedAgentResponse = deterministicTemplates.genericInfo;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: 'deterministic/info-template-v1',
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-info-template';
            trace.agentPollDurationMs = 0;
            trace.modelId = 'deterministic/info-template-v1';
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_info_template', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal' && deterministicTemplates.pilatesInfo && isPilatesInfoRequest(messageText)) {
            console.log('[Instagram Webhook] Using deterministic pilates template response');
            precomputedAgentResponse = deterministicTemplates.pilatesInfo;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: PILATES_INFO_MODEL_ID,
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-pilates-info';
            trace.agentPollDurationMs = 0;
            trace.modelId = PILATES_INFO_MODEL_ID;
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_pilates_info', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal' && isDirectLocationQuestion(messageText) && deterministicTemplates.contactLocation) {
            precomputedAgentResponse = deterministicTemplates.contactLocation;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: 'deterministic/contact-location-v1',
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-contact-location';
            trace.agentPollDurationMs = 0;
            trace.modelId = 'deterministic/contact-location-v1';
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_contact_location', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal' && isDirectPhoneQuestion(messageText) && deterministicTemplates.contactPhone) {
            precomputedAgentResponse = deterministicTemplates.contactPhone;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: 'deterministic/contact-phone-v1',
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-contact-phone';
            trace.agentPollDurationMs = 0;
            trace.modelId = 'deterministic/contact-phone-v1';
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_contact_phone', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse
            && conductStateForReply === 'normal'
            && analysis.matchedKeywords.includes('standalone_hours_request')
            && analysis.matchedKeywords.includes('standalone_appointment_request')
            && deterministicTemplates.hoursWithAppointment) {
            precomputedAgentResponse = deterministicTemplates.hoursWithAppointment;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: HOURS_APPOINTMENT_MODEL_ID,
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-hours-appointment';
            trace.agentPollDurationMs = 0;
            trace.modelId = HOURS_APPOINTMENT_MODEL_ID;
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_hours_appointment', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal' && analysis.matchedKeywords.includes('standalone_hours_request') && deterministicTemplates.generalHours) {
            precomputedAgentResponse = deterministicTemplates.generalHours;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: 'deterministic/hours-general-v1',
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-hours-general';
            trace.agentPollDurationMs = 0;
            trace.modelId = 'deterministic/hours-general-v1';
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_hours', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal' && isStandaloneAppointmentRequest(messageText) && deterministicTemplates.appointmentBooking) {
            precomputedAgentResponse = deterministicTemplates.appointmentBooking;
            trace.directResponse = {
              used: true,
              latencyMs: 0,
              modelId: APPOINTMENT_MODEL_ID,
              tokensEstimated: estimateTokens(precomputedAgentResponse),
              inputTokens: 0,
              outputTokens: estimateTokens(precomputedAgentResponse),
            };
            trace.openclawDispatchStatus = 'skipped' as any;
            trace.openclawSessionKey = 'deterministic-appointment';
            trace.agentPollDurationMs = 0;
            trace.modelId = APPOINTMENT_MODEL_ID;
            precomputedSkipPolicy = true;
            markFastLane(trace, 'deterministic_appointment', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal') {
            const deterministicCloseout = buildDeterministicCloseoutResponse(messageText);
            if (deterministicCloseout) {
              trace.directResponse = {
                used: true,
                latencyMs: 0,
                modelId: deterministicCloseout.modelId,
                tokensEstimated: estimateTokens(deterministicCloseout.response || ''),
                inputTokens: 0,
                outputTokens: estimateTokens(deterministicCloseout.response || ''),
              };
              trace.openclawDispatchStatus = 'skipped' as any;
              trace.openclawSessionKey = 'deterministic-closeout';
              trace.agentPollDurationMs = 0;
              trace.modelId = deterministicCloseout.modelId;
              precomputedSkipPolicy = true;

              if (deterministicCloseout.action === 'skip_send') {
                trace.knowledgeCategoriesFetched = [];
                trace.knowledgeFetchStatus = 'skipped';
                trace.knowledgeEntriesCount = 0;
                trace.semanticRetrieval.skippedReason = 'fast_lane_no_reply';
                trace.semanticRerank.skippedReason = 'fast_lane_no_reply';
                trace.policyValidation = {
                  status: 'skipped',
                  attempts: 0,
                  totalLatencyMs: 0,
                  totalTokens: 0,
                };
                trace.metaSendStatus = 'skipped';
                markFastLane(trace, 'deterministic_closeout', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation', 'meta_send']);

                const safetyTokens = trace.sexualIntent?.totalTokens || 0;
                const contextTokens = (analysis.usageTrace || []).reduce(
                  (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
                  0,
                );
                trace.tokensEstimated = safetyTokens + contextTokens;
                trace.totalResponseTimeMs = Date.now() - startTime;
                const safetyFilterMs = trace.sexualIntent?.latencyMs || 0;
                const uncategorizedMs = Math.max(0, trace.totalResponseTimeMs - safetyFilterMs - contextAnalysisMs);
                trace.timingBreakdown = {
                  ingestDelayMs,
                  customerPerceivedTotalMs: ingestDelayMs != null ? ingestDelayMs + trace.totalResponseTimeMs : null,
                  safetyFilterMs,
                  contextAnalysisMs,
                  knowledgeAssemblyMs: 0,
                  openclawDispatchMs: 0,
                  metaSendMs: 0,
                  uncategorizedMs,
                };
                trace.tokenBreakdown = {
                  safetyTokens,
                  contextTokens,
                  rerankTokens: 0,
                  directTokens: 0,
                  directInputTokens: 0,
                  directOutputTokens: 0,
                  policyTokens: 0,
                  totalTokens: trace.tokensEstimated,
                };

                try {
                  contextService.clearConversationState(senderId);
                } catch (stateErr) {
                  console.error('[Instagram Webhook] Failed to clear conversation state:', stateErr);
                }

                if (inboundInteractionId) {
                  try {
                    db.prepare(`
                      UPDATE instagram_interactions
                      SET pipeline_trace = ?, pipeline_error = ?, model_tier = ?, model_used = ?
                      WHERE id = ?
                    `).run(
                      JSON.stringify(trace),
                      pipelineError ? JSON.stringify(pipelineError) : null,
                      analysis.modelTier,
                      deterministicCloseout.modelId,
                      inboundInteractionId,
                    );
                  } catch (traceStoreErr) {
                    console.error('[Instagram Webhook] Failed to store no-reply pipeline trace:', traceStoreErr);
                  }
                }

                return;
              }

              precomputedAgentResponse = deterministicCloseout.response;
              markFastLane(trace, 'deterministic_closeout', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
            }
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal') {
            const clarifyExhaustedContact = buildClarifyExhaustedContactResponse({
              messageText,
              conversationHistory: analysis.conversationHistory,
              responseMode: analysis.responseDirective.mode,
              fallbackMessage: pipelineConfig.fallbackMessage || deterministicTemplates.contactPhone,
            });

            if (clarifyExhaustedContact) {
              console.log(
                '[Instagram Webhook] Clarification budget exhausted, using contact fallback (%s clarifications)',
                clarifyExhaustedContact.clarificationCount,
              );
              precomputedAgentResponse = clarifyExhaustedContact.response;
              trace.directResponse = {
                used: true,
                latencyMs: 0,
                modelId: CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
                tokensEstimated: estimateTokens(clarifyExhaustedContact.response),
                inputTokens: 0,
                outputTokens: estimateTokens(clarifyExhaustedContact.response),
              };
              trace.openclawDispatchStatus = 'skipped' as any;
              trace.openclawSessionKey = 'deterministic-contact-fallback';
              trace.agentPollDurationMs = 0;
              trace.modelId = CLARIFY_EXHAUSTED_CONTACT_MODEL_ID;
              precomputedSkipPolicy = true;
              markFastLane(trace, 'deterministic_contact_fallback', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
            }
          }

          if (!precomputedAgentResponse && conductStateForReply === 'normal') {
            const deterministicClarifier = buildDeterministicClarifierResponse({
              messageText,
              intentCategories: analysis.intentCategories,
              responseMode: analysis.responseDirective.mode,
              semanticSignals: analysis.matchedKeywords,
            });

            if (deterministicClarifier) {
              console.log('[Instagram Webhook] Using deterministic clarifier response (%s)', deterministicClarifier.modelId);
              precomputedAgentResponse = deterministicClarifier.response;
              trace.directResponse = {
                used: true,
                latencyMs: 0,
                modelId: deterministicClarifier.modelId,
                tokensEstimated: estimateTokens(deterministicClarifier.response),
                inputTokens: 0,
                outputTokens: estimateTokens(deterministicClarifier.response),
              };
              trace.openclawDispatchStatus = 'skipped' as any;
              trace.openclawSessionKey = 'deterministic-clarifier';
              trace.agentPollDurationMs = 0;
              trace.modelId = deterministicClarifier.modelId;
              precomputedSkipPolicy = true;
              markFastLane(trace, 'deterministic_clarifier', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
            }
          }

          if (!precomputedAgentResponse && responseCacheClass) {
            const lookupParams = {
              cacheClass: responseCacheClass,
              normalizedMessage: DMResponseCacheService.normalizeMessage(messageText),
              kbSignature: knowledgeContextService.getActiveSignature(),
              configSignature,
              conductState: conductStateForReply,
            };

            if (shouldLookupResponseCache({
              messageText,
              analysis,
              conductState: conductStateForReply,
              sexualAction: trace.sexualIntent?.action || 'allow',
            })) {
              setCacheTrace(trace, {
                eligible: true,
                cacheClass: responseCacheClass,
                lookupKey: responseCacheService.buildLookupKey(lookupParams),
              });
              const cacheHit = responseCacheService.lookupActive(lookupParams);
              if (cacheHit) {
                precomputedAgentResponse = cacheHit.responseText;
                trace.directResponse = {
                  used: true,
                  latencyMs: 0,
                  modelId: `cache/${responseCacheClass}`,
                  tokensEstimated: estimateTokens(precomputedAgentResponse),
                  inputTokens: 0,
                  outputTokens: estimateTokens(precomputedAgentResponse),
                };
                trace.openclawDispatchStatus = 'skipped' as any;
                trace.openclawSessionKey = 'response-cache';
                trace.agentPollDurationMs = 0;
                trace.modelId = `cache/${responseCacheClass}`;
                precomputedSkipPolicy = true;
                markFastLane(trace, 'response_cache', ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation']);
                setCacheTrace(trace, {
                  hit: true,
                  status: cacheHit.status,
                  sourceExecutionId: cacheHit.sourceExecutionId,
                  observationCount: cacheHit.observationCount,
                });
              } else {
                setCacheTrace(trace, {
                  eligible: true,
                  cacheClass: responseCacheClass,
                  hit: false,
                  status: 'miss',
                });
              }
            } else {
              setCacheTrace(trace, {
                eligible: false,
                cacheClass: responseCacheClass,
                lookupKey: responseCacheService.buildLookupKey(lookupParams),
                status: 'ineligible',
              });
            }
          }

          try {
            const knowledgeStartTime = Date.now();
            let knowledgeContext = '';
            let knowledgeEntriesCount = 0;
            let selectedEvidence = '';
            let formattedKnowledge = '';
            if (precomputedAgentResponse) {
              trace.knowledgeCategoriesFetched = [];
              trace.knowledgeFetchStatus = 'skipped';
              trace.knowledgeEntriesCount = 0;
              trace.semanticRetrieval = {
                enabled: true,
                strategy: 'sparse_tfidf_chargram',
                queryText: '',
                candidateCount: 0,
                selectedEntries: [],
                latencyMs: 0,
                refreshedIndex: false,
                skippedReason: 'fast_lane_skip',
              };
              trace.semanticRerank = {
                enabled: true,
                modelId: 'disabled',
                candidateCount: 0,
                selectedCount: 0,
                selectedEntries: [],
                latencyMs: 0,
                skippedReason: 'fast_lane_skip',
                rationale: null,
              };
            } else {
            // Fetch category-filtered knowledge context
            // Always include 'contact' — the phone number and address are referenced
            // in the system prompt and fallback message, so the policy agent needs
            // to see them to avoid false "hallucination" flags.
            const categories: Set<string> = new Set(analysis.intentCategories);
            if (hasAgePolicySignals(messageText, analysis.followUpHint?.rewrittenQuestion, analysis.activeTopicLabel)) {
              categories.add('policies');
            }
            categories.add('contact');
            const enrichKnowledge = shouldRunSemanticEnrichment(messageText, analysis, simpleTurnUsed);
            trace.semanticRetrieval = {
              enabled: true,
              strategy: 'sparse_tfidf_chargram',
              queryText: '',
              candidateCount: 0,
              selectedEntries: [],
              latencyMs: 0,
              refreshedIndex: false,
              skippedReason: 'not_run',
            };
            trace.semanticRerank = {
              enabled: true,
              modelId: 'disabled',
              candidateCount: 0,
              selectedCount: 0,
              selectedEntries: [],
              latencyMs: 0,
              skippedReason: 'not_run',
              rationale: null,
            };
            const filteredKnowledge = knowledgeContextService.getFilteredContext(categories);
            knowledgeContext = filteredKnowledge.json;
            knowledgeEntriesCount = filteredKnowledge.entryCount;

            if (enrichKnowledge) {
              try {
                const semanticRetrieval = semanticKnowledgeService.findCandidates({
                  baseContextJson: knowledgeContext,
                  messageText,
                  followUpHint: analysis.followUpHint,
                  activeTopic: analysis.activeTopicLabel,
                  primaryCategories: categories,
                  maxCandidates: 8,
                });

                trace.semanticRetrieval = semanticRetrieval.trace;

                const rerankResult = await semanticReranker.rerank({
                  messageText,
                  followUpHint: analysis.followUpHint,
                  activeTopic: analysis.activeTopicLabel,
                  requestedCategories: Array.from(categories),
                  candidates: semanticRetrieval.candidates,
                  maxSelections: 3,
                });
                trace.semanticRerank = rerankResult.trace;
                selectedEvidence = formatSelectedEvidenceBlock(rerankResult.selectedCandidates);

                if (rerankResult.selectedCandidates.length > 0) {
                  const mergedKnowledge = semanticKnowledgeService.applyCandidatesToContext(
                    knowledgeContext,
                    rerankResult.selectedCandidates,
                  );
                  knowledgeContext = mergedKnowledge.knowledgeContext;
                  knowledgeEntriesCount += mergedKnowledge.addedEntriesCount;
                  for (const addedCategory of mergedKnowledge.addedCategories) {
                    categories.add(addedCategory);
                  }
                }
              } catch (semanticRetrievalErr) {
                console.error('[Instagram Webhook] Semantic KB retrieval/rerank failed:', semanticRetrievalErr);
                trace.semanticRetrieval = {
                  enabled: true,
                  strategy: 'sparse_tfidf_chargram',
                  queryText: '',
                  candidateCount: 0,
                  selectedEntries: [],
                  latencyMs: 0,
                  refreshedIndex: false,
                  skippedReason: 'error',
                };
                trace.semanticRerank = {
                  enabled: true,
                  modelId: 'disabled',
                  candidateCount: 0,
                  selectedCount: 0,
                  selectedEntries: [],
                  latencyMs: 0,
                  skippedReason: 'error',
                  rationale: null,
                };
              }

              try {
                const supportEntries = knowledgeContextService.getSupportEntries().entries;
                const knowledgeSelector = new KnowledgeSelectionService(supportEntries);
                const augmentedKnowledge = knowledgeSelector.augmentContext({
                  baseContextJson: knowledgeContext,
                  messageText,
                  followUpHint: analysis.followUpHint,
                  primaryCategories: categories,
                });

                if (augmentedKnowledge.addedEntriesCount > 0) {
                  knowledgeContext = augmentedKnowledge.knowledgeContext;
                  knowledgeEntriesCount += augmentedKnowledge.addedEntriesCount;
                  for (const addedCategory of augmentedKnowledge.addedCategories) {
                    categories.add(addedCategory);
                  }
                }
              } catch (knowledgeSelectionErr) {
                console.error('[Instagram Webhook] Knowledge selection supplement failed:', knowledgeSelectionErr);
              }
            } else {
              trace.semanticRetrieval = {
                enabled: true,
                strategy: 'sparse_tfidf_chargram',
                queryText: '',
                candidateCount: 0,
                selectedEntries: [],
                latencyMs: 0,
                refreshedIndex: false,
                skippedReason: 'simple_turn_skip',
              };
              trace.semanticRerank = {
                enabled: true,
                modelId: 'disabled',
                candidateCount: 0,
                selectedCount: 0,
                selectedEntries: [],
                latencyMs: 0,
                skippedReason: 'simple_turn_skip',
                rationale: null,
              };
            }

            // Update trace — knowledge fetch stage
            trace.knowledgeCategoriesFetched = Array.from(categories);
            trace.knowledgeFetchStatus = 'success';
            trace.knowledgeEntriesCount = knowledgeEntriesCount;

            // Format KB from raw JSON into clean labeled Turkish text.
            // Raw JSON like {"contact":{"address":"..."}} is hard for LLMs to parse —
            // they sometimes ignore JSON values and hallucinate from training data.
            // Plain text with clear labels eliminates this failure mode.
            formattedKnowledge = await InstagramContextService.formatKnowledgeForPrompt(knowledgeContext);
            knowledgeAssemblyMs = Date.now() - knowledgeStartTime;
            }

            // Build enriched message — agent just needs to generate Turkish text
            // Keep prompt minimal to save tokens — instructions are in AGENTS.md core files
            const skipPolicy = precomputedSkipPolicy;
            let agentResponse: string | null = precomputedAgentResponse;

            // ═══════════════════════════════════════════════════════════════
            // PIPELINE CONFIG — Dynamic routing (direct vs OpenClaw)
            // Config stored in mc_policies, editable via /dm-kontrol/pipeline-config
            // ═══════════════════════════════════════════════════════════════
            if (!agentResponse && useDirectResponse) {
              // ═══════════════════════════════════════════════════════════
              // DIRECT RESPONSE PATH — Bypass OpenClaw for eligible tiers
              // Saves ~8-10s by calling OpenRouter directly
              // ═══════════════════════════════════════════════════════════
              const directService = new DirectResponseService();
              const tierConfig = pipelineConfig.directResponse.tiers[analysis.modelTier];
              const systemPrompt = pipelineConfigService.buildDirectSystemPromptForConfig(pipelineConfig, formattedKnowledge);

              console.log('[Instagram Webhook] Using DIRECT response path (tier: %s, model: %s)', analysis.modelTier, tierConfig.modelId);

              const directResult = await directService.generate({
                customerMessage: messageText,
                knowledgeContext: formattedKnowledge,
                selectedEvidence,
                conversationHistory: analysis.formattedHistory,
                styleInstructions: styleProfile.instructions,
                followUpHint: analysis.followUpHint,
                responseDirective: analysis.responseDirective,
                customerSummary,
                isNewCustomer: analysis.isNewCustomer,
                tierConfig,
                systemPrompt,
              });

              // Record in trace
              trace.directResponse = {
                used: true,
                latencyMs: directResult.latencyMs,
                modelId: directResult.modelId,
                tokensEstimated: directResult.tokensEstimated,
                inputTokens: directResult.usage?.inputTokens,
                outputTokens: directResult.usage?.outputTokens,
              };
              trace.openclawDispatchStatus = 'skipped' as any;
              trace.openclawSessionKey = 'direct';
              trace.agentPollDurationMs = 0;

              if (directResult.success && directResult.response) {
                agentResponse = directResult.response;
                // Override modelId to the one actually used
                trace.modelId = directResult.modelId;
              } else {
                // Direct response failed — fall back to OpenClaw
                console.warn('[Instagram Webhook] Direct response failed (%s), falling back to OpenClaw', directResult.error);
                trace.directResponse.used = false;
              }
            }

            // If direct response wasn't used or failed, use OpenClaw pipeline
            if (!agentResponse) {
              const enrichedMessage = [
                `Instagram DM yanit gorevi. Sadece Turkce metin yaz. ARAC KULLANMA.`,
                `KRITIK: Yanitindaki HER bilgi asagidaki BILGI_BANKASI'ndan gelmeli. BILGI_BANKASI'nda OLMAYAN bilgi YAZMA.`,
                `Sadece musterinin sorusuna cevap ver. Sorulmayan bilgiyi PAYLASMA.`,
                `Musteri "merhaba" dediyse: sadece selamla + "Size nasil yardimci olabilirim?" de. Baska bilgi VERME.`,
                styleProfile.instructions,
                `YANIT MODU: ${analysis.responseDirective.mode}`,
                `YANIT TALIMATI: ${analysis.responseDirective.instruction}`,
                `YANIT GEREKCESI: ${analysis.responseDirective.rationale}`,
                analysis.followUpHint ? `DEVAM EDEN KONU: ${analysis.followUpHint.topicLabel}` : '',
                analysis.followUpHint ? `BU MESAJI SU NET SORU GIBI ELE AL: ${analysis.followUpHint.rewrittenQuestion}` : '',
                analysis.followUpHint ? `MUSTERIYE TEKRAR "HANGI HIZMET" DIYE SORMA.` : '',
                selectedEvidence ? `ONCELIKLI KANIT:` : '',
                selectedEvidence || '',
                selectedEvidence ? `ONCE BU SECILMIS KANITTAN YANIT KUR. GEREKIRSE SONRA BILGI BANKASIYLA TAMAMLA.` : '',
                '',
                `MUSTERI MESAJI: ${messageText}`,
                '',
                `BILGI BANKASI:`,
                formattedKnowledge || '(bilgi alinamadi)',
                '',
                `MUSTERI: ${customerSummary}`,
                analysis.formattedHistory ? `\nSON KONUSMA:\n${analysis.formattedHistory}` : '',
              ].filter(Boolean).join('\n');
              estimatedPrimaryInputTokens = estimateTokens(enrichedMessage);

              // Send to OpenClaw /hooks/instagram (matches hook mapping)
              const sessionKey = `hook:instagram:${senderId}`;
              const fullSessionKey = `agent:main:${sessionKey}`;
              const hookUrl = OPENCLAW_WEBHOOK_URL.replace(/\/hooks\/.*$/, '/hooks/instagram');
              
              // Record dispatch time — only poll for responses AFTER this timestamp
              const dispatchTime = new Date().toISOString();
              console.log('[Instagram Webhook] Forwarding to OpenClaw /hooks/instagram (dispatchTime: %s)', dispatchTime);
              const openclawDispatchStartTime = Date.now();
              const openclawResponse = await fetch(hookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${OPENCLAW_HOOKS_TOKEN}`,
                },
                body: JSON.stringify({
                  message: enrichedMessage,
                  senderId,
                  text: messageText,
                  name: 'Instagram DM',
                  sessionKey,
                  wakeMode: 'now',
                  deliver: false,
                  model: analysis.modelId,
                }),
              });
              openclawDispatchMs = Date.now() - openclawDispatchStartTime;
              const ocBody = await openclawResponse.json() as Record<string, unknown>;
              console.log('[Instagram Webhook] OpenClaw response:', openclawResponse.status, ocBody);

              // Update trace — OpenClaw dispatch stage
              const ocStatusAccepted = openclawResponse.status >= 200 && openclawResponse.status < 300;
              const ocBodyAccepted = (
                ocBody.ok === true
                || ocBody.status === 'accepted'
                || ocBody.status === 'queued'
                || typeof ocBody.runId === 'string'
              );
              const ocAccepted = ocStatusAccepted || ocBodyAccepted;
              trace.openclawDispatchStatus = ocAccepted ? 'success' : 'fail';
              trace.openclawSessionKey = fullSessionKey;

              if (!ocAccepted) {
                console.error('[Instagram Webhook] OpenClaw rejected:', { status: openclawResponse.status, body: ocBody });
                pipelineError = {
                  stage: 'openclaw_dispatch_fail',
                  message: JSON.stringify({ status: openclawResponse.status, body: ocBody }),
                  timestamp: new Date().toISOString(),
                  partialTrace: { ...trace },
                };
                storePipelineTraceAndPushSSE(senderId, trace, pipelineError, analysis.modelTier, 'outbound', messageText, null, analysis.modelId);
                return;
              }
              // Poll for agent response from session JSONL (uses dynamic config)
              console.log('[Instagram Webhook] Polling for instagram agent response...');
              const pollStartTime = Date.now();
              agentResponse = await pollAgentResponse(fullSessionKey, pipelineConfig.polling.maxWaitMs, dispatchTime);
              trace.agentPollDurationMs = Date.now() - pollStartTime;

              if (!agentResponse) {
                console.error('[Instagram Webhook] Agent response timeout after %dms', pipelineConfig.polling.maxWaitMs);
                pipelineError = {
                  stage: 'openclaw_timeout',
                  message: `Agent response timeout after ${pipelineConfig.polling.maxWaitMs}ms`,
                  timestamp: new Date().toISOString(),
                  partialTrace: { ...trace },
                };
                storePipelineTraceAndPushSSE(senderId, trace, pipelineError, analysis.modelTier, 'outbound', messageText, null, analysis.modelId);
                return;
              }
            }

            const responseTime = Date.now() - startTime;
            console.log('[Instagram Webhook] Agent response received (%dms, direct=%s): %s',
              responseTime, !!trace.directResponse?.used, agentResponse.substring(0, 100) + '...');

            // ═══════════════════════════════════════════════════════════════
            // POLICY AGENT — Validate response before sending to customer
            // Can be skipped per-tier via pipeline config
            // See: backend/src/services/ResponsePolicyService.ts for rules
            // ═══════════════════════════════════════════════════════════════
            const policyService = new ResponsePolicyService();
            const MAX_POLICY_RETRIES = pipelineConfig.policy.maxRetries;
            let finalResponse = finalizeResponseText(agentResponse);
            let policyTotalLatencyMs = 0;
            let policyTotalTokens = 0;
            let policyAttempts = 0;
            let policyStatus: 'pass' | 'fail' | 'corrected' | 'fallback' | 'skipped' = skipPolicy ? 'skipped' : 'pass';
            let lastValidation: PolicyValidationResult | null = null;
            let firstRejection: { violations: string[]; reason: string } | null = null;
            const policyUsageEntries: ModelUsageEntry[] = [];
            const validationModelId = pipelineConfig.policy.validationModel;

            if (skipPolicy) {
              console.log('[PolicyAgent] Skipped for fast-lane/config path (tier=%s)', analysis.modelTier);
            } else {
              // Validation + retry loop
              for (let attempt = 1; attempt <= MAX_POLICY_RETRIES + 1; attempt++) {
                policyAttempts = attempt;
                const validation = await policyService.validate({
                  customerMessage: messageText,
                  agentResponse: finalResponse,
                  knowledgeContext: formattedKnowledge,
                  selectedEvidence,
                  followUpHint: analysis.followUpHint,
                  activeTopic: analysis.activeTopicLabel,
                  responseDirective: analysis.responseDirective,
                }, validationModelId, attempt);
                lastValidation = validation;
                policyTotalLatencyMs += validation.latencyMs;
                policyTotalTokens += validation.tokensEstimated;
                addModelUsageEntry(
                  policyUsageEntries,
                  validation.usageModelUsed || validation.modelUsed,
                  validation.usage?.inputTokens,
                  validation.usage?.outputTokens,
                );

                if (validation.valid) {
                  policyStatus = attempt === 1 ? 'pass' : 'corrected';
                  console.log('[PolicyAgent] Response %s (attempt %d, %dms)',
                    policyStatus, attempt, validation.latencyMs);
                  break;
                }

                // Capture first rejection for trace
                if (!firstRejection) {
                  firstRejection = {
                    violations: [...validation.violations],
                    reason: validation.reason || '',
                  };
                }

                console.warn('[PolicyAgent] REJECTED (attempt %d): %s | violations: %s',
                  attempt, validation.reason, validation.violations.join(', '));

                // If we have retries left, generate corrected response directly via OpenRouter
                if (attempt <= MAX_POLICY_RETRIES) {
                  const correctionModelId = pipelineConfigService.getCorrectionModelForConfig(pipelineConfig, analysis.modelId);
                  const correction = await policyService.generateCorrectedResponse(
                    messageText,
                    finalResponse,
                    validation,
                    formattedKnowledge,
                    correctionModelId,
                    {
                      selectedEvidence,
                      followUpHint: analysis.followUpHint,
                      activeTopic: analysis.activeTopicLabel,
                      responseDirective: analysis.responseDirective,
                    },
                  );
                  policyTotalLatencyMs += correction.latencyMs;
                  policyTotalTokens += correction.tokensEstimated;
                  addModelUsageEntry(
                    policyUsageEntries,
                    correction.modelUsed,
                    correction.usage?.inputTokens,
                    correction.usage?.outputTokens,
                  );

                  if (correction.response) {
                    finalResponse = finalizeResponseText(correction.response);
                    console.log('[PolicyAgent] Direct correction ready (attempt %d, %dms), re-validating...', attempt + 1, correction.latencyMs);
                    continue;
                  }

                  // If correction failed, fall through to fallback
                  console.warn('[PolicyAgent] Direct correction attempt %d failed, using fallback', attempt);
                }

                // All retries exhausted — use safe fallback
                policyStatus = 'fallback';
                finalResponse = finalizeResponseText(pipelineConfig.fallbackMessage);
                console.warn('[PolicyAgent] All retries exhausted, using safe fallback response');
              }
            }

            // Record policy validation in trace
            trace.policyValidation = {
              status: policyStatus,
              attempts: policyAttempts,
              totalLatencyMs: policyTotalLatencyMs,
              totalTokens: policyTotalTokens,
              violations: lastValidation?.violations,
              reason: lastValidation?.reason,
              modelUsed: lastValidation?.usageModelUsed || lastValidation?.modelUsed,
              originalViolations: firstRejection?.violations,
              originalReason: firstRejection?.reason,
            };

            // If policy resulted in fallback, record as pipeline error
            if (policyStatus === 'fallback' && lastValidation) {
              pipelineError = {
                stage: 'policy_validation_fail',
                message: `Policy validation failed after ${policyAttempts} attempts: ${lastValidation.reason}`,
                timestamp: new Date().toISOString(),
                partialTrace: { ...trace },
              };
            }

            // Send the (validated) response via Meta Graph API
            const metaSendStartTime = Date.now();
            try {
              const sendResult = await sendInstagramText(API_KEY, senderId, finalResponse);
              metaSendDurationMs = Date.now() - metaSendStartTime;
              console.log(
                '[Instagram Webhook] Send result:',
                sendResult.ok ? 200 : (sendResult.status ?? 'error'),
                sendResult,
              );

              // Update trace — Meta send stage
              trace.metaSendStatus = sendResult.ok ? 'success' : 'fail';
              if (!sendResult.ok) {
                trace.metaSendError = JSON.stringify(sendResult);
                pipelineError = {
                  stage: 'meta_send_fail',
                  message: `Meta send failed at chunk ${sendResult.failedChunk || '?'} of ${sendResult.chunkCount}${sendResult.status ? ` (status ${sendResult.status})` : ''}`,
                  timestamp: new Date().toISOString(),
                  partialTrace: { ...trace },
                };
              }
            } catch (sendErr: any) {
              metaSendDurationMs = Date.now() - metaSendStartTime;
              console.error('[Instagram Webhook] Failed to send response:', sendErr);
              trace.metaSendStatus = 'fail';
              trace.metaSendError = sendErr?.message || String(sendErr);
              pipelineError = {
                stage: 'meta_send_fail',
                message: sendErr?.message || String(sendErr),
                timestamp: new Date().toISOString(),
                partialTrace: { ...trace },
              };
            }

            if (shouldWriteResponseCache({
              cacheClass: responseCacheClass,
              messageText,
              analysis: simpleTurnUsed ? analysis : null,
              conductState: conductStateForReply,
              sexualAction: trace.sexualIntent?.action || 'allow',
              metaSendStatus: trace.metaSendStatus || 'skipped',
              policyStatus,
              policyAttempts,
              pipelineError,
              cacheHit: trace.cache?.hit === true,
            })) {
              responseCacheService.recordObservation({
                cacheClass: responseCacheClass,
                normalizedMessage: DMResponseCacheService.normalizeMessage(messageText),
                kbSignature: knowledgeContextService.getActiveSignature(),
                configSignature,
                conductState: conductStateForReply,
                responseText: finalResponse,
                sourceExecutionId: executionId,
              });
              setCacheTrace(trace, {
                eligible: true,
                cacheClass: responseCacheClass,
                lookupKey: responseCacheService.buildLookupKey({
                  cacheClass: responseCacheClass,
                  normalizedMessage: DMResponseCacheService.normalizeMessage(messageText),
                  kbSignature: knowledgeContextService.getActiveSignature(),
                  configSignature,
                  conductState: conductStateForReply,
                }),
                status: trace.cache?.hit ? trace.cache.status : 'candidate',
              });
            }

            // Compute tokens and finalize trace
            const safetyTokens = trace.sexualIntent?.totalTokens || 0;
            const contextTokens = (analysis.usageTrace || []).reduce(
              (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
              0,
            );
            const rerankTokens = trace.semanticRerank?.totalTokens || 0;
            const directTokens = trace.directResponse?.tokensEstimated || 0;
            let directInputTokens = trace.directResponse?.inputTokens;
            let directOutputTokens = trace.directResponse?.outputTokens;
            let estimatedInputTokens = 0;
            let estimatedOutputTokens = 0;

            if (trace.directResponse?.used && directTokens > 0 && (directInputTokens == null || directOutputTokens == null)) {
              const splitDirectTokens = splitEstimatedTokens(directTokens);
              directInputTokens = splitDirectTokens.inputTokens;
              directOutputTokens = splitDirectTokens.outputTokens;
            }

            if (trace.directResponse?.used) {
              trace.tokensEstimated = safetyTokens + contextTokens + rerankTokens + directTokens + policyTotalTokens;
            } else {
              estimatedOutputTokens = estimateTokens(finalResponse);
              estimatedInputTokens = estimatedPrimaryInputTokens > 0
                ? estimatedPrimaryInputTokens
                : estimateTokens([
                    messageText,
                    formattedKnowledge,
                    selectedEvidence,
                    styleProfile.instructions,
                  ].filter(Boolean).join('\n'));
              trace.tokensEstimated =
                safetyTokens +
                contextTokens +
                rerankTokens +
                estimatedInputTokens +
                estimatedOutputTokens +
                policyTotalTokens;
            }
            trace.totalResponseTimeMs = Date.now() - startTime;
            const safetyFilterMs = trace.sexualIntent?.latencyMs || 0;
            const generationMs = trace.directResponse?.used
              ? trace.directResponse.latencyMs || 0
              : trace.agentPollDurationMs || 0;
            const uncategorizedMs = Math.max(
              0,
              trace.totalResponseTimeMs
                - safetyFilterMs
                - contextAnalysisMs
                - knowledgeAssemblyMs
                - openclawDispatchMs
                - generationMs
                - policyTotalLatencyMs
                - metaSendDurationMs,
            );
            trace.timingBreakdown = {
              ingestDelayMs,
              customerPerceivedTotalMs: ingestDelayMs != null ? ingestDelayMs + trace.totalResponseTimeMs : null,
              safetyFilterMs,
              contextAnalysisMs,
              knowledgeAssemblyMs,
              openclawDispatchMs,
              metaSendMs: metaSendDurationMs,
              uncategorizedMs,
            };
            trace.tokenBreakdown = trace.directResponse?.used
              ? {
                  safetyTokens,
                  contextTokens,
                  rerankTokens,
                  directTokens,
                  directInputTokens,
                  directOutputTokens,
                  policyTokens: policyTotalTokens,
                  totalTokens: trace.tokensEstimated,
                }
              : {
                  safetyTokens,
                  contextTokens,
                  rerankTokens,
                  estimatedInputTokens,
                  estimatedOutputTokens,
                  policyTokens: policyTotalTokens,
                  totalTokens: trace.tokensEstimated,
                };

            // Log the interaction
            try {
              const actualModelUsed = trace.directResponse?.used ? trace.directResponse.modelId : analysis.modelId;
              await fetch('http://localhost:3001/api/integrations/instagram/interaction', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({
                  instagramId: senderId,
                  direction: 'outbound',
                  messageText: finalResponse,
                  intent: 'ai_response',
                  aiResponse: finalResponse,
                  responseTime: Date.now() - startTime,
                  modelUsed: actualModelUsed,
                  tokensEstimated: trace.tokensEstimated,
                  executionId,
                }),
              });
              console.log('[Instagram Webhook] Interaction logged');
            } catch (logErr) {
              console.error('[Instagram Webhook] Failed to log interaction:', logErr);
            }

            try {
              contextService.saveConversationState(senderId, messageText, finalResponse, analysis);
            } catch (stateErr) {
              console.error('[Instagram Webhook] Failed to update conversation state:', stateErr);
            }

            // Store pipeline trace in DB and push SSE events
            const finalResponseTime = Date.now() - startTime;
            storePipelineTraceAndPushSSE(senderId, trace, pipelineError, analysis.modelTier, 'outbound', finalResponse, finalResponseTime, trace.directResponse?.used ? trace.directResponse.modelId : analysis.modelId);

            // MC Integration — fire-and-forget
            try {
              const totalTokensForCost = trace.tokensEstimated || 0;
              const actualModelUsedMC = trace.directResponse?.used ? trace.directResponse.modelId : analysis.modelId;
              const costUsageEntries: ModelUsageEntry[] = [];

              addAIUsageTraceEntries(costUsageEntries, analysis.usageTrace);
              addModelUsageEntry(
                costUsageEntries,
                trace.sexualIntent?.modelUsed,
                trace.sexualIntent?.inputTokens,
                trace.sexualIntent?.outputTokens,
              );
              addModelUsageEntry(
                costUsageEntries,
                trace.semanticRerank?.modelId,
                trace.semanticRerank?.inputTokens,
                trace.semanticRerank?.outputTokens,
              );

              if (trace.directResponse?.used) {
                addModelUsageEntry(
                  costUsageEntries,
                  trace.directResponse.modelId,
                  directInputTokens,
                  directOutputTokens,
                );
              } else {
                addModelUsageEntry(
                  costUsageEntries,
                  analysis.modelId,
                  estimatedInputTokens,
                  estimatedOutputTokens,
                );
              }

              for (const usageEntry of policyUsageEntries) {
                costUsageEntries.push(usageEntry);
              }

              if (costUsageEntries.length === 0 && totalTokensForCost > 0) {
                const fallbackSplit = splitEstimatedTokens(totalTokensForCost);
                addModelUsageEntry(
                  costUsageEntries,
                  actualModelUsedMC,
                  fallbackSplit.inputTokens,
                  fallbackSplit.outputTokens,
                );
              }

              const costLedgerEntries = aggregateUsageByModel(costUsageEntries);
              const totalEstimatedCostUsd = costLedgerEntries.reduce(
                (sum, entry) => sum + entry.estimatedCostUsd,
                0,
              );

              const convId = `ig_${senderId}_${Date.now()}`;

              // UPSERT mc_conversations
              db.prepare(`
                INSERT INTO mc_conversations (id, channel, customer_id, status, message_count, last_message_at, created_at, updated_at)
                VALUES (?, 'instagram', ?, 'active', 1, datetime('now'), datetime('now'), datetime('now'))
                ON CONFLICT(channel, customer_id) DO UPDATE SET
                  message_count = message_count + 1,
                  last_message_at = datetime('now'),
                  updated_at = datetime('now')
              `).run(convId, senderId);

              // Get the actual conversation ID (might be existing)
              const conv = db.prepare(`
                SELECT id FROM mc_conversations WHERE channel = 'instagram' AND customer_id = ?
              `).get(senderId) as { id: string } | undefined;
              const actualConvId = conv?.id || convId;

              const insertCostLedger = db.prepare(`
                INSERT INTO mc_cost_ledger (agent_id, model, provider, input_tokens, output_tokens, cost, job_source, created_at)
                VALUES ('instagram-dm', ?, 'openrouter', ?, ?, ?, 'instagram', datetime('now'))
              `);
              for (const costEntry of costLedgerEntries) {
                insertCostLedger.run(
                  costEntry.modelId,
                  costEntry.inputTokens,
                  costEntry.outputTokens,
                  costEntry.estimatedCostUsd,
                );
              }

              // INSERT mc_events
              db.prepare(`
                INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata, created_at)
                VALUES ('conversation', ?, 'dm_response', ?, ?, datetime('now'))
              `).run(
                actualConvId,
                `Instagram DM response (${analysis.modelTier})`,
                JSON.stringify({
                  response_time_ms: finalResponseTime,
                  model: actualModelUsedMC,
                  model_tier: analysis.modelTier,
                  intent_categories: analysis.intentCategories,
                  tokens_estimated: totalTokensForCost,
                  estimated_cost_usd: Number(totalEstimatedCostUsd.toFixed(10)),
                  policy_status: policyStatus,
                  direct_response: !!trace.directResponse?.used,
                })
              );

              console.log('[Instagram Webhook] MC integration logged');

              // Policy violation → create MC event + Workshop job for admin visibility
              const pStatus = policyStatus as string;
              if (pStatus !== 'pass' && pStatus !== 'skipped') {
                const policyEventType = pStatus === 'fallback' ? 'policy_violation_critical' : 'policy_violation_corrected';
                const policyMessage = pStatus === 'fallback'
                  ? `⚠️ Policy Agent: Yanıt ${policyAttempts} denemede düzeltilemedi — yedek yanıt gönderildi`
                  : `🔄 Policy Agent: Yanıt ${policyAttempts}. denemede düzeltildi`;

                // Log policy event
                db.prepare(`
                  INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata, created_at)
                  VALUES ('agent', 'instagram', ?, ?, ?, datetime('now'))
                `).run(
                  policyEventType,
                  policyMessage,
                  JSON.stringify({
                    sender_id: senderId,
                    customer_message: messageText.substring(0, 200),
                    original_response: agentResponse.substring(0, 300),
                    final_response: finalResponse.substring(0, 300),
                    violations: lastValidation?.violations || [],
                    reason: lastValidation?.reason || '',
                    attempts: policyAttempts,
                    policy_latency_ms: policyTotalLatencyMs,
                  })
                );

                // Escalate via EscalationService (handles Telegram + job creation)
                if (_escalationService) {
                  const escalationType = pStatus === 'fallback' ? 'policy_violation_critical' : 'policy_violation_corrected';
                  _escalationService.escalate({
                    source: 'policy_agent',
                    type: escalationType,
                    severity: pStatus === 'fallback' ? 'critical' : 'low',
                    title: `Policy İhlali — ${senderId}`,
                    details: [
                      `Müşteri: ${messageText.substring(0, 200)}`,
                      `Yanıt (reddedilen): ${agentResponse.substring(0, 300)}`,
                      `İhlaller: ${(lastValidation?.violations || []).join(', ')}`,
                      `Sebep: ${lastValidation?.reason || 'bilinmiyor'}`,
                      pStatus === 'fallback' ? 'Gönderilen: Yedek yanıt (telefon yönlendirme)' : `Düzeltildi (${policyAttempts}. deneme)`,
                    ].join('\n'),
                    metadata: {
                      sender_id: senderId,
                      violations: lastValidation?.violations || [],
                      attempts: policyAttempts,
                    },
                  }).catch(err => console.error('[Instagram Webhook] Escalation error:', err.message));
                }
              }
            } catch (mcError) {
              console.error('[Instagram Webhook] MC integration error (non-fatal):', mcError);
            }
          } catch (openclawError) {
            console.error('[Instagram Webhook] OpenClaw pipeline error:', openclawError);
          }
        }
      } else if (messaging?.read || messaging?.delivery) {
        console.log('[Instagram Webhook] Read/delivery receipt (not forwarding)');
      } else {
        console.log('[Instagram Webhook] Other event type:', Object.keys(messaging || {}));
      }
    } catch (error) {
      console.error('[Instagram Webhook] Error parsing message:', error);
    }
  });

  return router;
}

