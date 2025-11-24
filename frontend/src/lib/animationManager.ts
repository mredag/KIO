/**
 * Animation Manager for Raspberry Pi Performance Optimization
 * 
 * Limits concurrent animations to maximum 3 elements to maintain
 * 30+ FPS on Raspberry Pi hardware.
 * 
 * Requirements: 17.5 - Limit concurrent animations to maximum 3 elements
 */

class AnimationManager {
  private activeAnimations: Set<HTMLElement> = new Set();
  private readonly MAX_CONCURRENT = 3;

  /**
   * Request animation for an element
   * Returns true if animation can proceed, false if limit reached
   */
  requestAnimation(element: HTMLElement): boolean {
    // If already animating, allow it
    if (this.activeAnimations.has(element)) {
      return true;
    }

    // Check if we've reached the limit
    if (this.activeAnimations.size >= this.MAX_CONCURRENT) {
      console.warn(
        `Animation limit reached (${this.MAX_CONCURRENT}). Deferring animation.`
      );
      return false;
    }

    // Add to active set
    this.activeAnimations.add(element);
    return true;
  }

  /**
   * Release animation slot when animation completes
   */
  releaseAnimation(element: HTMLElement): void {
    this.activeAnimations.delete(element);
  }

  /**
   * Get count of currently active animations
   */
  getActiveCount(): number {
    return this.activeAnimations.size;
  }

  /**
   * Check if animation can be started
   */
  canAnimate(): boolean {
    return this.activeAnimations.size < this.MAX_CONCURRENT;
  }

  /**
   * Clear all tracked animations (useful for cleanup)
   */
  clearAll(): void {
    this.activeAnimations.clear();
  }
}

// Singleton instance
export const animationManager = new AnimationManager();

/**
 * Helper function to safely animate an element with will-change optimization
 * 
 * @param element - The element to animate
 * @param animationFn - Function that performs the animation
 * @param duration - Animation duration in milliseconds
 * @param willChangeProps - CSS properties to hint with will-change
 */
export async function safeAnimate(
  element: HTMLElement,
  animationFn: () => void | Promise<void>,
  duration: number,
  willChangeProps: 'transform' | 'opacity' | 'transform-opacity' = 'opacity'
): Promise<void> {
  // Check if we can animate
  if (!animationManager.requestAnimation(element)) {
    // If limit reached, skip animation but still execute the state change
    console.warn('Animation skipped due to concurrent limit');
    return;
  }

  try {
    // Add will-change hint for performance (Requirement 17.5)
    const willChangeClass = `will-change-${willChangeProps}`;
    element.classList.add(willChangeClass);

    // Execute animation
    await animationFn();

    // Wait for animation to complete
    await new Promise((resolve) => setTimeout(resolve, duration));

    // Remove will-change to free resources (Requirement 17.5)
    element.classList.remove(willChangeClass);
  } finally {
    // Always release the animation slot
    animationManager.releaseAnimation(element);
  }
}

/**
 * Helper to add fade transition class
 */
export function addFadeTransition(element: HTMLElement): void {
  element.classList.add('fade-transition');
}

/**
 * Helper to trigger fade in animation
 */
export function fadeIn(element: HTMLElement): void {
  element.classList.remove('fade-out');
  element.classList.add('fade-in');
}

/**
 * Helper to trigger fade out animation
 */
export function fadeOut(element: HTMLElement): void {
  element.classList.remove('fade-in');
  element.classList.add('fade-out');
}
