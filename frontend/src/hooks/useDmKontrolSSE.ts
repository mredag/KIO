import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface DmSSEEvent {
  type: 'dm:new' | 'dm:alert' | 'dm:health_update' | 'connected';
  data: Record<string, unknown>;
}

export type DmSSEEventCallback = (event: DmSSEEvent) => void;

/**
 * SSE hook for real-time DM Kontrol updates.
 * Connects to /api/mc/dm-kontrol/stream.
 * Auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s).
 * Invalidates React Query caches on dm:new and dm:health_update events.
 */
export function useDmKontrolSSE(onEvent?: DmSSEEventCallback) {
  const qc = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const onEventRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);
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
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      cleanup();

      const es = new EventSource('/api/mc/dm-kontrol/stream');
      eventSourceRef.current = es;

      es.onmessage = (ev) => {
        try {
          const parsed: DmSSEEvent = JSON.parse(ev.data);
          attemptRef.current = 0;
          setConnected(true);
          onEventRef.current?.(parsed);

          switch (parsed.type) {
            case 'dm:new':
              qc.invalidateQueries({ queryKey: ['dm-feed'] });
              qc.invalidateQueries({ queryKey: ['dm-errors'] });
              break;
            case 'dm:health_update':
              qc.invalidateQueries({ queryKey: ['dm-health'] });
              qc.invalidateQueries({ queryKey: ['dm-model-stats'] });
              break;
            case 'dm:alert':
              qc.invalidateQueries({ queryKey: ['dm-errors'] });
              break;
          }
        } catch {
          // Ignore unparseable events
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setConnected(false);
        if (!cancelled) {
          const delay = Math.min(Math.pow(2, attemptRef.current) * 1000, 30000);
          attemptRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      setConnected(false);
      cleanup();
    };
  }, [cleanup, qc]);

  return { connected };
}
