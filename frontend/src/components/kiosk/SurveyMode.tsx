import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../../stores/kioskStore';
import { useSurveyTemplate, useSubmitSurveyResponse } from '../../hooks/useKioskApi';

/**
 * Survey Mode Component - Dynamic Question Rendering
 * Optimized for 15-inch kiosk screens - maximizes space usage for readability
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
    // ✅ CRITICAL: Create new answers object first
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    resetInactivityTimer();
    
    // Auto-advance for single-choice and rating questions (better UX, less time consuming)
    if (questionType === 'single-choice' || questionType === 'rating') {
      // Small delay for visual feedback, then advance with the updated answers
      setTimeout(() => {
        handleNextWithAnswers(newAnswers);  // ✅ Pass newAnswers directly
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
        // Find next visible question
        let nextIndex = currentQuestionIndex + 1;
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
          setCurrentQuestionIndex(nextIndex);
        } else {
          // Log survey submission for debugging (works in production too)
          console.log('[Survey] Submitting response:', {
            surveyId: survey.id,
            answersCount: Object.keys(currentAnswers).length,
            answerKeys: Object.keys(currentAnswers),
          });
          
          // Check if any question triggered Google Review
          let shouldShowGoogleReview = false;
          survey.questions.forEach(question => {
            if (question.googleReviewAction?.enabled && question.type === 'rating') {
              const answer = currentAnswers[question.id];
              if (answer && parseInt(answer) >= question.googleReviewAction.minRating) {
                shouldShowGoogleReview = true;
              }
            }
          });
          
          // Submit survey with the provided answers
          submitResponse({
            surveyId: survey.id,
            timestamp: new Date(),
            answers: currentAnswers,
          }, {
            onSuccess: () => {
              console.log('[Survey] Response submitted successfully');
            },
            onError: (error: any) => {
              console.error('[Survey] Submission failed:', error?.message || error);
            },
          });
          setShowThankYou(true);
          
          // If Google Review should be shown, switch to google-qr mode after thank you
          if (shouldShowGoogleReview) {
            setTimeout(() => {
              // Set flag so GoogleQRMode knows to return to survey
              sessionStorage.setItem('returnToSurvey', 'true');
              useKioskStore.getState().setMode('google-qr');
            }, 3000);
          } else {
            // Reset after 3 seconds
            setTimeout(() => {
              resetSurvey();
            }, 3000);
          }
        }
        container.style.opacity = '1';
      }, 150);
    }
  };

  // Handle next question
  const handleNext = () => {
    if (!survey) return;
    
    // ✅ CRITICAL: Capture current answers at call time (async setState bug fix)
    // This ensures we use the latest answers even if setState hasn't completed
    setAnswers(currentAnswers => {
      const container = document.getElementById('survey-content');
      if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
          // Find next visible question
          let nextIndex = currentQuestionIndex + 1;
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
            setCurrentQuestionIndex(nextIndex);
          } else {
            // Log survey submission for debugging
            console.log('[Survey] Submitting response (handleNext):', {
              surveyId: survey.id,
              answersCount: Object.keys(currentAnswers).length,
              answerKeys: Object.keys(currentAnswers),
            });
            
            // Check if any question triggered Google Review
            let shouldShowGoogleReview = false;
            survey.questions.forEach(question => {
              if (question.googleReviewAction?.enabled && question.type === 'rating') {
                const answer = currentAnswers[question.id];
                if (answer && parseInt(answer) >= question.googleReviewAction.minRating) {
                  shouldShowGoogleReview = true;
                }
              }
            });
            
            // Submit survey with captured answers
            submitResponse({
              surveyId: survey.id,
              timestamp: new Date(),
              answers: currentAnswers,  // ✅ Use captured value from setState callback
            }, {
              onSuccess: () => {
                console.log('[Survey] Response submitted successfully');
              },
              onError: (error: any) => {
                console.error('[Survey] Submission failed:', error?.message || error);
              },
            });
            setShowThankYou(true);
            
            // If Google Review should be shown, switch to google-qr mode after thank you
            if (shouldShowGoogleReview) {
              setTimeout(() => {
                // Set flag so GoogleQRMode knows to return to survey
                sessionStorage.setItem('returnToSurvey', 'true');
                useKioskStore.getState().setMode('google-qr');
              }, 3000);
            } else {
              // Reset after 3 seconds
              setTimeout(() => {
                resetSurvey();
              }, 3000);
            }
          }
          container.style.opacity = '1';
        }, 150);
      }
      return currentAnswers;  // Return unchanged to avoid unnecessary re-render
    });
  };

  // Handle previous question
  const handlePrevious = () => {
    if (!survey) return;
    
    if (currentQuestionIndex > 0) {
      const container = document.getElementById('survey-content');
      if (container) {
        container.style.opacity = '0';
        setTimeout(() => {
          // Find previous visible question
          let prevIndex = currentQuestionIndex - 1;
          while (prevIndex >= 0) {
            const prevQuestion = survey.questions[prevIndex];
            if (!prevQuestion.conditionalOn || 
                (answers[prevQuestion.conditionalOn.questionId] !== undefined &&
                 prevQuestion.conditionalOn.values.includes(answers[prevQuestion.conditionalOn.questionId]))) {
              break;
            }
            prevIndex--;
          }
          
          if (prevIndex >= 0) {
            setCurrentQuestionIndex(prevIndex);
          }
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
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mx-auto mb-6"></div>
          <p className="text-2xl text-gray-300">{t('survey.loading')}</p>
        </div>
      </div>
    );
  }

  const currentQuestion = survey.questions[currentQuestionIndex];

  // Determine if we should show the timer
  const shouldShowTimer = survey && survey.questions.length > 1 && currentQuestionIndex > 0;

  return (
    <div 
      className="h-full w-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800"
      onClick={resetInactivityTimer}
      onTouchStart={resetInactivityTimer}
    >
      {/* Timer Display - Fixed position top right */}
      {shouldShowTimer && (
        <div className="absolute top-6 right-6 bg-white/95 rounded-2xl px-6 py-3 shadow-xl z-10">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>
      )}

      <div id="survey-content" className="flex-1 flex flex-col justify-center px-8 py-6 fade-transition" style={{ opacity: 1, transition: 'opacity 150ms' }}>
        {!showThankYou ? (
          <div className="flex flex-col h-full">
            {/* Survey Header - Compact but readable */}
            {currentQuestionIndex === 0 && (
              <div className="text-center mb-6 flex-shrink-0">
                <h2 className="text-5xl font-bold mb-3 text-white leading-tight">{survey.title}</h2>
                {survey.description && (
                  <p className="text-2xl text-gray-300">{survey.description}</p>
                )}
              </div>
            )}

            {/* Progress Indicator - Larger dots */}
            <div className="text-center mb-6 flex-shrink-0">
              <div className="flex justify-center items-center gap-3 mb-3">
                {survey.questions.map((_, index) => (
                  <div
                    key={index}
                    className={`h-3 rounded-full transition-all duration-300 ${
                      index === currentQuestionIndex
                        ? 'w-12 bg-blue-500'
                        : index < currentQuestionIndex
                        ? 'w-3 bg-blue-400'
                        : 'w-3 bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xl text-gray-400 font-medium">
                Soru {currentQuestionIndex + 1} / {survey.questions.length}
              </p>
            </div>

            {/* Question - Main content area, takes remaining space */}
            {currentQuestion && (
              <div className="flex-1 flex flex-col justify-center">
                {/* Question Text - Large and prominent */}
                <p className="text-4xl md:text-5xl text-white text-center mb-10 leading-relaxed font-medium px-4">
                  {currentQuestion.text}
                  {currentQuestion.isRequired && <span className="text-red-400 ml-2">*</span>}
                </p>

                {/* Rating Question - Extra large buttons */}
                {currentQuestion.type === 'rating' && (
                  <div className="flex flex-col items-center">
                    <div className="flex justify-center gap-6 mb-6">
                      {currentQuestion.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleAnswerSelect(currentQuestion.id, parseInt(option), 'rating')}
                          className={`
                            w-24 h-24 md:w-28 md:h-28 rounded-full text-4xl md:text-5xl font-bold
                            transition-all duration-200 transform hover:scale-110 active:scale-95
                            shadow-lg
                            ${answers[currentQuestion.id] === parseInt(option)
                              ? 'bg-blue-500 text-white shadow-blue-500/50 scale-110 ring-4 ring-blue-300'
                              : 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:shadow-xl'
                            }
                          `}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between w-full max-w-2xl px-4 text-xl text-gray-400 font-medium">
                      <span>Çok Kötü</span>
                      <span>Mükemmel</span>
                    </div>
                  </div>
                )}

                {/* Single Choice Question - Full width cards */}
                {currentQuestion.type === 'single-choice' && (
                  <div className={`
                    grid gap-4 w-full max-w-4xl mx-auto px-4
                    ${currentQuestion.options.length <= 4 ? 'grid-cols-1' : 'grid-cols-2'}
                  `}>
                    {currentQuestion.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option, 'single-choice')}
                        className={`
                          py-6 px-8 rounded-2xl text-2xl md:text-3xl font-semibold
                          transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]
                          shadow-lg text-left
                          ${answers[currentQuestion.id] === option
                            ? 'bg-blue-500 text-white shadow-blue-500/40 ring-4 ring-blue-300'
                            : 'bg-gray-700/80 text-gray-100 hover:bg-gray-600 hover:shadow-xl'
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

            {/* Navigation Buttons - Bottom area */}
            <div className="flex justify-center gap-6 mt-8 flex-shrink-0">
              {currentQuestionIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="
                    px-10 py-5 rounded-2xl text-2xl font-bold
                    bg-gray-600 text-gray-200 hover:bg-gray-500
                    transition-all duration-200 transform hover:scale-105 active:scale-95
                    shadow-lg
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
                      px-14 py-5 rounded-2xl text-2xl font-bold
                      transition-all duration-200 transform hover:scale-105 active:scale-95
                      shadow-lg
                      ${isCurrentQuestionAnswered()
                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-500/40'
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
                        px-10 py-5 rounded-2xl text-2xl font-bold
                        bg-gray-600 text-gray-200 hover:bg-gray-500
                        transition-all duration-200 transform hover:scale-105 active:scale-95
                        shadow-lg
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
          /* Thank You Screen - Full screen impact */
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="mb-8">
              <svg className="w-32 h-32 text-green-400 mx-auto animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-6xl md:text-7xl font-bold mb-8 text-white">Teşekkür Ederiz!</h2>
            <p className="text-3xl md:text-4xl text-gray-300 leading-relaxed">
              Görüşleriniz bizim için çok değerli.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
