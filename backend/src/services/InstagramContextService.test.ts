import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstagramContextService } from './InstagramContextService.ts';
import type { ConversationEntry } from './InstagramContextService.ts';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + (minutes * 60 * 1000)).toISOString();
}

function createHistory(messages: Array<{ direction?: 'inbound' | 'outbound'; text: string; minutesAgo: number }>): ConversationEntry[] {
  return messages.map(message => ({
    direction: message.direction || 'inbound',
    messageText: message.text,
    createdAt: minutesAgo(message.minutesAgo),
    relativeTime: `${message.minutesAgo} dk once`,
  }));
}

function createAiResponse(payload: Record<string, unknown>) {
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

describe('InstagramContextService AI context planner', () => {
  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses one AI planning call and keeps explicit follow-up context only when AI confirms it', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(createAiResponse({
      categories: ['pricing', 'services'],
      semanticSignals: ['follow_up_pricing', 'active_topic_clear'],
      followUpHint: {
        topicLabel: 'masaj',
        rewrittenQuestion: 'masaj fiyatlari nedir?',
        sourceMessage: 'hangi masajlar var',
      },
      responseDirective: {
        mode: 'answer_directly',
        instruction: 'Aktif konu net. Sadece ilgili fiyat bilgisini ver.',
        rationale: 'Mesaj eliptik ama baglam acik.',
      },
      tier: 'standard',
      tierReason: 'Net ama baglama dayali fiyat sorusu',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI(
      'fiyatlari nedir',
      createHistory([{ text: 'hangi masajlar var', minutesAgo: 2 }]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.categories).toEqual(['pricing', 'services']);
    expect(result.keywords).toEqual(['follow_up_pricing', 'active_topic_clear']);
    expect(result.followUpHint).toEqual({
      topicLabel: 'masaj',
      rewrittenQuestion: 'masaj fiyatlari nedir?',
      sourceMessage: 'hangi masajlar var',
    });
    expect(result.responseDirective.mode).toBe('answer_directly');
  });

  it('does not force stale topic context for broad multi-intent questions', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(createAiResponse({
      categories: ['pricing', 'hours'],
      semanticSignals: ['multi_intent_info_request', 'pricing_scope_ambiguous'],
      followUpHint: null,
      responseDirective: {
        mode: 'answer_then_clarify',
        instruction: 'Saat gibi net bilgileri ver. Fiyat kapsami belirsizse sonunda tek bir kisa netlestirme sorusu sor.',
        rationale: 'Yeni mesaj genis ve onceki konuya zorlanmamali.',
      },
      tier: 'standard',
      tierReason: 'Coklu bilgi boyutu iceriyor',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI(
      'fiyat nedir saat kacta ne zaman',
      createHistory([
        { text: 'cocuk icin yuzme kursu varmi', minutesAgo: 3 },
        { direction: 'outbound', text: 'Evet, bilgi verebilirim.', minutesAgo: 2 },
      ]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.categories).toEqual(['pricing', 'hours']);
    expect(result.followUpHint).toBeNull();
    expect(result.responseDirective.mode).toBe('answer_then_clarify');
    expect(result.responseDirective.instruction).toContain('Saat gibi net bilgileri ver');
  });

  it('forces policies into age-related follow-ups even when the planner anchors to a service topic', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(createAiResponse({
      categories: ['services', 'general'],
      semanticSignals: ['age_inquiry'],
      followUpHint: {
        topicLabel: 'masaj fiyatlari',
        rewrittenQuestion: 'masaj fiyatlari icin yasa bakiyor musunuz',
        sourceMessage: 'masaj fiyatlari nedir',
      },
      responseDirective: {
        mode: 'clarify_only',
        instruction: 'Aktif konuya gore once neyin soruldugunu netlestir.',
        rationale: 'Mesaj kisa bir takip sorusu.',
      },
      tier: 'standard',
      tierReason: 'Baglama dayali politika sorusu',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI(
      'yasa bakiyor musunuz',
      createHistory([
        { text: 'masaj fiyatlari nedir', minutesAgo: 1 },
        { direction: 'outbound', text: 'Masaj fiyatlarimiz mevcut.', minutesAgo: 0.5 },
      ]),
    );

    expect(result.categories).toContain('policies');
    expect(result.categories).toContain('services');
    expect(result.keywords).toContain('policy_age_signal');
    expect(result.responseDirective.instruction).toContain('Yas, 18+ ve ebeveyn/veli kurali');
  });

  it('normalizes fenced JSON replies from the planner', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                '```json',
                JSON.stringify({
                  categories: ['contact'],
                  semanticSignals: ['contact_request'],
                  followUpHint: null,
                  responseDirective: {
                    mode: 'answer_directly',
                    instruction: 'Iletisim bilgisini dogrudan ver.',
                    rationale: 'Mesaj net.',
                  },
                  tier: 'light',
                  tierReason: 'Tek ve basit bilgi talebi',
                }),
                '```',
              ].join('\n'),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI('telefon numaraniz nedir', []);

    expect(result.categories).toEqual(['contact']);
    expect(result.keywords).toEqual(['contact_request']);
    expect(result.responseDirective.mode).toBe('answer_directly');
  });

  it('derives follow-up context from structured contextDependency when followUpHint is omitted', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(createAiResponse({
      categories: ['pricing', 'hours'],
      semanticSignals: ['recent_follow_up', 'topic_specific_info_request'],
      contextDependency: {
        dependsOnPriorTopic: true,
        topicLabel: 'taekwondo dersleri',
        sourceMessage: 'taekwondo dersleri ?',
        rationale: 'Mevcut mesaj son hizmet sorusunun devamidir.',
      },
      responseDirective: {
        mode: 'answer_then_clarify',
        instruction: 'Bildigin fiyat ve saat bilgisini ver; eksikse sadece gerekli kisim icin netlestir.',
        rationale: 'Mesaj baglama dayali.',
      },
      tier: 'standard',
      tierReason: 'Baglama dayali standart bilgi talebi',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI(
      'fiyat nedir saat kacta ne zaman',
      createHistory([
        { text: 'taekwondo dersleri ?', minutesAgo: 1 },
        { direction: 'outbound', text: 'Evet, mevcut.', minutesAgo: 0.5 },
      ]),
    );

    expect(result.categories).toEqual(['services', 'pricing', 'hours']);
    expect(result.followUpHint).toEqual({
      topicLabel: 'taekwondo dersleri',
      rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saat kacta ne zaman',
      sourceMessage: 'taekwondo dersleri ?',
    });
    expect(result.responseDirective.instruction).toContain('Aktif konu: taekwondo dersleri.');
  });

  it('overrides follow-up directives that only repeat prior uncertainty', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(createAiResponse({
      categories: ['pricing', 'hours'],
      semanticSignals: ['recent_follow_up', 'topic_specific_info_request'],
      contextDependency: {
        dependsOnPriorTopic: true,
        topicLabel: 'taekwondo dersleri',
        sourceMessage: 'taewondo dersi varmi',
        rationale: 'Kisa takip sorusu onceki hizmete bagli.',
      },
      responseDirective: {
        mode: 'answer_then_clarify',
        instruction: 'Onceki mesajda bu bilgiler verilemedigi icin telefon numarasini tekrar vererek yonlendir.',
        rationale: 'Onceki belirsizlik tekrar edilmeli.',
      },
      tier: 'standard',
      tierReason: 'Baglama dayali standart bilgi talebi',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI(
      'fiyat nedir saat kacta ne zaman',
      createHistory([
        { text: 'taewondo dersi varmi', minutesAgo: 1 },
        { direction: 'outbound', text: 'Bu konuda arayabilirsiniz.', minutesAgo: 0.5 },
      ]),
    );

    expect(result.followUpHint?.topicLabel).toBe('taekwondo dersleri');
    expect(result.responseDirective.mode).toBe('answer_then_clarify');
    expect(result.responseDirective.instruction).toContain('Verilen bilgilerde taekwondo dersleri icin net fiyat ve saat bilgisi varsa once onu dogrudan ver');
    expect(result.responseDirective.instruction).not.toContain('Onceki mesajda');
  });

  it('uses AI context repair when the planner leaves a modifier-only follow-up underspecified', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createAiResponse({
        categories: ['pricing', 'hours'],
        semanticSignals: ['pricing_inquiry', 'hours_inquiry'],
        contextDependency: {
          dependsOnPriorTopic: false,
          topicLabel: null,
          sourceMessage: null,
          rationale: 'Mesaj tek basina belirsiz.',
        },
        responseDirective: {
          mode: 'answer_then_clarify',
          instruction: 'Bilinen fiyat ve saat bilgisini ver; eksikse netlestir.',
          rationale: 'Belirsiz mesaj.',
        },
        tier: 'standard',
        tierReason: 'Belirsiz coklu istek',
      }))
      .mockResolvedValueOnce(createAiResponse({
        dependsOnPriorTopic: true,
        topicLabel: 'taekwondo dersleri',
        sourceMessage: 'taekwondo dersi varmi',
        rationale: 'Son musteri mesaji ayni hizmeti tanimliyor.',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new InstagramContextService({} as any);
    const result = await service.detectIntentWithContextAI(
      'fiyat nedir saat kacta ne zaman',
      createHistory([
        { text: 'taekwondo dersi varmi', minutesAgo: 1 },
        { direction: 'outbound', text: 'Evet, taekwondo derslerimiz mevcut.', minutesAgo: 0.5 },
      ]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.categories).toEqual(['services', 'pricing', 'hours']);
    expect(result.followUpHint).toEqual({
      topicLabel: 'taekwondo dersleri',
      rewrittenQuestion: 'taekwondo dersleri icin fiyat nedir saat kacta ne zaman',
      sourceMessage: 'taekwondo dersi varmi',
    });
    expect(result.responseDirective.instruction).toContain('Aktif konu: taekwondo dersleri.');
  });

  it('analyzeMessage sends only recent deduplicated turns to the planner', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';

    const oldTimestamp = minutesAgo(35);
    const recentInboundTimestamp = minutesAgo(1);
    const recentOutboundTimestamp = minutesAgo(0.5);
    let plannerPayload: any = null;

    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      const prompt = String(body.messages?.[1]?.content ?? '');
      const marker = 'INPUT:\n';
      plannerPayload = JSON.parse(prompt.slice(prompt.indexOf(marker) + marker.length));

      return createAiResponse({
        categories: ['pricing', 'hours', 'services'],
        semanticSignals: ['recent_follow_up', 'specific_topic_retained'],
        followUpHint: {
          topicLabel: 'cocuklar icin yuzme dersi',
          rewrittenQuestion: 'cocuklar icin yuzme dersi fiyat nedir saat kacta ne zaman',
          sourceMessage: 'cocuklar icin yuzme dersi varmi',
        },
        responseDirective: {
          mode: 'answer_directly',
          instruction: 'Ayni konunun devami olarak ele al ve mevcut bilgiyi o hizmete gore ver.',
          rationale: 'Hemen onceki mesaj net bir konu belirtiyor.',
        },
        tier: 'standard',
        tierReason: 'Kisa ama baglama dayali coklu bilgi sorusu',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const rows = [
      { direction: 'outbound', message_text: 'Evet, cocuklar icin yuzme dersi mevcut.', created_at: recentOutboundTimestamp },
      { direction: 'inbound', message_text: 'cocuklar icin yuzme dersi varmi', created_at: recentInboundTimestamp },
      { direction: 'outbound', message_text: 'Eski yanit', created_at: oldTimestamp },
      { direction: 'inbound', message_text: 'eski soru', created_at: oldTimestamp },
      { direction: 'inbound', message_text: 'eski soru', created_at: oldTimestamp },
    ];

    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes('ORDER BY created_at DESC')) {
          return { all: () => rows };
        }

        if (sql.includes('COUNT(*) as c')) {
          return { get: () => ({ c: 9 }) };
        }

        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    } as any;

    const service = new InstagramContextService(fakeDb);
    const analysis = await service.analyzeMessage('ig-user', 'fiyat nedir saat kacta ne zaman');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(plannerPayload).not.toBeNull();
    expect(plannerPayload.recentHistory).toHaveLength(2);
    expect(plannerPayload.recentHistory.map((entry: any) => entry.messageText)).toEqual([
      'cocuklar icin yuzme dersi varmi',
      'Evet, cocuklar icin yuzme dersi mevcut.',
    ]);
    expect(analysis.conversationHistory).toHaveLength(2);
    expect(analysis.formattedHistory).toContain('cocuklar icin yuzme dersi varmi');
    expect(analysis.formattedHistory).not.toContain('eski soru');
  });

  it('uses stored conversation state to repair short follow-up messages', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createAiResponse({
        categories: ['general'],
        semanticSignals: ['short_follow_up'],
        topicSummary: null,
        contextDependency: {
          dependsOnPriorTopic: false,
          topicLabel: null,
          sourceMessage: null,
          rationale: 'Mesaj tek basina belirsiz.',
        },
        responseDirective: {
          mode: 'clarify_only',
          instruction: 'Mesaj kisa ve belirsiz; baglam net degilse netlestir.',
          rationale: 'Bagimsiz okununca konu belirsiz.',
        },
        tier: 'light',
        tierReason: 'Kisa ve belirsiz takip mesaji',
      }))
      .mockResolvedValueOnce(createAiResponse({
        dependsOnPriorTopic: true,
        topicLabel: 'reformer pilates',
        sourceMessage: 'son olarak pilates varmi',
        rationale: 'Aktif konudaki ders gunu tercihi soruluyor.',
      }));
    vi.stubGlobal('fetch', fetchMock);

    const staleTimestamp = minutesAgo(25);
    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes('ORDER BY created_at DESC')) {
          return {
            all: () => [
              { direction: 'outbound', message_text: 'Evet, reformer pilates derslerimiz mevcut.', created_at: staleTimestamp },
              { direction: 'inbound', message_text: 'son olarak pilates varmi', created_at: staleTimestamp },
            ],
          };
        }

        if (sql.includes('COUNT(*) as c')) {
          return { get: () => ({ c: 5 }) };
        }

        if (sql.includes('FROM dm_conversation_state')) {
          return {
            get: () => ({
              channel: 'instagram',
              customer_id: 'ig-user',
              active_topic: 'reformer pilates',
              active_topic_confidence: 0.9,
              topic_source_message: 'son olarak pilates varmi',
              last_question_type: 'service_topic',
              pending_categories: '["services","pricing"]',
              last_customer_message: 'son olarak pilates varmi',
              last_assistant_message: 'Evet, reformer pilates derslerimiz mevcut.',
              turn_count: 1,
              expires_at: minutesFromNow(10),
              created_at: minutesAgo(2),
              updated_at: minutesAgo(1),
            }),
          };
        }

        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    } as any;

    const service = new InstagramContextService(fakeDb);
    const analysis = await service.analyzeMessage('ig-user', 'haftasonu olabilir');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(analysis.followUpHint).toEqual({
      topicLabel: 'reformer pilates',
      rewrittenQuestion: 'reformer pilates icin haftasonu olabilir',
      sourceMessage: 'son olarak pilates varmi',
    });
    expect(analysis.activeTopicLabel).toBe('reformer pilates');
    expect(analysis.conversationState?.repairedFromState).toBe(true);
  });
  it('uses recent conversation state instead of a stale planner follow-up when topics conflict', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue(createAiResponse({
      categories: ['services', 'pricing', 'hours'],
      semanticSignals: ['recent_follow_up', 'topic_specific_info_request'],
      topicSummary: 'taekwondo dersleri',
      contextDependency: {
        dependsOnPriorTopic: true,
        topicLabel: 'taekwondo dersleri',
        sourceMessage: 'taekwondo dersi varmi',
        rationale: 'Mesaj onceki taekwondo sorusuna bagli gorunuyor.',
      },
      responseDirective: {
        mode: 'answer_directly',
        instruction: 'Aktif konu olarak taekwondo derslerini ele al.',
        rationale: 'Baglam onceki mesajdan geliyor.',
      },
      tier: 'standard',
      tierReason: 'Baglama dayali standart bilgi talebi',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes('ORDER BY created_at DESC')) {
          return {
            all: () => [
              { direction: 'outbound', message_text: 'Evet, cocuklar icin yuzme derslerimiz mevcut.', created_at: minutesAgo(1) },
              { direction: 'inbound', message_text: 'cocuklar icin yuzme dersi varmi', created_at: minutesAgo(1) },
              { direction: 'outbound', message_text: 'Taekwondo 2000 TL.', created_at: minutesAgo(2) },
              { direction: 'inbound', message_text: 'taekwondo dersi varmi', created_at: minutesAgo(2) },
            ],
          };
        }

        if (sql.includes('COUNT(*) as c')) {
          return { get: () => ({ c: 6 }) };
        }

        if (sql.includes('FROM dm_conversation_state')) {
          return {
            get: () => ({
              channel: 'instagram',
              customer_id: 'ig-user',
              active_topic: 'yuzme dersleri',
              active_topic_confidence: 0.82,
              topic_source_message: 'taekwondo dersi varmi',
              last_question_type: 'service_topic',
              pending_categories: '["services"]',
              last_customer_message: 'cocuklar icin yuzme dersi varmi',
              last_assistant_message: 'Evet, cocuklar icin yuzme derslerimiz mevcut.',
              turn_count: 4,
              expires_at: minutesFromNow(10),
              created_at: minutesAgo(2),
              updated_at: minutesAgo(1),
            }),
          };
        }

        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    } as any;

    const service = new InstagramContextService(fakeDb);
    const analysis = await service.analyzeMessage('ig-user', 'fiyat nedir saat kacta ne zaman');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(analysis.followUpHint).toEqual({
      topicLabel: 'yuzme dersleri',
      rewrittenQuestion: 'yuzme dersleri icin fiyat nedir saat kacta ne zaman',
      sourceMessage: 'cocuklar icin yuzme dersi varmi',
    });
    expect(analysis.activeTopicLabel).toBe('yuzme dersleri');
  });

  it('resets the stored topic source when the user explicitly switches services', () => {
    const insertRuns: unknown[][] = [];
    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes('FROM dm_conversation_state')) {
          return {
            get: () => ({
              channel: 'instagram',
              customer_id: 'ig-user',
              active_topic: 'taekwondo dersleri',
              active_topic_confidence: 0.95,
              topic_source_message: 'taekwondo dersi varmi',
              last_question_type: 'follow_up',
              pending_categories: '["services","pricing","hours"]',
              last_customer_message: 'fiyat nedir saat kacta ne zaman',
              last_assistant_message: 'Taekwondo 2000 TL.',
              turn_count: 3,
              expires_at: minutesFromNow(10),
              created_at: minutesAgo(2),
              updated_at: minutesAgo(1),
            }),
          };
        }

        if (sql.includes('INSERT INTO dm_conversation_state')) {
          return {
            run: (...args: unknown[]) => {
              insertRuns.push(args);
              return { changes: 1 };
            },
          };
        }

        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    } as any;

    const service = new InstagramContextService(fakeDb);
    service.saveConversationState(
      'ig-user',
      'cocuklar icin yuzme dersi varmi',
      'Evet, cocuklar icin yuzme derslerimiz mevcut.',
      {
        activeTopicLabel: 'yuzme dersleri',
        followUpHint: null,
        conversationState: {
          activeTopic: 'taekwondo dersleri',
          activeTopicConfidence: 0.95,
          topicSourceMessage: 'taekwondo dersi varmi',
          expiresAt: minutesFromNow(10),
          usedForPlanning: true,
          repairedFromState: false,
        },
        intentCategories: ['services'],
      } as any,
    );

    expect(insertRuns).toHaveLength(1);
    expect(insertRuns[0][4]).toBe('cocuklar icin yuzme dersi varmi');
  });

  it('uses conservative AI recovery instead of keyword guessing when the planner is unavailable', async () => {
    delete process.env.OPENROUTER_API_KEY;

    const fakeDb = {
      prepare(sql: string) {
        if (sql.includes('ORDER BY created_at DESC')) {
          return {
            all: () => [],
          };
        }

        if (sql.includes('COUNT(*) as c')) {
          return { get: () => ({ c: 2 }) };
        }

        if (sql.includes('FROM dm_conversation_state')) {
          return {
            get: () => null,
          };
        }

        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
    } as any;

    const service = new InstagramContextService(fakeDb);
    const analysis = await service.analyzeMessage('ig-user', 'mutli sonli olan hangisi');

    expect(analysis.intentCategories).toEqual(['general', 'faq']);
    expect(analysis.matchedKeywords).toEqual([]);
    expect(analysis.modelTier).toBe('light');
  });
});
