import AdminLayout from '../../layouts/AdminLayout';
import { useDashboard, useAlerts } from '../../hooks/useAdminApi';
import { formatDateTime, formatRelativeTime } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '../../components/admin/KPICard';
import { LazyLineChart, LazyBarChart } from '../../components/admin/LazyCharts';
import { QuickActions } from '../../components/admin/QuickActions';
import { ActivityFeed } from '../../components/admin/ActivityFeed';
import { SkeletonCard } from '../../components/ui/Skeleton';

export default function DashboardPage() {
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const { data: status, isLoading, error } = useDashboard(true); // Enable auto-refresh on dashboard
  const { data: alerts } = useAlerts(true); // Enable auto-refresh on dashboard

  if (isLoading) {
    return (
      <AdminLayout>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
            {t('admin:dashboard.title')}
          </h1>
          {/* Loading skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} height="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SkeletonCard height="h-80" />
            <SkeletonCard height="h-80" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
            {t('admin:dashboard.title')}
          </h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{t('common:messages.error')}</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!status) {
    return null;
  }

  // Format timestamp for display using Turkish format (currently unused but kept for future use)
  // const formatTimestamp = (date: Date | string | null) => {
  //   if (!date) return t('common:time.never', 'Hiç');
  //   return formatDateTime(date);
  // };

  // Prepare KPI data
  const kpiData = [
    {
      title: t('admin:dashboard.todaySurveys'),
      value: status.todaySurveyCount || 0,
      icon: '📋',
      href: '/admin/survey-responses',
      status: 'normal' as const,
    },
    {
      title: t('admin:dashboard.totalSurveys'),
      value: status.totalSurveyCount || 0,
      icon: '📊',
      href: '/admin/survey-responses',
      status: 'normal' as const,
    },
    {
      title: 'Active Coupons',
      value: status.activeCoupons || 0,
      icon: '🎟️',
      href: '/admin/coupons/redemptions',
      status: 'normal' as const,
    },
    {
      title: t('admin:dashboard.kioskStatus'),
      value: status.kioskOnline ? t('admin:dashboard.online') : t('admin:dashboard.offline'),
      icon: '🖥️',
      href: '/admin/kiosk-control',
      status: status.kioskOnline ? ('success' as const) : ('critical' as const),
    },
  ];

  // Prepare chart data (mock data for now - will be replaced with real data in subtask 10.2)
  const surveyTrendData = status.surveyTrend || [];
  const couponTrendData = status.couponTrend || [];

  // Prepare quick actions
  const quickActions = [
    {
      id: 'issue-coupon',
      label: 'Issue Coupon',
      icon: '🎟️',
      action: 'navigate' as const,
      target: '/admin/coupons/issue',
      variant: 'primary' as const,
    },
    {
      id: 'create-survey',
      label: 'Create Survey',
      icon: '📝',
      action: 'navigate' as const,
      target: '/admin/surveys/new',
      variant: 'secondary' as const,
    },
    {
      id: 'change-kiosk-mode',
      label: 'Change Kiosk Mode',
      icon: '🖥️',
      action: 'navigate' as const,
      target: '/admin/kiosk-control',
      variant: 'success' as const,
    },
    {
      id: 'create-backup',
      label: 'Create Backup',
      icon: '💾',
      action: 'navigate' as const,
      target: '/admin/backup',
      variant: 'warning' as const,
    },
  ];

  // Prepare activity feed items
  const activityItems = (status.recentActivity || []).map((activity: any) => ({
    id: activity.id,
    type: activity.type || 'system',
    message: activity.message,
    timestamp: new Date(activity.timestamp),
    href: activity.href,
  }));

  return (
    <AdminLayout>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
          {t('admin:dashboard.title')}
        </h1>

        {/* Alerts Section */}
        {alerts && alerts.length > 0 && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-l-4 border-red-500 dark:border-red-400 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    ⚠️ Dikkat Gerektiren Durumlar ({alerts.length})
                  </h3>
                  <div className="mt-2 space-y-2">
                    {alerts.slice(0, 5).map((alert: any) => (
                      <div
                        key={alert.id}
                        className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/admin/surveys/${alert.surveyId}/analytics`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                alert.severity === 'critical' 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' 
                                  : alert.severity === 'warning'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                              }`}>
                                {alert.severity === 'critical' ? '🔴 Kritik' : alert.severity === 'warning' ? '🟠 Uyarı' : '📌 Takip'}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatRelativeTime(alert.timestamp)}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDateTime(alert.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-50 mt-1">
                              {alert.surveyTitle}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              "{alert.questionText}" - {alert.type === 'low_rating' ? `Puan: ${alert.answer}/5` : `Yanıt: ${alert.answer}`}
                            </p>
                          </div>
                          <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                  {alerts.length > 5 && (
                    <button
                      onClick={() => navigate('/admin/survey-responses')}
                      className="mt-3 text-sm text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 font-medium"
                    >
                      Tümünü Gör ({alerts.length}) →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {kpiData.map((kpi, index) => (
            <KPICard
              key={index}
              title={kpi.title}
              value={kpi.value}
              icon={kpi.icon}
              href={kpi.href}
              status={kpi.status}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Charts Section - Lazy loaded for performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <LazyLineChart
            data={surveyTrendData}
            title="Survey Submissions (Last 7 Days)"
            color="#0284c7"
            isLoading={isLoading}
            emptyMessage="No survey data available"
          />
          <LazyBarChart
            data={couponTrendData}
            title="Coupon Redemptions (This Week)"
            color="#059669"
            isLoading={isLoading}
            emptyMessage="No coupon data available"
          />
        </div>

        {/* Quick Actions and Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <QuickActions actions={quickActions} />
          <ActivityFeed items={activityItems} maxItems={10} isLoading={isLoading} />
        </div>

        {/* Auto-refresh indicator */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Auto-refreshing every 10 seconds
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
