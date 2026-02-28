import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface SSEEvent {
  type: 'message' | 'message_complete' | 'status' | 'typing' | 'error' | 'agent_status';
  data: Record<string, unknown>;
}

export type SSEEventCallback = (event: SSEEvent) => void;

/**
 * SSE hook for real-time Jarvis session updates.
 * Connects to /api/mc/jarvis/sessions/:id/stream and dispatches parsed events.
 * Auto-reconnects on connection loss and refetches missed messages via React Query.
 */
export function useJarvisSSE(
  sessionId: string | undefined,
  onEvent?: SSEEventCallback
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
    if (!sessionId) return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;
      cleanup();

      const es = new EventSource(`/api/mc/jarvis/sessions/${sessionId}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (ev) => {
        try {
          const parsed: SSEEvent = JSON.parse(ev.data);
          onEventRef.current?.(parsed);

          // On message_complete, invalidate messages cache to pick up persisted data
          if (parsed.type === 'message_complete') {
            qc.invalidateQueries({ queryKey: ['jarvis', 'messages', sessionId] });
          }
          // On status changes, invalidate session data
          if (parsed.type === 'status') {
            qc.invalidateQueries({ queryKey: ['jarvis', 'sessions', sessionId] });
            qc.invalidateQueries({ queryKey: ['jarvis', 'sessions'] });
          }
        } catch {
          // Ignore unparseable events
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        if (!cancelled) {
          // Reconnect after 3s, refetch missed messages
          reconnectTimerRef.current = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['jarvis', 'messages', sessionId] });
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
  }, [sessionId, cleanup, qc]);
}
