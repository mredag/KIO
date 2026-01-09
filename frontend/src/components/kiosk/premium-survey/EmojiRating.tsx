/**
 * EmojiRating Component
 * 
 * Renders emoji-based rating options with hover/touch glow effects
 * and sentiment-colored selection highlights.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { useTranslation } from 'react-i18next';
import {
  RATING_EMOJIS,
  RATING_COLORS,
  DEFAULT_RATING_LABELS,
} from '../../../lib/surveyIcons';

interface EmojiRatingProps {
  /** Rating values from database (e.g., ['1', '2', '3', '4', '5']) */
  options: string[];
  /** Currently selected rating value */
  selectedValue: number | null;
  /** Callback when a rating is selected */
  onSelect: (value: number) => void;
  /** Custom labels from database or i18n */
  labels?: { min: string; max: string };
  /** Whether input is disabled (during transitions) */
  disabled?: boolean;
}

export default function EmojiRating({
  options,
  selectedValue,
  onSelect,
  labels,
  disabled = false,
}: EmojiRatingProps) {
  const { t } = useTranslation('kiosk');

  // Get rating labels from i18n with fallback to defaults
  const getRatingLabel = (rating: number): string => {
    const i18nKey = `survey.premium.ratingLabels.${rating}`;
    const translated = t(i18nKey, { defaultValue: '' });
    return translated || DEFAULT_RATING_LABELS[rating] || `${rating}`;
  };

  // Use provided labels or fallback to i18n/defaults
  const minLabel = labels?.min || t('survey.premium.ratingMinLabel', DEFAULT_RATING_LABELS[1]);
  const maxLabel = labels?.max || t('survey.premium.ratingMaxLabel', DEFAULT_RATING_LABELS[5]);

  // Parse options to numbers and sort
  const ratingValues = options
    .map((opt) => parseInt(opt, 10))
    .filter((val) => !isNaN(val) && val >= 1 && val <= 5)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-col items-center">
      <div className="emoji-rating" role="radiogroup" aria-label={t('aria.ratingButton', { rating: '' })}>
        {ratingValues.map((rating) => {
          const isSelected = selectedValue === rating;
          const emoji = RATING_EMOJIS[rating] || '😐';
          const color = RATING_COLORS[rating] || '#eab308';
          const label = getRatingLabel(rating);

          return (
            <button
              key={rating}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t('aria.ratingButton', { rating: label })}
              data-rating={rating}
              disabled={disabled}
              onClick={() => onSelect(rating)}
              className={`
                emoji-rating__option ripple press-down
                ${isSelected ? 'emoji-rating__option--selected' : ''}
              `}
              style={
                isSelected
                  ? { boxShadow: `0 0 30px ${color}40` }
                  : undefined
              }
            >
              <span className="emoji-rating__emoji">{emoji}</span>
              <span className="emoji-rating__label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Min/Max Labels */}
      <div className="flex justify-between w-full max-w-lg px-4 mt-4 text-lg text-gray-400 font-medium">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
