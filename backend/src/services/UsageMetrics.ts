export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

interface UsageEnvelope {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  input?: unknown;
  output?: unknown;
  totalTokens?: unknown;
  total?: unknown;
  cost?: unknown;
}

export interface UsagePayloadLike {
  usage?: UsageEnvelope | null;
  cost?: unknown;
}

export const ZERO_USAGE_METRICS: UsageMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  costUsd: 0,
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function roundCostUsd(value: number): number {
  return Number(value.toFixed(10));
}

function extractCostValue(value: unknown): number {
  if (typeof value === 'object' && value !== null) {
    const costRecord = value as Record<string, unknown>;
    return toNumber(costRecord.total ?? costRecord.value ?? 0);
  }

  return toNumber(value);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3);
}

/**
 * Normalize usage payloads coming from:
 * - OpenRouter Chat Completions JSON (`usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`, `usage.cost`)
 * - OpenClaw session JSONL assistant messages (`usage.input`, `usage.output`, `usage.totalTokens`, `usage.cost.total`)
 */
export function extractUsageMetrics(
  payload: UsagePayloadLike | null | undefined,
  fallbackInputText = '',
  fallbackOutputText = '',
): UsageMetrics {
  const usage = payload?.usage ?? {};

  const inputTokens = Math.max(0, Math.round(toNumber(
    usage.prompt_tokens
    ?? usage.input_tokens
    ?? usage.input
    ?? 0,
  )));

  const outputTokens = Math.max(0, Math.round(toNumber(
    usage.completion_tokens
    ?? usage.output_tokens
    ?? usage.output
    ?? 0,
  )));

  const reportedTotal = Math.max(0, Math.round(toNumber(
    usage.total_tokens
    ?? usage.totalTokens
    ?? usage.total
    ?? 0,
  )));

  const fallbackInput = estimateTokens(fallbackInputText);
  const fallbackOutput = estimateTokens(fallbackOutputText);

  const resolvedInput = inputTokens > 0 ? inputTokens : fallbackInput;
  const resolvedOutput = outputTokens > 0 ? outputTokens : fallbackOutput;
  const totalTokens = reportedTotal > 0 ? reportedTotal : (resolvedInput + resolvedOutput);

  const costField = usage.cost ?? payload?.cost ?? null;
  const costUsd = Math.max(0, extractCostValue(costField));

  return {
    inputTokens: resolvedInput,
    outputTokens: resolvedOutput,
    totalTokens,
    costUsd: roundCostUsd(costUsd),
  };
}

export function addUsageMetrics(a: UsageMetrics, b: UsageMetrics): UsageMetrics {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    costUsd: roundCostUsd(a.costUsd + b.costUsd),
  };
}
