import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface ActivitySSEItem {
  id: string;
  event_type: string;
  entity_type: string;
  message: string;
  created_at: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export function useActivitySSE() {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const [liveItems, setLiveItems] = useState<ActivitySSEItem[]>([]);

  const clearLive = useCallback(() => setLiveItems([]), []);

  useEffect(() => {
    const es = new EventSource('/api/mc/activity/stream', { withCredentials: true });
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'connected') return;
        if (parsed.type === 'activity' && parsed.data) {
          setLiveItems(prev => [parsed.data, ...prev].slice(0, 100));
          qc.invalidateQueries({ queryKey: ['activity'] });
          qc.invalidateQueries({ queryKey: ['mc'] });
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => {
        if (esRef.current === es) esRef.current = null;
      }, 5000);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [qc]);

  return { liveItems, clearLive };
}
