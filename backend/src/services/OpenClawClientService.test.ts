import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { OpenClawClientService } from './OpenClawClientService.js';

/**
 * Feature: jarvis-task-orchestration, Property 7: Reconnect exponential backoff
 *
 * For any sequence of N consecutive connection failures (N ≥ 1),
 * the delay before the (N+1)th reconnect attempt should equal
 * min(base * 2^(N-1), max) milliseconds.
 *
 * Validates: Requirements 2.3
 */
describe('Property 7: Reconnect exponential backoff', () => {
  const DEFAULT_BASE = 800;
  const DEFAULT_MAX = 15000;

  beforeEach(() => {
    OpenClawClientService.resetInstance();
  });

  afterEach(() => {
    OpenClawClientService.resetInstance();
  });

  it('backoff delay equals min(base * 2^attempts, max) for any attempt count', () => {
    fc.assert(
      fc.property(
        // N consecutive failures: 0..30 covers well beyond where max caps
        fc.integer({ min: 0, max: 30 }),
        // Configurable base: 100..5000
        fc.integer({ min: 100, max: 5000 }),
        // Configurable max: must be >= base
        fc.integer({ min: 5000, max: 60000 }),
        (attempts, base, max) => {
          OpenClawClientService.resetInstance();
          const client = OpenClawClientService.getInstance({
            reconnectBaseMs: base,
            reconnectMaxMs: max,
            gatewayToken: 'test-token',
          });

          // Simulate N consecutive failures by calling scheduleReconnect-like
          // increments. The public getReconnectDelay reads reconnectAttempts
          // which starts at 0. We use the internal state progression:
          // scheduleReconnect calls getReconnectDelay() then increments attempts.
          // So after N failures, reconnectAttempts = N, and the next delay = base * 2^N.
          // But for the Nth call (0-indexed), delay = base * 2^N capped at max.

          // Access private reconnectAttempts via any cast for testing
          (client as any).reconnectAttempts = attempts;

          const actual = client.getReconnectDelay();
          const expected = Math.min(base * Math.pow(2, attempts), max);

          expect(actual).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('first reconnect delay equals base (attempts=0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 5000, max: 60000 }),
        (base, max) => {
          OpenClawClientService.resetInstance();
          const client = OpenClawClientService.getInstance({
            reconnectBaseMs: base,
            reconnectMaxMs: max,
            gatewayToken: 'test-token',
          });

          // At attempt 0, delay should be base * 2^0 = base
          const delay = client.getReconnectDelay();
          expect(delay).toBe(base);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay never exceeds max for any number of attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 5000, max: 60000 }),
        (attempts, base, max) => {
          OpenClawClientService.resetInstance();
          const client = OpenClawClientService.getInstance({
            reconnectBaseMs: base,
            reconnectMaxMs: max,
            gatewayToken: 'test-token',
          });

          (client as any).reconnectAttempts = attempts;
          const delay = client.getReconnectDelay();

          expect(delay).toBeLessThanOrEqual(max);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay is monotonically non-decreasing with default config', () => {
    fc.assert(
      fc.property(
        // Test sequences of increasing attempt counts
        fc.integer({ min: 0, max: 50 }),
        (maxAttempts) => {
          OpenClawClientService.resetInstance();
          const client = OpenClawClientService.getInstance({
            reconnectBaseMs: DEFAULT_BASE,
            reconnectMaxMs: DEFAULT_MAX,
            gatewayToken: 'test-token',
          });

          let prevDelay = 0;
          for (let i = 0; i <= maxAttempts; i++) {
            (client as any).reconnectAttempts = i;
            const delay = client.getReconnectDelay();
            expect(delay).toBeGreaterThanOrEqual(prevDelay);
            prevDelay = delay;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
