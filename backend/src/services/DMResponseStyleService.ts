import type { FollowUpContextHint } from './InstagramContextService.js';
import type { ConductState } from './SuspiciousUserService.js';

interface ConversationMessageLike {
  direction: 'inbound' | 'outbound';
  messageText: string;
}

export interface DMStyleProfile {
  mode: ConductState;
  instructions: string;
  trace: {
    mode: ConductState;
    greetingPolicy: 'normal' | 'skip_repeat_greeting' | 'minimal';
    emojiPolicy: 'none' | 'optional_single';
    ctaPolicy: 'only_when_needed' | 'minimal';
    antiRepeatSignals: string[];
  };
}

export interface DeterministicConductResponse {
  response: string;
  modelId: string;
}

const CONDUCT_SOFT_CLOSE_PATTERNS = [
  /\byardimci olabilirim\b/,
  /\byardimci olabiliriz\b/,
  /\byardimci olabilir miyim\b/,
  /\bsize nasil yardimci olabilirim\b/,
  /\bbelirtirseniz\b/,
  /\bpaylasirsaniz\b/,
  /\bisterseniz\b/,
  /\bdilerseniz\b/,
  /\bbizi arayin\b/,
  /\barayabilirsiniz\b/,
  /\brandevu icin\b/,
  /\bdetayli bilgi icin\b/,
];

const GREETING_ONLY_PATTERN = /^(merhaba|selam|selamlar|slm|sa|iyi gunler|iyi aksamlar|iyi sabahlar|kolay gelsin)(\s+(merhaba|selam))?$/;
const BUSINESS_QUESTION_PATTERN = /\b(fiyat|ucret|ne kadar|kac|tl|lira|adres|telefon|konum|saat|acik|kapali|masaj|hamam|sauna|havuz|fitness|pilates|reformer|pt|uyelik|kurs|ders|randevu|yas|18|cocuk|ebeveyn|veli|nerede|hangi|neden|nasil)\b/;

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

export function getDeterministicConductResponse(params: {
  conductState?: ConductState;
  customerMessage: string;
  matchedKeywords?: string[];
  intentCategories?: string[];
}): DeterministicConductResponse | null {
  if (params.conductState !== 'silent') {
    return null;
  }

  const normalizedMessage = normalizeText(params.customerMessage);
  if (!normalizedMessage) {
    return null;
  }

  const matchedKeywords = params.matchedKeywords || [];
  const intentCategories = params.intentCategories || [];
  const hasGreetingSignal = matchedKeywords.includes('greeting') || GREETING_ONLY_PATTERN.test(normalizedMessage);
  const isGeneralOnly = intentCategories.length === 0 || intentCategories.every(category => category === 'general');

  if (!hasGreetingSignal || !isGeneralOnly) {
    return null;
  }

  if (BUSINESS_QUESTION_PATTERN.test(normalizedMessage)) {
    return null;
  }

  if (!GREETING_ONLY_PATTERN.test(normalizedMessage) && normalizedMessage.split(' ').length > 4) {
    return null;
  }

  return {
    response: 'Buyurun.',
    modelId: 'deterministic/bad-customer-greeting-v1',
  };
}

function includesRepeatGreeting(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes('size nasil yardimci olabilirim')
    || normalized.startsWith('kolay gelsin')
    || normalized.startsWith('merhaba')
    || normalized.startsWith('selam');
}

function includesPhoneCta(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes('0326 502 58 58')
    || normalized.includes('bizi arayin')
    || normalized.includes('arayabilirsiniz');
}

function shouldDropConductSegment(normalizedSegment: string): boolean {
  if (!normalizedSegment) {
    return true;
  }

  if (normalizedSegment.startsWith('merhaba') || normalizedSegment.startsWith('selam')) {
    return true;
  }

  if (normalizedSegment.startsWith('kolay gelsin')) {
    return true;
  }

  if (normalizedSegment.startsWith('hangi ')) {
    return true;
  }

  return CONDUCT_SOFT_CLOSE_PATTERNS.some(pattern => pattern.test(normalizedSegment));
}

function stripGreetingPrefix(segment: string): string {
  return segment
    .replace(/^\s*(merhaba|selam|kolay gelsin)\b[\s,:;.!-]*/i, '')
    .trim();
}

function sanitizeSegmentForConduct(segment: string): string {
  const strippedGreeting = stripGreetingPrefix(segment.trim());
  const normalized = normalizeText(strippedGreeting);

  if (shouldDropConductSegment(normalized)) {
    return '';
  }

  return strippedGreeting;
}

function sanitizeLineForConduct(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  const segments = trimmed
    .split(/(?<=[.!?])\s+/)
    .map(segment => segment.trim())
    .filter(Boolean);

  const keptSegments = segments
    .map(segment => sanitizeSegmentForConduct(segment))
    .filter(Boolean);

  if (keptSegments.length === 0) {
    return '';
  }

  return keptSegments.join(' ').trim();
}

export function sanitizeConductResponse(
  response: string,
  conductState?: ConductState,
): string {
  if (!response || (conductState !== 'guarded' && conductState !== 'final_warning' && conductState !== 'silent')) {
    return response;
  }

  const sanitized = response
    .replace(/\r/g, '')
    .split('\n')
    .map(line => sanitizeLineForConduct(line))
    .filter(Boolean)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  if (sanitized) {
    return sanitized;
  }

  if (conductState === 'silent') {
    return 'Buyurun.';
  }

  return response.trim();
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

  const conductMode = params.conductState === 'final_warning' || params.conductState === 'guarded' || params.conductState === 'silent'
    ? params.conductState
    : 'normal';

  if (conductMode === 'silent') {
    return {
      mode: 'silent',
      instructions: [
        'YANIT STILI:',
        '- Bu musteri bad-customer modunda; yalnizca cekirdek is bilgisini ver.',
        '- Tek cumle veya mumkun olan en kisa tamamlanmis cevap yaz.',
        '- Selamlama, emoji, takip sorusu, tesekkur, sicak kapanis, ek yardim veya telefon CTA ekleme.',
        '- Gerekirse sadece fiyat, saat, adres veya hizmet adini soyle; aciklama ve sohbet acma yok.',
      ].join('\n'),
      trace: {
        mode: 'silent',
        greetingPolicy: 'minimal',
        emojiPolicy: 'none',
        ctaPolicy: 'minimal',
        antiRepeatSignals,
      },
    };
  }

  if (conductMode === 'final_warning') {
    return {
      mode: 'final_warning',
      instructions: [
        'YANIT STILI:',
        '- Kisa, net ve profesyonel yaz; emojisiz ve gereksiz sohbet olmadan cevap ver.',
        '- Takip sorusu sorma, sohbet acma, tesekkur veya sicak kapanis ekleme.',
        '- Telefon, randevu veya ek yardim cagrisi ekleme; musteri acikca istemediyse yonlendirme yapma.',
        '- Eger mesru bir fiyat/saat/adres bilgisi verilecekse onu dogrudan ve dogru sekilde ver; gereksiz yumusatma ekleme.',
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
        '- Kisa, net ve profesyonel yaz.',
        '- Uzun acilis, gereksiz emoji, tesekkur veya davetkar kapanis kullanma.',
        '- Sadece gereken bilgiyi ver; fakat mesru soruyu normal bicimde cevaplamaya devam et.',
        '- Takip sorusu ve telefon/iletisim yonlendirmesi sadece cevap icin gercekten gerekliyse kullan.',
      ].join('\n'),
      trace: {
        mode: 'guarded',
        greetingPolicy: 'minimal',
        emojiPolicy: 'none',
        ctaPolicy: 'only_when_needed',
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
