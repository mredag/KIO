import { describe, expect, it } from 'vitest';
import { buildDMStyleProfile, sanitizeConductResponse } from './DMResponseStyleService.js';

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
    expect(profile.instructions).toContain('En kisa tamamlanmis yaniti ver; emojisiz, selamlamasiz ve mesafeli yaz.');
    expect(profile.instructions).toContain('Takip sorusu sorma');
  });

  it('returns bad-customer style when conduct is at the highest state', () => {
    const profile = buildDMStyleProfile({
      customerMessage: 'adres nedir',
      conversationHistory: [],
      isNewCustomer: false,
      conductState: 'silent',
    });

    expect(profile.mode).toBe('silent');
    expect(profile.trace.emojiPolicy).toBe('none');
    expect(profile.trace.ctaPolicy).toBe('minimal');
    expect(profile.instructions).toContain('bad-customer modunda');
    expect(profile.instructions).toContain('Tek cumle');
  });

  it('removes follow-up prompts and soft ctas from guarded replies', () => {
    const response = [
      'Merhaba, masaj fiyatlarimiz su sekildedir.',
      '• 30dk -> 800 TL',
      '• 60dk -> 1300 TL',
      'Hangi sure ile ilgilendiginizi belirtirseniz daha fazla yardimci olabilirim.',
      'Detayli bilgi icin bizi arayin.',
    ].join('\n');

    const sanitized = sanitizeConductResponse(response, 'final_warning');

    expect(sanitized).toContain('• 30dk -> 800 TL');
    expect(sanitized).toContain('• 60dk -> 1300 TL');
    expect(sanitized).not.toContain('Merhaba');
    expect(sanitized).not.toContain('hangi sure');
    expect(sanitized).not.toContain('bizi arayin');
  });

  it('strips soft greeting and CTA content from bad-customer replies too', () => {
    const response = [
      'Merhaba, adresimiz Haraparasi Mahallesi.',
      'Detayli bilgi icin bizi arayin.',
      'Isterseniz konum da atabiliriz.',
    ].join('\n');

    const sanitized = sanitizeConductResponse(response, 'silent');

    expect(sanitized).toContain('adresimiz Haraparasi Mahallesi');
    expect(sanitized).not.toContain('Merhaba');
    expect(sanitized).not.toContain('bizi arayin');
    expect(sanitized).not.toContain('Isterseniz');
  });
});
