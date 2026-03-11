import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstagramContextService } from './InstagramContextService.js';
import {
  buildClarifyExhaustedContactResponse,
  buildDeterministicClarifierResponse,
  isDirectLocationQuestion,
} from './DMPipelineHeuristics.js';
import { evaluateSexualIntent } from '../middleware/sexualIntentFilter.js';

function createMockDb(): any {
  return {
    prepare: () => ({
      all: () => [],
      get: () => ({ c: 0 }),
      run: () => undefined,
    }),
  };
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + (minutes * 60 * 1000)).toISOString();
}

type HistorySeed = {
  direction?: 'inbound' | 'outbound';
  text: string;
  minutesAgo: number;
};

function createHistory(entries: HistorySeed[]) {
  return entries.map(entry => ({
    direction: entry.direction || 'inbound',
    messageText: entry.text,
    createdAt: minutesAgo(entry.minutesAgo),
    relativeTime: `${entry.minutesAgo}dk once`,
  }));
}

describe('DM real traffic regressions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      label: 'generic info opener from live traffic',
      message: '⭐️bilgi alabilir miyim?',
      expectedCategory: 'general',
      expectedMode: ['answer_directly', 'clarify_only', 'answer_then_clarify'],
      expectedKeyword: null,
    },
    {
      label: 'direct location opener from live traffic',
      message: "📍İskenderun'un neresindesiniz?",
      expectedCategory: 'contact',
      expectedMode: ['answer_directly'],
      expectedKeyword: 'direct_location_answer_signal',
    },
    {
      label: 'generic pricing opener from live traffic',
      message: 'fiyatları nedir',
      expectedCategory: 'pricing',
      expectedMode: ['clarify_only', 'answer_then_clarify'],
      expectedKeyword: null,
    },
    {
      label: 'standalone hours opener from live traffic',
      message: 'saat kaça kadar açıksınız',
      expectedCategory: 'hours',
      expectedMode: ['answer_directly'],
      expectedKeyword: 'standalone_hours_request',
    },
    {
      label: 'standalone appointment opener from live traffic',
      message: 'ðŸ•£ randevu alabilir miyim?',
      expectedCategory: 'faq',
      expectedMode: ['answer_directly'],
      expectedKeyword: 'standalone_appointment_request',
    },
  ])('keeps $label on the simple-turn path', ({ message, expectedCategory, expectedMode, expectedKeyword }) => {
    const service = new InstagramContextService(createMockDb());
    vi.spyOn(service, 'getConversationHistory').mockReturnValue([]);
    vi.spyOn(service, 'getTotalInteractionCount').mockReturnValue(0);
    (service as any).conversationStateService = { getState: vi.fn().mockReturnValue(null) };

    const result = service.analyzeSimpleTurn('ig-real-traffic', message);

    expect(result).not.toBeNull();
    expect(result?.intentCategories).toContain(expectedCategory);
    expect(expectedMode).toContain(result?.responseDirective.mode);
    expect(result?.followUpHint).toBeNull();
    if (expectedKeyword) {
      expect(result?.matchedKeywords).toContain(expectedKeyword);
    }
  });

  it('treats gratitude-prefixed hours from live traffic as an independent simple turn', () => {
    const service = new InstagramContextService(createMockDb());
    vi.spyOn(service, 'getConversationHistory').mockReturnValue(createHistory([
      { text: 'Medical masaj paketiniz fiyati nekadar', minutesAgo: 2 },
      { direction: 'outbound', text: 'Medikal 30dk ve 50dk seceneklerimiz var.', minutesAgo: 1 },
    ]));
    vi.spyOn(service, 'getTotalInteractionCount').mockReturnValue(4);
    (service as any).conversationStateService = {
      getState: vi.fn().mockReturnValue({
        channel: 'instagram',
        customerId: 'ig-real-traffic',
        activeTopic: 'medical masaj paketleri',
        activeTopicConfidence: 0.92,
        topicSourceMessage: 'Medical masaj paketiniz fiyati nekadar',
        lastQuestionType: 'pricing',
        pendingCategories: ['pricing'],
        lastCustomerMessage: 'Medical masaj paketiniz fiyati nekadar',
        lastAssistantMessage: 'Medikal 30dk ve 50dk seceneklerimiz var.',
        turnCount: 1,
        expiresAt: minutesFromNow(10),
        createdAt: minutesAgo(2),
        updatedAt: minutesAgo(1),
      }),
    };

    const result = service.analyzeSimpleTurn('ig-real-traffic', 'teşekkürler açılış kapanış saatleriniz');

    expect(result).not.toBeNull();
    expect(result?.intentCategories).toContain('hours');
    expect(result?.matchedKeywords).toContain('standalone_hours_request');
    expect(result?.followUpHint).toBeNull();
    expect(result?.responseDirective.mode).toBe('answer_directly');
  });

  it('keeps normalized ASCII hours wording on the simple-turn path', () => {
    const service = new InstagramContextService(createMockDb());
    vi.spyOn(service, 'getConversationHistory').mockReturnValue([]);
    vi.spyOn(service, 'getTotalInteractionCount').mockReturnValue(0);
    (service as any).conversationStateService = { getState: vi.fn().mockReturnValue(null) };

    const result = service.analyzeSimpleTurn('ig-real-traffic', 'saat kaca kadar aciksiniz');

    expect(result).not.toBeNull();
    expect(result?.intentCategories).toContain('hours');
    expect(result?.matchedKeywords).toContain('standalone_hours_request');
    expect(result?.responseDirective.mode).toBe('answer_directly');
  });

  it('keeps mixed hours and appointment wording on the simple-turn path', () => {
    const service = new InstagramContextService(createMockDb());
    vi.spyOn(service, 'getConversationHistory').mockReturnValue([]);
    vi.spyOn(service, 'getTotalInteractionCount').mockReturnValue(0);
    (service as any).conversationStateService = { getState: vi.fn().mockReturnValue(null) };

    const result = service.analyzeSimpleTurn('ig-real-traffic', 'Saat 2 de randevu almak istiyorum');

    expect(result).not.toBeNull();
    expect(result?.intentCategories).toEqual(expect.arrayContaining(['hours', 'faq', 'contact']));
    expect(result?.matchedKeywords).toContain('standalone_hours_request');
    expect(result?.matchedKeywords).toContain('standalone_appointment_request');
    expect(result?.responseDirective.mode).toBe('answer_directly');
  });

  it.each([
    'cocuk icin yuzme kursu varmi',
    'eşimle geleceğim beraber aynı odada masaj yaptırmak istiyoruz',
    '🕣 randevu alabilir miyim?',
  ])('keeps guarded live prompt "%s" off the simple-turn fast lane', (message) => {
    const service = new InstagramContextService(createMockDb());
    vi.spyOn(service, 'getConversationHistory').mockReturnValue([]);
    vi.spyOn(service, 'getTotalInteractionCount').mockReturnValue(0);
    (service as any).conversationStateService = { getState: vi.fn().mockReturnValue(null) };

    const result = service.analyzeSimpleTurn('ig-real-traffic', message);

    if (message.includes('randevu')) {
      expect(result).not.toBeNull();
      expect(result?.matchedKeywords).toContain('standalone_appointment_request');
      return;
    }

    expect(result).toBeNull();
  });

  it('treats the top live pricing clarifier as deterministic even after simple-turn analysis', () => {
    const result = buildDeterministicClarifierResponse({
      messageText: 'fiyatları nedir',
      intentCategories: ['pricing', 'general'],
      responseMode: 'answer_then_clarify',
      semanticSignals: [],
    });

    expect(result).toEqual({
      response: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
      modelId: 'deterministic/clarifier-pricing-v1',
    });
  });

  it('recognizes the top live location opener as a direct contact question', () => {
    expect(isDirectLocationQuestion("📍İskenderun'un neresindesiniz?")).toBe(true);
  });

  it('stops the repeated live pricing confusion loop with a contact fallback', () => {
    const result = buildClarifyExhaustedContactResponse({
      messageText: 'Bu hizmeti istiyorum fiyat nedir',
      conversationHistory: createHistory([
        { text: 'Fiyat nedir ogrenebilir miyim', minutesAgo: 4 },
        {
          direction: 'outbound',
          text: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
          minutesAgo: 3,
        },
        { direction: 'inbound', text: 'Mesaj fiyati', minutesAgo: 2 },
        {
          direction: 'outbound',
          text: 'Mesajinizi daha acik yazar misiniz? Yalnizca profesyonel spa ve spor hizmetleri konusunda yardimci olabiliyoruz.',
          minutesAgo: 1,
        },
      ]),
      responseMode: 'answer_then_clarify',
      fallbackMessage: 'Detayli bilgi icin lutfen bizi arayin: 0326 502 58 58.',
    });

    expect(result?.response).toBe('Detayli bilgi icin lutfen bizi arayin: 0326 502 58 58.');
    expect(result?.clarificationCount).toBe(2);
  });

  describe('real traffic sexual-safety probes', () => {
    let originalApiKey: string | undefined;

    beforeEach(() => {
      originalApiKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
    });

    afterEach(() => {
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }
    });

    it.each([
      ['mutlu son varmı', 'block_message', 'heuristic-euphemism-guard'],
      ['extra hizmetiniz ne kadar', 'retry_question', 'heuristic-euphemism-guard'],
      ['eşimle geleceğim beraber aynı odada masaj yaptırmak istiyoruz', 'allow', 'heuristic-clear-business-guard'],
    ])('classifies live prompt "%s" safely without needing the model', async (message, expectedAction, expectedModel) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await evaluateSexualIntent(message);

      expect(result.action).toBe(expectedAction);
      expect(result.modelUsed).toBe(expectedModel);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
