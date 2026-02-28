/**
 * NightlyAuditService — Deep DM quality auditor that runs at 2:00 AM daily.
 *
 * Unlike AutoPilot's real-time triggers (DM failures, policy violations),
 * this service performs a comprehensive, claim-level grounding analysis of
 * ALL outbound DM responses from the past day against the knowledge base.
 *
 * Flow:
 *   1. Cron fires at 2:00 AM Istanbul time
 *   2. Fetch all outbound DMs from last 24h + full KB via DataBridgeService
 *   3. For each response, call LLM to extract factual claims and verify against KB
 *   4. Score each response: grounded / partially_grounded / hallucinated
 *   5. Group issues by type (wrong_price, wrong_address, hallucinated_feature, etc.)
 *   6. Create mc_jobs for each issue group (assignable to coding agents like Jarvis/Forge)
 *   7. Log audit results as mc_events for Activity feed
 *
 * Config stored in mc_policies (same pattern as AutoPilot + PipelineConfig).
 */
import cron from 'node-cron';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { ActivitySSEManager } from './ActivitySSEManager.js';
import { EscalationService } from './EscalationService.js';

// ── Types ──

export interface AuditConfig {
  enabled: boolean;
  cronSchedule: string;           // default '0 2 * * *' (2:00 AM)
  timezone: string;               // default 'Europe/Istanbul'
  model: string;                  // LLM for grounding analysis
  maxTokens: number;
  temperature: number;
  maxResponsesPerAudit: number;   // cap to avoid huge API costs
  minClaimsForFlag: number;       // min ungrounded claims to flag a response
  batchSize: number;              // responses per LLM call (batching)
  lookbackHours: number;          // default 24
  createJobsForIssues: boolean;   // auto-create mc_jobs
  jobPriority: string;            // 'low' | 'medium' | 'high'
}

export interface AuditResponseResult {
  interactionId: string;
  customerId: string;
  customerMessage: string;
  aiResponse: string;
  modelUsed: string | null;
  modelTier: string | null;
  score: 'grounded' | 'partially_grounded' | 'hallucinated';
  totalClaims: number;
  groundedClaims: number;
  ungroundedClaims: ClaimResult[];
  latencyMs: number;
}

export interface ClaimResult {
  claim: string;
  grounded: boolean;
  issueType: string;   // wrong_price, wrong_address, hallucinated_feature, etc.
  reason: string;
}

export interface AuditRunSummary {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  totalResponses: number;
  audited: number;
  grounded: number;
  partiallyGrounded: number;
  hallucinated: number;
  skipped: number;
  jobsCreated: number;
  totalCost: number;
  error?: string;
}

const POLICY_ID = 'nightly_audit_config';
const POLICY_NAME = 'Gece Denetim Yapılandırması';

const DEFAULT_CONFIG: AuditConfig = {
  enabled: true,
  cronSchedule: '0 2 * * *',
  timezone: 'Europe/Istanbul',
  model: 'google/gemini-2.5-flash-lite',
  maxTokens: 600,
  temperature: 0,
  maxResponsesPerAudit: 100,
  minClaimsForFlag: 1,
  batchSize: 5,
  lookbackHours: 24,
  createJobsForIssues: true,
  jobPriority: 'medium',
};

export class NightlyAuditService {
  private db: Database.Database;
  private config: AuditConfig;
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;
  private apiKey: string;
  private currentRun: AuditRunSummary | null = null;
  private escalation: EscalationService | null = null;

  constructor(db: Database.Database) {
    this.db = db;
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG };
    this.ensureConfigExists();
    this.loadConfig();
  }

  setEscalationService(svc: EscalationService): void {
    this.escalation = svc;
  }

  // ── Config Management (mc_policies pattern) ──

  private ensureConfigExists(): void {
    const existing = this.db.prepare('SELECT id FROM mc_policies WHERE id = ?').get(POLICY_ID);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO mc_policies (id, name, type, conditions, actions, is_active, priority, created_at, updated_at)
        VALUES (?, ?, 'guardrail', ?, '{}', 1, 90, datetime('now'), datetime('now'))
      `).run(POLICY_ID, POLICY_NAME, JSON.stringify(DEFAULT_CONFIG));
      console.log('[NightlyAudit] Default config created in mc_policies');
    }
  }

  private loadConfig(): void {
    try {
      const row = this.db.prepare('SELECT conditions FROM mc_policies WHERE id = ?').get(POLICY_ID) as any;
      if (row?.conditions) {
        const saved = JSON.parse(row.conditions);
        this.config = { ...DEFAULT_CONFIG, ...saved };
      }
    } catch { /* use defaults */ }
  }

  getConfig(): AuditConfig {
    this.loadConfig();
    return { ...this.config };
  }

  saveConfig(partial: Partial<AuditConfig>): AuditConfig {
    this.loadConfig();
    this.config = { ...this.config, ...partial };
    this.db.prepare(`UPDATE mc_policies SET conditions = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(this.config), POLICY_ID);

    // Reschedule if cron changed
    if (partial.cronSchedule || partial.enabled !== undefined) {
      this.stop();
      if (this.config.enabled) this.start();
    }
    return { ...this.config };
  }

  // ── Lifecycle ──

  start(): void {
    if (this.task) return;
    if (!this.config.enabled) {
      console.log('[NightlyAudit] Disabled in config, not starting');
      return;
    }

    this.task = cron.schedule(this.config.cronSchedule, () => {
      this.runAudit().catch(err => console.error('[NightlyAudit] Audit error:', err.message));
    }, { timezone: this.config.timezone });

    console.log(`[NightlyAudit] Scheduled at "${this.config.cronSchedule}" (${this.config.timezone})`);
    this.emitEvent('system', 'nightly_audit', 'audit_scheduled',
      `Gece denetimi planlandı: ${this.config.cronSchedule} (${this.config.timezone})`);
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    console.log('[NightlyAudit] Stopped');
  }

  getStatus() {
    return {
      isScheduled: !!this.task,
      isRunning: this.isRunning,
      config: this.getConfig(),
      currentRun: this.currentRun,
      lastRun: this.getLastRun(),
    };
  }

  // ── Core Audit Logic ──

  async runAudit(): Promise<AuditRunSummary> {
    if (this.isRunning) {
      throw new Error('Audit already running');
    }

    this.isRunning = true;
    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    this.currentRun = {
      id: runId,
      startedAt,
      completedAt: null,
      status: 'running',
      totalResponses: 0,
      audited: 0,
      grounded: 0,
      partiallyGrounded: 0,
      hallucinated: 0,
      skipped: 0,
      jobsCreated: 0,
      totalCost: 0,
    };

    this.emitEvent('system', runId, 'audit_started', `Gece denetimi başladı (${startedAt})`);
    this.broadcastSSE({ type: 'audit_started', data: { runId, startedAt } });

    try {
      // 1. Fetch outbound DMs from lookback period
      const cutoff = new Date(Date.now() - this.config.lookbackHours * 3600000).toISOString();
      const responses = this.fetchOutboundResponses(cutoff);
      this.currentRun.totalResponses = responses.length;

      if (responses.length === 0) {
        return this.completeRun(runId, 'No outbound responses to audit');
      }

      // 2. Fetch full KB for grounding
      const kb = this.fetchKnowledgeBase();
      const kbText = this.formatKBForAudit(kb);

      // 3. Audit each response (with batching + cap)
      const toAudit = responses.slice(0, this.config.maxResponsesPerAudit);
      const results: AuditResponseResult[] = [];

      for (let i = 0; i < toAudit.length; i += this.config.batchSize) {
        const batch = toAudit.slice(i, i + this.config.batchSize);
        const batchResults = await Promise.all(
          batch.map(r => this.auditSingleResponse(r, kbText))
        );
        results.push(...batchResults);

        // Update progress
        this.currentRun.audited = results.length;
        this.currentRun.grounded = results.filter(r => r.score === 'grounded').length;
        this.currentRun.partiallyGrounded = results.filter(r => r.score === 'partially_grounded').length;
        this.currentRun.hallucinated = results.filter(r => r.score === 'hallucinated').length;

        this.broadcastSSE({
          type: 'audit_progress',
          data: { runId, audited: results.length, total: toAudit.length },
        });

        // Small delay between batches to avoid rate limits
        if (i + this.config.batchSize < toAudit.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // 4. Store results
      this.storeAuditResults(runId, results);

      // 5. Group issues and create mc_jobs
      const problematic = results.filter(r => r.score !== 'grounded');
      if (problematic.length > 0 && this.config.createJobsForIssues) {
        this.currentRun.jobsCreated = this.createIssueJobs(runId, problematic);
      }

      // 6. Escalate hallucinated findings via EscalationService
      if (this.escalation && problematic.length > 0) {
        const hallucinated = results.filter(r => r.score === 'hallucinated');
        const partial = results.filter(r => r.score === 'partially_grounded');

        if (hallucinated.length > 0) {
          this.escalation.escalate({
            source: 'nightly_audit',
            type: 'hallucinated',
            severity: 'high',
            title: `Gece Denetimi: ${hallucinated.length} uydurma yanıt`,
            details: `${hallucinated.length} yanıt tamamen uydurma bilgi içeriyor. ${partial.length} yanıt kısmi sorunlu. Toplam ${results.length} yanıt incelendi.`,
            metadata: { runId, hallucinated: hallucinated.length, partial: partial.length, total: results.length },
          }).catch(() => {});
        } else if (partial.length > 0) {
          this.escalation.escalate({
            source: 'nightly_audit',
            type: 'partially_grounded',
            severity: 'medium',
            title: `Gece Denetimi: ${partial.length} kısmi sorunlu yanıt`,
            details: `${partial.length} yanıt kısmi doğruluk sorunu içeriyor. Toplam ${results.length} yanıt incelendi.`,
            metadata: { runId, partial: partial.length, total: results.length },
          }).catch(() => {});
        }
      }

      return this.completeRun(runId);
    } catch (err: any) {
      this.currentRun.status = 'failed';
      this.currentRun.error = err.message;
      this.currentRun.completedAt = new Date().toISOString();
      this.emitEvent('system', runId, 'audit_failed', `Denetim hatası: ${err.message}`);
      this.broadcastSSE({ type: 'audit_failed', data: { runId, error: err.message } });
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  // ── Single Response Audit (LLM grounding check) ──

  private async auditSingleResponse(
    response: { id: string; instagram_id: string; message_text: string; ai_response: string; model_used: string | null; model_tier: string | null },
    kbText: string
  ): Promise<AuditResponseResult> {
    const startTime = Date.now();

    // Skip empty or very short responses (greetings)
    if (!response.ai_response || response.ai_response.length < 20) {
      return {
        interactionId: response.id,
        customerId: response.instagram_id,
        customerMessage: response.message_text || '',
        aiResponse: response.ai_response || '',
        modelUsed: response.model_used,
        modelTier: response.model_tier,
        score: 'grounded',
        totalClaims: 0,
        groundedClaims: 0,
        ungroundedClaims: [],
        latencyMs: 0,
      };
    }

    const prompt = `Sen bir DM kalite denetçisisin. Asistanın yanıtındaki HER olgusal iddiayı BILGI_BANKASI ile karşılaştır.

GÖREV:
1. Yanıttan tüm olgusal iddiaları çıkar (adres, fiyat, saat, telefon, hizmet adı, konum, bina adı, mahalle adı, indirim, kampanya vb.)
2. Her iddiayı BILGI_BANKASI'nda ara
3. BILGI_BANKASI'nda OLMAYAN veya FARKLI olan her iddia = UYDURMA

SINIFLANDIRMA KURALLARI:
- Selamlama, nezaket ifadeleri, "size yardımcı olabilirim" gibi genel cümleler iddia DEĞİLDİR — bunları atla
- Sadece SOMUT BİLGİ içeren iddiaları kontrol et
- Fiyat formatı farklı olabilir (800₺ vs 800 TL) — sayısal değer aynıysa DOĞRU say
- Adres bilgisinde mahalle, sokak, bina adı BİREBİR aynı olmalı
- "Sınırsız" gibi nitelemeler KB'de yoksa = UYDURMA
- Kampanya/indirim bilgisi KB'de yoksa = UYDURMA

SORUN TİPLERİ (issueType):
- wrong_price: Fiyat yanlış veya uydurma
- wrong_address: Adres bilgisi yanlış
- wrong_hours: Çalışma saatleri yanlış
- wrong_phone: Telefon numarası yanlış
- hallucinated_feature: KB'de olmayan hizmet/özellik uydurma
- hallucinated_campaign: KB'de olmayan kampanya/indirim uydurma
- wrong_service_detail: Hizmet detayı yanlış (süre, içerik vb.)
- other: Diğer uydurma bilgi

MÜŞTERI MESAJI: ${response.message_text || '(bilinmiyor)'}

ASISTAN YANITI: ${response.ai_response}

BILGI_BANKASI:
${kbText}

YANITINI SADECE JSON OLARAK VER:
{"claims": [{"claim": "iddia metni", "grounded": true/false, "issueType": "tip", "reason": "açıklama"}]}`;

    try {
      const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://spa-kiosk.local',
          'X-Title': 'Eform Nightly Audit',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const latencyMs = Date.now() - startTime;

      if (!apiResponse.ok) {
        console.error('[NightlyAudit] API error:', apiResponse.status);
        return this.buildSkippedResult(response, latencyMs, 'API error');
      }

      const data = await apiResponse.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      // Estimate cost
      const estimateTokens = (text: string) => Math.ceil(text.length / 3);
      const tokens = estimateTokens(prompt) + estimateTokens(content);
      this.currentRun!.totalCost += tokens * 0.00000004; // rough estimate

      // Parse LLM response
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const result = JSON.parse(cleaned);
      const claims: ClaimResult[] = (result.claims || []).map((c: any) => ({
        claim: c.claim || '',
        grounded: c.grounded !== false,
        issueType: c.issueType || 'other',
        reason: c.reason || '',
      }));

      const ungrounded = claims.filter(c => !c.grounded);
      const totalClaims = claims.length;
      const groundedCount = claims.filter(c => c.grounded).length;

      let score: 'grounded' | 'partially_grounded' | 'hallucinated';
      if (ungrounded.length === 0) {
        score = 'grounded';
      } else if (groundedCount > 0 && ungrounded.length <= groundedCount) {
        score = 'partially_grounded';
      } else {
        score = 'hallucinated';
      }

      return {
        interactionId: response.id,
        customerId: response.instagram_id,
        customerMessage: response.message_text || '',
        aiResponse: response.ai_response,
        modelUsed: response.model_used,
        modelTier: response.model_tier,
        score,
        totalClaims,
        groundedClaims: groundedCount,
        ungroundedClaims: ungrounded,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[NightlyAudit] Audit error for %s:', response.id, err.message);
      return this.buildSkippedResult(response, latencyMs, err.message);
    }
  }

  private buildSkippedResult(
    response: { id: string; instagram_id: string; message_text: string; ai_response: string; model_used: string | null; model_tier: string | null },
    latencyMs: number,
    _error: string
  ): AuditResponseResult {
    this.currentRun!.skipped++;
    return {
      interactionId: response.id,
      customerId: response.instagram_id,
      customerMessage: response.message_text || '',
      aiResponse: response.ai_response || '',
      modelUsed: response.model_used,
      modelTier: response.model_tier,
      score: 'grounded', // fail-open: don't flag on errors
      totalClaims: 0,
      groundedClaims: 0,
      ungroundedClaims: [],
      latencyMs,
    };
  }

  // ── Data Fetching ──

  private fetchOutboundResponses(cutoff: string) {
    return this.db.prepare(`
      SELECT id, instagram_id, message_text, ai_response, model_used, model_tier
      FROM instagram_interactions
      WHERE direction = 'outbound'
        AND ai_response IS NOT NULL
        AND ai_response != ''
        AND created_at >= ?
      ORDER BY created_at DESC
    `).all(cutoff) as any[];
  }

  private fetchKnowledgeBase() {
    return this.db.prepare(`
      SELECT category, key_name, value FROM knowledge_base WHERE is_active = 1 ORDER BY category, key_name
    `).all() as { category: string; key_name: string; value: string }[];
  }

  private formatKBForAudit(kb: { category: string; key_name: string; value: string }[]): string {
    const grouped: Record<string, string[]> = {};
    for (const entry of kb) {
      if (!grouped[entry.category]) grouped[entry.category] = [];
      grouped[entry.category].push(`${entry.key_name}: ${entry.value}`);
    }
    return Object.entries(grouped)
      .map(([cat, entries]) => `[${cat}]\n${entries.join('\n')}`)
      .join('\n\n');
  }

  // ── Result Storage ──

  private storeAuditResults(runId: string, results: AuditResponseResult[]): void {
    // Store as a single mc_event with full results in metadata
    const summary = {
      runId,
      totalResponses: this.currentRun!.totalResponses,
      audited: results.length,
      grounded: results.filter(r => r.score === 'grounded').length,
      partiallyGrounded: results.filter(r => r.score === 'partially_grounded').length,
      hallucinated: results.filter(r => r.score === 'hallucinated').length,
      skipped: this.currentRun!.skipped,
      issues: results
        .filter(r => r.score !== 'grounded')
        .map(r => ({
          interactionId: r.interactionId,
          customerId: r.customerId,
          score: r.score,
          claims: r.ungroundedClaims,
        })),
    };

    this.db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
      VALUES ('system', ?, 'audit_completed', ?, ?)
    `).run(runId, `Denetim tamamlandı: ${summary.audited} yanıt incelendi`, JSON.stringify(summary));
  }

  // ── Issue Grouping & Job Creation ──

  private createIssueJobs(runId: string, problematic: AuditResponseResult[]): number {
    // Group all ungrounded claims by issueType
    const issueGroups: Record<string, { claims: ClaimResult[]; responses: { id: string; customerId: string; aiResponse: string }[] }> = {};

    for (const r of problematic) {
      for (const claim of r.ungroundedClaims) {
        const type = claim.issueType || 'other';
        if (!issueGroups[type]) {
          issueGroups[type] = { claims: [], responses: [] };
        }
        issueGroups[type].claims.push(claim);
        // Avoid duplicate response refs
        if (!issueGroups[type].responses.find(x => x.id === r.interactionId)) {
          issueGroups[type].responses.push({
            id: r.interactionId,
            customerId: r.customerId,
            aiResponse: r.aiResponse.substring(0, 200),
          });
        }
      }
    }

    const issueTypeLabels: Record<string, string> = {
      wrong_price: 'Yanlış Fiyat',
      wrong_address: 'Yanlış Adres',
      wrong_hours: 'Yanlış Çalışma Saati',
      wrong_phone: 'Yanlış Telefon',
      hallucinated_feature: 'Uydurma Hizmet/Özellik',
      hallucinated_campaign: 'Uydurma Kampanya/İndirim',
      wrong_service_detail: 'Yanlış Hizmet Detayı',
      other: 'Diğer Uydurma Bilgi',
    };

    let jobsCreated = 0;
    const agent = this.findAgentByRole('default') || this.findAgentByRole('instagram');

    for (const [issueType, group] of Object.entries(issueGroups)) {
      if (group.claims.length < this.config.minClaimsForFlag) continue;

      const label = issueTypeLabels[issueType] || issueType;
      const jobId = randomUUID();
      const claimSummary = group.claims
        .slice(0, 10)
        .map(c => `• "${c.claim}" — ${c.reason}`)
        .join('\n');

      const description = [
        `Gece denetiminde ${group.claims.length} adet "${label}" sorunu tespit edildi.`,
        `Etkilenen ${group.responses.length} yanıt var.`,
        '',
        'Tespit edilen sorunlar:',
        claimSummary,
        '',
        'Aksiyon: Bilgi bankasını kontrol et, gerekirse güncelle. Prompt template\'i gözden geçir.',
      ].join('\n');

      this.db.prepare(`
        INSERT INTO mc_jobs (id, title, status, priority, source, agent_id, payload)
        VALUES (?, ?, 'queued', ?, 'cron', ?, ?)
      `).run(
        jobId,
        `[Denetim] ${label} (${group.claims.length} sorun)`,
        this.config.jobPriority,
        agent?.id || null,
        JSON.stringify({
          trigger: 'nightly_audit',
          auditRunId: runId,
          issueType,
          description: description,
          claimCount: group.claims.length,
          affectedResponses: group.responses.length,
          claims: group.claims.slice(0, 20),
        })
      );

      this.emitEvent('job', jobId, 'autopilot_created',
        `Gece denetimi: ${label} — ${group.claims.length} sorun, ${group.responses.length} yanıt etkilendi`);

      jobsCreated++;
    }

    return jobsCreated;
  }

  // ── Helpers ──

  private completeRun(runId: string, note?: string): AuditRunSummary {
    this.currentRun!.status = 'completed';
    this.currentRun!.completedAt = new Date().toISOString();

    const summary = `Denetim tamamlandı: ${this.currentRun!.audited} incelendi, ` +
      `${this.currentRun!.grounded} doğru, ${this.currentRun!.partiallyGrounded} kısmi, ` +
      `${this.currentRun!.hallucinated} uydurma, ${this.currentRun!.jobsCreated} görev oluşturuldu`;

    console.log(`[NightlyAudit] ${summary}`);
    this.emitEvent('system', runId, 'audit_completed', note || summary);
    this.broadcastSSE({ type: 'audit_completed', data: { ...this.currentRun } });

    return { ...this.currentRun! };
  }

  private findAgentByRole(role: string): { id: string; name: string } | null {
    const agent = this.db.prepare(`
      SELECT id, name FROM mc_agents
      WHERE LOWER(role) LIKE ? AND status IN ('idle', 'active')
      LIMIT 1
    `).get(`%${role}%`) as any;
    return agent || null;
  }

  private emitEvent(entityType: string, entityId: string, eventType: string, message: string): void {
    this.db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, message)
      VALUES (?, ?, ?, ?)
    `).run(entityType, entityId, eventType, message);
  }

  private broadcastSSE(event: { type: string; data: any }): void {
    try {
      ActivitySSEManager.getInstance().broadcast(event);
    } catch { /* SSE not critical */ }
  }

  getLastRun(): AuditRunSummary | null {
    try {
      const row = this.db.prepare(`
        SELECT metadata FROM mc_events
        WHERE event_type = 'audit_completed' AND entity_type = 'system'
        ORDER BY created_at DESC LIMIT 1
      `).get() as any;
      if (!row?.metadata) return null;
      const data = JSON.parse(row.metadata);
      return {
        id: data.runId,
        startedAt: '',
        completedAt: '',
        status: 'completed',
        totalResponses: data.totalResponses || 0,
        audited: data.audited || 0,
        grounded: data.grounded || 0,
        partiallyGrounded: data.partiallyGrounded || 0,
        hallucinated: data.hallucinated || 0,
        skipped: data.skipped || 0,
        jobsCreated: 0,
        totalCost: 0,
      };
    } catch { return null; }
  }

  getAuditHistory(limit: number = 20): any[] {
    return this.db.prepare(`
      SELECT entity_id as run_id, message, metadata, created_at
      FROM mc_events
      WHERE event_type = 'audit_completed' AND entity_type = 'system'
      ORDER BY created_at DESC LIMIT ?
    `).all(limit);
  }

  getAuditDetail(runId: string): any {
    const row = this.db.prepare(`
      SELECT entity_id as run_id, message, metadata, created_at
      FROM mc_events
      WHERE event_type = 'audit_completed' AND entity_type = 'system' AND entity_id = ?
    `).get(runId) as any;
    if (!row) return null;
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }
}
