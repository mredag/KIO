/**
 * SurveyMode Component - Premium Survey UI
 * 
 * Elegant, animated survey experience for kiosk screens.
 * Features: emoji-based ratings, animated backgrounds, smooth transitions.
 * 
 * Requirements: All premium survey UI requirements
 * - 1.x: Premium Visual Design Foundation
 * - 2.x: Emoji-Based Rating Questions
 * - 3.x: Icon-Enhanced Single Choice Options
 * - 4.x: Animated Progress Indicator
 * - 5.x: Animated Question Decorations
 * - 6.x: Smooth Question Transitions
 * - 7.x: Premium Thank You Screen
 * - 8.x: Touch-Optimized Interactions
 * - 9.x: Dynamic Content Rendering
 * - 10.x: Accessibility and Localization
 * - 11.x: Performance Optimization
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../../stores/kioskStore';
import { useSurveyTemplate, useSubmitSurveyResponse } from '../../hooks/useKioskApi';

// Premium survey sub-components
import AnimatedBackground from './premium-survey/AnimatedBackground';
import EmojiRating from './premium-survey/EmojiRating';
import OptionCard from './premium-survey/OptionCard';
import ThankYouScreen from './premium-survey/ThankYouScreen';

// Import premium survey styles (Requirement 1.1, 1.2)
import '../../styles/premium-survey.css';

/**
 * Survey state interface
 */
interface SurveyState {
  currentQuestionIndex: number;
  answers: Record<string, any>;
  showThankYou: boolean;
  isTransitioning: boolean;
  timeLeft: number;
}

/**
 * Animation configuration
 */
const ANIMATION_CONFIG = {
  questionTransitionDuration: 300,
  autoAdvanceDelay: 400,
  thankYouDuration: 3000,
  questionTimeout: 30000, // 30 seconds per question
};

export default function SurveyMode() {
  const { t } = useTranslation('kiosk');
  const activeSurveyId = useKioskStore((state) => state.activeSurveyId);
  const setUserActive = useKioskStore((state) => state.setUserActive);
  
  const { data: survey, isLoading } = useSurveyTemplate(activeSurveyId);
  const { mutate: submitResponse } = useSubmitSurveyResponse();

  // Survey state
  const [state, setState] = useState<SurveyState>({
    currentQuestionIndex: 0,
    answers: {},
    showThankYou: false,
    isTransitioning: false,
    timeLeft: 30,
  });

  // Refs for timers
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSurveyIdRef = useRef<string | null>(null);

  // Mark user as active when survey is active
  useEffect(() => {
    setUserActive(true);
    return () => setUserActive(false);
  }, [setUserActive]);

  // Reset survey to initial state
  const resetSurvey = useCallback(() => {
    setState({
      currentQuestionIndex: 0,
      answers: {},
      showThankYou: false,
      isTransitioning: false,
      timeLeft: 30,
    });
  }, []);

  // Reset survey when survey ID changes
  useEffect(() => {
    if (survey?.id && survey.id !== lastSurveyIdRef.current) {
      resetSurvey();
      lastSurveyIdRef.current = survey.id;
    }
  }, [survey?.id, resetSurvey]);

  // Reset inactivity timer on any interaction (Requirement 7.4 from original)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    setState(prev => ({ ...prev, timeLeft: 30 }));

    inactivityTimerRef.current = setTimeout(() => {
      resetSurvey();
    }, ANIMATION_CONFIG.questionTimeout);
  }, [resetSurvey]);

  // Initialize timer on mount and when question changes
  useEffect(() => {
    if (state.showThankYou) return;

    setState(prev => ({ ...prev, timeLeft: 30 }));

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    inactivityTimerRef.current = setTimeout(() => {
      resetSurvey();
    }, ANIMATION_CONFIG.questionTimeout);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [state.currentQuestionIndex, state.showThankYou, resetSurvey]);

  // Countdown timer effect
  useEffect(() => {
    if (state.showThankYou) return;

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft > 0 ? prev.timeLeft - 1 : 0,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.showThankYou, state.currentQuestionIndex]);

  // Handle answer selection with auto-advance
  const handleAnswerSelect = useCallback((questionId: string, value: any, questionType: string) => {
    // Prevent selection during transitions (Requirement 6.4)
    if (state.isTransitioning) return;

    // ✅ CRITICAL: Create new answers object first (async setState bug fix)
    const newAnswers = { ...state.answers, [questionId]: value };
    setState(prev => ({ ...prev, answers: newAnswers }));
    resetInactivityTimer();

    // Auto-advance for single-choice and rating questions
    if (questionType === 'single-choice' || questionType === 'rating') {
      // Brief visual confirmation before transitioning (Requirement 6.2)
      setState(prev => ({ ...prev, isTransitioning: true }));
      
      transitionTimerRef.current = setTimeout(() => {
        advanceToNextQuestion(newAnswers);
      }, ANIMATION_CONFIG.autoAdvanceDelay);
    }
  }, [state.isTransitioning, state.answers, resetInactivityTimer]);

  // Advance to next question or submit survey
  const advanceToNextQuestion = useCallback((currentAnswers: Record<string, any>) => {
    if (!survey) return;

    // Find next visible question (handle conditional questions)
    let nextIndex = state.currentQuestionIndex + 1;
    while (nextIndex < survey.questions.length) {
      const nextQuestion = survey.questions[nextIndex];
      if (!nextQuestion.conditionalOn || 
          (currentAnswers[nextQuestion.conditionalOn.questionId] !== undefined &&
           nextQuestion.conditionalOn.values.includes(currentAnswers[nextQuestion.conditionalOn.questionId]))) {
        break;
      }
      nextIndex++;
    }

    if (nextIndex < survey.questions.length) {
      // Move to next question with animation
      setState(prev => ({
        ...prev,
        currentQuestionIndex: nextIndex,
        isTransitioning: false,
      }));
    } else {
      // Submit survey
      submitSurvey(currentAnswers);
    }
  }, [survey, state.currentQuestionIndex]);

  // Submit survey and show thank you screen
  const submitSurvey = useCallback((finalAnswers: Record<string, any>) => {
    if (!survey) return;

    // Log survey submission for debugging (works in production too)
    console.log('[Survey] Submitting response:', {
      surveyId: survey.id,
      answersCount: Object.keys(finalAnswers).length,
      answerKeys: Object.keys(finalAnswers),
    });

    // Check if any question triggered Google Review
    let shouldShowGoogleReview = false;
    survey.questions.forEach(question => {
      if (question.googleReviewAction?.enabled && question.type === 'rating') {
        const answer = finalAnswers[question.id];
        if (answer && parseInt(answer) >= question.googleReviewAction.minRating) {
          shouldShowGoogleReview = true;
        }
      }
    });

    // Submit survey response
    submitResponse({
      surveyId: survey.id,
      timestamp: new Date(),
      answers: finalAnswers,
    }, {
      onSuccess: () => console.log('[Survey] Response submitted successfully'),
      onError: (error: any) => console.error('[Survey] Submission failed:', error?.message || error),
    });

    // Show thank you screen
    setState(prev => ({ ...prev, showThankYou: true, isTransitioning: false }));

    // Handle post-submission navigation
    setTimeout(() => {
      if (shouldShowGoogleReview) {
        // Set flag so GoogleQRMode knows to return to survey
        sessionStorage.setItem('returnToSurvey', 'true');
        useKioskStore.getState().setMode('google-qr');
      } else {
        // Reset after thank you duration
        resetSurvey();
      }
    }, ANIMATION_CONFIG.thankYouDuration);
  }, [survey, submitResponse, resetSurvey]);

  // Handle previous question navigation (Requirement 6.3)
  const handlePrevious = useCallback(() => {
    if (!survey || state.isTransitioning || state.currentQuestionIndex === 0) return;

    setState(prev => ({ ...prev, isTransitioning: true }));

    // Find previous visible question
    let prevIndex = state.currentQuestionIndex - 1;
    while (prevIndex >= 0) {
      const prevQuestion = survey.questions[prevIndex];
      if (!prevQuestion.conditionalOn || 
          (state.answers[prevQuestion.conditionalOn.questionId] !== undefined &&
           prevQuestion.conditionalOn.values.includes(state.answers[prevQuestion.conditionalOn.questionId]))) {
        break;
      }
      prevIndex--;
    }

    if (prevIndex >= 0) {
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          currentQuestionIndex: prevIndex,
          isTransitioning: false,
        }));
      }, ANIMATION_CONFIG.questionTransitionDuration);
    } else {
      setState(prev => ({ ...prev, isTransitioning: false }));
    }
  }, [survey, state.isTransitioning, state.currentQuestionIndex, state.answers]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Loading state with premium styling
  if (isLoading || !survey) {
    return (
      <div className="premium-survey">
        <AnimatedBackground particleCount={15} glowIntensity="low" />
        <div className="premium-survey-content">
          <div className="survey-loading" role="status" aria-live="polite">
            <div className="survey-loading__spinner" aria-hidden="true" />
            <p className="survey-loading__text">{t('survey.loading', 'Anket yükleniyor...')}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = survey.questions[state.currentQuestionIndex];
  const shouldShowTimer = survey.questions.length > 1 && state.currentQuestionIndex > 0;

  // Thank you screen (Requirement 7.x)
  if (state.showThankYou) {
    return (
      <div className="premium-survey">
        <AnimatedBackground particleCount={20} glowIntensity="high" />
        <ThankYouScreen
          message={t('survey.satisfaction.thankYou', 'Teşekkür Ederiz!')}
          subMessage={t('survey.discovery.thankYouMessage', 'Geri bildiriminiz bizim için değerli.')}
          showCelebration={true}
          showConfetti={true}
        />
      </div>
    );
  }

  return (
    <div 
      className="premium-survey"
      onClick={resetInactivityTimer}
      onTouchStart={resetInactivityTimer}
    >
      {/* Animated Background (Requirement 1.1, 11.5) */}
      <AnimatedBackground particleCount={20} glowIntensity="medium" />

      {/* Timer Display */}
      {shouldShowTimer && (
        <div 
          className={`survey-timer ${state.timeLeft <= 10 ? 'survey-timer--warning' : ''}`}
          role="timer"
          aria-label={t('aria.timeRemaining', { seconds: state.timeLeft })}
        >
          <span aria-hidden="true">⏱️</span> {state.timeLeft}s
        </div>
      )}

      <div className="premium-survey-content">
        {/* Survey Header - Compact design, always visible */}
        <header className="survey-header">
          <div className="survey-badge" aria-label={t('aria.quickSurvey', 'Hızlı Anket')}>
            <span className="survey-badge__sparkle" aria-hidden="true">✨</span>
            <span>{t('survey.quickSurvey', 'Hızlı Anket')}</span>
          </div>
          {/* Title from database (Requirement 9.1) */}
          <h1 className="survey-title">{survey.title}</h1>
        </header>

        {/* Question Card - Compact design without progress bar, emoji, or repeated question */}
        {currentQuestion && (
          <div 
            className={`question-card ${state.isTransitioning ? 'question-card--transitioning' : ''}`}
            role="group"
            aria-labelledby="question-text"
          >
            {/* Question Text - Rendered from database (Requirement 9.2) */}
            <h2 id="question-text" className="question-text">
              {currentQuestion.text}
              {currentQuestion.isRequired && (
                <span className="text-red-400 ml-2" aria-label={t('aria.required', 'Zorunlu')}>*</span>
              )}
            </h2>

            {/* Rating Question (Requirement 2.x) */}
            {currentQuestion.type === 'rating' && (
              <EmojiRating
                options={currentQuestion.options}
                selectedValue={state.answers[currentQuestion.id] ? parseInt(state.answers[currentQuestion.id]) : null}
                onSelect={(value) => handleAnswerSelect(currentQuestion.id, value, 'rating')}
                disabled={state.isTransitioning}
              />
            )}

            {/* Single Choice Question - Options from database (Requirement 3.x, 9.3) */}
            {currentQuestion.type === 'single-choice' && (
              <div 
                className="option-cards" 
                role="radiogroup" 
                aria-label={currentQuestion.text}
              >
                {currentQuestion.options.map((option, index) => (
                  <OptionCard
                    key={option}
                    option={option}
                    isSelected={state.answers[currentQuestion.id] === option}
                    onSelect={() => handleAnswerSelect(currentQuestion.id, option, 'single-choice')}
                    animationIndex={index}
                    animate={!state.isTransitioning}
                    disabled={state.isTransitioning}
                    ariaLabel={`${option}${state.answers[currentQuestion.id] === option ? ` - ${t('aria.selected', 'Seçili')}` : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation - Only show back button if not on first question */}
        {state.currentQuestionIndex > 0 && (
          <nav className="mt-8" aria-label={t('aria.surveyNavigation', 'Anket navigasyonu')}>
            <button
              onClick={handlePrevious}
              disabled={state.isTransitioning}
              className="option-card ripple press-down"
              style={{ minWidth: '120px', minHeight: '60px' }}
              aria-label={t('aria.previousQuestion', 'Önceki soru')}
            >
              <span aria-hidden="true">←</span> {t('survey.back', 'Geri')}
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
