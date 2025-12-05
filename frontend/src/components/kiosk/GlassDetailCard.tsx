/**
 * GlassDetailCard Component
 * 
 * Frosted glass-style detail panel for the Showcase theme.
 * Slides in from the right when a massage column is selected.
 * 
 * Requirements:
 * - 4.5, 5.5: Glass-morphism styling (backdrop blur, semi-transparent background, subtle border)
 * - 4.1, 4.2, 4.3: Card content (title, description, duration with clock icon)
 * - 3.4, 3.5, 6.3: Slide-in/slide-out animations synced with column selection
 * - 4.4: Conditional "Show Prices" button
 * - 11.1, 11.2, 11.3, 11.4, 11.5: Expandable pricing section
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Massage } from '../../types';
import { SHOWCASE_COLORS, SHOWCASE_ANIMATION_CONFIG } from '../../lib/kioskTheme';

interface GlassDetailCardProps {
  massage: Massage | null;
  isVisible: boolean;
  onClose: () => void;
  isInlineMode?: boolean; // When true, renders inline instead of fixed overlay
}

export default function GlassDetailCard({
  massage,
  isVisible,
  onClose,
  isInlineMode = false,
}: GlassDetailCardProps) {
  const { t } = useTranslation('kiosk');
  const [showPricing, setShowPricing] = useState(false);

  // Reset pricing state when card closes (Requirement 11.5)
  useEffect(() => {
    if (!isVisible) {
      setShowPricing(false);
    }
  }, [isVisible]);

  // Don't render if no massage selected
  if (!massage) {
    return null;
  }

  // Check if massage has pricing sessions (Requirement 4.4)
  const hasPricing = massage.sessions && massage.sessions.length > 0;

  // Format price in Turkish Lira (Requirement 11.2)
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Inline mode - renders as part of the layout, not as overlay
  if (isInlineMode) {
    return (
      <div className="h-full flex flex-col">
        {/* Card Header - no close button in inline mode, it's on the media side */}
        <div className="p-8 pb-4">
          {/* Massage Title */}
          <h2
            className="leading-tight mb-2"
            style={{
              color: SHOWCASE_COLORS.text.primary,
              fontSize: '28px',
              fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
              fontWeight: 600,
              letterSpacing: '0.01em',
            }}
          >
            {massage.name}
          </h2>

          {/* Duration */}
          <div
            className="flex items-center gap-2"
            style={{
              color: SHOWCASE_COLORS.text.secondary,
              fontSize: '16px',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{massage.duration}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          <p
            className="mb-6 leading-relaxed"
            style={{
              color: SHOWCASE_COLORS.text.primary,
              fontSize: '16px',
              lineHeight: '1.7',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
            }}
          >
            {massage.longDescription}
          </p>

          {massage.shortDescription && (
            <div
              className="mb-6 p-4 rounded-lg"
              style={{
                background: 'rgba(20, 184, 166, 0.1)',
                border: `1px solid ${SHOWCASE_COLORS.accent}40`,
              }}
            >
              <p style={{ color: SHOWCASE_COLORS.accent, fontSize: '14px', lineHeight: '1.5' }}>
                {massage.shortDescription}
              </p>
            </div>
          )}

          {massage.purposeTags && massage.purposeTags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {massage.purposeTags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full text-sm"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: SHOWCASE_COLORS.text.secondary,
                    border: `1px solid ${SHOWCASE_COLORS.glass.border}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Pricing */}
          {hasPricing && (
            <div className="mt-6">
              <button
                onClick={() => setShowPricing(!showPricing)}
                className="w-full py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: SHOWCASE_COLORS.accent,
                  color: 'white',
                  fontSize: '15px',
                  fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                {showPricing ? t('menu.hidePricing') : t('menu.showPricing')}
              </button>

              {showPricing && (
                <div
                  className="mt-4 rounded-lg overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${SHOWCASE_COLORS.glass.border}`,
                  }}
                >
                  <div className="max-h-64 overflow-y-auto">
                    {massage.sessions.map((session, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border-b last:border-b-0"
                        style={{ borderColor: SHOWCASE_COLORS.glass.border }}
                      >
                        <span style={{ color: SHOWCASE_COLORS.text.primary, fontSize: '15px' }}>
                          {session.name}
                        </span>
                        <span style={{ color: SHOWCASE_COLORS.accent, fontSize: '16px', fontWeight: 'bold' }}>
                          {formatPrice(session.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Overlay mode (original behavior)
  return (
    <>
      {/* Backdrop overlay for click-outside dismissal */}
      {isVisible && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
          style={{
            background: 'transparent',
          }}
        />
      )}

      {/* Glass Detail Card */}
      <div
        className={`
          fixed top-0 right-0 h-full z-50
          flex flex-col
          transition-transform duration-${isVisible ? SHOWCASE_ANIMATION_CONFIG.cardSlideIn : SHOWCASE_ANIMATION_CONFIG.cardSlideOut}
          ease-out
          ${isVisible ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{
          width: '480px',
          maxWidth: '40vw',
          // Glass-morphism effect (Requirements 4.5, 5.5)
          background: SHOWCASE_COLORS.glass.background,
          backdropFilter: `blur(${SHOWCASE_COLORS.glass.blur})`,
          WebkitBackdropFilter: `blur(${SHOWCASE_COLORS.glass.blur})`,
          border: `1px solid ${SHOWCASE_COLORS.glass.border}`,
          borderRight: 'none',
          transitionDuration: isVisible 
            ? `${SHOWCASE_ANIMATION_CONFIG.cardSlideIn}ms` 
            : `${SHOWCASE_ANIMATION_CONFIG.cardSlideOut}ms`,
          // GPU acceleration (Requirements 9.1, 9.2, 9.3)
          transform: isVisible ? 'translateX(0) translateZ(0)' : 'translateX(100%) translateZ(0)',
          willChange: 'transform',
        }}
      >
        {/* Card Header with Close Button */}
        <div className="flex items-start justify-between p-8 pb-4">
          <div className="flex-1 pr-4">
            {/* Massage Title - Elegant serif font (Requirement 4.1) */}
            <h2
              className="leading-tight mb-2"
              style={{
                color: SHOWCASE_COLORS.text.primary,
                fontSize: '26px',
                fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
                fontWeight: 600,
                letterSpacing: '0.01em',
              }}
            >
              {massage.name}
            </h2>

            {/* Duration with clock icon (Requirement 4.3) */}
            <div
              className="flex items-center gap-2"
              style={{
                color: SHOWCASE_COLORS.text.secondary,
                fontSize: '15px',
                fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
              }}
            >
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{massage.duration}</span>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-full transition-all duration-200 hover:scale-110"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: SHOWCASE_COLORS.text.primary,
            }}
            aria-label={t('common:actions.close')}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Full Description - Clean sans-serif (Requirement 4.2) */}
          <p
            className="mb-6 leading-relaxed"
            style={{
              color: SHOWCASE_COLORS.text.primary,
              fontSize: '15px',
              lineHeight: '1.7',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
              fontWeight: 400,
            }}
          >
            {massage.longDescription}
          </p>

          {/* Short Description / Benefit */}
          {massage.shortDescription && (
            <div
              className="mb-6 p-4 rounded-lg"
              style={{
                background: 'rgba(20, 184, 166, 0.1)',
                border: `1px solid ${SHOWCASE_COLORS.accent}40`,
              }}
            >
              <p
                style={{
                  color: SHOWCASE_COLORS.accent,
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              >
                {massage.shortDescription}
              </p>
            </div>
          )}

          {/* Purpose Tags (if any) */}
          {massage.purposeTags && massage.purposeTags.length > 0 && (
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {massage.purposeTags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: SHOWCASE_COLORS.text.secondary,
                      border: `1px solid ${SHOWCASE_COLORS.glass.border}`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Section (Requirements 4.4, 11.1-11.5) */}
          {hasPricing && (
            <div className="mt-6">
              {/* Show/Hide Prices Button (Requirement 4.4, 11.1, 11.4) */}
              <button
                onClick={() => setShowPricing(!showPricing)}
                className="w-full py-3 px-4 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: SHOWCASE_COLORS.accent,
                  color: 'white',
                  fontSize: '15px',
                  fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                  fontWeight: 500,
                }}
              >
                {showPricing ? t('menu.hidePricing') : t('menu.showPricing')}
              </button>

              {/* Expandable Pricing List (Requirements 11.2, 11.3) */}
              {showPricing && (
                <div
                  className="mt-4 rounded-lg overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${SHOWCASE_COLORS.glass.border}`,
                  }}
                >
                  {/* Scrollable if many sessions (Requirement 11.3) */}
                  <div className="max-h-64 overflow-y-auto">
                    {massage.sessions.map((session, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border-b last:border-b-0"
                        style={{
                          borderColor: SHOWCASE_COLORS.glass.border,
                        }}
                      >
                        {/* Session Name */}
                        <span
                          className="font-medium"
                          style={{
                            color: SHOWCASE_COLORS.text.primary,
                            fontSize: '15px',
                          }}
                        >
                          {session.name}
                        </span>

                        {/* Price in Turkish Lira format (Requirement 11.2) */}
                        <span
                          className="font-bold"
                          style={{
                            color: SHOWCASE_COLORS.accent,
                            fontSize: '16px',
                          }}
                        >
                          {formatPrice(session.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
