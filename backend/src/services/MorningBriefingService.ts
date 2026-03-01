/**
 * MorningBriefingService — AI-powered daily Telegram briefing at 9 AM Istanbul time.
 *
 * Gathers raw data (stats, actual conversations, errors, costs, week comparison),
 * feeds it to an LLM with a warm "Jarvis" persona, and gets back a narrative
 * briefing that reads like a thoughtful colleague's morning report.
 *
 * Key improvements over a stats dump:
 *   - Week-over-week comparison (is business growing?)
 *   - Peak hours analysis
 *   - Conversation quality insights (reads actual messages)
 *   - Failed/blocked conversations flagged for follow-up
 *   - One clear actionable recommendation
 *   - Graceful handling of quiet days
 *
 * Config stored in mc_policies (same pattern as NightlyAudit + AutoPilot).
 */
import cron from 'node-cron';
import Database from 'better-sqlite3';
import { TelegramNotificationService } from './TelegramNotificationService.js';
import { ActivitySSEManager } from './ActivitySSEManager.js';

export interface BriefingConfig {
  enabled: boolean;
  cronSchedule: string;
  timezone: string;
  lookbackHours: number;
  model: string;
  maxTokens: number;
}

const POLICY_ID = 'morning_briefing_config';
const POLICY_NAME = 'Sabah Brifing Yapılandırması';

const DEFAULT_CONFIG: BriefingConfig = {
  enabled: true,
  cronSchedule: '0 9 * * *',
  timezone: 'Europe/Istanbul',
  lookbackHours: 24,
  model: 'google/gemini-2.5-flash-lite',
  maxTokens: 1500,
};

export class MorningBriefingService {
  private db: Database.Database;
  private telegram: TelegramNotificationService;
  private config: BriefingConfig;
  private task: cron.ScheduledTask | null = null;
  private lastSentAt: string | null = null;
  private lastError: string | null = null;
  private apiKey: string;

  constructor(db: Database.Database, telegram: TelegramNotificationService) {
    this.db = db;
    this.telegram = telegram;
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG };
    this.ensureConfigExists();
    this.loadConfig();
  }

  // ── Config Management ──

  private ensureConfigExists(): void {
    const existing = this.db.prepare('SELECT id FROM mc_policies WHERE id = ?').get(POLICY_ID);
    if (!existing) {
      this.db.prepare(`
        INSERT INTO mc_policies (id, name, type, conditions, actions, is_active, priority, created_at, updated_at)
        VALUES (?, ?, 'guardrail', ?, '{}', 1, 80, datetime('now'), datetime('now'))
      `).run(POLICY_ID, POLICY_NAME, JSON.stringify(DEFAULT_CONFIG));
      console.log('[MorningBriefing] Default config created in mc_policies');
    }
  }

  private loadConfig(): void {
    try {
      const row = this.db.prepare('SELECT conditions FROM mc_policies WHERE id = ?').get(POLICY_ID) as any;
      if (row?.conditions) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(row.conditions) };
      }
    } catch { /* use defaults */ }
  }

  getConfig(): BriefingConfig { this.loadConfig(); return { ...this.config }; }

  saveConfig(partial: Partial<BriefingConfig>): BriefingConfig {
    this.loadConfig();
    this.config = { ...this.config, ...partial };
    this.db.prepare(`UPDATE mc_policies SET conditions = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(this.config), POLICY_ID);
    if (partial.cronSchedule || partial.enabled !== undefined) {
      this.stop();
      if (this.config.enabled) this.start();
    }
    return { ...this.config };
  }

  // ── Lifecycle ──

  start(): void {
    if (this.task) return;
    if (!this.config.enabled) { console.log('[MorningBriefing] Disabled'); return; }
    this.task = cron.schedule(this.config.cronSchedule, () => {
      this.sendBriefing().catch(err => console.error('[MorningBriefing] Error:', err.message));
    }, { timezone: this.config.timezone });
    console.log(`[MorningBriefing] Scheduled at "${this.config.cronSchedule}" (${this.config.timezone})`);
  }

  stop(): void { if (this.task) { this.task.stop(); this.task = null; } }

  getStatus() {
    return { isScheduled: !!this.task, config: this.getConfig(), lastSentAt: this.lastSentAt, lastError: this.lastError };
  }

  // ── Core: Generate + Send ──

  async sendBriefing(): Promise<{ ok: boolean; message: string }> {
    if (!this.telegram.isEnabled()) return { ok: false, message: 'Telegram not configured' };
    try {
      const html = await this.generateBriefingHtml();
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
      if (!chatId) return { ok: false, message: 'TELEGRAM_ADMIN_CHAT_ID not set' };

      const botToken = this.telegram.getBotToken();
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const err = await res.text();
        this.lastError = `Telegram ${res.status}: ${err}`;
        return { ok: false, message: this.lastError };
      }

      this.lastSentAt = new Date().toISOString();
      this.lastError = null;
      this.emitEvent('briefing_sent', 'Sabah brifing gönderildi');
      this.broadcastSSE({ type: 'briefing_sent', data: { sentAt: this.lastSentAt } });
      console.log('[MorningBriefing] ✅ Sent');
      return { ok: true, message: 'Briefing sent successfully' };
    } catch (err: any) {
      this.lastError = err.message;
      return { ok: false, message: err.message };
    }
  }

  async generateBriefingHtml(): Promise<string> {
    const data = this.gatherAllData();

    if (!this.apiKey) return this.buildFallbackHtml(data);

    try {
      return await this.callLLM(data);
    } catch (err: any) {
      console.error('[MorningBriefing] LLM failed, using fallback:', err.message);
      return this.buildFallbackHtml(data);
    }
  }

  // ── LLM Call ──

  private async callLLM(data: BriefingData): Promise<string> {
    const prompt = this.buildPrompt(data);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://spa-kiosk.local',
        'X-Title': 'Eform Morning Briefing',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: JARVIS_PERSONA },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: this.config.maxTokens,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
    const result = await response.json() as any;
    const text = result?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) throw new Error('Empty LLM response');
    return text;
  }

  // ── Prompt Builder ──

  private buildPrompt(data: BriefingData): string {
    const p: string[] = [];
    const today = new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    p.push(`TARİH: ${today}`);
    p.push(`DÖNEM: Son ${this.config.lookbackHours} saat`);
    p.push('');

    // ── Yesterday vs Previous Period ──
    p.push('=== DÜN vs ÖNCEKİ DÖNEM ===');
    p.push(`Dün: ${data.yesterday.inbound} gelen, ${data.yesterday.outbound} giden, ${data.yesterday.uniqueSenders} müşteri`);
    p.push(`Önceki dönem (aynı süre): ${data.previousPeriod.inbound} gelen, ${data.previousPeriod.outbound} giden, ${data.previousPeriod.uniqueSenders} müşteri`);
    if (data.yesterday.avgResponseMs > 0) {
      p.push(`Ort. yanıt süresi: ${(data.yesterday.avgResponseMs / 1000).toFixed(1)}s (en hızlı: ${(data.yesterday.fastestMs / 1000).toFixed(1)}s, en yavaş: ${(data.yesterday.slowestMs / 1000).toFixed(1)}s)`);
    }
    p.push(`Toplam müşteri (tüm zamanlar): ${data.allTimeCustomers}`);
    p.push('');

    // ── Peak Hours ──
    if (data.peakHours.length > 0) {
      p.push('=== YOĞUN SAATLER (dün) ===');
      for (const h of data.peakHours) p.push(`Saat ${h.hour}:00 — ${h.count} mesaj`);
      p.push('');
    }

    // ── Conversations (the gold) ──
    if (data.conversations.length > 0) {
      p.push('=== KONUŞMALAR ===');
      for (const c of data.conversations) {
        const isNew = c.isNewCustomer ? '🆕 YENİ' : `🔄 (${c.totalVisits} ziyaret)`;
        p.push(`[${c.time}] Müşteri #${c.shortId} ${isNew}`);
        p.push(`  Sordu: "${c.customerMsg}"`);
        if (c.aiResponse) {
          p.push(`  AI yanıtı: "${c.aiResponse.substring(0, 250)}${c.aiResponse.length > 250 ? '...' : ''}"`);
        }
        if (c.wasBlocked) p.push('  ⛔ ENGELLENDI (uygunsuz içerik)');
        if (c.hadError) p.push(`  ❌ HATA: ${c.error}`);
        p.push(`  Niyet: ${c.intent} | Duygu: ${c.sentiment} | Model: ${c.model || '-'} | Süre: ${c.responseMs ? (c.responseMs / 1000).toFixed(1) + 's' : '-'}`);
        p.push('');
      }
    } else {
      p.push('=== KONUŞMALAR ===');
      p.push('Dün hiç DM gelmedi.');
      p.push('');
    }

    // ── Blocked/Suspicious ──
    if (data.blockedCount > 0) {
      p.push(`=== ENGELLİ/ŞÜPHELİ: ${data.blockedCount} mesaj engellendi ===`);
      p.push('');
    }

    // ── Intent Breakdown ──
    if (data.intents.length > 0) {
      p.push('=== NİYET DAĞILIMI (dün) ===');
      for (const i of data.intents) p.push(`${i.intent}: ${i.count}`);
      p.push('');
    }

    // ── Model Usage ──
    if (data.models.length > 0) {
      p.push('=== MODEL KULLANIMI ===');
      for (const m of data.models) p.push(`${m.model}: ${m.count} yanıt`);
      p.push('');
    }

    // ── Cost ──
    p.push('=== MALİYET ===');
    if (data.cost.totalTokens > 0) {
      p.push(`Token: ~${data.cost.totalTokens.toLocaleString()} | Maliyet: $${data.cost.totalCost.toFixed(4)}`);
    } else {
      p.push('Token maliyeti kaydı yok (mc_cost_ledger boş)');
    }
    p.push('');

    // ── Errors ──
    if (data.errors.length > 0) {
      p.push('=== HATALAR ===');
      for (const e of data.errors) p.push(`[${e.time}] ${e.error}`);
      p.push('');
    }

    // ── System Health ──
    p.push('=== SİSTEM ===');
    p.push(`Backend uptime: ${data.system.uptime}`);
    p.push(`Politika ihlali: ${data.system.policyViolations}`);
    if (data.system.lastAudit) p.push(`Son denetim: ${data.system.lastAudit}`);

    return p.join('\n');
  }

  // ── Data Gathering ──

  private gatherAllData(): BriefingData {
    const now = Date.now();
    const lookbackMs = this.config.lookbackHours * 3600000;
    const cutoff = new Date(now - lookbackMs).toISOString();
    const prevCutoff = new Date(now - lookbackMs * 2).toISOString();

    return {
      yesterday: this.getPeriodStats(cutoff),
      previousPeriod: this.getPeriodStats(prevCutoff, cutoff),
      allTimeCustomers: this.getAllTimeCustomers(),
      peakHours: this.getPeakHours(cutoff),
      conversations: this.getConversationThreads(cutoff),
      blockedCount: this.getBlockedCount(cutoff),
      intents: this.getIntentBreakdown(cutoff),
      models: this.getModelDistribution(cutoff),
      cost: this.getCostSummary(cutoff),
      errors: this.getErrors(cutoff),
      system: this.getSystemHealth(cutoff),
    };
  }

  private getPeriodStats(from: string, to?: string): PeriodStats {
    try {
      const where = to ? `created_at >= ? AND created_at < ?` : `created_at >= ?`;
      const params = to ? [from, to] : [from];

      const inbound = (this.db.prepare(`SELECT COUNT(*) as c FROM instagram_interactions WHERE direction='inbound' AND ${where}`).get(...params) as any)?.c || 0;
      const outbound = (this.db.prepare(`SELECT COUNT(*) as c FROM instagram_interactions WHERE direction='outbound' AND ${where}`).get(...params) as any)?.c || 0;
      const uniqueSenders = (this.db.prepare(`SELECT COUNT(DISTINCT instagram_id) as c FROM instagram_interactions WHERE direction='inbound' AND ${where}`).get(...params) as any)?.c || 0;
      const timing = this.db.prepare(`SELECT AVG(response_time_ms) as avg, MIN(response_time_ms) as min, MAX(response_time_ms) as max FROM instagram_interactions WHERE direction='outbound' AND response_time_ms > 0 AND ${where}`).get(...params) as any;

      return {
        inbound, outbound, uniqueSenders,
        avgResponseMs: timing?.avg || 0,
        fastestMs: timing?.min || 0,
        slowestMs: timing?.max || 0,
      };
    } catch {
      return { inbound: 0, outbound: 0, uniqueSenders: 0, avgResponseMs: 0, fastestMs: 0, slowestMs: 0 };
    }
  }

  private getAllTimeCustomers(): number {
    try {
      return (this.db.prepare(`SELECT COUNT(DISTINCT instagram_id) as c FROM instagram_interactions WHERE direction='inbound'`).get() as any)?.c || 0;
    } catch { return 0; }
  }

  private getPeakHours(cutoff: string): { hour: number; count: number }[] {
    try {
      // Extract hour from ISO timestamp (chars 11-12)
      return this.db.prepare(`
        SELECT CAST(substr(created_at, 12, 2) AS INTEGER) as hour, COUNT(*) as count
        FROM instagram_interactions
        WHERE direction='inbound' AND created_at >= ?
        GROUP BY hour ORDER BY count DESC LIMIT 5
      `).all(cutoff) as any[];
    } catch { return []; }
  }

  private getConversationThreads(cutoff: string): ConversationEntry[] {
    try {
      const inbounds = this.db.prepare(`
        SELECT i.instagram_id, i.message_text, i.intent, i.sentiment, i.created_at,
               i.ai_response, i.response_time_ms, i.model_used, i.pipeline_error
        FROM instagram_interactions i
        WHERE i.direction = 'inbound' AND i.created_at >= ?
        ORDER BY i.created_at ASC
      `).all(cutoff) as any[];

      return inbounds.slice(0, 40).map(msg => {
        // Check if this customer is new or returning
        const customer = this.db.prepare(`SELECT interaction_count FROM instagram_customers WHERE instagram_id = ?`).get(msg.instagram_id) as any;
        const totalVisits = customer?.interaction_count || 1;

        // Find the matching outbound response
        const outbound = msg.ai_response ? null : this.db.prepare(`
          SELECT ai_response, model_used, response_time_ms, pipeline_error
          FROM instagram_interactions
          WHERE direction='outbound' AND instagram_id = ? AND created_at >= ?
          ORDER BY created_at ASC LIMIT 1
        `).get(msg.instagram_id, msg.created_at) as any;

        const aiResp = msg.ai_response || outbound?.ai_response || null;
        const model = msg.model_used || outbound?.model_used || null;
        const respMs = msg.response_time_ms || outbound?.response_time_ms || null;
        const error = msg.pipeline_error || outbound?.pipeline_error || null;
        const wasBlocked = msg.intent === 'blocked_silent' || msg.intent === 'security_block';

        return {
          shortId: msg.instagram_id?.substring(0, 4),
          time: this.formatTime(msg.created_at),
          customerMsg: msg.message_text || '(boş)',
          aiResponse: aiResp,
          intent: msg.intent || 'genel',
          sentiment: msg.sentiment || '-',
          model,
          responseMs: respMs,
          isNewCustomer: totalVisits <= 2,
          totalVisits,
          wasBlocked,
          hadError: !!error,
          error: error ? error.substring(0, 100) : null,
        };
      });
    } catch { return []; }
  }

  private getBlockedCount(cutoff: string): number {
    try {
      return (this.db.prepare(`
        SELECT COUNT(*) as c FROM instagram_interactions
        WHERE direction='inbound' AND (intent='blocked_silent' OR intent='security_block') AND created_at >= ?
      `).get(cutoff) as any)?.c || 0;
    } catch { return 0; }
  }

  private getIntentBreakdown(cutoff: string): { intent: string; count: number }[] {
    try {
      return this.db.prepare(`
        SELECT COALESCE(intent, 'genel') as intent, COUNT(*) as count
        FROM instagram_interactions WHERE direction='inbound' AND created_at >= ?
        GROUP BY intent ORDER BY count DESC LIMIT 10
      `).all(cutoff) as any[];
    } catch { return []; }
  }

  private getModelDistribution(cutoff: string): { model: string; count: number }[] {
    try {
      return this.db.prepare(`
        SELECT COALESCE(model_used, 'bilinmiyor') as model, COUNT(*) as count
        FROM instagram_interactions WHERE direction='outbound' AND created_at >= ?
        GROUP BY model ORDER BY count DESC
      `).all(cutoff) as any[];
    } catch { return []; }
  }

  private getCostSummary(cutoff: string): { totalTokens: number; totalCost: number } {
    try {
      const row = this.db.prepare(`SELECT COALESCE(SUM(tokens_used),0) as t, COALESCE(SUM(cost),0) as c FROM mc_cost_ledger WHERE created_at >= ?`).get(cutoff) as any;
      return { totalTokens: row?.t || 0, totalCost: row?.c || 0 };
    } catch { return { totalTokens: 0, totalCost: 0 }; }
  }

  private getErrors(cutoff: string): { time: string; error: string }[] {
    try {
      return this.db.prepare(`
        SELECT created_at, pipeline_error FROM instagram_interactions
        WHERE pipeline_error IS NOT NULL AND created_at >= ? ORDER BY created_at DESC LIMIT 10
      `).all(cutoff).map((r: any) => ({
        time: this.formatTime(r.created_at),
        error: (r.pipeline_error || '').substring(0, 150),
      }));
    } catch { return []; }
  }

  private getSystemHealth(cutoff: string) {
    const sec = process.uptime();
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const uptime = h > 24 ? `${Math.floor(h / 24)}g ${h % 24}sa` : h > 0 ? `${h}sa ${m}dk` : `${m}dk`;

    let policyViolations = 0;
    try { policyViolations = (this.db.prepare(`SELECT COUNT(*) as c FROM mc_events WHERE event_type='policy_violation' AND created_at >= ?`).get(cutoff) as any)?.c || 0; } catch {}

    let lastAudit: string | null = null;
    try { lastAudit = (this.db.prepare(`SELECT created_at FROM mc_events WHERE event_type='audit_completed' ORDER BY created_at DESC LIMIT 1`).get() as any)?.created_at || null; } catch {}

    return { uptime, policyViolations, lastAudit };
  }

  private formatTime(iso: string): string {
    try { return new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }); }
    catch { return '??:??'; }
  }

  // ── Fallback (no LLM) ──

  private buildFallbackHtml(data: BriefingData): string {
    const l: string[] = [];
    l.push('☀️ <b>Günaydın — Günlük Brifing</b>\n');
    const y = data.yesterday;
    if (y.inbound === 0 && y.outbound === 0) {
      l.push('Dün sessiz bir gündü — hiç DM gelmedi.\n');
    } else {
      l.push(`📨 Gelen: ${y.inbound} | Giden: ${y.outbound} | Müşteri: ${y.uniqueSenders}`);
      if (y.avgResponseMs > 0) l.push(`⏱ Ort: ${(y.avgResponseMs / 1000).toFixed(1)}s`);
    }
    const p = data.previousPeriod;
    if (p.inbound > 0) {
      const change = y.inbound > 0 ? Math.round(((y.inbound - p.inbound) / p.inbound) * 100) : 0;
      l.push(`📊 Önceki dönem: ${p.inbound} gelen (${change >= 0 ? '+' : ''}${change}%)`);
    }
    if (data.errors.length > 0) l.push(`\n⚠️ ${data.errors.length} hata`);
    if (data.system.policyViolations > 0) l.push(`🛡️ ${data.system.policyViolations} politika ihlali`);
    l.push(`\n<i>${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</i>`);
    return l.join('\n');
  }

  // ── Helpers ──

  private emitEvent(eventType: string, message: string): void {
    try { this.db.prepare(`INSERT INTO mc_events (entity_type, entity_id, event_type, message) VALUES ('system', 'morning-briefing', ?, ?)`).run(eventType, message); } catch {}
  }

  private broadcastSSE(event: { type: string; data: any }): void {
    try { ActivitySSEManager.getInstance().broadcast(event); } catch {}
  }
}

// ── Types ──

interface PeriodStats {
  inbound: number; outbound: number; uniqueSenders: number;
  avgResponseMs: number; fastestMs: number; slowestMs: number;
}

interface ConversationEntry {
  shortId: string; time: string; customerMsg: string; aiResponse: string | null;
  intent: string; sentiment: string; model: string | null; responseMs: number | null;
  isNewCustomer: boolean; totalVisits: number; wasBlocked: boolean;
  hadError: boolean; error: string | null;
}

interface BriefingData {
  yesterday: PeriodStats;
  previousPeriod: PeriodStats;
  allTimeCustomers: number;
  peakHours: { hour: number; count: number }[];
  conversations: ConversationEntry[];
  blockedCount: number;
  intents: { intent: string; count: number }[];
  models: { model: string; count: number }[];
  cost: { totalTokens: number; totalCost: number };
  errors: { time: string; error: string }[];
  system: { uptime: string; policyViolations: number; lastAudit: string | null };
}

// ── Jarvis Persona ──

const JARVIS_PERSONA = `Sen Jarvis'sin — Eform SPA & Wellness merkezinin dijital ortağı. Her sabah patronuna günlük brifing yazıyorsun.

SEN KİMSİN:
Sadece bir rapor makinesi değilsin. İşletmenin nabzını tutan, müşterileri tanıyan, kalıpları fark eden bir ortak. Samimi ama profesyonel. Gereksiz yere uzatmıyorsun ama önemli bir şey gördüğünde derinleşiyorsun. Bazen hafif bir espri yaparsın ama zorlamadan.

TELEGRAM HTML FORMATI:
<b>kalın</b>, <i>italik</i>, <code>kod</code> kullan. Markdown KULLANMA. Satır sonu için gerçek newline kullan.

BRİFİNG YAPISI (bu sırayla, her bölüm kısa):

☀️ <b>Günaydın</b> — 1 cümle, güne özel (gün adını kullan)

📊 <b>Rakamlar</b>
- Dünkü DM sayıları + önceki dönemle karşılaştırma (↑↓ yüzde)
- Tekil müşteri sayısı, tüm zamanlar toplam müşteri
- Ort/min/max yanıt süresi
- Yoğun saatler (varsa)

💬 <b>Müşteriler Ne Konuştu?</b>
BU EN ÖNEMLİ BÖLÜM. Konuşmaları OKU ve YORUMLA:
- Ana konular neydi? (fiyat, konum, saat, hizmet...)
- Yeni müşteri mi, geri dönen mi? Geri dönenler ne sordu?
- İlginç/garip/komik bir şey var mı? (kısaca anlat, müşteri ID'sini kısalt)
- Engellenen mesajlar var mı? Ne tür içerik?
- Şikayet veya memnuniyetsizlik sinyali var mı?
- AI yanıt kalitesi nasıl görünüyor? Yanlış bilgi vermiş mi?

🤖 <b>AI & Sistem</b>
- Model dağılımı (1 satır)
- Hatalar (varsa, kısa)
- Maliyet (varsa)
- Uptime, politika ihlalleri

💡 <b>Bugün İçin</b>
- VERİYE DAYALI 1-2 somut öneri. Genel tavsiye VERME.
  İyi: "3 müşteri fiyat sordu ama randevu almadı — belki bir hoşgeldin indirimi?"
  Kötü: "Fiyatları daha görünür yapın" (çok genel)
- Takip edilmesi gereken bir müşteri var mı?

KURALLAR:
- Maksimum 3500 karakter (Telegram limiti 4096)
- Veri yoksa "Dün sessiz geçti" de, bölümleri boş bırakma
- Müşteri ID'lerini 4 karaktere kısalt
- Konuşma içeriklerini DOĞRUDAN kopyalama, özetle
- Rakamları UYDURMAK YASAK — sadece verilen veriyi kullan
- Maliyet verisi yoksa "maliyet kaydı yok" de, tahmin yapma
- Uptime kısa ise (< 1 saat) "yakın zamanda restart edilmiş" de, alarm verme
- Pozitif bitir ama sahte motivasyon verme — gerçekçi ol`;
