import AdminLayout from '../../layouts/AdminLayout';
import { useDashboard, useAlerts } from '../../hooks/useAdminApi';
import { formatDateTime, formatRelativeTime } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const { data: status, isLoading, error } = useDashboard(true); // Enable auto-refresh on dashboard
  const { data: alerts } = useAlerts(true); // Enable auto-refresh on dashboard

  if (isLoading) {
    return (
      <AdminLayout>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin:dashboard.title')}</h1>
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">{t('common:messages.loading')}</div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin:dashboard.title')}</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{t('common:messages.error')}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!status) {
    return null;
  }

  // Format timestamp for display using Turkish format
  const formatTimestamp = (date: Date | string | null) => {
    if (!date) return t('common:time.never', 'Hiç');
    return formatDateTime(date);
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin:dashboard.title')}</h1>

        {/* Alerts Section */}
        {alerts && alerts.length > 0 && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800">
                    ⚠️ Dikkat Gerektiren Durumlar ({alerts.length})
                  </h3>
                  <div className="mt-2 space-y-2">
                    {alerts.slice(0, 5).map((alert: any) => (
                      <div
                        key={alert.id}
                        className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/admin/surveys/${alert.surveyId}/analytics`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                alert.severity === 'critical' 
                                  ? 'bg-red-100 text-red-800' 
                                  : alert.severity === 'warning'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {alert.severity === 'critical' ? '🔴 Kritik' : alert.severity === 'warning' ? '🟠 Uyarı' : '📌 Takip'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatRelativeTime(alert.timestamp)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatDateTime(alert.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              {alert.surveyTitle}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              "{alert.questionText}" - {alert.type === 'low_rating' ? `Puan: ${alert.answer}/5` : `Yanıt: ${alert.answer}`}
                            </p>
                          </div>
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                  {alerts.length > 5 && (
                    <button
                      onClick={() => navigate('/admin/survey-responses')}
                      className="mt-3 text-sm text-red-700 hover:text-red-800 font-medium"
                    >
                      Tümünü Gör ({alerts.length}) →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Survey Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">
              {t('admin:dashboard.todaySurveys')}
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {status.todaySurveyCount}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">
              {t('admin:dashboard.totalSurveys')}
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {status.totalSurveyCount}
            </p>
          </div>
        </div>

        {/* Kiosk Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('admin:dashboard.kioskStatus')}
          </h2>

          <div className="space-y-4">
            {/* Current Mode */}
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">
                {t('admin:dashboard.kioskMode')}
              </span>
              <span className="text-sm text-gray-900 font-medium">
                {status.currentKioskMode === 'digital-menu' && t('admin:kioskControl.modeDigitalMenu')}
                {status.currentKioskMode === 'survey' && t('admin:kioskControl.modeSurvey')}
                {status.currentKioskMode === 'google-qr' && t('admin:kioskControl.modeGoogleQr')}
              </span>
            </div>

            {/* Active Content */}
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">
                {t('admin:kioskControl.content')}
              </span>
              <span className="text-sm text-gray-900">
                {status.currentContent || t('common:messages.noData')}
              </span>
            </div>

            {/* Kiosk Online Status */}
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">
                {t('admin:dashboard.kioskStatus')}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    status.kioskOnline
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {status.kioskOnline ? t('admin:dashboard.online') : t('admin:dashboard.offline')}
                </span>
              </div>
            </div>

            {/* Last Seen */}
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">
                {t('admin:dashboard.lastSeen')}
              </span>
              <div className="text-right">
                <div className="text-sm text-gray-900">
                  {formatRelativeTime(status.kioskLastSeen)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatTimestamp(status.kioskLastSeen)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google Sheets Sync Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('admin:dashboard.sheetsSync')}
          </h2>

          <div className="space-y-4">
            {/* Last Sync */}
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">
                {t('admin:dashboard.lastSync')}
              </span>
              <span className="text-sm text-gray-900">
                {formatTimestamp(status.sheetsLastSync)}
              </span>
            </div>

            {/* Pending Sync Count */}
            <div className="flex justify-between items-center py-3">
              <span className="text-sm font-medium text-gray-600">
                {t('admin:dashboard.pendingSync')}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  status.pendingSyncCount === 0
                    ? 'bg-green-100 text-green-800'
                    : status.pendingSyncCount < 10
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {status.pendingSyncCount}
              </span>
            </div>
          </div>
        </div>

        {/* Auto-refresh indicator */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            {t('common:messages.loading')}
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
