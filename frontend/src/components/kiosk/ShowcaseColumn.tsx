/**
 * ShowcaseColumn Component
 * 
 * Individual video column for the Showcase theme with expand/collapse behavior.
 * Displays a looping massage video with name and benefit label overlay.
 * 
 * Requirements:
 * - 1.4: Looping video with rounded corners (16px radius)
 * - 1.5: Gradient placeholder on video load error
 * - 2.1, 2.2, 2.3, 2.4: Column label overlay with name and benefit
 * - 1.3, 3.1, 3.2, 3.3, 6.2: Expand/collapse width transitions
 */

import { memo, useState, useEffect, useRef } from 'react';
import { Massage } from '../../types';
import { SHOWCASE_COLORS, SHOWCASE_ANIMATION_CONFIG } from '../../lib/kioskTheme';
import MassageVisualFallback from './MassageVisualFallback';

interface ShowcaseColumnProps {
  massage: Massage;
  isMain: boolean;              // true = expanded width, false = collapsed width
  index: number;                // 0-3 position
  onSelect: () => void;         // Called when column is tapped
  onShowDetails?: () => void;   // Called when "Details" button is clicked
  animationDelay: number;       // Staggered entrance animation
}

function ShowcaseColumn({
  massage,
  isMain,
  onSelect,
  onShowDetails,
  animationDelay,
}: ShowcaseColumnProps) {
  const [videoError, setVideoError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Staggered entrance animation (Requirement 6.5)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);

    return () => clearTimeout(timer);
  }, [animationDelay]);

  // Load media only when the active column is visible.
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setShouldLoadVideo(true);
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isMain) {
      setShouldLoadVideo(true);
    }
  }, [isMain]);

  const handleVideoError = () => {
    setVideoError(true);
  };

  // Reset video error when massage changes
  useEffect(() => {
    setVideoError(false);
  }, [massage.id]);

  const benefit = massage.shortDescription.split('.')[0].substring(0, 50);
  const shouldRenderVideo = isMain && massage.mediaType === 'video' && Boolean(massage.mediaUrl) && shouldLoadVideo && !videoError;
  const shouldRenderImage = massage.mediaType === 'photo' && Boolean(massage.mediaUrl);

  // Touch feedback handlers (Requirements 10.1, 10.2)
  const handleTouchStart = () => {
    setIsTouched(true);
  };

  const handleTouchEnd = () => {
    setIsTouched(false);
    onSelect();
  };

  const handleClick = () => {
    onSelect();
  };

  // Handle details button click without triggering column select
  const handleDetailsClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onShowDetails?.();
  };

  return (
    <div
      ref={containerRef}
      className={`
        relative h-full cursor-pointer overflow-hidden
        transition-all duration-[${SHOWCASE_ANIMATION_CONFIG.columnExpand}ms] ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${isTouched ? 'scale-[0.98]' : 'scale-100'}
      `}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setIsTouched(false)}
      style={{
        // Main column gets 55% width to show video content better, others share remaining space
        flex: isMain ? '0 0 55%' : '1 1 15%',
        transitionDuration: `${SHOWCASE_ANIMATION_CONFIG.columnExpand}ms`,
        minWidth: '44px', // Minimum touch target (Requirement 10.1)
        minHeight: '44px', // Minimum touch target (Requirement 10.1)
        // GPU acceleration hints (Requirements 9.1, 9.2, 9.3)
        willChange: isMain ? 'flex, transform, opacity' : 'flex',
        transform: 'translateZ(0)', // Force GPU layer
      }}
    >
      {shouldRenderVideo ? (
        <video
          key={`video-${massage.id}`}
          className="absolute inset-0 w-full h-full object-cover rounded-2xl transition-all duration-300"
          src={massage.mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onError={handleVideoError}
          style={{
            borderRadius: '16px',
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        />
      ) : shouldRenderImage ? (
        <img
          src={massage.mediaUrl}
          alt={massage.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover rounded-2xl transition-all duration-300"
          style={{
            borderRadius: '16px',
            transform: 'translateZ(0)',
          }}
        />
      ) : (
        <div className="absolute inset-0 rounded-2xl transition-all duration-300" style={{ borderRadius: '16px' }}>
          <MassageVisualFallback
            massage={massage}
            compact={!isMain}
            showDescription={isMain}
            showTags={isMain}
          />
        </div>
      )}

      <div
        className="absolute inset-0 rounded-2xl transition-all duration-300"
        style={{
          background: isMain
            ? 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.12) 100%)',
          borderRadius: '16px',
        }}
      />

      {/* Column Label Overlay (Requirements 2.1, 2.2, 2.3, 2.4) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
        {/* Text container with glass background - inline-block to fit content */}
        <div
          className="rounded-xl p-4 inline-block"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: isMain ? '400px' : '100%',
          }}
        >
          {/* Massage Name - Elegant serif-style font */}
          <h3
            className={`
              mb-2 leading-tight tracking-wide
              ${isMain ? '' : 'truncate'}
            `}
            style={{
              color: SHOWCASE_COLORS.text.primary,
              fontSize: isMain ? '28px' : '16px',
              fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
              fontWeight: isMain ? 600 : 500,
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              letterSpacing: '0.02em',
            }}
          >
            {massage.name}
          </h3>

          {/* Benefit Label - Clean sans-serif */}
          <p
            className={`
              leading-relaxed
              ${isMain ? '' : 'truncate'}
            `}
            style={{
              color: SHOWCASE_COLORS.accent,
              fontSize: isMain ? '15px' : '12px',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
              fontWeight: 400,
              opacity: 0.95,
            }}
          >
            {benefit}
          </p>

          {/* Duration indicator (only show in main column) */}
          {isMain && (
            <div
              className="flex items-center gap-2 mt-3"
              style={{ 
                color: SHOWCASE_COLORS.text.secondary,
                fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
                fontSize: '14px',
              }}
            >
              <svg
                className="w-4 h-4"
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
          )}
        </div>
        
        {/* Details button - only show in main column */}
        {isMain && onShowDetails && (
          <button
            onClick={handleDetailsClick}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onShowDetails();
            }}
            className="mt-4 px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2"
            style={{
              background: 'rgba(20, 184, 166, 0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: `1px solid ${SHOWCASE_COLORS.accent}50`,
              color: SHOWCASE_COLORS.text.primary,
              fontSize: '15px',
              fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
              fontWeight: 500,
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Detaylar</span>
          </button>
        )}
      </div>

      <div
        className={`
          absolute inset-0 rounded-2xl pointer-events-none
          transition-opacity duration-200
          ${isMain ? 'opacity-0' : 'opacity-0 hover:opacity-10'}
        `}
        style={{
          background: SHOWCASE_COLORS.accent,
          borderRadius: '16px',
        }}
      />
    </div>
  );
}

export default memo(ShowcaseColumn);
