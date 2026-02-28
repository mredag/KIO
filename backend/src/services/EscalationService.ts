/**
 * EscalationService — The decision engine for the closed-loop DM quality system.
 *
 * Routes issues based on severity and confidence to either:
 * 1. Auto-fix agent (analyst agent handles it autonomously)
 * 2. Telegram admin notification (needs human judgment)
 * 3. Log-only (informational, no action needed)
 *
 * Issue sources:
 * - Real-time: ResponsePolicyService violations (policy_violation_corrected/critical)
 * - Nightly: NightlyAuditService findings (hallucinated/partially_grounded)
 * - AutoPilot: DM failures, cost spikes
 *
 * Escalation rules:
 * ┌─────────────────────────────┬──────────────┬─────────────────────────┐
 * │ Issue Type                  │ Severity     │ Action                  │
 * ├─────────────────────────────┼──────────────┼─────────────────────────┤
 * │ policy_violation_critical   │ critical     │ Telegram + Workshop job │
 * │ policy_violation_corrected  │ low          │ Log only (auto-handled) │
 * │ audit: hallucinated         │ high         │ Analyst agent + Telegram│
 * │ audit: partially_grounded   │ medium       │ Analyst agent           │
 * │ dm_pipeline_failure (3+/hr) │ high         │ Telegram notification   │
 * │ cost_spike                  │ medium       │ Telegram notification   │
 * │ repeated_violation_pattern  │ critical     │ Telegram (urgent)       │
 * └─────────────────────────────┴──────────────┴─────────────────────────┘
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { TelegramNotificationService } from './TelegramNotificationService.js';
import type { TelegramMessage } from './TelegramNotificationService.js';

export interface EscalationEvent {
  source: 'policy_agent' | 'nightly_audit' | 'autopilot' | 'dm_pipeline';
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  details: string;
  metadata?: Record<string, any>;
  jobId?: string;  // existing job ID if already created
}

export interface EscalationResult {
  action: 'telegram' | 'agent' | 'both' | 'log_only';
  jobId: string | null;
  telegramSent: boolean;
  message: string;
}

export class EscalationService {
  private db: Database.Database;
  private telegram: TelegramNotificationService;

  // Track recent escalations to avoid spam
  private recentEscalations = new Map<string, number>(); // key → timestamp
  private readonly DEDUP_WINDOW_MS = 300_000; // 5 min dedup

  constructor(db: Database.Database, telegram: TelegramNotificationService) {
    this.db = db;
    this.telegram = telegram;
  }

  /**
   * Main entry point — evaluate an event and route it appropriately.
   */
  async escalate(event: EscalationEvent): Promise<EscalationResult> {
    // Dedup check
    const dedupKey = `${event.source}:${event.type}:${event.title}`;
    const lastSent = this.recentEscalations.get(dedupKey);
    if (lastSent && Date.now() - lastSent < this.DEDUP_WINDOW_MS) {
      return { action: 'log_only', jobId: null, telegramSent: false, message: 'Dedup: recent escalation exists' };
    }

    const decision = this.decide(event);

    let jobId = event.jobId || null;
    let telegramSent = false;

    // Create or assign job to analyst agent if needed
    if (decision.action === 'agent' || decision.action === 'both') {
      jobId = jobId || this.createAnalystJob(event);
    }

    // Send Telegram notification if needed
    if (decision.action === 'telegram' || decision.action === 'both') {
      if (this.telegram.isEnabled()) {
        const msg = this.buildTelegramMessage(event, jobId);
        telegramSent = await this.telegram.notify(msg);
      }
    }

    // Log the escalation
    this.logEscalation(event, decision.action, jobId, telegramSent);
    this.recentEscalations.set(dedupKey, Date.now());

    // Cleanup old dedup entries
    this.cleanupDedup();

    return {
      action: decision.action,
      jobId,
      telegramSent,
      message: decision.reason,
    };
  }

  /**
   * Decision engine — determines action based on source + type + severity.
   */
  private decide(event: EscalationEvent): { action: 'telegram' | 'agent' | 'both' | 'log_only'; reason: string } {
    const { source, type, severity } = event;

    // Critical policy violations → always notify admin
    if (source === 'policy_agent' && type === 'policy_violation_critical') {
      return { action: 'telegram', reason: 'Kritik politika ihlali — yedek yanıt gönderildi' };
    }

    // Corrected violations → log only (system handled it)
    if (source === 'policy_agent' && type === 'policy_violation_corrected') {
      return { action: 'log_only', reason: 'Politika ihlali otomatik düzeltildi' };
    }

    // Nightly audit: hallucinated → analyst agent + telegram
    if (source === 'nightly_audit' && type === 'hallucinated') {
      return { action: 'both', reason: 'Gece denetimi: uydurma yanıt tespit edildi' };
    }

    // Nightly audit: partially grounded → analyst agent only
    if (source === 'nightly_audit' && type === 'partially_grounded') {
      return { action: 'agent', reason: 'Gece denetimi: kısmi doğruluk sorunu' };
    }

    // DM pipeline failures → telegram (infra issue, needs human)
    if (source === 'dm_pipeline' && severity === 'high') {
      return { action: 'telegram', reason: 'DM pipeline ardışık hata — altyapı sorunu olabilir' };
    }

    // Cost spikes → telegram
    if (source === 'autopilot' && type === 'cost_spike') {
      return { action: 'telegram', reason: 'Maliyet artışı tespit edildi' };
    }

    // Check for repeated violation patterns (3+ in 1 hour = critical)
    if (source === 'policy_agent') {
      const recentCount = this.countRecentViolations(1);
      if (recentCount >= 3) {
        return { action: 'telegram', reason: `Tekrarlayan ihlal paterni: son 1 saatte ${recentCount} ihlal` };
      }
    }

    // Default: based on severity
    if (severity === 'critical') return { action: 'telegram', reason: 'Kritik seviye olay' };
    if (severity === 'high') return { action: 'both', reason: 'Yüksek seviye olay' };
    if (severity === 'medium') return { action: 'agent', reason: 'Orta seviye — agent inceleyecek' };
    return { action: 'log_only', reason: 'Düşük seviye — sadece kayıt' };
  }

  /**
   * Count recent policy violations in the last N hours.
   */
  private countRecentViolations(hours: number): number {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as count FROM mc_events
        WHERE event_type IN ('policy_violation_critical', 'policy_violation_corrected')
          AND created_at >= datetime('now', '-${hours} hours')
      `).get() as any;
      return row?.count || 0;
    } catch { return 0; }
  }

  /**
   * Create a job assigned to the analyst agent.
   */
  private createAnalystJob(event: EscalationEvent): string {
    const agent = this.findAgentByRole('analyst') || this.findAgentByRole('default');
    const jobId = randomUUID();

    this.db.prepare(`
      INSERT INTO mc_jobs (id, title, status, priority, source, agent_id, payload)
      VALUES (?, ?, 'queued', ?, 'system', ?, ?)
    `).run(
      jobId,
      event.title,
      event.severity === 'critical' ? 'critical' : event.severity,
      agent?.id || null,
      JSON.stringify({
        trigger: 'escalation',
        source: event.source,
        type: event.type,
        description: event.details,
        metadata: event.metadata || {},
      })
    );

    this.emitEvent('job', jobId, 'escalation_created',
      `Eskalasyon: ${event.title} (${event.source}/${event.type})`);

    return jobId;
  }

  /**
   * Build a Telegram message with customer context and action links.
   */
  private buildTelegramMessage(event: EscalationEvent, jobId: string | null): TelegramMessage {
    const msg: TelegramMessage = {
      jobId: jobId || 'no-job',
      severity: event.severity,
      title: event.title,
      body: this.formatBody(event),
      source: event.source,
    };

    // Look up customer info from instagram_customers if sender_id is available
    const senderId = event.metadata?.sender_id;
    if (senderId) {
      try {
        const customer = this.db.prepare(
          `SELECT instagram_id, name, phone FROM instagram_customers WHERE instagram_id = ?`
        ).get(senderId) as { instagram_id: string; name?: string; phone?: string } | undefined;

        if (customer) {
          msg.customer = {
            instagramId: customer.instagram_id,
            name: customer.name || undefined,
          };
        } else {
          msg.customer = { instagramId: senderId };
        }
      } catch {
        msg.customer = { instagramId: senderId };
      }
    }

    return msg;
  }

  /**
   * Format event details into clean, human-readable text for Telegram.
   * Strips raw JSON, extracts key info, keeps it concise.
   */
  private formatBody(event: EscalationEvent): string {
    const { source, type, details, metadata } = event;

    // DM pipeline failures — extract error stages and counts, skip raw JSON
    if (source === 'dm_pipeline' && type === 'dm_failures') {
      const errorCount = metadata?.errorCount || '?';
      const lines: string[] = [`Son 1 saatte ${errorCount} DM pipeline hatası.`];
      // Parse error stages from the raw details
      const stages = this.extractErrorStages(details);
      if (stages.length > 0) {
        lines.push('');
        lines.push('Hata türleri:');
        for (const s of stages) {
          lines.push(`• ${s}`);
        }
      }
      return lines.join('\n');
    }

    // Cost spike — clean numeric summary
    if (source === 'autopilot' && type === 'cost_spike') {
      const today = metadata?.todayCost;
      const avg = metadata?.avgCost;
      if (today && avg) {
        return `Bugünkü maliyet: $${Number(today).toFixed(3)}\nOrtalama: $${Number(avg).toFixed(3)}\nArtış: ${((today / avg - 1) * 100).toFixed(0)}%`;
      }
    }

    // Policy violations — add context about what the system did
    if (source === 'policy_agent') {
      // The details already contain: customer message, rejected response, violations, reason, action taken
      // Add a header explaining the situation
      const isFallback = details.includes('Yedek yanıt') || details.includes('yedek yanıt');
      const header = isFallback
        ? '⚠️ AI yanıtı düzeltilemedi — müşteriye yedek yanıt (telefon) gönderildi.'
        : '🔄 AI yanıtı otomatik düzeltildi ve gönderildi.';
      return `${header}\n\n${this.truncate(details, 350)}`;
    }

    // Nightly audit — already clean from NightlyAuditService
    if (source === 'nightly_audit') {
      return this.truncate(details, 400);
    }

    // Default — truncate and strip any JSON blobs
    return this.truncate(this.stripJson(details), 400);
  }

  /**
   * Extract human-readable error stage names from raw pipeline error details.
   */
  private extractErrorStages(details: string): string[] {
    const stageMap: Record<string, string> = {
      'policy_validation_fail': 'Politika doğrulama başarısız',
      'meta_send_fail': 'Meta API gönderim hatası',
      'openclaw_timeout': 'OpenClaw zaman aşımı',
      'openclaw_dispatch_fail': 'OpenClaw gönderim hatası',
      'context_error': 'Bağlam analizi hatası',
      'knowledge_fetch_fail': 'Bilgi bankası erişim hatası',
    };
    const found = new Map<string, number>();
    for (const [key, label] of Object.entries(stageMap)) {
      const regex = new RegExp(key, 'g');
      const matches = details.match(regex);
      if (matches) found.set(label, matches.length);
    }
    return Array.from(found.entries()).map(([label, count]) => `${label} (${count}x)`);
  }

  /**
   * Strip JSON objects/arrays from text, leaving only plain text parts.
   */
  private stripJson(text: string): string {
    return text.replace(/\{[^}]{50,}\}/g, '[...]').replace(/\[[^\]]{50,}\]/g, '[...]');
  }

  /**
   * Handle admin decision from Telegram quick action link.
   */
  async handleAdminDecision(jobId: string, decision: 'approve' | 'reject' | 'assign_analyst' | 'detail'): Promise<string> {
    const job = this.db.prepare('SELECT id, title, status, agent_id FROM mc_jobs WHERE id = ?').get(jobId) as any;
    if (!job) return 'Görev bulunamadı';

    if (decision === 'approve') {
      this.db.prepare(`UPDATE mc_jobs SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'admin_approved', 'Admin Telegram üzerinden onayladı');
      return `"${job.title}" onaylandı — AutoPilot agent çalıştıracak.`;
    }

    if (decision === 'reject') {
      this.db.prepare(`UPDATE mc_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'admin_rejected', 'Admin Telegram üzerinden reddetti');
      return `"${job.title}" reddedildi ve iptal edildi.`;
    }

    if (decision === 'assign_analyst') {
      const analyst = this.findAgentByRole('analyst');
      if (analyst) {
        this.db.prepare(`UPDATE mc_jobs SET agent_id = ?, status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(analyst.id, jobId);
        this.emitEvent('job', jobId, 'assigned_to_analyst', `Analiste atandı: ${analyst.name}`);
        return `"${job.title}" analiste atandı (${analyst.name}) — AutoPilot çalıştıracak.`;
      }
      // No analyst agent found — just schedule it with whatever agent is assigned
      this.db.prepare(`UPDATE mc_jobs SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'admin_approved', 'Analyst bulunamadı, mevcut agent ile zamanlandı');
      return `Analyst agent bulunamadı. "${job.title}" mevcut agent ile zamanlandı.`;
    }

    if (decision === 'detail') {
      const payload = this.db.prepare('SELECT payload FROM mc_jobs WHERE id = ?').get(jobId) as any;
      let details = job.title;
      if (payload?.payload) {
        try {
          const p = JSON.parse(payload.payload);
          details = p.description || job.title;
        } catch { /* use title */ }
      }
      return details;
    }

    return 'Bilinmeyen karar';
  }

  /**
   * Get escalation statistics.
   */
  getStats() {
    try {
      const today = this.db.prepare(`
        SELECT
          COUNT(CASE WHEN event_type = 'escalation_created' THEN 1 END) as escalations,
          COUNT(CASE WHEN event_type = 'telegram_notification' THEN 1 END) as notifications,
          COUNT(CASE WHEN event_type = 'admin_approved' THEN 1 END) as approved,
          COUNT(CASE WHEN event_type = 'admin_rejected' THEN 1 END) as rejected
        FROM mc_events
        WHERE created_at >= date('now')
      `).get() as any;
      return today || { escalations: 0, notifications: 0, approved: 0, rejected: 0 };
    } catch { return { escalations: 0, notifications: 0, approved: 0, rejected: 0 }; }
  }

  // ── Helpers ──

  private findAgentByRole(role: string): { id: string; name: string } | null {
    const agent = this.db.prepare(`
      SELECT id, name FROM mc_agents WHERE LOWER(role) LIKE ? AND status IN ('idle', 'active') LIMIT 1
    `).get(`%${role}%`) as any;
    return agent || null;
  }

  private emitEvent(entityType: string, entityId: string, eventType: string, message: string): void {
    this.db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, message)
      VALUES (?, ?, ?, ?)
    `).run(entityType, entityId, eventType, message);
  }

  private logEscalation(event: EscalationEvent, action: string, jobId: string | null, telegramSent: boolean): void {
    this.emitEvent('system', jobId || 'escalation', 'escalation_routed',
      `[${event.severity}] ${event.source}/${event.type} → ${action}${telegramSent ? ' (Telegram ✓)' : ''}`);
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.substring(0, max) + '...' : text;
  }

  private cleanupDedup(): void {
    const now = Date.now();
    for (const [key, ts] of this.recentEscalations) {
      if (now - ts > this.DEDUP_WINDOW_MS) this.recentEscalations.delete(key);
    }
  }
}
