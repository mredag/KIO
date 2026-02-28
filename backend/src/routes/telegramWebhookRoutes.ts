/**
 * Telegram Webhook Routes — Receives callback_query from inline keyboard buttons.
 *
 * When admin clicks a button on a notification message, Telegram sends a callback_query
 * to this webhook. We parse the action, execute it via EscalationService, and reply.
 *
 * callback_data format: "esc:{action}:{jobId}"
 * Actions: approve, reject, assign_analyst, detail
 *
 * NOTE: OpenClaw uses long-polling for Telegram conversations.
 * Setting a webhook does NOT conflict — Telegram sends callback_query to webhook
 * and regular messages to the polling consumer. They coexist.
 */
import { Router, Request, Response } from 'express';
import { EscalationService } from '../services/EscalationService.js';
import { TelegramNotificationService } from '../services/TelegramNotificationService.js';

let _escalationService: EscalationService | null = null;
let _telegramService: TelegramNotificationService | null = null;

export function setTelegramWebhookDeps(esc: EscalationService, tg: TelegramNotificationService): void {
  _escalationService = esc;
  _telegramService = tg;
}

export function createTelegramWebhookRoutes(): Router {
  const router = Router();

  /**
   * POST /webhook/telegram — Telegram Bot API webhook endpoint.
   * Receives callback_query when admin clicks inline keyboard buttons.
   */
  router.post('/', async (req: Request, res: Response) => {
    // Always respond 200 immediately — Telegram retries on non-200
    res.status(200).json({ ok: true });

    const update = req.body;

    // We only care about callback_query (button presses)
    if (!update?.callback_query) return;

    const cbq = update.callback_query;
    const data = cbq.data as string;
    const chatId = cbq.message?.chat?.id;
    const messageId = cbq.message?.message_id;
    const callbackQueryId = cbq.id;

    if (!data || !data.startsWith('esc:')) return;

    // Parse: "esc:{action}:{jobId}"
    const parts = data.split(':');
    if (parts.length < 3) return;
    const action = parts[1];
    const jobId = parts.slice(2).join(':'); // jobId may contain colons (UUID)

    const validActions = ['approve', 'reject', 'assign_analyst', 'detail'];
    if (!validActions.includes(action)) return;

    if (!_escalationService || !_telegramService) {
      await _telegramService?.answerCallback(callbackQueryId, '⚠️ Servis hazır değil');
      return;
    }

    try {
      const result = await _escalationService.handleAdminDecision(
        jobId,
        action as 'approve' | 'reject' | 'assign_analyst' | 'detail'
      );

      const emoji = action === 'approve' ? '✅' : action === 'reject' ? '❌' : action === 'assign_analyst' ? '📊' : '📋';

      // Answer the callback (dismisses loading spinner, shows toast)
      await _telegramService.answerCallback(callbackQueryId, `${emoji} ${result}`);

      // For non-detail actions, remove buttons and reply with result
      if (action !== 'detail') {
        await _telegramService.editMessageAfterAction(chatId, messageId, `${emoji} ${result}`);
      }

      console.log('[Telegram Webhook] Action: %s on job %s → %s', action, jobId.substring(0, 8), result);
    } catch (err: any) {
      console.error('[Telegram Webhook] Error:', err.message);
      await _telegramService?.answerCallback(callbackQueryId, '❌ Hata oluştu');
    }
  });

  return router;
}
