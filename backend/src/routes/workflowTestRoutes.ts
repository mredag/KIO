import { Router, Request, Response, NextFunction } from 'express';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { InstagramContextService, type AIUsageTrace, type MessageAnalysis } from '../services/InstagramContextService.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { DirectResponseService } from '../services/DirectResponseService.js';
import { ResponsePolicyService } from '../services/ResponsePolicyService.js';
import { DMKnowledgeContextService } from '../services/DMKnowledgeContextService.js';
import { DMResponseCacheService } from '../services/DMResponseCacheService.js';
import { KnowledgeSelectionService } from '../services/KnowledgeSelectionService.js';
import { DMKnowledgeRetrievalService } from '../services/DMKnowledgeRetrievalService.js';
import {
  DMKnowledgeRerankerService,
  formatSelectedEvidenceBlock,
  type SemanticRerankTrace,
} from '../services/DMKnowledgeRerankerService.js';
import { UserBlockService } from '../services/UserBlockService.js';
import { evaluatePermanentBanCandidate } from '../services/PermanentBanHeuristics.js';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { EscalationService } from '../services/EscalationService.js';
import {
  APPOINTMENT_MODEL_ID,
  buildClarifyExhaustedContactResponse,
  buildDeterministicCampaignResponse,
  buildDeterministicClarifierResponse,
  buildDeterministicCloseoutResponse,
  CAMPAIGN_INFO_MODEL_ID,
  CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
  detectDeterministicPricingTopic,
  HOURS_APPOINTMENT_MODEL_ID,
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
  isGenericInfoRequest as isGenericInfoFastLaneRequest,
  MASSAGE_PRICING_MODEL_ID,
  isPilatesInfoRequest,
  isStandaloneAppointmentRequest,
  normalizeTemplateText as normalizeFastLaneText,
  PILATES_INFO_MODEL_ID,
} from '../services/DMPipelineHeuristics.js';
import { buildDMStyleProfile, getDeterministicConductResponse, sanitizeConductResponse } from '../services/DMResponseStyleService.js';
import { estimateTokens, ZERO_USAGE_METRICS } from '../services/UsageMetrics.js';
import {
  aggregateUsageByModel,
  splitEstimatedTokens,
  type ModelUsageEntry,
} from '../services/CostEstimationService.js';
import { hasAgePolicySignals } from '../services/PolicySignalService.js';
import { hasRoomAvailabilitySignals } from '../services/RoomAvailabilitySignalService.js';
import { TurkishDMHumanizerService, type TurkishDMHumanizerTrace } from '../services/TurkishDMHumanizerService.js';
import {
  evaluateSexualIntent,
  getSexualIntentReply,
  shouldEscalateConductForSexualDecision,
} from '../middleware/sexualIntentFilter.js';
import type { DMSafetyPhraseService } from '../services/DMSafetyPhraseService.js';
import type { ConductState, SuspiciousUserService } from '../services/SuspiciousUserService.js';
import { randomUUID } from 'crypto';

// Escalation service injection (set from index.ts)
let _escalationService: EscalationService | null = null;
export function setSimulatorEscalation(svc: EscalationService): void {
  _escalationService = svc;
}

let _dmSafetyPhraseService: DMSafetyPhraseService | null = null;
export function setSimulatorDMSafety(svc: DMSafetyPhraseService | null): void {
  _dmSafetyPhraseService = svc;
}

let _dmConductService: SuspiciousUserService | null = null;
export function setSimulatorConductService(svc: SuspiciousUserService | null): void {
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

function insertSimulatorCostLedgerRows(rawDb: ReturnType<DatabaseService['getDb']>, entries: ModelUsageEntry[]): void {
  const costEntries = aggregateUsageByModel(entries);
  if (costEntries.length === 0) {
    return;
  }

  const insertCostLedger = rawDb.prepare(`
    INSERT INTO mc_cost_ledger (agent_id, model, provider, input_tokens, output_tokens, cost, job_source, created_at)
    VALUES ('instagram-dm', ?, 'openrouter', ?, ?, ?, 'simulator', datetime('now'))
  `);

  for (const costEntry of costEntries) {
    insertCostLedger.run(
      costEntry.modelId,
      costEntry.inputTokens,
      costEntry.outputTokens,
      costEntry.estimatedCostUsd,
    );
  }
}

/**
 * Workflow Test Routes — Instagram DM Agent Simulator
 * Runs the real OpenClaw pipeline (intent detection, model routing, knowledge fetch, AI call)
 * without needing Meta webhook connection.
 */
export function createWorkflowTestRoutes(db: DatabaseService): Router {
  const router = Router();
  const rawDb = db.getDb();
  const knowledgeBaseService = new KnowledgeBaseService(db);
  const semanticKnowledgeService = new DMKnowledgeRetrievalService(rawDb);
  const semanticReranker = new DMKnowledgeRerankerService();
  const knowledgeContextService = new DMKnowledgeContextService(rawDb);
  const responseCacheService = new DMResponseCacheService(rawDb);
  const humanizerService = new TurkishDMHumanizerService();
  const userBlockService = new UserBlockService(rawDb);

  // Middleware: session auth (admin panel) OR API key auth (external)
  const flexibleAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.user) return next();
    return apiKeyAuth(req, res, next);
  };

  /*
  function clipTemplateBlock(value: string, maxLines: number, maxChars: number): string {
    const cleaned = value.replace(/\r/g, '').trim();
    if (!cleaned) return '';

    const lines = cleaned
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)
      .slice(0, Math.max(1, maxLines));
    let block = lines.join('\n');
    if (block.length > maxChars) {
      block = `${block.slice(0, maxChars - 3).trimEnd()}...`;
    }
    return block;
  }

  function buildGenericInfoTemplateFromKnowledge(): string | null {
    return knowledgeContextService.getDeterministicTemplates().genericInfo;

    try {
      const rows = rawDb.prepare(`
        SELECT category, key_name, value
        FROM knowledge_base
        WHERE is_active = 1 AND (
          (category = 'pricing' AND (key_name = 'complete_massage_pricing' OR key_name LIKE '%massage%' OR key_name LIKE '%masaj%'))
          OR (category = 'services' AND key_name IN ('therapist_info', 'complete_customer_bring_guide'))
          OR (category = 'contact' AND key_name = 'phone')
        )
        ORDER BY updated_at DESC
      `).all() as Array<{
        category: string;
        key_name: string;
        value: string;
      }>;

      const massagePricing = rows.find(row => row.category === 'pricing' && row.key_name === 'complete_massage_pricing')
        || rows.find(row => row.category === 'pricing');
      const therapistInfo = rows.find(row => row.category === 'services' && row.key_name === 'therapist_info');
      const bringInfo = rows.find(row => row.category === 'services' && row.key_name === 'complete_customer_bring_guide');
      const phoneInfo = rows.find(row => row.category === 'contact' && row.key_name === 'phone');

      if (!massagePricing && !therapistInfo && !bringInfo) {
        return null;
      }

      const sections: string[] = ['Elbette, size hizlica temel bilgileri paylasayim:'];

      if (massagePricing?.value) {
        sections.push(clipTemplateBlock(formatMassagePricingTemplate(massagePricing.value), 26, 2200));
      }
      if (therapistInfo?.value) {
        sections.push(`Terapist bilgisi:\n${clipTemplateBlock(therapistInfo.value, 4, 500)}`);
      }
      if (bringInfo?.value) {
        sections.push(`Yaninizda ne getirmelisiniz:\n${clipTemplateBlock(bringInfo.value, 10, 850)}`);
      }
      if (phoneInfo?.value) {
        sections.push(`Detayli bilgi ve randevu: ${clipTemplateBlock(phoneInfo.value, 2, 140)}`);
      }

      return sections.join('\n\n');
    } catch (error) {
      console.error('[Simulator] Failed to build deterministic info template:', error);
      return null;
    }
  }
  */

  function buildGenericInfoTemplateFromKnowledge(): string | null {
    return knowledgeContextService.getDeterministicTemplates().genericInfo;
  }

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

  function getResponseCacheClass(messageText: string, analysis: MessageAnalysis | null): string | null {
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
    if (isGenericInfoFastLaneRequest({
      messageText,
      intentCategories: analysis.intentCategories,
      semanticSignals: analysis.matchedKeywords,
    })) {
      return 'general_info';
    }
    if (analysis.intentCategories.includes('services')
      && analysis.intentCategories.every(category => ['services', 'general', 'faq'].includes(category))
      && /\b(?:nedir|nasil bir|ne ise yarar|detay|detaylari|icerik|icerigi|anlatir misiniz|var mi|neler var)\b/.test(normalized)) {
      return /\bneler var\b/.test(normalized) ? 'service_list' : 'service_definition';
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

  /**
   * POST /api/workflow-test/simulate-agent
   * Full Instagram DM agent simulation — runs the EXACT same pipeline as the real webhook.
   * Intent detection → KB fetch → format KB → direct response → policy validation → faithfulness check.
   * Skips: Meta webhook, OpenClaw gateway, Meta Graph API send.
   */
  router.post('/simulate-agent', flexibleAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { message, senderId = `sim_${Date.now()}` } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      // Generate unique execution ID for this simulation
      const executionId = `EXE-${randomUUID().substring(0, 8)}`;
      console.log('[Simulator] Starting execution: %s', executionId);

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
        return;
      }

      const contextService = new InstagramContextService(rawDb);
      const pipelineConfigService = new PipelineConfigService(rawDb);
      const policyService = new ResponsePolicyService();
      const text = message.trim();

      // Ensure simulator sender exists in instagram_customers (FK constraint)
      const now = new Date().toISOString();
      rawDb.prepare(`
        INSERT OR IGNORE INTO instagram_customers (instagram_id, name, interaction_count, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
      `).run(senderId, 'DM Simulator', now, now);

      // Log inbound message
      const inboundId = randomUUID();
      rawDb.prepare(`
        INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, execution_id, created_at)
        VALUES (?, ?, 'inbound', ?, ?, ?, ?)
      `).run(inboundId, senderId, text, 'user_message', executionId, now);

      const activeBlock = userBlockService.checkBlock('instagram', senderId);
      if (activeBlock.isBlocked) {
        const blockedModelId = activeBlock.isPermanent ? 'blocked/permanent' : 'blocked/temporary';
        const blockedReason = activeBlock.reason || 'Blocked user';
        const responseTime = Date.now() - startTime;
        const pipelineTrace = {
          intentCategories: [],
          matchedKeywords: [],
          modelTier: 'light',
          modelId: blockedModelId,
          tierReason: activeBlock.isPermanent ? 'Active permanent block' : 'Active temporary block',
          isNewCustomer: false,
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped',
          knowledgeEntriesCount: 0,
          conductControl: {
            state: 'silent' as const,
            shouldReply: false,
            offenseCount: 0,
            manualMode: 'auto' as const,
            silentUntil: activeBlock.expiresAt || null,
            reason: blockedReason,
          },
          fastLane: {
            used: false,
            kind: 'none' as const,
            skippedStages: [],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible' as const,
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped' as const,
          openclawSessionKey: 'blocked-user',
          agentPollDurationMs: 0,
          policyValidation: { status: 'skipped' as const, attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped' as const,
          totalResponseTimeMs: responseTime,
          tokensEstimated: 0,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: 0,
            contextAnalysisMs: 0,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs: responseTime,
          },
          tokenBreakdown: {
            policyTokens: 0,
            totalTokens: 0,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET intent = ?, model_used = ?, model_tier = ?, pipeline_trace = ?
          WHERE id = ?
        `).run(
          activeBlock.isPermanent ? 'hard_blocked_user' : 'blocked_user',
          blockedModelId,
          'light',
          JSON.stringify(pipelineTrace),
          inboundId,
        );

        res.json({
          status: 'success',
          response: null,
          replySkipped: true,
          blocked: true,
          senderId,
          analysis: {
            intentCategories: [],
            matchedKeywords: [],
            modelTier: 'light',
            modelId: blockedModelId,
            tierReason: pipelineTrace.tierReason,
            isNewCustomer: false,
            conversationLength: 0,
            knowledgeCategories: [],
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: null,
          responseTime,
        });
        return;
      }

      const conductBefore = _dmConductService?.checkSuspicious('instagram', senderId);
      const permanentBanCheckStartedAt = Date.now();
      const permanentBanEvaluation = evaluatePermanentBanCandidate({
        messageText: text,
        conductStateBefore: conductBefore?.conductState || 'normal',
        offenseCountAfter: (conductBefore?.offenseCount || 0) + 1,
      });
      const permanentBanLatency = Date.now() - permanentBanCheckStartedAt;
      if (permanentBanEvaluation.shouldBan) {
        const permanentBanReason = permanentBanEvaluation.reason || 'Automatic permanent block';
        const conductAfter = _dmConductService?.flagUser('instagram', senderId, permanentBanReason, {
          action: 'block_message',
          severity: 'high',
          source: 'heuristic-permanent-ban',
          messageText: text,
        });
        const blockedUser = userBlockService.permanentBlock('instagram', senderId, permanentBanReason);
        const responseTime = Date.now() - startTime;
        const pipelineTrace = {
          sexualIntent: {
            action: 'block_message' as const,
            confidence: 1,
            reason: permanentBanReason,
            modelUsed: 'heuristic-permanent-ban',
            latencyMs: permanentBanLatency,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          intentCategories: [],
          matchedKeywords: [],
          modelTier: 'light' as const,
          modelId: 'blocked/permanent',
          tierReason: 'Automatic permanent block',
          isNewCustomer: false,
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped' as const,
          knowledgeEntriesCount: 0,
          conductControl: {
            state: conductAfter?.conductState || 'silent',
            shouldReply: false,
            offenseCount: conductAfter?.offenseCount || ((conductBefore?.offenseCount || 0) + 1),
            manualMode: conductAfter?.manualMode || conductBefore?.manualMode || 'auto',
            silentUntil: conductAfter?.silentUntil || blockedUser.expiresAt,
            reason: permanentBanReason,
          },
          fastLane: {
            used: false,
            kind: 'none' as const,
            skippedStages: [],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible' as const,
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped' as const,
          openclawSessionKey: 'blocked-user',
          agentPollDurationMs: 0,
          policyValidation: { status: 'skipped' as const, attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped' as const,
          totalResponseTimeMs: responseTime,
          tokensEstimated: 0,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: permanentBanLatency,
            contextAnalysisMs: 0,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs: Math.max(0, responseTime - permanentBanLatency),
          },
          tokenBreakdown: {
            policyTokens: 0,
            totalTokens: 0,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET intent = ?, model_used = ?, model_tier = ?, pipeline_trace = ?
          WHERE id = ?
        `).run(
          'hard_blocked_user',
          'blocked/permanent',
          'light',
          JSON.stringify(pipelineTrace),
          inboundId,
        );

        res.json({
          status: 'success',
          response: null,
          replySkipped: true,
          blocked: true,
          senderId,
          analysis: {
            intentCategories: [],
            matchedKeywords: [],
            modelTier: 'light',
            modelId: 'blocked/permanent',
            tierReason: pipelineTrace.tierReason,
            isNewCustomer: false,
            conversationLength: 0,
            knowledgeCategories: [],
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: null,
          responseTime,
        });
        return;
      }

      // Push inbound SSE event to DM Kontrol
      try {
        DmSSEManager.getInstance().pushEvent({
          type: 'dm:new',
          data: {
            id: `dm_${Date.now()}`,
            instagramId: senderId,
            direction: 'inbound',
            messageText: text.substring(0, 200),
            responseTimeMs: null,
            modelTier: null,
            modelUsed: null,
            pipelineTrace: null,
            pipelineError: null,
            createdAt: new Date().toISOString(),
          },
        });
      } catch { /* non-fatal */ }

      // STAGE 0: Sexual Intent Filter + conduct ladder
      const sexualIntentStartTime = Date.now();
      let sexualIntentResult;
      try {
        const safetyResult = _dmSafetyPhraseService
          ? await _dmSafetyPhraseService.evaluateMessage({
              messageText: text,
              channel: 'workflow_test',
              senderId,
              allowReviewAlerts: false,
            })
          : {
              decision: await evaluateSexualIntent(text),
              matchedPhrase: null,
              reviewRequest: { triggered: false, status: 'disabled', reviewId: null },
            };
        sexualIntentResult = safetyResult.decision;
        const sexualIntentLatency = Date.now() - sexualIntentStartTime;

        if (sexualIntentResult.action !== 'allow') {
          const shouldEscalateConduct = shouldEscalateConductForSexualDecision(sexualIntentResult.action);
          const conductAfter = shouldEscalateConduct
            ? _dmConductService?.flagUser('instagram', senderId, sexualIntentResult.reason, {
                action: sexualIntentResult.action,
                severity: 'high',
                source: sexualIntentResult.modelUsed,
                messageText: text,
              })
            : conductBefore;
          const effectiveState = conductAfter?.conductState || 'normal';
          const responseText = buildConductReply(sexualIntentResult.action, effectiveState) || '[sessiz engel]';
          const interactionIntent = effectiveState === 'silent'
            ? 'blocked_silent'
            : (sexualIntentResult.action === 'block_message' ? 'security_block' : 'retry_question');

          const outboundId = randomUUID();
          const trace = {
            sexualIntent: {
              action: sexualIntentResult.action,
              confidence: sexualIntentResult.confidence,
              reason: sexualIntentResult.reason,
              modelUsed: sexualIntentResult.modelUsed,
              latencyMs: sexualIntentLatency,
              inputTokens: sexualIntentResult.usage?.inputTokens,
              outputTokens: sexualIntentResult.usage?.outputTokens,
              totalTokens: sexualIntentResult.usage?.totalTokens,
            },
            conductControl: {
              state: effectiveState,
              shouldReply: conductAfter?.shouldReply ?? true,
              offenseCount: conductAfter?.offenseCount || 0,
              manualMode: conductAfter?.manualMode || 'auto',
              silentUntil: conductAfter?.silentUntil || null,
              reason: conductAfter?.reason || sexualIntentResult.reason,
            },
          };

          rawDb.prepare(`
            INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, ai_response, model_used, execution_id, created_at, pipeline_trace)
            VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            outboundId,
            senderId,
            responseText,
            interactionIntent,
            responseText,
            sexualIntentResult.modelUsed,
            executionId,
            new Date().toISOString(),
            JSON.stringify(trace),
          );

          insertSimulatorCostLedgerRows(rawDb, [{
            modelId: sexualIntentResult.modelUsed,
            inputTokens: sexualIntentResult.usage?.inputTokens || 0,
            outputTokens: sexualIntentResult.usage?.outputTokens || 0,
          }]);

          try {
            DmSSEManager.getInstance().pushEvent({
              type: 'dm:response',
              data: {
                id: outboundId,
                instagramId: senderId,
                direction: 'outbound',
                messageText: responseText,
                responseTimeMs: sexualIntentLatency,
                modelTier: null,
                modelUsed: sexualIntentResult.modelUsed,
                pipelineTrace: trace,
                pipelineError: null,
                createdAt: new Date().toISOString(),
              },
            });
          } catch { /* non-fatal */ }

          res.json({
            ok: true,
            sexualIntent: {
              action: sexualIntentResult.action,
              confidence: sexualIntentResult.confidence,
              reason: sexualIntentResult.reason,
              modelUsed: sexualIntentResult.modelUsed,
              latencyMs: sexualIntentLatency,
            },
            response: responseText,
            conductControl: trace.conductControl,
            responseTime: Date.now() - startTime,
          });
          return;
        }

        if (conductBefore?.shouldReply === false) {
          sexualIntentResult = {
            ...sexualIntentResult,
            latencyMs: sexualIntentLatency,
          };

          res.json({
            ok: true,
            sexualIntent: sexualIntentResult,
            response: '[sessiz engel]',
            conductControl: {
              state: conductBefore.conductState || 'silent',
              shouldReply: false,
              offenseCount: conductBefore.offenseCount || 0,
              manualMode: conductBefore.manualMode || 'auto',
              silentUntil: conductBefore.silentUntil || null,
              reason: conductBefore.reason,
            },
            responseTime: Date.now() - startTime,
          });
          return;
        }

        sexualIntentResult = {
          ...sexualIntentResult,
          latencyMs: sexualIntentLatency,
        };
      } catch (intentErr) {
        console.error('[Simulator] Sexual intent check failed:', intentErr);
        sexualIntentResult = {
          action: 'allow' as const,
          confidence: 0,
          reason: `Error: ${intentErr instanceof Error ? intentErr.message : String(intentErr)}`,
          modelUsed: 'error',
          latencyMs: Date.now() - sexualIntentStartTime,
        };
      }

      // STAGE 1: Context Analysis (same as webhook)
      const contextStartTime = Date.now();
      const simpleAnalysis = contextService.analyzeSimpleTurn(senderId, text);
      const analysis = simpleAnalysis || await contextService.analyzeMessage(senderId, text);
      const simpleTurnUsed = !!simpleAnalysis;
      const contextAnalysisMs = Date.now() - contextStartTime;
      const conductForReply = _dmConductService?.checkSuspicious('instagram', senderId);
      const conductStateForReply: ConductState = conductForReply?.conductState || 'normal';
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
      };
      const getHumanizerTrace = (): TurkishDMHumanizerTrace | undefined => {
        if (!((pipelineConfig.humanizer.enabled && pipelineConfig.humanizer.traceEnabled) || humanizerApplied)) {
          return undefined;
        }

        return {
          enabled: pipelineConfig.humanizer.enabled,
          mode: pipelineConfig.humanizer.mode,
          applied: humanizerApplied,
          ruleIds: Array.from(humanizerRuleIds),
          inputLength: humanizerFirstInputLength ?? 0,
          outputLength: humanizerLastOutputLength,
        };
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
        customerMessage: text,
        conversationHistory: analysis.conversationHistory,
        isNewCustomer: analysis.isNewCustomer,
        followUpHint: analysis.followUpHint,
        conductState: conductStateForReply,
        humanizerEnabled: pipelineConfig.humanizer.enabled,
      });
      const deterministicTemplates = knowledgeContextService.getDeterministicTemplates();
      const earlyDeterministicPilates = conductStateForReply === 'normal' && isPilatesInfoRequest(text)
        ? deterministicTemplates.pilatesInfo
        : null;
      const earlyDeterministicCampaign = conductStateForReply === 'normal'
        ? buildDeterministicCampaignResponse({
            messageText: text,
            semanticSignals: analysis.matchedKeywords,
            campaignTemplate: deterministicTemplates.campaignInfo,
          })
        : null;
      const earlyDeterministicAppointment = conductStateForReply === 'normal' && isStandaloneAppointmentRequest(text)
        ? deterministicTemplates.appointmentBooking
        : null;
      const earlyDeterministicCloseout = conductStateForReply === 'normal'
        ? buildDeterministicCloseoutResponse(text)
        : null;
      const earlyDeterministicContactFallback = conductStateForReply === 'normal'
        ? buildClarifyExhaustedContactResponse({
            messageText: text,
            conversationHistory: analysis.conversationHistory,
            responseMode: analysis.responseDirective.mode,
            fallbackMessage: pipelineConfig.fallbackMessage || deterministicTemplates.contactPhone,
            semanticSignals: analysis.matchedKeywords,
          })
        : null;

      if (earlyDeterministicPilates) {
        const earlyPilatesResponse = finalizeResponseText(earlyDeterministicPilates);
        const safetyTokens = sexualIntentResult.totalTokens || 0;
        const contextTokens = (analysis.usageTrace || []).reduce(
          (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
          0,
        );
        const pilatesTokens = estimateTokens(earlyPilatesResponse);
        const responseTime = Date.now() - startTime;
        const uncategorizedMs = Math.max(
          0,
          responseTime - (sexualIntentResult.latencyMs || 0) - contextAnalysisMs,
        );
        const pipelineTrace = {
          sexualIntent: sexualIntentResult,
          intentCategories: analysis.intentCategories,
          matchedKeywords: analysis.matchedKeywords,
          modelTier: analysis.modelTier,
          modelId: PILATES_INFO_MODEL_ID,
          tierReason: analysis.tierReason,
          isNewCustomer: analysis.isNewCustomer,
          conversationHistory: {
            messageCount: analysis.conversationHistory.length,
            messages: analysis.conversationHistory.map(entry => ({
              direction: entry.direction,
              text: entry.messageText.substring(0, 100),
              timestamp: entry.createdAt,
              relativeTime: entry.relativeTime,
            })),
            formattedForAI: analysis.formattedHistory.substring(0, 500),
            followUpHint: analysis.followUpHint,
            activeState: analysis.conversationState,
            responseDirective: analysis.responseDirective,
          },
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped',
          knowledgeEntriesCount: 0,
          semanticRetrieval: {
            enabled: true,
            strategy: 'sparse_tfidf_chargram',
            queryText: '',
            candidateCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            refreshedIndex: false,
            skippedReason: 'fast_lane_skip',
          },
          semanticRerank: {
            enabled: true,
            modelId: 'disabled',
            candidateCount: 0,
            selectedCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            skippedReason: 'fast_lane_skip',
            rationale: null,
          },
          conductControl: {
            state: conductStateForReply,
            shouldReply: conductForReply?.shouldReply !== false,
            offenseCount: conductForReply?.offenseCount || 0,
            manualMode: conductForReply?.manualMode || 'auto',
            silentUntil: conductForReply?.silentUntil || null,
            reason: conductForReply?.reason,
          },
          responseStyle: styleProfile.trace,
          humanizer: getHumanizerTrace(),
          fastLane: {
            used: true,
            kind: 'deterministic_pilates_info',
            skippedStages: ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation'],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible',
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped',
          openclawSessionKey: 'deterministic-pilates-info',
          agentPollDurationMs: 0,
          directResponse: {
            used: true,
            latencyMs: 0,
            modelId: PILATES_INFO_MODEL_ID,
            tokensEstimated: pilatesTokens,
            inputTokens: 0,
            outputTokens: pilatesTokens,
          },
          policyValidation: { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped',
          totalResponseTimeMs: responseTime,
          tokensEstimated: safetyTokens + contextTokens + pilatesTokens,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: sexualIntentResult.latencyMs || 0,
            contextAnalysisMs,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs,
          },
          tokenBreakdown: {
            safetyTokens,
            contextTokens,
            rerankTokens: 0,
            directTokens: pilatesTokens,
            directInputTokens: 0,
            directOutputTokens: pilatesTokens,
            policyTokens: 0,
            totalTokens: safetyTokens + contextTokens + pilatesTokens,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET pipeline_trace = ?, model_tier = ?, model_used = ?
          WHERE id = ?
        `).run(JSON.stringify(pipelineTrace), analysis.modelTier, PILATES_INFO_MODEL_ID, inboundId);

        res.json({
          status: 'success',
          response: earlyPilatesResponse,
          senderId,
          sexualIntent: sexualIntentResult,
          analysis: {
            intentCategories: analysis.intentCategories,
            matchedKeywords: analysis.matchedKeywords,
            modelTier: analysis.modelTier,
            modelId: PILATES_INFO_MODEL_ID,
            tierReason: analysis.tierReason,
            isNewCustomer: analysis.isNewCustomer,
            conversationLength: analysis.conversationHistory.length,
            knowledgeCategories: analysis.intentCategories,
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: pipelineTrace.responseStyle,
          responseTime,
          pipelineTrace,
        });
        return;
      }

      if (earlyDeterministicCampaign) {
        const earlyCampaignResponse = finalizeResponseText(earlyDeterministicCampaign.response);
        const safetyTokens = sexualIntentResult.totalTokens || 0;
        const contextTokens = (analysis.usageTrace || []).reduce(
          (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
          0,
        );
        const campaignTokens = estimateTokens(earlyCampaignResponse);
        const responseTime = Date.now() - startTime;
        const uncategorizedMs = Math.max(
          0,
          responseTime - (sexualIntentResult.latencyMs || 0) - contextAnalysisMs,
        );
        const pipelineTrace = {
          sexualIntent: sexualIntentResult,
          intentCategories: analysis.intentCategories,
          matchedKeywords: analysis.matchedKeywords,
          modelTier: analysis.modelTier,
          modelId: CAMPAIGN_INFO_MODEL_ID,
          tierReason: analysis.tierReason,
          isNewCustomer: analysis.isNewCustomer,
          conversationHistory: {
            messageCount: analysis.conversationHistory.length,
            messages: analysis.conversationHistory.map(entry => ({
              direction: entry.direction,
              text: entry.messageText.substring(0, 100),
              timestamp: entry.createdAt,
              relativeTime: entry.relativeTime,
            })),
            formattedForAI: analysis.formattedHistory.substring(0, 500),
            followUpHint: analysis.followUpHint,
            activeState: analysis.conversationState,
            responseDirective: analysis.responseDirective,
          },
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped',
          knowledgeEntriesCount: 0,
          semanticRetrieval: {
            enabled: true,
            strategy: 'sparse_tfidf_chargram',
            queryText: '',
            candidateCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            refreshedIndex: false,
            skippedReason: 'fast_lane_skip',
          },
          semanticRerank: {
            enabled: true,
            modelId: 'disabled',
            candidateCount: 0,
            selectedCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            skippedReason: 'fast_lane_skip',
            rationale: null,
          },
          conductControl: {
            state: conductStateForReply,
            shouldReply: conductForReply?.shouldReply !== false,
            offenseCount: conductForReply?.offenseCount || 0,
            manualMode: conductForReply?.manualMode || 'auto',
            silentUntil: conductForReply?.silentUntil || null,
            reason: conductForReply?.reason,
          },
          responseStyle: styleProfile.trace,
          humanizer: getHumanizerTrace(),
          fastLane: {
            used: true,
            kind: 'deterministic_campaign',
            skippedStages: ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation'],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible',
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped',
          openclawSessionKey: 'deterministic-campaign-info',
          agentPollDurationMs: 0,
          directResponse: {
            used: true,
            latencyMs: 0,
            modelId: CAMPAIGN_INFO_MODEL_ID,
            tokensEstimated: campaignTokens,
            inputTokens: 0,
            outputTokens: campaignTokens,
          },
          policyValidation: { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped',
          totalResponseTimeMs: responseTime,
          tokensEstimated: safetyTokens + contextTokens + campaignTokens,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: sexualIntentResult.latencyMs || 0,
            contextAnalysisMs,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs,
          },
          tokenBreakdown: {
            safetyTokens,
            contextTokens,
            rerankTokens: 0,
            directTokens: campaignTokens,
            directInputTokens: 0,
            directOutputTokens: campaignTokens,
            policyTokens: 0,
            totalTokens: safetyTokens + contextTokens + campaignTokens,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET pipeline_trace = ?, model_tier = ?, model_used = ?
          WHERE id = ?
        `).run(JSON.stringify(pipelineTrace), analysis.modelTier, CAMPAIGN_INFO_MODEL_ID, inboundId);

        res.json({
          status: 'success',
          response: earlyCampaignResponse,
          senderId,
          sexualIntent: sexualIntentResult,
          analysis: {
            intentCategories: analysis.intentCategories,
            matchedKeywords: analysis.matchedKeywords,
            modelTier: analysis.modelTier,
            modelId: CAMPAIGN_INFO_MODEL_ID,
            tierReason: analysis.tierReason,
            isNewCustomer: analysis.isNewCustomer,
            conversationLength: analysis.conversationHistory.length,
            knowledgeCategories: analysis.intentCategories,
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: pipelineTrace.responseStyle,
          responseTime,
          pipelineTrace,
        });
        return;
      }

      if (earlyDeterministicAppointment) {
        const earlyAppointmentResponse = finalizeResponseText(earlyDeterministicAppointment);
        const safetyTokens = sexualIntentResult.totalTokens || 0;
        const contextTokens = (analysis.usageTrace || []).reduce(
          (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
          0,
        );
        const appointmentTokens = estimateTokens(earlyAppointmentResponse);
        const responseTime = Date.now() - startTime;
        const uncategorizedMs = Math.max(
          0,
          responseTime - (sexualIntentResult.latencyMs || 0) - contextAnalysisMs,
        );
        const pipelineTrace = {
          sexualIntent: sexualIntentResult,
          intentCategories: analysis.intentCategories,
          matchedKeywords: analysis.matchedKeywords,
          modelTier: analysis.modelTier,
          modelId: APPOINTMENT_MODEL_ID,
          tierReason: analysis.tierReason,
          isNewCustomer: analysis.isNewCustomer,
          conversationHistory: {
            messageCount: analysis.conversationHistory.length,
            messages: analysis.conversationHistory.map(entry => ({
              direction: entry.direction,
              text: entry.messageText.substring(0, 100),
              timestamp: entry.createdAt,
              relativeTime: entry.relativeTime,
            })),
            formattedForAI: analysis.formattedHistory.substring(0, 500),
            followUpHint: analysis.followUpHint,
            activeState: analysis.conversationState,
            responseDirective: analysis.responseDirective,
          },
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped',
          knowledgeEntriesCount: 0,
          semanticRetrieval: {
            enabled: true,
            strategy: 'sparse_tfidf_chargram',
            queryText: '',
            candidateCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            refreshedIndex: false,
            skippedReason: 'fast_lane_skip',
          },
          semanticRerank: {
            enabled: true,
            modelId: 'disabled',
            candidateCount: 0,
            selectedCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            skippedReason: 'fast_lane_skip',
            rationale: null,
          },
          conductControl: {
            state: conductStateForReply,
            shouldReply: conductForReply?.shouldReply !== false,
            offenseCount: conductForReply?.offenseCount || 0,
            manualMode: conductForReply?.manualMode || 'auto',
            silentUntil: conductForReply?.silentUntil || null,
            reason: conductForReply?.reason,
          },
          responseStyle: styleProfile.trace,
          humanizer: getHumanizerTrace(),
          fastLane: {
            used: true,
            kind: 'deterministic_appointment',
            skippedStages: ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation'],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible',
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped',
          openclawSessionKey: 'deterministic-appointment',
          agentPollDurationMs: 0,
          directResponse: {
            used: true,
            latencyMs: 0,
            modelId: APPOINTMENT_MODEL_ID,
            tokensEstimated: appointmentTokens,
            inputTokens: 0,
            outputTokens: appointmentTokens,
          },
          policyValidation: { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped',
          totalResponseTimeMs: responseTime,
          tokensEstimated: safetyTokens + contextTokens + appointmentTokens,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: sexualIntentResult.latencyMs || 0,
            contextAnalysisMs,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs,
          },
          tokenBreakdown: {
            safetyTokens,
            contextTokens,
            rerankTokens: 0,
            directTokens: appointmentTokens,
            directInputTokens: 0,
            directOutputTokens: appointmentTokens,
            policyTokens: 0,
            totalTokens: safetyTokens + contextTokens + appointmentTokens,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET pipeline_trace = ?, model_tier = ?, model_used = ?
          WHERE id = ?
        `).run(JSON.stringify(pipelineTrace), analysis.modelTier, APPOINTMENT_MODEL_ID, inboundId);

        res.json({
          status: 'success',
          response: earlyAppointmentResponse,
          senderId,
          sexualIntent: sexualIntentResult,
          analysis: {
            intentCategories: analysis.intentCategories,
            matchedKeywords: analysis.matchedKeywords,
            modelTier: analysis.modelTier,
            modelId: APPOINTMENT_MODEL_ID,
            tierReason: analysis.tierReason,
            isNewCustomer: analysis.isNewCustomer,
            conversationLength: analysis.conversationHistory.length,
            knowledgeCategories: analysis.intentCategories,
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: pipelineTrace.responseStyle,
          responseTime,
        });
        return;
      }

      if (earlyDeterministicCloseout?.action === 'skip_send') {
        const safetyTokens = sexualIntentResult.totalTokens || 0;
        const contextTokens = (analysis.usageTrace || []).reduce(
          (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
          0,
        );
        const responseTime = Date.now() - startTime;
        const uncategorizedMs = Math.max(
          0,
          responseTime - (sexualIntentResult.latencyMs || 0) - contextAnalysisMs,
        );
        const pipelineTrace = {
          sexualIntent: sexualIntentResult,
          intentCategories: analysis.intentCategories,
          matchedKeywords: analysis.matchedKeywords,
          modelTier: analysis.modelTier,
          modelId: earlyDeterministicCloseout.modelId,
          tierReason: analysis.tierReason,
          isNewCustomer: analysis.isNewCustomer,
          conversationHistory: {
            messageCount: analysis.conversationHistory.length,
            messages: analysis.conversationHistory.map(entry => ({
              direction: entry.direction,
              text: entry.messageText.substring(0, 100),
              timestamp: entry.createdAt,
              relativeTime: entry.relativeTime,
            })),
            formattedForAI: analysis.formattedHistory.substring(0, 500),
            followUpHint: analysis.followUpHint,
            activeState: analysis.conversationState,
            responseDirective: analysis.responseDirective,
          },
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped',
          knowledgeEntriesCount: 0,
          semanticRetrieval: {
            enabled: true,
            strategy: 'sparse_tfidf_chargram',
            queryText: '',
            candidateCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            refreshedIndex: false,
            skippedReason: 'fast_lane_no_reply',
          },
          semanticRerank: {
            enabled: true,
            modelId: 'disabled',
            candidateCount: 0,
            selectedCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            skippedReason: 'fast_lane_no_reply',
            rationale: null,
          },
          conductControl: {
            state: conductStateForReply,
            shouldReply: conductForReply?.shouldReply !== false,
            offenseCount: conductForReply?.offenseCount || 0,
            manualMode: conductForReply?.manualMode || 'auto',
            silentUntil: conductForReply?.silentUntil || null,
            reason: conductForReply?.reason,
          },
          responseStyle: styleProfile.trace,
          fastLane: {
            used: true,
            kind: 'deterministic_closeout',
            skippedStages: ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation', 'meta_send'],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible',
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped',
          openclawSessionKey: 'deterministic-closeout',
          agentPollDurationMs: 0,
          directResponse: {
            used: true,
            latencyMs: 0,
            modelId: earlyDeterministicCloseout.modelId,
            tokensEstimated: 0,
            inputTokens: 0,
            outputTokens: 0,
          },
          policyValidation: { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped',
          totalResponseTimeMs: responseTime,
          tokensEstimated: safetyTokens + contextTokens,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: sexualIntentResult.latencyMs || 0,
            contextAnalysisMs,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs,
          },
          tokenBreakdown: {
            safetyTokens,
            contextTokens,
            rerankTokens: 0,
            directTokens: 0,
            directInputTokens: 0,
            directOutputTokens: 0,
            policyTokens: 0,
            totalTokens: safetyTokens + contextTokens,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET pipeline_trace = ?, model_tier = ?, model_used = ?
          WHERE id = ?
        `).run(JSON.stringify(pipelineTrace), analysis.modelTier, earlyDeterministicCloseout.modelId, inboundId);

        try {
          contextService.clearConversationState(senderId);
        } catch (stateErr) {
          console.error('[Simulator] Failed to clear conversation state:', stateErr);
        }

        res.json({
          status: 'success',
          response: null,
          replySkipped: true,
          senderId,
          sexualIntent: sexualIntentResult,
          analysis: {
            intentCategories: analysis.intentCategories,
            matchedKeywords: analysis.matchedKeywords,
            modelTier: analysis.modelTier,
            modelId: earlyDeterministicCloseout.modelId,
            tierReason: analysis.tierReason,
            isNewCustomer: analysis.isNewCustomer,
            conversationLength: analysis.conversationHistory.length,
            knowledgeCategories: analysis.intentCategories,
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: pipelineTrace.responseStyle,
          responseTime,
        });
        return;
      }

      if (earlyDeterministicContactFallback) {
        const earlyContactFallbackResponse = finalizeResponseText(earlyDeterministicContactFallback.response);
        const safetyTokens = sexualIntentResult.totalTokens || 0;
        const contextTokens = (analysis.usageTrace || []).reduce(
          (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
          0,
        );
        const responseTokens = estimateTokens(earlyContactFallbackResponse);
        const responseTime = Date.now() - startTime;
        const uncategorizedMs = Math.max(
          0,
          responseTime - (sexualIntentResult.latencyMs || 0) - contextAnalysisMs,
        );
        const pipelineTrace = {
          sexualIntent: sexualIntentResult,
          intentCategories: analysis.intentCategories,
          matchedKeywords: analysis.matchedKeywords,
          modelTier: analysis.modelTier,
          modelId: CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
          tierReason: analysis.tierReason,
          isNewCustomer: analysis.isNewCustomer,
          conversationHistory: {
            messageCount: analysis.conversationHistory.length,
            messages: analysis.conversationHistory.map(entry => ({
              direction: entry.direction,
              text: entry.messageText.substring(0, 100),
              timestamp: entry.createdAt,
              relativeTime: entry.relativeTime,
            })),
            formattedForAI: analysis.formattedHistory.substring(0, 500),
            followUpHint: analysis.followUpHint,
            activeState: analysis.conversationState,
            responseDirective: analysis.responseDirective,
          },
          knowledgeCategoriesFetched: [],
          knowledgeFetchStatus: 'skipped',
          knowledgeEntriesCount: 0,
          semanticRetrieval: {
            enabled: true,
            strategy: 'sparse_tfidf_chargram',
            queryText: '',
            candidateCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            refreshedIndex: false,
            skippedReason: 'fast_lane_skip',
          },
          semanticRerank: {
            enabled: true,
            modelId: 'disabled',
            candidateCount: 0,
            selectedCount: 0,
            selectedEntries: [],
            latencyMs: 0,
            skippedReason: 'fast_lane_skip',
            rationale: null,
          },
          conductControl: {
            state: conductStateForReply,
            shouldReply: conductForReply?.shouldReply !== false,
            offenseCount: conductForReply?.offenseCount || 0,
            manualMode: conductForReply?.manualMode || 'auto',
            silentUntil: conductForReply?.silentUntil || null,
            reason: conductForReply?.reason,
          },
          responseStyle: styleProfile.trace,
          humanizer: getHumanizerTrace(),
          fastLane: {
            used: true,
            kind: 'deterministic_contact_fallback',
            skippedStages: ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation'],
          },
          cache: {
            eligible: false,
            hit: false,
            cacheClass: null,
            lookupKey: null,
            sourceExecutionId: null,
            status: 'ineligible',
            observationCount: null,
          },
          openclawDispatchStatus: 'skipped',
          openclawSessionKey: 'deterministic-contact-fallback',
          agentPollDurationMs: 0,
          directResponse: {
            used: true,
            latencyMs: 0,
            modelId: CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
            tokensEstimated: responseTokens,
            inputTokens: 0,
            outputTokens: responseTokens,
          },
          policyValidation: { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
          metaSendStatus: 'skipped',
          totalResponseTimeMs: responseTime,
          tokensEstimated: safetyTokens + contextTokens + responseTokens,
          timingBreakdown: {
            ingestDelayMs: null,
            customerPerceivedTotalMs: null,
            safetyFilterMs: sexualIntentResult.latencyMs || 0,
            contextAnalysisMs,
            knowledgeAssemblyMs: 0,
            openclawDispatchMs: 0,
            metaSendMs: 0,
            uncategorizedMs,
          },
          tokenBreakdown: {
            safetyTokens,
            contextTokens,
            rerankTokens: 0,
            directTokens: responseTokens,
            directInputTokens: 0,
            directOutputTokens: responseTokens,
            policyTokens: 0,
            totalTokens: safetyTokens + contextTokens + responseTokens,
          },
        };

        rawDb.prepare(`
          UPDATE instagram_interactions
          SET pipeline_trace = ?, model_tier = ?, model_used = ?
          WHERE id = ?
        `).run(JSON.stringify(pipelineTrace), analysis.modelTier, CLARIFY_EXHAUSTED_CONTACT_MODEL_ID, inboundId);

        res.json({
          status: 'success',
          response: earlyContactFallbackResponse,
          senderId,
          sexualIntent: sexualIntentResult,
          analysis: {
            intentCategories: analysis.intentCategories,
            matchedKeywords: analysis.matchedKeywords,
            modelTier: analysis.modelTier,
            modelId: CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
            tierReason: analysis.tierReason,
            isNewCustomer: analysis.isNewCustomer,
            conversationLength: analysis.conversationHistory.length,
            knowledgeCategories: analysis.intentCategories,
            knowledgeEntriesCount: 0,
          },
          conductControl: pipelineTrace.conductControl,
          responseStyle: pipelineTrace.responseStyle,
          responseTime,
          pipelineTrace,
        });
        return;
      }

      // ═══ STAGE 2: Knowledge Fetch + Format (same as webhook) ═══
      // Always include 'contact' — phone/address are in system prompt and fallback
      const knowledgeStartTime = Date.now();
      const kbCategories: Set<string> = new Set(analysis.intentCategories);
      if (hasAgePolicySignals(text, analysis.followUpHint?.rewrittenQuestion, analysis.activeTopicLabel)) {
        kbCategories.add('policies');
      }
      kbCategories.add('contact');
      let knowledgeContext = '';
      let knowledgeEntriesCount = 0;
      let selectedEvidence = '';
      let semanticRetrievalTrace = {
        enabled: true,
        strategy: 'sparse_tfidf_chargram' as const,
        queryText: '',
        candidateCount: 0,
        selectedEntries: [] as Array<{ category: string; keyName: string; score: number }>,
        latencyMs: 0,
        refreshedIndex: false,
        skippedReason: 'not_run' as string | null,
      };
      let semanticRerankTrace: SemanticRerankTrace = {
        enabled: true,
        modelId: 'disabled',
        candidateCount: 0,
        selectedCount: 0,
        selectedEntries: [] as Array<{ category: string; keyName: string; score: number }>,
        latencyMs: 0,
        skippedReason: 'not_run' as string | null,
        rationale: null as string | null,
      };
      const enrichKnowledge = shouldRunSemanticEnrichment(text, analysis, simpleTurnUsed);
      const filteredKnowledge = knowledgeContextService.getFilteredContext(kbCategories);
      knowledgeContext = filteredKnowledge.json;
      knowledgeEntriesCount = filteredKnowledge.entryCount;

      if (enrichKnowledge) {
        try {
        const semanticRetrieval = semanticKnowledgeService.findCandidates({
          baseContextJson: knowledgeContext,
          messageText: text,
          followUpHint: analysis.followUpHint,
          activeTopic: analysis.activeTopicLabel,
          primaryCategories: kbCategories,
          allowInContextCandidates: true,
          maxCandidates: 8,
        });

        semanticRetrievalTrace = semanticRetrieval.trace;

        const rerankResult = await semanticReranker.rerank({
          messageText: text,
          followUpHint: analysis.followUpHint,
          activeTopic: analysis.activeTopicLabel,
          requestedCategories: Array.from(kbCategories),
          candidates: semanticRetrieval.candidates,
          maxSelections: 3,
        });
        semanticRerankTrace = rerankResult.trace;
        selectedEvidence = formatSelectedEvidenceBlock(rerankResult.selectedCandidates);

        if (rerankResult.selectedCandidates.length > 0) {
          const mergedKnowledge = semanticKnowledgeService.applyCandidatesToContext(
            knowledgeContext,
            rerankResult.selectedCandidates,
          );
          knowledgeContext = mergedKnowledge.knowledgeContext;
          knowledgeEntriesCount += mergedKnowledge.addedEntriesCount;
          for (const addedCategory of mergedKnowledge.addedCategories) {
            kbCategories.add(addedCategory);
          }
        }
      } catch (semanticRetrievalErr) {
        console.error('[Simulator] Semantic KB retrieval/rerank failed:', semanticRetrievalErr);
        semanticRetrievalTrace = {
          enabled: true,
          strategy: 'sparse_tfidf_chargram',
          queryText: '',
          candidateCount: 0,
          selectedEntries: [],
          latencyMs: 0,
          refreshedIndex: false,
          skippedReason: 'error',
        };
        semanticRerankTrace = {
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
          messageText: text,
          followUpHint: analysis.followUpHint,
          primaryCategories: kbCategories,
        });

        if (augmentedKnowledge.addedEntriesCount > 0) {
          knowledgeContext = augmentedKnowledge.knowledgeContext;
          knowledgeEntriesCount += augmentedKnowledge.addedEntriesCount;
          for (const addedCategory of augmentedKnowledge.addedCategories) {
            kbCategories.add(addedCategory);
          }
        }
        } catch (knowledgeSelectionErr) {
          console.error('[Simulator] Knowledge selection supplement failed:', knowledgeSelectionErr);
        }
      } else {
        semanticRetrievalTrace = {
          enabled: true,
          strategy: 'sparse_tfidf_chargram',
          queryText: '',
          candidateCount: 0,
          selectedEntries: [],
          latencyMs: 0,
          refreshedIndex: false,
          skippedReason: 'simple_turn_skip',
        };
        semanticRerankTrace = {
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

      // Format KB from raw JSON to clean labeled text (anti-hallucination)
      const formattedKnowledge = await InstagramContextService.formatKnowledgeForPrompt(knowledgeContext);
      const knowledgeAssemblyMs = Date.now() - knowledgeStartTime;

      // ═══ STAGE 3: Direct Response via OpenRouter (same as webhook) ═══
      const configSignature = pipelineConfigService.getConfigSignature(pipelineConfig);
      const tierConfig = pipelineConfig.directResponse.tiers[analysis.modelTier];
      const systemPrompt = pipelineConfigService.buildDirectSystemPromptForConfig(pipelineConfig, formattedKnowledge);
      const useDirectResponse = pipelineConfigService.shouldUseDirectResponseForConfig(pipelineConfig, analysis.modelTier);
      let skipPolicy = !pipelineConfig.policy.enabled;

      const customerSummary = analysis.isNewCustomer
        ? 'YENI MUSTERI'
        : `Etkilesim: ${analysis.totalInteractions}`;

      const directService = new DirectResponseService();
      const responseCacheClass = simpleTurnUsed ? getResponseCacheClass(text, analysis) : null;
      const deterministicConductResponse = getDeterministicConductResponse({
        conductState: conductStateForReply,
        customerMessage: text,
        matchedKeywords: analysis.matchedKeywords,
        intentCategories: analysis.intentCategories,
      });
      const deterministicInfoResponse = conductStateForReply === 'normal' && isGenericInfoFastLaneRequest({
        messageText: text,
        intentCategories: analysis.intentCategories,
        semanticSignals: analysis.matchedKeywords,
      })
        ? buildGenericInfoTemplateFromKnowledge()
        : null;
      const deterministicMassagePricingResponse = conductStateForReply === 'normal'
        && detectDeterministicPricingTopic({
          messageText: text,
          intentCategories: analysis.intentCategories,
          semanticSignals: analysis.matchedKeywords,
        }) === 'massage'
        ? deterministicTemplates.massagePricingInfo
        : null;
      const deterministicPilatesResponse = conductStateForReply === 'normal' && isPilatesInfoRequest(text)
        ? deterministicTemplates.pilatesInfo
        : null;
      const deterministicCampaignResponse = conductStateForReply === 'normal'
        ? buildDeterministicCampaignResponse({
            messageText: text,
            semanticSignals: analysis.matchedKeywords,
            campaignTemplate: deterministicTemplates.campaignInfo,
          })
        : null;
      const deterministicLocationResponse = conductStateForReply === 'normal' && isDirectLocationQuestion(text)
        ? deterministicTemplates.contactLocation
        : null;
      const deterministicPhoneResponse = conductStateForReply === 'normal' && isDirectPhoneQuestion(text)
        ? deterministicTemplates.contactPhone
        : null;
      const deterministicHoursAppointmentResponse = conductStateForReply === 'normal'
        && analysis.matchedKeywords.includes('standalone_hours_request')
        && analysis.matchedKeywords.includes('standalone_appointment_request')
        ? deterministicTemplates.hoursWithAppointment
        : null;
      const deterministicHoursResponse = conductStateForReply === 'normal' && analysis.matchedKeywords.includes('standalone_hours_request')
        ? deterministicTemplates.generalHours
        : null;
      const deterministicAppointmentResponse = conductStateForReply === 'normal' && isStandaloneAppointmentRequest(text)
        ? deterministicTemplates.appointmentBooking
        : null;
      const deterministicCloseout = conductStateForReply === 'normal'
        ? buildDeterministicCloseoutResponse(text)
        : null;
      const deterministicContactFallback = deterministicConductResponse
        || deterministicInfoResponse
        || deterministicMassagePricingResponse
        || deterministicPilatesResponse
        || deterministicCampaignResponse
        || deterministicLocationResponse
        || deterministicPhoneResponse
        || deterministicHoursAppointmentResponse
        || deterministicHoursResponse
        || deterministicAppointmentResponse
        || deterministicCloseout
        || conductStateForReply !== 'normal'
        ? null
        : buildClarifyExhaustedContactResponse({
            messageText: text,
            conversationHistory: analysis.conversationHistory,
            responseMode: analysis.responseDirective.mode,
            fallbackMessage: pipelineConfig.fallbackMessage || deterministicTemplates.contactPhone,
            semanticSignals: analysis.matchedKeywords,
          });
      const deterministicClarifier = deterministicConductResponse
        || deterministicInfoResponse
        || deterministicMassagePricingResponse
        || deterministicPilatesResponse
        || deterministicCampaignResponse
        || deterministicLocationResponse
        || deterministicPhoneResponse
        || deterministicHoursAppointmentResponse
        || deterministicHoursResponse
        || deterministicAppointmentResponse
        || deterministicCloseout
        || deterministicContactFallback
        || conductStateForReply !== 'normal'
        ? null
        : buildDeterministicClarifierResponse({
            messageText: text,
            intentCategories: analysis.intentCategories,
            responseMode: analysis.responseDirective.mode,
            semanticSignals: analysis.matchedKeywords,
          });
      let deterministicResponse = deterministicConductResponse?.response
        || deterministicInfoResponse
        || deterministicMassagePricingResponse
        || deterministicPilatesResponse
        || deterministicCampaignResponse?.response
        || deterministicLocationResponse
        || deterministicPhoneResponse
        || deterministicHoursAppointmentResponse
        || deterministicHoursResponse
        || deterministicAppointmentResponse
        || (deterministicCloseout?.action === 'reply' ? deterministicCloseout.response : null)
        || deterministicContactFallback?.response
        || deterministicClarifier?.response
        || null;
      let deterministicModelId = deterministicConductResponse?.modelId || (deterministicInfoResponse
        ? 'deterministic/info-template-v1'
        : deterministicMassagePricingResponse
          ? MASSAGE_PRICING_MODEL_ID
        : deterministicLocationResponse
          ? 'deterministic/contact-location-v1'
            : deterministicPilatesResponse
              ? PILATES_INFO_MODEL_ID
            : deterministicCampaignResponse
              ? CAMPAIGN_INFO_MODEL_ID
            : deterministicPhoneResponse
              ? 'deterministic/contact-phone-v1'
            : deterministicHoursAppointmentResponse
              ? HOURS_APPOINTMENT_MODEL_ID
            : deterministicHoursResponse
              ? 'deterministic/hours-general-v1'
              : deterministicAppointmentResponse
                ? APPOINTMENT_MODEL_ID
              : deterministicCloseout?.action === 'reply'
                ? deterministicCloseout.modelId
                : deterministicContactFallback
                  ? CLARIFY_EXHAUSTED_CONTACT_MODEL_ID
                : deterministicClarifier?.modelId || null);
      let deterministicSessionKey = deterministicConductResponse
        ? 'deterministic-conduct'
        : deterministicInfoResponse
        ? 'deterministic-info-template'
        : deterministicMassagePricingResponse
        ? 'deterministic-massage-pricing'
        : deterministicPilatesResponse
        ? 'deterministic-pilates-info'
        : deterministicCampaignResponse
        ? 'deterministic-campaign-info'
        : deterministicLocationResponse
          ? 'deterministic-contact-location'
          : deterministicPhoneResponse
          ? 'deterministic-contact-phone'
            : deterministicHoursAppointmentResponse
              ? 'deterministic-hours-appointment'
            : deterministicHoursResponse
              ? 'deterministic-hours-general'
              : deterministicAppointmentResponse
                ? 'deterministic-appointment'
              : deterministicCloseout?.action === 'reply'
                ? 'deterministic-closeout'
              : deterministicContactFallback
                ? 'deterministic-contact-fallback'
        : deterministicClarifier
          ? 'deterministic-clarifier'
          : useDirectResponse ? 'direct' : 'simulated-openclaw';
      let cacheTrace = {
        eligible: false,
        hit: false,
        cacheClass: responseCacheClass,
        lookupKey: null as string | null,
        sourceExecutionId: null as string | null,
        status: 'ineligible' as 'active' | 'candidate' | 'miss' | 'ineligible',
        observationCount: null as number | null,
      };
      if (!deterministicResponse && responseCacheClass) {
        const lookupParams = {
          cacheClass: responseCacheClass as any,
          normalizedMessage: DMResponseCacheService.normalizeMessage(text),
          kbSignature: knowledgeContextService.getActiveSignature(),
          configSignature,
          conductState: conductStateForReply,
        };
        if (shouldLookupResponseCache({
          messageText: text,
          analysis,
          conductState: conductStateForReply,
          sexualAction: sexualIntentResult.action,
        })) {
          cacheTrace = {
            eligible: true,
            hit: false,
            cacheClass: responseCacheClass,
            lookupKey: responseCacheService.buildLookupKey(lookupParams),
            sourceExecutionId: null,
            status: 'miss',
            observationCount: null,
          };
          const cacheHit = responseCacheService.lookupActive(lookupParams);
          if (cacheHit) {
            deterministicResponse = cacheHit.responseText;
            deterministicModelId = `cache/${responseCacheClass}`;
            deterministicSessionKey = 'response-cache';
            skipPolicy = true;
            cacheTrace = {
              eligible: true,
              hit: true,
              cacheClass: responseCacheClass,
              lookupKey: cacheHit.lookupKey,
              sourceExecutionId: cacheHit.sourceExecutionId,
              status: cacheHit.status,
              observationCount: cacheHit.observationCount,
            };
          }
        } else {
          cacheTrace = {
            eligible: false,
            hit: false,
            cacheClass: responseCacheClass,
            lookupKey: responseCacheService.buildLookupKey(lookupParams),
            sourceExecutionId: null,
            status: 'ineligible',
            observationCount: null,
          };
        }
      }
      if (deterministicResponse) {
        skipPolicy = true;
        console.log('[Simulator] Using deterministic response path (%s)', deterministicModelId);
      }

      const directResult = deterministicResponse && deterministicModelId
        ? {
            response: deterministicResponse,
            modelId: deterministicModelId,
            latencyMs: 0,
            tokensEstimated: estimateTokens(deterministicResponse),
            usage: {
              ...ZERO_USAGE_METRICS,
              outputTokens: estimateTokens(deterministicResponse),
              totalTokens: estimateTokens(deterministicResponse),
            },
            success: true,
            error: undefined,
          }
        : await directService.generate({
            customerMessage: text,
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

      if (!directResult.success || !directResult.response) {
        res.status(500).json({
          error: 'AI response generation failed',
          details: directResult.error,
          analysis: {
            intentCategories: analysis.intentCategories,
            modelTier: analysis.modelTier,
            modelId: analysis.modelId,
          },
          processingTime: Date.now() - startTime,
        });
        return;
      }

      let finalResponse = finalizeResponseText(directResult.response);
      let policyResult = null;
      const policyUsageEntries: ModelUsageEntry[] = [];
      const validationModelId = pipelineConfig.policy.validationModel;

      // ═══ STAGE 4: Policy Validation + Faithfulness Check (same as webhook) ═══
      if (!skipPolicy) {
        const validation = await policyService.validate({
          customerMessage: text,
          agentResponse: finalResponse,
          knowledgeContext: formattedKnowledge,
          selectedEvidence,
          followUpHint: analysis.followUpHint,
          activeTopic: analysis.activeTopicLabel,
          responseDirective: analysis.responseDirective,
        }, validationModelId);
        policyResult = validation;
        addModelUsageEntry(
          policyUsageEntries,
          validation.usageModelUsed || validation.modelUsed,
          validation.usage?.inputTokens,
          validation.usage?.outputTokens,
        );

        if (!validation.valid) {
          // Try correction
          const correctionModelId = pipelineConfigService.getCorrectionModelForConfig(pipelineConfig, analysis.modelId);
          const correction = await policyService.generateCorrectedResponse(
            text,
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
          addModelUsageEntry(
            policyUsageEntries,
            correction.modelUsed,
            correction.usage?.inputTokens,
            correction.usage?.outputTokens,
          );
          if (correction.response) {
            finalResponse = finalizeResponseText(correction.response);
            // Re-validate corrected response
            const revalidation = await policyService.validate({
              customerMessage: text,
              agentResponse: finalResponse,
              knowledgeContext: formattedKnowledge,
              selectedEvidence,
              followUpHint: analysis.followUpHint,
              activeTopic: analysis.activeTopicLabel,
              responseDirective: analysis.responseDirective,
            }, validationModelId, 2);
            addModelUsageEntry(
              policyUsageEntries,
              revalidation.usageModelUsed || revalidation.modelUsed,
              revalidation.usage?.inputTokens,
              revalidation.usage?.outputTokens,
            );
            policyResult = {
              ...revalidation,
              originalViolations: validation.violations,
              originalReason: validation.reason,
              correctionApplied: true,
            };
            if (!revalidation.valid) {
              finalResponse = finalizeResponseText(pipelineConfig.fallbackMessage);
              policyResult = { ...revalidation, fallback: true };
            }
          } else {
            finalResponse = finalizeResponseText(pipelineConfig.fallbackMessage);
            policyResult = { ...validation, fallback: true };
          }
        }
      }

      const responseTime = Date.now() - startTime;
      const safetyTokens = sexualIntentResult.usage?.totalTokens || 0;
      const contextTokens = (analysis.usageTrace || []).reduce(
        (sum: number, entry: AIUsageTrace) => sum + (entry.totalTokens || 0),
        0,
      );
      const rerankTokens = semanticRerankTrace.totalTokens || 0;
      const directInputTokens = directResult.usage?.inputTokens || 0;
      const directOutputTokens = directResult.usage?.outputTokens || 0;
      const policyTokens = policyResult?.tokensEstimated || 0;
      const safetyFilterMs = sexualIntentResult.latencyMs || 0;
      const directGenerationMs = directResult.latencyMs || 0;
      const policyLatencyMs = policyResult?.latencyMs || 0;
      const uncategorizedMs = Math.max(
        0,
        responseTime - safetyFilterMs - contextAnalysisMs - knowledgeAssemblyMs - directGenerationMs - policyLatencyMs,
      );

      const pipelineTrace = {
        sexualIntent: sexualIntentResult,
        intentCategories: analysis.intentCategories,
        matchedKeywords: analysis.matchedKeywords,
        modelTier: analysis.modelTier,
        modelId: directResult.modelId,
        tierReason: analysis.tierReason,
        isNewCustomer: analysis.isNewCustomer,
        conversationHistory: {
          messageCount: analysis.conversationHistory.length,
          messages: analysis.conversationHistory.map(entry => ({
            direction: entry.direction,
            text: entry.messageText.substring(0, 100),
            timestamp: entry.createdAt,
            relativeTime: entry.relativeTime,
          })),
          formattedForAI: analysis.formattedHistory.substring(0, 500),
          followUpHint: analysis.followUpHint,
          activeState: analysis.conversationState,
          responseDirective: analysis.responseDirective,
        },
        knowledgeCategoriesFetched: Array.from(kbCategories),
        knowledgeFetchStatus: deterministicResponse ? 'skipped' : (knowledgeContext ? 'success' : 'fail'),
        knowledgeEntriesCount,
        semanticRetrieval: semanticRetrievalTrace,
        semanticRerank: semanticRerankTrace,
        conductControl: {
          state: conductStateForReply,
          shouldReply: conductForReply?.shouldReply !== false,
          offenseCount: conductForReply?.offenseCount || 0,
          manualMode: conductForReply?.manualMode || 'auto',
          silentUntil: conductForReply?.silentUntil || null,
          reason: conductForReply?.reason,
        },
        responseStyle: styleProfile.trace,
        humanizer: getHumanizerTrace(),
        fastLane: deterministicResponse ? {
          used: true,
          kind: deterministicSessionKey === 'response-cache'
            ? 'response_cache'
            : deterministicSessionKey === 'deterministic-conduct'
              ? 'deterministic_conduct'
              : deterministicSessionKey === 'deterministic-info-template'
                ? 'deterministic_info_template'
                : deterministicSessionKey === 'deterministic-massage-pricing'
                  ? 'deterministic_massage_pricing'
                : deterministicSessionKey === 'deterministic-pilates-info'
                  ? 'deterministic_pilates_info'
                : deterministicSessionKey === 'deterministic-campaign-info'
                  ? 'deterministic_campaign'
                : deterministicSessionKey === 'deterministic-contact-location'
                    ? 'deterministic_contact_location'
                  : deterministicSessionKey === 'deterministic-contact-phone'
                    ? 'deterministic_contact_phone'
                    : deterministicSessionKey === 'deterministic-contact-fallback'
                      ? 'deterministic_contact_fallback'
                    : deterministicSessionKey === 'deterministic-hours-appointment'
                      ? 'deterministic_hours_appointment'
                    : deterministicSessionKey === 'deterministic-hours-general'
                      ? 'deterministic_hours'
                      : deterministicSessionKey === 'deterministic-appointment'
                        ? 'deterministic_appointment'
                      : deterministicSessionKey === 'deterministic-closeout'
                        ? 'deterministic_closeout'
                        : deterministicSessionKey === 'deterministic-clarifier'
                          ? 'deterministic_clarifier'
                          : 'simple_analysis',
          skippedStages: ['knowledge_fetch', 'semantic_retrieval', 'semantic_rerank', 'direct_response', 'policy_validation'],
        } : simpleTurnUsed ? {
          used: true,
          kind: 'simple_analysis',
          skippedStages: ['context_planner'],
        } : {
          used: false,
          kind: 'none',
          skippedStages: [],
        },
        cache: cacheTrace,
        openclawDispatchStatus: useDirectResponse || deterministicSessionKey !== 'simulated-openclaw' ? 'skipped' : 'success',
        openclawSessionKey: deterministicSessionKey,
        agentPollDurationMs: 0,
        directResponse: {
          used: true,
          latencyMs: directResult.latencyMs,
          modelId: directResult.modelId,
          tokensEstimated: directResult.tokensEstimated,
          inputTokens: directInputTokens,
          outputTokens: directOutputTokens,
        },
        policyValidation: policyResult ? {
          status: (policyResult as any).fallback ? 'fallback' : (policyResult as any).correctionApplied ? 'corrected' : policyResult.valid ? 'pass' : 'fail',
          attempts: (policyResult as any).correctionApplied ? 2 : 1,
          totalLatencyMs: policyResult.latencyMs || 0,
          totalTokens: policyResult.tokensEstimated || 0,
          violations: policyResult.violations,
          reason: policyResult.reason,
          modelUsed: policyResult.usageModelUsed || policyResult.modelUsed,
        } : { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
        metaSendStatus: 'skipped',
        totalResponseTimeMs: responseTime,
        tokensEstimated: safetyTokens + contextTokens + rerankTokens + directResult.tokensEstimated + policyTokens,
        timingBreakdown: {
          ingestDelayMs: null,
          customerPerceivedTotalMs: null,
          safetyFilterMs,
          contextAnalysisMs,
          knowledgeAssemblyMs,
          openclawDispatchMs: 0,
          metaSendMs: 0,
          uncategorizedMs,
        },
        tokenBreakdown: {
          safetyTokens,
          contextTokens,
          rerankTokens,
          directTokens: directResult.tokensEstimated,
          directInputTokens,
          directOutputTokens,
          policyTokens,
          totalTokens: safetyTokens + contextTokens + rerankTokens + directResult.tokensEstimated + policyTokens,
        },
      };

      // Log outbound response with pipeline trace
      const outboundId = randomUUID();
      const outboundNow = new Date().toISOString();
      rawDb.prepare(`
        INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, ai_response, response_time_ms, model_used, tokens_estimated, pipeline_trace, model_tier, execution_id, created_at)
        VALUES (?, ?, 'outbound', ?, 'ai_response', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(outboundId, senderId, finalResponse, finalResponse, responseTime, directResult.modelId, pipelineTrace.tokensEstimated, JSON.stringify(pipelineTrace), analysis.modelTier, executionId, outboundNow);

      const simulatorCostEntries: ModelUsageEntry[] = [];
      addAIUsageTraceEntries(simulatorCostEntries, analysis.usageTrace);
      addModelUsageEntry(
        simulatorCostEntries,
        sexualIntentResult.modelUsed,
        sexualIntentResult.usage?.inputTokens,
        sexualIntentResult.usage?.outputTokens,
      );
      addModelUsageEntry(
        simulatorCostEntries,
        semanticRerankTrace.modelId,
        semanticRerankTrace.inputTokens,
        semanticRerankTrace.outputTokens,
      );
      addModelUsageEntry(
        simulatorCostEntries,
        directResult.modelId,
        directInputTokens,
        directOutputTokens,
      );
      for (const usageEntry of policyUsageEntries) {
        simulatorCostEntries.push(usageEntry);
      }
      if (simulatorCostEntries.length === 0 && pipelineTrace.tokensEstimated > 0) {
        const fallbackSplit = splitEstimatedTokens(pipelineTrace.tokensEstimated);
        addModelUsageEntry(
          simulatorCostEntries,
          directResult.modelId,
          fallbackSplit.inputTokens,
          fallbackSplit.outputTokens,
        );
      }
      insertSimulatorCostLedgerRows(rawDb, simulatorCostEntries);

      try {
        contextService.saveConversationState(senderId, text, finalResponse, analysis);
      } catch (stateErr) {
        console.error('[Simulator] Failed to update conversation state:', stateErr);
      }

      // Push outbound SSE event to DM Kontrol (same as real webhook)
      try {
        const dmSSE = DmSSEManager.getInstance();
        dmSSE.pushEvent({
          type: 'dm:new',
          data: {
            id: outboundId,
            instagramId: senderId,
            direction: 'outbound',
            messageText: finalResponse.substring(0, 200),
            responseTimeMs: responseTime,
            modelTier: analysis.modelTier,
            modelUsed: directResult.modelId,
            pipelineTrace,
            pipelineError: null,
            createdAt: new Date().toISOString(),
          },
        });
        dmSSE.pushEvent({ type: 'dm:health_update', data: { timestamp: new Date().toISOString() } });
      } catch { /* non-fatal */ }

      // Escalate policy violations via EscalationService (same as real webhook)
      if (_escalationService && policyResult && !policyResult.valid) {
        const isFallback = (policyResult as any).fallback;
        _escalationService.escalate({
          source: 'policy_agent',
          type: isFallback ? 'policy_violation_critical' : 'policy_violation_corrected',
          severity: isFallback ? 'critical' : 'low',
          title: `Policy İhlali — ${senderId}`,
          details: [
            `Müşteri: ${message.substring(0, 200)}`,
            `İhlaller: ${(policyResult.violations || []).join(', ')}`,
            `Sebep: ${policyResult.reason || 'bilinmiyor'}`,
            isFallback ? 'Gönderilen: Yedek yanıt (telefon yönlendirme)' : 'Düzeltildi',
          ].join('\n'),
          metadata: { sender_id: senderId, violations: policyResult.violations, source: 'simulator' },
        }).catch(err => console.error('[Simulator] Escalation error:', err.message));
      }

      res.json({
        status: 'success',
        response: finalResponse,
        senderId,
        sexualIntent: sexualIntentResult,
        analysis: {
          intentCategories: analysis.intentCategories,
          matchedKeywords: analysis.matchedKeywords,
          modelTier: analysis.modelTier,
          modelId: directResult.modelId,
          tierReason: analysis.tierReason,
          isNewCustomer: analysis.isNewCustomer,
          conversationLength: analysis.conversationHistory.length,
          knowledgeCategories: analysis.intentCategories,
          knowledgeEntriesCount,
        },
        policy: policyResult ? {
          valid: policyResult.valid,
          violations: policyResult.violations,
          reason: policyResult.reason,
          latencyMs: policyResult.latencyMs,
          ...(policyResult as any).originalViolations ? {
            originalViolations: (policyResult as any).originalViolations,
            correctionApplied: true,
          } : {},
          ...(policyResult as any).fallback ? { fallback: true } : {},
        } : { skipped: true, reason: `tier=${analysis.modelTier} skipPolicy=true` },
        directResponse: {
          latencyMs: directResult.latencyMs,
          tokensEstimated: directResult.tokensEstimated,
        },
        conductControl: pipelineTrace.conductControl,
        responseStyle: pipelineTrace.responseStyle,
        responseTime,
      });
    } catch (error) {
      console.error('[Workflow Test Agent] Error:', error);
      res.status(500).json({
        error: 'Agent simulation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      });
    }
  });

  /**
   * GET /api/workflow-test/conversation/:senderId
   * Get conversation history for a simulated sender
   */
  router.get('/conversation/:senderId', flexibleAuth, (req: Request, res: Response) => {
    try {
      const rawDb = db.getDb();
      const rows = rawDb.prepare(`
        SELECT id, instagram_id, direction, message_text, intent, ai_response, response_time_ms, model_used, tokens_estimated, created_at
        FROM instagram_interactions
        WHERE instagram_id = ?
        ORDER BY created_at ASC
      `).all(req.params.senderId) as any[];
      res.json({ messages: rows, senderId: req.params.senderId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  /**
   * DELETE /api/workflow-test/conversation/:senderId
   * Clear conversation history for a simulated sender
   */
  router.delete('/conversation/:senderId', flexibleAuth, (req: Request, res: Response) => {
    try {
      const rawDb = db.getDb();
      const result = rawDb.prepare(`DELETE FROM instagram_interactions WHERE instagram_id = ?`).run(req.params.senderId);
      res.json({ deleted: result.changes, senderId: req.params.senderId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear conversation' });
    }
  });

  /**
   * GET /api/workflow-test/knowledge
   * Get all knowledge base entries for debugging
   */
  router.get('/knowledge', flexibleAuth, (_req: Request, res: Response) => {
    try {
      const knowledge = knowledgeBaseService.getContext();
      res.json({
        categories: Object.keys(knowledge),
        totalEntries: Object.values(knowledge).reduce((sum, cat) => sum + Object.keys(cat).length, 0),
        data: knowledge
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch knowledge' });
    }
  });

  return router;
}

