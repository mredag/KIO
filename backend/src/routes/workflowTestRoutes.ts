import { Router, Request, Response, NextFunction } from 'express';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { InstagramContextService } from '../services/InstagramContextService.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { DirectResponseService } from '../services/DirectResponseService.js';
import { ResponsePolicyService } from '../services/ResponsePolicyService.js';
import { KnowledgeSelectionService } from '../services/KnowledgeSelectionService.js';
import { DMKnowledgeRetrievalService } from '../services/DMKnowledgeRetrievalService.js';
import { DMKnowledgeRerankerService, formatSelectedEvidenceBlock } from '../services/DMKnowledgeRerankerService.js';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { EscalationService } from '../services/EscalationService.js';
import { buildDeterministicClarifierResponse } from '../services/DMPipelineHeuristics.js';
import { buildDMStyleProfile, sanitizeConductResponse } from '../services/DMResponseStyleService.js';
import { formatMassagePricingTemplate } from '../services/GenericInfoTemplateService.js';
import { estimateTokens, ZERO_USAGE_METRICS } from '../services/UsageMetrics.js';
import { hasAgePolicySignals } from '../services/PolicySignalService.js';
import { evaluateSexualIntent, getSexualIntentReply } from '../middleware/sexualIntentFilter.js';
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

  // Middleware: session auth (admin panel) OR API key auth (external)
  const flexibleAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.user) return next();
    return apiKeyAuth(req, res, next);
  };

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
        const conductBefore = _dmConductService?.checkSuspicious('instagram', senderId);

        if (sexualIntentResult.action !== 'allow') {
          const conductAfter = _dmConductService?.flagUser('instagram', senderId, sexualIntentResult.reason, {
            action: sexualIntentResult.action,
            severity: sexualIntentResult.action === 'block_message' ? 'high' : 'medium',
            source: sexualIntentResult.modelUsed,
            messageText: text,
          });
          const effectiveState = conductAfter?.conductState || 'guarded';
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
      const analysis = await contextService.analyzeMessage(senderId, text);

      // ═══ STAGE 2: Knowledge Fetch + Format (same as webhook) ═══
      // Always include 'contact' — phone/address are in system prompt and fallback
      const kbCategories: Set<string> = new Set(analysis.intentCategories);
      if (hasAgePolicySignals(text, analysis.followUpHint?.rewrittenQuestion, analysis.activeTopicLabel)) {
        kbCategories.add('policies');
      }
      kbCategories.add('contact');
      const categoriesParam = Array.from(kbCategories).join(',');
      const API_KEY = process.env.KIO_API_KEY || '';
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
      let semanticRerankTrace = {
        enabled: true,
        modelId: 'disabled',
        candidateCount: 0,
        selectedCount: 0,
        selectedEntries: [] as Array<{ category: string; keyName: string; score: number }>,
        latencyMs: 0,
        skippedReason: 'not_run' as string | null,
        rationale: null as string | null,
      };
      try {
        const kRes = await fetch(
          `http://localhost:3001/api/integrations/knowledge/context?categories=${categoriesParam}`,
          { headers: { 'Authorization': `Bearer ${API_KEY}` } }
        );
        if (kRes.ok) {
          const kData = await kRes.json() as Record<string, unknown>;
          knowledgeContext = JSON.stringify(kData);
          for (const val of Object.values(kData)) {
            if (Array.isArray(val)) knowledgeEntriesCount += val.length;
            else knowledgeEntriesCount += 1;
          }
        }
      } catch { /* knowledge fetch failed, continue */ }

      try {
        const semanticRetrieval = semanticKnowledgeService.findCandidates({
          baseContextJson: knowledgeContext,
          messageText: text,
          followUpHint: analysis.followUpHint,
          activeTopic: analysis.activeTopicLabel,
          primaryCategories: kbCategories,
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
        const supportEntries = knowledgeBaseService.getAll().filter(entry =>
          ['faq', 'hours', 'policies'].includes(entry.category),
        );
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

      // Format KB from raw JSON to clean labeled text (anti-hallucination)
      const formattedKnowledge = await InstagramContextService.formatKnowledgeForPrompt(knowledgeContext);

      // ═══ STAGE 3: Direct Response via OpenRouter (same as webhook) ═══
      const pipelineConfig = pipelineConfigService.getConfig();
      const tierConfig = pipelineConfig.directResponse.tiers[analysis.modelTier];
      const systemPrompt = pipelineConfigService.buildDirectSystemPrompt(formattedKnowledge);
      let skipPolicy = pipelineConfigService.shouldSkipPolicy(analysis.modelTier);

      const customerSummary = analysis.isNewCustomer
        ? 'YENI MUSTERI'
        : `Etkilesim: ${analysis.totalInteractions}`;
      const conductForReply = _dmConductService?.checkSuspicious('instagram', senderId);
      const conductStateForReply: ConductState = conductForReply?.conductState || 'normal';
      const styleProfile = buildDMStyleProfile({
        customerMessage: text,
        conversationHistory: analysis.conversationHistory,
        isNewCustomer: analysis.isNewCustomer,
        followUpHint: analysis.followUpHint,
        conductState: conductStateForReply,
      });

      const directService = new DirectResponseService();
      const deterministicInfoResponse = conductStateForReply === 'normal' && isGenericInfoRequest(text)
        ? buildGenericInfoTemplateFromKnowledge()
        : null;
      const deterministicClarifier = deterministicInfoResponse || conductStateForReply !== 'normal'
        ? null
        : buildDeterministicClarifierResponse({
            messageText: text,
            intentCategories: analysis.intentCategories,
            responseMode: analysis.responseDirective.mode,
            semanticSignals: analysis.matchedKeywords,
          });
      const deterministicResponse = deterministicInfoResponse || deterministicClarifier?.response || null;
      const deterministicModelId = deterministicInfoResponse
        ? 'deterministic/info-template-v1'
        : deterministicClarifier?.modelId || null;
      const deterministicSessionKey = deterministicInfoResponse
        ? 'deterministic-info-template'
        : deterministicClarifier
          ? 'deterministic-clarifier'
          : 'simulator';
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
            usage: ZERO_USAGE_METRICS,
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

      let finalResponse = sanitizeConductResponse(directResult.response, conductStateForReply);
      let policyResult = null;

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
        });
        policyResult = validation;

        if (!validation.valid) {
          // Try correction
          const correctionModelId = pipelineConfigService.getCorrectionModel(analysis.modelId);
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
          if (correction.response) {
            finalResponse = sanitizeConductResponse(correction.response, conductStateForReply);
            // Re-validate corrected response
            const revalidation = await policyService.validate({
              customerMessage: text,
              agentResponse: finalResponse,
              knowledgeContext: formattedKnowledge,
              selectedEvidence,
              followUpHint: analysis.followUpHint,
              activeTopic: analysis.activeTopicLabel,
              responseDirective: analysis.responseDirective,
            });
            policyResult = {
              ...revalidation,
              originalViolations: validation.violations,
              originalReason: validation.reason,
              correctionApplied: true,
            };
            if (!revalidation.valid) {
              finalResponse = pipelineConfig.fallbackMessage;
              policyResult = { ...revalidation, fallback: true };
            }
          } else {
            finalResponse = pipelineConfig.fallbackMessage;
            policyResult = { ...validation, fallback: true };
          }
        }
      }

      const responseTime = Date.now() - startTime;

      // Build pipeline trace (same structure as real webhook)
      finalResponse = sanitizeConductResponse(finalResponse, conductStateForReply);

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
        knowledgeFetchStatus: knowledgeContext ? 'success' : 'fail',
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
        openclawDispatchStatus: 'skipped',
        openclawSessionKey: deterministicSessionKey,
        agentPollDurationMs: 0,
        directResponse: {
          used: true,
          latencyMs: directResult.latencyMs,
          modelId: directResult.modelId,
          tokensEstimated: directResult.tokensEstimated,
        },
        policyValidation: policyResult ? {
          status: (policyResult as any).fallback ? 'fallback' : (policyResult as any).correctionApplied ? 'corrected' : policyResult.valid ? 'pass' : 'fail',
          attempts: (policyResult as any).correctionApplied ? 2 : 1,
          totalLatencyMs: policyResult.latencyMs || 0,
          totalTokens: policyResult.tokensEstimated || 0,
          violations: policyResult.violations,
          reason: policyResult.reason,
          modelUsed: policyResult.modelUsed,
        } : { status: 'skipped', attempts: 0, totalLatencyMs: 0, totalTokens: 0 },
        metaSendStatus: 'skipped',
        totalResponseTimeMs: responseTime,
        tokensEstimated: directResult.tokensEstimated + (policyResult?.tokensEstimated || 0),
      };

      // Log outbound response with pipeline trace
      const outboundId = randomUUID();
      const outboundNow = new Date().toISOString();
      rawDb.prepare(`
        INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, ai_response, response_time_ms, model_used, tokens_estimated, pipeline_trace, model_tier, execution_id, created_at)
        VALUES (?, ?, 'outbound', ?, 'ai_response', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(outboundId, senderId, finalResponse, finalResponse, responseTime, directResult.modelId, pipelineTrace.tokensEstimated, JSON.stringify(pipelineTrace), analysis.modelTier, executionId, outboundNow);

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

