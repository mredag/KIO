import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useDashboard,
  useSurveyTemplates,
  useUpdateKioskMode,
} from '../../hooks/useAdminApi';
import { KioskMode } from '../../types';
import { useToast } from '../../contexts/ToastContext';

export default function KioskControlPage() {
  const { t } = useTranslation('admin');
  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useDashboard();
  const { data: surveys, isLoading: surveysLoading } = useSurveyTemplates();
  const updateKioskMode = useUpdateKioskMode();
  const { addToast } = useToast();

  const [selectedMode, setSelectedMode] = useState<KioskMode>('digital-menu');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize form with current kiosk state
  useEffect(() => {
    if (dashboard) {
      setSelectedMode(dashboard.currentKioskMode as KioskMode);
      if (dashboard.activeSurveyId) {
        setSelectedSurveyId(dashboard.activeSurveyId);
      }
    }
  }, [dashboard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate survey mode requires survey selection
    if (selectedMode === 'survey' && !selectedSurveyId) {
      addToast({
        type: 'error',
        title: t('kioskControl.errorSelectSurvey'),
        duration: 3000,
      });
      return;
    }

    try {
      await updateKioskMode.mutateAsync({
        mode: selectedMode,
        activeSurveyId: selectedMode === 'survey' ? selectedSurveyId : undefined,
      });

      addToast({
        type: 'success',
        title: t('kioskControl.successMessage'),
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Failed to update kiosk mode:', error);
      addToast({
        type: 'error',
        title: error.response?.data?.error || t('kioskControl.errorUpdate'),
        duration: 5000,
      });
    }
  };

  const handleModeChange = (mode: KioskMode) => {
    setSelectedMode(mode);
    // Clear survey selection if not in survey mode
    if (mode !== 'survey') {
      setSelectedSurveyId('');
    }
  };

  const handleRefreshKiosk = async () => {
    setIsRefreshing(true);
    try {
      await refetchDashboard();
      addToast({
        type: 'success',
        title: 'Kiosk status refreshed',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to refresh kiosk:', error);
      addToast({
        type: 'error',
        title: 'Failed to refresh kiosk status',
        duration: 3000,
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const getUptime = () => {
    if (!dashboard?.kioskLastSeen) return 'Unknown';
    const lastSeen = new Date(dashboard.kioskLastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  };

  if (dashboardLoading || surveysLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  const getModeDisplayName = (mode: string) => {
    switch (mode) {
      case 'digital-menu':
        return t('kioskControl.modeDigitalMenu');
      case 'survey':
        return t('kioskControl.modeSurvey');
      case 'google-qr':
        return t('kioskControl.modeGoogleQr');
      default:
        return mode;
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'digital-menu':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'survey':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'google-qr':
        return (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getModeDescription = (mode: string) => {
    switch (mode) {
      case 'digital-menu':
        return t('kioskControl.digitalMenuDesc');
      case 'survey':
        return t('kioskControl.surveyDesc');
      case 'google-qr':
        return t('kioskControl.googleQrDesc');
      default:
        return '';
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('kioskControl.title')}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('kioskControl.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Status and Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Kiosk Status Card */}
            {dashboard && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('kioskControl.currentStatus')}
                  </h3>
                  <button
                    onClick={handleRefreshKiosk}
                    disabled={isRefreshing}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh kiosk status"
                  >
                    <svg
                      className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          dashboard.kioskOnline
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-red-500'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          dashboard.kioskOnline
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {dashboard.kioskOnline ? t('dashboard.online') : t('dashboard.offline')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Mode</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {getModeDisplayName(dashboard.currentKioskMode)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Seen</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{getUptime()}</p>
                  </div>

                  {dashboard.currentContent && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Content</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {dashboard.currentContent}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Visual Mode Selector Cards */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Kiosk Mode
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['digital-menu', 'survey', 'google-qr'] as KioskMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeChange(mode)}
                    className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                      selectedMode === mode
                        ? 'border-sky-600 dark:border-sky-400 bg-sky-50 dark:bg-sky-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                    }`}
                  >
                    <div
                      className={`mb-3 ${
                        selectedMode === mode
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {getModeIcon(mode)}
                    </div>
                    <h4
                      className={`font-semibold mb-2 ${
                        selectedMode === mode
                          ? 'text-sky-900 dark:text-sky-100'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {getModeDisplayName(mode)}
                    </h4>
                    <p
                      className={`text-sm ${
                        selectedMode === mode
                          ? 'text-sky-700 dark:text-sky-300'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {getModeDescription(mode)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Survey Selection (conditional) */}
            {selectedMode === 'survey' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <label htmlFor="survey" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {t('kioskControl.surveyTemplate')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="survey"
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">{t('kioskControl.selectSurvey')}</option>
                  {surveys?.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.title} - {survey.questions.length} questions ({survey.type === 'satisfaction' ? t('surveys.satisfaction') : t('surveys.discovery')})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('kioskControl.surveyHelp')}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={updateKioskMode.isPending}
                className="flex-1 px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-95"
              >
                {updateKioskMode.isPending ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('kioskControl.updating')}
                  </span>
                ) : (
                  'Apply Changes'
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Live Preview */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Live Preview
              </h3>
              <div className="aspect-[9/16] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <iframe
                  src="/"
                  title="Kiosk Preview"
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 text-center">
                Preview of current kiosk display
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
