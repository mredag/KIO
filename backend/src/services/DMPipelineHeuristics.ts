import { KEYWORD_CATEGORY_MAP, MASSAGE_DETAIL_KEYWORDS, normalizeTurkish } from './DMIntentShared.js';
import type { ConversationEntry, ResponseMode } from './InstagramContextService.js';
import { buildDeterministicCloseoutTemplate } from './GenericInfoTemplateService.js';

export const PRICING_CLARIFIER_MODEL_ID = 'deterministic/clarifier-pricing-v1';
export const TOPIC_SELECTION_CLARIFIER_MODEL_ID = 'deterministic/clarifier-topic-menu-v1';
export const APPOINTMENT_MODEL_ID = 'deterministic/appointment-booking-v1';
export const HOURS_APPOINTMENT_MODEL_ID = 'deterministic/hours-appointment-v1';
export const PILATES_INFO_MODEL_ID = 'deterministic/pilates-info-v1';
export const MASSAGE_PRICING_MODEL_ID = 'deterministic/massage-pricing-v1';
export const CLOSEOUT_MODEL_ID = 'deterministic/closeout-v1';
export const NO_REPLY_MODEL_ID = 'deterministic/no-reply-v1';
export const CLARIFY_EXHAUSTED_CONTACT_MODEL_ID = 'deterministic/clarify-exhausted-contact-v1';
export const CAMPAIGN_INFO_MODEL_ID = 'deterministic/campaign-info-v1';

export interface DeterministicCloseoutDecision {
  action: 'reply' | 'skip_send';
  response: string | null;
  modelId: string;
}

export interface ClarifyExhaustedContactDecision {
  response: string;
  modelId: string;
  clarificationCount: number;
}

const CONTACT_FALLBACK_ESCAPE_SIGNALS = new Set([
  'campaign_inquiry',
  'group_discount_inquiry',
]);

const PRICING_SIGNAL_PATTERNS = [
  'fiyat',
  'ucret',
  'ne kadar',
  'kac para',
  'fiyat list',
  'tarife',
];
const POLITE_LEAD_IN_PATTERN = /^(?:tesekkur(?:ler)?|sag ?ol(?:un)?|saol|eyvallah|tamam(?:dir)?|peki|ok(?:ay)?|anladim|olur|rica ederim)\b\s*/;
const SPECIFIC_TOPIC_ANCHOR_PATTERN = /\b(?:masaj|klasik|medikal|mix|hamam|sauna|havuz|fitness|pilates|reformer|pt|kurs|ders|uyelik|adres|telefon|konum|saat|acik|kapali|randevu)\b/;
const GENERIC_INFO_DIMENSION_PATTERN = /\b(?:fiyat|ucret|tl|lira|ne kadar|kac|adres|telefon|konum|saat|acik|kapali|randevu)\b/;
const GENERIC_INFO_ALLOWED_CATEGORIES = new Set(['general', 'faq', 'services']);
const GENERIC_INFO_GENERIC_SERVICE_KEYWORDS = new Set(['spa', 'hizmet', 'servis']);
const DETERMINISTIC_PRICING_ALLOWED_CATEGORIES = new Set(['pricing', 'services', 'general', 'faq']);
const GENERIC_MASSAGE_CONTEXT_KEYWORDS = new Set(['masaj', 'massage', 'spa']);
const MASSAGE_PRICING_DURATION_PATTERN = /\b(?:\d+\s*(?:dk|dakika)|uzun\s*sure(?:li)?|kisa\s*sure(?:li)?|sure|sureli|dakika|dk|seans|saat)\b/;
const MASSAGE_PRICING_BLOCKING_DIMENSION_PATTERN = /\b(?:adres|telefon|numara|iletisim|whatsapp|konum|nerede|neredesiniz|neresindesiniz|randevu|rezervasyon|kampanya|indirim|yas|cocuk|ebeveyn|veli)\b/;
const VAGUE_CLARIFICATION_FOLLOW_UP_PATTERN = /\b(?:bu|bunu|bundan|bunda|bu hizmet|bu paket|bu seans|o|onu|ondan|onda|o hizmet|istiyorum|istedigim|istedigimi|yani|bundaki|ondaki)\b/;
const CLARIFICATION_REPLY_PATTERNS = [
  /\bhangi\b.*\bbelirtir misiniz\b/,
  /\bhangi\b.*\bogrenmek istersiniz\b/,
  /\bmesajinizi daha acik yazar misiniz\b/,
  /\bneyi kastettiginizi\b/,
  /\bne hakkinda konustugunuzu belirtir misiniz\b/,
  /\bhangi konuda bilgi almak istediginizi belirtirseniz\b/,
  /\bhangi alt bilgiyi ogrenmek istersiniz\b/,
];
const CAMPAIGN_OR_GROUP_FOLLOW_UP_PATTERN = /\b(?:kampanya|indirim|promosyon|firsat|grup|toplu|ucretsiz|bedava|hediye)\b/;
const CAMPAIGN_INFO_UNAVAILABLE_MESSAGE = 'Su anda paylasabilecegim net bir kampanya bilgisi goremiyorum.';
const SPECIFIC_SERVICE_KEYWORDS = new Set(
  (KEYWORD_CATEGORY_MAP.services || [])
    .map(keyword => normalizeTemplateText(keyword))
    .filter(keyword => keyword && !GENERIC_INFO_GENERIC_SERVICE_KEYWORDS.has(keyword)),
);
const MASSAGE_PRICING_DETAIL_KEYWORDS = new Set(
  [...(KEYWORD_CATEGORY_MAP.services || []), ...MASSAGE_DETAIL_KEYWORDS]
    .map(keyword => normalizeTemplateText(keyword))
    .filter(keyword => keyword && !GENERIC_MASSAGE_CONTEXT_KEYWORDS.has(keyword) && !GENERIC_INFO_GENERIC_SERVICE_KEYWORDS.has(keyword)),
);

export interface GenericInfoRequestParams {
  messageText: string;
  intentCategories?: string[];
  semanticSignals?: string[];
}

export type DeterministicPricingTopic = 'massage';

export interface DeterministicPricingTopicParams extends GenericInfoRequestParams {}

function stripPoliteLeadIn(normalized: string): string {
  let stripped = normalized.trim();
  while (POLITE_LEAD_IN_PATTERN.test(stripped)) {
    stripped = stripped.replace(POLITE_LEAD_IN_PATTERN, '').trim();
  }
  return stripped;
}

function isStandaloneAcknowledgementMessage(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  if (!normalized) {
    return false;
  }

  const stripped = stripPoliteLeadIn(normalized);
  if (/^(?:ilginize|bilginize)$/.test(normalized)) {
    return true;
  }

  return /^(?:gelecegim|gelicem|ugrayacagim|ugrayacam|arayacagim|arayicam|geri donecegim|donus yapacagim|haber verecegim)$/.test(stripped);
}

function isGenericPricingClarifier(params: {
  intentCategories: string[];
  responseMode?: ResponseMode | null;
  semanticSignals?: string[];
}): boolean {
  if (!params.responseMode || !['clarify_only', 'answer_then_clarify'].includes(params.responseMode)) {
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
  const normalizedMessage = normalizeTemplateText(messageText);

  if (!normalizedMessage) {
    return false;
  }

  return PRICING_SIGNAL_PATTERNS.some(pattern => normalizedMessage.includes(pattern));
}

export function normalizeTemplateText(text: string): string {
  return normalizeTurkish(text.toLocaleLowerCase('tr-TR'))
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSpecificServiceTopicSignal(normalizedMessage: string, semanticSignals: string[]): boolean {
  const normalizedSignals = new Set(
    semanticSignals
      .map(signal => normalizeTemplateText(signal))
      .filter(Boolean),
  );

  if (Array.from(normalizedSignals).some(signal => SPECIFIC_SERVICE_KEYWORDS.has(signal))) {
    return true;
  }

  return Array.from(SPECIFIC_SERVICE_KEYWORDS).some(keyword => {
    const pattern = new RegExp(`\\b${escapePattern(keyword)}\\b`);
    return pattern.test(normalizedMessage);
  });
}

function hasDetailedMassagePricingSignal(normalizedMessage: string, semanticSignals: string[]): boolean {
  const normalizedSignals = new Set(
    semanticSignals
      .map(signal => normalizeTemplateText(signal))
      .filter(Boolean),
  );

  if (Array.from(normalizedSignals).some(signal => MASSAGE_PRICING_DETAIL_KEYWORDS.has(signal))) {
    return true;
  }

  return Array.from(MASSAGE_PRICING_DETAIL_KEYWORDS).some(keyword => {
    const pattern = new RegExp(`\\b${escapePattern(keyword)}\\b`);
    return pattern.test(normalizedMessage);
  });
}

export function isGenericInfoRequest(input: string | GenericInfoRequestParams): boolean {
  const params = typeof input === 'string'
    ? { messageText: input }
    : input;
  const messageText = params.messageText;
  const normalized = normalizeTemplateText(messageText);
  if (!normalized) {
    return false;
  }

  const hasInfoIntent = /\b(bilgi|detay)\b/.test(normalized)
    || /\bbilgi\s+(al|ver)/.test(normalized);
  if (!hasInfoIntent) {
    return false;
  }

  const intentCategories = new Set((params.intentCategories || []).map(category => category.toLowerCase()));
  const hasDisallowedIntentCategory = Array.from(intentCategories)
    .some(category => !GENERIC_INFO_ALLOWED_CATEGORIES.has(category));
  if (hasDisallowedIntentCategory) {
    return false;
  }

  if (GENERIC_INFO_DIMENSION_PATTERN.test(normalized)) {
    return false;
  }

  if (hasSpecificServiceTopicSignal(normalized, params.semanticSignals || [])) {
    return false;
  }

  return true;
}

export function detectDeterministicPricingTopic(
  input: string | DeterministicPricingTopicParams,
): DeterministicPricingTopic | null {
  const params = typeof input === 'string'
    ? { messageText: input }
    : input;
  const normalized = normalizeTemplateText(params.messageText);
  if (!normalized || !hasPricingSignal(params.messageText)) {
    return null;
  }

  const intentCategories = new Set((params.intentCategories || []).map(category => category.toLowerCase()));
  const hasDisallowedIntentCategory = Array.from(intentCategories)
    .some(category => !DETERMINISTIC_PRICING_ALLOWED_CATEGORIES.has(category));
  if (hasDisallowedIntentCategory) {
    return null;
  }

  if (MASSAGE_PRICING_BLOCKING_DIMENSION_PATTERN.test(normalized)) {
    return null;
  }

  const hasGenericMassageContext = Array.from(GENERIC_MASSAGE_CONTEXT_KEYWORDS).some(keyword => {
    const pattern = new RegExp(`\\b${escapePattern(keyword)}\\b`);
    return pattern.test(normalized);
  });
  if (!hasGenericMassageContext) {
    return null;
  }

  if (MASSAGE_PRICING_DURATION_PATTERN.test(normalized)) {
    return null;
  }

  if (hasDetailedMassagePricingSignal(normalized, params.semanticSignals || [])) {
    return null;
  }

  return 'massage';
}

export function isGenericMassagePricingRequest(
  input: string | DeterministicPricingTopicParams,
): boolean {
  return detectDeterministicPricingTopic(input) === 'massage';
}

export function isStandaloneCloseoutMessage(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  if (!normalized) {
    return false;
  }

  if (isStandaloneAcknowledgementMessage(messageText)) {
    return true;
  }

  const closeoutPatterns = [
    /^(tesekkur(?:ler)?)$/,
    /^(sag ?ol(?:un)?)$/,
    /^(saol)$/,
    /^(eyvallah)$/,
    /^(rica ederim)$/,
    /^(anladim)$/,
    /^(tamam(?:dir)?)$/,
    /^(peki)$/,
    /^(olur)$/,
    /^(ok(?:ay)?)$/,
    /^(baska sorum yok)$/,
    /^(baska bir sorum yok)$/,
    /^(anladim tesekkur(?:ler)?)$/,
    /^(tamam tesekkur(?:ler)?)$/,
    /^(yok tesekkur(?:ler)?)$/,
    /^(gerek yok tesekkur(?:ler)?)$/,
    /^(sorun degil)$/,
    /^(problem degil)$/,
    /^(bir sey degil)$/,
    /^(?:size|siz)\s?de$/,
    /^(?:size|siz)\s?de iyi gunler$/,
    /^(?:size|siz)\s?de tesekkur(?:ler)?$/,
  ];

  return closeoutPatterns.some(pattern => pattern.test(normalized));
}

function shouldSuppressCloseoutReply(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  if (!normalized) {
    return false;
  }

  if (isStandaloneAcknowledgementMessage(messageText)) {
    return true;
  }

  return [
    /^(anladim)$/,
    /^(tamam(?:dir)?)$/,
    /^(peki)$/,
    /^(olur)$/,
    /^(ok(?:ay)?)$/,
    /^(baska sorum yok)$/,
    /^(baska bir sorum yok)$/,
    /^(anladim tesekkur(?:ler)?)$/,
    /^(tamam tesekkur(?:ler)?)$/,
    /^(yok tesekkur(?:ler)?)$/,
    /^(gerek yok tesekkur(?:ler)?)$/,
    /^(sorun degil)$/,
    /^(problem degil)$/,
    /^(bir sey degil)$/,
    /^(?:size|siz)\s?de$/,
    /^(?:size|siz)\s?de iyi gunler$/,
    /^(?:size|siz)\s?de tesekkur(?:ler)?$/,
  ].some(pattern => pattern.test(normalized));
}

export function isDirectLocationQuestion(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  return /\b(adres|konum|nerede|neredesiniz|neresindesiniz|ulasim|yol tarifi|harita|maps)\b/.test(normalized);
}

export function isDirectPhoneQuestion(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  return /\b(telefon|numara|iletisim|whatsapp|arayabilir miyim|telefon numaraniz)\b/.test(normalized);
}

export function isPilatesInfoRequest(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  if (!normalized || !/\b(?:pilates|reformer)\b/.test(normalized)) {
    return false;
  }

  if (/\b(?:fiyat|ucret|ne kadar|kac|tl|lira|adres|konum|telefon|numara|iletisim|whatsapp|saat|acik|kapali|randevu|rezervasyon|kampanya|indirim)\b/.test(normalized)) {
    return false;
  }

  return /^(?:pilates|reformer|reformer pilates)$/.test(normalized)
    || /\b(?:pilates|reformer)\b.*\b(?:var mi|nedir|nasil|bilgi|detay|detaylar)\b/.test(normalized)
    || /\b(?:bilgi|detay)\b.*\b(?:pilates|reformer)\b/.test(normalized);
}

export function hasAppointmentIntentSignal(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  return /\b(randevu|rezervasyon|rezerv)\b/.test(normalized);
}

export function isCampaignInfoRequest(params: {
  messageText: string;
  semanticSignals?: string[];
}): boolean {
  const normalizedMessage = normalizeTemplateText(params.messageText || '');
  const semanticSignals = new Set((params.semanticSignals || []).map(signal => signal.toLowerCase()));

  return CAMPAIGN_OR_GROUP_FOLLOW_UP_PATTERN.test(normalizedMessage)
    || semanticSignals.has('campaign_inquiry')
    || semanticSignals.has('group_discount_inquiry');
}

export function buildDeterministicCampaignResponse(params: {
  messageText: string;
  semanticSignals?: string[];
  campaignTemplate?: string | null;
}): { response: string; modelId: string } | null {
  if (!isCampaignInfoRequest({
    messageText: params.messageText,
    semanticSignals: params.semanticSignals,
  })) {
    return null;
  }

  return {
    response: String(params.campaignTemplate || '').trim() || CAMPAIGN_INFO_UNAVAILABLE_MESSAGE,
    modelId: CAMPAIGN_INFO_MODEL_ID,
  };
}

export function isStandaloneAppointmentRequest(messageText: string): boolean {
  const normalized = normalizeTemplateText(messageText);
  if (!normalized) {
    return false;
  }

  const stripped = stripPoliteLeadIn(normalized);
  if (!hasAppointmentIntentSignal(stripped)) {
    return false;
  }

  const tokenCount = stripped.split(/\s+/).filter(Boolean).length;
  if (tokenCount > 8) {
    return false;
  }

  if (/\b(?:masaj|hamam|sauna|fitness|pilates|reformer|pt|kurs|ders|uyelik|medikal|klasik|mix|havuz|yuzme)\b/.test(stripped)) {
    return false;
  }

  if (/\b(?:saat|kacta|kaca|bugun|yarin|aksam|sabah|ogle|gece|uygun|musait)\b/.test(stripped) || /\b\d{1,2}(?::|\.)\d{2}\b/.test(stripped)) {
    return false;
  }

  return true;
}

export function buildDeterministicCloseoutResponse(messageText: string): DeterministicCloseoutDecision | null {
  if (!isStandaloneCloseoutMessage(messageText)) {
    return null;
  }

  if (shouldSuppressCloseoutReply(messageText)) {
    return {
      action: 'skip_send',
      response: null,
      modelId: NO_REPLY_MODEL_ID,
    };
  }

  return {
    action: 'reply',
    response: buildDeterministicCloseoutTemplate(),
    modelId: CLOSEOUT_MODEL_ID,
  };
}

export function countRecentClarificationReplies(conversationHistory: ConversationEntry[]): number {
  return conversationHistory
    .slice(-6)
    .filter(entry => entry.direction === 'outbound')
    .reduce((count, entry) => {
      const normalized = normalizeTemplateText(entry.messageText || '');
      if (!normalized) {
        return count;
      }
      return CLARIFICATION_REPLY_PATTERNS.some(pattern => pattern.test(normalized))
        ? count + 1
        : count;
    }, 0);
}

export function buildClarifyExhaustedContactResponse(params: {
  messageText?: string;
  conversationHistory: ConversationEntry[];
  responseMode?: ResponseMode | null;
  fallbackMessage?: string | null;
  semanticSignals?: string[];
}): ClarifyExhaustedContactDecision | null {
  if (!params.responseMode || !['clarify_only', 'answer_then_clarify'].includes(params.responseMode)) {
    return null;
  }

  const fallbackMessage = String(params.fallbackMessage || '').trim();
  if (!fallbackMessage) {
    return null;
  }

  const clarificationCount = countRecentClarificationReplies(params.conversationHistory);
  if (clarificationCount < 1) {
    return null;
  }

  const normalizedMessage = normalizeTemplateText(params.messageText || '');
  const semanticSignals = new Set((params.semanticSignals || []).map(signal => signal.toLowerCase()));
  const shouldBypassContactFallback = isCampaignInfoRequest({
    messageText: normalizedMessage,
    semanticSignals: params.semanticSignals,
  }) || Array.from(CONTACT_FALLBACK_ESCAPE_SIGNALS).some(signal => semanticSignals.has(signal));
  if (shouldBypassContactFallback) {
    return null;
  }

  if (params.responseMode === 'answer_then_clarify') {
    const hasPricingSignal = PRICING_SIGNAL_PATTERNS.some(pattern => normalizedMessage.includes(pattern));
    const hasVagueFollowUp = VAGUE_CLARIFICATION_FOLLOW_UP_PATTERN.test(normalizedMessage);
    const hasSpecificAnchor = SPECIFIC_TOPIC_ANCHOR_PATTERN.test(normalizedMessage);
    if (!hasPricingSignal || !hasVagueFollowUp || hasSpecificAnchor) {
      return null;
    }
  }

  return {
    response: fallbackMessage,
    modelId: CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
    clarificationCount,
  };
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
