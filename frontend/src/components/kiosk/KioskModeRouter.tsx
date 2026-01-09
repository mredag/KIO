import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../../stores/kioskStore';
import { useKioskState, useHealthCheck, useAutoSyncOnReconnect } from '../../hooks/useKioskApi';
import { useKioskEvents } from '../../hooks/useKioskEvents';
import DigitalMenuMode from './DigitalMenuMode';
import SurveyMode from './SurveyMode';
import GoogleQRMode from './GoogleQRMode';
import CouponQRMode from './CouponQRMode';
import SlideshowMode from './SlideshowMode';

/**
 * Kiosk Mode Router Component
 * Performance optimized for Raspberry Pi (Requirements 17.1, 17.2, 17.5)
 */
export default function KioskModeRouter() {
  const { t } = useTranslation('kiosk');
  const mode = useKioskStore((state) => state.mode);
  const isOffline = useKioskStore((state) => state.isOffline);
  const pendingModeChange = useKioskStore((state) => state.pendingModeChange);
  const [displayMode, setDisplayMode] = useState(mode);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // SSE connection for real-time updates
  useKioskEvents();

  // Fallback polling when SSE disconnected (Requirement 1.3)
  useKioskState();

  // Health check for offline detection (Requirement 19.5)
  useHealthCheck();

  // Auto-sync queued responses when reconnected (Requirement 19.6)
  useAutoSyncOnReconnect();

  // Handle mode transitions with 300ms fade animation (Requirements 1.3, 19.7, 17.2)
  // Optimized for Raspberry Pi performance (Requirements 17.1, 17.5)
  useEffect(() => {
    if (mode !== displayMode && !isTransitioning) {
      setIsTransitioning(true);

      const container = document.getElementById('kiosk-mode-container');
      if (!container) {
        setDisplayMode(mode);
        setIsTransitioning(false);
        return;
      }

      // Add will-change for performance hint (Requirement 17.5)
      container.classList.add('will-change-opacity');

      // Fade out using CSS transition (150ms)
      container.style.opacity = '0';

      setTimeout(() => {
        // Switch mode at midpoint
        setDisplayMode(mode);

        // Fade in (150ms)
        container.style.opacity = '1';

        // Remove will-change after animation completes (Requirement 17.5)
        setTimeout(() => {
          container.classList.remove('will-change-opacity');
          setIsTransitioning(false);
        }, 150);
      }, 150);
    }
  }, [mode, displayMode, isTransitioning]);

  // Get massages for slideshow mode
  const massages = useKioskStore((state) => state.massages);
  const setMode = useKioskStore((state) => state.setMode);

  // Render the appropriate mode component
  const renderMode = () => {
    switch (displayMode) {
      case 'digital-menu':
        return <DigitalMenuMode />;
      case 'survey':
        return <SurveyMode />;
      case 'google-qr':
        return <GoogleQRMode />;
      case 'coupon-qr':
        return <CouponQRMode />;
      case 'slideshow':
        return <SlideshowMode massages={massages} onExit={() => setMode('digital-menu')} />;
      default:
        return <DigitalMenuMode />;
    }
  };

  return (
    <div className="h-full w-full relative">
      {/* Offline indicator (Requirement 19.7) */}
      {isOffline && (
        <div className="absolute top-4 right-4 z-50 bg-yellow-500 text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {t('offline.indicator')} - {t('offline.message')}
        </div>
      )}

      {/* Pending mode change indicator */}
      {pendingModeChange && (
        <div className="absolute top-4 left-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <svg
            className="w-5 h-5 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Mod değişikliği bekliyor...
        </div>
      )}

      {/* Mode content with transition */}
      <div
        id="kiosk-mode-container"
        className="h-full w-full fade-transition"
        style={{ opacity: 1 }}
      >
        {renderMode()}
      </div>
    </div>
  );
}
