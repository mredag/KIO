import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAutoPilotSSE() {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/mc/autopilot/stream', { withCredentials: true });
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        // Invalidate queries on meaningful events
        if (['job_completed', 'job_failed', 'job_dispatched', 'scan_complete', 'status', 'config_updated'].includes(parsed.type)) {
          qc.invalidateQueries({ queryKey: ['autopilot'] });
        }
        // Also refresh MC jobs/events on job state changes
        if (['job_completed', 'job_failed', 'job_dispatched'].includes(parsed.type)) {
          qc.invalidateQueries({ queryKey: ['mc'] });
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5s
      setTimeout(() => {
        if (esRef.current === es) {
          esRef.current = null;
        }
      }, 5000);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [qc]);
}
