import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifySexualIntent, getSexualIntentReply } from './sexualIntentFilter.js';

describe('sexualIntentFilter', () => {
  let originalApiKey: string | undefined;
  let originalModel: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.OPENROUTER_API_KEY;
    originalModel = process.env.SEXUAL_INTENT_MODEL;
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    delete process.env.SEXUAL_INTENT_MODEL;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.SEXUAL_INTENT_MODEL;
    } else {
      process.env.SEXUAL_INTENT_MODEL = originalModel;
    }

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the stronger business-safe block reply', () => {
    expect(getSexualIntentReply('block_message')).toBe(
      'Uygunsuz hizmet sunmuyoruz. Yalnızca profesyonel spa ve spor hizmetleri veriyoruz.',
    );
    expect(getSexualIntentReply('retry_question')).toContain('profesyonel spa ve spor');
  });

  it('sends obfuscation-aware message variants to the classifier', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                label: 'sexual',
                isSexual: true,
                confidence: 0.92,
                reason: 'Obfuscated explicit intent',
              }),
            },
          },
        ],
        model: 'openai/gpt-4o-mini',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await classifySexualIntent('mut lu son lu biten varmi');

    expect(result.isSexual).toBe(true);
    expect(result.confidence).toBe(0.92);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(body.messages[0].content).toContain('Users may obfuscate sexual requests');
    expect(body.messages[1].content).toContain('Original message: mut lu son lu biten varmi');
    expect(body.messages[1].content).toContain('Compact text (ignore spaces/punctuation): mutlusonlubitenvarmi');
    expect(body.messages[1].content).toContain('Classify the underlying meaning after mentally removing separators.');
  });
});
