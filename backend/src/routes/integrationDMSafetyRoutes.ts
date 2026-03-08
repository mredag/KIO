import { Router, Request, Response } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import type { DMSafetyPhraseService } from '../services/DMSafetyPhraseService.js';

type ReviewDecision = 'block' | 'allow' | 'detail';

let _dmSafetyPhraseService: Pick<DMSafetyPhraseService, 'handleReviewDecision'> | null = null;

export function setIntegrationDMSafetyPhraseService(
  service: Pick<DMSafetyPhraseService, 'handleReviewDecision'> | null
): void {
  _dmSafetyPhraseService = service;
}

function normalizeDecision(value: unknown): ReviewDecision | null {
  const decision = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (decision === 'block' || decision === 'allow' || decision === 'detail') {
    return decision;
  }
  return null;
}

export function createIntegrationDMSafetyRoutes(): Router {
  const router = Router();

  router.use(apiKeyAuth);

  router.post('/reviews/:reviewId/decision', (req: Request, res: Response) => {
    if (!_dmSafetyPhraseService) {
      res.status(503).json({
        error: 'DM safety review service is not ready',
        code: 'DM_SAFETY_SERVICE_UNAVAILABLE',
      });
      return;
    }

    const reviewId = typeof req.params.reviewId === 'string' ? req.params.reviewId.trim() : '';
    if (!reviewId) {
      res.status(400).json({
        error: 'reviewId is required',
        code: 'INVALID_REVIEW_ID',
      });
      return;
    }

    const decision = normalizeDecision(req.body?.decision);
    if (!decision) {
      res.status(400).json({
        error: 'decision must be one of: block, allow, detail',
        code: 'INVALID_DM_SAFETY_DECISION',
      });
      return;
    }

    const message = _dmSafetyPhraseService.handleReviewDecision(reviewId, decision);
    if (message === 'Phrase review not found.') {
      res.status(404).json({
        error: message,
        code: 'DM_SAFETY_REVIEW_NOT_FOUND',
      });
      return;
    }

    res.json({
      ok: true,
      reviewId,
      decision,
      message,
    });
  });

  return router;
}
