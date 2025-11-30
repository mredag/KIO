import { useEffect, useState } from 'react';
import { useKioskStore } from '../../stores/kioskStore';
import QRCode from 'qrcode';

/**
 * Coupon QR Mode Component
 * Displays a coupon QR code on the kiosk screen for customers to scan
 */
export default function CouponQRMode() {
  const couponQrUrl = useKioskStore((state) => state.couponQrUrl);
  const couponToken = useKioskStore((state) => state.couponToken);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

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

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 p-8">
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
    </div>
  );
}
