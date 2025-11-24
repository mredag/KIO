import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyResponses, useSurveyTemplates, useDeleteSurveyResponses, useDeleteAllSurveyResponses } from '../../hooks/useAdminApi';
import { formatDateTime, formatDate } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';

export default function SurveyResponsesPage() {
  const { t } = useTranslation('admin');
  const [surveyFilter, setSurveyFilter] = useState<string>('');
  const [syncFilter, setSyncFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'all' | 'survey' | null>(null);

  // Build filters object
  const filters: any = {};
  if (surveyFilter) filters.surveyId = surveyFilter;
  if (syncFilter) filters.synced = syncFilter === 'true';
  if (startDate) filters.startDate = new Date(startDate).toISOString();
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filters.endDate = end.toISOString();
  }

  const { data: responses, isLoading, error } = useSurveyResponses(filters);
  const { data: surveys } = useSurveyTemplates();
  const deleteSurveyMutation = useDeleteSurveyResponses();
  const deleteAllMutation = useDeleteAllSurveyResponses();

  const handleExportCSV = () => {
    if (!responses || responses.length === 0) {
      alert(t('responses.noExport'));
      return;
    }

    // Build CSV content
    const headers = [t('responses.timestamp'), t('responses.surveyType'), 'Anket Tipi', t('responses.answers'), t('responses.syncStatus')];
    const rows = responses.map((response) => {
      const survey = surveys?.find((s) => s.id === response.surveyId);
      const surveyTitle = survey ? survey.title : t('responses.unknown');
      const surveyType = survey ? (survey.type === 'satisfaction' ? 'Memnuniyet' : 'Keşif') : '';
      const timestamp = formatDateTime(response.timestamp);
      const answers = formatAnswers(response.answers, response.surveyId);
      const synced = response.synced ? t('responses.yes') : t('responses.no');

      return [
        timestamp,
        surveyTitle,
        surveyType,
        `"${answers.replace(/"/g, '""')}"`, // Escape quotes
        synced,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `survey-responses-${formatDate(new Date()).replace(/\./g, '-')}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setSurveyFilter('');
    setSyncFilter('');
    setStartDate('');
    setEndDate('');
  };

  const handleDeleteClick = (type: 'all' | 'survey') => {
    setDeleteTarget(type);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteTarget === 'all') {
        await deleteAllMutation.mutateAsync();
        alert('Tüm anket yanıtları silindi');
      } else if (deleteTarget === 'survey' && surveyFilter) {
        await deleteSurveyMutation.mutateAsync(surveyFilter);
        alert('Seçili anketin yanıtları silindi');
      }
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (error) {
      alert('Yanıtlar silinirken hata oluştu');
    }
  };

  const formatTimestamp = (date: Date | string) => {
    return formatDateTime(date);
  };

  const formatAnswers = (answers: Record<string, any>, surveyId: string) => {
    const survey = surveys?.find((s) => s.id === surveyId);
    if (!survey) return JSON.stringify(answers);
    
    return Object.entries(answers)
      .map(([questionId, value]) => {
        const question = survey.questions.find((q) => q.id === questionId);
        const questionText = question ? question.text : questionId;
        return `${questionText}: ${value}`;
      })
      .join(' | ');
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">{t('responses.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('responses.loadError')}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">{t('responses.title')}</h2>
          <div className="flex gap-2">
            {surveyFilter && responses && responses.length > 0 && (
              <button
                onClick={() => handleDeleteClick('survey')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors touch-target font-medium"
              >
                🗑️ Bu Anketi Sil
              </button>
            )}
            {responses && responses.length > 0 && (
              <button
                onClick={() => handleDeleteClick('all')}
                className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors touch-target font-medium"
              >
                🗑️ Tümünü Sil
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={!responses || responses.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('responses.exportButton')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('responses.filters')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Survey Type Filter */}
            <div>
              <label htmlFor="survey-filter" className="block text-sm font-medium text-gray-700 mb-1">
                {t('responses.surveyType')}
              </label>
              <select
                id="survey-filter"
                value={surveyFilter}
                onChange={(e) => setSurveyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('responses.allSurveys')}</option>
                {surveys?.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sync Status Filter */}
            <div>
              <label htmlFor="sync-filter" className="block text-sm font-medium text-gray-700 mb-1">
                {t('responses.syncStatus')}
              </label>
              <select
                id="sync-filter"
                value={syncFilter}
                onChange={(e) => setSyncFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('responses.all')}</option>
                <option value="true">{t('responses.synced')}</option>
                <option value="false">{t('responses.notSynced')}</option>
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                {t('responses.startDate')}
              </label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                {t('responses.endDate')}
              </label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {(surveyFilter || syncFilter || startDate || endDate) && (
            <div className="mt-4">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-target"
              >
                {t('responses.clearFilters')}
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          {t('responses.showingCount', { count: responses?.length || 0 })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('responses.surveyType')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('responses.timestamp')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('responses.answers')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('responses.syncStatus')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!responses || responses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      {t('responses.noResponses')}
                    </td>
                  </tr>
                ) : (
                  responses.map((response) => {
                    const survey = surveys?.find((s) => s.id === response.surveyId);
                    return (
                      <tr key={response.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {survey ? survey.title : t('responses.unknownSurvey')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {survey ? (survey.type === 'satisfaction' ? 'Memnuniyet' : 'Keşif') : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTimestamp(response.timestamp)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-md truncate">
                            {formatAnswers(response.answers, response.surveyId)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              response.synced
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {response.synced ? t('responses.synced') : t('responses.pending')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {!responses || responses.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              {t('responses.noResponses')}
            </div>
          ) : (
            responses.map((response) => {
              const survey = surveys?.find((s) => s.id === response.surveyId);
              return (
                <div key={response.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {survey ? survey.title : t('responses.unknownSurvey')}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {survey ? (survey.type === 'satisfaction' ? 'Memnuniyet' : 'Keşif') : ''}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        response.synced
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {response.synced ? t('responses.synced') : t('responses.pending')}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{t('responses.timestampLabel')}</span>{' '}
                    {formatTimestamp(response.timestamp)}
                  </div>

                  <div className="text-sm text-gray-900">
                    <span className="font-medium text-gray-600">{t('responses.answersLabel')}</span>
                    <div className="mt-1 text-sm break-words">
                      {formatAnswers(response.answers, response.surveyId)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {deleteTarget === 'all' ? 'Tüm Yanıtları Sil?' : 'Anket Yanıtlarını Sil?'}
              </h3>
              <p className="text-gray-700 mb-6">
                {deleteTarget === 'all' ? (
                  <>
                    <strong>Tüm anketlerin</strong> toplam <strong>{responses?.length || 0}</strong> yanıtını silmek istediğinizden emin misiniz?
                  </>
                ) : (
                  <>
                    Bu anketin <strong>{responses?.length || 0}</strong> yanıtını silmek istediğinizden emin misiniz?
                  </>
                )}
                <br />
                <span className="text-red-600 font-medium">Bu işlem geri alınamaz.</span>
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTarget(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteSurveyMutation.isPending || deleteAllMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {(deleteSurveyMutation.isPending || deleteAllMutation.isPending) ? 'Siliniyor...' : 'Evet, Sil'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
