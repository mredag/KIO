import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../../stores/kioskStore';
import { useSurveyTemplate, useSubmitSurveyResponse } from '../../hooks/useKioskApi';

/**
 * Survey Mode Component - Dynamic Question Rendering
 * Performance optimized for Raspberry Pi (Requirements 17.1, 17.2, 17.5)
 */
export default function SurveyMode() {
  const { t } = useTranslation('kiosk');
  const activeSurveyId = useKioskStore((state) => state.activeSurveyId);
  const setUserActive = useKioskStore((state) => state.setUserActive);
  
  const { data: survey, isLoading } = useSurveyTemplate(activeSurveyId);
  const { mutate: submitResponse } = useSubmitSurveyResponse();

  // Mark user as active when survey is active
  useEffect(() => {
    setUserActive(true);
    
    return () => {
      setUserActive(false);
    };
  }, [setUserActive]);

  // Dynamic survey state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showThankYou, setShowThankYou] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds per question

  // Per-question timeout (30 seconds)
  const questionTimeout = 30 * 1000;

  // Reset survey to initial state
  const resetSurvey = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowThankYou(false);
  }, []);

  // Reset survey when survey ID actually changes (not on refetch)
  // Use a ref to track the previous survey ID to avoid resets on refetch
  const [lastSurveyId, setLastSurveyId] = useState<string | null>(null);
  
  useEffect(() => {
    if (survey?.id && survey.id !== lastSurveyId) {
      // Survey ID changed - reset
      resetSurvey();
      setLastSurveyId(survey.id);
    }
  }, [survey?.id, lastSurveyId, resetSurvey]);

  // Reset inactivity timer on any interaction (Requirement 7.4)
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Reset countdown to 30 seconds
    setTimeLeft(30);

    // Create new timer
    const timer = setTimeout(() => {
      // Clear all selected answers and return to first question (Requirements 7.1, 7.2, 7.3)
      resetSurvey();
    }, questionTimeout);

    inactivityTimerRef.current = timer;
  }, [questionTimeout, resetSurvey]);

  // Initialize timer on mount and when question changes
  useEffect(() => {
    // Reset timer to 30 seconds for new question
    setTimeLeft(30);
    
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Create new timer
    const timer = setTimeout(() => {
      resetSurvey();
    }, questionTimeout);

    inactivityTimerRef.current = timer;

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [currentQuestionIndex, showThankYou, questionTimeout, resetSurvey]);

  // Countdown timer effect
  useEffect(() => {
    if (showThankYou) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showThankYou, currentQuestionIndex]);

  // Handle answer selection
  const handleAnswerSelect = (questionId: string, value: any, questionType: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    resetInactivityTimer();
    
    // Auto-advance for single-choice and rating questions (better UX, less time consuming)
    if (questionType === 'single-choice' || questionType === 'rating') {
      // Small delay for visual feedback, then advance with the updated answers
      setTimeout(() => {
        handleNextWithAnswers(newAnswers);
      }, 300);
    }
  };

  // Handle next question with explicit answers (for auto-advance)
  const handleNextWithAnswers = (currentAnswers: Record<string, any>) => {
    if (!survey) return;
    
    const container = document.getElementById('survey-content');
    if (container) {
      container.style.opacity = '0';
      setTimeout(() => {
        if (currentQuestionIndex < survey.questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
        } else {
          // Submit survey with the provided answers
          submitResponse({
            surveyId: survey.id,
            timestamp: new Date(),
            answers: currentAnswers,
          });
          setShowThankYou(true);
          
          // Reset after 3 seconds
          setTimeout(() => {
            resetSurvey();
          }, 3000);
        }
        container.style.opacity = '1';
      }, 150);
    }
  };

  // Handle next question
  const handleNext = () => {
    if (!survey) return;
    
    const container = document.getElementById('survey-content');
    if (container) {
      container.style.opacity = '0';
      setTimeout(() => {
        if (currentQuestionIndex < survey.questions.length - 1) {
          setCurrentQuestionIndex(prev => prev + 1);
        } else {
          // Submit survey
          submitResponse({
            surveyId: survey.id,
            timestamp: new Date(),
            answers,
          });
          setShowThankYou(true);
          
          // Reset after 3 seconds
          setTimeout(() => {
            resetSurvey();
          }, 3000);
        }
        container.style.opacity = '1';
      }, 150);
    }
  };

  // Handle previous question
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      const container = document.getElementById('survey-content');
      if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev - 1);
          container.style.opacity = '1';
        }, 150);
      }
    }
  };

  // Check if current question is answered
  const isCurrentQuestionAnswered = () => {
    if (!survey) return false;
    const currentQuestion = survey.questions[currentQuestionIndex];
    if (!currentQuestion) return false;
    
    if (!currentQuestion.isRequired) return true;
    return answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== null;
  };

  if (isLoading || !survey) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">{t('survey.loading')}</p>
        </div>
      </div>
    );
  }

  const currentQuestion = survey.questions[currentQuestionIndex];

  // Determine if we should show the timer
  const shouldShowTimer = survey && survey.questions.length > 1 && currentQuestionIndex > 0;

  return (
    <div 
      className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6"
      onClick={resetInactivityTimer}
      onTouchStart={resetInactivityTimer}
    >
      <div id="survey-content" className="w-full max-w-6xl fade-transition" style={{ opacity: 1, transition: 'opacity 150ms' }}>
        {!showThankYou ? (
          <div className="text-center">
            {/* Timer Display - Only show after first question and for multi-question surveys */}
            {shouldShowTimer && (
              <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-full px-4 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-xl font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-gray-700'}`}>
                    {timeLeft}s
                  </span>
                </div>
              </div>
            )}

            {/* Survey Header */}
            {currentQuestionIndex === 0 && (
              <div className="mb-4">
                <h2 className="text-3xl font-bold mb-2 text-white">{survey.title}</h2>
                {survey.description && (
                  <p className="text-lg text-gray-300 mb-4">{survey.description}</p>
                )}
              </div>
            )}

            {/* Progress Indicator */}
            <div className="mb-4">
              <div className="flex justify-center items-center gap-2 mb-2">
                {survey.questions.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === currentQuestionIndex
                        ? 'w-8 bg-blue-500'
                        : index < currentQuestionIndex
                        ? 'w-2 bg-blue-400'
                        : 'w-2 bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-400">
                Soru {currentQuestionIndex + 1} / {survey.questions.length}
              </p>
            </div>

            {/* Question */}
            {currentQuestion && (
              <div className="mb-5">
                <p className="text-2xl text-white mb-5">
                  {currentQuestion.text}
                  {currentQuestion.isRequired && <span className="text-red-400 ml-2">*</span>}
                </p>

                {/* Rating Question */}
                {currentQuestion.type === 'rating' && (
                  <div>
                    <div className="flex justify-center gap-4 mb-3">
                      {currentQuestion.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleAnswerSelect(currentQuestion.id, parseInt(option), 'rating')}
                          className={`
                            w-20 h-20 rounded-full text-3xl font-bold
                            transition-all duration-200 transform hover:scale-110
                            ${answers[currentQuestion.id] === parseInt(option)
                              ? 'bg-blue-500 text-white shadow-lg scale-110'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }
                          `}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between max-w-md mx-auto text-sm text-gray-400">
                      <span>Çok Kötü</span>
                      <span>Mükemmel</span>
                    </div>
                  </div>
                )}

                {/* Single Choice Question */}
                {currentQuestion.type === 'single-choice' && (
                  <div className={`
                    grid gap-3 max-w-5xl mx-auto
                    ${currentQuestion.options.length <= 5 ? 'grid-cols-1' : 'grid-cols-2'}
                  `}>
                    {currentQuestion.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option, 'single-choice')}
                        className={`
                          p-4 rounded-lg text-base font-medium
                          transition-all duration-200 transform hover:scale-105
                          ${answers[currentQuestion.id] === option
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }
                        `}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons - Only show for multi-answer questions or when needed */}
            <div className="flex justify-center gap-4 mt-5">
              {currentQuestionIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="
                    px-8 py-3 rounded-lg text-lg font-bold
                    bg-gray-600 text-gray-300 hover:bg-gray-500
                    transition-all duration-200 transform hover:scale-105
                  "
                >
                  ← Geri
                </button>
              )}
              
              {/* Only show Next/Submit button for multi-answer questions or text input */}
              {currentQuestion?.type !== 'single-choice' && currentQuestion?.type !== 'rating' && (
                <>
                  <button
                    onClick={handleNext}
                    disabled={!isCurrentQuestionAnswered()}
                    className={`
                      px-12 py-3 rounded-lg text-lg font-bold
                      transition-all duration-200 transform hover:scale-105
                      ${isCurrentQuestionAnswered()
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {currentQuestionIndex < survey.questions.length - 1 ? 'İleri →' : 'Gönder ✓'}
                  </button>

                  {!currentQuestion?.isRequired && (
                    <button
                      onClick={handleNext}
                      className="
                        px-8 py-3 rounded-lg text-lg font-bold
                        bg-gray-600 text-gray-300 hover:bg-gray-500
                        transition-all duration-200 transform hover:scale-105
                      "
                    >
                      Atla →
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          /* Thank You Screen */
          <div className="text-center">
            <h2 className="text-5xl font-bold mb-6 text-white">Teşekkür Ederiz!</h2>
            <p className="text-2xl text-gray-300">
              Görüşleriniz bizim için çok değerli.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
