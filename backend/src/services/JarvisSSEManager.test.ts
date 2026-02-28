import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { JarvisSSEManager, SSEEvent } from './JarvisSSEManager.js';

/**
 * Feature: jarvis-task-orchestration, Property 16: SSE status event on state change
 *
 * For any job status transition (queued → running, running → completed, running → failed),
 * the system should push an SSE event with type "status" containing the new status
 * to all clients connected to the associated session's stream.
 *
 * Validates: Requirements 10.3
 */
describe('Property 16: SSE status event on state change', () => {
  let manager: JarvisSSEManager;

  function createMockResponse(): { res: any; written: string[] } {
    const written: string[] = [];
    const closeHandlers: (() => void)[] = [];
    const res = {
      writeHead: vi.fn(),
      write: vi.fn((data: string) => {
        written.push(data);
        return true;
      }),
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'close') {
          closeHandlers.push(handler);
        }
      }),
      triggerClose: () => {
        closeHandlers.forEach((h) => h());
      },
    };
    return { res, written };
  }

  beforeEach(() => {
    JarvisSSEManager.resetInstance();
    manager = JarvisSSEManager.getInstance();
  });

  afterEach(() => {
    JarvisSSEManager.resetInstance();
  });

  const statusTransitions = ['queued', 'running', 'completed', 'failed'] as const;

  it('status events are delivered to all clients of the target session', () => {
    fc.assert(
      fc.property(
        // Session ID
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        // Number of clients for this session (1..5)
        fc.integer({ min: 1, max: 5 }),
        // New status value
        fc.constantFrom(...statusTransitions),
        (sessionId, clientCount, newStatus) => {
          JarvisSSEManager.resetInstance();
          const mgr = JarvisSSEManager.getInstance();

          const mocks = Array.from({ length: clientCount }, () => createMockResponse());
          mocks.forEach(({ res }) => mgr.addClient(sessionId, res));

          const event: SSEEvent = {
            type: 'status',
            data: { status: newStatus },
          };
          mgr.pushEvent(sessionId, event);

          const expectedPayload = `data: ${JSON.stringify(event)}\n\n`;

          // Every client should have received exactly one write with the status event
          for (const { written } of mocks) {
            expect(written).toHaveLength(1);
            expect(written[0]).toBe(expectedPayload);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status events are NOT delivered to clients of other sessions', () => {
    fc.assert(
      fc.property(
        // Two distinct session IDs
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.constantFrom(...statusTransitions),
        (sessionA, sessionBSuffix, newStatus) => {
          // Ensure distinct session IDs
          const sessionB = sessionA + '_other_' + sessionBSuffix;

          JarvisSSEManager.resetInstance();
          const mgr = JarvisSSEManager.getInstance();

          const mockA = createMockResponse();
          const mockB = createMockResponse();
          mgr.addClient(sessionA, mockA.res);
          mgr.addClient(sessionB, mockB.res);

          const event: SSEEvent = {
            type: 'status',
            data: { status: newStatus },
          };
          mgr.pushEvent(sessionA, event);

          // Session A client should receive the event
          expect(mockA.written).toHaveLength(1);
          // Session B client should NOT receive anything
          expect(mockB.written).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('status event payload contains the correct type and new status for any transition', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0),
        fc.constantFrom(...statusTransitions),
        (sessionId, newStatus) => {
          JarvisSSEManager.resetInstance();
          const mgr = JarvisSSEManager.getInstance();

          const mock = createMockResponse();
          mgr.addClient(sessionId, mock.res);

          const event: SSEEvent = {
            type: 'status',
            data: { status: newStatus },
          };
          mgr.pushEvent(sessionId, event);

          // Parse the SSE payload back
          const raw = mock.written[0];
          expect(raw).toMatch(/^data: .+\n\n$/);
          const parsed = JSON.parse(raw.replace('data: ', '').trim());
          expect(parsed.type).toBe('status');
          expect(parsed.data.status).toBe(newStatus);
        }
      ),
      { numRuns: 100 }
    );
  });
});
