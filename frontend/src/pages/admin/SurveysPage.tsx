import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyTemplates, useDeleteSurveyTemplate } from '../../hooks/useAdminApi';

export default function SurveysPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { data: surveys, isLoading, error } = useSurveyTemplates();
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('surveys.title')}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {t('surveys.subtitle')}
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium"
          >
            {t('surveys.createNewButton')}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                {t('surveys.infoMessage')}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('surveys.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('surveys.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('surveys.questions')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('surveys.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {surveys && surveys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {t('surveys.noSurveys')}
                  </td>
                </tr>
              ) : (
                surveys?.map((survey) => (
                  <tr key={survey.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{survey.name}</div>
                      {survey.title && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {survey.title}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {getTypeDisplayName(survey.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {survey.questions.length} {survey.questions.length !== 1 ? t('surveys.questions').toLowerCase() : t('surveys.question')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                          className="text-green-600 hover:text-green-900 touch-target"
                        >
                          📊 İstatistikler
                        </button>
                        <button
                          onClick={() => handleEdit(survey.id)}
                          className="text-blue-600 hover:text-blue-900 touch-target"
                        >
                          {t('surveys.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(survey.id, survey.name)}
                          className="text-red-600 hover:text-red-900 touch-target"
                          disabled={deleteSurvey.isPending}
                        >
                          {t('surveys.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {surveys && surveys.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              {t('surveys.noSurveys')}
            </div>
          ) : (
            surveys?.map((survey) => (
              <div key={survey.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{survey.name}</h3>
                    {survey.title && (
                      <p className="text-sm text-gray-500 mt-1">{survey.title}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {getTypeDisplayName(survey.type)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {survey.questions.length} {survey.questions.length !== 1 ? t('surveys.questions').toLowerCase() : t('surveys.question')}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <button
                    onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-target font-medium"
                  >
                    📊 İstatistikleri Gör
                  </button>
                  <button
                    onClick={() => handleEdit(survey.id)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium"
                  >
                    {t('surveys.editTemplate')}
                  </button>
                  <button
                    onClick={() => handleDelete(survey.id, survey.name)}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deleteSurvey.isPending}
                  >
                    {deleteSurvey.isPending ? t('surveys.deleting') || 'Siliniyor...' : t('surveys.delete')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
