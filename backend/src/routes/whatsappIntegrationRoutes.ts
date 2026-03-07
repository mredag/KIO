/**
 * WhatsApp Integration Routes
 * API endpoints for the OpenClaw WhatsApp agent to call:
 * ignore list, interaction logging, policy validation, appointment requests, stats/data queries.
 *
 * Factory pattern: createWhatsappIntegrationRoutes(db) — same as Instagram integration routes.
 * All endpoints authenticated via API key middleware (applied at mount time in index.ts).
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { ResponsePolicyService } from '../services/ResponsePolicyService.js';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { normalizeTurkish } from '../services/InstagramContextService.js';

let _db: Database.Database;

// Lazy-loaded services (avoid circular deps / startup order issues)
let _policyService: ResponsePolicyService | null = null;

function getPolicyService(): ResponsePolicyService {
  if (!_policyService) {
    _policyService = new ResponsePolicyService();
  }
  return _policyService;
}

// Appointment claim patterns (after normalizeTurkish)
const APPOINTMENT_CLAIM_PATTERNS = [
  'randevunuz olusturuldu',
  'rezervasyonunuz onaylandi',
  'randevu onaylandi',
  'randevunuzu olusturduk',
  'randevunuz alindi',
  'randevunuzu onayladim',
  'randevunuz onaylandi',
  'rezervasyonunuz alindi',
];

export function createWhatsappIntegrationRoutes(db: Database.Database): Router {
  _db = db;
  const router = Router();

  // All routes require API key authentication
  router.use(apiKeyAuth);

  // ==================== IGNORE LIST (Task 4.1) ====================

  /**
   * GET /ignore-check/:phone — check if phone is on ignore list
   */
  router.get('/ignore-check/:phone', (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const row = _db.prepare(
        'SELECT id FROM whatsapp_ignore_list WHERE phone = ?'
      ).get(phone);
      res.json({ ignored: !!row });
    } catch (error) {
      console.error('[WA Integration] ignore-check error:', error);
      res.status(500).json({ error: 'Failed to check ignore list' });
    }
  });

  /**
   * GET /ignore-list — list all ignored numbers
   */
  router.get('/ignore-list', (_req: Request, res: Response) => {
    try {
      const rows = _db.prepare(
        'SELECT id, phone, label, added_by, created_at FROM whatsapp_ignore_list ORDER BY created_at DESC'
      ).all();
      res.json({ items: rows });
    } catch (error) {
      console.error('[WA Integration] ignore-list error:', error);
      res.status(500).json({ error: 'Failed to list ignore list' });
    }
  });

  /**
   * POST /ignore-list — add phone to ignore list
   */
  router.post('/ignore-list', (req: Request, res: Response) => {
    try {
      const { phone, label, added_by } = req.body;
      if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
        res.status(400).json({ error: 'phone is required and must be non-empty' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      _db.prepare(`
        INSERT INTO whatsapp_ignore_list (id, phone, label, added_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, phone.trim(), label || null, added_by || 'admin', now);

      // Log to mc_events
      try {
        _db.prepare(`
          INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
          VALUES ('config', ?, 'ignore_list_updated', ?, ?)
        `).run(id, `Ignore list: ${phone.trim()} eklendi`, JSON.stringify({ phone: phone.trim(), label, added_by: added_by || 'admin', action: 'add' }));
      } catch { /* non-critical */ }

      res.json({ success: true, id });
    } catch (error: any) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.message?.includes('UNIQUE')) {
        res.status(409).json({ error: 'Phone already on ignore list' });
        return;
      }
      console.error('[WA Integration] ignore-list add error:', error);
      res.status(500).json({ error: 'Failed to add to ignore list' });
    }
  });

  /**
   * DELETE /ignore-list/:phone — remove phone from ignore list
   */
  router.delete('/ignore-list/:phone', (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const result = _db.prepare(
        'DELETE FROM whatsapp_ignore_list WHERE phone = ?'
      ).run(phone);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Phone not found on ignore list' });
        return;
      }

      // Log to mc_events
      try {
        _db.prepare(`
          INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
          VALUES ('config', ?, 'ignore_list_updated', ?, ?)
        `).run(phone, `Ignore list: ${phone} kaldırıldı`, JSON.stringify({ phone, action: 'remove' }));
      } catch { /* non-critical */ }

      res.json({ success: true });
    } catch (error) {
      console.error('[WA Integration] ignore-list remove error:', error);
      res.status(500).json({ error: 'Failed to remove from ignore list' });
    }
  });

  // ==================== INTERACTION LOGGING (Task 4.3) ====================

  /**
   * POST /interaction — log WhatsApp interaction (inbound or outbound)
   */
  router.post('/interaction', (req: Request, res: Response) => {
    try {
      const {
        phone, direction, message_text, intent, sentiment, ai_response,
        response_time_ms, model_used, tokens_estimated, model_tier,
        pipeline_trace, pipeline_error, media_type, message_id,
      } = req.body;

      if (!phone || !direction || !message_text) {
        res.status(400).json({ error: 'Missing required fields: phone, direction, message_text' });
        return;
      }

      // Duplicate message_id check
      if (message_id) {
        const existing = _db.prepare(
          'SELECT message_id FROM whatsapp_processed_messages WHERE message_id = ?'
        ).get(message_id);
        if (existing) {
          res.json({ success: true, duplicate: true });
          return;
        }
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      _db.prepare(`
        INSERT INTO whatsapp_interactions
        (id, phone, direction, message_text, intent, sentiment, ai_response,
         response_time_ms, model_used, tokens_estimated, model_tier,
         pipeline_trace, pipeline_error, media_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, phone, direction, message_text,
        intent || null, sentiment || null, ai_response || null,
        response_time_ms || null, model_used || null, tokens_estimated || null,
        model_tier || null,
        pipeline_trace ? (typeof pipeline_trace === 'string' ? pipeline_trace : JSON.stringify(pipeline_trace)) : null,
        pipeline_error ? (typeof pipeline_error === 'string' ? pipeline_error : JSON.stringify(pipeline_error)) : null,
        media_type || null,
        now,
      );

      // Mark message_id as processed
      if (message_id) {
        try {
          _db.prepare(
            'INSERT INTO whatsapp_processed_messages (message_id, phone, processed_at) VALUES (?, ?, ?)'
          ).run(message_id, phone, now);
        } catch { /* ignore dup */ }

        // Cleanup old entries (older than 48 hours)
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        _db.prepare('DELETE FROM whatsapp_processed_messages WHERE processed_at < ?').run(cutoff);
      }

      // Fire-and-forget MC integration for outbound interactions
      if (direction === 'outbound') {
        try {
          mcIntegration(phone, id, model_used, tokens_estimated, now);
        } catch (mcErr) {
          console.error('[WA Integration] MC integration error (non-blocking):', mcErr);
        }
      }

      // Emit DM SSE event
      try {
        const sse = DmSSEManager.getInstance();
        sse.pushEvent({
          type: 'dm:new',
          data: {
            id, channel: 'whatsapp', phone, direction, message_text,
            intent, model_used, model_tier, response_time_ms,
            pipelineError: pipeline_error || null,
            createdAt: now,
          },
        });
      } catch { /* non-critical */ }

      res.json({ success: true, interactionId: id });
    } catch (error) {
      console.error('[WA Integration] interaction logging error:', error);
      res.status(500).json({ error: 'Failed to log interaction' });
    }
  });

  // ==================== POLICY VALIDATION (Task 4.5) ====================

  /**
   * POST /validate-response — run policy validation on agent response
   */
  router.post('/validate-response', async (req: Request, res: Response) => {
    try {
      const { phone, customer_message, agent_response, knowledge_context, model_used } = req.body;

      if (!customer_message || !agent_response) {
        res.status(400).json({ error: 'Missing required fields: customer_message, agent_response' });
        return;
      }

      const policyService = getPolicyService();
      let configService: any = null;
      try {
        const { WhatsAppPipelineConfigService } = await import('../services/WhatsAppPipelineConfigService.js');
        configService = new WhatsAppPipelineConfigService(_db);
      } catch { /* fallback below */ }

      const maxRetries = configService?.getConfig()?.policy?.maxRetries ?? 2;
      const fallbackMessage = configService?.getConfig()?.fallbackMessage ?? 'Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58 📞';

      // WhatsApp-specific appointment claim check (Rule 11)
      const normalizedResponse = normalizeTurkish(agent_response.toLowerCase());
      const appointmentClaim = APPOINTMENT_CLAIM_PATTERNS.find(p => normalizedResponse.includes(p));

      if (appointmentClaim) {
        // Appointment claim violation — create escalation artifacts
        const jobId = createPolicyViolationJob(phone, customer_message, agent_response, 'appointment_claim', `Randevu iddiası tespit edildi: "${appointmentClaim}"`);
        triggerEscalation('appointment_claim', phone, customer_message, agent_response, jobId);

        // Attempt correction
        const corrected = await attemptCorrection(policyService, customer_message, agent_response, knowledge_context, model_used, maxRetries, fallbackMessage);

        res.json({
          valid: false,
          corrected_response: corrected,
          violation_type: 'appointment_claim',
          violation_details: `Agent randevu oluşturma/onaylama iddiasında bulundu: "${appointmentClaim}"`,
        });
        return;
      }

      // Standard policy validation (existing 10 rules)
      const validation = await policyService.validate({
        customerMessage: customer_message,
        agentResponse: agent_response,
        knowledgeContext: knowledge_context || '',
      });

      if (validation.valid) {
        res.json({ valid: true });
        return;
      }

      // Policy violation detected
      const violationType = detectViolationType(validation.violations);
      const jobId = createPolicyViolationJob(phone, customer_message, agent_response, violationType, validation.reason);

      // Critical violations: hallucination or appointment claim → escalate
      if (violationType === 'hallucination' || violationType === 'capability_claim') {
        triggerEscalation(violationType, phone, customer_message, agent_response, jobId);
      }

      // Attempt correction
      const corrected = await attemptCorrection(policyService, customer_message, agent_response, knowledge_context, model_used, maxRetries, fallbackMessage);

      res.json({
        valid: false,
        corrected_response: corrected,
        violation_type: violationType,
        violation_details: validation.reason,
      });
    } catch (error) {
      console.error('[WA Integration] validate-response error:', error);
      res.status(500).json({ error: 'Policy validation failed' });
    }
  });

  // ==================== APPOINTMENT REQUESTS (Task 4.7) ====================

  /**
   * GET /appointment-requests — list requests, filterable by status
   */
  router.get('/appointment-requests', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT * FROM whatsapp_appointment_requests';
      const params: any[] = [];

      if (status && typeof status === 'string') {
        sql += ' WHERE status = ?';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';

      const rows = _db.prepare(sql).all(...params);
      res.json({ items: rows });
    } catch (error) {
      console.error('[WA Integration] appointment-requests list error:', error);
      res.status(500).json({ error: 'Failed to list appointment requests' });
    }
  });

  /**
   * POST /appointment-requests — create appointment request
   */
  router.post('/appointment-requests', async (req: Request, res: Response) => {
    try {
      const { phone, service_requested, preferred_date, preferred_time } = req.body;

      if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
        res.status(400).json({ error: 'phone is required' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      _db.prepare(`
        INSERT INTO whatsapp_appointment_requests
        (id, phone, service_requested, preferred_date, preferred_time, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(id, phone.trim(), service_requested || null, preferred_date || null, preferred_time || null, now, now);

      // Trigger Telegram notification (fire-and-forget)
      try {
        await sendAppointmentTelegramNotification(phone.trim(), service_requested, preferred_date, preferred_time);
      } catch (tgErr) {
        console.error('[WA Integration] Telegram notification error (non-blocking):', tgErr);
      }

      res.json({ success: true, id, status: 'pending' });
    } catch (error) {
      console.error('[WA Integration] appointment-requests create error:', error);
      res.status(500).json({ error: 'Failed to create appointment request' });
    }
  });

  /**
   * PATCH /appointment-requests/:id — update status and/or staff_notes
   */
  router.patch('/appointment-requests/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, staff_notes } = req.body;

      const existing = _db.prepare('SELECT id FROM whatsapp_appointment_requests WHERE id = ?').get(id);
      if (!existing) {
        res.status(404).json({ error: 'Appointment request not found' });
        return;
      }

      const now = new Date().toISOString();
      const updates: string[] = [];
      const params: any[] = [];

      if (status) {
        updates.push('status = ?');
        params.push(status);
      }
      if (staff_notes !== undefined) {
        updates.push('staff_notes = ?');
        params.push(staff_notes);
      }
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      _db.prepare(`UPDATE whatsapp_appointment_requests SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      res.json({ success: true });
    } catch (error) {
      console.error('[WA Integration] appointment-requests update error:', error);
      res.status(500).json({ error: 'Failed to update appointment request' });
    }
  });

  // ==================== STATS & DATA QUERIES (Task 4.9) ====================

  /**
   * GET /stats — WhatsApp stats summary
   */
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const msgStats = _db.prepare(`
        SELECT
          COUNT(*) as total_messages,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as response_count,
          AVG(CASE WHEN response_time_ms > 0 THEN response_time_ms END) as avg_response_time
        FROM whatsapp_interactions
        WHERE DATE(created_at) = ?
      `).get(today) as any;

      const violationCount = _db.prepare(`
        SELECT COUNT(*) as count FROM mc_events
        WHERE event_type = 'whatsapp_policy_violation'
          AND DATE(created_at) = ?
      `).get(today) as any;

      const couponCount = _db.prepare(`
        SELECT COUNT(*) as count FROM whatsapp_interactions
        WHERE DATE(created_at) = ? AND intent LIKE '%coupon%'
      `).get(today) as any;

      const appointmentCount = _db.prepare(`
        SELECT COUNT(*) as count FROM whatsapp_appointment_requests
        WHERE DATE(created_at) = ?
      `).get(today) as any;

      res.json({
        total_messages: msgStats?.total_messages || 0,
        response_count: msgStats?.response_count || 0,
        avg_response_time: Math.round(msgStats?.avg_response_time || 0),
        policy_violation_count: violationCount?.count || 0,
        coupon_operations_count: couponCount?.count || 0,
        appointment_request_count: appointmentCount?.count || 0,
      });
    } catch (error) {
      console.error('[WA Integration] stats error:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /recent-messages — last N interactions
   */
  router.get('/recent-messages', (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);

      const rows = _db.prepare(`
        SELECT phone, direction, message_text, intent, model_used, response_time_ms, created_at
        FROM whatsapp_interactions
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit);

      res.json({ items: rows });
    } catch (error) {
      console.error('[WA Integration] recent-messages error:', error);
      res.status(500).json({ error: 'Failed to fetch recent messages' });
    }
  });

  /**
   * GET /conversation/:phone — full conversation history for phone
   */
  router.get('/conversation/:phone', (req: Request, res: Response) => {
    try {
      const { phone } = req.params;

      const rows = _db.prepare(`
        SELECT id, phone, direction, message_text, intent, sentiment, ai_response,
               response_time_ms, model_used, tokens_estimated, model_tier,
               pipeline_trace, pipeline_error, media_type, created_at
        FROM whatsapp_interactions
        WHERE phone = ?
        ORDER BY created_at ASC
      `).all(phone);

      res.json({ items: rows });
    } catch (error) {
      console.error('[WA Integration] conversation error:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  return router;
}


// ==================== HELPER FUNCTIONS ====================

/**
 * Fire-and-forget MC integration for outbound WhatsApp interactions.
 */
function mcIntegration(phone: string, interactionId: string, modelUsed?: string, tokensEstimated?: number, now?: string): void {
  const ts = now || new Date().toISOString();
  const convId = `wa_${phone}_${Date.now()}`;

  // UPSERT mc_conversations (channel='whatsapp')
  _db.prepare(`
    INSERT INTO mc_conversations (id, channel, customer_id, status, message_count, last_message_at, created_at, updated_at)
    VALUES (?, 'whatsapp', ?, 'active', 1, ?, ?, ?)
    ON CONFLICT(channel, customer_id) DO UPDATE SET
      message_count = message_count + 1,
      last_message_at = excluded.last_message_at,
      updated_at = excluded.updated_at
  `).run(convId, phone, ts, ts, ts);

  // Get actual conversation ID (might be existing)
  const conv = _db.prepare(
    `SELECT id FROM mc_conversations WHERE channel = 'whatsapp' AND customer_id = ?`
  ).get(phone) as { id: string } | undefined;
  const actualConvId = conv?.id || convId;

  // INSERT mc_cost_ledger (id is AUTOINCREMENT, omit it)
  const tokenCount = tokensEstimated || 0;
  _db.prepare(`
    INSERT INTO mc_cost_ledger (agent_id, model, provider, input_tokens, output_tokens, cost, job_source, created_at)
    VALUES ('whatsapp-dm', ?, 'openrouter', ?, ?, 0, 'whatsapp', ?)
  `).run(modelUsed || 'unknown', Math.round(tokenCount * 0.6), Math.round(tokenCount * 0.4), ts);

  // INSERT mc_events
  _db.prepare(`
    INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
    VALUES ('conversation', ?, 'dm_response', ?, ?)
  `).run(
    actualConvId,
    `WhatsApp DM yanıt: ${phone}`,
    JSON.stringify({ channel: 'whatsapp', phone, model: modelUsed || null }),
  );
}

/**
 * Create mc_events + mc_jobs Workshop job for a policy violation.
 */
function createPolicyViolationJob(phone: string, customerMessage: string, agentResponse: string, violationType: string, reason: string): string {
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  // mc_events
  try {
    _db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
      VALUES ('conversation', ?, 'whatsapp_policy_violation', ?, ?)
    `).run(
      jobId,
      `WhatsApp politika ihlali: ${violationType}`,
      JSON.stringify({ channel: 'whatsapp', phone, violationType, reason }),
    );
  } catch { /* non-critical */ }

  // mc_jobs Workshop job
  try {
    _db.prepare(`
      INSERT INTO mc_jobs (id, title, status, priority, source, payload)
      VALUES (?, ?, 'queued', ?, 'system', ?)
    `).run(
      jobId,
      `WA Politika İhlali: ${violationType}`,
      violationType === 'hallucination' || violationType === 'appointment_claim' ? 'critical' : 'high',
      JSON.stringify({
        channel: 'whatsapp',
        phone,
        violationType,
        reason,
        customerMessage: customerMessage.substring(0, 200),
        agentResponse: agentResponse.substring(0, 200),
      }),
    );
  } catch { /* non-critical */ }

  return jobId;
}

/**
 * Detect violation type from policy validation violations array.
 */
function detectViolationType(violations: string[]): string {
  const joined = violations.join(' ').toLowerCase();
  if (joined.includes('uydurma') || joined.includes('hallucin') || joined.includes('faithfulness')) return 'hallucination';
  if (joined.includes('randevu') || joined.includes('rezervasyon')) return 'appointment_claim';
  if (joined.includes('yetenek') || joined.includes('capability')) return 'capability_claim';
  if (joined.includes('fiyat') || joined.includes('price')) return 'price_inconsistency';
  if (joined.includes('uygunluk') || joined.includes('relevance') || joined.includes('papağan') || joined.includes('papagan')) return 'relevance';
  return 'policy_violation';
}

/**
 * Attempt to correct a policy-violating response. Returns corrected text or fallback.
 */
async function attemptCorrection(
  policyService: ResponsePolicyService,
  customerMessage: string,
  agentResponse: string,
  knowledgeContext: string,
  modelUsed: string | undefined,
  maxRetries: number,
  fallbackMessage: string,
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const validation = await policyService.validate({
      customerMessage,
      agentResponse,
      knowledgeContext: knowledgeContext || '',
    });

    const correction = await policyService.generateCorrectedResponse(
      customerMessage,
      agentResponse,
      validation,
      knowledgeContext || '',
      modelUsed || 'openai/gpt-4o-mini',
    );

    if (correction.response) {
      // Re-validate the corrected response
      const recheck = await policyService.validate({
        customerMessage,
        agentResponse: correction.response,
        knowledgeContext: knowledgeContext || '',
      });

      // Also check for appointment claims in corrected response
      const normalizedCorrected = normalizeTurkish(correction.response.toLowerCase());
      const hasAppointmentClaim = APPOINTMENT_CLAIM_PATTERNS.some(p => normalizedCorrected.includes(p));

      if (recheck.valid && !hasAppointmentClaim) {
        return correction.response;
      }
    }
  }

  return fallbackMessage;
}

/**
 * Trigger escalation for critical violations (fire-and-forget).
 */
function triggerEscalation(violationType: string, phone: string, customerMessage: string, agentResponse: string, jobId: string): void {
  (async () => {
    try {
      const { EscalationService } = await import('../services/EscalationService.js');
      const { TelegramNotificationService } = await import('../services/TelegramNotificationService.js');
      const telegram = new TelegramNotificationService(_db);
      const escalation = new EscalationService(_db, telegram);

      await escalation.escalate({
        source: 'policy_agent',
        type: violationType === 'hallucination' ? 'policy_violation_critical' : 'policy_violation_critical',
        severity: 'critical',
        title: `WA Politika İhlali: ${violationType}`,
        details: `Müşteri: ${customerMessage.substring(0, 100)}\nYanıt: ${agentResponse.substring(0, 100)}`,
        metadata: { channel: 'whatsapp', phone, violationType },
        jobId,
      });
    } catch (err) {
      console.error('[WA Integration] Escalation error (non-blocking):', err);
    }
  })();
}

/**
 * Send Telegram notification for new appointment request.
 */
async function sendAppointmentTelegramNotification(phone: string, service?: string, date?: string, time?: string): Promise<void> {
  try {
    const { TelegramNotificationService } = await import('../services/TelegramNotificationService.js');
    const telegram = new TelegramNotificationService(_db);

    if (!telegram.isEnabled()) {
      console.log('[WA Integration] Telegram not configured, skipping appointment notification');
      return;
    }

    const waLink = `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
    const lines = [
      `📅 Yeni WhatsApp randevu talebi`,
      `📱 Telefon: ${phone}`,
      service ? `💆 Hizmet: ${service}` : '',
      date ? `📆 Tarih: ${date}` : '',
      time ? `🕐 Saat: ${time}` : '',
      `\n💬 WhatsApp'ta aç: ${waLink}`,
    ].filter(Boolean).join('\n');

    await telegram.notify({
      jobId: 'no-job',
      severity: 'medium',
      title: 'WhatsApp Randevu Talebi',
      body: lines,
      source: 'dm_pipeline',
    });
  } catch (err) {
    console.error('[WA Integration] Telegram appointment notification error:', err);
  }
}
