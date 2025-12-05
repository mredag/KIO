/**
 * AnimatedBackground Component
 * 
 * Renders floating particles and ambient glow orbs for the premium survey UI.
 * Uses CSS animations with GPU acceleration (transform, opacity only).
 * 
 * Requirements: 1.1, 11.5
 */

import { useMemo } from 'react';

interface AnimatedBackgroundProps {
  /** Number of floating particles (default: 20, max: 50 for performance) */
  particleCount?: number;
  /** Intensity of glow orbs */
  glowIntensity?: 'low' | 'medium' | 'high';
}

/**
 * Generates particle configuration with random sizes
 */
function generateParticles(count: number) {
  const sizes = ['small', 'medium', 'large'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: sizes[Math.floor(Math.random() * sizes.length)],
  }));
}

export default function AnimatedBackground({
  particleCount = 20,
  glowIntensity = 'medium',
}: AnimatedBackgroundProps) {
  // Limit particle count for performance (max 50)
  const safeParticleCount = Math.min(Math.max(particleCount, 0), 50);
  
  // Memoize particles to prevent regeneration on re-renders
  const particles = useMemo(
    () => generateParticles(safeParticleCount),
    [safeParticleCount]
  );

  // Glow orb opacity based on intensity
  const glowOpacity = {
    low: 0.2,
    medium: 0.3,
    high: 0.4,
  }[glowIntensity];

  return (
    <div className="animated-background" aria-hidden="true">
      {/* Floating Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`particle particle--${particle.size}`}
        />
      ))}

      {/* Ambient Glow Orbs */}
      <div
        className="glow-orb glow-orb--primary"
        style={{ opacity: glowOpacity }}
      />
      <div
        className="glow-orb glow-orb--secondary"
        style={{ opacity: glowOpacity * 0.9 }}
      />
      <div
        className="glow-orb glow-orb--tertiary"
        style={{ opacity: glowOpacity * 0.8 }}
      />
    </div>
  );
}
