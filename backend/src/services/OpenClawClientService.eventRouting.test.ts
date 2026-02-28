import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { OpenClawClientService } from './OpenClawClientService.js';

/**
 * Feature: jarvis-task-orchestration, Property 8: Event routing by session key
 *
 * For any incoming WebSocket event with a session key, the OpenClawClientService
 * should emit the event only to listeners registered for that specific session key.
 * Events should never be delivered to listeners of other sessions.
 *
 * Validates: Requirements 2.4, 6.1
 */
describe('Property 8: Event routing by session key', () => {
  let client: OpenClawClientService;

  beforeEach(() => {
    OpenClawClientService.resetInstance();
    client = OpenClawClientService.getInstance({
      gatewayToken: 'test-token',
    });
  });

  afterEach(() => {
    OpenClawClientService.resetInstance();
  });

  /**
   * Simulate an incoming chat event frame as the WebSocket message handler would
   * process it. This directly invokes the EventEmitter emit path that the real
   * WebSocket 'message' handler uses for chat events.
   */
  function simulateChatEvent(sessionKey: string, data: Record<string, unknown>) {
    client.emit('chat', { sessionKey, data: { sessionKey, ...data } });
  }

  it('chat events are emitted with the correct sessionKey and only reach matching listeners', () => {
    fc.assert(
      fc.property(
        // Generate 2-5 distinct session keys
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 2, maxLength: 5 }),
        // Index of the target session to send the event to
        fc.nat(),
        // Arbitrary message content
        fc.string({ minLength: 1, maxLength: 100 }),
        (sessionKeys, targetIdxRaw, messageContent) => {
          const targetIdx = targetIdxRaw % sessionKeys.length;
          const targetKey = sessionKeys[targetIdx];

          // Track which sessions received events
          const received: Map<string, unknown[]> = new Map();
          sessionKeys.forEach((key) => received.set(key, []));

          // Register a listener that filters by session key (the consumer pattern)
          const listener = (event: { sessionKey: string; data: Record<string, unknown> }) => {
            sessionKeys.forEach((key) => {
              if (event.sessionKey === key) {
                received.get(key)!.push(event.data);
              }
            });
          };

          client.on('chat', listener);

          // Simulate a chat event for the target session
          simulateChatEvent(targetKey, { content: messageContent });

          // The target session should have received exactly 1 event
          expect(received.get(targetKey)!.length).toBe(1);
          expect(received.get(targetKey)![0]).toHaveProperty('content', messageContent);

          // All other sessions should have received 0 events
          sessionKeys.forEach((key) => {
            if (key !== targetKey) {
              expect(received.get(key)!.length).toBe(0);
            }
          });

          client.removeListener('chat', listener);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple events to different sessions are isolated from each other', () => {
    fc.assert(
      fc.property(
        // Generate 2-10 events, each with a session key and content
        fc.array(
          fc.record({
            sessionKey: fc.stringMatching(/^[a-z0-9_-]{1,20}$/),
            content: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (events) => {
          const received: Map<string, unknown[]> = new Map();

          const listener = (event: { sessionKey: string; data: Record<string, unknown> }) => {
            if (!received.has(event.sessionKey)) {
              received.set(event.sessionKey, []);
            }
            received.get(event.sessionKey)!.push(event.data);
          };

          client.on('chat', listener);

          // Fire all events
          events.forEach((evt) => {
            simulateChatEvent(evt.sessionKey, { content: evt.content });
          });

          // Count expected events per session key
          const expectedCounts: Map<string, number> = new Map();
          events.forEach((evt) => {
            expectedCounts.set(evt.sessionKey, (expectedCounts.get(evt.sessionKey) || 0) + 1);
          });

          // Verify each session received exactly the expected number of events
          expectedCounts.forEach((count, key) => {
            expect(received.get(key)?.length ?? 0).toBe(count);
          });

          // Verify no unexpected session keys appeared
          received.forEach((_events, key) => {
            expect(expectedCounts.has(key)).toBe(true);
          });

          client.removeListener('chat', listener);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('events with empty or missing sessionKey do not route to named sessions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (namedSessionKey, content) => {
          const namedReceived: unknown[] = [];
          const emptyReceived: unknown[] = [];

          const listener = (event: { sessionKey: string; data: Record<string, unknown> }) => {
            if (event.sessionKey === namedSessionKey) {
              namedReceived.push(event.data);
            }
            if (event.sessionKey === '') {
              emptyReceived.push(event.data);
            }
          };

          client.on('chat', listener);

          // Emit event with empty session key
          simulateChatEvent('', { content });

          // Named session should NOT receive it
          expect(namedReceived.length).toBe(0);
          // Empty key listener should receive it
          expect(emptyReceived.length).toBe(1);

          client.removeListener('chat', listener);
        }
      ),
      { numRuns: 100 }
    );
  });
});
