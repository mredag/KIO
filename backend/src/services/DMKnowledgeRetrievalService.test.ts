import { describe, expect, it } from 'vitest';
import { DMKnowledgeRetrievalService } from './DMKnowledgeRetrievalService.js';

interface KnowledgeRow {
  id: string;
  category: string;
  key_name: string;
  value: string;
  description: string | null;
  updated_at: string;
}

function createDb(rows: KnowledgeRow[]) {
  return {
    prepare(sql: string) {
      if (sql.includes('COUNT(*) as entry_count')) {
        return {
          get() {
            const maxUpdatedAt = rows.reduce<string | null>((latest, row) => {
              if (!latest || row.updated_at > latest) {
                return row.updated_at;
              }

              return latest;
            }, null);

            return {
              entry_count: rows.length,
              max_updated_at: maxUpdatedAt,
            };
          },
        };
      }

      if (sql.includes('FROM knowledge_base')) {
        return {
          all() {
            return rows;
          },
        };
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  } as any;
}

describe('DMKnowledgeRetrievalService', () => {
  it('adds the most relevant missing service entry for ambiguous follow-ups', () => {
    const service = new DMKnowledgeRetrievalService(createDb([
      {
        id: '1',
        category: 'services',
        key_name: 'taekwondo_dersi',
        value: 'Taekwondo dersimiz cocuklar ve gencler icin mevcuttur.',
        description: 'Hafta ici gruplar vardir.',
        updated_at: '2026-03-02T00:00:00.000Z',
      },
      {
        id: '2',
        category: 'services',
        key_name: 'fitness_salonu',
        value: 'Fitness salonumuz yetiskin uyeler icindir.',
        description: 'Cardio ve agirlik alani vardir.',
        updated_at: '2026-03-02T00:00:00.000Z',
      },
      {
        id: '3',
        category: 'faq',
        key_name: 'havuz_sicaklik',
        value: 'Havuz 28-30 derece arasindadir.',
        description: null,
        updated_at: '2026-03-02T00:00:00.000Z',
      },
    ]));

    const result = service.augmentContext({
      baseContextJson: JSON.stringify({
        pricing: { taekwondo_price: 'Aylik 1500 TL' },
        hours: { taekwondo_schedule: 'Sali-Persembe 17:00-18:00' },
        contact: { phone: '0326 502 58 58' },
      }),
      messageText: 'fiyat nedir saat kacta ne zaman',
      followUpHint: {
        topicLabel: 'taekwondo',
        rewrittenQuestion: 'taekwondo fiyat nedir saat kacta ne zaman',
        sourceMessage: 'taekwondo dersi varmi',
      },
      activeTopic: 'taekwondo',
      primaryCategories: ['pricing', 'hours', 'contact'],
    });

    const context = JSON.parse(result.knowledgeContext) as Record<string, Record<string, string>>;

    expect(result.addedEntriesCount).toBe(1);
    expect(result.addedCategories).toEqual(['services']);
    expect(context.services?.taekwondo_dersi).toContain('Taekwondo');
    expect(result.trace.selectedEntries[0]).toMatchObject({
      category: 'services',
      keyName: 'taekwondo_dersi',
    });
  });

  it('uses character-gram similarity to recover likely typo matches', () => {
    const service = new DMKnowledgeRetrievalService(createDb([
      {
        id: '1',
        category: 'services',
        key_name: 'taekwondo_dersi',
        value: 'Taekwondo dersi mevcuttur.',
        description: null,
        updated_at: '2026-03-02T00:00:00.000Z',
      },
      {
        id: '2',
        category: 'services',
        key_name: 'yuzme_kursu',
        value: 'Yuzme kursu mevcuttur.',
        description: null,
        updated_at: '2026-03-02T00:00:00.000Z',
      },
    ]));

    const result = service.augmentContext({
      baseContextJson: JSON.stringify({
        contact: { phone: '0326 502 58 58' },
      }),
      messageText: 'taewondo dersi varmi',
      followUpHint: null,
      activeTopic: null,
      primaryCategories: ['contact'],
    });

    const context = JSON.parse(result.knowledgeContext) as Record<string, Record<string, string>>;

    expect(result.addedEntriesCount).toBe(1);
    expect(context.services?.taekwondo_dersi).toContain('Taekwondo');
  });

  it('skips low-signal greeting-only queries', () => {
    const service = new DMKnowledgeRetrievalService(createDb([
      {
        id: '1',
        category: 'faq',
        key_name: 'havuz_sicaklik',
        value: 'Havuz 28-30 derece arasindadir.',
        description: null,
        updated_at: '2026-03-02T00:00:00.000Z',
      },
    ]));

    const result = service.augmentContext({
      baseContextJson: JSON.stringify({
        contact: { phone: '0326 502 58 58' },
      }),
      messageText: 'merhaba',
      followUpHint: null,
      activeTopic: null,
      primaryCategories: ['contact'],
    });

    expect(result.addedEntriesCount).toBe(0);
    expect(result.trace.skippedReason).toBe('low_signal_query');
  });
});
