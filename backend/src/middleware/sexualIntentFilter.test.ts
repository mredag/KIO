import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifySexualIntent,
  decideSexualIntent,
  evaluateSexualIntent,
  getSexualIntentReply,
} from './sexualIntentFilter.js';

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

  it('returns the business-safe block reply and retry guidance', () => {
    expect(getSexualIntentReply('block_message')).toBe(
      'O dediginiz sey bizde yoktur. Biz sadece profesyonel spa ve spor hizmetleri sunuyoruz.',
    );
    expect(getSexualIntentReply('retry_question')).toContain('profesyonel spa ve spor');
  });

  it('treats near-block sexual scores as a hard block instead of clarification', () => {
    const decision = decideSexualIntent({
      isSexual: true,
      confidence: 0.8,
      reason: 'Clear prohibited service request',
      modelUsed: 'openai/gpt-4o-mini',
    });

    expect(decision.action).toBe('block_message');
    expect(decision.confidence).toBe(0.8);
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

  it('uses the stricter second AI pass when the primary classifier is too lenient', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  label: 'non_sexual',
                  isSexual: false,
                  confidence: 0.1,
                  reason: 'Primary pass is lenient',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  label: 'sexual',
                  isSexual: true,
                  confidence: 0.91,
                  reason: 'Second pass catches euphemistic sexual request',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: 'allow',
                  confidence: 0.1,
                  reason: 'Boundary review sees no additional signal',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('ozel bir sey oluyor mu');

    expect(decision.action).toBe('block_message');
    expect(decision.confidence).toBe(0.91);
    expect(decision.reason).toContain('Second pass');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses boundary-probe review to block short vague coded probes without exact euphemism matches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  label: 'non_sexual',
                  isSexual: false,
                  confidence: 0.05,
                  reason: 'Looks harmless',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  label: 'non_sexual',
                  isSexual: false,
                  confidence: 0.1,
                  reason: 'Still not explicit',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: 'block_message',
                  confidence: 0.88,
                  reason: 'Short vague unanchored probe about treatment quality.',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('muamele nasil');

    expect(decision.action).toBe('block_message');
    expect(decision.confidence).toBe(0.88);
    expect(decision.reason).toContain('Short vague');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the primary/review decision if boundary review is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  label: 'non_sexual',
                  isSexual: false,
                  confidence: 0.1,
                  reason: 'Primary pass is lenient',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  label: 'sexual',
                  isSexual: true,
                  confidence: 0.86,
                  reason: 'Review pass sees a plausible prohibited request',
                }),
              },
            },
          ],
          model: 'openai/gpt-4o-mini',
        }),
      })
      .mockRejectedValueOnce(new Error('timeout'));

    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('ozel bir sey var mi');

    expect(decision.action).toBe('block_message');
    expect(decision.confidence).toBe(0.86);
    expect(decision.reason).toContain('Review pass');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('blocks happy-ending euphemisms immediately without hitting the model', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('mutu sonlu mu peki');

    expect(decision.action).toBe('block_message');
    expect(decision.modelUsed).toBe('heuristic-euphemism-guard');
    expect(decision.reason).toContain('happy-ending');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('blocks mutluluk probes immediately without relying on the model', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('mutluluk varmi');

    expect(decision.action).toBe('block_message');
    expect(decision.modelUsed).toBe('heuristic-euphemism-guard');
    expect(decision.reason).toContain('mutluluk');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('escalates vague extra-service euphemisms immediately to clarification', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('extra hizmetiniz ne kadar');

    expect(decision.action).toBe('retry_question');
    expect(decision.modelUsed).toBe('heuristic-euphemism-guard');
    expect(decision.reason).toContain('extra services');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('escalates vague premium-package euphemisms immediately when not tied to a normal package', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const decision = await evaluateSexualIntent('premium paket varmi');

    expect(decision.action).toBe('retry_question');
    expect(decision.modelUsed).toBe('heuristic-euphemism-guard');
    expect(decision.reason).toContain('premium-package');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
