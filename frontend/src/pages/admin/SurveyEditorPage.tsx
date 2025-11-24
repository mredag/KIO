import { useState, useEffect } from 'react';
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

  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `q${Date.now()}`,
      text: '',
      type: 'single-choice',
      options: [''],
      isRequired: false,
    };
    setFormData({ ...formData, questions: [...formData.questions, newQuestion] });
  };

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

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isNewSurvey ? t('surveyEditor.titleCreate') : t('surveyEditor.titleEdit')}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {isNewSurvey 
              ? t('surveyEditor.subtitleCreate')
              : t('surveyEditor.subtitleEdit', { type: surveyType === 'satisfaction' ? 'Memnuniyet' : 'Keşif' })
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{submitError}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">{t('surveyEditor.basicInformation')}</h3>

            {/* Survey Type (only for new surveys) */}
            {isNewSurvey && (
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('surveyEditor.surveyType')} <span className="text-red-600">*</span>
                </label>
                <select
                  id="type"
                  value={surveyType}
                  onChange={(e) => setSurveyType(e.target.value as 'satisfaction' | 'discovery')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="satisfaction">{t('surveyEditor.satisfactionSurvey')}</option>
                  <option value="discovery">{t('surveyEditor.discoverySurvey')}</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {t('surveyEditor.surveyTypeHelp')}
                </p>
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                {t('surveyEditor.templateName')} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
                required
              />
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                {t('surveyEditor.displayTitle')} <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('surveyEditor.displayTitleHelp')}
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                {t('surveyEditor.description')}
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {t('surveyEditor.questionsSection')} {formData.questions.length > 0 && `(${formData.questions.length})`}
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-target font-medium text-sm"
              >
                + {t('surveyEditor.addQuestion')}
              </button>
            </div>

            {formData.questions.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">{t('surveyEditor.noQuestionsAdded')}</p>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium"
                >
                  {t('surveyEditor.addFirstQuestion')}
                </button>
              </div>
            )}

            {formData.questions.map((question, qIndex) => (
              <div key={question.id} className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-md font-medium text-gray-900">
                    {t('surveyEditor.questionNumber', { number: qIndex + 1 })}
                    {question.isRequired && (
                      <span className="ml-2 text-xs text-red-600">({t('surveyEditor.required')})</span>
                    )}
                  </h4>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveQuestionUp(qIndex)}
                      disabled={qIndex === 0}
                      className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t('surveyEditor.moveUp')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveQuestionDown(qIndex)}
                      disabled={qIndex === formData.questions.length - 1}
                      className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t('surveyEditor.moveDown')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      className="p-1 text-red-600 hover:text-red-800"
                      title={t('surveyEditor.removeQuestion')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Text
                  </label>
                  <input
                    type="text"
                    value={question.text}
                    onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Question Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('surveyEditor.questionType')}
                  </label>
                  <select
                    value={question.type}
                    onChange={(e) => handleQuestionChange(qIndex, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="rating">{t('surveyEditor.typeRating')}</option>
                    <option value="single-choice">{t('surveyEditor.singleChoice')}</option>
                  </select>
                </div>

                {/* Required Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`required-${qIndex}`}
                    checked={question.isRequired}
                    onChange={(e) => handleQuestionChange(qIndex, 'isRequired', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`required-${qIndex}`} className="ml-2 text-sm text-gray-700">
                    Zorunlu soru
                  </label>
                </div>

                {/* Track Important */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`track-${qIndex}`}
                    checked={question.trackImportant || false}
                    onChange={(e) => handleQuestionChange(qIndex, 'trackImportant', e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`track-${qIndex}`} className="ml-2 text-sm text-gray-700">
                    📌 Önemli yanıtları takip et (Ana sayfada göster)
                  </label>
                </div>

                {/* Options (for single-choice questions) */}
                {question.type === 'single-choice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('surveyEditor.answerOptions')}
                    </label>
                    <div className="space-y-2">
                      {question.options.map((option, oIndex) => (
                        <div key={oIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                            placeholder={`Option ${oIndex + 1}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {question.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(qIndex, oIndex)}
                              className="px-3 py-2 text-red-600 hover:text-red-800 touch-target"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIndex)}
                      className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + {t('surveyEditor.addOption')}
                    </button>
                  </div>
                )}

                {/* Conditional Logic Info */}
                {question.conditionalOn && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">{t('surveyEditor.conditional')}:</span> {t('surveyEditor.conditionalInfo')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={updateSurvey.isPending || createSurvey.isPending}
              className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(updateSurvey.isPending || createSurvey.isPending) 
                ? t('surveyEditor.saving')
                : isNewSurvey 
                  ? t('surveyEditor.createSurvey')
                  : t('surveyEditor.saveChanges')
              }
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={updateSurvey.isPending || createSurvey.isPending}
              className="flex-1 md:flex-none px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('surveyEditor.cancel')}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
