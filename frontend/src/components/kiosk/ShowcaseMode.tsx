/**
 * ShowcaseMode Component
 * 
 * Main container for the Showcase theme - a video-centric four-column layout.
 * Displays featured massages with smooth expand/collapse animations and auto-cycling.
 * 
 * Features:
 * - Four-column layout with smooth transitions
 * - Detail view with 70/30 split (animated transition)
 * - Auto-cycling with pause on interaction
 * - 60-second auto-close for detail view
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Massage } from '../../types';
import ShowcaseColumn from './ShowcaseColumn';
import GlassDetailCard from './GlassDetailCard';
import { SHOWCASE_COLORS, SHOWCASE_ANIMATION_CONFIG, selectDisplayMassages } from '../../lib/kioskTheme';

interface ShowcaseModeProps {
  massages: Massage[];
}

// Animation duration in ms
const TRANSITION_DURATION = 500;

export default function ShowcaseMode({ massages }: ShowcaseModeProps) {
  const displayMassages = selectDisplayMassages(massages as any) as unknown as Massage[];
  
  // State
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const detailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-cycling state
  const [isPaused, setIsPaused] = useState(false);
  const [pauseUntil, setPauseUntil] = useState<number | null>(null);
  
  // Swipe state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Video ref for detail view
  const detailVideoRef = useRef<HTMLVideoElement>(null);
  
  // Ensure selectedIndex is valid
  useEffect(() => {
    if (selectedIndex >= displayMassages.length && displayMassages.length > 0) {
      setSelectedIndex(0);
    }
  }, [displayMassages.length, selectedIndex]);
  
  // Auto-advance timer
  useEffect(() => {
    if (isPaused || displayMassages.length === 0 || isDetailView) return;
    
    const intervalId = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % displayMassages.length);
    }, SHOWCASE_ANIMATION_CONFIG.autoCycleInterval);
    
    return () => clearInterval(intervalId);
  }, [isPaused, displayMassages.length, isDetailView]);
  
  // Resume auto-cycling after pause
  useEffect(() => {
    if (!pauseUntil) return;
    
    const remaining = pauseUntil - Date.now();
    if (remaining <= 0) {
      setIsPaused(false);
      setPauseUntil(null);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setIsPaused(false);
      setPauseUntil(null);
    }, remaining);
    
    return () => clearTimeout(timeoutId);
  }, [pauseUntil]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detailTimeoutRef.current) clearTimeout(detailTimeoutRef.current);
    };
  }, []);
  
  const pauseAutoCycle = useCallback(() => {
    setIsPaused(true);
    setPauseUntil(Date.now() + SHOWCASE_ANIMATION_CONFIG.pauseDuration);
  }, []);
  
  const handleColumnSelect = useCallback((index: number) => {
    if (isAnimating) return;
    setSelectedIndex(index);
    pauseAutoCycle();
  }, [isAnimating, pauseAutoCycle]);
  
  // Open detail view with smooth animation
  const handleShowDetails = useCallback(() => {
    if (isAnimating || isDetailView) return;
    
    setIsAnimating(true);
    setIsDetailView(true);
    pauseAutoCycle();
    
    // Clear any existing timeout
    if (detailTimeoutRef.current) clearTimeout(detailTimeoutRef.current);
    
    // Auto-close after 60 seconds
    detailTimeoutRef.current = setTimeout(() => {
      handleCloseDetails();
    }, 60000);
    
    // Animation complete
    setTimeout(() => setIsAnimating(false), TRANSITION_DURATION);
  }, [isAnimating, isDetailView, pauseAutoCycle]);
  
  // Close detail view with smooth animation
  const handleCloseDetails = useCallback(() => {
    if (isAnimating || !isDetailView) return;
    
    setIsAnimating(true);
    setIsDetailView(false);
    
    if (detailTimeoutRef.current) {
      clearTimeout(detailTimeoutRef.current);
      detailTimeoutRef.current = null;
    }
    
    pauseAutoCycle();
    setTimeout(() => setIsAnimating(false), TRANSITION_DURATION);
  }, [isAnimating, isDetailView, pauseAutoCycle]);
  
  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDetailView) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDetailView) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (isDetailView || !touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > 50) {
      if (distance > 0) {
        setSelectedIndex((prev) => (prev + 1) % displayMassages.length);
      } else {
        setSelectedIndex((prev) => prev === 0 ? displayMassages.length - 1 : prev - 1);
      }
      pauseAutoCycle();
    }
  };
  
  if (displayMassages.length === 0) {
    return (
      <div
        className="h-full w-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)` }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">🎥</div>
          <p className="text-2xl font-semibold" style={{ color: SHOWCASE_COLORS.text.primary }}>
            No massages available
          </p>
        </div>
      </div>
    );
  }
  
  const selectedMassage = displayMassages[selectedIndex] || null;
  
  return (
    <div
      className="h-full w-full relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)`,
        transform: 'translateZ(0)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main container with animated layout */}
      <div className="h-full w-full flex relative">
        
        {/* Left side: Columns / Expanded Media */}
        <div
          className="h-full relative overflow-hidden"
          style={{
            width: isDetailView ? '70%' : '100%',
            transition: `width ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          }}
        >
          {/* Column grid - fades out in detail view */}
          <div
            className="absolute inset-0 flex gap-0 p-4"
            style={{
              opacity: isDetailView ? 0 : 1,
              transform: isDetailView ? 'scale(1.05)' : 'scale(1)',
              transition: `opacity ${TRANSITION_DURATION}ms ease, transform ${TRANSITION_DURATION}ms ease`,
              pointerEvents: isDetailView ? 'none' : 'auto',
            }}
          >
            {displayMassages.map((massage, index) => (
              <ShowcaseColumn
                key={massage.id}
                massage={massage}
                isMain={index === selectedIndex}
                index={index}
                onSelect={() => handleColumnSelect(index)}
                onShowDetails={index === selectedIndex ? handleShowDetails : undefined}
                animationDelay={index * SHOWCASE_ANIMATION_CONFIG.entranceStagger}
              />
            ))}
          </div>
          
          {/* Expanded media - fades in during detail view */}
          <div
            className="absolute inset-0"
            style={{
              opacity: isDetailView ? 1 : 0,
              transform: isDetailView ? 'scale(1)' : 'scale(0.95)',
              transition: `opacity ${TRANSITION_DURATION}ms ease, transform ${TRANSITION_DURATION}ms ease`,
              pointerEvents: isDetailView ? 'auto' : 'none',
            }}
          >
            {selectedMassage && selectedMassage.mediaType === 'video' ? (
              <video
                ref={detailVideoRef}
                key={`detail-video-${selectedMassage.id}`}
                className="w-full h-full object-cover"
                src={selectedMassage.mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                style={{ transform: 'translateZ(0)' }}
              />
            ) : selectedMassage ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)` }}
              >
                <div className="text-center">
                  <div className="text-8xl mb-4 opacity-50">🧘</div>
                  <p className="text-3xl font-semibold" style={{ color: SHOWCASE_COLORS.text.primary }}>
                    {selectedMassage.name}
                  </p>
                </div>
              </div>
            ) : null}
            
            {/* Close button */}
            <button
              onClick={handleCloseDetails}
              className="absolute top-6 left-6 p-3 rounded-full hover:scale-110"
              style={{
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(10px)',
                color: SHOWCASE_COLORS.text.primary,
                opacity: isDetailView ? 1 : 0,
                transform: isDetailView ? 'translateY(0)' : 'translateY(-20px)',
                transition: `opacity ${TRANSITION_DURATION}ms ease, transform ${TRANSITION_DURATION}ms ease`,
                transitionDelay: isDetailView ? '200ms' : '0ms',
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Right side: Detail panel - slides in from right */}
        <div
          className="h-full overflow-hidden"
          style={{
            width: isDetailView ? '30%' : '0%',
            opacity: isDetailView ? 1 : 0,
            transition: `width ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${TRANSITION_DURATION}ms ease`,
          }}
        >
          <div
            className="h-full w-full overflow-y-auto"
            style={{
              background: SHOWCASE_COLORS.glass.background,
              backdropFilter: `blur(${SHOWCASE_COLORS.glass.blur})`,
              borderLeft: `1px solid ${SHOWCASE_COLORS.glass.border}`,
              transform: isDetailView ? 'translateX(0)' : 'translateX(100%)',
              transition: `transform ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          >
            {selectedMassage && (
              <GlassDetailCard
                massage={selectedMassage}
                isVisible={true}
                onClose={handleCloseDetails}
                isInlineMode={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
