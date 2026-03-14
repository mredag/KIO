import type { ConductState } from './SuspiciousUserService.js';

interface ConversationMessageLike {
  direction: 'inbound' | 'outbound';
  messageText: string;
}

export interface AssistantIdentityTrace {
  applied: boolean;
  reason: 'opening_disclosure' | 'identity_question' | 'identity_question_override' | null;
  firstReplyInConversation: boolean;
  identityQuestion: boolean;
}

export interface AssistantIdentityResult {
  text: string;
  trace: AssistantIdentityTrace;
}

const OPENING_DISCLOSURE = 'Merhaba, ben Eform Spor Merkezi yapay zeka dijital asistanıyım.';
const IDENTITY_DISCLOSURE = 'Ben Eform Spor Merkezi yapay zeka dijital asistanıyım. Tesis ile ilgili fiyat, saat, hizmet ve genel bilgi konularında güncel bilgilerle yardımcı olabilirim.';
const SHORT_IDENTITY_DISCLOSURE = 'Ben Eform Spor Merkezi yapay zeka dijital asistanıyım.';

const IDENTITY_PATTERNS = [
  /\byapay zeka\b/,
  /\bdijital asistan\b/,
  /\bbot\b/,
  /\basistan misin\b/,
  /\bgercek (kisi|insan)\b/,
  /\binsan misin\b/,
  /\b(benimle kim konusuyor|kimsin|siz kimsiniz|sen kimsin)\b/,
  /\botomatik (mesaj|cevap)\b/,
  /\bai misin\b/,
];

const BUSINESS_SIGNAL_PATTERN = /\b(fiyat\w*|ucret\w*|ne kadar|kac|tl|lira|saat\w*|acik|kapali|adres\w*|konum\w*|telefon\w*|randevu\w*|masaj\w*|fitness\w*|uyelik\w*|pilates\w*|reformer\w*|pt\b|kurs\w*|ders\w*|hamam\w*|sauna\w*|havuz\w*|spa\b|yuzme\w*|tedavi\w*|kese\w*|kopuk\w*)\b/;
const GREETING_PREFIX_PATTERN = /^\s*(merhaba|selam(?:lar)?|iyi gunler|iyi aksamlar|iyi sabahlar|kolay gelsin)\b[\s,:;.!-]*/i;

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

function alreadyDisclosesIdentity(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes('eform spor merkezi yapay zeka dijital asistani')
    || normalized.includes('eform spor merkezi yapay zeka asistani')
    || normalized.includes('ben eform spor merkezi yapay zeka dijital asistaniyim');
}

function isIdentityQuestion(messageText: string): boolean {
  const normalized = normalizeText(messageText);
  if (!normalized) {
    return false;
  }

  return IDENTITY_PATTERNS.some(pattern => pattern.test(normalized));
}

function isFirstReplyInConversation(conversationHistory: ConversationMessageLike[]): boolean {
  return !conversationHistory.some(entry => entry.direction === 'outbound' && entry.messageText.trim().length > 0);
}

function stripGreetingPrefix(responseText: string): string {
  return responseText.replace(GREETING_PREFIX_PATTERN, '').trim();
}

function capitalizeFirstLetter(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLocaleUpperCase('tr-TR') + value.slice(1);
}

function mergeDisclosure(disclosure: string, responseText: string): string {
  const stripped = capitalizeFirstLetter(stripGreetingPrefix(responseText));
  if (!stripped) {
    return disclosure;
  }

  return `${disclosure} ${stripped}`.trim();
}

export function applyAssistantIdentityBehavior(params: {
  customerMessage: string;
  responseText: string;
  conversationHistory: ConversationMessageLike[];
  conductState?: ConductState;
}): AssistantIdentityResult {
  const responseText = params.responseText.trim();
  const firstReplyInConversation = isFirstReplyInConversation(params.conversationHistory);
  const identityQuestion = isIdentityQuestion(params.customerMessage);

  const baseTrace: AssistantIdentityTrace = {
    applied: false,
    reason: null,
    firstReplyInConversation,
    identityQuestion,
  };

  if (!responseText || alreadyDisclosesIdentity(responseText)) {
    return {
      text: responseText,
      trace: baseTrace,
    };
  }

  const normalizedMessage = normalizeText(params.customerMessage);
  const hasBusinessSignal = BUSINESS_SIGNAL_PATTERN.test(normalizedMessage);

  if (identityQuestion) {
    if (params.conductState === 'silent' && !hasBusinessSignal) {
      return {
        text: SHORT_IDENTITY_DISCLOSURE,
        trace: {
          ...baseTrace,
          applied: true,
          reason: 'identity_question_override',
        },
      };
    }

    if (!hasBusinessSignal) {
      return {
        text: IDENTITY_DISCLOSURE,
        trace: {
          ...baseTrace,
          applied: true,
          reason: 'identity_question_override',
        },
      };
    }

    return {
      text: mergeDisclosure(IDENTITY_DISCLOSURE, responseText),
      trace: {
        ...baseTrace,
        applied: true,
        reason: 'identity_question',
      },
    };
  }

  if (firstReplyInConversation && params.conductState !== 'silent') {
    return {
      text: mergeDisclosure(OPENING_DISCLOSURE, responseText),
      trace: {
        ...baseTrace,
        applied: true,
        reason: 'opening_disclosure',
      },
    };
  }

  return {
    text: responseText,
    trace: baseTrace,
  };
}
