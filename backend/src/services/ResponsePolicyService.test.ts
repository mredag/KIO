import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponsePolicyService } from './ResponsePolicyService.ts';

function createOpenRouterResult(payload: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify(payload),
          },
        },
      ],
    }),
  };
}

describe('ResponsePolicyService deterministic grounding', () => {
  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects price values that do not exist in the fetched KB', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'fitness aylik uyelik ne kadar',
      agentResponse: 'Merhaba! Ferdi uyelik fiyatimiz aylik 500₺dir.',
      knowledgeContext: 'Ferdi Uyelik (Tum Tesis): 1 Aylik -> 3500₺\nAile Uyelik: 1 Aylik -> 3000₺\nTelefon: 0326 502 58 58',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(false);
    expect(result.modelUsed).toBe('deterministic-grounding');
    expect(result.violations.join(' ')).toContain('FIYAT TUTARSIZLIGI');
    expect(result.violations.join(' ')).toContain('500');
  });

  it('passes exact KB price values without invoking faithfulness', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'fitness aylik uyelik ne kadar',
      agentResponse: 'Merhaba! Ferdi uyelik fiyatimiz aylik 3500₺dir.',
      knowledgeContext: 'Ferdi Uyelik (Tum Tesis): 1 Aylik -> 3500₺\nTelefon: 0326 502 58 58',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
  });

  it('runs faithfulness for non-price factual replies', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createOpenRouterResult({ valid: true }))
      .mockResolvedValueOnce(createOpenRouterResult({ faithful: true, claims: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'saat kacta aciksiniz',
      agentResponse: 'Tesisimiz 08:00-00:00 saatleri arasinda aciktir. Telefon: 0326 502 58 58',
      knowledgeContext: 'Calisma Saatleri: 08:00-00:00\nTelefon: 0326 502 58 58',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(true);
  });

  it('passes active follow-up topic scope into the rule validator prompt', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'fiyat nedir saat kacta ne zaman',
      agentResponse: 'Taekwondo dersimiz var.',
      knowledgeContext: 'Taekwondo 2000 TL\nTaekwondo: Sali-Persembe-Cumartesi 18:00-19:00',
      followUpHint: {
        topicLabel: 'taekwondo dersleri',
        rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saat kacta ne zaman',
        sourceMessage: 'taewondo dersi varmi',
      },
      activeTopic: 'taekwondo dersleri',
      responseDirective: {
        mode: 'answer_then_clarify',
        instruction: 'Aktif konu: taekwondo dersleri. Verilen bilgilerde net fiyat ve saat varsa once onu ver.',
        rationale: 'Aktif konu belli.',
      },
    });

    expect(result.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const userPrompt = body.messages[1].content;

    expect(userPrompt).toContain('AKTIF_KONU: taekwondo dersleri');
    expect(userPrompt).toContain('YORUMLANMIS_SORU: taekwondo dersleri icin fiyat nedir saat kacta ne zaman');
    expect(userPrompt).toContain('KAPSAM KURALI: Bu mesaj kisa veya genel gorunse bile once AKTIF_KONU kapsaminda yorumlanmali.');
  });
});
