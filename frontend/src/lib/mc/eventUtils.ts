/**
 * Event and agent config utilities for Mission Control.
 */

export interface MCEvent {
  id: string;
  created_at: string;
  event_type?: string;
  description?: string;
  [key: string]: unknown;
}

export interface AgentConfig {
  model: string;
  provider: string;
  capabilities: string;
  guardrails: string;
}

/**
 * Sort events by date descending (most recent first).
 * Events with invalid or missing dates are pushed to the end.
 */
export function sortEventsByDateDesc<T extends { created_at: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    if (isNaN(dateA) && isNaN(dateB)) return 0;
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;
    return dateB - dateA;
  });
}

/**
 * Parse an agent config from API response, normalizing fields.
 * This is the "deserialize" side of the round-trip.
 */
export function parseAgentConfig(raw: Record<string, unknown>): AgentConfig {
  return {
    model: String(raw.model ?? ''),
    provider: String(raw.provider ?? ''),
    capabilities: String(raw.capabilities ?? ''),
    guardrails: String(raw.guardrails ?? ''),
  };
}

/**
 * Serialize an agent config for API submission.
 * This is the "serialize" side of the round-trip.
 */
export function serializeAgentConfig(config: AgentConfig): AgentConfig {
  return {
    model: config.model,
    provider: config.provider,
    capabilities: config.capabilities,
    guardrails: config.guardrails,
  };
}
