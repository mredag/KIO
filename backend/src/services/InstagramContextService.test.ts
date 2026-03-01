import { describe, expect, it } from 'vitest';
import { InstagramContextService } from './InstagramContextService.js';
import type { ConversationEntry } from './InstagramContextService.js';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
}

describe('InstagramContextService follow-up pricing context', () => {
  function createHistory(messages: Array<{ text: string; minutesAgo: number }>): ConversationEntry[] {
    return messages.map(message => ({
      direction: 'inbound',
      messageText: message.text,
      createdAt: minutesAgo(message.minutesAgo),
      relativeTime: `${message.minutesAgo} dk once`,
    }));
  }

  it('resolves an ambiguous pricing follow-up to the active topic', () => {
    const service = new InstagramContextService({} as any);
    const result = service.detectIntentWithContext(
      'fiyatlari nedir',
      createHistory([{ text: 'hangi masajlar var', minutesAgo: 2 }]),
    );

    expect(result.categories).toContain('pricing');
    expect(result.categories).toContain('services');
    expect(result.followUpHint).toEqual({
      topicLabel: 'masaj',
      rewrittenQuestion: 'masaj fiyatlari nedir?',
      sourceMessage: 'hangi masajlar var',
    });
  });

  it('uses the most recent specific topic from recent history', () => {
    const service = new InstagramContextService({} as any);
    const result = service.detectIntentWithContext(
      'ucreti nedir',
      createHistory([
        { text: 'hangi masajlar var', minutesAgo: 5 },
        { text: 'reformer pilates var mi', minutesAgo: 1 },
      ]),
    );

    expect(result.followUpHint?.topicLabel).toBe('reformer pilates');
    expect(result.followUpHint?.rewrittenQuestion).toBe('reformer pilates fiyatlari nedir?');
  });

  it('does not add a follow-up hint for already specific pricing questions', () => {
    const service = new InstagramContextService({} as any);
    const result = service.detectIntentWithContext(
      'masaj fiyatlari nedir',
      createHistory([{ text: 'hangi masajlar var', minutesAgo: 2 }]),
    );

    expect(result.followUpHint).toBeNull();
  });
});
