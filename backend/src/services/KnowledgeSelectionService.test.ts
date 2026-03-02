import { describe, expect, it } from 'vitest';
import { KnowledgeSelectionService } from './KnowledgeSelectionService.js';

describe('KnowledgeSelectionService', () => {
  const service = new KnowledgeSelectionService([
    {
      category: 'faq',
      key_name: 'havuz_sicaklik',
      value: 'Yuzme havuzumuz yil boyunca 28-30 derece arasinda tutulmaktadir.',
    },
    {
      category: 'policies',
      key_name: 'kese_kopuk_personel',
      value: 'Hamam kese ve kopuk hizmeti kadin spa personelimiz tarafindan yapilir.',
    },
    {
      category: 'hours',
      key_name: 'taekwondo_schedule',
      value: 'Taekwondo: Sali-Persembe 17:00-18:00',
    },
  ]);

  it('adds the most relevant support entry for a pool temperature follow-up', () => {
    const result = service.augmentContext({
      baseContextJson: JSON.stringify({
        general: { greeting: 'Merhaba' },
        contact: { phone: '0326 502 58 58' },
      }),
      messageText: 'kac derece soguk havuz degil degil mi',
      followUpHint: {
        topicLabel: 'havuz isitmasi',
        rewrittenQuestion: 'havuz isitmasi icin kac derece soguk havuz degil degil mi',
        sourceMessage: 'havuz nasil isitmali mi',
      },
      primaryCategories: ['general', 'contact'],
    });

    const context = JSON.parse(result.knowledgeContext) as Record<string, Record<string, string>>;

    expect(result.addedEntriesCount).toBe(1);
    expect(result.addedCategories).toEqual(['faq']);
    expect(context.faq?.havuz_sicaklik).toContain('28-30 derece');
  });

  it('does not add support entries for low-signal generic messages', () => {
    const result = service.augmentContext({
      baseContextJson: JSON.stringify({
        general: { greeting: 'Merhaba' },
      }),
      messageText: 'merhaba',
      followUpHint: null,
      primaryCategories: ['general'],
    });

    expect(result.addedEntriesCount).toBe(0);
    expect(result.addedCategories).toEqual([]);
  });
});
