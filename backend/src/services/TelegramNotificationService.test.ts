import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramNotificationService } from './TelegramNotificationService.js';

class FakeDb {
  prepare(sql: string): { run: (...args: any[]) => { changes: number } } {
    if (sql.includes('INSERT INTO mc_events')) {
      return {
        run: () => ({ changes: 1 }),
      };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

describe('TelegramNotificationService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '123456';

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('ok'),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    vi.unstubAllGlobals();
  });

  it('sends DM safety phrase reviews without callback buttons and with explicit command fallback', async () => {
    const service = new TelegramNotificationService(new FakeDb() as any);

    const ok = await service.notifySafetyPhraseReview({
      reviewId: 'DMR-1234',
      phrase: 'sort getiriyor muyuz',
      normalizedPhrase: 'sort getiriyor muyuz',
      aiAction: 'retry_question',
      confidence: 0.7,
      reason: 'Ambiguous phrase',
      customerId: 'ig-1',
      channel: 'instagram',
    });

    service.destroy();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(request.body);

    expect(payload.reply_markup).toBeUndefined();
    expect(payload.text).toContain('/dmphr block DMR-1234');
    expect(payload.text).toContain('/dmphr allow DMR-1234');
    expect(payload.text).toContain('/dmphr detail DMR-1234');
    expect(payload.text).toContain('Shared bot on Telegram does not support reliable callback buttons');
  });

  it('sends escalation alerts with text commands and URL-only keyboard buttons', async () => {
    const service = new TelegramNotificationService(new FakeDb() as any);

    const ok = await service.notify({
      jobId: 'job-12345678',
      severity: 'high',
      title: 'Policy issue',
      body: 'Operator review needed',
      source: 'policy_agent',
      customer: {
        instagramId: 'ig-1',
        username: 'customer_name',
      },
    });

    service.destroy();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(request.body);
    const replyMarkup = JSON.parse(payload.reply_markup);

    expect(payload.text).toContain('/esc approve job-12345678');
    expect(payload.text).toContain('/esc reject job-12345678');
    expect(payload.text).toContain('/esc detail job-12345678');
    expect(payload.text).toContain('Shared bot on Telegram does not support reliable callback buttons');

    const allButtons = replyMarkup.inline_keyboard.flat();
    expect(allButtons.every((button: Record<string, string>) => typeof button.url === 'string')).toBe(true);
    expect(allButtons.some((button: Record<string, string>) => button.url.includes('ig.me/m/customer_name'))).toBe(true);
    expect(allButtons.some((button: Record<string, string>) => button.url.includes('/admin/mc/workshop'))).toBe(true);
    expect(allButtons.some((button: Record<string, string>) => button.url.startsWith('https://'))).toBe(true);
    expect(allButtons.some((button: Record<string, string>) => button.url.includes('localhost'))).toBe(false);
    expect(allButtons.some((button: Record<string, string>) => 'callback_data' in button)).toBe(false);
  });

  it('retries escalation alerts once on transient fetch failure', async () => {
    fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('ok'),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = new TelegramNotificationService(new FakeDb() as any);

    const ok = await service.notify({
      jobId: 'job-retry-1',
      severity: 'high',
      title: 'Retry test',
      body: 'Operator review needed',
      source: 'dm_pipeline',
      customer: {
        instagramId: 'ig-2',
      },
    });

    service.destroy();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
