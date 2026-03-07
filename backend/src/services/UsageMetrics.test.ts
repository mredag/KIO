import { describe, expect, it } from 'vitest';
import {
  ZERO_USAGE_METRICS,
  addUsageMetrics,
  estimateTokens,
  extractUsageMetrics,
} from './UsageMetrics.js';

describe('UsageMetrics', () => {
  it('extracts OpenRouter usage payloads', () => {
    const metrics = extractUsageMetrics({
      usage: {
        prompt_tokens: 120,
        completion_tokens: 45,
        total_tokens: 165,
        cost: 0.00125,
      },
    });

    expect(metrics).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
      costUsd: 0.00125,
    });
  });

  it('extracts OpenClaw-style usage payloads', () => {
    const metrics = extractUsageMetrics({
      usage: {
        input: 80,
        output: 20,
        totalTokens: 100,
        cost: { total: 0.0004 },
      },
    });

    expect(metrics).toEqual({
      inputTokens: 80,
      outputTokens: 20,
      totalTokens: 100,
      costUsd: 0.0004,
    });
  });

  it('falls back to text estimation when usage is missing', () => {
    const metrics = extractUsageMetrics(
      {},
      'merhaba size fiyat bilgisi vereyim',
      'tabii yardimci olayim',
    );

    expect(metrics).toEqual({
      inputTokens: estimateTokens('merhaba size fiyat bilgisi vereyim'),
      outputTokens: estimateTokens('tabii yardimci olayim'),
      totalTokens:
        estimateTokens('merhaba size fiyat bilgisi vereyim') +
        estimateTokens('tabii yardimci olayim'),
      costUsd: 0,
    });
  });

  it('adds usage metrics safely', () => {
    const metrics = addUsageMetrics(
      { inputTokens: 10, outputTokens: 20, totalTokens: 30, costUsd: 0.1 },
      { inputTokens: 1, outputTokens: 2, totalTokens: 3, costUsd: 0.02 },
    );

    expect(metrics).toEqual({
      inputTokens: 11,
      outputTokens: 22,
      totalTokens: 33,
      costUsd: 0.12,
    });
  });

  it('exposes a zero constant for default initialization', () => {
    expect(ZERO_USAGE_METRICS).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    });
  });
});
