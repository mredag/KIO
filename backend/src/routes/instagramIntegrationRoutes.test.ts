import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import {
  createInstagramIntegrationRoutes,
  isTransientMetaSendFailure,
  sendInstagramGraphMessage,
} from './instagramIntegrationRoutes.js';

describe('instagramIntegrationRoutes', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    process.env.KIO_API_KEY = 'test-kio-key';
    process.env.INSTAGRAM_ACCESS_TOKEN = 'IGAA-test-token';
    process.env.INSTAGRAM_ACCOUNT_ID = '17841400000000000';
  });

  afterEach(() => {
    db.close();
    delete process.env.KIO_API_KEY;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_ACCOUNT_ID;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('marks Meta code 2 failures as transient', () => {
    expect(isTransientMetaSendFailure(500, {
      error: {
        message: 'An unexpected error has occurred. Please retry your request later.',
        type: 'OAuthException',
        is_transient: true,
        code: 2,
      },
    })).toBe(true);

    expect(isTransientMetaSendFailure(400, {
      error: {
        message: 'Invalid recipient',
        type: 'OAuthException',
        code: 10,
      },
    })).toBe(false);
  });

  it('retries transient Meta failures and succeeds on a later attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({
          error: {
            message: 'An unexpected error has occurred. Please retry your request later.',
            type: 'OAuthException',
            is_transient: true,
            code: 2,
          },
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message_id: 'mid.123' }),
      } as any);

    const result = await sendInstagramGraphMessage({
      token: 'IGAA-test-token',
      accountId: '17841400000000000',
      recipientId: '123456',
      message: 'Merhaba',
      retryDelaysMs: [0],
      fetchImpl: fetchMock as any,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.messageId).toBe('mid.123');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent Meta failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: {
          message: 'Invalid recipient',
          type: 'OAuthException',
          code: 10,
        },
      }),
    } as any);

    const result = await sendInstagramGraphMessage({
      token: 'IGAA-test-token',
      accountId: '17841400000000000',
      recipientId: '123456',
      message: 'Merhaba',
      retryDelaysMs: [0, 0],
      fetchImpl: fetchMock as any,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns success with attempt count from the /send route', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({
          error: {
            message: 'An unexpected error has occurred. Please retry your request later.',
            type: 'OAuthException',
            is_transient: true,
            code: 2,
          },
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message_id: 'mid.456' }),
      } as any);

    vi.stubGlobal('fetch', fetchMock);

    const app = express();
    app.use(express.json());
    app.use('/api/integrations/instagram', createInstagramIntegrationRoutes(db));

    const res = await request(app)
      .post('/api/integrations/instagram/send')
      .set('Authorization', 'Bearer test-kio-key')
      .send({ recipientId: '123456', message: 'Merhaba' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messageId).toBe('mid.456');
    expect(res.body.attempts).toBe(2);
  });
});
