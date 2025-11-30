import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGoogleReviewConfig } from '../../hooks/useKioskApi';
import { useKioskStore } from '../../stores/kioskStore';
import { useKioskTheme } from '../../lib/kioskTheme';

/**
 * Google Review QR Mode Component
 * Displays QR code for Google review with animated description
 * Requirements: 8.1, 8.2, 8.3, 16.1, 16.2, 16.3, 16.4, 16.5
 * Performance optimized for Raspberry Pi (Requirements 17.1, 17.5)
 */
export default function GoogleQRMode() {
  const { t } = useTranslation('kiosk');
  const { data: config, isLoading, error } = useGoogleReviewConfig();
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const setMode = useKioskStore((state) => state.setMode);
  const setUserViewingQR = useKioskStore((state) => state.setUserViewingQR);
  
  // Get theme classes (Requirements: 16.1, 16.2, 16.3, 16.4, 16.5)
  const { getThemeClasses, theme } = useKioskTheme();
  const classes = getThemeClasses('googleQr');
  
  // Note: We don't set isUserActive for QR mode because it's okay to interrupt it
  // Only surveys need protection from interruption

  // Handle close button click
  const handleClose = () => {
    // Clear the flag to allow mode updates from server
    setUserViewingQR(false);
    
    // Check if we should return to survey mode
    const returnToSurvey = sessionStorage.getItem('returnToSurvey');
    if (returnToSurvey === 'true') {
      sessionStorage.removeItem('returnToSurvey');
      setMode('survey');
    } else {
      // Otherwise return to digital menu (default kiosk mode)
      setMode('digital-menu');
    }
  };

  // Animate description text with vertical movement using CSS (Requirement 8.3)
  // Optimized for Raspberry Pi performance (Requirements 17.1, 17.5)
  useEffect(() => {
    if (config && descriptionRef.current) {
      // Add will-change for performance hint (Requirement 17.5)
      const element = descriptionRef.current;
      element.classList.add('will-change-transform');
      
      // CSS animation handles the infinite loop
      // Cleanup: remove will-change when component unmounts
      return () => {
        element.classList.remove('will-change-transform');
      };
    }
    
    return undefined;
  }, [config]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${classes.container}`}>
        {classes.overlay && <div className={`absolute inset-0 ${classes.overlay}`} />}
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={`text-lg ${classes.subtitle}`}>{t('googleReview.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !config) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${classes.container}`}>
        {classes.overlay && <div className={`absolute inset-0 ${classes.overlay}`} />}
        <div className="text-center max-w-md px-8 relative z-10">
          <svg
            className="w-20 h-20 text-red-500 mx-auto mb-4"
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
          <h2 className={`text-2xl ${classes.title} mb-2`}>
            {t('googleReview.error')}
          </h2>
          <p className={classes.subtitle}>
            {t('googleReview.errorMessage')}
          </p>
        </div>
      </div>
    );
  }

  // Main display (Requirements: 8.1, 8.2, 8.3, 16.1-16.5)
  return (
    <div className={`h-full w-full flex flex-col items-center justify-center ${classes.container}`}>
      {/* Theme overlay for neo/immersive themes */}
      {classes.overlay && <div className={`absolute inset-0 ${classes.overlay}`} />}
      
      {/* Close button - Large and easy to tap for kiosk use (Requirement 16.5) */}
      <button
        onClick={handleClose}
        className={`absolute top-8 right-8 w-20 h-20 ${classes.closeButton}`}
        aria-label={t('aria.closeGoogleReview')}
      >
        <svg
          className="w-10 h-10 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Title text from configuration (Requirements: 8.1, 16.1) */}
      <h1 className={`text-5xl md:text-6xl ${classes.title} mb-12 text-center relative z-10`}>
        {config.title}
      </h1>

      {/* QR code in center (Requirements: 8.1, 8.2, 16.1) */}
      <div className={`${classes.qrContainer} mb-12 relative z-10 ${theme.animations.glowEffect ? 'animate-pulse-subtle' : ''}`}>
        <img
          src={config.qrCode}
          alt="Google Review QR Code"
          className="w-80 h-80 md:w-96 md:h-96"
        />
      </div>

      {/* Description text with vertical movement animation (Requirements: 8.1, 8.3, 16.1) */}
      <p
        ref={descriptionRef}
        className={`text-2xl md:text-3xl ${classes.subtitle} text-center max-w-2xl leading-relaxed relative z-10 ${theme.animations.floatAnimation ? 'float-vertical' : ''}`}
      >
        {config.description}
      </p>

      {/* Optional: Visual indicator for scanning */}
      <div className={`mt-12 flex items-center gap-3 ${classes.subtitle} relative z-10`}>
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <span className="text-lg">{t('googleReview.scanPrompt')}</span>
      </div>
    </div>
  );
}
