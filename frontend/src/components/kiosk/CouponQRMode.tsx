import { useEffect, useState, useCallback, useRef } from 'react';
import { useKioskStore } from '../../stores/kioskStore';
import { useKioskTheme } from '../../lib/kioskTheme';
import QRCode from 'qrcode';
import api from '../../lib/api';

const COUNTDOWN_SECONDS = 60; // 60 seconds countdown

/**
 * Coupon QR Mode Component
 * Displays a coupon QR code on the kiosk screen for customers to scan
 * Auto-returns to digital-menu after countdown
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */
export default function CouponQRMode() {
  const couponQrUrl = useKioskStore((state) => state.couponQrUrl);
  const couponToken = useKioskStore((state) => state.couponToken);
  const setMode = useKioskStore((state) => state.setMode);
  const setCouponData = useKioskStore((state) => state.setCouponData);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const hasReturnedRef = useRef(false);
  
  // Get theme classes with couponQr variant (Requirements: 17.1-17.5)
  const { getThemeClasses, theme } = useKioskTheme();
  const classes = getThemeClasses('couponQr');

  // Return to digital-menu mode - also notify backend
  const returnToMenu = useCallback(async () => {
    if (hasReturnedRef.current) return;
    hasReturnedRef.current = true;
    
    // Clear local coupon data first
    setCouponData(null, null);
    setMode('digital-menu');
    
    // Notify backend to change mode (fire and forget)
    try {
      await api.put('/kiosk/mode-timeout');
    } catch (error) {
      console.error('Failed to notify backend of mode timeout:', error);
    }
  }, [setMode, setCouponData]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      returnToMenu();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, returnToMenu]);

  // Reset countdown when coupon changes
  useEffect(() => {
    setCountdown(COUNTDOWN_SECONDS);
  }, [couponQrUrl, couponToken]);

  // Generate QR code when URL changes
  useEffect(() => {
    if (couponQrUrl) {
      QRCode.toDataURL(couponQrUrl, {
        width: 500,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).then(setQrCodeUrl).catch(console.error);
    }
  }, [couponQrUrl]);

  // Loading state
  if (!couponQrUrl || !qrCodeUrl) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${classes.container}`}>
        {classes.overlay && <div className={`absolute inset-0 ${classes.overlay}`} />}
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={`text-2xl ${classes.title}`}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Format countdown as MM:SS
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const countdownDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Main display (Requirements: 17.1-17.5)
  return (
    <div className={`h-full w-full flex flex-col items-center justify-center ${classes.container} p-8`}>
      {/* Theme overlay for neo/immersive themes */}
      {classes.overlay && <div className={`absolute inset-0 ${classes.overlay}`} />}
      
      {/* Countdown Timer - Top Right (Requirement 17.5) */}
      <div className="absolute top-6 right-6 bg-black/40 px-6 py-3 rounded-2xl z-10">
        <div className="text-center">
          <p className={`text-sm ${classes.accent} mb-1`}>Kalan Süre</p>
          <p className={`text-3xl font-mono font-bold ${countdown <= 10 ? 'text-red-400 animate-pulse' : classes.title}`}>
            {countdownDisplay}
          </p>
        </div>
      </div>

      {/* Header (Requirement 17.1) */}
      <div className="text-center mb-8 relative z-10">
        <h1 className={`text-5xl font-bold ${classes.title} mb-4`}>
          🎁 Kupon Kazanın!
        </h1>
        <p className={`text-2xl ${classes.accent}`}>
          WhatsApp ile QR kodu tarayın
        </p>
      </div>

      {/* QR Code (Requirement 17.1) */}
      <div className={`${classes.qrContainer} mb-8 relative z-10 ${theme.animations.glowEffect ? 'animate-pulse-subtle' : ''}`}>
        <img 
          src={qrCodeUrl} 
          alt="Coupon QR Code" 
          className="w-96 h-96"
        />
      </div>

      {/* Token Display */}
      {couponToken && (
        <div className="text-center relative z-10">
          <p className={`text-xl ${classes.accent} mb-2`}>Kupon Kodu:</p>
          <p className={`text-4xl font-mono font-bold ${classes.title} tracking-widest bg-black/30 px-8 py-4 rounded-xl`}>
            {couponToken}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className={`mt-8 text-center ${classes.subtitle} text-lg max-w-lg relative z-10`}>
        <p>QR kodu tarayarak WhatsApp'ta kuponunuzu aktifleştirin.</p>
        <p className={`mt-2 ${classes.accent}`}>4 kupon = 1 ücretsiz masaj!</p>
      </div>

      {/* Progress Bar (Requirements: 17.1, 17.5) */}
      <div className={`absolute bottom-0 left-0 right-0 h-2 ${classes.progressTrack}`}>
        <div 
          className={`h-full ${classes.progressFill}`}
          style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
        />
      </div>
    </div>
  );
}
