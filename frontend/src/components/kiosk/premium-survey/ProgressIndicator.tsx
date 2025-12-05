/**
 * ProgressIndicator Component
 * 
 * Renders step dots with glow effect, progress bar with animated fill,
 * and "Soru X / Y" counter.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import { useTranslation } from 'react-i18next';

interface ProgressIndicatorProps {
  /** Current question index (0-based) */
  currentIndex: number;
  /** Total number of questions */
  totalQuestions: number;
  /** Whether to show the progress bar */
  showProgressBar?: boolean;
  /** Whether to show step dots */
  showDots?: boolean;
  /** Whether to show the counter text */
  showCounter?: boolean;
}

export default function ProgressIndicator({
  currentIndex,
  totalQuestions,
  showProgressBar = true,
  showDots = true,
  showCounter = true,
}: ProgressIndicatorProps) {
  const { t } = useTranslation('kiosk');
  
  // Calculate progress percentage
  const progressPercent = totalQuestions > 0
    ? ((currentIndex + 1) / totalQuestions) * 100
    : 0;

  // Human-readable question number (1-based)
  const currentQuestion = currentIndex + 1;

  return (
    <div className="progress-indicator" role="progressbar" aria-valuenow={currentQuestion} aria-valuemin={1} aria-valuemax={totalQuestions}>
      {/* Step Dots */}
      {showDots && totalQuestions <= 10 && (
        <div className="progress-dots">
          {Array.from({ length: totalQuestions }, (_, index) => {
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;

            return (
              <div
                key={index}
                className={`
                  progress-dot
                  ${isActive ? 'progress-dot--active' : ''}
                  ${isCompleted ? 'progress-dot--completed' : ''}
                `}
                aria-hidden="true"
              />
            );
          })}
        </div>
      )}

      {/* Progress Bar */}
      {showProgressBar && (
        <div className="progress-bar">
          <div
            className="progress-bar__fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Counter Text */}
      {showCounter && (
        <div className="progress-counter">
          {t('survey.progress.questionCounter', { current: currentQuestion, total: totalQuestions, defaultValue: `Soru ${currentQuestion} / ${totalQuestions}` })}
        </div>
      )}
    </div>
  );
}
