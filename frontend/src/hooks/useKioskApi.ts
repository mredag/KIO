import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '../lib/api';
import { useKioskStore } from '../stores/kioskStore';
import {
  KioskState,
  Massage,
  SurveyTemplate,
  SurveyResponse,
  GoogleReviewConfig,
} from '../types';

// Fetch kiosk state with adaptive polling (fallback when SSE disconnected)
export function useKioskState() {
  const setMode = useKioskStore((state) => state.setMode);
  const setActiveSurveyId = useKioskStore((state) => state.setActiveSurveyId);
  const setOffline = useKioskStore((state) => state.setOffline);
  const setLastSync = useKioskStore((state) => state.setLastSync);
  const setTheme = useKioskStore((state) => state.setTheme);
  const mode = useKioskStore((state) => state.mode);
  const isUserViewingQR = useKioskStore((state) => state.isUserViewingQR);
  const isUserActive = useKioskStore((state) => state.isUserActive);

  const query = useQuery({
    queryKey: ['kiosk', 'state'],
    queryFn: async () => {
      try {
        const response = await api.get<KioskState>('/kiosk/state');
        
        // Don't override mode if user is actively viewing QR code (user-initiated)
        // But allow admin to change mode remotely in all other cases
        if (!isUserViewingQR && !isUserActive) {
        setMode(response.data.mode);
      }
      
      setActiveSurveyId(response.data.activeSurveyId || null);

      // Apply kiosk theme from settings (with fallback)
      const theme = response.data.config?.theme as 'classic' | 'immersive' | 'neo' | undefined;
      if (theme) {
        setTheme(theme === 'neo' ? 'immersive' : theme);
      }

      setOffline(false);
      setLastSync(new Date());
        
        return response.data;
      } catch (error) {
        // Set offline mode on error
        setOffline(true);
        throw error;
      }
    },
    // Adaptive polling: 
    // - Always poll every 15s to maintain heartbeat (even when SSE connected)
    // - Stop polling only when user is actively interacting
    refetchInterval: isUserActive ? false : 15000,
    retry: 2,
    retryDelay: 1000,
  });

  return { ...query, mode };
}

// Fetch massage menu with cache fallback
export function useMassageMenu() {
  const setMassages = useKioskStore((state) => state.setMassages);
  const setOffline = useKioskStore((state) => state.setOffline);
  const getCachedMassages = useKioskStore((state) => state.getCachedMassages);
  const isOffline = useKioskStore((state) => state.isOffline);

  return useQuery({
    queryKey: ['kiosk', 'menu'],
    queryFn: async () => {
      try {
        const response = await api.get<{ featured: any[]; regular: any[] }>('/kiosk/menu');
        
        // Transform snake_case to camelCase with defensive checks
        const transformMassage = (data: any): Massage => {
          // Ensure purpose_tags is an array
          const purposeTags = Array.isArray(data.purpose_tags) 
            ? data.purpose_tags 
            : [];
          
          // Ensure sessions is an array
          const sessions = Array.isArray(data.sessions)
            ? data.sessions
            : [];
          
          return {
            id: data.id || '',
            name: data.name || '',
            shortDescription: data.short_description || '',
            longDescription: data.long_description || '',
            duration: data.duration || '',
            mediaType: data.media_type || '',
            mediaUrl: data.media_url || '',
            purposeTags,
            sessions,
            isFeatured: data.is_featured === 1,
            isCampaign: data.is_campaign === 1,
            layoutTemplate: data.layout_template || 'price-list',
            sortOrder: data.sort_order || 0,
          };
        };
        
        // Ensure featured and regular are arrays
        const featured = Array.isArray(response.data.featured) ? response.data.featured : [];
        const regular = Array.isArray(response.data.regular) ? response.data.regular : [];
        
        // Flatten and transform featured and regular into single array
        const allMassages = [
          ...featured.map(transformMassage),
          ...regular.map(transformMassage)
        ];
        
        // Cache massages in store
        setMassages(allMassages);
        setOffline(false);
        
        return allMassages;
      } catch (error) {
        setOffline(true);
        
        // Return cached data when offline (Requirement 19.2)
        const cached = getCachedMassages();
        if (cached.length > 0) {
          return cached;
        }
        
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - longer to prevent video reloads
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (SSE handles real-time updates)
    refetchOnWindowFocus: false, // Don't refetch on focus - causes video reload
    retry: isOffline ? false : 2,
  });
}

// Fetch survey template with cache fallback
export function useSurveyTemplate(surveyId: string | null) {
  const setActiveSurvey = useKioskStore((state) => state.setActiveSurvey);
  const setOffline = useKioskStore((state) => state.setOffline);
  const getCachedSurvey = useKioskStore((state) => state.getCachedSurvey);
  const isOffline = useKioskStore((state) => state.isOffline);
  const isUserActive = useKioskStore((state) => state.isUserActive);

  return useQuery({
    queryKey: ['kiosk', 'survey', surveyId],
    queryFn: async () => {
      if (!surveyId) return null;
      
      try {
        const response = await api.get<SurveyTemplate>(`/kiosk/survey/${surveyId}`);
        
        // Cache survey in store
        setActiveSurvey(response.data);
        setOffline(false);
        
        return response.data;
      } catch (error) {
        setOffline(true);
        
        // Return cached survey when offline (Requirement 19.2)
        const cached = getCachedSurvey();
        if (cached && cached.id === surveyId) {
          return cached;
        }
        
        throw error;
      }
    },
    enabled: !!surveyId,
    staleTime: 10 * 1000, // 10 seconds - allow faster updates when survey changes
    refetchInterval: isUserActive ? false : 15 * 1000, // Don't refetch during active survey
    refetchOnWindowFocus: !isUserActive, // Don't refetch on focus during active survey
    retry: isOffline ? false : 2,
  });
}

// Submit survey response with offline queueing (Requirement 19.4)
export function useSubmitSurveyResponse() {
  const addQueuedResponse = useKioskStore((state) => state.addQueuedResponse);
  const isOffline = useKioskStore((state) => state.isOffline);

  return useMutation({
    mutationFn: async (response: Omit<SurveyResponse, 'id' | 'synced'>) => {
      const fullResponse: SurveyResponse = {
        ...response,
        id: crypto.randomUUID(),
        synced: false,
      };

      // If offline, queue the response (Requirement 19.4)
      if (isOffline) {
        addQueuedResponse(fullResponse);
        return fullResponse;
      }

      try {
        // Otherwise, submit to backend
        const result = await api.post<SurveyResponse>('/kiosk/survey-response', fullResponse);
        return result.data;
      } catch {
        // On error, queue the response for later (Requirement 19.4)
        addQueuedResponse(fullResponse);
        throw new Error('Failed to submit response, queued for later');
      }
    },
  });
}

// Fetch Google review config with cache fallback
export function useGoogleReviewConfig() {
  const setOffline = useKioskStore((state) => state.setOffline);
  const setGoogleReviewConfig = useKioskStore((state) => state.setGoogleReviewConfig);
  const getCachedGoogleReviewConfig = useKioskStore((state) => state.getCachedGoogleReviewConfig);
  const isOffline = useKioskStore((state) => state.isOffline);

  return useQuery({
    queryKey: ['kiosk', 'google-review'],
    queryFn: async () => {
      try {
        const response = await api.get<GoogleReviewConfig>('/kiosk/google-review');
        
        // Cache config in store
        setGoogleReviewConfig(response.data);
        setOffline(false);
        
        return response.data;
      } catch (error) {
        setOffline(true);
        
        // Return cached config when offline (Requirement 19.2)
        const cached = getCachedGoogleReviewConfig();
        if (cached) {
          return cached;
        }
        
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: isOffline ? false : 2,
  });
}

// Health check for offline detection (Requirement 19.5)
// Polls every 10 seconds when offline to detect reconnection
export function useHealthCheck() {
  const setOffline = useKioskStore((state) => state.setOffline);
  const isOffline = useKioskStore((state) => state.isOffline);

  return useQuery({
    queryKey: ['kiosk', 'health'],
    queryFn: async () => {
      try {
        const response = await api.get('/kiosk/health');
        setOffline(false);
        return response.data;
      } catch (error) {
        setOffline(true);
        throw error;
      }
    },
    refetchInterval: isOffline ? 10000 : false, // Poll every 10s when offline (Requirement 19.5)
    retry: false,
    enabled: true,
  });
}

// Sync queued responses when connection is restored (Requirement 19.6)
export function useSyncQueuedResponses() {
  const queuedResponses = useKioskStore((state) => state.queuedResponses);
  const removeQueuedResponse = useKioskStore((state) => state.removeQueuedResponse);
  const isOffline = useKioskStore((state) => state.isOffline);

  return useMutation({
    mutationFn: async () => {
      if (isOffline || queuedResponses.length === 0) {
        return { synced: 0, failed: 0 };
      }

      // Try to sync each queued response
      const results = await Promise.allSettled(
        queuedResponses.map((response) =>
          api.post('/kiosk/survey-response', response)
        )
      );

      let synced = 0;
      let failed = 0;

      // Remove successfully synced responses
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          removeQueuedResponse(queuedResponses[index].id);
          synced++;
        } else {
          failed++;
        }
      });

      return { synced, failed };
    },
  });
}

// Hook to automatically sync queued responses when connection is restored
export function useAutoSyncOnReconnect() {
  const isOffline = useKioskStore((state) => state.isOffline);
  const queuedResponses = useKioskStore((state) => state.queuedResponses);
  const { mutate: syncResponses } = useSyncQueuedResponses();

  useEffect(() => {
    // When we go from offline to online and have queued responses, sync them
    if (!isOffline && queuedResponses.length > 0) {
      // Wait a moment to ensure connection is stable
      const timer = setTimeout(() => {
        syncResponses();
      }, 1000);

      return () => clearTimeout(timer);
    }
    
    return undefined;
  }, [isOffline, queuedResponses.length, syncResponses]);
}
