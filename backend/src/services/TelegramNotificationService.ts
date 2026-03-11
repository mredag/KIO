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
  critical: 'KRITIK',
  high: 'YUKSEK',
  medium: 'ORTA',
  low: 'DUSUK',
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
    this.hourResetTimer = setInterval(() => {
      this.sentThisHour = 0;
    }, 3600000);

    if (this.config.enabled) {
      console.log('[Telegram] Notification service ready (chat: %s)', this.config.adminChatId);
    } else {
      console.log('[Telegram] Not configured - set TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID');
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getBotToken(): string {
    return this.config.botToken;
  }

  async notify(msg: TelegramMessage): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (this.sentThisHour >= this.config.maxMessagesPerHour) {
      console.log('[Telegram] Rate limit reached (%d/hr), skipping', this.config.maxMessagesPerHour);
      return false;
    }

    const emoji = SEVERITY_EMOJI[msg.severity] || '⚪';
    const label = SEVERITY_LABEL[msg.severity] || '';
    const lines: string[] = [];

    lines.push(`${emoji} <b>${this.escapeHtml(msg.title)}</b> [${label}]`);
    lines.push('');

    if (msg.customer) {
      const customer = msg.customer;
      lines.push(`👤 <b>Musteri:</b> ${this.escapeHtml(customer.name || 'Bilinmiyor')}`);
      lines.push(`🆔 <b>ID:</b> <code>${this.escapeHtml(customer.instagramId)}</code>`);
      if (customer.username) {
        lines.push(`📱 <a href="https://ig.me/m/${this.escapeHtml(customer.username)}">Instagram DM Ac</a>`);
      }
      lines.push('');
    }

    lines.push(this.escapeHtml(msg.body));

    if (msg.jobId && msg.jobId !== 'no-job') {
      lines.push('');
      lines.push(`📋 <code>${msg.jobId.substring(0, 8)}</code>`);
      lines.push(...this.buildEscalationCommandLines(msg.jobId, msg.source));
    }

    const payload: Record<string, unknown> = {
      chat_id: this.config.adminChatId,
      text: lines.join('\n'),
      parse_mode: 'HTML',
    };

    const keyboard = this.buildUrlKeyboard(msg.customer?.username);
    if (keyboard) {
      payload.reply_markup = JSON.stringify(keyboard);
    }

    const ok = await this.sendMessagePayload(payload, {
      retryOnNetworkError: true,
      retryOnHttpStatuses: [429, 500, 502, 503, 504],
      failureLabel: 'Send',
    });
    if (!ok) {
      return false;
    }

    this.sentThisHour++;
    this.logNotification(msg);
    console.log('[Telegram] ✅ Notification sent: %s', msg.title);
    return true;
  }

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
      '',
      '<b>Operator action:</b>',
      'Shared bot on Telegram does not support reliable callback buttons while OpenClaw is online.',
      `<code>/dmphr block ${this.escapeHtml(msg.reviewId)}</code>`,
      `<code>/dmphr allow ${this.escapeHtml(msg.reviewId)}</code>`,
      `<code>/dmphr detail ${this.escapeHtml(msg.reviewId)}</code>`,
    ];

    if (msg.customerId) {
      lines.splice(6, 0, `<b>Customer ID:</b> <code>${this.escapeHtml(msg.customerId)}</code>`);
    }

    if (msg.channel) {
      lines.splice(6, 0, `<b>Channel:</b> ${this.escapeHtml(msg.channel)}`);
    }

    const ok = await this.sendMessagePayload(
      {
        chat_id: this.config.adminChatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
      },
      {
        retryOnNetworkError: true,
        retryOnHttpStatuses: [429, 500, 502, 503, 504],
        failureLabel: 'Phrase review send',
      },
    );

    if (!ok) {
      return false;
    }

    this.sentThisHour++;
    console.log('[Telegram] Phrase review sent: %s', msg.reviewId);
    return true;
  }

  async editMessageAfterAction(chatId: string | number, messageId: number, resultText: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      await fetch(`https://api.telegram.org/bot${this.config.botToken}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: JSON.stringify({ inline_keyboard: [] }),
        }),
        signal: AbortSignal.timeout(5000),
      });

      await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
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

  async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      await fetch(`https://api.telegram.org/bot${this.config.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: true,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // non-critical
    }
  }

  private buildUrlKeyboard(username?: string): { inline_keyboard: Array<Array<{ text: string; url: string }>> } | null {
    const rows: Array<Array<{ text: string; url: string }>> = [];

    if (username) {
      rows.push([{ text: 'Instagram DM', url: `https://ig.me/m/${encodeURIComponent(username)}` }]);
    }

    rows.push([{ text: 'Panel', url: `${this.getPanelBaseUrl()}/admin/mc/workshop` }]);
    return { inline_keyboard: rows };
  }

  private getPanelBaseUrl(): string {
    const configured = (
      process.env.KIO_PANEL_BASE_URL
      || process.env.PUBLIC_BASE_URL
      || process.env.APP_BASE_URL
      || 'https://webhook.eformspa.com'
    ).trim();

    return configured.replace(/\/+$/, '');
  }

  private buildEscalationCommandLines(jobId: string, source?: string): string[] {
    const lines = [
      '<b>Operator action:</b>',
      'Shared bot on Telegram does not support reliable callback buttons while OpenClaw is online.',
      `<code>/esc detail ${this.escapeHtml(jobId)}</code>`,
    ];

    if (source === 'nightly_audit') {
      lines.push(`<code>/esc analyst ${this.escapeHtml(jobId)}</code>`);
      lines.push(`<code>/esc reject ${this.escapeHtml(jobId)}</code>`);
      return lines;
    }

    lines.push(`<code>/esc approve ${this.escapeHtml(jobId)}</code>`);
    lines.push(`<code>/esc reject ${this.escapeHtml(jobId)}</code>`);
    return lines;
  }

  buildActionUrls(_jobId: string): never[] {
    return [];
  }

  private logNotification(msg: TelegramMessage): void {
    try {
      this.db.prepare(`
        INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
        VALUES ('job', ?, 'telegram_notification', ?, ?)
      `).run(
        msg.jobId || 'system',
        `Telegram bildirim: ${msg.title}`,
        JSON.stringify({ severity: msg.severity, customer: msg.customer }),
      );
    } catch {
      // non-critical
    }
  }

  private async sendMessagePayload(
    payload: Record<string, unknown>,
    options: {
      retryOnNetworkError: boolean;
      retryOnHttpStatuses: number[];
      failureLabel: string;
    },
  ): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          const err = await res.text();
          const shouldRetry = attempt < 2 && options.retryOnHttpStatuses.includes(res.status);
          if (shouldRetry) {
            console.warn('[Telegram] %s failed (attempt %d), retrying: %s %s', options.failureLabel, attempt, res.status, err);
            await this.delay(500);
            continue;
          }
          console.error(`[Telegram] ${options.failureLabel} failed:`, res.status, err);
          return false;
        }

        return true;
      } catch (err: any) {
        if (attempt < 2 && options.retryOnNetworkError) {
          console.warn('[Telegram] %s error (attempt %d), retrying: %s', options.failureLabel, attempt, err.message);
          await this.delay(500);
          continue;
        }
        console.error(`[Telegram] ${options.failureLabel} error:`, err.message);
        return false;
      }
    }

    return false;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private truncateText(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy(): void {
    if (this.hourResetTimer) {
      clearInterval(this.hourResetTimer);
    }
  }
}
