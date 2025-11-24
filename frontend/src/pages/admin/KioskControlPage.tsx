import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useDashboard,
  useSurveyTemplates,
  useUpdateKioskMode,
} from '../../hooks/useAdminApi';
import { KioskMode } from '../../types';

export default function KioskControlPage() {
  const { t } = useTranslation('admin');
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard();
  const { data: surveys, isLoading: surveysLoading } = useSurveyTemplates();
  const updateKioskMode = useUpdateKioskMode();

  const [selectedMode, setSelectedMode] = useState<KioskMode>('digital-menu');
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

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
    setSuccessMessage('');
    setErrorMessage('');

    // Validate survey mode requires survey selection
    if (selectedMode === 'survey' && !selectedSurveyId) {
      setErrorMessage(t('kioskControl.errorSelectSurvey'));
      return;
    }

    try {
      await updateKioskMode.mutateAsync({
        mode: selectedMode,
        activeSurveyId: selectedMode === 'survey' ? selectedSurveyId : undefined,
      });

      setSuccessMessage(t('kioskControl.successMessage'));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Failed to update kiosk mode:', error);
      setErrorMessage(
        error.response?.data?.error || t('kioskControl.errorUpdate')
      );
    }
  };

  const handleModeChange = (mode: KioskMode) => {
    setSelectedMode(mode);
    // Clear survey selection if not in survey mode
    if (mode !== 'survey') {
      setSelectedSurveyId('');
    }
  };

  if (dashboardLoading || surveysLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading...</div>
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

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('kioskControl.title')}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('kioskControl.subtitle')}
          </p>
        </div>

        {/* Current Status */}
        {dashboard && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">{t('kioskControl.currentStatus')}</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p>
                <span className="font-medium">{t('kioskControl.mode')}:</span>{' '}
                {getModeDisplayName(dashboard.currentKioskMode)}
              </p>
              {dashboard.currentContent && (
                <p>
                  <span className="font-medium">{t('kioskControl.content')}:</span> {dashboard.currentContent}
                </p>
              )}
              <p>
                <span className="font-medium">{t('kioskControl.status')}:</span>{' '}
                <span
                  className={
                    dashboard.kioskOnline ? 'text-green-700 font-medium' : 'text-red-700 font-medium'
                  }
                >
                  {dashboard.kioskOnline ? t('dashboard.online') : t('dashboard.offline')}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Control Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Mode Selection */}
          <div>
            <label htmlFor="mode" className="block text-sm font-medium text-gray-700 mb-2">
              {t('kioskControl.kioskMode')} <span className="text-red-500">*</span>
            </label>
            <select
              id="mode"
              value={selectedMode}
              onChange={(e) => handleModeChange(e.target.value as KioskMode)}
              aria-label={t('aria.changeMode', { mode: getModeDisplayName(selectedMode) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="digital-menu">{t('kioskControl.modeDigitalMenu')}</option>
              <option value="survey">{t('kioskControl.modeSurvey')}</option>
              <option value="google-qr">{t('kioskControl.modeGoogleQr')}</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {t('kioskControl.subtitle')}
            </p>
          </div>

          {/* Survey Template Selection (shown only in survey mode) */}
          {selectedMode === 'survey' && (
            <div>
              <label htmlFor="survey" className="block text-sm font-medium text-gray-700 mb-2">
                {t('kioskControl.surveyTemplate')} <span className="text-red-500">*</span>
              </label>
              <select
                id="survey"
                value={selectedSurveyId}
                onChange={(e) => setSelectedSurveyId(e.target.value)}
                aria-label={t('aria.selectSurvey', { name: surveys?.find(s => s.id === selectedSurveyId)?.name || '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('kioskControl.selectSurvey')}</option>
                {surveys?.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title} - {survey.questions.length} soru ({survey.type === 'satisfaction' ? t('surveys.satisfaction') : t('surveys.discovery')})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {t('kioskControl.surveyHelp')}
              </p>
            </div>
          )}

          {/* Mode Descriptions */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-900">{t('kioskControl.modeDescriptions')}</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-900">{t('kioskControl.modeDigitalMenu')}:</span> {t('kioskControl.digitalMenuDesc')}
              </div>
              <div>
                <span className="font-medium text-gray-900">{t('kioskControl.modeSurvey')}:</span> {t('kioskControl.surveyDesc')}
              </div>
              <div>
                <span className="font-medium text-gray-900">{t('kioskControl.modeGoogleQr')}:</span> {t('kioskControl.googleQrDesc')}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={updateKioskMode.isPending}
              aria-label={t('aria.saveSettings')}
              className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {updateKioskMode.isPending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('kioskControl.updating')}
                </span>
              ) : (
                t('kioskControl.updateMode')
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                {t('kioskControl.infoMessage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
