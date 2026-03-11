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
  jobId?: string;
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
  private recentEscalations = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 300_000;

  constructor(db: Database.Database, telegram: TelegramNotificationService) {
    this.db = db;
    this.telegram = telegram;
  }

  async escalate(event: EscalationEvent): Promise<EscalationResult> {
    const dedupKey = `${event.source}:${event.type}:${event.title}`;
    const lastSent = this.recentEscalations.get(dedupKey);
    if (lastSent && Date.now() - lastSent < this.DEDUP_WINDOW_MS) {
      return {
        action: 'log_only',
        jobId: null,
        telegramSent: false,
        message: 'Dedup: recent escalation exists',
      };
    }

    const decision = this.decide(event);
    let jobId = event.jobId || null;
    let telegramSent = false;

    if (decision.action === 'agent' || decision.action === 'both') {
      jobId = jobId || this.createAnalystJob(event);
    }

    if (decision.action === 'telegram' || decision.action === 'both') {
      if (this.telegram.isEnabled()) {
        const msg = this.buildTelegramMessage(event, jobId);
        telegramSent = await this.telegram.notify(msg);
      }
    }

    this.logEscalation(event, decision.action, jobId, telegramSent);
    this.recentEscalations.set(dedupKey, Date.now());
    this.cleanupDedup();

    return {
      action: decision.action,
      jobId,
      telegramSent,
      message: decision.reason,
    };
  }

  private decide(event: EscalationEvent): { action: 'telegram' | 'agent' | 'both' | 'log_only'; reason: string } {
    const { source, type, severity } = event;

    if (source === 'dm_pipeline' && type === 'permanent_ban_applied') {
      return { action: 'telegram', reason: 'Kalici ban uygulandi - Instagram tarafinda rapor ve blok gerekli' };
    }

    if (source === 'policy_agent' && type === 'policy_violation_critical') {
      return { action: 'telegram', reason: 'Kritik politika ihlali - yedek yanit gonderildi' };
    }

    if (source === 'policy_agent' && type === 'policy_violation_corrected') {
      return { action: 'log_only', reason: 'Politika ihlali otomatik duzeltildi' };
    }

    if (source === 'nightly_audit' && type === 'hallucinated') {
      return { action: 'both', reason: 'Gece denetimi: uydurma yanit tespit edildi' };
    }

    if (source === 'nightly_audit' && type === 'partially_grounded') {
      return { action: 'agent', reason: 'Gece denetimi: kismi dogruluk sorunu' };
    }

    if (source === 'dm_pipeline' && severity === 'high') {
      return { action: 'telegram', reason: 'DM pipeline ardasik hata - altyapi sorunu olabilir' };
    }

    if (source === 'autopilot' && type === 'cost_spike') {
      return { action: 'telegram', reason: 'Maliyet artisi tespit edildi' };
    }

    if (source === 'policy_agent') {
      const recentCount = this.countRecentViolations(1);
      if (recentCount >= 3) {
        return { action: 'telegram', reason: `Tekrarlayan ihlal paterni: son 1 saatte ${recentCount} ihlal` };
      }
    }

    if (severity === 'critical') return { action: 'telegram', reason: 'Kritik seviye olay' };
    if (severity === 'high') return { action: 'both', reason: 'Yuksek seviye olay' };
    if (severity === 'medium') return { action: 'agent', reason: 'Orta seviye - agent inceleyecek' };
    return { action: 'log_only', reason: 'Dusuk seviye - sadece kayit' };
  }

  private countRecentViolations(hours: number): number {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as count FROM mc_events
        WHERE event_type IN ('policy_violation_critical', 'policy_violation_corrected')
          AND created_at >= datetime('now', '-${hours} hours')
      `).get() as any;
      return row?.count || 0;
    } catch {
      return 0;
    }
  }

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
      }),
    );

    this.emitEvent('job', jobId, 'escalation_created', `Eskalasyon: ${event.title} (${event.source}/${event.type})`);
    return jobId;
  }

  private buildTelegramMessage(event: EscalationEvent, jobId: string | null): TelegramMessage {
    const msg: TelegramMessage = {
      jobId: jobId || 'no-job',
      severity: event.severity,
      title: event.title,
      body: this.formatBody(event),
      source: event.source,
    };

    const senderId = event.metadata?.sender_id;
    if (senderId) {
      try {
        const customer = this.db.prepare(
          `SELECT instagram_id, name, phone FROM instagram_customers WHERE instagram_id = ?`,
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

  private formatBody(event: EscalationEvent): string {
    const { source, type, details, metadata } = event;

    if (source === 'dm_pipeline' && type === 'permanent_ban_applied') {
      const lines: string[] = ['KIO icinde kalici engel uygulandi.'];

      if (metadata?.reason || details) {
        lines.push(`Sebep: ${metadata?.reason || details}`);
      }

      if (metadata?.message_excerpt) {
        lines.push(`Tetikleyen mesaj: ${this.truncate(String(metadata.message_excerpt), 160)}`);
      }

      if (Array.isArray(metadata?.matched_terms) && metadata.matched_terms.length > 0) {
        lines.push(`Eslesen terimler: ${metadata.matched_terms.join(', ')}`);
      }

      if (metadata?.conduct_state_before || metadata?.offense_count_after) {
        lines.push(
          `Davranis durumu: ${metadata?.conduct_state_before || 'normal'} | Ihlal sayisi: ${metadata?.offense_count_after || '?'}`,
        );
      }

      lines.push('');
      lines.push('Aksiyon: Instagram uygulamasinda bu hesabi report edin ve blocklayin.');
      return lines.join('\n');
    }

    if (source === 'dm_pipeline' && type === 'dm_failures') {
      const errorCount = metadata?.errorCount || '?';
      const lines: string[] = [`Son 1 saatte ${errorCount} DM pipeline hatasi.`];
      const stages = this.extractErrorStages(details);
      if (stages.length > 0) {
        lines.push('');
        lines.push('Hata turleri:');
        for (const stage of stages) {
          lines.push(`- ${stage}`);
        }
      }
      return lines.join('\n');
    }

    if (source === 'autopilot' && type === 'cost_spike') {
      const today = metadata?.todayCost;
      const avg = metadata?.avgCost;
      if (today && avg) {
        return `Bugunku maliyet: $${Number(today).toFixed(3)}\nOrtalama: $${Number(avg).toFixed(3)}\nArtis: ${((today / avg - 1) * 100).toFixed(0)}%`;
      }
    }

    if (source === 'policy_agent') {
      const isFallback = details.includes('Yedek yanit') || details.includes('yedek yanit');
      const header = isFallback
        ? 'AI yaniti duzeltilemedi - musteriye yedek yanit (telefon) gonderildi.'
        : 'AI yaniti otomatik duzeltildi ve gonderildi.';
      return `${header}\n\n${this.truncate(details, 350)}`;
    }

    if (source === 'nightly_audit') {
      return this.truncate(details, 400);
    }

    return this.truncate(this.stripJson(details), 400);
  }

  private extractErrorStages(details: string): string[] {
    const stageMap: Record<string, string> = {
      policy_validation_fail: 'Politika dogrulama basarisiz',
      meta_send_fail: 'Meta API gonderim hatasi',
      openclaw_timeout: 'OpenClaw zaman asimi',
      openclaw_dispatch_fail: 'OpenClaw gonderim hatasi',
      context_error: 'Baglam analizi hatasi',
      knowledge_fetch_fail: 'Bilgi bankasi erisim hatasi',
    };
    const found = new Map<string, number>();
    for (const [key, label] of Object.entries(stageMap)) {
      const regex = new RegExp(key, 'g');
      const matches = details.match(regex);
      if (matches) {
        found.set(label, matches.length);
      }
    }
    return Array.from(found.entries()).map(([label, count]) => `${label} (${count}x)`);
  }

  private stripJson(text: string): string {
    return text.replace(/\{[^}]{50,}\}/g, '[...]').replace(/\[[^\]]{50,}\]/g, '[...]');
  }

  async handleAdminDecision(
    jobId: string,
    decision: 'approve' | 'reject' | 'assign_analyst' | 'detail',
  ): Promise<string> {
    const job = this.db.prepare('SELECT id, title, status, agent_id FROM mc_jobs WHERE id = ?').get(jobId) as any;
    if (!job) return 'Gorev bulunamadi';

    if (decision === 'approve') {
      this.db.prepare(`UPDATE mc_jobs SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'admin_approved', 'Admin Telegram uzerinden onayladi');
      return `"${job.title}" onaylandi - AutoPilot agent calistiracak.`;
    }

    if (decision === 'reject') {
      this.db.prepare(`UPDATE mc_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'admin_rejected', 'Admin Telegram uzerinden reddetti');
      return `"${job.title}" reddedildi ve iptal edildi.`;
    }

    if (decision === 'assign_analyst') {
      const analyst = this.findAgentByRole('analyst');
      if (analyst) {
        this.db.prepare(`UPDATE mc_jobs SET agent_id = ?, status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(analyst.id, jobId);
        this.emitEvent('job', jobId, 'assigned_to_analyst', `Analiste atandi: ${analyst.name}`);
        return `"${job.title}" analiste atandi (${analyst.name}) - AutoPilot calistiracak.`;
      }

      this.db.prepare(`UPDATE mc_jobs SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'admin_approved', 'Analyst bulunamadi, mevcut agent ile zamanlandi');
      return `Analyst agent bulunamadi. "${job.title}" mevcut agent ile zamanlandi.`;
    }

    if (decision === 'detail') {
      const payload = this.db.prepare('SELECT payload FROM mc_jobs WHERE id = ?').get(jobId) as any;
      let details = job.title;
      if (payload?.payload) {
        try {
          const parsed = JSON.parse(payload.payload);
          details = parsed.description || job.title;
        } catch {
          // keep title
        }
      }
      return details;
    }

    return 'Bilinmeyen karar';
  }

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
    } catch {
      return { escalations: 0, notifications: 0, approved: 0, rejected: 0 };
    }
  }

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
    this.emitEvent(
      'system',
      jobId || 'escalation',
      'escalation_routed',
      `[${event.severity}] ${event.source}/${event.type} -> ${action}${telegramSent ? ' (Telegram ok)' : ''}`,
    );
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? `${text.substring(0, max)}...` : text;
  }

  private cleanupDedup(): void {
    const now = Date.now();
    for (const [key, ts] of this.recentEscalations) {
      if (now - ts > this.DEDUP_WINDOW_MS) {
        this.recentEscalations.delete(key);
      }
    }
  }
}
