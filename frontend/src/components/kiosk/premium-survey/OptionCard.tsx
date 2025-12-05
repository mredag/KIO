/**
 * OptionCard Component
 * 
 * Renders a single-choice option card with icon, text, and glowing border.
 * Supports hover/touch animations and staggered entrance animation.
 * Supports both emoji icons and image URLs (including brand logos).
 * 
 * Requirements: 3.1, 3.3, 3.4, 3.6
 */

import { getOptionIcon, isImageUrl } from '../../../lib/surveyIcons';

interface OptionCardProps {
  /** Option text from database */
  option: string;
  /** Custom icon (emoji or image URL) - if not provided, uses intelligent mapping */
  icon?: string;
  /** Whether this option is currently selected */
  isSelected: boolean;
  /** Callback when option is selected */
  onSelect: () => void;
  /** Animation delay index for staggered entrance (0-based) */
  animationIndex?: number;
  /** Whether to animate entrance */
  animate?: boolean;
  /** Whether input is disabled (during transitions) */
  disabled?: boolean;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

export default function OptionCard({
  option,
  icon,
  isSelected,
  onSelect,
  animationIndex = 0,
  animate = true,
  disabled = false,
  ariaLabel,
}: OptionCardProps) {
  // Use provided icon or get from intelligent mapping
  const displayIcon = getOptionIcon(option, icon);
  const isImage = isImageUrl(displayIcon);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={ariaLabel || option}
      disabled={disabled}
      onClick={onSelect}
      className={`
        option-card ripple press-down
        ${isSelected ? 'option-card--selected' : ''}
        ${animate ? 'option-card--animate' : ''}
      `}
      style={
        animate
          ? { animationDelay: `${animationIndex * 50}ms` }
          : undefined
      }
    >
      {/* Glowing border effect handled by CSS ::before */}
      
      {/* Icon - supports both emoji and images */}
      <span className="option-card__icon" aria-hidden="true">
        {isImage ? (
          <img 
            src={displayIcon} 
            alt="" 
            className="w-8 h-8 object-contain"
            loading="lazy"
          />
        ) : (
          displayIcon
        )}
      </span>

      {/* Text */}
      <span className="option-card__text">{option}</span>

      {/* Checkmark indicator (visible when selected) */}
      <span className="option-card__check" aria-hidden="true" />
    </button>
  );
}
