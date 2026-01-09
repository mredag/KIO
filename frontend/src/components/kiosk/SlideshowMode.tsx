import { useEffect, useState } from 'react';
import { Massage } from '../../types';

interface SlideshowModeProps {
  massages: Massage[];
  onExit: () => void;
}

/**
 * Slideshow Mode Component
 * 
 * Displays featured and campaign massages in sequence with animations.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * Performance optimized for Raspberry Pi (Requirements 17.1, 17.2, 17.3, 17.5)
 */
export default function SlideshowMode({ massages, onExit }: SlideshowModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter to show only featured and campaign massages (Requirement 3.2)
  const slideshowMassages = massages.filter(
    (m) => m.isFeatured || m.isCampaign
  );

  // If no massages to show, exit slideshow
  useEffect(() => {
    if (slideshowMassages.length === 0) {
      onExit();
    }
  }, [slideshowMassages.length, onExit]);

  // Auto-advance slideshow every 5 seconds (Requirement 3.3, 17.3)
  useEffect(() => {
    if (slideshowMassages.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slideshowMassages.length);
    }, 5000); // 5 seconds per slide (Requirement 17.3)

    return () => clearInterval(timer);
  }, [slideshowMassages.length]);

  // Animate slide transitions using CSS animations (Requirements 17.1, 17.2)
  useEffect(() => {
    const slideElement = document.getElementById('slideshow-slide');
    if (!slideElement) return;
    
    // Add will-change for performance hint (Requirement 17.5)
    slideElement.classList.add('will-change-transform-opacity');
    
    // Trigger CSS animation by adding class
    slideElement.classList.remove('slideshow-slide');
    // Force reflow to restart animation
    void slideElement.offsetWidth;
    slideElement.classList.add('slideshow-slide');
    
    // Remove will-change after animation completes (500ms)
    const timer = setTimeout(() => {
      slideElement.classList.remove('will-change-transform-opacity');
    }, 500);

    return () => clearTimeout(timer);
  }, [currentIndex]);

  if (slideshowMassages.length === 0) {
    return null;
  }

  const currentMassage = slideshowMassages[currentIndex];

  return (
    <div
      className="h-full w-full bg-gray-950 flex items-center justify-center relative"
      onClick={onExit} // Exit on touch (Requirement 3.4)
      onTouchStart={onExit} // Exit on touch (Requirement 3.4)
    >
      <div
        id="slideshow-slide"
        className="w-full h-full flex flex-col items-center justify-center p-16 slideshow-slide"
      >
        {/* Massage Visual (Requirement 3.3) */}
        <div className="relative w-full max-w-4xl aspect-video mb-8 rounded-2xl overflow-hidden shadow-2xl">
          {currentMassage.mediaType === 'video' ? (
            <video
              key={currentMassage.id}
              src={currentMassage.mediaUrl}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              key={currentMassage.id}
              src={currentMassage.mediaUrl}
              alt={currentMassage.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Massage Name (Requirement 3.3) */}
        <h1 className="text-6xl font-bold text-white mb-6 text-center">
          {currentMassage.name}
        </h1>

        {/* Promotional Text (Requirement 3.3) */}
        <p className="text-3xl text-gray-300 text-center max-w-3xl leading-relaxed">
          {currentMassage.longDescription || currentMassage.shortDescription}
        </p>

        {/* Progress Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
          {slideshowMassages.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-12 bg-blue-500'
                  : 'w-2 bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
