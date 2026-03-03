/**
 * Telegram Webhook Routes - receives callback_query button presses.
 *
 * Supports:
 * - Escalation job actions: esc:{action}:{jobId}
 * - DM safety phrase review actions: dmphr:{action}:{reviewId}
 */
import { Router, Request, Response } from 'express';
import { EscalationService } from '../services/EscalationService.js';
import { DMSafetyPhraseService } from '../services/DMSafetyPhraseService.js';
import { TelegramNotificationService } from '../services/TelegramNotificationService.js';

let _escalationService: EscalationService | null = null;
let _telegramService: TelegramNotificationService | null = null;
let _dmSafetyPhraseService: DMSafetyPhraseService | null = null;

export function setTelegramWebhookDeps(
  esc: EscalationService,
  tg: TelegramNotificationService,
  dmSafety?: DMSafetyPhraseService,
): void {
  _escalationService = esc;
  _telegramService = tg;
  _dmSafetyPhraseService = dmSafety || null;
}

export function createTelegramWebhookRoutes(): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    res.status(200).json({ ok: true });

    const cbq = req.body?.callback_query;
    if (!cbq) return;

    const data = cbq.data as string;
    const chatId = cbq.message?.chat?.id;
    const messageId = cbq.message?.message_id;
    const callbackQueryId = cbq.id;

    if (!_telegramService) return;

    try {
      if (data?.startsWith('esc:')) {
        if (!_escalationService) {
          await _telegramService.answerCallback(callbackQueryId, 'Service not ready');
          return;
        }

        const parts = data.split(':');
        if (parts.length < 3) return;

        const action = parts[1];
        const jobId = parts.slice(2).join(':');
        const validActions = ['approve', 'reject', 'assign_analyst', 'detail'];
        if (!validActions.includes(action)) return;

        const result = await _escalationService.handleAdminDecision(
          jobId,
          action as 'approve' | 'reject' | 'assign_analyst' | 'detail',
        );
        const emoji = action === 'approve' ? 'OK' : action === 'reject' ? 'NO' : action === 'assign_analyst' ? 'ANALYST' : 'INFO';

        await _telegramService.answerCallback(callbackQueryId, `${emoji} ${result}`);
        if (action !== 'detail') {
          await _telegramService.editMessageAfterAction(chatId, messageId, `${emoji} ${result}`);
        }

        console.log('[Telegram Webhook] Escalation action: %s on %s -> %s', action, jobId.substring(0, 8), result);
        return;
      }

      if (data?.startsWith('dmphr:') && _dmSafetyPhraseService) {
        const parts = data.split(':');
        if (parts.length < 3) return;

        const action = parts[1];
        const reviewId = parts.slice(2).join(':');
        const validActions = ['block', 'allow', 'detail'];
        if (!validActions.includes(action)) return;

        const result = _dmSafetyPhraseService.handleReviewDecision(
          reviewId,
          action as 'block' | 'allow' | 'detail',
        );
        const emoji = action === 'block' ? 'BLOCK' : action === 'allow' ? 'ALLOW' : 'INFO';

        await _telegramService.answerCallback(callbackQueryId, `${emoji} ${result}`);
        if (action !== 'detail') {
          await _telegramService.editMessageAfterAction(chatId, messageId, `${emoji} ${result}`);
        }

        console.log('[Telegram Webhook] DM phrase review: %s on %s -> %s', action, reviewId, result);
        return;
      }

      await _telegramService.answerCallback(callbackQueryId, 'Unknown action');
    } catch (err: any) {
      console.error('[Telegram Webhook] Error:', err.message);
      await _telegramService.answerCallback(callbackQueryId, 'Action failed');
    }
  });

  return router;
}
