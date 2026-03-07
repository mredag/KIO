import type { FollowUpContextHint } from './InstagramContextService.js';
import type { ConductState } from './SuspiciousUserService.js';

interface ConversationMessageLike {
  direction: 'inbound' | 'outbound';
  messageText: string;
}

export interface DMStyleProfile {
  mode: Exclude<ConductState, 'silent'>;
  instructions: string;
  trace: {
    mode: Exclude<ConductState, 'silent'>;
    greetingPolicy: 'normal' | 'skip_repeat_greeting' | 'minimal';
    emojiPolicy: 'none' | 'optional_single';
    ctaPolicy: 'only_when_needed' | 'minimal';
    antiRepeatSignals: string[];
  };
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/\u00e7/g, 'c')
    .replace(/\u011f/g, 'g')
    .replace(/\u0131/g, 'i')
    .replace(/\u00f6/g, 'o')
    .replace(/\u015f/g, 's')
    .replace(/\u00fc/g, 'u')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value);
}

function isSimpleFactRequest(normalizedMessage: string): boolean {
  return /\b(fiyat|ucret|ne kadar|kac|tl|lira|saat|acik|kapali|adres|telefon|konum|yas|18|cocuk|ebeveyn|veli|hangi saat|nerede)\b/.test(normalizedMessage);
}

function includesRepeatGreeting(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes('size nasil yardimci olabilirim')
    || normalized.startsWith('merhaba')
    || normalized.startsWith('selam');
}

function includesPhoneCta(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes('0326 502 58 58')
    || normalized.includes('bizi arayin')
    || normalized.includes('arayabilirsiniz');
}

export function buildDMStyleProfile(params: {
  customerMessage: string;
  conversationHistory: ConversationMessageLike[];
  isNewCustomer: boolean;
  followUpHint?: FollowUpContextHint | null;
  conductState?: ConductState;
}): DMStyleProfile {
  const normalizedMessage = normalizeText(params.customerMessage);
  const recentAssistantMessages = params.conversationHistory
    .filter(entry => entry.direction === 'outbound')
    .slice(-3)
    .map(entry => entry.messageText);

  const antiRepeatSignals: string[] = [];
  const repeatedGreeting = recentAssistantMessages.some(includesRepeatGreeting);
  const repeatedPhoneCta = recentAssistantMessages.some(includesPhoneCta);
  const repeatedEmoji = recentAssistantMessages.some(hasEmoji);
  const followUpConversation = !!params.followUpHint || !params.isNewCustomer;
  const simpleFactRequest = isSimpleFactRequest(normalizedMessage);

  if (repeatedGreeting || followUpConversation) {
    antiRepeatSignals.push('repeat_greeting');
  }
  if (repeatedPhoneCta) {
    antiRepeatSignals.push('repeat_phone_cta');
  }
  if (repeatedEmoji) {
    antiRepeatSignals.push('repeat_emoji');
  }
  if (simpleFactRequest) {
    antiRepeatSignals.push('simple_fact_request');
  }

  const conductMode = params.conductState === 'final_warning' || params.conductState === 'guarded'
    ? params.conductState
    : 'normal';

  if (conductMode === 'final_warning') {
    return {
      mode: 'final_warning',
      instructions: [
        'YANIT STILI:',
        '- Tek cumlelik, net, resmi ve emojisiz yaz.',
        '- Nezaketi koru ama sicak davranma; ek soru sorma.',
        '- Yalnizca gerekli siniri veya gerekli bilgiyi ver, baska aciklama ekleme.',
      ].join('\n'),
      trace: {
        mode: 'final_warning',
        greetingPolicy: 'minimal',
        emojiPolicy: 'none',
        ctaPolicy: 'minimal',
        antiRepeatSignals,
      },
    };
  }

  if (conductMode === 'guarded') {
    return {
      mode: 'guarded',
      instructions: [
        'YANIT STILI:',
        '- Kisa, mesafeli ve emojisiz yaz.',
        '- Gereksiz nezaket, uzun acilis veya kapanis kullanma.',
        '- Sadece gereken bilgiyi ver; takip sorusu sorma.',
      ].join('\n'),
      trace: {
        mode: 'guarded',
        greetingPolicy: 'minimal',
        emojiPolicy: 'none',
        ctaPolicy: 'minimal',
        antiRepeatSignals,
      },
    };
  }

  const lines = [
    'YANIT STILI:',
    '- Dogal ve insani yaz; ayni acilisi, ayni emojiyi ve ayni kapanis cumlesini arka arkaya tekrarlama.',
  ];

  if (repeatedGreeting || followUpConversation) {
    lines.push('- Bu bir takip konusmasi; yeniden uzun selamlama yapma ve "Size nasil yardimci olabilirim?" diye sorma.');
  } else {
    lines.push('- Gerekirse kisa bir selamlama kullan, ama ilk cumleyi uzatma.');
  }

  if (simpleFactRequest) {
    lines.push('- Bu mesaj bilgi odakli; dogrudan cevaba gir, gereksiz sicaklik veya sohbet acilisi ekleme.');
  }

  if (repeatedPhoneCta) {
    lines.push('- Telefon numarasini sadece bilgi eksikse, randevu/iletisim gerekiyor ise veya musteri bunu istiyorsa ekle.');
  } else {
    lines.push('- Telefon yonlendirmesini aliskanliktan ekleme; sadece gerekli oldugunda kullan.');
  }

  if (repeatedEmoji || simpleFactRequest) {
    lines.push('- Bu mesajda emoji kullanma.');
  } else {
    lines.push('- Emoji zorunlu degil; dogal gorunuyorsa en fazla 1 emoji kullan.');
  }

  return {
    mode: 'normal',
    instructions: lines.join('\n'),
    trace: {
      mode: 'normal',
      greetingPolicy: repeatedGreeting || followUpConversation ? 'skip_repeat_greeting' : 'normal',
      emojiPolicy: repeatedEmoji || simpleFactRequest ? 'none' : 'optional_single',
      ctaPolicy: repeatedPhoneCta ? 'only_when_needed' : 'only_when_needed',
      antiRepeatSignals,
    },
  };
}
