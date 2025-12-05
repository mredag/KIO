/**
 * AnimatedQuestionEmoji Component
 * 
 * Displays a thematic emoji based on question context with continuous animation.
 * Supports entrance and exit animations for smooth transitions.
 * 
 * Requirements: 5.1, 5.5, 6.5
 */

import { useState, useEffect } from 'react';
import { getQuestionEmoji, type AnimationType } from '../../../lib/surveyIcons';

interface AnimatedQuestionEmojiProps {
  /** Question text to analyze for emoji selection */
  questionText: string;
  /** Question type (rating, single-choice, etc.) */
  questionType?: string;
  /** Custom emoji override */
  customEmoji?: string;
  /** Custom animation override */
  customAnimation?: AnimationType;
  /** Whether the emoji is entering (for transition) */
  isEntering?: boolean;
  /** Whether the emoji is exiting (for transition) */
  isExiting?: boolean;
}

/**
 * Maps animation type to CSS class
 */
function getAnimationClass(animation: AnimationType): string {
  const animationClasses: Record<AnimationType, string> = {
    float: 'emoji-float',
    pulse: 'emoji-pulse',
    bounce: 'emoji-bounce',
    rotate: 'emoji-rotate',
  };
  return animationClasses[animation] || 'emoji-float';
}

export default function AnimatedQuestionEmoji({
  questionText,
  questionType,
  customEmoji,
  customAnimation,
  isEntering = false,
  isExiting = false,
}: AnimatedQuestionEmojiProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Get emoji config from question context
  const emojiConfig = getQuestionEmoji(questionText, questionType);
  
  // Use custom values if provided, otherwise use intelligent selection
  const emoji = customEmoji || emojiConfig.emoji;
  const animation = customAnimation || emojiConfig.animation;
  const animationClass = getAnimationClass(animation);

  // Handle entrance/exit animations
  useEffect(() => {
    if (isExiting) {
      setIsVisible(false);
    } else if (isEntering) {
      setIsVisible(true);
    }
  }, [isEntering, isExiting]);

  // Determine transition class
  let transitionClass = '';
  if (isEntering) {
    transitionClass = 'emoji-enter';
  } else if (isExiting) {
    transitionClass = 'emoji-exit';
  }

  return (
    <div
      className={`
        question-emoji
        ${animationClass}
        ${transitionClass}
      `}
      aria-hidden="true"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      {emoji}
    </div>
  );
}
