import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyResponses, useSurveyTemplates, useDeleteSurveyResponses, useDeleteAllSurveyResponses } from '../../hooks/useAdminApi';
import { formatDateTime, formatDate } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';
import { DataTable, Column } from '../../components/admin/DataTable';

interface ResponseRow {
  id: string;
  surveyId: string;
  surveyTitle: string;
  surveyType: string;
  timestamp: Date | string;
  answers: Record<string, any>;
  synced: boolean;
}

export default function SurveyResponsesPage() {
  const { t } = useTranslation('admin');
  const [surveyFilter, setSurveyFilter] = useState<string>('');
  const [syncFilter, setSyncFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'all' | 'survey' | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<ResponseRow | null>(null);

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

  // Kept for future use
  // const formatTimestamp = (date: Date | string) => {
  //   return formatDateTime(date);
  // };

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

  // Prepare data for DataTable
  const tableData: ResponseRow[] = responses?.map((response) => {
    const survey = surveys?.find((s) => s.id === response.surveyId);
    return {
      id: response.id,
      surveyId: response.surveyId,
      surveyTitle: survey ? survey.title : t('responses.unknownSurvey'),
      surveyType: survey ? (survey.type === 'satisfaction' ? 'Memnuniyet' : 'Keşif') : '',
      timestamp: response.timestamp,
      answers: response.answers,
      synced: response.synced,
    };
  }) || [];

  const columns: Column<ResponseRow>[] = [
    {
      id: 'survey',
      header: t('responses.surveyType'),
      accessor: (row) => (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-50">
            {row.surveyTitle}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {row.surveyType}
          </div>
        </div>
      ),
      sortable: false,
    },
    {
      id: 'timestamp',
      header: t('responses.timestamp'),
      accessor: (row) => formatDateTime(row.timestamp),
      sortable: true,
    },
    {
      id: 'answers',
      header: t('responses.answers'),
      accessor: (row) => (
        <div className="max-w-md truncate text-sm text-gray-900 dark:text-gray-50">
          {formatAnswers(row.answers, row.surveyId)}
        </div>
      ),
      sortable: false,
    },
    {
      id: 'synced',
      header: t('responses.syncStatus'),
      accessor: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.synced
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}
        >
          {row.synced ? t('responses.synced') : t('responses.pending')}
        </span>
      ),
      sortable: true,
      width: '120px',
    },
  ];

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

        {/* DataTable */}
        <DataTable
          data={tableData}
          columns={columns}
          searchable={false}
          emptyMessage={t('responses.noResponses')}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedResponse(row)}
        />

        {/* Response Detail Modal */}
        {selectedResponse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50">
                    {selectedResponse.surveyTitle}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatDateTime(selectedResponse.timestamp)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedResponse(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Survey Info */}
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      selectedResponse.surveyType === 'Memnuniyet'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    }`}>
                      {selectedResponse.surveyType}
                    </span>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      selectedResponse.synced
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {selectedResponse.synced ? '✓ Synced' : '⏳ Pending'}
                    </span>
                  </div>

                  {/* Answers */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                      Responses
                    </h4>
                    <div className="space-y-4">
                      {Object.entries(selectedResponse.answers).map(([questionId, answer], index) => {
                        const survey = surveys?.find((s) => s.id === selectedResponse.surveyId);
                        const question = survey?.questions.find((q) => q.id === questionId);
                        
                        return (
                          <div key={questionId} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-2">
                              <span className="flex-shrink-0 w-6 h-6 bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                              </span>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {question?.text || questionId}
                              </p>
                            </div>
                            <div className="ml-9">
                              {question?.type === 'rating' ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                                    {answer}
                                  </span>
                                  <span className="text-yellow-500">★</span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    / 5
                                  </span>
                                </div>
                              ) : (
                                <p className="text-gray-900 dark:text-gray-50 font-medium">
                                  {answer}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setSelectedResponse(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
