import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyTemplates, useDeleteSurveyTemplate, useSurveyResponses } from '../../hooks/useAdminApi';

type TabType = 'all' | 'satisfaction' | 'discovery';

export default function SurveysPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { data: surveys, isLoading, error } = useSurveyTemplates();
  const { data: allResponses } = useSurveyResponses({});
  const deleteSurvey = useDeleteSurveyTemplate();

  const handleEdit = (id: string) => {
    navigate(`/admin/surveys/${id}`);
  };

  const handleCreateNew = () => {
    navigate('/admin/surveys/new');
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(t('surveys.confirmDelete', { name }) || `"${name}" anketini silmek istediğinizden emin misiniz?`)) {
      try {
        await deleteSurvey.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.error || t('surveys.deleteError') || 'Anket silinemedi');
      }
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">{t('surveys.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('surveys.loadError')}</p>
        </div>
      </AdminLayout>
    );
  }

  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case 'satisfaction':
        return t('surveys.satisfaction');
      case 'discovery':
        return t('surveys.discovery');
      default:
        return type;
    }
  };

  // Get response count for a survey
  const getResponseCount = (surveyId: string) => {
    if (!allResponses) return 0;
    return allResponses.filter((r) => r.surveyId === surveyId).length;
  };

  // Get average rating for a survey (if it has rating questions)
  const getAverageRating = (surveyId: string) => {
    if (!allResponses || !surveys) return null;
    const survey = surveys.find((s) => s.id === surveyId);
    if (!survey) return null;

    const ratingQuestions = survey.questions.filter((q) => q.type === 'rating');
    if (ratingQuestions.length === 0) return null;

    const responses = allResponses.filter((r) => r.surveyId === surveyId);
    if (responses.length === 0) return null;

    let totalRating = 0;
    let ratingCount = 0;

    responses.forEach((response) => {
      ratingQuestions.forEach((question) => {
        const rating = response.answers[question.id];
        if (typeof rating === 'number') {
          totalRating += rating;
          ratingCount++;
        }
      });
    });

    return ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null;
  };

  // Filter surveys by tab
  const filteredSurveys = surveys?.filter((survey) => {
    if (activeTab === 'all') return true;
    return survey.type === activeTab;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{t('surveys.title')}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('surveys.subtitle')}
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors touch-target font-medium"
          >
            + {t('surveys.createNewButton')}
          </button>
        </div>

        {/* Tabs for filtering by type */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('all')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'all'
                    ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {t('surveys.allSurveys')} ({surveys?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('satisfaction')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'satisfaction'
                    ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {t('surveys.satisfaction')} ({surveys?.filter((s) => s.type === 'satisfaction').length || 0})
            </button>
            <button
              onClick={() => setActiveTab('discovery')}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'discovery'
                    ? 'border-sky-600 text-sky-600 dark:border-sky-400 dark:text-sky-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {t('surveys.discovery')} ({surveys?.filter((s) => s.type === 'discovery').length || 0})
            </button>
          </nav>
        </div>

        {/* Survey Cards Grid */}
        {!filteredSurveys || filteredSurveys.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{t('surveys.noSurveys')}</p>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium"
            >
              Create Your First Survey
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSurveys.map((survey) => {
              const responseCount = getResponseCount(survey.id);
              const avgRating = getAverageRating(survey.id);

              return (
                <div
                  key={survey.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
                        {survey.name}
                      </h3>
                      {survey.title && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {survey.title}
                        </p>
                      )}
                    </div>
                    <span
                      className={`
                        px-2.5 py-1 text-xs font-medium rounded-full
                        ${
                          survey.type === 'satisfaction'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }
                      `}
                    >
                      {getTypeDisplayName(survey.type)}
                    </span>
                  </div>

                  {/* Quick Analytics Preview */}
                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Responses</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                        {responseCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Questions</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                        {survey.questions.length}
                      </p>
                    </div>
                    {avgRating && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Rating</p>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                            {avgRating}
                          </p>
                          <span className="text-yellow-500">★</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                      className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                    >
                      📊 Analytics
                    </button>
                    <button
                      onClick={() => handleEdit(survey.id)}
                      className="flex-1 px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id, survey.name)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      disabled={deleteSurvey.isPending}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
