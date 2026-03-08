export interface ModelUsageEntry {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface EstimatedModelCost extends ModelUsageEntry {
  totalTokens: number;
  estimatedCostUsd: number;
}

interface ModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'openai/gpt-4o-mini': {
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  },
  'openai/gpt-4.1-mini': {
    inputUsdPerMillion: 0.4,
    outputUsdPerMillion: 1.6,
  },
  'openai/gpt-4.1': {
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 8,
  },
  'google/gemini-2.5-flash-lite': {
    inputUsdPerMillion: 0.1,
    outputUsdPerMillion: 0.4,
  },
};

const MODEL_PREFIX_NORMALIZERS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini',
  'openai/gpt-4.1',
  'google/gemini-2.5-flash-lite',
] as const;

const ZERO_COST_PREFIXES = [
  'deterministic/',
  'heuristic-',
  'heuristic/',
  'disabled',
  'error',
  'omni-moderation',
];

function roundUsd(value: number): number {
  return Number(value.toFixed(10));
}

export function normalizeModelForPricing(modelId: string | null | undefined): string {
  const normalized = String(modelId || '').trim();
  if (!normalized) return '';

  for (const prefix of MODEL_PREFIX_NORMALIZERS) {
    if (normalized.startsWith(prefix)) {
      return prefix;
    }
  }

  return normalized;
}

export function isZeroCostModel(modelId: string | null | undefined): boolean {
  const normalized = normalizeModelForPricing(modelId);
  if (!normalized) return true;
  return ZERO_COST_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function getModelPricing(modelId: string | null | undefined): ModelPricing | null {
  const normalized = normalizeModelForPricing(modelId);
  if (!normalized || isZeroCostModel(normalized)) {
    return null;
  }
  return MODEL_PRICING[normalized] || null;
}

export function splitEstimatedTokens(totalTokens: number, inputShare = 0.72): { inputTokens: number; outputTokens: number } {
  const safeTotal = Math.max(0, Math.round(totalTokens || 0));
  if (safeTotal === 0) {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const clampedInputShare = Math.min(0.95, Math.max(0.5, inputShare));
  const inputTokens = Math.round(safeTotal * clampedInputShare);
  return {
    inputTokens,
    outputTokens: Math.max(0, safeTotal - inputTokens),
  };
}

export function estimateModelCostUsd(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(modelId);
  if (!pricing) {
    return 0;
  }

  const safeInput = Math.max(0, Math.round(inputTokens || 0));
  const safeOutput = Math.max(0, Math.round(outputTokens || 0));
  const inputCost = (safeInput / 1_000_000) * pricing.inputUsdPerMillion;
  const outputCost = (safeOutput / 1_000_000) * pricing.outputUsdPerMillion;
  return roundUsd(inputCost + outputCost);
}

export function aggregateUsageByModel(entries: Array<ModelUsageEntry | null | undefined>): EstimatedModelCost[] {
  const aggregated = new Map<string, ModelUsageEntry>();

  for (const entry of entries) {
    if (!entry) continue;
    const modelId = normalizeModelForPricing(entry.modelId);
    const inputTokens = Math.max(0, Math.round(entry.inputTokens || 0));
    const outputTokens = Math.max(0, Math.round(entry.outputTokens || 0));

    if (!modelId || (inputTokens === 0 && outputTokens === 0)) {
      continue;
    }

    const existing = aggregated.get(modelId);
    if (existing) {
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      continue;
    }

    aggregated.set(modelId, {
      modelId,
      inputTokens,
      outputTokens,
    });
  }

  return [...aggregated.values()]
    .map((entry) => ({
      ...entry,
      totalTokens: entry.inputTokens + entry.outputTokens,
      estimatedCostUsd: estimateModelCostUsd(entry.modelId, entry.inputTokens, entry.outputTokens),
    }))
    .filter(entry => entry.totalTokens > 0 && getModelPricing(entry.modelId) !== null);
}
