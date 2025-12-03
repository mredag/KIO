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

import { useState, useEffect, useRef } from 'react';
import { Massage } from '../../types';
import { SHOWCASE_COLORS, SHOWCASE_ANIMATION_CONFIG } from '../../lib/kioskTheme';

interface ShowcaseColumnProps {
  massage: Massage;
  isMain: boolean;              // true = 40% width, false = 20% width
  index: number;                // 0-3 position
  onSelect: () => void;         // Called when column is tapped
  animationDelay: number;       // Staggered entrance animation
}

export default function ShowcaseColumn({
  massage,
  isMain,
  onSelect,
  animationDelay,
}: ShowcaseColumnProps) {
  const [videoError, setVideoError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Staggered entrance animation (Requirement 6.5)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);

    return () => clearTimeout(timer);
  }, [animationDelay]);

  // Video lazy loading with Intersection Observer (Requirement 9.4)
  // Only load video when column is visible or about to become visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Load video when column is visible or within viewport
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setShouldLoadVideo(true);
          }
        });
      },
      {
        // Start loading slightly before column enters viewport
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Prioritize loading for main column (Requirement 9.4)
  useEffect(() => {
    if (isMain) {
      setShouldLoadVideo(true);
    }
  }, [isMain]);

  // Handle video load error (Requirement 1.5)
  const handleVideoError = () => {
    setVideoError(true);
  };

  // Reset video error when massage changes
  useEffect(() => {
    setVideoError(false);
  }, [massage.id]);

  // Extract short benefit from shortDescription (first sentence or first 50 chars)
  const benefit = massage.shortDescription.split('.')[0].substring(0, 50);

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

  return (
    <div
      ref={containerRef}
      className={`
        relative h-full cursor-pointer overflow-hidden
        transition-all duration-[${SHOWCASE_ANIMATION_CONFIG.columnExpand}ms] ease-out
        ${isMain ? 'w-[40%]' : 'w-[20%]'}
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${isTouched ? 'scale-[0.98] brightness-110' : 'scale-100 brightness-100'}
      `}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => setIsTouched(false)}
      style={{
        transitionDuration: `${SHOWCASE_ANIMATION_CONFIG.columnExpand}ms`,
        minWidth: '44px', // Minimum touch target (Requirement 10.1)
        minHeight: '44px', // Minimum touch target (Requirement 10.1)
        // GPU acceleration hints (Requirements 9.1, 9.2, 9.3)
        willChange: isMain ? 'width, transform, opacity' : 'width',
        transform: 'translateZ(0)', // Force GPU layer
      }}
    >
      {/* Video or Gradient Placeholder */}
      {!videoError && massage.mediaType === 'video' && shouldLoadVideo ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          src={massage.mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          onError={handleVideoError}
          style={{
            borderRadius: '16px', // Requirement 1.4
            // GPU acceleration for video (Requirements 9.1, 9.2)
            transform: 'translateZ(0)',
            willChange: 'transform',
          }}
        />
      ) : (
        // Gradient placeholder (Requirement 1.5)
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)`,
            borderRadius: '16px',
          }}
        >
          <div className="text-center px-4">
            <div className="text-4xl mb-4 opacity-50">🎥</div>
            <p
              className="font-semibold text-lg"
              style={{ color: SHOWCASE_COLORS.text.primary }}
            >
              {massage.name}
            </p>
          </div>
        </div>
      )}

      {/* Gradient overlay for better text readability */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)',
          borderRadius: '16px',
        }}
      />

      {/* Column Label Overlay (Requirements 2.1, 2.2, 2.3, 2.4) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
        {/* Massage Name - White text, 18px minimum (Requirement 2.1) */}
        <h3
          className={`
            font-bold mb-1 leading-tight
            ${isMain ? 'text-2xl' : 'text-lg truncate'}
          `}
          style={{
            color: SHOWCASE_COLORS.text.primary,
            fontSize: isMain ? '24px' : '18px',
          }}
        >
          {massage.name}
        </h3>

        {/* Benefit Label - Teal accent, 14px minimum (Requirement 2.2) */}
        <p
          className={`
            leading-tight
            ${isMain ? 'text-base' : 'text-sm truncate'}
          `}
          style={{
            color: SHOWCASE_COLORS.accent,
            fontSize: isMain ? '16px' : '14px',
          }}
        >
          {benefit}
        </p>

        {/* Duration indicator (only show in main column) */}
        {isMain && (
          <div
            className="flex items-center gap-2 mt-3 text-sm"
            style={{ color: SHOWCASE_COLORS.text.secondary }}
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

      {/* Touch feedback indicator (subtle pulse on hover) */}
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
