import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMassageMenu, useKioskState, useGoogleReviewConfig } from '../../hooks/useKioskApi';
import { Massage } from '../../types';
import MassageList from './MassageList';
import MassageDetailPanel from './MassageDetailPanel';
import SlideshowMode from './SlideshowMode';
import NeoDigitalMenu from './NeoDigitalMenu';
import ShowcaseMode from './ShowcaseMode';
import { useKioskStore } from '../../stores/kioskStore';
import { useMemo } from 'react';

export default function DigitalMenuMode() {
  const { t } = useTranslation('kiosk');
  const { data: massages, isLoading, isError } = useMassageMenu();
  const { data: kioskState } = useKioskState();
  const { data: googleReviewConfig } = useGoogleReviewConfig();
  const theme = useKioskStore((state) => state.theme);
  const setMode = useKioskStore((state) => state.setMode);
  const setUserViewingQR = useKioskStore((state) => state.setUserViewingQR);
  const [selectedMassage, setSelectedMassage] = useState<Massage | null>(null);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  // Sort massages by sortOrder (Requirement 4.7) with memoization to reduce recalculations
  const sortedMassages = useMemo(
    () => (massages && Array.isArray(massages)
      ? [...massages].sort((a, b) => a.sortOrder - b.sortOrder)
      : []),
    [massages]
  );

  // Auto-select first massage if none selected (using useEffect to avoid setState during render)
  useEffect(() => {
    if (sortedMassages.length > 0 && !selectedMassage) {
      setSelectedMassage(sortedMassages[0]);
    }
  }, [sortedMassages, selectedMassage]);

  // Get slideshow timeout from kiosk state config (Requirement 3.5)
  const slideshowTimeout = kioskState?.config?.slideshowTimeout || 60; // Default 60 seconds

  // Reset inactivity timer (Requirement 3.1, 3.4)
  const resetInactivityTimer = useCallback(() => {
    // Update last interaction timestamp
    lastInteractionRef.current = Date.now();

    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Exit slideshow if active (Requirement 3.4)
    if (isSlideshow) {
      setIsSlideshow(false);
    }

    // Set new timer to activate slideshow after timeout (Requirement 3.1)
    inactivityTimerRef.current = setTimeout(() => {
      setIsSlideshow(true);
    }, slideshowTimeout * 1000); // Convert seconds to milliseconds
  }, [slideshowTimeout, isSlideshow]);

  // Set up inactivity detection (Requirement 3.1)
  useEffect(() => {
    // Start inactivity timer
    resetInactivityTimer();

    // Listen for touch events to reset timer (Requirement 3.4)
    const handleInteraction = () => {
      resetInactivityTimer();
    };

    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('click', handleInteraction);

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [resetInactivityTimer]);

  // Exit slideshow handler (Requirement 3.4)
  const handleExitSlideshow = useCallback(() => {
    setIsSlideshow(false);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">{t('menu.loading')}</p>
        </div>
      </div>
    );
  }

  if (isError || !massages || massages.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-950">
        <div className="text-center text-gray-500">
          <svg
            className="w-24 h-24 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xl mb-2">{t('menu.noMassages')}</p>
        </div>
      </div>
    );
  }

  // Show slideshow if active (Requirement 3.1, 3.2, 3.3)
  if (isSlideshow) {
    return (
      <SlideshowMode
        massages={sortedMassages}
        onExit={handleExitSlideshow}
      />
    );
  }

  // Render ShowcaseMode when showcase theme is active (Requirement 7.3)
  if (theme === 'showcase') {
    return <ShowcaseMode massages={sortedMassages} />;
  }

  if (theme === 'immersive') {
    return <NeoDigitalMenu massages={sortedMassages} />;
  }

  return (
    <div className="h-full w-full flex bg-black relative">
      {/* Left column - Massage list (1/5 width) (Requirement 2.1) */}
      <MassageList
        massages={sortedMassages}
        selectedMassageId={selectedMassage?.id || null}
        onSelectMassage={(massage) => {
          setSelectedMassage(massage);
          // Reset timer when user selects a massage (they're reading)
          resetInactivityTimer();
        }}
      />

      {/* Right panel - Massage details (4/5 width) (Requirement 2.3) */}
      <MassageDetailPanel massage={selectedMassage} />

      {googleReviewConfig && (
        <div className="absolute bottom-6 right-6 z-30 pointer-events-none">
          <button
            onClick={() => {
              setUserViewingQR(true);
              setMode('google-qr');
            }}
            className="pointer-events-auto group rounded-full bg-gradient-to-r from-emerald-500/90 to-cyan-500/90 hover:from-emerald-400 hover:to-cyan-400 text-white px-4 py-3 shadow-[0_10px_40px_rgba(16,185,129,0.35)] flex items-center gap-3 transition-transform duration-200 hover:scale-105"
            aria-label={t('googleReview.openCta')}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/20 shadow-inner">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold leading-tight">{t('googleReview.ctaTitle')}</span>
              <span className="text-xs text-white/80 leading-tight">{t('googleReview.ctaSubtitle')}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
              {t('googleReview.ctaButton')}
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
