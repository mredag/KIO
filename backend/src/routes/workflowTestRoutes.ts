import { Router, Request, Response, NextFunction } from 'express';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { InstagramContextService } from '../services/InstagramContextService.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { DirectResponseService } from '../services/DirectResponseService.js';
import { ResponsePolicyService } from '../services/ResponsePolicyService.js';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { EscalationService } from '../services/EscalationService.js';
import { randomUUID } from 'crypto';

// Escalation service injection (set from index.ts)
let _escalationService: EscalationService | null = null;
export function setSimulatorEscalation(svc: EscalationService): void {
  _escalationService = svc;
}

/**
 * Workflow Test Routes — Instagram DM Agent Simulator
 * Runs the real OpenClaw pipeline (intent detection, model routing, knowledge fetch, AI call)
 * without needing Meta webhook connection.
 */
export function createWorkflowTestRoutes(db: DatabaseService): Router {
  const router = Router();
  const knowledgeBaseService = new KnowledgeBaseService(db);

  // Middleware: session auth (admin panel) OR API key auth (external)
  const flexibleAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.user) return next();
    return apiKeyAuth(req, res, next);
  };

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

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
        return;
      }

      const rawDb = db.getDb();
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
        INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, created_at)
        VALUES (?, ?, 'inbound', ?, ?, ?)
      `).run(inboundId, senderId, text, 'user_message', now);

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

      // ═══ STAGE 1: Context Analysis (same as webhook) ═══
      const analysis = contextService.analyzeMessage(senderId, text);

      // ═══ STAGE 2: Knowledge Fetch + Format (same as webhook) ═══
      // Always include 'contact' — phone/address are in system prompt and fallback
      const kbCategories: Set<string> = new Set(analysis.intentCategories);
      kbCategories.add('contact');
      const categoriesParam = Array.from(kbCategories).join(',');
      const API_KEY = process.env.N8N_API_KEY || '';
      let knowledgeContext = '';
      let knowledgeEntriesCount = 0;
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

      // Format KB from raw JSON to clean labeled text (anti-hallucination)
      const formattedKnowledge = InstagramContextService.formatKnowledgeForPrompt(knowledgeContext);

      // ═══ STAGE 3: Direct Response via OpenRouter (same as webhook) ═══
      const pipelineConfig = pipelineConfigService.getConfig();
      const tierConfig = pipelineConfig.directResponse.tiers[analysis.modelTier];
      const systemPrompt = pipelineConfigService.buildDirectSystemPrompt(formattedKnowledge);
      const skipPolicy = pipelineConfigService.shouldSkipPolicy(analysis.modelTier);

      const customerSummary = analysis.isNewCustomer
        ? 'YENI MUSTERI'
        : `Etkileşim: ${analysis.totalInteractions}`;

      const directService = new DirectResponseService();
      const directResult = await directService.generate({
        customerMessage: text,
        knowledgeContext: formattedKnowledge,
        conversationHistory: analysis.formattedHistory,
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

      let finalResponse = directResult.response;
      let policyResult = null;

      // ═══ STAGE 4: Policy Validation + Faithfulness Check (same as webhook) ═══
      if (!skipPolicy) {
        const validation = await policyService.validate({
          customerMessage: text,
          agentResponse: finalResponse,
          knowledgeContext: formattedKnowledge,
        });
        policyResult = validation;

        if (!validation.valid) {
          // Try correction
          const correctionModelId = pipelineConfigService.getCorrectionModel(analysis.modelId);
          const correction = await policyService.generateCorrectedResponse(
            text, finalResponse, validation, formattedKnowledge, correctionModelId
          );
          if (correction.response) {
            finalResponse = correction.response;
            // Re-validate corrected response
            const revalidation = await policyService.validate({
              customerMessage: text,
              agentResponse: finalResponse,
              knowledgeContext: formattedKnowledge,
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
      const pipelineTrace = {
        intentCategories: analysis.intentCategories,
        matchedKeywords: analysis.matchedKeywords,
        modelTier: analysis.modelTier,
        modelId: directResult.modelId,
        tierReason: analysis.tierReason,
        isNewCustomer: analysis.isNewCustomer,
        knowledgeCategoriesFetched: analysis.intentCategories,
        knowledgeFetchStatus: knowledgeContext ? 'success' : 'fail',
        knowledgeEntriesCount,
        openclawDispatchStatus: 'skipped',
        openclawSessionKey: 'simulator',
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
        INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, ai_response, response_time_ms, model_used, tokens_estimated, pipeline_trace, model_tier, created_at)
        VALUES (?, ?, 'outbound', ?, 'ai_response', ?, ?, ?, ?, ?, ?, ?)
      `).run(outboundId, senderId, finalResponse, finalResponse, responseTime, directResult.modelId, directResult.tokensEstimated, JSON.stringify(pipelineTrace), analysis.modelTier, outboundNow);

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
