import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstagramContextService } from './InstagramContextService.ts';
import type { ConversationEntry } from './InstagramContextService.ts';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
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
          instruction: 'Ayni konunun devamı olarak ele al ve mevcut bilgiyi o hizmete göre ver.',
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
});
