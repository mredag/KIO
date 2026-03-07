import { normalizeTurkish } from './InstagramContextService.js';
import type { ResponseMode } from './InstagramContextService.js';

export const PRICING_CLARIFIER_MODEL_ID = 'deterministic/clarifier-pricing-v1';
export const TOPIC_SELECTION_CLARIFIER_MODEL_ID = 'deterministic/clarifier-topic-menu-v1';

const PRICING_SIGNAL_PATTERNS = [
  'fiyat',
  'ucret',
  'ne kadar',
  'kac para',
  'fiyat list',
  'tarife',
];

function isGenericPricingClarifier(params: {
  intentCategories: string[];
  responseMode?: ResponseMode | null;
  semanticSignals?: string[];
}): boolean {
  if (params.responseMode !== 'clarify_only') {
    return false;
  }

  const intentCategories = new Set(params.intentCategories.map(category => category.toLowerCase()));
  if (!intentCategories.has('pricing') || intentCategories.has('services')) {
    return false;
  }

  const nonClarifierCategories = Array.from(intentCategories)
    .filter(category => !['pricing', 'general', 'faq'].includes(category));
  if (nonClarifierCategories.length > 0) {
    return false;
  }

  const semanticSignals = new Set((params.semanticSignals || []).map(signal => signal.toLowerCase()));
  return !semanticSignals.has('topic_selection_follow_up');
}

function shouldBuildTopicSelectionClarifier(params: {
  intentCategories: string[];
  responseMode?: ResponseMode | null;
  semanticSignals?: string[];
}): boolean {
  if (params.responseMode !== 'clarify_only') {
    return false;
  }

  const intentCategories = new Set(params.intentCategories.map(category => category.toLowerCase()));
  if (!intentCategories.has('services') || intentCategories.size !== 1) {
    return false;
  }

  const semanticSignals = new Set((params.semanticSignals || []).map(signal => signal.toLowerCase()));
  return semanticSignals.has('topic_selection_follow_up');
}

function hasPricingSignal(messageText: string): boolean {
  const normalizedMessage = normalizeTurkish(messageText.toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedMessage) {
    return false;
  }

  return PRICING_SIGNAL_PATTERNS.some(pattern => normalizedMessage.includes(pattern));
}

export function buildDeterministicClarifierResponse(params: {
  messageText: string;
  intentCategories: string[];
  responseMode?: ResponseMode | null;
  semanticSignals?: string[];
}): { response: string; modelId: string } | null {
  if (isGenericPricingClarifier(params) && hasPricingSignal(params.messageText)) {
    return {
      response: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
      modelId: PRICING_CLARIFIER_MODEL_ID,
    };
  }

  if (shouldBuildTopicSelectionClarifier(params)) {
    const topicLabel = params.messageText.trim().replace(/\s+/g, ' ').slice(0, 60) || 'Bu konu';
    return {
      response: `${topicLabel} ile ilgili hangi alt bilgiyi ogrenmek istersiniz? 1. Fiyatlar 2. Detaylar 3. Saatler 4. Randevu.`,
      modelId: TOPIC_SELECTION_CLARIFIER_MODEL_ID,
    };
  }

  return null;
}
