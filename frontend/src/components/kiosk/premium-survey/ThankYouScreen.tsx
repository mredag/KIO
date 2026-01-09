/**
 * ThankYouScreen Component
 * 
 * Displays animated checkmark with glow rings, floating celebration emojis,
 * and localized thank you message.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

interface ThankYouScreenProps {
  /** Custom thank you message (from database) */
  message?: string;
  /** Custom sub-message */
  subMessage?: string;
  /** Whether to show celebration emojis */
  showCelebration?: boolean;
  /** Whether to show confetti effect */
  showConfetti?: boolean;
}

/** Celebration emojis to display */
const CELEBRATION_EMOJIS = ['🎉', '✨', '💫', '🌟', '⭐', '🎊', '💖', '🙏'];

/** Confetti colors */
const CONFETTI_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#10b981', '#06b6d4', '#6366f1', '#8b5cf6',
];

/**
 * Generates confetti pieces with random positions and colors
 */
function generateConfetti(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    delay: `${Math.random() * 2}s`,
    shape: Math.random() > 0.5 ? 'circle' : 'square',
  }));
}

export default function ThankYouScreen({
  message,
  subMessage,
  showCelebration = true,
  showConfetti = true,
}: ThankYouScreenProps) {
  const { t } = useTranslation('kiosk');

  // Default messages from i18n
  const thankYouMessage = message || t('survey.satisfaction.thankYou', 'Teşekkür Ederiz!');
  const thankYouSubMessage = subMessage || t('survey.discovery.thankYouMessage', 'Geri bildiriminiz bizim için değerli.');

  // Memoize confetti to prevent regeneration
  const confettiPieces = useMemo(() => generateConfetti(30), []);

  return (
    <div className="thank-you-screen">
      {/* Animated Background (inherited from parent) */}
      
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {confettiPieces.map((piece) => (
            <div
              key={piece.id}
              className={`confetti confetti--${piece.shape}`}
              style={{
                left: piece.left,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
              }}
            />
          ))}
        </div>
      )}

      {/* Floating Celebration Emojis */}
      {showCelebration && (
        <div className="celebration-emojis" aria-hidden="true">
          {CELEBRATION_EMOJIS.map((emoji, index) => (
            <span key={index} className="celebration-emoji">
              {emoji}
            </span>
          ))}
        </div>
      )}

      {/* Animated Checkmark with Glow Rings */}
      <div className="thank-you-checkmark">
        {/* Expanding glow rings */}
        <div className="thank-you-checkmark__ring" aria-hidden="true" />
        <div className="thank-you-checkmark__ring" aria-hidden="true" />
        <div className="thank-you-checkmark__ring" aria-hidden="true" />
        
        {/* Checkmark circle */}
        <div className="thank-you-checkmark__circle">
          <span className="thank-you-checkmark__icon" aria-hidden="true">✓</span>
        </div>
      </div>

      {/* Thank You Message */}
      <h2 className="thank-you-message" role="status" aria-live="polite">
        {thankYouMessage}
      </h2>

      {/* Sub-message */}
      <p className="thank-you-submessage">
        {thankYouSubMessage}
      </p>
    </div>
  );
}
