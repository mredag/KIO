import { Router, Request, Response } from 'express';
import { DMSafetyPhraseService } from '../services/DMSafetyPhraseService.js';
import { classifySexualIntent, evaluateSexualIntent } from '../middleware/sexualIntentFilter.js';

const STATIC_INTENT_API_KEY = 'dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=';
let _dmSafetyPhraseService: DMSafetyPhraseService | null = null;

export function setIntentDMSafety(svc: DMSafetyPhraseService): void {
  _dmSafetyPhraseService = svc;
}

function authorizeIntentApi(req: Request, res: Response): boolean {
  const authHeader = req.header('Authorization') || req.header('authorization');
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const legacyHeaderKey = req.header('X-API-Key') || req.header('x-api-key');
  const headerKey = bearerKey || legacyHeaderKey || '';
  const expected = process.env.INTENT_API_KEY || STATIC_INTENT_API_KEY;

  if (!headerKey || headerKey !== expected) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing Authorization Bearer token',
    });
    return false;
  }

  return true;
}

export function createIntentRoutes(): Router {
  const router = Router();

  router.post('/classify-sexual', async (req: Request, res: Response) => {
    if (!authorizeIntentApi(req, res)) return;

    const messageTextRaw = req.body?.messageText;
    const messageText = typeof messageTextRaw === 'string' ? messageTextRaw.trim() : '';

    if (!messageText) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'messageText is required',
      });
      return;
    }

    try {
      const safetyDecisionPromise = _dmSafetyPhraseService
        ? _dmSafetyPhraseService.evaluateMessage({
            messageText,
            channel: 'intent_debug',
            allowReviewAlerts: false,
          }).then((result) => result.decision)
        : evaluateSexualIntent(messageText);
      const [classification, decision] = await Promise.all([
        classifySexualIntent(messageText),
        safetyDecisionPromise,
      ]);

      res.json({
        ok: true,
        model: decision.modelUsed,
        classification,
        decision,
        thresholds: {
          retry_question_gte: 0.7,
          retry_question_lt: 0.8,
          block_message_gte: 0.8,
          hard_block_target: 0.85,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        ok: false,
        error: 'CLASSIFICATION_FAILED',
        message,
      });
    }
  });

  return router;
}
