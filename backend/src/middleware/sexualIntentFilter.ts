export interface SexualIntentClassification {
  confidence: number; // 0-1
  isSexual: boolean;
  reason: string;
  rawLabel?: string;
  modelUsed: string;
}

export type SexualIntentDecision =
  | { action: 'allow'; confidence: number; reason: string; modelUsed: string }
  | { action: 'retry_question'; confidence: number; reason: string; modelUsed: string }
  | { action: 'block_message'; confidence: number; reason: string; modelUsed: string };

type SexualIntentPass = 'primary' | 'review';

const LOW_THRESHOLD = 0.70;
const HIGH_THRESHOLD = 0.85;
const NEAR_BLOCK_THRESHOLD = 0.80;
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const SEXUAL_BLOCK_REPLY = 'O soylediginiz hizmet bizde yoktur. Biz sadece profesyonel spa ve spor hizmetleri sunuyoruz.';
const SEXUAL_RETRY_REPLY = 'Mesajınızı daha açık yazar mısınız? Yalnızca profesyonel spa ve spor hizmetleri konusunda yardımcı olabiliyoruz.';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeConfidence(raw: unknown, sexualHint: boolean): number {
  const parsed = toNumber(raw);
  if (parsed === null) return sexualHint ? 0.5 : 0;
  if (parsed > 1) return Math.min(parsed / 100, 1);
  if (parsed < 0) return 0;
  return parsed;
}

function extractClassification(content: string, modelUsed: string): SexualIntentClassification {
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

  if (!parsed) {
    const lowered = content.toLowerCase();
    const likelySexual = lowered.includes('sexual') || lowered.includes('cinsel') || lowered.includes('explicit');
    return {
      confidence: likelySexual ? 0.5 : 0,
      isSexual: likelySexual,
      reason: 'Model response was not valid JSON',
      modelUsed,
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
    };
  }

  // Scores close to the hard block threshold should still get a firm business
  // boundary, not a clarification prompt that invites further probing.
  if (sexualScore >= NEAR_BLOCK_THRESHOLD) {
    return {
      action: 'block_message',
      confidence: sexualScore,
      reason: classification.reason,
      modelUsed: classification.modelUsed,
    };
  }

  if (sexualScore >= LOW_THRESHOLD) {
    return {
      action: 'retry_question',
      confidence: sexualScore,
      reason: classification.reason,
      modelUsed: classification.modelUsed,
    };
  }

  return {
    action: 'allow',
    confidence: sexualScore,
    reason: classification.reason,
    modelUsed: classification.modelUsed,
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
    return review;
  }

  if (severity[review.action] < severity[primary.action]) {
    return primary;
  }

  return review.confidence > primary.confidence ? review : primary;
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
      'HTTP-Referer': 'https://spa-kiosk.local',
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
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  const modelUsed = data.model || model;
  return extractClassification(content, modelUsed);
}

export async function evaluateSexualIntent(messageText: string): Promise<SexualIntentDecision> {
  const [primaryClassification, reviewClassification] = await Promise.all([
    classifySexualIntent(messageText, 'primary'),
    classifySexualIntent(messageText, 'review'),
  ]);

  return mergeSexualIntentDecisions(
    decideSexualIntent(primaryClassification),
    decideSexualIntent(reviewClassification),
  );
}
