import { describe, expect, it } from 'vitest';
import { buildDMStyleProfile } from './DMResponseStyleService.js';

describe('DMResponseStyleService', () => {
  it('suppresses repeat greeting and emoji on simple factual follow-ups', () => {
    const profile = buildDMStyleProfile({
      customerMessage: 'fiyat nedir',
      conversationHistory: [
        { direction: 'outbound', messageText: 'Merhaba! Size nasil yardimci olabilirim? 😊' },
      ],
      isNewCustomer: false,
      followUpHint: {
        topicLabel: 'masaj',
        rewrittenQuestion: 'masaj fiyatlari nedir',
        sourceMessage: 'fiyat nedir',
      },
      conductState: 'normal',
    });

    expect(profile.mode).toBe('normal');
    expect(profile.trace.greetingPolicy).toBe('skip_repeat_greeting');
    expect(profile.trace.emojiPolicy).toBe('none');
    expect(profile.trace.antiRepeatSignals).toContain('repeat_greeting');
    expect(profile.trace.antiRepeatSignals).toContain('simple_fact_request');
  });

  it('returns guarded style for suspicious conversations', () => {
    const profile = buildDMStyleProfile({
      customerMessage: 'peki',
      conversationHistory: [],
      isNewCustomer: false,
      conductState: 'guarded',
    });

    expect(profile.mode).toBe('guarded');
    expect(profile.trace.emojiPolicy).toBe('none');
    expect(profile.trace.ctaPolicy).toBe('minimal');
    expect(profile.instructions).toContain('Kisa, mesafeli ve emojisiz yaz.');
  });

  it('returns final warning style when conduct requires it', () => {
    const profile = buildDMStyleProfile({
      customerMessage: 'tamam',
      conversationHistory: [],
      isNewCustomer: false,
      conductState: 'final_warning',
    });

    expect(profile.mode).toBe('final_warning');
    expect(profile.trace.greetingPolicy).toBe('minimal');
    expect(profile.instructions).toContain('Tek cumlelik, net, resmi ve emojisiz yaz.');
  });
});
