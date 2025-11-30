import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useKioskStore } from '../stores/kioskStore';

/**
 * useKioskEvents Hook
 * Manages Server-Sent Events (SSE) connection for real-time kiosk updates
 * 
 * Features:
 * - Real-time mode change notifications
 * - Smart queueing during user interactions
 * - Automatic reconnection on failure
 * - Fallback to polling when SSE unavailable
 */
export function useKioskEvents() {
  const setMode = useKioskStore((state) => state.setMode);
  const setActiveSurveyId = useKioskStore((state) => state.setActiveSurveyId);
  const setCouponData = useKioskStore((state) => state.setCouponData);
  const setPendingModeChange = useKioskStore((state) => state.setPendingModeChange);
  const isUserActive = useKioskStore((state) => state.isUserActive);
  const setSseConnected = useKioskStore((state) => state.setSseConnected);
  const queryClient = useQueryClient();
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const connect = () => {
      try {
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        console.log('[SSE] Connecting to event stream...');
        console.log('[SSE] isUserActive:', isUserActive);
        const eventSource = new EventSource('/api/kiosk/events');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('[SSE] Connected successfully');
          setSseConnected(true);
          reconnectAttemptsRef.current = 0;
        };

        eventSource.addEventListener('connected', (event) => {
          const data = JSON.parse(event.data);
          console.log('[SSE] Connection confirmed:', data);
        });

        eventSource.addEventListener('mode-change', (event) => {
          const eventData = JSON.parse(event.data);
          console.log('[SSE] Mode change received:', eventData);
          
          // Extract the actual data from the event
          const { mode, activeSurveyId, couponQrUrl, couponToken } = eventData.data || eventData;
          
          // Update coupon data if present
          if (couponQrUrl !== undefined) {
            setCouponData(couponQrUrl, couponToken);
          }
          
          // Get current state
          const state = useKioskStore.getState();
          const currentMode = state.mode;
          const currentSurveyId = state.activeSurveyId;
          const currentUserActive = state.isUserActive;
          
          // If changing to a different mode, always apply immediately
          if (mode !== currentMode) {
            console.log('[SSE] Mode changing, applying immediately:', { from: currentMode, to: mode });
            setMode(mode);
            setActiveSurveyId(activeSurveyId);
          }
          // If changing survey (different activeSurveyId), apply immediately even if user is active
          else if (activeSurveyId !== currentSurveyId) {
            console.log('[SSE] Survey changing, applying immediately:', { from: currentSurveyId, to: activeSurveyId });
            setActiveSurveyId(activeSurveyId);
          }
          // Same mode and same survey, but user is active - queue the change
          else if (currentUserActive) {
            console.log('[SSE] Same mode/survey, user active, queueing:', { mode, activeSurveyId });
            setPendingModeChange({
              mode,
              activeSurveyId,
            });
          }
          // Same mode/survey, user not active - apply immediately
          else {
            console.log('[SSE] Applying mode change immediately:', { mode, activeSurveyId });
            setMode(mode);
            setActiveSurveyId(activeSurveyId);
          }
        });

        eventSource.addEventListener('survey-update', (event) => {
          const eventData = JSON.parse(event.data);
          const { surveyId } = eventData.data || eventData;
          console.log('[SSE] Survey update received:', surveyId);
          
          // Invalidate survey cache to refetch
          queryClient.invalidateQueries({ queryKey: ['kiosk', 'survey', surveyId] });
        });

        eventSource.addEventListener('menu-update', () => {
          console.log('[SSE] Menu update received');
          
          // Invalidate menu cache to refetch
          queryClient.invalidateQueries({ queryKey: ['kiosk', 'menu'] });
        });

        eventSource.addEventListener('settings-update', () => {
          console.log('[SSE] Settings update received');
          
          // Invalidate state cache to refetch settings
          queryClient.invalidateQueries({ queryKey: ['kiosk', 'state'] });
        });

        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error);
          setSseConnected(false);
          eventSource.close();
          
          // Exponential backoff for reconnection
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        };
      } catch (error) {
        console.error('[SSE] Failed to create connection:', error);
        setSseConnected(false);
        
        // Retry after 5 seconds
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      console.log('[SSE] Cleaning up connection');
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      setSseConnected(false);
    };
  }, [setMode, setActiveSurveyId, setCouponData, setPendingModeChange, setSseConnected, queryClient]);
  // Note: isUserActive removed from deps to prevent reconnection on every state change
}
