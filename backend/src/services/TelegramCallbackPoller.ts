/**
 * TelegramCallbackPoller — Handles inline keyboard button presses from Telegram.
 *
 * Uses getUpdates long-polling BUT automatically defers to OpenClaw when the gateway
 * is running (they share the same bot token). Periodically checks if OpenClaw is
 * up/down and starts/stops polling accordingly.
 *
 * When OpenClaw IS running, callback_query updates are forwarded to the backend
 * via OpenClaw's Telegram plugin → the backend's /webhook/telegram endpoint.
 * When OpenClaw is NOT running, this poller handles callbacks directly.
 *
 * Flow:
 *   Admin clicks button → Telegram queues callback_query →
 *   Poller picks it up → EscalationService.handleAdminDecision() →
 *   answerCallbackQuery + editMessage (remove buttons, reply with result)
 */
import { EscalationService } from './EscalationService.js';
import { TelegramNotificationService } from './TelegramNotificationService.js';

export class TelegramCallbackPoller {
  private escalation: EscalationService;
  private telegram: TelegramNotificationService;
  private botToken: string;
  private running = false;
  private polling = false;
  private offset = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private openclawCheckTimer: NodeJS.Timeout | null = null;
  private openclawRunning = false;
  private openclawPort: string;

  constructor(escalation: EscalationService, telegram: TelegramNotificationService) {
    this.escalation = escalation;
    this.telegram = telegram;
    this.botToken = telegram.getBotToken();
    this.openclawPort = process.env.OPENCLAW_GATEWAY_PORT || '18789';
  }

  async start(): Promise<void> {
    if (!this.botToken || !this.telegram.isEnabled()) {
      console.log('[TG Poller] Disabled — no bot token');
      return;
    }

    this.running = true;

    // Check OpenClaw status and decide whether to poll
    const ocUp = await this.checkOpenClaw();
    if (ocUp) {
      this.openclawRunning = true;
      console.log('[TG Poller] OpenClaw detected — deferring Telegram polling to gateway');
    } else {
      // No OpenClaw — we own Telegram getUpdates
      await this.startPolling();
    }

    // Periodically check OpenClaw status (every 30s)
    this.openclawCheckTimer = setInterval(() => this.reconcile(), 30000);
  }

  stop(): void {
    this.running = false;
    this.stopPolling();
    if (this.openclawCheckTimer) {
      clearInterval(this.openclawCheckTimer);
      this.openclawCheckTimer = null;
    }
    console.log('[TG Poller] Stopped');
  }

  /**
   * Reconcile state: if OpenClaw came up, stop polling. If it went down, start polling.
   */
  private async reconcile(): Promise<void> {
    if (!this.running) return;

    const ocUp = await this.checkOpenClaw();

    if (ocUp && !this.openclawRunning) {
      // OpenClaw just came up — stop our polling
      this.openclawRunning = true;
      this.stopPolling();
      console.log('[TG Poller] OpenClaw came online — stopped polling, gateway handles Telegram');
    } else if (!ocUp && this.openclawRunning) {
      // OpenClaw went down — resume our polling
      this.openclawRunning = false;
      console.log('[TG Poller] OpenClaw went offline — resuming callback polling');
      await this.startPolling();
    }
  }

  private async checkOpenClaw(): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.openclawPort}/agents`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async startPolling(): Promise<void> {
    if (this.polling) return;

    // Delete any existing webhook so getUpdates works
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* ignore */ }

    this.polling = true;
    console.log('[TG Poller] Started — polling for button callbacks');
    this.poll();
  }

  private stopPolling(): void {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.polling || !this.running) return;

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['callback_query'],
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (res.ok) {
        const data = await res.json() as { ok: boolean; result: any[] };
        if (data.ok && data.result?.length > 0) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            if (update.callback_query) {
              await this.handleCallback(update.callback_query);
            }
          }
        }
      }
    } catch (err: any) {
      if (this.running && this.polling) {
        // Don't spam logs — only log non-409 errors
        if (!err.message?.includes('409')) {
          console.error('[TG Poller] Poll error:', err.message);
        }
      }
    }

    // Schedule next poll
    if (this.polling && this.running) {
      this.pollTimer = setTimeout(() => this.poll(), 1000);
    }
  }

  private async handleCallback(cbq: any): Promise<void> {
    const data = cbq.data as string;
    const chatId = cbq.message?.chat?.id;
    const messageId = cbq.message?.message_id;
    const callbackQueryId = cbq.id;

    if (!data || !data.startsWith('esc:')) {
      await this.telegram.answerCallback(callbackQueryId, '❓ Bilinmeyen komut');
      return;
    }

    const parts = data.split(':');
    if (parts.length < 3) return;
    const action = parts[1];
    const jobId = parts.slice(2).join(':');

    const validActions = ['approve', 'reject', 'assign_analyst', 'detail'];
    if (!validActions.includes(action)) return;

    try {
      const result = await this.escalation.handleAdminDecision(
        jobId,
        action as 'approve' | 'reject' | 'assign_analyst' | 'detail'
      );

      const emoji = action === 'approve' ? '✅' : action === 'reject' ? '❌' : action === 'assign_analyst' ? '📊' : '📋';
      await this.telegram.answerCallback(callbackQueryId, `${emoji} ${result}`);

      if (action !== 'detail') {
        await this.telegram.editMessageAfterAction(chatId, messageId, `${emoji} ${result}`);
      }

      console.log('[TG Poller] ✅ %s on %s → %s', action, jobId.substring(0, 8), result);
    } catch (err: any) {
      console.error('[TG Poller] Error handling callback:', err.message);
      await this.telegram.answerCallback(callbackQueryId, '❌ Hata oluştu');
    }
  }
}
