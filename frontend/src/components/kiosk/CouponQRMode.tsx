import { useEffect, useState, useCallback } from 'react';
import { useKioskStore } from '../../stores/kioskStore';
import QRCode from 'qrcode';

const COUNTDOWN_SECONDS = 60; // 60 seconds countdown

/**
 * Coupon QR Mode Component
 * Displays a coupon QR code on the kiosk screen for customers to scan
 * Auto-returns to digital-menu after countdown
 */
export default function CouponQRMode() {
  const couponQrUrl = useKioskStore((state) => state.couponQrUrl);
  const couponToken = useKioskStore((state) => state.couponToken);
  const setMode = useKioskStore((state) => state.setMode);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // Return to digital-menu mode
  const returnToMenu = useCallback(() => {
    setMode('digital-menu');
  }, [setMode]);

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

  if (!couponQrUrl || !qrCodeUrl) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-white text-2xl">Yükleniyor...</div>
      </div>
    );
  }

  // Format countdown as MM:SS
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const countdownDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 p-8 relative">
      {/* Countdown Timer - Top Right */}
      <div className="absolute top-6 right-6 bg-black/40 px-6 py-3 rounded-2xl">
        <div className="text-center">
          <p className="text-sm text-emerald-300 mb-1">Kalan Süre</p>
          <p className={`text-3xl font-mono font-bold ${countdown <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {countdownDisplay}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-white mb-4">
          🎁 Kupon Kazanın!
        </h1>
        <p className="text-2xl text-emerald-200">
          WhatsApp ile QR kodu tarayın
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-white p-8 rounded-3xl shadow-2xl mb-8">
        <img 
          src={qrCodeUrl} 
          alt="Coupon QR Code" 
          className="w-96 h-96"
        />
      </div>

      {/* Token Display */}
      {couponToken && (
        <div className="text-center">
          <p className="text-xl text-emerald-200 mb-2">Kupon Kodu:</p>
          <p className="text-4xl font-mono font-bold text-white tracking-widest bg-black/30 px-8 py-4 rounded-xl">
            {couponToken}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 text-center text-emerald-100 text-lg max-w-lg">
        <p>QR kodu tarayarak WhatsApp'ta kuponunuzu aktifleştirin.</p>
        <p className="mt-2 text-emerald-300">4 kupon = 1 ücretsiz masaj!</p>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
        <div 
          className="h-full bg-emerald-400 transition-all duration-1000 ease-linear"
          style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
        />
      </div>
    </div>
  );
}
