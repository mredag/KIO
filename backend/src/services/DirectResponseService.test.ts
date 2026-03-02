import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectResponseService } from './DirectResponseService.js';

describe('DirectResponseService', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('puts selected evidence ahead of the broad system prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Taekwondo derslerimiz 2000 TLdir.',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new DirectResponseService();
    const result = await service.generate({
      customerMessage: 'fiyat nedir saat kacta ne zaman',
      knowledgeContext: 'GENIS KAYNAK',
      selectedEvidence: '[pricing] courses_kids\nTaekwondo 2000 TL/ay',
      conversationHistory: '',
      followUpHint: {
        topicLabel: 'taekwondo dersleri',
        rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saat kacta ne zaman',
        sourceMessage: 'taewondo dersi varmi',
      },
      responseDirective: {
        mode: 'answer_directly',
        instruction: 'Aktif konu: taekwondo dersleri. Bildigin net bilgiyi ver.',
        rationale: 'Aktif konu belli.',
      },
      customerSummary: 'Etkilesim: 2',
      isNewCustomer: false,
      tierConfig: {
        enabled: true,
        modelId: 'openai/gpt-4o-mini',
        maxTokens: 300,
        temperature: 0,
        skipPolicyValidation: false,
      },
      systemPrompt: 'VERILEN BILGILER:\nGENIS KAYNAK',
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemPrompt = body.messages[0].content;

    expect(systemPrompt).toContain('ONCELIKLI KANIT:');
    expect(systemPrompt).toContain('KISMEN CEVAP KURALI:');
    expect(systemPrompt).toContain('[pricing] courses_kids');
    expect(systemPrompt.indexOf('ONCELIKLI KANIT:')).toBeLessThan(systemPrompt.indexOf('VERILEN BILGILER:'));
  });
});
