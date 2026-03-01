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

const LOW_THRESHOLD = 0.70;
const HIGH_THRESHOLD = 0.85;
const DEFAULT_MODEL = 'moonshotai/kimi-k2';

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

export async function classifySexualIntent(messageText: string): Promise<SexualIntentClassification> {
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

  const systemPrompt = [
    'You are a strict content safety classifier for Instagram DMs.',
    'Detect only sexual intent or sexually explicit content.',
    'Return JSON only with fields: label, isSexual, confidence, reason.',
    'label must be one of: sexual, non_sexual.',
    'confidence must be a number between 0 and 1 and represent sexual-intent confidence.',
    'Be conservative: if uncertain, choose lower confidence values.',
  ].join(' ');

  const userPrompt = `Message: ${messageText}`;

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
  const classification = await classifySexualIntent(messageText);
  return decideSexualIntent(classification);
}
