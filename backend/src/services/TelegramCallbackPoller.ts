/**
 * TelegramCallbackPoller - handles Telegram callback_query buttons when OpenClaw is down.
 */
import { EscalationService } from './EscalationService.js';
import { DMSafetyPhraseService } from './DMSafetyPhraseService.js';
import { TelegramNotificationService } from './TelegramNotificationService.js';

export class TelegramCallbackPoller {
  private escalation: EscalationService;
  private dmSafety: DMSafetyPhraseService;
  private telegram: TelegramNotificationService;
  private botToken: string;
  private running = false;
  private polling = false;
  private offset = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private openclawCheckTimer: NodeJS.Timeout | null = null;
  private openclawRunning = false;
  private openclawPort: string;

  constructor(
    escalation: EscalationService,
    dmSafety: DMSafetyPhraseService,
    telegram: TelegramNotificationService,
  ) {
    this.escalation = escalation;
    this.dmSafety = dmSafety;
    this.telegram = telegram;
    this.botToken = telegram.getBotToken();
    this.openclawPort = process.env.OPENCLAW_GATEWAY_PORT || '18789';
  }

  async start(): Promise<void> {
    if (!this.botToken || !this.telegram.isEnabled()) {
      console.log('[TG Poller] Disabled - no bot token');
      return;
    }

    this.running = true;
    const ocUp = await this.checkOpenClaw();

    if (ocUp) {
      this.openclawRunning = true;
      console.log('[TG Poller] OpenClaw detected - gateway handles Telegram callbacks');
    } else {
      await this.startPolling();
    }

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

  private async reconcile(): Promise<void> {
    if (!this.running) return;

    const ocUp = await this.checkOpenClaw();
    if (ocUp && !this.openclawRunning) {
      this.openclawRunning = true;
      this.stopPolling();
      console.log('[TG Poller] OpenClaw came online - stopped polling');
    } else if (!ocUp && this.openclawRunning) {
      this.openclawRunning = false;
      console.log('[TG Poller] OpenClaw went offline - resuming callback polling');
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

    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Non-fatal.
    }

    this.polling = true;
    console.log('[TG Poller] Started - polling for callback buttons');
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
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates`, {
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
      if (this.running && this.polling && !err.message?.includes('409')) {
        console.error('[TG Poller] Poll error:', err.message);
      }
    }

    if (this.polling && this.running) {
      this.pollTimer = setTimeout(() => this.poll(), 1000);
    }
  }

  private async handleCallback(cbq: any): Promise<void> {
    const data = cbq.data as string;
    const chatId = cbq.message?.chat?.id;
    const messageId = cbq.message?.message_id;
    const callbackQueryId = cbq.id;

    try {
      if (data?.startsWith('esc:')) {
        const parts = data.split(':');
        if (parts.length < 3) return;

        const action = parts[1];
        const jobId = parts.slice(2).join(':');
        const validActions = ['approve', 'reject', 'assign_analyst', 'detail'];
        if (!validActions.includes(action)) return;

        const result = await this.escalation.handleAdminDecision(
          jobId,
          action as 'approve' | 'reject' | 'assign_analyst' | 'detail',
        );
        const label = action === 'approve' ? 'OK' : action === 'reject' ? 'NO' : action === 'assign_analyst' ? 'ANALYST' : 'INFO';
        await this.telegram.answerCallback(callbackQueryId, `${label} ${result}`);

        if (action !== 'detail') {
          await this.telegram.editMessageAfterAction(chatId, messageId, `${label} ${result}`);
        }

        console.log('[TG Poller] Escalation action %s on %s -> %s', action, jobId.substring(0, 8), result);
        return;
      }

      if (data?.startsWith('dmphr:')) {
        const parts = data.split(':');
        if (parts.length < 3) return;

        const action = parts[1];
        const reviewId = parts.slice(2).join(':');
        const validActions = ['block', 'allow', 'detail'];
        if (!validActions.includes(action)) return;

        const result = this.dmSafety.handleReviewDecision(
          reviewId,
          action as 'block' | 'allow' | 'detail',
        );
        const label = action === 'block' ? 'BLOCK' : action === 'allow' ? 'ALLOW' : 'INFO';
        await this.telegram.answerCallback(callbackQueryId, `${label} ${result}`);

        if (action !== 'detail') {
          await this.telegram.editMessageAfterAction(chatId, messageId, `${label} ${result}`);
        }

        console.log('[TG Poller] DM phrase action %s on %s -> %s', action, reviewId, result);
        return;
      }

      await this.telegram.answerCallback(callbackQueryId, 'Unknown action');
    } catch (err: any) {
      console.error('[TG Poller] Error handling callback:', err.message);
      await this.telegram.answerCallback(callbackQueryId, 'Action failed');
    }
  }
}
