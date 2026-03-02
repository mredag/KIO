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
});
