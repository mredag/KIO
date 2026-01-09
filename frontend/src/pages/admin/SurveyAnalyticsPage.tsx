import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyAnalytics, useSurveyTemplates, useDeleteSurveyResponses } from '../../hooks/useAdminApi';
import { formatDate } from '../../lib/dateFormatter';
import { KPICard } from '../../components/admin/KPICard';
import { LazyLineChart } from '../../components/admin/LazyCharts';

export default function SurveyAnalyticsPage() {
  const { t } = useTranslation('admin');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filters = {
    ...(startDate && { startDate: new Date(startDate).toISOString() }),
    ...(endDate && { endDate: new Date(endDate).toISOString() }),
  };

  const { data: analytics, isLoading, error } = useSurveyAnalytics(id || '', filters);
  const { data: surveys } = useSurveyTemplates();
  const deleteMutation = useDeleteSurveyResponses();

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleDeleteResponses = async () => {
    if (!id) return;
    
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteConfirm(false);
      alert('Anket yanıtları başarıyla silindi');
    } catch (error) {
      alert('Yanıtlar silinirken hata oluştu');
    }
  };

  // Calculate completion rate
  const completionRate = analytics && analytics.questions.length > 0
    ? (analytics.questions.reduce((sum: number, q: any) => sum + parseFloat(q.responseRate), 0) / analytics.questions.length).toFixed(1)
    : '0.0';

  // Prepare chart data
  const trendChartData = analytics?.timeline?.map((point: any) => ({
    date: formatDate(new Date(point.date)),
    value: point.count,
  })) || [];

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Yükleniyor...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !analytics) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Anket verileri yüklenirken hata oluştu</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button
              onClick={() => navigate('/admin/surveys')}
              className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 mb-2 flex items-center gap-1 font-medium"
            >
              ← {t('analytics.backToSurveys')}
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{analytics.survey.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {analytics.survey.type === 'satisfaction' ? 'Memnuniyet Anketi' : 'Keşif Anketi'}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={id}
              onChange={(e) => navigate(`/admin/surveys/${e.target.value}/analytics`)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-sky-500"
            >
              {surveys?.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}
                </option>
              ))}
            </select>
            {analytics && analytics.totalResponses > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                🗑️ {t('analytics.deleteResponses')}
              </button>
            )}
          </div>
        </div>

        {/* Date Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">{t('analytics.dateFilter')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('analytics.startDate')}
              </label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('analytics.endDate')}
              </label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-sky-500"
              />
            </div>
            {(startDate || endDate) && (
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KPICard
            title={t('analytics.totalResponses')}
            value={analytics.totalResponses}
            icon="📊"
            status="normal"
          />
          <KPICard
            title={t('analytics.questions')}
            value={analytics.questions.length}
            icon="❓"
            status="normal"
          />
          <KPICard
            title={t('analytics.completionRate')}
            value={`${completionRate}%`}
            icon="✓"
            status={parseFloat(completionRate) >= 80 ? 'success' : parseFloat(completionRate) >= 50 ? 'normal' : 'warning'}
          />
        </div>

        {/* Response Trend Chart - Lazy loaded for performance */}
        {analytics.timeline && analytics.timeline.length > 0 && (
          <LazyLineChart
            data={trendChartData}
            title={t('analytics.responseTrend')}
            color="#0284c7"
            emptyMessage={t('analytics.noResponseData')}
          />
        )}

        {/* Question Breakdown */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">{t('analytics.questionBreakdown')}</h3>
          <div className="space-y-6">
            {analytics.questions.map((question: any, index: number) => (
              <div key={question.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-400 font-semibold text-sm">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{question.text}</h3>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 ml-11">
                      <span>
                        {t('analytics.type')}: <span className="font-medium">{question.type === 'rating' ? t('analytics.rating') : t('analytics.singleChoice')}</span>
                      </span>
                      <span>
                        {t('analytics.responses')}: <span className="font-medium">{question.totalAnswers}</span>
                      </span>
                      <span>
                        {t('analytics.rate')}: <span className="font-medium">{question.responseRate}%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rating Statistics */}
                {question.type === 'rating' && question.statistics && (
                  <div className="space-y-4 ml-11">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-sky-50 dark:bg-sky-900 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.average')}</div>
                        <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">{question.statistics.average}</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.min')}</div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{question.statistics.min}</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.max')}</div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{question.statistics.max}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('analytics.ratingDistribution')}</h4>
                      {question.statistics.distribution.map((item: any) => (
                        <div key={item.value} className="flex items-center gap-3">
                          <div className="text-sm text-gray-600 dark:text-gray-400 w-16">{t('analytics.ratingValue', { value: item.value })}</div>
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-sky-400 to-sky-600 h-full rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all"
                              style={{ width: `${item.percentage}%` }}
                            >
                              {item.count} ({item.percentage}%)
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Choice Statistics */}
                {question.type === 'single-choice' && question.statistics && (
                  <div className="space-y-4 ml-11">
                    {question.statistics.mostSelected && (
                      <div className="bg-emerald-50 dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4">
                        <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{t('analytics.mostSelected')}</div>
                        <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                          {question.statistics.mostSelected}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('analytics.optionDistribution')}</h4>
                      {question.statistics.distribution.map((item: any, idx: number) => {
                        const colors = [
                          'from-sky-400 to-sky-600',
                          'from-emerald-400 to-emerald-600',
                          'from-purple-400 to-purple-600',
                          'from-pink-400 to-pink-600',
                          'from-amber-400 to-amber-600',
                        ];
                        const color = colors[idx % colors.length];

                        return (
                          <div key={item.value} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{item.value}</span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {item.count} responses ({item.percentage}%)
                              </span>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                              <div
                                className={`bg-gradient-to-r ${color} h-full rounded-full transition-all`}
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* No Data Message */}
        {analytics.totalResponses === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-xl p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-yellow-600 dark:text-yellow-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-yellow-800 dark:text-yellow-200 text-lg font-medium">No responses yet</div>
            <p className="text-yellow-700 dark:text-yellow-300 mt-2">This survey hasn't received any responses yet.</p>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">{t('analytics.deleteConfirmTitle')}</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {t('analytics.deleteConfirmMessage', { count: analytics.totalResponses })}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {t('analytics.cancel')}
                </button>
                <button
                  onClick={handleDeleteResponses}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? t('analytics.deleting') : t('analytics.yesDelete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
