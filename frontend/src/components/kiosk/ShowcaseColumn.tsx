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
  isMain: boolean;              // true = expanded width, false = collapsed width
  index: number;                // 0-3 position
  onSelect: () => void;         // Called when column is tapped
  onShowDetails?: () => void;   // Called when "Details" button is clicked
  animationDelay: number;       // Staggered entrance animation
}

export default function ShowcaseColumn({
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

  // Periodic video health check to prevent stuck loading state
  useEffect(() => {
    if (!videoRef.current || !shouldLoadVideo) return;

    const healthCheck = setInterval(() => {
      const video = videoRef.current;
      if (video && video.readyState < 2 && !video.paused) {
        // Video is stuck in loading state, try to recover
        console.log('Video health check: recovering stuck video');
        video.load();
        video.play().catch(() => {});
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheck);
  }, [shouldLoadVideo]);

  // Handle page visibility changes to recover videos
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && videoRef.current) {
        // Page became visible, ensure video is playing
        if (videoRef.current.paused || videoRef.current.readyState < 3) {
          console.log('Page visible, recovering video playback');
          videoRef.current.play().catch(() => {
            // If play fails, try reloading
            videoRef.current?.load();
            videoRef.current?.play().catch(() => {});
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
      {/* Video or Gradient Placeholder */}
      {!videoError && massage.mediaType === 'video' && shouldLoadVideo ? (
        <video
          ref={videoRef}
          key={`video-${massage.id}`} // Stable key to prevent unnecessary reloads
          className="absolute inset-0 w-full h-full object-cover rounded-2xl transition-all duration-300"
          src={massage.mediaUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={handleVideoError}
          onStalled={() => {
            // Auto-recover from stalled state after a delay
            setTimeout(() => {
              if (videoRef.current && videoRef.current.readyState < 3) {
                console.log('Video stalled, attempting recovery...');
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }, 2000);
          }}
          onWaiting={() => {
            // Try to recover if waiting too long
            setTimeout(() => {
              if (videoRef.current && videoRef.current.readyState < 3) {
                console.log('Video waiting too long, attempting recovery...');
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
              }
            }, 5000);
          }}
          onCanPlay={() => {
            // Ensure video plays when ready
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            }
          }}
          style={{
            borderRadius: '16px', // Requirement 1.4
            // GPU acceleration for video (Requirements 9.1, 9.2)
            transform: 'translateZ(0)',
            willChange: 'transform',
            // Blur video on non-selected columns
            filter: isMain ? 'none' : 'blur(3px) brightness(0.5)',
          }}
        />
      ) : (
        // Gradient placeholder (Requirement 1.5)
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)`,
            borderRadius: '16px',
            // Blur placeholder on non-selected columns
            filter: isMain ? 'none' : 'blur(3px) brightness(0.5)',
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
        className="absolute inset-0 rounded-2xl transition-all duration-300"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)',
          borderRadius: '16px',
          // Blur gradient on non-selected columns
          filter: isMain ? 'none' : 'blur(3px) brightness(0.5)',
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
