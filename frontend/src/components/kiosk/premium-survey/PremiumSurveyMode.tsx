/**
 * PremiumSurveyMode Component
 * 
 * Main component that orchestrates the premium survey experience.
 * Integrates all sub-components with smooth transitions and animations.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 8.1, 8.3
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../../../stores/kioskStore';
import { useSurveyTemplate, useSubmitSurveyResponse } from '../../../hooks/useKioskApi';

// Premium survey sub-components
import AnimatedBackground from './AnimatedBackground';
import EmojiRating from './EmojiRating';
import OptionCard from './OptionCard';
import AnimatedQuestionEmoji from './AnimatedQuestionEmoji';
import ProgressIndicator from './ProgressIndicator';
import ThankYouScreen from './ThankYouScreen';

// Import premium survey styles
import '../../../styles/premium-survey.css';

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

export default function PremiumSurveyMode() {
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


  // Reset inactivity timer on any interaction
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

    // Create new answers object
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

    console.log('[PremiumSurvey] Submitting response:', {
      surveyId: survey.id,
      answersCount: Object.keys(finalAnswers).length,
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
      onSuccess: () => console.log('[PremiumSurvey] Response submitted successfully'),
      onError: (error: any) => console.error('[PremiumSurvey] Submission failed:', error?.message || error),
    });

    // Show thank you screen
    setState(prev => ({ ...prev, showThankYou: true, isTransitioning: false }));

    // Handle post-submission navigation
    setTimeout(() => {
      if (shouldShowGoogleReview) {
        sessionStorage.setItem('returnToSurvey', 'true');
        useKioskStore.getState().setMode('google-qr');
      } else {
        resetSurvey();
      }
    }, ANIMATION_CONFIG.thankYouDuration);
  }, [survey, submitResponse, resetSurvey]);


  // Handle previous question navigation
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

  // Loading state
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

  // Thank you screen
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
      {/* Animated Background */}
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
        {/* Survey Header - Only on first question */}
        {state.currentQuestionIndex === 0 && (
          <header className="survey-header">
            <div className="survey-badge" aria-label={t('aria.quickSurvey', 'Hızlı Anket')}>
              <span className="survey-badge__sparkle" aria-hidden="true">✨</span>
              <span>{t('survey.quickSurvey', 'Hızlı Anket')}</span>
            </div>
            <h1 className="survey-title">{survey.title}</h1>
            {survey.description && (
              <p className="survey-description">{survey.description}</p>
            )}
          </header>
        )}

        {/* Progress Indicator */}
        <ProgressIndicator
          currentIndex={state.currentQuestionIndex}
          totalQuestions={survey.questions.length}
          showProgressBar={true}
          showDots={survey.questions.length <= 10}
          showCounter={true}
        />

        {/* Question Card */}
        {currentQuestion && (
          <div 
            className={`question-card ${state.isTransitioning ? 'question-card--transitioning' : ''}`}
            role="group"
            aria-labelledby="question-text"
          >
            {/* Animated Question Emoji */}
            <AnimatedQuestionEmoji
              questionText={currentQuestion.text}
              questionType={currentQuestion.type}
              isEntering={!state.isTransitioning}
              isExiting={state.isTransitioning}
            />

            {/* Question Text - Rendered from database (Requirement 9.2) */}
            <h2 id="question-text" className="question-text">
              {currentQuestion.text}
              {currentQuestion.isRequired && (
                <span className="text-red-400 ml-2" aria-label={t('aria.required', 'Zorunlu')}>*</span>
              )}
            </h2>

            {/* Rating Question */}
            {currentQuestion.type === 'rating' && (
              <EmojiRating
                options={currentQuestion.options}
                selectedValue={state.answers[currentQuestion.id] ? parseInt(state.answers[currentQuestion.id]) : null}
                onSelect={(value) => handleAnswerSelect(currentQuestion.id, value, 'rating')}
                disabled={state.isTransitioning}
              />
            )}

            {/* Single Choice Question - Options from database (Requirement 9.3) */}
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
                    icon={currentQuestion.optionIcons?.[index]}
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
