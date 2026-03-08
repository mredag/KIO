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

  it('passes valid multi-person totals derived from KB prices', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: '2 kisi 1 saat ne kadar',
      agentResponse: '1 saat klasik masaj kisi basi 1300 TL, 2 kisi icin toplam 2600 TL.',
      knowledgeContext: 'Klasik Masaj: 60dk -> 1300 TL\nTelefon: 0326 502 58 58',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
  });

  it('still rejects unsupported multi-person totals', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: '2 kisi 1 saat ne kadar',
      agentResponse: '1 saat klasik masaj icin toplam 2700 TL.',
      knowledgeContext: 'Klasik Masaj: 60dk -> 1300 TL\nTelefon: 0326 502 58 58',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('2700');
  });

  it('rejects service-duration-price combinations that do not exist in KB even when the price exists elsewhere', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'medikal masajda 1 saat var mi',
      agentResponse: 'Medikal masaj paketlerimizde 60dk -> 1300 TL secenegi vardir.',
      knowledgeContext: [
        'KLASIK MASAJ:',
        '• 60dk -> 1300 TL',
        'OZEL MASAJLAR:',
        '• Medikal 30dk -> 1200 TL',
        '• Medikal 50dk -> 1800 TL',
      ].join('\n'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(false);
    expect(result.violations.join(' ')).toContain('hizmet/sure/fiyat eslesmesi');
    expect(result.violations.join(' ')).toContain('medikal 60dk -> 1300');
  });

  it('passes exact service-duration-price tuples that exist in KB', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'medikal masaj fiyatlari nedir',
      agentResponse: 'Medikal 30dk -> 1200 TL, Medikal 50dk -> 1800 TL.',
      knowledgeContext: [
        'OZEL MASAJLAR:',
        '• Medikal 30dk -> 1200 TL',
        '• Medikal 50dk -> 1800 TL',
      ].join('\n'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
  });

  it('rejects no-age-restriction claims when KB contains an age policy', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValue(createOpenRouterResult({ valid: true }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'masajda yas siniri var mi',
      agentResponse: 'Masaj hizmetlerimizde yasa bakmiyoruz. Herkes faydalanabilir.',
      knowledgeContext: '[POLICIES]\n• Yas gruplari: SPA/masaj: 18 yas ve uzeri.\nTelefon: 0326 502 58 58',
      followUpHint: {
        topicLabel: 'masaj fiyatlari',
        rewrittenQuestion: 'masaj fiyatlari icin yas siniri var mi',
        sourceMessage: 'masaj fiyatlari nedir',
      },
      activeTopic: 'masaj fiyatlari',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(false);
    expect(result.modelUsed).toBe('deterministic-grounding');
    expect(result.violations.join(' ')).toContain('YAS/POLITIKA TUTARSIZLIGI');
    expect(result.violations.join(' ')).toContain('18 yas ve uzeri');
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

  it('runs faithfulness for grounded age-policy replies', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createOpenRouterResult({ valid: true }))
      .mockResolvedValueOnce(createOpenRouterResult({ faithful: true, claims: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'masajda yas siniri var mi',
      agentResponse: 'Spa ve masaj hizmetlerimiz 18 yas ve uzeri misafirler icindir.',
      knowledgeContext: '[POLICIES]\n• Yas gruplari: SPA/masaj: 18 yas ve uzeri.',
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

  it('passes selected evidence into the rule validator prompt', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createOpenRouterResult({ valid: true }))
      .mockResolvedValueOnce(createOpenRouterResult({ faithful: true, claims: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    const result = await service.validate({
      customerMessage: 'cocuklar icin yas siniri var mi',
      agentResponse: 'Cocuk kurslari hakkinda bilgi verebilirim.',
      knowledgeContext: '[HIZMETLER]\n• Cocuk kurslari: Yuzme, Jimnastik (4-8 yas)',
      selectedEvidence: '[services] children_courses\nCocuk kurslari: Yuzme, Jimnastik (4-8 yas)',
      activeTopic: 'yuzme dersleri',
    });

    expect(result.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const userPrompt = body.messages[1].content;

    expect(userPrompt).toContain('ONCELIKLI_KANIT:');
    expect(userPrompt).toContain('Cocuk kurslari: Yuzme, Jimnastik (4-8 yas)');
  });

  it('includes nearby evidence lines in correction prompts for partial grounded fixes', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Cocuk kurslari bilgilerimizde yuzme 4-8 yas olarak geciyor.',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new ResponsePolicyService();
    await service.generateCorrectedResponse(
      'cocuklar icin yas siniri var mi',
      'Cocuk yuzme icin 4 yas ve uzeri kabul ediyoruz.',
      {
        valid: false,
        violations: ['UYDURMA: net yas siniri uyduruldu'],
        reason: 'Sadece 4-8 yas araligi geciyor.',
        modelUsed: 'google/gemini-2.5-flash-lite',
        latencyMs: 0,
        tokensEstimated: 0,
        attempt: 1,
      },
      '[HIZMETLER]\n• Cocuk kurslari: Yuzme, Jimnastik (4-8 yas)\n• Baska bilgi',
      'openai/gpt-4o-mini',
      {
        activeTopic: 'yuzme dersleri',
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const userPrompt = body.messages[1].content;

    expect(userPrompt).toContain('YAKIN_KANIT_SATIRLARI:');
    expect(userPrompt).toContain('4-8 yas');
  });
});
