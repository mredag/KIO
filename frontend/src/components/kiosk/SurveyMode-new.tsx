import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useKioskStore } from '../../stores/kioskStore';
import { useSurveyTemplate, useSubmitSurveyResponse, useKioskState } from '../../hooks/useKioskApi';

/**
 * Survey Mode Component - Dynamic Question Rendering
 * Performance optimized for Raspberry Pi (Requirements 17.1, 17.2, 17.5)
 */
export default function SurveyMode() {
  const { t } = useTranslation('kiosk');
  const activeSurveyId = useKioskStore((state) => state.activeSurveyId);
  
  const { data: survey, isLoading } = useSurveyTemplate(activeSurveyId);
  const { data: kioskState } = useKioskState();
  const { mutate: submitResponse } = useSubmitSurveyResponse();

  // Dynamic survey state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showThankYou, setShowThankYou] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);

  // Get survey timeout from kiosk state config (default 60 seconds)
  const surveyTimeout = (kioskState?.config?.surveyTimeout || 60) * 1000;

  // Reset survey to initial state
  const resetSurvey = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowThankYou(false);
  }, []);

  // Reset inactivity timer on any interaction (Requirement 7.4)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    const timer = setTimeout(() => {
      // Clear all selected answers and return to first question (Requirements 7.1, 7.2, 7.3)
      resetSurvey();
    }, surveyTimeout);

    setInactivityTimer(timer);
  }, [inactivityTimer, surveyTimeout, resetSurvey]);

  // Reset survey when survey template changes
  useEffect(() => {
    resetSurvey();
  }, [survey?.id, resetSurvey]);

  // Initialize and cleanup inactivity timer
  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
    };
  }, [resetInactivityTimer]);

  // Handle answer selection
  const handleAnswerSelect = (questionId: string, value: any, questionType: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    resetInactivityTimer();
    
    // Auto-advance for single-choice and rating questions (better UX, less time consuming)
    if (questionType === 'single-choice' || questionType === 'rating') {
      // Small delay for visual feedback
      setTimeout(() => {
        handleNext();
      }, 300);
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

  return (
    <div 
      className="h-full w-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-8"
      onClick={resetInactivityTimer}
      onTouchStart={resetInactivityTimer}
    >
      <div id="survey-content" className="max-w-4xl w-full fade-transition" style={{ opacity: 1, transition: 'opacity 150ms' }}>
        {!showThankYou ? (
          <div className="text-center">
            {/* Survey Header */}
            {currentQuestionIndex === 0 && (
              <div className="mb-8">
                <h2 className="text-4xl font-bold mb-4 text-white">{survey.title}</h2>
                {survey.description && (
                  <p className="text-xl text-gray-300 mb-8">{survey.description}</p>
                )}
              </div>
            )}

            {/* Progress Indicator */}
            <div className="mb-8">
              <div className="flex justify-center items-center gap-2 mb-4">
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
              <div className="mb-8">
                <p className="text-2xl text-white mb-8">
                  {currentQuestion.text}
                  {currentQuestion.isRequired && <span className="text-red-400 ml-2">*</span>}
                </p>

                {/* Rating Question */}
                {currentQuestion.type === 'rating' && (
                  <div>
                    <div className="flex justify-center gap-4 mb-4">
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
                    grid gap-4 max-w-2xl mx-auto
                    ${currentQuestion.options.length <= 5 ? 'grid-cols-1' : 'grid-cols-2'}
                  `}>
                    {currentQuestion.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option, 'single-choice')}
                        className={`
                          p-6 rounded-lg text-lg font-medium
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
            <div className="flex justify-center gap-4 mt-8">
              {currentQuestionIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  className="
                    px-8 py-4 rounded-lg text-xl font-bold
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
                      px-12 py-4 rounded-lg text-xl font-bold
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
                        px-8 py-4 rounded-lg text-xl font-bold
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
            <h2 className="text-5xl font-bold mb-8 text-white">Teşekkür Ederiz!</h2>
            <p className="text-2xl text-gray-300">
              Görüşleriniz bizim için çok değerli.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
