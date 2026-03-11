import { hasRoomAvailabilitySignals } from '../services/RoomAvailabilitySignalService.js';
import {
  addUsageMetrics,
  extractUsageMetrics,
  ZERO_USAGE_METRICS,
  type UsageMetrics,
} from '../services/UsageMetrics.js';

export interface SexualIntentClassification {
  confidence: number; // 0-1
  isSexual: boolean;
  reason: string;
  rawLabel?: string;
  modelUsed: string;
  usage?: UsageMetrics;
}

export type SexualIntentDecision =
  | { action: 'allow'; confidence: number; reason: string; modelUsed: string; usage?: UsageMetrics }
  | { action: 'retry_question'; confidence: number; reason: string; modelUsed: string; usage?: UsageMetrics }
  | { action: 'block_message'; confidence: number; reason: string; modelUsed: string; usage?: UsageMetrics };

type SexualIntentPass = 'primary' | 'review';
type SexualIntentAction = SexualIntentDecision['action'];

export function shouldEscalateConductForSexualDecision(action: SexualIntentAction): boolean {
  return action === 'block_message';
}

interface BoundaryProbeContext {
  normalized: string;
  compact: string;
  tokenCount: number;
  hasBusinessAnchor: boolean;
  hasPotentialSexualCue: boolean;
  shapeHint: 'short_vague_probe_candidate' | 'anchored_or_descriptive';
}

const LOW_THRESHOLD = 0.70;
const HIGH_THRESHOLD = 0.85;
const NEAR_BLOCK_THRESHOLD = 0.80;
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const SEXUAL_BLOCK_REPLY = 'Bizde o dediginiz sey yoktur. Yalnizca profesyonel spa ve spor hizmetleri veriyoruz.';
const SEXUAL_RETRY_REPLY = 'Mesajinizi daha acik yazar misiniz? Yalnizca profesyonel spa ve spor hizmetleri konusunda yardimci olabiliyoruz.';
const SAFE_BUSINESS_ANCHOR_PATTERN = /\b(masaj|massage|spa|hamam|sauna|havuz|pool|fitness|pilates|reformer|ders|kurs|uyelik|membership|randevu|rezervasyon|rezerv|fiyat|ucret|price|kampanya|adres|telefon|konum|paket|sure|dakika|seans|terapist|saat|acik|kapali|acilis|kapanis|calisma)\b/u;
const SHORT_PROBE_PATTERN = /\b(nasil|oluyor|olur|var|varmi|nedir|ne)\b/u;
const PRICE_QUESTION_PATTERN = /\b(fiyat\w*|ucret\w*|price|ne\s*kadar|kac\s*(tl|lira))\b/u;
const PRICE_COMPARISON_PATTERN = /\b(fark|farki|farkli|aradaki|ara\s*daki|arasindaki|arasinda|difference|karsilastir|anlamadim)\b/u;
const DURATION_PATTERN = /\b\d{1,3}\s*(dk|dak|daka|dakika|min|minute)\b/u;
const APPOINTMENT_QUESTION_PATTERN = /\b(randevu|rezervasyon|rezerv)\b/u;
const HOURS_QUESTION_PATTERN = /\b(saat\w*|kacta|kaca|acilis|kapanis|calisma|acik\w*|kapali\w*|musait)\b/u;
const LOCATION_QUESTION_PATTERN = /\b(nerede|neredesiniz|neresindesiniz|adres|konum|lokasyon|harita|yol\s*tarifi)\b/u;
const CONTACT_QUESTION_PATTERN = /\b(telefon|numara|iletisim|ulasim|ulasabilir|whatsapp)\b/u;
const BENIGN_INFO_REQUEST_PATTERN = /\b(bilgi|detay|yardim|yardım|yardimci|yardımcı|ogren|öğren|sorabilir|alabilir)\b/u;
const BENIGN_GREETING_PATTERN = /\b(merhaba|selam|slm|kolay\s*gelsin|iyi\s*gunler|iyi\s*aksamlar|musait\s*misiniz)\b/u;
const PREPARATION_ITEM_PATTERN = /\b(sort|short|havlu|terlik|bornoz|bone|mayo|bikini|kiyafet|esofman)\b/u;
const PREPARATION_VERB_PATTERN = /\b(getir|getirelim|getireyim|getiriyoruz|getiriyor|getiriyormuyuz|getirmeli|getirmemiz|yaninda|yanimizda|gelirken|gelmeden|gerekli|lazim)\b/u;
const GENERIC_ITEM_QUESTION_PATTERN = /\b(ne|getirelim|birsey)\b/u;
const COMPANION_PATTERN = /\b(esim|esimle|partner|partnerim|partnerimle|sevgilim|sevgilimle|beraber|birlikte|cift|couple)\b/u;
const SAME_ROOM_PATTERN = /\b(ayni\s+odada|same\s+room|cift\s+oda|iki\s+kisilik\s+oda|tek\s+kisilik\s+oda)\b/u;
const EXPLICIT_SEXUAL_PATTERN = /\b(sex|seks|sikis|sakso|erotik|escort|oral|anal)\b/u;
const BOUNDARY_SUSPICIOUS_CUE_PATTERN = /\b(mutlu|extra|ekstra|ozel|muamele|sonunda)\b/u;
const ACKNOWLEDGEMENT_LEAD_IN_PATTERN = /^(?:tesekkur(?:ler)?|sag ?ol(?:un)?|saol|eyvallah|tamam(?:dir)?|peki|ok(?:ay)?|anladim|olur|rica ederim)\b\s*/u;
const BENIGN_CLOSEOUT_PATTERN = /^(?:tesekkur(?:ler)?|sag ?ol(?:un)?|saol|eyvallah|rica ederim|anladim|tamam(?:dir)?|peki|olur|ok(?:ay)?|baska sorum yok|baska bir sorum yok|anladim tesekkur(?:ler)?|tamam tesekkur(?:ler)?|yok tesekkur(?:ler)?|gerek yok tesekkur(?:ler)?|sorun degil|problem degil|bir sey degil|(?:size|siz)\s?de|(?:size|siz)\s?de iyi gunler|(?:size|siz)\s?de tesekkur(?:ler)?|ilginize|bilginize)$/u;
const BENIGN_ACKNOWLEDGEMENT_PATTERN = /^(?:gelecegim|gelicem|ugrayacagim|ugrayacam|arayacagim|arayicam|geri donecegim|donus yapacagim|haber verecegim)$/u;

function hasHappyEndingCue(compact: string): boolean {
  return compact.includes('mutluson')
    || compact.includes('mutuson')
    || compact.includes('happyending')
    || compact.includes('guzelson')
    || compact.includes('guzelsonlu')
    || compact.includes('iyison')
    || compact.includes('iyisonlu');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeConfidence(raw: unknown, positiveSignal: boolean): number {
  const parsed = toNumber(raw);
  if (parsed === null) return positiveSignal ? 0.5 : 0;
  if (parsed > 1) return Math.min(parsed / 100, 1);
  if (parsed < 0) return 0;
  return parsed;
}

function extractJsonRecord(content: string): Record<string, unknown> | null {
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
    }
  }

  return parsed;
}

function combineUsage(...usages: Array<UsageMetrics | undefined>): UsageMetrics | undefined {
  const present = usages.filter((usage): usage is UsageMetrics => !!usage);
  if (present.length === 0) {
    return undefined;
  }

  return present.reduce(
    (acc, usage) => addUsageMetrics(acc, usage),
    ZERO_USAGE_METRICS,
  );
}

function extractClassification(content: string, modelUsed: string, usage?: UsageMetrics): SexualIntentClassification {
  const parsed = extractJsonRecord(content);

  if (!parsed) {
    const lowered = content.toLowerCase();
    const likelySexual = lowered.includes('sexual') || lowered.includes('cinsel') || lowered.includes('explicit');
    return {
      confidence: likelySexual ? 0.5 : 0,
      isSexual: likelySexual,
      reason: 'Model response was not valid JSON',
      modelUsed,
      usage,
    };
  }

  const label = String(parsed.label ?? parsed.intent ?? parsed.classification ?? '').toLowerCase();
  const reason = String(parsed.reason ?? parsed.explanation ?? '');
  const flagRaw = parsed.isSexual ?? parsed.sexual ?? parsed.flagged;
  const isSexual = typeof flagRaw === 'boolean'
    ? flagRaw
    : label.includes('sexual') || label.includes('cinsel') || label.includes('explicit');

  const confidence = normalizeConfidence(parsed.confidence ?? parsed.score ?? parsed.probability, isSexual);

  return {
    confidence,
    isSexual,
    reason: reason || 'No reason provided',
    rawLabel: label || undefined,
    modelUsed,
    usage,
  };
}

function normalizeClassifierWhitespace(messageText: string): string {
  return messageText.replace(/\s+/g, ' ').trim();
}

function buildCompactClassifierText(messageText: string): string {
  return messageText
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeEuphemismText(messageText: string): { spaced: string; compact: string } {
  const folded = messageText
    .toLocaleLowerCase('tr-TR')
    .replace(/\u00E7/g, 'c')
    .replace(/\u011F/g, 'g')
    .replace(/\u0131/g, 'i')
    .replace(/\u00F6/g, 'o')
    .replace(/\u015F/g, 's')
    .replace(/\u00FC/g, 'u');

  const spaced = folded
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    spaced,
    compact: spaced.replace(/\s+/g, ''),
  };
}

function buildBoundaryProbeContext(messageText: string): BoundaryProbeContext {
  const { spaced, compact } = normalizeEuphemismText(messageText);
  const tokenCount = spaced ? spaced.split(' ').length : 0;
  const hasBusinessAnchor = SAFE_BUSINESS_ANCHOR_PATTERN.test(spaced);
  const hasPotentialSexualCue = BOUNDARY_SUSPICIOUS_CUE_PATTERN.test(spaced)
    || hasHappyEndingCue(compact)
    || compact.includes('extrahizmet')
    || compact.includes('ekstrahizmet')
    || compact.includes('ozelmuamele');
  const shapeHint = !hasBusinessAnchor && tokenCount > 0 && tokenCount <= 5 && SHORT_PROBE_PATTERN.test(spaced)
    ? 'short_vague_probe_candidate'
    : 'anchored_or_descriptive';

  return {
    normalized: spaced,
    compact,
    tokenCount,
    hasBusinessAnchor,
    hasPotentialSexualCue,
    shapeHint,
  };
}

function stripAcknowledgementLeadIn(spaced: string): string {
  let stripped = spaced.trim();
  while (ACKNOWLEDGEMENT_LEAD_IN_PATTERN.test(stripped)) {
    stripped = stripped.replace(ACKNOWLEDGEMENT_LEAD_IN_PATTERN, '').trim();
  }
  return stripped;
}

function isBenignCloseoutMessage(spaced: string): boolean {
  if (!spaced) {
    return false;
  }

  if (BENIGN_CLOSEOUT_PATTERN.test(spaced)) {
    return true;
  }

  return BENIGN_ACKNOWLEDGEMENT_PATTERN.test(stripAcknowledgementLeadIn(spaced));
}

function detectClearBusinessIntentGuard(messageText: string): SexualIntentDecision | null {
  const { spaced, compact } = normalizeEuphemismText(messageText);
  if (!spaced) {
    return null;
  }

  // Never force-allow if explicit or euphemistic sexual cues are present.
  const hasExplicitSexualCue = EXPLICIT_SEXUAL_PATTERN.test(spaced);
  const hasEuphemisticCue = hasHappyEndingCue(compact)
    || compact.includes('extrahizmet')
    || compact.includes('ekstrahizmet')
    || compact.includes('ozelmuamele');
  if (hasExplicitSexualCue || hasEuphemisticCue) {
    return null;
  }

  const hasBusinessAnchor = SAFE_BUSINESS_ANCHOR_PATTERN.test(spaced);
  const hasPriceQuestion = PRICE_QUESTION_PATTERN.test(spaced);
  const hasPriceComparisonCue = PRICE_COMPARISON_PATTERN.test(spaced);
  const hasDurationToken = DURATION_PATTERN.test(spaced);
  const hasAppointmentQuestion = APPOINTMENT_QUESTION_PATTERN.test(spaced);
  const hasHoursQuestion = HOURS_QUESTION_PATTERN.test(spaced);
  const hasNumericToken = /\b\d{1,4}\b/.test(spaced);
  const numericTokens = spaced.match(/\b\d{3,4}\b/g) || [];
  const hasMultipleNumericTokens = new Set(numericTokens).size >= 2;
  const hasLocationQuestion = LOCATION_QUESTION_PATTERN.test(spaced);
  const hasContactQuestion = CONTACT_QUESTION_PATTERN.test(spaced);
  const hasBenignInfoRequest = BENIGN_INFO_REQUEST_PATTERN.test(spaced);
  const hasBenignGreeting = BENIGN_GREETING_PATTERN.test(spaced);
  const hasBoundarySuspiciousCue = BOUNDARY_SUSPICIOUS_CUE_PATTERN.test(spaced);
  const hasPreparationItem = PREPARATION_ITEM_PATTERN.test(spaced);
  const hasPreparationVerb = PREPARATION_VERB_PATTERN.test(spaced);
  const hasGenericItemQuestion = GENERIC_ITEM_QUESTION_PATTERN.test(spaced);
  const hasMassageAnchor = /\b(masaj|massage|spa)\b/u.test(spaced);
  const tokenCount = spaced.split(' ').length;
  const isShortNeutralProbe = !hasBusinessAnchor
    && !hasBoundarySuspiciousCue
    && tokenCount > 0
    && tokenCount <= 4
    && SHORT_PROBE_PATTERN.test(spaced);
  const looksLikePreparationQuestion = hasPreparationVerb
    && (hasPreparationItem || hasBusinessAnchor || hasGenericItemQuestion);
  const looksLikeLegitCoupleMassageRequest = hasMassageAnchor && (
    hasRoomAvailabilitySignals(spaced)
    || (COMPANION_PATTERN.test(spaced) && SAME_ROOM_PATTERN.test(spaced))
  );

  // Covers compact typo forms like "30daka ne kadar".
  const looksLikeDurationPriceQuestion = hasDurationToken && (hasPriceQuestion || hasNumericToken);
  const looksLikeConcreteBusinessPriceQuestion = hasPriceQuestion && (hasBusinessAnchor || hasNumericToken);
  const looksLikeBusinessComparisonQuestion = !hasBoundarySuspiciousCue
    && hasPriceComparisonCue
    && (hasPriceQuestion || hasBusinessAnchor || hasMultipleNumericTokens);

  if (looksLikeDurationPriceQuestion || looksLikeConcreteBusinessPriceQuestion || looksLikeBusinessComparisonQuestion) {
    return {
      action: 'allow',
      confidence: 0,
      reason: looksLikeBusinessComparisonQuestion
        ? 'Detected business comparison question about pricing/package differences.'
        : 'Detected clear business pricing question with concrete duration/number anchor.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (hasHoursQuestion) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected clear business hours/availability inquiry.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (hasAppointmentQuestion) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected clear business appointment / reservation inquiry.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  // Allow clear location/contact asks so they are never treated as vague boundary probes.
  if (hasLocationQuestion || hasContactQuestion) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected clear business contact/location inquiry.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  // Neutral opener/info requests should not be treated as suspicious.
  if (hasBenignInfoRequest) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected benign general information inquiry.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (hasBenignGreeting) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected benign greeting/opening message.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (isBenignCloseoutMessage(spaced)) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected benign closeout / acknowledgement message.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (looksLikePreparationQuestion) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected normal preparation / what-to-bring question for the visit.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (looksLikeLegitCoupleMassageRequest) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected legitimate couple / same-room massage request without sexual cue.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  if (isShortNeutralProbe) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Detected short neutral inquiry without sexual cue.',
      modelUsed: 'heuristic-clear-business-guard',
    };
  }

  return null;
}

function detectSexualEuphemismGuard(messageText: string): SexualIntentDecision | null {
  const { spaced, compact } = normalizeEuphemismText(messageText);

  if (!compact) {
    return null;
  }

  const hasHappyEndingProbe = hasHappyEndingCue(compact);

  if (hasHappyEndingProbe) {
    return {
      action: 'block_message',
      confidence: 0.92,
      reason: 'Detected euphemistic sexual-service request (happy-ending phrasing).',
      modelUsed: 'heuristic-euphemism-guard',
    };
  }

  const hasIndirectEndingProbe = compact.includes('sonundamutlu')
    || compact.includes('mutluoluyormuyum')
    || compact.includes('mutlubiter')
    || compact.includes('mutlubitiyor');

  if (hasIndirectEndingProbe) {
    return {
      action: 'block_message',
      confidence: 0.84,
      reason: 'Detected indirect euphemistic probe about the service ending.',
      modelUsed: 'heuristic-euphemism-guard',
    };
  }

  const hasMutlulukProbe = compact.includes('mutlulukvarmi')
    || compact.includes('mutlulukvar')
    || spaced.includes('mutluluk var mi');

  const hasOzelMuameleProbe = spaced.includes('ozel muamele')
    || compact.includes('ozelmuamele');

  if (hasMutlulukProbe || hasOzelMuameleProbe) {
    return {
      action: 'block_message',
      confidence: 0.9,
      reason: 'Detected euphemistic sexual-service probe (mutluluk/ozel muamele wording).',
      modelUsed: 'heuristic-euphemism-guard',
    };
  }

  const hasExtraServiceProbe = spaced.includes('extra hizmet')
    || spaced.includes('ekstra hizmet')
    || compact.includes('extrahizmet')
    || compact.includes('ekstrahizmet');

  if (hasExtraServiceProbe) {
    return {
      action: 'retry_question',
      confidence: 0.78,
      reason: 'Detected ambiguous euphemistic request for extra services.',
      modelUsed: 'heuristic-euphemism-guard',
    };
  }

  const hasLegitimatePackageAnchor = /\b(uyelik|membership|ders|kurs|reformer|pilates|aile|bireysel)\b/u.test(spaced);
  const hasPremiumPackageProbe = compact.includes('premiumpaket');

  if (hasPremiumPackageProbe && !hasLegitimatePackageAnchor) {
    return {
      action: 'retry_question',
      confidence: 0.74,
      reason: 'Detected vague premium-package phrasing that often masks prohibited service requests.',
      modelUsed: 'heuristic-euphemism-guard',
    };
  }

  return null;
}

function buildSexualIntentPrompt(messageText: string): string {
  const normalized = normalizeClassifierWhitespace(messageText);
  const compact = buildCompactClassifierText(messageText);

  return [
    `Original message: ${messageText}`,
    `Normalized spacing: ${normalized || '(empty)'}`,
    `Compact text (ignore spaces/punctuation): ${compact || '(empty)'}`,
    'Users may try to hide intent by splitting words with spaces, punctuation, or syllables.',
    'Classify the underlying meaning after mentally removing separators.',
  ].join('\n');
}

export function decideSexualIntent(classification: SexualIntentClassification): SexualIntentDecision {
  const sexualScore = classification.isSexual ? classification.confidence : 0;

  if (sexualScore >= HIGH_THRESHOLD) {
    return {
      action: 'block_message',
      confidence: sexualScore,
      reason: classification.reason,
      modelUsed: classification.modelUsed,
      usage: classification.usage,
    };
  }

  if (sexualScore >= NEAR_BLOCK_THRESHOLD) {
    return {
      action: 'block_message',
      confidence: sexualScore,
      reason: classification.reason,
      modelUsed: classification.modelUsed,
      usage: classification.usage,
    };
  }

  if (sexualScore >= LOW_THRESHOLD) {
    return {
      action: 'retry_question',
      confidence: sexualScore,
      reason: classification.reason,
      modelUsed: classification.modelUsed,
      usage: classification.usage,
    };
  }

  return {
    action: 'allow',
    confidence: sexualScore,
    reason: classification.reason,
    modelUsed: classification.modelUsed,
    usage: classification.usage,
  };
}

export function getSexualIntentReply(action: SexualIntentDecision['action']): string {
  if (action === 'block_message') {
    return SEXUAL_BLOCK_REPLY;
  }

  if (action === 'retry_question') {
    return SEXUAL_RETRY_REPLY;
  }

  return '';
}

function buildSexualIntentSystemPrompt(pass: SexualIntentPass): string {
  const baseRules = [
    'You are a strict content safety classifier for Instagram DMs.',
    'The business is a legitimate spa and fitness center.',
    'Detect only sexual intent or sexually explicit content.',
    'Questions asking about erotic endings, sexual gratification, or inappropriate touching are sexual even when phrased indirectly.',
    'Users may obfuscate sexual requests by splitting words with spaces, punctuation, or syllables.',
    'Detect the underlying meaning after removing separators, not just the literal surface form.',
    'Very short vague probes about how the treatment goes, what happens, whether there is something extra, or whether there is special handling can still be coded sexual-service checks.',
    'Common spa euphemisms such as "mutlu son", "mutu son", "sonunda mutlu oluyor muyum", "extra/ekstra hizmet", or a vague "premium paket" can be indirect sexual-service probes.',
    'Treat normal wellness or sports service questions as non-sexual by default.',
    'Plain mentions of massage, spa, hamam, sauna, pool, fitness, pilates, courses, or memberships are NOT sexual unless the message adds explicit sexual service intent.',
    'A message like "masaj" by itself is a standard service inquiry, not sexual content.',
  ];

  const reviewRules = pass === 'review'
    ? [
        'You are the SECOND PASS reviewer. Assume the first classifier may be too lenient.',
        'If there is a plausible reading that the user is requesting a prohibited sexual service, classify as sexual.',
        'When in doubt between allow and retry/block for an obfuscated euphemistic message, prefer the safer classification.',
      ]
    : [
        'You are the PRIMARY classifier. Be precise and avoid false positives for normal spa or sports requests.',
      ];

  return [
    ...baseRules,
    ...reviewRules,
    'Return JSON only with fields: label, isSexual, confidence, reason.',
    'label must be one of: sexual, non_sexual.',
    'confidence must be a number between 0 and 1 and represent sexual-intent confidence.',
    'Be conservative: if uncertain, choose lower confidence values.',
  ].join(' ');
}

function mergeSexualIntentDecisions(
  primary: SexualIntentDecision,
  review: SexualIntentDecision,
): SexualIntentDecision {
  const severity = {
    allow: 0,
    retry_question: 1,
    block_message: 2,
  } as const;

  if (severity[review.action] > severity[primary.action]) {
    return {
      ...review,
      usage: combineUsage(primary.usage, review.usage),
    };
  }

  if (severity[review.action] < severity[primary.action]) {
    return {
      ...primary,
      usage: combineUsage(primary.usage, review.usage),
    };
  }

  const winner = review.confidence > primary.confidence ? review : primary;
  return {
    ...winner,
    usage: combineUsage(primary.usage, review.usage),
  };
}

function normalizeDecisionAction(value: unknown): SexualIntentAction {
  const action = String(value ?? '').trim().toLowerCase();

  if (action === 'block_message' || action === 'block' || action === 'unsafe' || action === 'unsafe_probe') {
    return 'block_message';
  }

  if (action === 'retry_question' || action === 'retry' || action === 'clarify' || action === 'review') {
    return 'retry_question';
  }

  return 'allow';
}

function extractBoundaryProbeDecision(content: string, modelUsed: string, usage?: UsageMetrics): SexualIntentDecision {
  const parsed = extractJsonRecord(content);

  if (!parsed) {
    const lowered = content.toLowerCase();
    return {
      action: lowered.includes('block') ? 'block_message' : lowered.includes('retry') ? 'retry_question' : 'allow',
      confidence: lowered.includes('block') || lowered.includes('retry') ? 0.6 : 0,
      reason: 'Boundary review response was not valid JSON',
      modelUsed,
      usage,
    };
  }

  const fallbackAction = parsed.shouldBlock === true
    ? 'block_message'
    : parsed.shouldClarify === true
      ? 'retry_question'
      : 'allow';
  const action = normalizeDecisionAction(parsed.action ?? parsed.label ?? parsed.decision ?? fallbackAction);
  const confidence = normalizeConfidence(parsed.confidence ?? parsed.score ?? parsed.probability, action !== 'allow');
  const reason = String(parsed.reason ?? parsed.explanation ?? '').trim() || 'No reason provided';

  return {
    action,
    confidence,
    reason,
    modelUsed,
    usage,
  };
}

async function evaluateBoundaryProbeIntent(messageText: string): Promise<SexualIntentDecision> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const model = process.env.SEXUAL_INTENT_MODEL || DEFAULT_MODEL;
  const context = buildBoundaryProbeContext(messageText);

  if (context.shapeHint === 'short_vague_probe_candidate' && !context.hasPotentialSexualCue) {
    return {
      action: 'allow',
      confidence: 0,
      reason: 'Short vague inquiry without sexual cue; boundary review skipped.',
      modelUsed: 'heuristic-boundary-neutral-short',
    };
  }

  if (!apiKey) {
    if (context.shapeHint === 'short_vague_probe_candidate') {
      return {
        action: 'retry_question',
        confidence: 0.72,
        reason: 'No API key; conservative boundary review escalated a short vague probe.',
        modelUsed: 'heuristic-boundary-probe',
      };
    }

    return {
      action: 'allow',
      confidence: 0,
      reason: 'OPENROUTER_API_KEY is missing',
      modelUsed: model,
    };
  }

  const systemPrompt = [
    'You are a business-boundary safety reviewer for Instagram DMs.',
    'The business is a legitimate spa and fitness center.',
    'Your job is to catch coded probing for prohibited sexual services even when the wording is vague, indirect, or newly phrased.',
    'A suspicious boundary probe is often short, vague, and asks how the treatment goes, what happens, whether there is something extra, whether there is special handling, or similar coded curiosity without naming a normal business detail.',
    'A normal business question usually names a concrete service or a concrete detail such as price, schedule, address, membership, class, package, duration, therapist, or reservation.',
    'Do not classify as retry_question or block_message based only on shortness or missing business anchors.',
    'Use retry_question or block_message only when there is a plausible prohibited-service cue (explicit or euphemistic).',
    'Neutral greetings or generic information requests should be allow.',
    'Return JSON only with fields: action, confidence, reason.',
    'action must be one of: allow, retry_question, block_message.',
    'Use block_message when the message is likely probing for a prohibited service.',
    'Use retry_question when the message is suspicious but still ambiguous.',
    'Use allow only when the message is clearly a normal business request.',
  ].join(' ');

  const userPrompt = [
    `Original message: ${messageText}`,
    `Normalized spacing: ${context.normalized || '(empty)'}`,
    `Compact text: ${context.compact || '(empty)'}`,
    `Token count: ${context.tokenCount}`,
    `Concrete business anchor detected: ${context.hasBusinessAnchor ? 'yes' : 'no'}`,
    `Potential sexual cue detected: ${context.hasPotentialSexualCue ? 'yes' : 'no'}`,
    `Question shape hint: ${context.shapeHint}`,
    'Decide the safest business-boundary response.',
  ].join('\n');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kio.eformspa.local',
        'X-Title': 'Eform Boundary Probe Review',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 160,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_object',
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Boundary probe API error ${response.status}: ${body}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      model?: string;
      usage?: Record<string, unknown>;
      cost?: unknown;
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    const modelUsed = data.model || model;
    const usage = extractUsageMetrics(data, `${systemPrompt}\n${userPrompt}`, content);
    return extractBoundaryProbeDecision(content, modelUsed, usage);
  } catch (error) {
    return {
      action: 'allow',
      confidence: 0,
      reason: `Boundary review unavailable: ${error instanceof Error ? error.message : String(error)}`,
      modelUsed: 'boundary-review-error',
    };
  }
}

export async function classifySexualIntent(
  messageText: string,
  pass: SexualIntentPass = 'primary',
): Promise<SexualIntentClassification> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const model = process.env.SEXUAL_INTENT_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return {
      confidence: 0,
      isSexual: false,
      reason: 'OPENROUTER_API_KEY is missing',
      modelUsed: model,
    };
  }

  const systemPrompt = buildSexualIntentSystemPrompt(pass);
  const userPrompt = buildSexualIntentPrompt(messageText);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kio.eformspa.local',
      'X-Title': 'Eform Sexual Intent Filter',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 160,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_object',
      },
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sexual intent API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    model?: string;
    usage?: Record<string, unknown>;
    cost?: unknown;
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  const modelUsed = data.model || model;
  const usage = extractUsageMetrics(data, `${systemPrompt}\n${userPrompt}`, content);
  return extractClassification(content, modelUsed, usage);
}

export async function evaluateSexualIntent(messageText: string): Promise<SexualIntentDecision> {
  const heuristicDecision = detectSexualEuphemismGuard(messageText);
  if (heuristicDecision) {
    return heuristicDecision;
  }

  const businessGuardDecision = detectClearBusinessIntentGuard(messageText);
  if (businessGuardDecision) {
    return businessGuardDecision;
  }

  const [primaryClassification, reviewClassification, boundaryDecision] = await Promise.all([
    classifySexualIntent(messageText, 'primary'),
    classifySexualIntent(messageText, 'review'),
    evaluateBoundaryProbeIntent(messageText),
  ]);

  const modelDecision = mergeSexualIntentDecisions(
    decideSexualIntent(primaryClassification),
    decideSexualIntent(reviewClassification),
  );

  return mergeSexualIntentDecisions(modelDecision, boundaryDecision);
}
