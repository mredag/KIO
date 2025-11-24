import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMassageMenu, useKioskState } from '../../hooks/useKioskApi';
import { Massage } from '../../types';
import MassageList from './MassageList';
import MassageDetailPanel from './MassageDetailPanel';
import SlideshowMode from './SlideshowMode';

export default function DigitalMenuMode() {
  const { t } = useTranslation('kiosk');
  const { data: massages, isLoading, isError } = useMassageMenu();
  const { data: kioskState } = useKioskState();
  const [selectedMassage, setSelectedMassage] = useState<Massage | null>(null);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sort massages by sortOrder (Requirement 4.7)
  const sortedMassages = massages && Array.isArray(massages)
    ? [...massages].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

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

  return (
    <div className="h-full w-full flex bg-black">
      {/* Left column - Massage list (1/5 width) (Requirement 2.1) */}
      <MassageList
        massages={sortedMassages}
        selectedMassageId={selectedMassage?.id || null}
        onSelectMassage={setSelectedMassage}
      />

      {/* Right panel - Massage details (4/5 width) (Requirement 2.3) */}
      <MassageDetailPanel massage={selectedMassage} />
    </div>
  );
}
