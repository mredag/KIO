import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Database from 'better-sqlite3';
import { InstagramContextService } from '../services/InstagramContextService.js';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { ResponsePolicyService } from '../services/ResponsePolicyService.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { DirectResponseService } from '../services/DirectResponseService.js';
import type { PolicyValidationResult } from '../services/ResponsePolicyService.js';
import { EscalationService } from '../services/EscalationService.js';
import { evaluateSexualIntent } from '../middleware/sexualIntentFilter.js';

// Escalation service injection (set from index.ts)
let _escalationService: EscalationService | null = null;
export function setEscalationService(svc: EscalationService): void {
  _escalationService = svc;
}

export interface PipelineTrace {
  // Sexual intent filter (pre-processing safety check)
  sexualIntent?: {
    action: 'allow' | 'retry_question' | 'block_message';
    confidence: number;
    reason: string;
    modelUsed: string;
    latencyMs: number;
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
  };
  knowledgeCategoriesFetched: string[];
  knowledgeFetchStatus: 'success' | 'fail' | 'skipped';
  knowledgeEntriesCount: number;
  openclawDispatchStatus: 'success' | 'fail';
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
  
  const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || 'spa-kiosk-instagram-verify';
  const OPENCLAW_WEBHOOK_URL = process.env.OPENCLAW_IG_WEBHOOK_URL || '';
  const OPENCLAW_HOOKS_TOKEN = process.env.OPENCLAW_HOOKS_TOKEN || '';
  const OPENCLAW_SESSIONS_DIR = join(homedir(), '.openclaw', 'agents', 'main', 'sessions');

  // Dedup guard — Meta sends the same webhook multiple times (retries).
  // Track recently processed message IDs to avoid duplicate AI responses.
  const recentMessageIds = new Map<string, number>(); // mid → timestamp
  const DEDUP_WINDOW_MS = 60_000; // ignore duplicate within 60s
  const SEXUAL_BLOCK_MESSAGE = 'Bu konuda yardımcı olamam. Lütfen uygun bir dille yazın.';
  const SEXUAL_RETRY_MESSAGE = 'Tekrar eder misiniz? Anlayamadım...';

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

  async function sendInstagramText(apiKey: string, recipientId: string, message: string): Promise<boolean> {
    try {
      const sendRes = await fetch('http://localhost:3001/api/integrations/instagram/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ recipientId, message }),
      });
      return sendRes.ok;
    } catch {
      return false;
    }
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

          const API_KEY = process.env.N8N_API_KEY || ''; // legacy env var name
          const startTime = Date.now();
          
          // Generate unique execution ID for this DM pipeline run
          const executionId = `EXE-${randomUUID().substring(0, 8)}`;
          console.log('[Instagram Webhook] Starting pipeline execution: %s', executionId);

          // Initialize trace and error tracking
          const trace: Partial<PipelineTrace> = {};
          let pipelineError: PipelineError | null = null;

          // Safety filter (AI intent classification) — replaces hard regex rules
          // Flow:
          // - >85% sexual => block reply + stop pipeline
          // - 70-85% => retry prompt + stop pipeline
          // - <70% => continue normal DM flow
          const sexualIntentStartTime = Date.now();
          try {
            const sexualDecision = await evaluateSexualIntent(messageText);
            const sexualIntentLatency = Date.now() - sexualIntentStartTime;

            // Store sexual intent result in trace (for transparency in all cases)
            trace.sexualIntent = {
              action: sexualDecision.action,
              confidence: sexualDecision.confidence,
              reason: sexualDecision.reason,
              modelUsed: sexualDecision.modelUsed,
              latencyMs: sexualIntentLatency,
            };

            if (sexualDecision.action !== 'allow') {
              const now = new Date().toISOString();

              // Ensure customer exists before logging interaction rows
              db.prepare(`
                INSERT INTO instagram_customers (instagram_id, interaction_count, created_at, updated_at)
                VALUES (?, 0, ?, ?)
                ON CONFLICT(instagram_id) DO UPDATE SET updated_at = excluded.updated_at
              `).run(senderId, now, now);

              const inboundId = randomUUID();
              db.prepare(`
                INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, execution_id, created_at)
                VALUES (?, ?, 'inbound', ?, ?, ?, ?)
              `).run(inboundId, senderId, messageText, `sexual_intent_${sexualDecision.action}`, executionId, now);

              const replyText = sexualDecision.action === 'block_message'
                ? SEXUAL_BLOCK_MESSAGE
                : SEXUAL_RETRY_MESSAGE;
              const outboundIntent = sexualDecision.action === 'block_message'
                ? 'security_block'
                : 'retry_question';

              const sent = await sendInstagramText(API_KEY, senderId, replyText);

              const outboundId = randomUUID();
              db.prepare(`
                INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, ai_response, model_used, execution_id, created_at, pipeline_trace)
                VALUES (?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?)
              `).run(
                outboundId,
                senderId,
                replyText,
                outboundIntent,
                replyText,
                sexualDecision.modelUsed,
                executionId,
                new Date().toISOString(),
                JSON.stringify(trace),
              );

              console.log('[Instagram Webhook] Sexual intent filter triggered:', {
                senderId,
                action: sexualDecision.action,
                confidence: Number((sexualDecision.confidence * 100).toFixed(1)),
                reason: sexualDecision.reason,
                sent,
              });

              // Push SSE event for blocked/retry messages
              try {
                DmSSEManager.getInstance().pushEvent({
                  type: 'dm:response',
                  data: {
                    id: outboundId,
                    instagramId: senderId,
                    direction: 'outbound',
                    messageText: replyText.substring(0, 200),
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
            // Store error in trace for debugging
            trace.sexualIntent = {
              action: 'allow',
              confidence: 0,
              reason: `Classification error: ${intentErr?.message || String(intentErr)}`,
              modelUsed: 'error',
              latencyMs: sexualIntentLatency,
            };
          }

          // Context Service — analyze message for intent, model routing, and conversation history
          const contextService = new InstagramContextService(db);
          let analysis;

          try {
            analysis = await contextService.analyzeMessage(senderId, messageText);
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
            };
          } catch (contextErr: any) {
            // Context service error — use defaults and record error
            analysis = {
              conversationHistory: [],
              formattedHistory: '',
              intentCategories: ['general', 'faq'],
              matchedKeywords: [],
              tierReason: 'Varsayılan model (hata durumu) → standard',
              modelTier: 'standard' as const,
              modelId: 'moonshotai/kimi-k2',
              isNewCustomer: true,
              totalInteractions: 0,
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

          try {
            // Fetch category-filtered knowledge context
            // Always include 'contact' — the phone number and address are referenced
            // in the system prompt and fallback message, so the policy agent needs
            // to see them to avoid false "hallucination" flags.
            const categories: Set<string> = new Set(analysis.intentCategories);
            categories.add('contact');
            const categoriesParam = Array.from(categories).join(',');
            const [knowledgeRes] = await Promise.allSettled([
              fetch(`http://localhost:3001/api/integrations/knowledge/context?categories=${categoriesParam}`,
                { headers: { 'Authorization': `Bearer ${API_KEY}` } }),
            ]);

            let knowledgeContext = '';
            let knowledgeEntriesCount = 0;
            if (knowledgeRes.status === 'fulfilled' && knowledgeRes.value.ok) {
              const kData = await knowledgeRes.value.json() as Record<string, unknown>;
              knowledgeContext = typeof kData === 'object' ? JSON.stringify(kData) : String(kData);
              if (typeof kData === 'object' && kData !== null) {
                for (const val of Object.values(kData)) {
                  if (Array.isArray(val)) knowledgeEntriesCount += val.length;
                  else knowledgeEntriesCount += 1;
                }
              }
            }

            // Update trace — knowledge fetch stage
            trace.knowledgeCategoriesFetched = Array.from(categories);
            trace.knowledgeFetchStatus = (knowledgeRes.status === 'fulfilled' && knowledgeRes.value.ok) ? 'success' : 'fail';
            trace.knowledgeEntriesCount = knowledgeEntriesCount;

            // Format KB from raw JSON into clean labeled Turkish text.
            // Raw JSON like {"contact":{"address":"..."}} is hard for LLMs to parse —
            // they sometimes ignore JSON values and hallucinate from training data.
            // Plain text with clear labels eliminates this failure mode.
            const formattedKnowledge = await InstagramContextService.formatKnowledgeForPrompt(knowledgeContext);

            // Build enriched message — agent just needs to generate Turkish text
            // Keep prompt minimal to save tokens — instructions are in AGENTS.md core files
            const customerSummary = analysis.isNewCustomer
              ? 'YENI MUSTERI'
              : analysis.totalInteractions > 0 && analysis.conversationHistory.length === 0
                ? `Geri gelen musteri (toplam ${analysis.totalInteractions} mesaj, son 24 saatte mesaj yok)`
                : `Etkilesim: ${analysis.totalInteractions}`;

            // ═══════════════════════════════════════════════════════════════
            // PIPELINE CONFIG — Dynamic routing (direct vs OpenClaw)
            // Config stored in mc_policies, editable via /dm-kontrol/pipeline-config
            // ═══════════════════════════════════════════════════════════════
            const pipelineConfigService = new PipelineConfigService(db);
            const pipelineConfig = pipelineConfigService.getConfig();
            const useDirectResponse = pipelineConfigService.shouldUseDirectResponse(analysis.modelTier);
            const skipPolicy = pipelineConfigService.shouldSkipPolicy(analysis.modelTier);

            let agentResponse: string | null = null;

            if (useDirectResponse) {
              // ═══════════════════════════════════════════════════════════
              // DIRECT RESPONSE PATH — Bypass OpenClaw for eligible tiers
              // Saves ~8-10s by calling OpenRouter directly
              // ═══════════════════════════════════════════════════════════
              const directService = new DirectResponseService();
              const tierConfig = pipelineConfig.directResponse.tiers[analysis.modelTier];
              const systemPrompt = pipelineConfigService.buildDirectSystemPrompt(formattedKnowledge);

              console.log('[Instagram Webhook] Using DIRECT response path (tier: %s, model: %s)', analysis.modelTier, tierConfig.modelId);

              const directResult = await directService.generate({
                customerMessage: messageText,
                knowledgeContext: formattedKnowledge,
                conversationHistory: analysis.formattedHistory,
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
                '',
                `MUSTERI MESAJI: ${messageText}`,
                '',
                `BILGI BANKASI:`,
                formattedKnowledge || '(bilgi alinamadi)',
                '',
                `MUSTERI: ${customerSummary}`,
                analysis.formattedHistory ? `\nSON KONUSMA:\n${analysis.formattedHistory}` : '',
              ].filter(Boolean).join('\n');

              // Send to OpenClaw /hooks/instagram (matches hook mapping)
              const sessionKey = `hook:instagram:${senderId}`;
              const fullSessionKey = `agent:main:${sessionKey}`;
              const hookUrl = OPENCLAW_WEBHOOK_URL.replace(/\/hooks\/.*$/, '/hooks/instagram');
              
              // Record dispatch time — only poll for responses AFTER this timestamp
              const dispatchTime = new Date().toISOString();
              console.log('[Instagram Webhook] Forwarding to OpenClaw /hooks/instagram (dispatchTime: %s)', dispatchTime);
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
              const ocBody = await openclawResponse.json() as Record<string, unknown>;
              console.log('[Instagram Webhook] OpenClaw response:', openclawResponse.status, ocBody);

              // Update trace — OpenClaw dispatch stage
              trace.openclawDispatchStatus = openclawResponse.status === 202 ? 'success' : 'fail';
              trace.openclawSessionKey = fullSessionKey;

              if (openclawResponse.status !== 202) {
                console.error('[Instagram Webhook] OpenClaw rejected:', ocBody);
                pipelineError = {
                  stage: 'openclaw_dispatch_fail',
                  message: JSON.stringify(ocBody),
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
            let finalResponse = agentResponse;
            let policyTotalLatencyMs = 0;
            let policyTotalTokens = 0;
            let policyAttempts = 0;
            let policyStatus: 'pass' | 'fail' | 'corrected' | 'fallback' | 'skipped' = skipPolicy ? 'skipped' : 'pass';
            let lastValidation: PolicyValidationResult | null = null;
            let firstRejection: { violations: string[]; reason: string } | null = null;

            if (skipPolicy) {
              console.log('[PolicyAgent] Skipped for tier=%s (config)', analysis.modelTier);
            } else {
              // Validation + retry loop
              for (let attempt = 1; attempt <= MAX_POLICY_RETRIES + 1; attempt++) {
                policyAttempts = attempt;
                const validation = await policyService.validate({
                  customerMessage: messageText,
                  agentResponse: finalResponse,
                  knowledgeContext: formattedKnowledge,
                }, attempt);
                lastValidation = validation;
                policyTotalLatencyMs += validation.latencyMs;
                policyTotalTokens += validation.tokensEstimated;

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
                  const correctionModelId = pipelineConfigService.getCorrectionModel(analysis.modelId);
                  const correction = await policyService.generateCorrectedResponse(
                    messageText, finalResponse, validation, formattedKnowledge, correctionModelId
                  );
                  policyTotalLatencyMs += correction.latencyMs;
                  policyTotalTokens += correction.tokensEstimated;

                  if (correction.response) {
                    finalResponse = correction.response;
                    console.log('[PolicyAgent] Direct correction ready (attempt %d, %dms), re-validating...', attempt + 1, correction.latencyMs);
                    continue;
                  }

                  // If correction failed, fall through to fallback
                  console.warn('[PolicyAgent] Direct correction attempt %d failed, using fallback', attempt);
                }

                // All retries exhausted — use safe fallback
                policyStatus = 'fallback';
                finalResponse = pipelineConfig.fallbackMessage;
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
              modelUsed: lastValidation?.modelUsed,
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
            try {
              const sendRes = await fetch('http://localhost:3001/api/integrations/instagram/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({ recipientId: senderId, message: finalResponse }),
              });
              const sendData = await sendRes.json() as Record<string, unknown>;
              console.log('[Instagram Webhook] Send result:', sendRes.status, sendData);

              // Update trace — Meta send stage
              trace.metaSendStatus = sendRes.ok ? 'success' : 'fail';
              if (!sendRes.ok) {
                trace.metaSendError = JSON.stringify(sendData);
                pipelineError = {
                  stage: 'meta_send_fail',
                  message: `Meta send failed: ${sendRes.status}`,
                  timestamp: new Date().toISOString(),
                  partialTrace: { ...trace },
                };
              }
            } catch (sendErr: any) {
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

            // Compute tokens and finalize trace
            const estimateTokens = (text: string) => Math.ceil(text.length / 3);
            const directTokens = trace.directResponse?.tokensEstimated || 0;
            const outputTokens = estimateTokens(finalResponse);
            // If direct response was used, tokens are already counted in directTokens
            // If OpenClaw was used, estimate from the enriched message
            const inputTokens = trace.directResponse?.used ? 0 : estimateTokens(messageText + knowledgeContext);
            trace.tokensEstimated = inputTokens + outputTokens + policyTotalTokens + directTokens;
            trace.totalResponseTimeMs = Date.now() - startTime;

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

            // Store pipeline trace in DB and push SSE events
            const finalResponseTime = Date.now() - startTime;
            storePipelineTraceAndPushSSE(senderId, trace, pipelineError, analysis.modelTier, 'outbound', finalResponse, finalResponseTime, trace.directResponse?.used ? trace.directResponse.modelId : analysis.modelId);

            // MC Integration — fire-and-forget
            try {
              const totalTokensForCost = trace.tokensEstimated || 0;
              const estimatedCost = totalTokensForCost * 0.000001;
              const actualModelUsedMC = trace.directResponse?.used ? trace.directResponse.modelId : analysis.modelId;

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

              // INSERT mc_cost_ledger
              db.prepare(`
                INSERT INTO mc_cost_ledger (agent_id, model, provider, input_tokens, output_tokens, cost, job_source, created_at)
                VALUES ('instagram-dm', ?, 'openrouter', ?, ?, ?, 'instagram', datetime('now'))
              `).run(actualModelUsedMC, Math.round(totalTokensForCost * 0.6), Math.round(totalTokensForCost * 0.4), estimatedCost);

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
