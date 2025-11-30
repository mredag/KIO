import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { KioskMode, Massage, SurveyTemplate, SurveyResponse, GoogleReviewConfig } from '../types';

interface KioskStore {
  // Current state
  mode: KioskMode;
  activeSurveyId: string | null;
  couponQrUrl: string | null;
  couponToken: string | null;
  isOffline: boolean;
  lastSync: Date | null;
  isUserViewingQR: boolean; // Flag to prevent mode override when user is viewing QR
  theme: 'classic' | 'neo' | 'immersive';

  // SSE state management
  isUserActive: boolean; // True when user is interacting (survey/QR)
  pendingModeChange: { mode: KioskMode; activeSurveyId: string | null } | null;
  sseConnected: boolean; // SSE connection status

  // Cached data
  massages: Massage[];
  activeSurvey: SurveyTemplate | null;
  googleReviewConfig: GoogleReviewConfig | null;
  
  // Offline queue
  queuedResponses: SurveyResponse[];

  // Actions
  setMode: (mode: KioskMode) => void;
  setActiveSurveyId: (id: string | null) => void;
  setCouponData: (url: string | null, token: string | null) => void;
  setOffline: (offline: boolean) => void;
  setLastSync: (date: Date) => void;
  setUserViewingQR: (viewing: boolean) => void;
  setTheme: (theme: 'classic' | 'neo' | 'immersive') => void;
  setMassages: (massages: Massage[]) => void;
  setActiveSurvey: (survey: SurveyTemplate | null) => void;
  setGoogleReviewConfig: (config: GoogleReviewConfig | null) => void;
  addQueuedResponse: (response: SurveyResponse) => void;
  clearQueuedResponses: () => void;
  removeQueuedResponse: (id: string) => void;
  
  // SSE actions
  setUserActive: (active: boolean) => void;
  setPendingModeChange: (change: { mode: KioskMode; activeSurveyId: string | null } | null) => void;
  applyPendingModeChange: () => void;
  setSseConnected: (connected: boolean) => void;
  
  // Cache fallback - returns cached data when offline
  getCachedMassages: () => Massage[];
  getCachedSurvey: () => SurveyTemplate | null;
  getCachedGoogleReviewConfig: () => GoogleReviewConfig | null;
}

export const useKioskStore = create<KioskStore>()(
  persist(
    (set, get) => ({
      // Initial state
      mode: 'digital-menu',
      activeSurveyId: null,
      couponQrUrl: null,
      couponToken: null,
      isOffline: false,
      lastSync: null,
      isUserViewingQR: false,
      theme: 'classic',
      isUserActive: false,
      pendingModeChange: null,
      sseConnected: false,
      massages: [],
      activeSurvey: null,
      googleReviewConfig: null,
      queuedResponses: [],

      // Actions
      setMode: (mode) => set({ mode }),
      setActiveSurveyId: (id) => set({ activeSurveyId: id }),
      setCouponData: (url, token) => set({ couponQrUrl: url, couponToken: token }),
      setOffline: (offline) => set({ isOffline: offline }),
      setLastSync: (date) => set({ lastSync: date }),
      setUserViewingQR: (viewing) => set({ isUserViewingQR: viewing }),
      setTheme: (theme) => set({ theme }),
      setMassages: (massages) => set({ massages }),
      setActiveSurvey: (survey) => set({ activeSurvey: survey }),
      setGoogleReviewConfig: (config) => set({ googleReviewConfig: config }),
      addQueuedResponse: (response) =>
        set((state) => ({
          queuedResponses: [...state.queuedResponses, response],
        })),
      clearQueuedResponses: () => set({ queuedResponses: [] }),
      removeQueuedResponse: (id) =>
        set((state) => ({
          queuedResponses: state.queuedResponses.filter((r) => r.id !== id),
        })),
      
      // SSE actions
      setUserActive: (active) => {
        set({ isUserActive: active });
        
        // If user becomes inactive and there's a pending change, apply it
        if (!active && get().pendingModeChange) {
          get().applyPendingModeChange();
        }
      },
      
      setPendingModeChange: (change) => set({ pendingModeChange: change }),
      
      applyPendingModeChange: () => {
        const pending = get().pendingModeChange;
        if (pending) {
          set({
            mode: pending.mode,
            activeSurveyId: pending.activeSurveyId,
            pendingModeChange: null,
          });
        }
      },
      
      setSseConnected: (connected) => set({ sseConnected: connected }),
      
      // Cache fallback methods
      getCachedMassages: () => get().massages,
      getCachedSurvey: () => get().activeSurvey,
      getCachedGoogleReviewConfig: () => get().googleReviewConfig,
    }),
    {
      name: 'kiosk-storage',
      partialize: (state) => ({
        // Don't persist isUserActive and pendingModeChange - they should reset on page load
        mode: state.mode,
        activeSurveyId: state.activeSurveyId,
        isOffline: state.isOffline,
        lastSync: state.lastSync,
        isUserViewingQR: state.isUserViewingQR,
        theme: state.theme,
        massages: state.massages,
        activeSurvey: state.activeSurvey,
        googleReviewConfig: state.googleReviewConfig,
        queuedResponses: state.queuedResponses,
        // Explicitly exclude isUserActive, pendingModeChange, sseConnected
      }),
    }
  )
);
