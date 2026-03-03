/**
 * TelegramNotificationService — Sends actionable alerts to admin via Telegram Bot API.
 *
 * Uses inline_keyboard buttons for quick actions (approve/reject/assign).
 * Button presses come back as callback_query via Telegram webhook.
 *
 * Shares the same bot as OpenClaw's Telegram channel (same bot token).
 * OpenClaw uses long-polling for conversations — we set a webhook for callback_query only.
 * No conflict: webhook receives button callbacks, OpenClaw polls for chat messages.
 */
import Database from 'better-sqlite3';

export interface TelegramMessage {
  jobId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  body: string;
  source?: 'policy_agent' | 'nightly_audit' | 'autopilot' | 'dm_pipeline';
  customer?: {
    instagramId: string;
    name?: string;
    username?: string;
  };
}

export interface DMSafetyPhraseReviewMessage {
  reviewId: string;
  phrase: string;
  normalizedPhrase: string;
  aiAction: 'allow' | 'retry_question' | 'block_message';
  confidence: number;
  reason: string;
  customerId?: string;
  channel?: string;
}

interface TelegramConfig {
  botToken: string;
  adminChatId: string;
  enabled: boolean;
  maxMessagesPerHour: number;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'KRİTİK',
  high: 'YÜKSEK',
  medium: 'ORTA',
  low: 'DÜŞÜK',
};

export class TelegramNotificationService {
  private config: TelegramConfig;
  private db: Database.Database;
  private sentThisHour = 0;
  private hourResetTimer: NodeJS.Timeout | null = null;

  constructor(db: Database.Database) {
    this.db = db;
    this.config = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || '',
      enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID),
      maxMessagesPerHour: 30,
    };
    this.hourResetTimer = setInterval(() => { this.sentThisHour = 0; }, 3600000);
    if (this.config.enabled) {
      console.log('[Telegram] Notification service ready (chat: %s)', this.config.adminChatId);
    } else {
      console.log('[Telegram] Not configured — set TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID');
    }
  }

  isEnabled(): boolean { return this.config.enabled; }
  getBotToken(): string { return this.config.botToken; }

  /**
   * Send a rich notification with inline keyboard buttons.
   */
  async notify(msg: TelegramMessage): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (this.sentThisHour >= this.config.maxMessagesPerHour) {
      console.log('[Telegram] Rate limit reached (%d/hr), skipping', this.config.maxMessagesPerHour);
      return false;
    }

    const emoji = SEVERITY_EMOJI[msg.severity] || '⚪';
    const label = SEVERITY_LABEL[msg.severity] || '';
    const lines: string[] = [];

    // Header
    lines.push(`${emoji} <b>${this.escapeHtml(msg.title)}</b> [${label}]`);
    lines.push('');

    // Customer info
    if (msg.customer) {
      const c = msg.customer;
      lines.push(`👤 <b>Müşteri:</b> ${this.escapeHtml(c.name || 'Bilinmiyor')}`);
      lines.push(`🆔 <b>ID:</b> <code>${this.escapeHtml(c.instagramId)}</code>`);
      if (c.username) {
        lines.push(`📱 <a href="https://ig.me/m/${this.escapeHtml(c.username)}">Instagram DM Aç</a>`);
      }
      lines.push('');
    }

    // Body
    lines.push(this.escapeHtml(msg.body));

    // Job reference
    if (msg.jobId && msg.jobId !== 'no-job') {
      lines.push('');
      lines.push(`📋 <code>${msg.jobId.substring(0, 8)}</code>`);
    }

    const text = lines.join('\n');

    // Build inline keyboard with action buttons
    const keyboard = this.buildInlineKeyboard(msg.jobId, msg.source);

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const payload: Record<string, unknown> = {
        chat_id: this.config.adminChatId,
        text,
        parse_mode: 'HTML',
      };
      if (keyboard) {
        payload.reply_markup = JSON.stringify(keyboard);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[Telegram] Send failed:', res.status, err);
        return false;
      }

      this.sentThisHour++;
      this.logNotification(msg);
      console.log('[Telegram] ✅ Notification sent: %s', msg.title);
      return true;
    } catch (err: any) {
      console.error('[Telegram] Send error:', err.message);
      return false;
    }
  }

  /**
   * Send a yes/no review prompt for a suspicious DM phrase.
   */
  async notifySafetyPhraseReview(msg: DMSafetyPhraseReviewMessage): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (this.sentThisHour >= this.config.maxMessagesPerHour) {
      console.log('[Telegram] Rate limit reached (%d/hr), skipping phrase review', this.config.maxMessagesPerHour);
      return false;
    }

    const lines: string[] = [
      '<b>DM Safety Phrase Review</b>',
      '',
      'AI is unsure about this DM phrase.',
      'Is this inappropriate?',
      '',
      `<b>Phrase:</b> <code>${this.escapeHtml(this.truncateText(msg.phrase, 120))}</code>`,
      `<b>Normalized:</b> <code>${this.escapeHtml(this.truncateText(msg.normalizedPhrase, 120))}</code>`,
      `<b>AI action:</b> ${this.escapeHtml(msg.aiAction)}`,
      `<b>Confidence:</b> ${(msg.confidence * 100).toFixed(1)}%`,
      '',
      this.escapeHtml(this.truncateText(msg.reason, 240)),
    ];

    if (msg.customerId) {
      lines.splice(6, 0, `<b>Customer ID:</b> <code>${this.escapeHtml(msg.customerId)}</code>`);
    }

    if (msg.channel) {
      lines.splice(6, 0, `<b>Channel:</b> ${this.escapeHtml(msg.channel)}`);
    }

    const text = lines.join('\n');
    const keyboard = {
      inline_keyboard: [
        [
          { text: 'Yes - hard block', callback_data: `dmphr:block:${msg.reviewId}` },
          { text: 'No - keep safe', callback_data: `dmphr:allow:${msg.reviewId}` },
        ],
        [
          { text: 'Detail', callback_data: `dmphr:detail:${msg.reviewId}` },
        ],
      ],
    };

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.adminChatId,
          text,
          parse_mode: 'HTML',
          reply_markup: JSON.stringify(keyboard),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('[Telegram] Phrase review send failed:', res.status, err);
        return false;
      }

      this.sentThisHour++;
      console.log('[Telegram] Phrase review sent: %s', msg.reviewId);
      return true;
    } catch (err: any) {
      console.error('[Telegram] Phrase review send error:', err.message);
      return false;
    }
  }

  /**
   * Update the message after admin clicks a button — replace buttons with result text.
   */
  async editMessageAfterAction(chatId: string | number, messageId: number, resultText: string): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/editMessageReplyMarkup`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: JSON.stringify({ inline_keyboard: [] }) }),
        signal: AbortSignal.timeout(5000),
      });
      // Send follow-up with result
      const replyUrl = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      await fetch(replyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: resultText,
          reply_to_message_id: messageId,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err: any) {
      console.error('[Telegram] Edit message error:', err.message);
    }
  }

  /**
   * Answer a callback_query to dismiss the loading spinner on the button.
   */
  async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    if (!this.config.enabled) return;
    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/answerCallbackQuery`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: true }),
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* non-critical */ }
  }

  private buildInlineKeyboard(jobId: string, source?: string): { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> } | null {
    if (!jobId || jobId === 'no-job') return null;

    // Workshop URL for web-based action (always works, no Telegram polling needed)
    const workshopUrl = `http://localhost:3001/admin/mc/workshop`;

    // Policy violations
    if (source === 'policy_agent') {
      return {
        inline_keyboard: [
          [
            { text: '📝 KB İncele Görevi Oluştur', callback_data: `esc:approve:${jobId}` },
            { text: '🔕 Bilgi Aldım', callback_data: `esc:reject:${jobId}` },
          ],
          [
            { text: '📋 Detay', callback_data: `esc:detail:${jobId}` },
            { text: '🌐 Panel', url: workshopUrl },
          ],
        ],
      };
    }

    // DM pipeline failures
    if (source === 'dm_pipeline') {
      return {
        inline_keyboard: [
          [
            { text: '🔍 Analiz Başlat', callback_data: `esc:approve:${jobId}` },
            { text: '🔕 Yoksay', callback_data: `esc:reject:${jobId}` },
          ],
          [
            { text: '📋 Detay', callback_data: `esc:detail:${jobId}` },
            { text: '🌐 Panel', url: workshopUrl },
          ],
        ],
      };
    }

    // Cost spike
    if (source === 'autopilot') {
      return {
        inline_keyboard: [
          [
            { text: '📊 İncele', callback_data: `esc:approve:${jobId}` },
            { text: '🔕 Yoksay', callback_data: `esc:reject:${jobId}` },
          ],
          [
            { text: '🌐 Panel', url: workshopUrl },
          ],
        ],
      };
    }

    // Nightly audit
    if (source === 'nightly_audit') {
      return {
        inline_keyboard: [
          [
            { text: '📊 Analiste Ata', callback_data: `esc:assign_analyst:${jobId}` },
            { text: '🔕 Yoksay', callback_data: `esc:reject:${jobId}` },
          ],
          [
            { text: '📋 Detay', callback_data: `esc:detail:${jobId}` },
            { text: '🌐 Panel', url: workshopUrl },
          ],
        ],
      };
    }

    // Default
    return {
      inline_keyboard: [
        [
          { text: '✅ Onayla', callback_data: `esc:approve:${jobId}` },
          { text: '❌ Reddet', callback_data: `esc:reject:${jobId}` },
        ],
        [
          { text: '📋 Detay', callback_data: `esc:detail:${jobId}` },
          { text: '🌐 Panel', url: workshopUrl },
        ],
      ],
    };
  }

  // Keep buildActionUrls for backward compat (EscalationService references it)
  buildActionUrls(_jobId: string): never[] {
    return []; // No longer used — inline keyboard replaces URL actions
  }

  private logNotification(msg: TelegramMessage): void {
    try {
      this.db.prepare(`
        INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
        VALUES ('job', ?, 'telegram_notification', ?, ?)
      `).run(
        msg.jobId || 'system',
        `Telegram bildirim: ${msg.title}`,
        JSON.stringify({ severity: msg.severity, customer: msg.customer })
      );
    } catch { /* non-critical */ }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private truncateText(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  destroy(): void {
    if (this.hourResetTimer) clearInterval(this.hourResetTimer);
  }
}
