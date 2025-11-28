import { useState, useEffect, DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyTemplates, useUpdateSurveyTemplate, useCreateSurveyTemplate } from '../../hooks/useAdminApi';
import { Question } from '../../types';

interface FormData {
  name: string;
  title: string;
  description: string;
  questions: Question[];
}

type QuestionType = 'rating' | 'single-choice';
type ViewMode = 'edit' | 'preview';

export default function SurveyEditorPage() {
  const { t } = useTranslation('admin');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: surveys, isLoading: surveysLoading } = useSurveyTemplates();
  const updateSurvey = useUpdateSurveyTemplate();
  const createSurvey = useCreateSurveyTemplate();

  const isNewSurvey = id === 'new';

  const [formData, setFormData] = useState<FormData>({
    name: '',
    title: '',
    description: '',
    questions: [],
  });

  const [surveyType, setSurveyType] = useState<'satisfaction' | 'discovery'>('satisfaction');
  const [submitError, setSubmitError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<number | null>(null);

  // Load survey data for editing
  useEffect(() => {
    if (surveys && id && !isNewSurvey) {
      const survey = surveys.find((s) => s.id === id);
      if (survey) {
        setFormData({
          name: survey.name,
          title: survey.title,
          description: survey.description || '',
          questions: survey.questions,
        });
        setSurveyType(survey.type);
      }
    }
  }, [surveys, id, isNewSurvey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    // Validation
    if (!formData.name.trim()) {
      setSubmitError('Survey name is required');
      return;
    }

    if (!formData.title.trim()) {
      setSubmitError(t('surveyEditor.errorTitle'));
      return;
    }

    if (formData.questions.length === 0) {
      setSubmitError(t('surveyEditor.errorQuestions'));
      return;
    }

    try {
      if (isNewSurvey) {
        const newSurvey = await createSurvey.mutateAsync({
          name: formData.name,
          type: surveyType,
          title: formData.title,
          description: formData.description || '',
          questions: formData.questions,
        } as any);

        setSuccessMessage('Survey template created successfully!');
        
        // Navigate to edit page after creation
        setTimeout(() => {
          navigate(`/admin/surveys/${newSurvey.id}/edit`);
        }, 1500);
      } else {
        await updateSurvey.mutateAsync({
          id: id!,
          data: {
            name: formData.name,
            title: formData.title,
            description: formData.description || undefined,
            questions: formData.questions,
          } as any,
        });

        setSuccessMessage('Survey template updated successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      }
    } catch (error: any) {
      console.error('Failed to save survey:', error);
      setSubmitError(
        error.response?.data?.error || `Failed to ${isNewSurvey ? 'create' : 'update'} survey template. Please try again.`
      );
    }
  };

  const handleCancel = () => {
    navigate('/admin/surveys');
  };

  // Kept for future use when adding questions dynamically
  // const handleAddQuestion = () => {
  //   const newQuestion: Question = {
  //     id: `q${Date.now()}`,
  //     text: '',
  //     type: 'single-choice',
  //     options: [''],
  //     isRequired: false,
  //   };
  //   setFormData({ ...formData, questions: [...formData.questions, newQuestion] });
  // };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: any) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value,
    };
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...formData.questions];
    const newOptions = [...newQuestions[questionIndex].options];
    newOptions[optionIndex] = value;
    newQuestions[questionIndex] = {
      ...newQuestions[questionIndex],
      options: newOptions,
    };
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleAddOption = (questionIndex: number) => {
    const newQuestions = [...formData.questions];
    newQuestions[questionIndex] = {
      ...newQuestions[questionIndex],
      options: [...newQuestions[questionIndex].options, ''],
    };
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...formData.questions];
    const newOptions = newQuestions[questionIndex].options.filter((_, i) => i !== optionIndex);
    newQuestions[questionIndex] = {
      ...newQuestions[questionIndex],
      options: newOptions,
    };
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleMoveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQuestions = [...formData.questions];
    [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    setFormData({ ...formData, questions: newQuestions });
  };

  const handleMoveQuestionDown = (index: number) => {
    if (index === formData.questions.length - 1) return;
    const newQuestions = [...formData.questions];
    [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
    setFormData({ ...formData, questions: newQuestions });
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedQuestionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedQuestionIndex === null || draggedQuestionIndex === dropIndex) return;

    const newQuestions = [...formData.questions];
    const [draggedQuestion] = newQuestions.splice(draggedQuestionIndex, 1);
    newQuestions.splice(dropIndex, 0, draggedQuestion);

    setFormData({ ...formData, questions: newQuestions });
    setDraggedQuestionIndex(null);
    
    // Update selected index if needed
    if (selectedQuestionIndex === draggedQuestionIndex) {
      setSelectedQuestionIndex(dropIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedQuestionIndex(null);
  };

  // Add question from palette
  const addQuestionFromPalette = (type: QuestionType) => {
    const newQuestion: Question = {
      id: `q${Date.now()}`,
      text: '',
      type: type,
      options: type === 'single-choice' ? [''] : [],
      isRequired: false,
    };
    const newQuestions = [...formData.questions, newQuestion];
    setFormData({ ...formData, questions: newQuestions });
    setSelectedQuestionIndex(newQuestions.length - 1);
  };

  // Show loading only for editing existing surveys
  if (!isNewSurvey && surveysLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  // Check if survey exists when editing
  if (!isNewSurvey && surveys) {
    const survey = surveys.find((s) => s.id === id);
    if (!survey) {
      return (
        <AdminLayout>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{t('surveyEditor.notFound')}</p>
          </div>
        </AdminLayout>
      );
    }
  }

  const selectedQuestion = selectedQuestionIndex !== null ? formData.questions[selectedQuestionIndex] : null;

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
                {isNewSurvey ? t('surveyEditor.titleCreate') : t('surveyEditor.titleEdit')}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {formData.name || 'Untitled Survey'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'edit'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-50 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'preview'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-50 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  👁️ Preview
                </button>
              </div>
              
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={updateSurvey.isPending || createSurvey.isPending}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium disabled:opacity-50"
              >
                {(updateSurvey.isPending || createSurvey.isPending) 
                  ? 'Saving...'
                  : isNewSurvey 
                    ? 'Create Survey'
                    : 'Save Changes'
                }
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="mx-6 mt-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}
        {submitError && (
          <div className="mx-6 mt-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{submitError}</p>
          </div>
        )}

        {/* Three-Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Question Type Palette */}
          {viewMode === 'edit' && (
            <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                Question Types
              </h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => addQuestionFromPalette('rating')}
                  className="w-full text-left p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-sky-500 dark:hover:border-sky-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">⭐</span>
                    <span className="font-medium text-gray-900 dark:text-gray-50">Rating</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Numeric rating scale (1-5 or 1-10)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => addQuestionFromPalette('single-choice')}
                  className="w-full text-left p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-sky-500 dark:hover:border-sky-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">◉</span>
                    <span className="font-medium text-gray-900 dark:text-gray-50">Single Choice</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select one option from a list
                  </p>
                </button>
              </div>

              {/* Survey Settings */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                  Survey Settings
                </h3>
                <div className="space-y-3">
                  {isNewSurvey && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Survey Type
                      </label>
                      <select
                        value={surveyType}
                        onChange={(e) => setSurveyType(e.target.value as 'satisfaction' | 'discovery')}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                      >
                        <option value="satisfaction">Satisfaction</option>
                        <option value="discovery">Discovery</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                      placeholder="e.g., Post-Service Survey"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                      placeholder="Title shown to users"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Center Panel: Survey Canvas */}
          <div className="flex-1 bg-white dark:bg-gray-800 overflow-y-auto p-6">
            {viewMode === 'preview' ? (
              /* Preview Mode */
              <div className="max-w-2xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">
                    {formData.title || 'Untitled Survey'}
                  </h2>
                  {formData.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{formData.description}</p>
                  )}
                  
                  {formData.questions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      No questions added yet
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {formData.questions.map((question, index) => (
                        <div key={question.id} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="flex-shrink-0 w-8 h-8 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center font-semibold text-sm">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-lg font-medium text-gray-900 dark:text-gray-50">
                                {question.text || 'Question text'}
                                {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                              </p>
                            </div>
                          </div>
                          
                          {question.type === 'rating' && (
                            <div className="flex gap-2 ml-11">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                  key={rating}
                                  type="button"
                                  className="w-12 h-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-sky-500 dark:hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900 transition-colors font-semibold"
                                >
                                  {rating}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {question.type === 'single-choice' && (
                            <div className="space-y-2 ml-11">
                              {question.options.map((option, optIndex) => (
                                <label key={optIndex} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                  <input type="radio" name={`q${index}`} className="w-4 h-4" />
                                  <span className="text-gray-900 dark:text-gray-50">{option || `Option ${optIndex + 1}`}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <div className="max-w-3xl mx-auto">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Questions ({formData.questions.length})
                  </h3>
                  {formData.questions.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Drag question types from the left panel to get started
                    </p>
                  )}
                </div>

                {formData.questions.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">No questions yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Click a question type on the left to add your first question</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.questions.map((question, index) => (
                      <div
                        key={question.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedQuestionIndex(index)}
                        className={`
                          bg-white dark:bg-gray-900 border-2 rounded-lg p-4 cursor-move transition-all
                          ${selectedQuestionIndex === index 
                            ? 'border-sky-500 dark:border-sky-400 shadow-md' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }
                          ${draggedQuestionIndex === index ? 'opacity-50' : ''}
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Q{index + 1}</span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                question.type === 'rating' 
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              }`}>
                                {question.type === 'rating' ? '⭐ Rating' : '◉ Choice'}
                              </span>
                              {question.isRequired && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-gray-900 dark:text-gray-50 font-medium">
                              {question.text || <span className="text-gray-400 italic">Click to edit question</span>}
                            </p>
                            {question.type === 'single-choice' && question.options.length > 0 && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {question.options.filter(o => o).length} options
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveQuestion(index);
                            }}
                            className="flex-shrink-0 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Question Settings */}
          {viewMode === 'edit' && selectedQuestion && selectedQuestionIndex !== null && (
            <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Question Settings
                </h3>
                <button
                  onClick={() => setSelectedQuestionIndex(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Question Text
                  </label>
                  <textarea
                    value={selectedQuestion.text}
                    onChange={(e) => handleQuestionChange(selectedQuestionIndex, 'text', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-sky-500"
                    placeholder="Enter your question..."
                  />
                </div>

                {/* Question Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Question Type
                  </label>
                  <select
                    value={selectedQuestion.type}
                    onChange={(e) => handleQuestionChange(selectedQuestionIndex, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                  >
                    <option value="rating">⭐ Rating</option>
                    <option value="single-choice">◉ Single Choice</option>
                  </select>
                </div>

                {/* Options for Single Choice */}
                {selectedQuestion.type === 'single-choice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Answer Options
                    </label>
                    <div className="space-y-2">
                      {selectedQuestion.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(selectedQuestionIndex, optIndex, e.target.value)}
                            placeholder={`Option ${optIndex + 1}`}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50"
                          />
                          {selectedQuestion.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(selectedQuestionIndex, optIndex)}
                              className="px-2 text-red-600 hover:text-red-800 dark:text-red-400"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddOption(selectedQuestionIndex)}
                      className="mt-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                {/* Required Toggle */}
                <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <label htmlFor="required" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Required Question
                  </label>
                  <input
                    type="checkbox"
                    id="required"
                    checked={selectedQuestion.isRequired}
                    onChange={(e) => handleQuestionChange(selectedQuestionIndex, 'isRequired', e.target.checked)}
                    className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                  />
                </div>

                {/* Track Important */}
                <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="track" className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
                      Track Important
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Show on dashboard
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="track"
                    checked={selectedQuestion.trackImportant || false}
                    onChange={(e) => handleQuestionChange(selectedQuestionIndex, 'trackImportant', e.target.checked)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                </div>

                {/* Move Buttons */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reorder
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleMoveQuestionUp(selectedQuestionIndex)}
                      disabled={selectedQuestionIndex === 0}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      ↑ Move Up
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveQuestionDown(selectedQuestionIndex)}
                      disabled={selectedQuestionIndex === formData.questions.length - 1}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      ↓ Move Down
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AdminLayout>
  );
}
