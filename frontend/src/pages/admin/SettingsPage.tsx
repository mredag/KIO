import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useSettings,
  useUpdateSettings,
  useTestSheetsConnection,
} from '../../hooks/useAdminApi';

export default function SettingsPage() {
  const { t } = useTranslation('admin');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const testConnection = useTestSheetsConnection();

  // Timing settings
  const [slideshowTimeout, setSlideshowTimeout] = useState<number>(60);
  const [surveyTimeout, setSurveyTimeout] = useState<number>(60);
  const [googleQrDisplayDuration, setGoogleQrDisplayDuration] = useState<number>(10);

  // Google Review settings
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>('');
  const [googleReviewTitle, setGoogleReviewTitle] = useState<string>('');
  const [googleReviewDescription, setGoogleReviewDescription] = useState<string>('');

  // Google Sheets settings
  const [sheetsSheetId, setSheetsSheetId] = useState<string>('');
  const [sheetsSheetName, setSheetsSheetName] = useState<string>('');
  const [sheetsCredentials, setSheetsCredentials] = useState<string>('');

  // Password change
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // UI state
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Initialize form with current settings
  useEffect(() => {
    if (settings) {
      // Backend returns snake_case, frontend uses camelCase
      const backendSettings = settings as any;
      setSlideshowTimeout(backendSettings.slideshow_timeout || 60);
      setSurveyTimeout(backendSettings.survey_timeout || 60);
      setGoogleQrDisplayDuration(backendSettings.google_qr_display_duration || 10);
      setGoogleReviewUrl(backendSettings.google_review_url || '');
      setGoogleReviewTitle(backendSettings.google_review_title || '');
      setGoogleReviewDescription(backendSettings.google_review_description || '');
      setSheetsSheetId(backendSettings.sheets_sheet_id || '');
      setSheetsSheetName(backendSettings.sheets_sheet_name || '');
      setSheetsCredentials(backendSettings.sheets_credentials || '');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // Validate timing settings
    if (slideshowTimeout < 5 || slideshowTimeout > 300) {
      setErrorMessage(t('settings.errorTimeout'));
      return;
    }

    if (surveyTimeout < 5 || surveyTimeout > 300) {
      setErrorMessage(t('settings.errorSurveyTimeout'));
      return;
    }

    if (googleQrDisplayDuration < 5 || googleQrDisplayDuration > 300) {
      setErrorMessage(t('settings.errorQrDuration'));
      return;
    }

    // Validate password if provided
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setErrorMessage(t('settings.errorPasswordMismatch'));
        return;
      }

      if (newPassword.length < 8) {
        setErrorMessage(t('settings.errorPasswordLength'));
        return;
      }
    }

    // Validate Google Sheets credentials if provided
    if (sheetsCredentials) {
      try {
        JSON.parse(sheetsCredentials);
      } catch (error) {
        setErrorMessage(t('settings.errorCredentials'));
        return;
      }
    }

    try {
      const updates: any = {
        slideshow_timeout: slideshowTimeout,
        survey_timeout: surveyTimeout,
        google_qr_display_duration: googleQrDisplayDuration,
        google_review_url: googleReviewUrl,
        google_review_title: googleReviewTitle,
        google_review_description: googleReviewDescription,
        sheets_sheet_id: sheetsSheetId,
        sheets_sheet_name: sheetsSheetName,
      };

      if (sheetsCredentials) {
        updates.sheets_credentials = sheetsCredentials;
      }

      if (newPassword) {
        updates.new_password = newPassword;
      }

      await updateSettings.mutateAsync(updates);

      setSuccessMessage(t('settings.successMessage'));
      
      // Clear password fields
      setNewPassword('');
      setConfirmPassword('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      setErrorMessage(
        error.response?.data?.error || t('settings.errorUpdate')
      );
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await testConnection.mutateAsync({
        sheetId: sheetsSheetId,
        sheetName: sheetsSheetName,
        credentials: sheetsCredentials || undefined,
      });

      setConnectionTestResult({
        success: result.success,
        message: result.message || result.error || t('settings.connectionSuccess'),
      });
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setConnectionTestResult({
        success: false,
        message: error.response?.data?.error || t('settings.connectionFailed'),
      });
    } finally {
      setTestingConnection(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">{t('settings.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {t('settings.subtitle')}
          </p>
        </div>

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

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Timing Settings Section */}
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.timingSettings')}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('settings.timingSubtitle')}
              </p>
            </div>

            {/* Slideshow Timeout */}
            <div>
              <label
                htmlFor="slideshowTimeout"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.slideshowTimeout')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  id="slideshowTimeout"
                  value={slideshowTimeout}
                  onChange={(e) => setSlideshowTimeout(parseInt(e.target.value) || 0)}
                  min={5}
                  max={300}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <span className="text-sm text-gray-600 font-medium">{t('settings.seconds')}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.slideshowTimeoutHelp')}
              </p>
            </div>

            {/* Survey Timeout */}
            <div>
              <label
                htmlFor="surveyTimeout"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.surveyTimeout')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  id="surveyTimeout"
                  value={surveyTimeout}
                  onChange={(e) => setSurveyTimeout(parseInt(e.target.value) || 0)}
                  min={5}
                  max={300}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <span className="text-sm text-gray-600 font-medium">{t('settings.seconds')}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.surveyTimeoutHelp')}
              </p>
            </div>

            {/* Google QR Display Duration */}
            <div>
              <label
                htmlFor="googleQrDisplayDuration"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.googleQrDuration')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  id="googleQrDisplayDuration"
                  value={googleQrDisplayDuration}
                  onChange={(e) => setGoogleQrDisplayDuration(parseInt(e.target.value) || 0)}
                  min={5}
                  max={300}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <span className="text-sm text-gray-600 font-medium">{t('settings.seconds')}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.googleQrDurationHelp')}
              </p>
            </div>
          </div>

          {/* Google Review Settings Section */}
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('settings.googleReviewSettings')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('settings.googleReviewSubtitle')}
              </p>
            </div>

            {/* Google Review URL */}
            <div>
              <label
                htmlFor="googleReviewUrl"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.googleReviewUrl')}
              </label>
              <input
                type="url"
                id="googleReviewUrl"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder={t('settings.googleReviewUrlPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.googleReviewUrlHelp')}
              </p>
            </div>

            {/* Google Review Title */}
            <div>
              <label
                htmlFor="googleReviewTitle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.googleReviewTitle')}
              </label>
              <input
                type="text"
                id="googleReviewTitle"
                value={googleReviewTitle}
                onChange={(e) => setGoogleReviewTitle(e.target.value)}
                placeholder={t('settings.googleReviewTitle')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.googleReviewTitleHelp')}
              </p>
            </div>

            {/* Google Review Description */}
            <div>
              <label
                htmlFor="googleReviewDescription"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.googleReviewDescription')}
              </label>
              <textarea
                id="googleReviewDescription"
                value={googleReviewDescription}
                onChange={(e) => setGoogleReviewDescription(e.target.value)}
                placeholder={t('settings.googleReviewDescription')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.googleReviewDescriptionHelp')}
              </p>
            </div>
          </div>

          {/* Google Sheets Configuration Section */}
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('settings.sheetsIntegration')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('settings.sheetsSubtitle')}
              </p>
            </div>

            {/* Sheet ID */}
            <div>
              <label
                htmlFor="sheetsSheetId"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.sheetId')}
              </label>
              <input
                type="text"
                id="sheetsSheetId"
                value={sheetsSheetId}
                onChange={(e) => setSheetsSheetId(e.target.value)}
                placeholder={t('settings.sheetIdPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.sheetIdHelp')}
              </p>
            </div>

            {/* Sheet Name */}
            <div>
              <label
                htmlFor="sheetsSheetName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.sheetName')}
              </label>
              <input
                type="text"
                id="sheetsSheetName"
                value={sheetsSheetName}
                onChange={(e) => setSheetsSheetName(e.target.value)}
                placeholder={t('responses.title')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.sheetNameHelp')}
              </p>
            </div>

            {/* Credentials */}
            <div>
              <label
                htmlFor="sheetsCredentials"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.credentials')}
              </label>
              <textarea
                id="sheetsCredentials"
                value={sheetsCredentials}
                onChange={(e) => setSheetsCredentials(e.target.value)}
                placeholder='{"type": "service_account", "project_id": "...", ...}'
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.credentialsHelp')}
              </p>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection || !sheetsSheetId || !sheetsSheetName}
                aria-label={t('aria.testConnection')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingConnection ? t('settings.testing') : t('settings.testConnection')}
              </button>
              
              {connectionTestResult && (
                <div
                  className={`flex-1 px-4 py-2 rounded-lg ${
                    connectionTestResult.success
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {connectionTestResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Password Change Section */}
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.passwordChange')}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('settings.passwordChangeSubtitle')}
              </p>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.newPassword')}
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('settings.confirmPassword')}
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings.confirmPasswordPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={updateSettings.isPending}
              aria-label={t('aria.saveSettings')}
              className="flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateSettings.isPending ? t('settings.saving') : t('settings.saveSettings')}
            </button>
          </div>
        </form>

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
                {t('settings.infoMessage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
