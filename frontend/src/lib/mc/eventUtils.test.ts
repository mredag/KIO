import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sortEventsByDateDesc, parseAgentConfig, serializeAgentConfig } from './eventUtils';

const FC_OPTIONS = { numRuns: 100 };

describe('Feature: mission-control-premium-ui', () => {
  /**
   * Property 9: Agent config save round-trip
   * For any valid agent configuration (model, provider, capabilities, guardrails),
   * serializing and then parsing SHALL return the same configuration values.
   * Validates: Requirements 5.2
   */
  describe('Property 9: Agent config save round-trip', () => {
    it('serialize then parse returns identical config', () => {
      fc.assert(
        fc.property(
          fc.record({
            model: fc.string({ minLength: 1, maxLength: 100 }),
            provider: fc.string({ minLength: 1, maxLength: 50 }),
            capabilities: fc.string({ maxLength: 500 }),
            guardrails: fc.string({ maxLength: 500 }),
          }),
          (config) => {
            const serialized = serializeAgentConfig(config);
            const parsed = parseAgentConfig(serialized);
            expect(parsed.model).toBe(config.model);
            expect(parsed.provider).toBe(config.provider);
            expect(parsed.capabilities).toBe(config.capabilities);
            expect(parsed.guardrails).toBe(config.guardrails);
          },
        ),
        FC_OPTIONS,
      );
    });
  });

  /**
   * Property 10: Event lists sorted by date descending
   * For any list of events with timestamps, sorting SHALL produce an ordering
   * where each event's timestamp is >= the next event's timestamp.
   * Validates: Requirements 4.3, 6.1
   */
  describe('Property 10: Event lists sorted by date descending', () => {
    it('sorted events are in descending date order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              created_at: fc.integer({ min: 1577836800000, max: 1893456000000 }).map((ts) => new Date(ts).toISOString()),
              event_type: fc.string({ minLength: 1, maxLength: 30 }),
            }),
            { minLength: 0, maxLength: 50 },
          ),
          (events) => {
            const sorted = sortEventsByDateDesc(events);

            // Length preserved
            expect(sorted.length).toBe(events.length);

            // Descending order: each date >= next date
            for (let i = 0; i < sorted.length - 1; i++) {
              const dateA = new Date(sorted[i].created_at).getTime();
              const dateB = new Date(sorted[i + 1].created_at).getTime();
              expect(dateA).toBeGreaterThanOrEqual(dateB);
            }
          },
        ),
        FC_OPTIONS,
      );
    });
  });
});
