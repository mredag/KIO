/**
 * Returns a color string based on response time thresholds.
 * green: <5000ms, yellow: 5000-15000ms, red: >15000ms, gray: null/undefined
 */
export function getResponseQualityColor(
  responseTimeMs: number | null | undefined,
): 'green' | 'yellow' | 'red' | 'gray' {
  if (responseTimeMs == null) return 'gray';
  if (responseTimeMs < 5000) return 'green';
  if (responseTimeMs <= 15000) return 'yellow';
  return 'red';
}

/**
 * Calculates exponential backoff delay for SSE reconnection.
 * Returns min(2^attempt * 1000, 30000) milliseconds.
 */
export function calculateBackoffDelay(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 1000, 30000);
}

/**
 * Maps model tier to Turkish display label.
 */
export function formatTierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case 'light':
      return 'Hafif';
    case 'standard':
      return 'Standart';
    case 'advanced':
      return 'Gelişmiş';
    default:
      return 'Bilinmiyor';
  }
}
/**
 * Infers model tier from model name string.
 * Used as fallback when model_tier column is null (pre-existing data).
 */
export function inferTierFromModel(modelName: string | null | undefined): string | null {
  if (!modelName) return null;
  const lower = modelName.toLowerCase();
  if (lower.includes('flash-lite') || lower.includes('flash_lite')) return 'light';
  if (lower.includes('kimi-k2') || lower.includes('kimi_k2')) return 'standard';
  if (lower.includes('gpt-4o-mini') || lower.includes('gpt_4o_mini')) return 'advanced';
  if (lower.includes('deepseek')) return 'standard';
  return null;
}

/**
 * Formats response time in a human-readable way.
 */
export function formatResponseTime(ms: number | null | undefined): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Immutable prepend helper for feed lists.
 * Prepends newItem to the beginning of existingFeed.
 */
export function prependToFeed<T>(existingFeed: T[], newItem: T): T[] {
  return [newItem, ...existingFeed];
}


/**
 * Maps policy validation status to Turkish display label and color.
 */
export function formatPolicyStatus(status: string | null | undefined): { label: string; color: string } {
  switch (status) {
    case 'pass':
      return { label: 'Geçti', color: '#4ade80' };
    case 'corrected':
      return { label: 'Düzeltildi', color: '#facc15' };
    case 'fallback':
      return { label: 'Yedek Yanıt', color: '#f87171' };
    case 'skipped':
      return { label: 'Atlandı', color: '#94a3b8' };
    case 'fail':
      return { label: 'Başarısız', color: '#f87171' };
    default:
      return { label: 'Bilinmiyor', color: '#94a3b8' };
  }
}
