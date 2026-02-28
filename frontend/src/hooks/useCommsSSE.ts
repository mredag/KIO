import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface CommsSSEEvent {
  type: 'message_sent' | 'broadcast_sent' | 'memory_write' | 'board_status_changed';
  data: Record<string, unknown>;
}

export type CommsSSEEventCallback = (event: CommsSSEEvent) => void;

/**
 * SSE hook for real-time agent comms updates.
 * Connects to /api/mc/boards/:boardId/stream and dispatches parsed events.
 * Auto-reconnects on connection loss and invalidates React Query caches.
 */
export function useCommsSSE(
  boardId: string | undefined,
  onEvent?: CommsSSEEventCallback
) {
  const qc = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!boardId) return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;
      cleanup();

      const es = new EventSource(`/api/mc/boards/${boardId}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (ev) => {
        try {
          const parsed: CommsSSEEvent = JSON.parse(ev.data);
          onEventRef.current?.(parsed);

          switch (parsed.type) {
            case 'message_sent':
            case 'broadcast_sent':
              qc.invalidateQueries({ queryKey: ['comms-messages'] });
              break;
            case 'memory_write':
              qc.invalidateQueries({ queryKey: ['shared-memory'] });
              break;
            case 'board_status_changed':
              qc.invalidateQueries({ queryKey: ['boards'] });
              qc.invalidateQueries({ queryKey: ['board', boardId] });
              break;
          }
        } catch {
          // Ignore unparseable events
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['comms-messages'] });
            qc.invalidateQueries({ queryKey: ['board', boardId] });
            connect();
          }, 3000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [boardId, cleanup, qc]);
}
