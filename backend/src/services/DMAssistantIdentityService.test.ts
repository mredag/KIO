import { describe, expect, it } from 'vitest';
import { applyAssistantIdentityBehavior } from './DMAssistantIdentityService.js';

describe('DMAssistantIdentityService', () => {
  it('prepends the opening disclosure on the first assistant reply', () => {
    const result = applyAssistantIdentityBehavior({
      customerMessage: 'Masaj fiyatlari nedir?',
      responseText: 'Merhaba! Masaj fiyatlarimiz su sekildedir.',
      conversationHistory: [],
      conductState: 'normal',
    });

    expect(result.text).toBe('Merhaba, ben Eform Spor Merkezi yapay zeka dijital asistanıyım. Masaj fiyatlarimiz su sekildedir.');
    expect(result.trace.applied).toBe(true);
    expect(result.trace.reason).toBe('opening_disclosure');
  });

  it('does not repeat the opening disclosure once the assistant has already replied in the conversation', () => {
    const result = applyAssistantIdentityBehavior({
      customerMessage: 'Saatleriniz nedir?',
      responseText: 'Tesisimiz 08:00-00:00 arasinda aciktir.',
      conversationHistory: [
        {
          direction: 'outbound',
          messageText: 'Merhaba, size nasil yardimci olabilirim?',
        },
      ],
      conductState: 'normal',
    });

    expect(result.text).toBe('Tesisimiz 08:00-00:00 arasinda aciktir.');
    expect(result.trace.applied).toBe(false);
    expect(result.trace.reason).toBeNull();
  });

  it('returns the canonical identity answer for a pure identity question', () => {
    const result = applyAssistantIdentityBehavior({
      customerMessage: 'Sen yapay zeka misin?',
      responseText: 'Evet, yardimci olabilirim.',
      conversationHistory: [
        {
          direction: 'outbound',
          messageText: 'Masaj fiyatlarimiz 800 TL den baslar.',
        },
      ],
      conductState: 'normal',
    });

    expect(result.text).toBe('Ben Eform Spor Merkezi yapay zeka dijital asistanıyım. Tesis ile ilgili fiyat, saat, hizmet ve genel bilgi konularında güncel bilgilerle yardımcı olabilirim.');
    expect(result.trace.reason).toBe('identity_question_override');
  });

  it('prepends the identity disclosure when the user asks identity and a business question together', () => {
    const result = applyAssistantIdentityBehavior({
      customerMessage: 'Sen yapay zeka misin ve adresiniz nerede?',
      responseText: 'Konumumuz Iskenderun / Hatay tarafindadir.',
      conversationHistory: [
        {
          direction: 'outbound',
          messageText: 'Merhaba, size nasil yardimci olabilirim?',
        },
      ],
      conductState: 'normal',
    });

    expect(result.text).toBe('Ben Eform Spor Merkezi yapay zeka dijital asistanıyım. Tesis ile ilgili fiyat, saat, hizmet ve genel bilgi konularında güncel bilgilerle yardımcı olabilirim. Konumumuz Iskenderun / Hatay tarafindadir.');
    expect(result.trace.reason).toBe('identity_question');
  });

  it('keeps silent-mode pure identity answers minimal', () => {
    const result = applyAssistantIdentityBehavior({
      customerMessage: 'Bot musun?',
      responseText: 'Evet.',
      conversationHistory: [],
      conductState: 'silent',
    });

    expect(result.text).toBe('Ben Eform Spor Merkezi yapay zeka dijital asistanıyım.');
    expect(result.trace.reason).toBe('identity_question_override');
  });
});
