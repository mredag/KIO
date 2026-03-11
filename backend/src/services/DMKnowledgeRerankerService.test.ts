import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DMKnowledgeRerankerService, formatSelectedEvidenceBlock } from './DMKnowledgeRerankerService.js';
import type { SemanticRetrievalCandidate } from './DMKnowledgeRetrievalService.js';

function createCandidate(
  id: string,
  category: string,
  keyName: string,
  score: number,
  value: string,
): SemanticRetrievalCandidate {
  return {
    id,
    category,
    keyName,
    value,
    description: null,
    score,
  };
}

describe('DMKnowledgeRerankerService', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.OPENROUTER_API_KEY;
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

  it('uses LLM-selected candidate ids when rerank succeeds', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                selectedIds: ['c2'],
                rationale: 'Bu aday dogrudan havuz sicakligi sorusunu cevapluyor.',
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'havuz kac derece',
      followUpHint: null,
      activeTopic: null,
      requestedCategories: ['faq'],
      candidates: [
        createCandidate('c1', 'policies', 'pool_rules', 0.29, 'Bone zorunludur.'),
        createCandidate('c2', 'faq', 'havuz_sicaklik', 0.27, 'Havuz 28-30 derece arasindadir.'),
      ],
      maxSelections: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.selectedCandidates).toHaveLength(1);
    expect(result.selectedCandidates[0].id).toBe('c2');
    expect(result.trace.selectedEntries[0]).toMatchObject({
      category: 'faq',
      keyName: 'havuz_sicaklik',
    });
  });

  it('allows the reranker to reject weak single support candidates', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                selectedIds: [],
                rationale: 'Bu destek girdisi aktif fiyat/saat sorusuna dogrudan yardim etmiyor.',
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'fiyat nedir saat kacta ne zaman',
      followUpHint: {
        topicLabel: 'taekwondo dersleri',
        rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saat kacta ne zaman',
        sourceMessage: 'taewondo dersi varmi',
      },
      activeTopic: 'taekwondo dersleri',
      requestedCategories: ['services', 'pricing', 'hours'],
      candidates: [
        createCandidate('c1', 'policies', 'age_groups', 0.2473, 'Taekwondo 8+'),
      ],
      maxSelections: 3,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.selectedCandidates).toEqual([]);
    expect(result.trace.selectedCount).toBe(0);
    expect(result.trace.skippedReason).toBe('weak_single_candidate');
  });

  it('keeps a single room-availability faq candidate without calling the reranker model', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'cift odaniz varmi',
      followUpHint: null,
      activeTopic: 'spa hizmetleri',
      requestedCategories: ['services'],
      candidates: [
        createCandidate('c1', 'faq', 'massage_room_options', 0.2357, 'Tek kisilik ve iki kisilik odalarimiz vardir.'),
      ],
      maxSelections: 3,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.selectedCandidates).toHaveLength(1);
    expect(result.selectedCandidates[0].id).toBe('c1');
    expect(result.trace.skippedReason).toBe('simple_case');
  });

  it('prioritizes age-policy candidates in fallback mode for age-related follow-ups', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'yasa bakiyor musunuz',
      followUpHint: {
        topicLabel: 'masaj fiyatlari',
        rewrittenQuestion: 'masaj fiyatlari icin yasa bakiyor musunuz',
        sourceMessage: 'masaj fiyatlari nedir',
      },
      activeTopic: 'masaj fiyatlari',
      requestedCategories: ['services', 'pricing', 'policies'],
      candidates: [
        createCandidate('c1', 'faq', 'kese_kopuk_fiyat', 0.42, 'Kese kopuk ekleme 100 TL.'),
        createCandidate('c2', 'policies', 'age_groups', 0.28, 'SPA/masaj: 18 yas ve uzeri.'),
      ],
      maxSelections: 1,
    });

    expect(result.selectedCandidates).toHaveLength(1);
    expect(result.selectedCandidates[0].id).toBe('c2');
    expect(result.trace.skippedReason).toBe('no_api_key');
  });

  it('drops weak single non-priority candidates in fallback mode', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'fiyat nedir saat kacta',
      followUpHint: null,
      activeTopic: null,
      requestedCategories: ['pricing', 'hours'],
      candidates: [
        createCandidate('c1', 'policies', 'age_groups', 0.24, '18 yas ve uzeri.'),
      ],
      maxSelections: 2,
    });

    expect(result.selectedCandidates).toEqual([]);
    expect(result.trace.skippedReason).toBe('weak_single_candidate');
  });

  it('does not guess support evidence when rerank is needed but api key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'fiyat nedir saatleri nedir',
      followUpHint: {
        topicLabel: 'taekwondo dersleri',
        rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saatleri nedir',
        sourceMessage: 'taekwondo dersleri',
      },
      activeTopic: 'taekwondo dersleri',
      requestedCategories: ['pricing', 'hours'],
      candidates: [
        createCandidate('c1', 'faq', 'pool_rules', 0.44, 'Bone zorunludur.'),
        createCandidate('c2', 'policies', 'age_groups', 0.41, 'Taekwondo 8+'),
      ],
      maxSelections: 2,
    });

    expect(result.selectedCandidates).toEqual([]);
    expect(result.trace.skippedReason).toBe('no_api_key');
    expect(result.trace.selectedCount).toBe(0);
  });

  it('does not re-add weak support entries when the rerank provider errors', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new DMKnowledgeRerankerService();
    const result = await service.rerank({
      messageText: 'fiyat nedir saatleri nedir',
      followUpHint: {
        topicLabel: 'taekwondo dersleri',
        rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saatleri nedir',
        sourceMessage: 'taekwondo dersleri',
      },
      activeTopic: 'taekwondo dersleri',
      requestedCategories: ['pricing', 'hours'],
      candidates: [
        createCandidate('c1', 'faq', 'pool_rules', 0.44, 'Bone zorunludur.'),
        createCandidate('c2', 'general', 'parking', 0.39, 'Otopark vardir.'),
      ],
      maxSelections: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.selectedCandidates).toEqual([]);
    expect(result.trace.skippedReason).toBe('api_error_503');
    expect(result.trace.selectedCount).toBe(0);
  });

  it('formats selected evidence into a compact prompt block', () => {
    const formatted = formatSelectedEvidenceBlock([
      createCandidate('c1', 'faq', 'havuz_sicaklik', 0.27, 'Havuz 28-30 derece arasindadir.'),
    ]);

    expect(formatted).toContain('[faq] havuz_sicaklik');
    expect(formatted).toContain('Havuz 28-30 derece arasindadir.');
  });
});
