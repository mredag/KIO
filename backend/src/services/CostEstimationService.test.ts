import { describe, expect, it } from 'vitest';
import {
  aggregateUsageByModel,
  estimateModelCostUsd,
  splitEstimatedTokens,
} from './CostEstimationService.js';

describe('CostEstimationService', () => {
  it('estimates priced model cost from input and output tokens', () => {
    expect(estimateModelCostUsd('openai/gpt-4o-mini', 1_000, 1_000)).toBe(0.00075);
  });

  it('returns zero for deterministic or unsupported models', () => {
    expect(estimateModelCostUsd('deterministic/info-template-v1', 500, 100)).toBe(0);
    expect(estimateModelCostUsd('custom/unknown-model', 500, 100)).toBe(0);
  });

  it('aggregates usage by normalized model id and filters non-priced entries', () => {
    const aggregated = aggregateUsageByModel([
      { modelId: 'openai/gpt-4.1-mini', inputTokens: 1_000, outputTokens: 200 },
      { modelId: 'openai/gpt-4.1-mini-2026-03-01', inputTokens: 500, outputTokens: 100 },
      { modelId: 'deterministic/info-template-v1', inputTokens: 0, outputTokens: 80 },
      { modelId: 'custom/unknown-model', inputTokens: 100, outputTokens: 50 },
    ]);

    expect(aggregated).toEqual([
      {
        modelId: 'openai/gpt-4.1-mini',
        inputTokens: 1_500,
        outputTokens: 300,
        totalTokens: 1_800,
        estimatedCostUsd: 0.00108,
      },
    ]);
  });

  it('splits estimated tokens without losing the total', () => {
    expect(splitEstimatedTokens(100)).toEqual({
      inputTokens: 72,
      outputTokens: 28,
    });
  });
});
