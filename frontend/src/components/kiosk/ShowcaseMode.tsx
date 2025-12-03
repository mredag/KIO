/**
 * ShowcaseMode Component
 * 
 * Main container for the Showcase theme - a video-centric four-column layout.
 * Displays featured massages with smooth expand/collapse animations and auto-cycling.
 * 
 * Requirements:
 * - 1.1, 5.1: Four-column layout with dark navy/charcoal gradient background
 * - 3.1, 3.2: Column selection state management
 * - 6.5: Staggered entrance animations
 */

import { useState, useEffect, useCallback } from 'react';
import { Massage } from '../../types';
import ShowcaseColumn from './ShowcaseColumn';
import GlassDetailCard from './GlassDetailCard';
import { SHOWCASE_COLORS, SHOWCASE_ANIMATION_CONFIG, selectDisplayMassages } from '../../lib/kioskTheme';

interface ShowcaseModeProps {
  massages: Massage[];
}

export default function ShowcaseMode({ massages }: ShowcaseModeProps) {
  // Select exactly 4 massages for display (Requirement 1.2)
  // Cast to compatible type for selection algorithm
  const displayMassages = selectDisplayMassages(massages as any) as unknown as Massage[];
  
  // Column selection state (Requirement 3.1, 3.2)
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCard, setShowCard] = useState(true);
  
  // Auto-cycling state (Requirements 8.1, 8.2, 8.3, 8.4, 8.5)
  const [isPaused, setIsPaused] = useState(false);
  const [pauseUntil, setPauseUntil] = useState<number | null>(null);
  
  // Swipe navigation state (Requirement 10.3)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Ensure selectedIndex is valid when massages change
  useEffect(() => {
    if (selectedIndex >= displayMassages.length && displayMassages.length > 0) {
      setSelectedIndex(0);
    }
  }, [displayMassages.length, selectedIndex]);
  
  // Auto-advance timer (Requirements 8.1, 8.2, 8.3)
  useEffect(() => {
    // Don't auto-cycle if paused or no massages
    if (isPaused || displayMassages.length === 0) {
      return;
    }
    
    // Set up 10-second interval to advance to next column
    const intervalId = setInterval(() => {
      setSelectedIndex((prevIndex) => {
        // Wrap from index 3 back to 0 (Requirement 8.3)
        return (prevIndex + 1) % displayMassages.length;
      });
    }, SHOWCASE_ANIMATION_CONFIG.autoCycleInterval);
    
    return () => clearInterval(intervalId);
  }, [isPaused, displayMassages.length]);
  
  // Resume auto-cycling after pause duration (Requirement 8.5)
  useEffect(() => {
    if (!pauseUntil) {
      return;
    }
    
    const now = Date.now();
    const remainingPause = pauseUntil - now;
    
    if (remainingPause <= 0) {
      // Pause duration has already elapsed
      setIsPaused(false);
      setPauseUntil(null);
      return;
    }
    
    // Set timeout to resume after remaining pause duration
    const timeoutId = setTimeout(() => {
      setIsPaused(false);
      setPauseUntil(null);
    }, remainingPause);
    
    return () => clearTimeout(timeoutId);
  }, [pauseUntil]);
  
  // Handle column tap to change selection (Requirement 3.2, 8.4)
  const handleColumnSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    setShowCard(true); // Show card when column selected
    
    // Pause auto-cycling for 60 seconds on user interaction (Requirement 8.4)
    setIsPaused(true);
    setPauseUntil(Date.now() + SHOWCASE_ANIMATION_CONFIG.pauseDuration);
  }, []);
  
  // Handle glass card close (Requirement 10.5)
  const handleCardClose = useCallback(() => {
    // Hide card when dismissed (tapping outside card area)
    setShowCard(false);
    
    // Pause auto-cycling on user interaction
    setIsPaused(true);
    setPauseUntil(Date.now() + SHOWCASE_ANIMATION_CONFIG.pauseDuration);
  }, []);
  
  // Swipe navigation handlers (Requirement 10.3)
  const minSwipeDistance = 50; // Minimum distance for a swipe
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Left swipe: next column (increment index)
      setSelectedIndex((prevIndex) => (prevIndex + 1) % displayMassages.length);
      setShowCard(true); // Show card when swiping
      
      // Pause auto-cycling on user interaction
      setIsPaused(true);
      setPauseUntil(Date.now() + SHOWCASE_ANIMATION_CONFIG.pauseDuration);
    } else if (isRightSwipe) {
      // Right swipe: previous column (decrement index)
      setSelectedIndex((prevIndex) => 
        prevIndex === 0 ? displayMassages.length - 1 : prevIndex - 1
      );
      setShowCard(true); // Show card when swiping
      
      // Pause auto-cycling on user interaction
      setIsPaused(true);
      setPauseUntil(Date.now() + SHOWCASE_ANIMATION_CONFIG.pauseDuration);
    }
  };
  
  // Don't render if no massages available
  if (displayMassages.length === 0) {
    return (
      <div
        className="h-full w-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)`,
        }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">🎥</div>
          <p
            className="text-2xl font-semibold"
            style={{ color: SHOWCASE_COLORS.text.primary }}
          >
            No massages available
          </p>
          <p
            className="text-lg mt-2"
            style={{ color: SHOWCASE_COLORS.text.secondary }}
          >
            Please add featured massages to display
          </p>
        </div>
      </div>
    );
  }
  
  // Get selected massage for glass card
  const selectedMassage = displayMassages[selectedIndex] || null;
  
  return (
    <div
      className="h-full w-full relative overflow-hidden"
      style={{
        // Dark navy to charcoal gradient background (Requirements 1.1, 5.1)
        background: `linear-gradient(135deg, ${SHOWCASE_COLORS.background.start} 0%, ${SHOWCASE_COLORS.background.end} 100%)`,
        // GPU acceleration for smooth rendering (Requirements 9.1, 9.2, 9.3)
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Four-column layout container (Requirement 1.1) */}
      <div className="h-full w-full flex gap-0 p-4">
        {displayMassages.map((massage, index) => (
          <ShowcaseColumn
            key={massage.id}
            massage={massage}
            isMain={index === selectedIndex}
            index={index}
            onSelect={() => handleColumnSelect(index)}
            // Staggered entrance animation (Requirement 6.5)
            animationDelay={index * SHOWCASE_ANIMATION_CONFIG.entranceStagger}
          />
        ))}
      </div>
      
      {/* Glass Detail Card (Requirement 3.2, 10.5) */}
      <GlassDetailCard
        massage={selectedMassage}
        isVisible={selectedMassage !== null && showCard}
        onClose={handleCardClose}
      />
    </div>
  );
}
