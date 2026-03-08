import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createIntegrationDMSafetyRoutes, setIntegrationDMSafetyPhraseService } from './integrationDMSafetyRoutes.js';

describe('integrationDMSafetyRoutes', () => {
  beforeEach(() => {
    process.env.KIO_API_KEY = 'test-kio-key';
    setIntegrationDMSafetyPhraseService(null);
  });

  afterEach(() => {
    delete process.env.KIO_API_KEY;
    setIntegrationDMSafetyPhraseService(null);
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/integrations/dm-safety', createIntegrationDMSafetyRoutes());
    return app;
  }

  it('rejects missing bearer auth', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/dm-safety/reviews/DMR-1/decision')
      .send({ decision: 'allow' });

    expect(res.status).toBe(401);
  });

  it('returns 503 when the DM safety service is unavailable', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/dm-safety/reviews/DMR-1/decision')
      .set('Authorization', 'Bearer test-kio-key')
      .send({ decision: 'allow' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DM_SAFETY_SERVICE_UNAVAILABLE');
  });

  it('rejects invalid decisions', async () => {
    setIntegrationDMSafetyPhraseService({
      handleReviewDecision: () => 'should not be called',
    });

    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/dm-safety/reviews/DMR-1/decision')
      .set('Authorization', 'Bearer test-kio-key')
      .send({ decision: 'maybe' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DM_SAFETY_DECISION');
  });

  it('returns 404 when the review does not exist', async () => {
    setIntegrationDMSafetyPhraseService({
      handleReviewDecision: () => 'Phrase review not found.',
    });

    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/dm-safety/reviews/DMR-missing/decision')
      .set('Authorization', 'Bearer test-kio-key')
      .send({ decision: 'detail' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DM_SAFETY_REVIEW_NOT_FOUND');
  });

  it('handles allow/block/detail review decisions', async () => {
    const calls: Array<{ reviewId: string; decision: string }> = [];
    setIntegrationDMSafetyPhraseService({
      handleReviewDecision: (reviewId, decision) => {
        calls.push({ reviewId, decision });
        return `handled ${decision} for ${reviewId}`;
      },
    });

    const app = createApp();

    const res = await request(app)
      .post('/api/integrations/dm-safety/reviews/DMR-123/decision')
      .set('Authorization', 'Bearer test-kio-key')
      .send({ decision: 'allow' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.reviewId).toBe('DMR-123');
    expect(res.body.decision).toBe('allow');
    expect(res.body.message).toBe('handled allow for DMR-123');
    expect(calls).toEqual([{ reviewId: 'DMR-123', decision: 'allow' }]);
  });
});
