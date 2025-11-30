import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useSettings,
  useUpdateSettings,
  useTestSheetsConnection,
} from '../../hooks/useAdminApi';
import { themesList, KioskThemeId } from '../../lib/kioskTheme';

type TabId = 'timing' | 'theme' | 'google-review' | 'sheets' | 'security';

export default function SettingsPage() {
  const { t } = useTranslation('admin');
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const testConnection = useTestSheetsConnection();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('timing');

  // Timing settings
  const [slideshowTimeout, setSlideshowTimeout] = useState<number>(60);
  const [surveyTimeout, setSurveyTimeout] = useState<number>(60);
  const [googleQrDisplayDuration, setGoogleQrDisplayDuration] = useState<number>(10);
  const [kioskTheme, setKioskTheme] = useState<KioskThemeId>('classic');

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

  // Validation errors per field
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
      setKioskTheme((backendSettings.kiosk_theme as KioskThemeId) || 'classic');
    }
  }, [settings]);

  // Inline validation
  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'slideshowTimeout':
        if (value < 5 || value > 300) {
          return t('settings.errorTimeout');
        }
        break;
      case 'surveyTimeout':
        if (value < 5 || value > 300) {
          return t('settings.errorSurveyTimeout');
        }
        break;
      case 'googleQrDisplayDuration':
        if (value < 5 || value > 300) {
          return t('settings.errorQrDuration');
        }
        break;
      case 'newPassword':
        if (value && value.length < 8) {
          return t('settings.errorPasswordLength');
        }
        break;
      case 'confirmPassword':
        if (value && value !== newPassword) {
          return t('settings.errorPasswordMismatch');
        }
        break;
      case 'sheetsCredentials':
        if (value) {
          try {
            JSON.parse(value);
          } catch {
            return t('settings.errorCredentials');
          }
        }
        break;
    }
    return null;
  };

  const handleFieldChange = (field: string, value: any, setter: (val: any) => void) => {
    setter(value);
    const error = validateField(field, value);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm(t('settings.confirmReset'))) {
      setSlideshowTimeout(60);
      setSurveyTimeout(60);
      setGoogleQrDisplayDuration(10);
      setKioskTheme('classic');
      setGoogleReviewUrl('');
      setGoogleReviewTitle('');
      setGoogleReviewDescription('');
      setSheetsSheetId('');
      setSheetsSheetName('');
      setSheetsCredentials('');
      setNewPassword('');
      setConfirmPassword('');
      setValidationErrors({});
      setSuccessMessage(t('settings.resetSuccess'));
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // Validate all fields
    const errors: Record<string, string> = {};
    
    const slideshowError = validateField('slideshowTimeout', slideshowTimeout);
    if (slideshowError) errors.slideshowTimeout = slideshowError;
    
    const surveyError = validateField('surveyTimeout', surveyTimeout);
    if (surveyError) errors.surveyTimeout = surveyError;
    
    const qrError = validateField('googleQrDisplayDuration', googleQrDisplayDuration);
    if (qrError) errors.googleQrDisplayDuration = qrError;
    
    if (newPassword) {
      const passwordError = validateField('newPassword', newPassword);
      if (passwordError) errors.newPassword = passwordError;
    }
    
    if (confirmPassword) {
      const confirmError = validateField('confirmPassword', confirmPassword);
      if (confirmError) errors.confirmPassword = confirmError;
    }
    
    if (sheetsCredentials) {
      const credError = validateField('sheetsCredentials', sheetsCredentials);
      if (credError) errors.sheetsCredentials = credError;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMessage(t('settings.validationError'));
      return;
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
        kiosk_theme: kioskTheme,
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

  const tabs = [
    { id: 'timing' as TabId, label: t('settings.timingSettings'), icon: '⏱️' },
    { id: 'theme' as TabId, label: t('settings.kioskTheme'), icon: '🎨' },
    { id: 'google-review' as TabId, label: t('settings.googleReviewSettings'), icon: '⭐' },
    { id: 'sheets' as TabId, label: t('settings.sheetsIntegration'), icon: '📊' },
    { id: 'security' as TabId, label: t('settings.passwordChange'), icon: '🔒' },
  ];

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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Timing Settings Tab */}
            {activeTab === 'timing' && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.timingSubtitle')}
                  </p>
                </div>

                {/* Slideshow Timeout */}
                <div>
                  <label
                    htmlFor="slideshowTimeout"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.slideshowTimeout')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="slideshowTimeout"
                      value={slideshowTimeout}
                      onChange={(e) => handleFieldChange('slideshowTimeout', parseInt(e.target.value) || 0, setSlideshowTimeout)}
                      min={5}
                      max={300}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        validationErrors.slideshowTimeout ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{t('settings.seconds')}</span>
                  </div>
                  {validationErrors.slideshowTimeout && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.slideshowTimeout}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.slideshowTimeoutHelp')}
                  </p>
                </div>

                {/* Survey Timeout */}
                <div>
                  <label
                    htmlFor="surveyTimeout"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.surveyTimeout')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="surveyTimeout"
                      value={surveyTimeout}
                      onChange={(e) => handleFieldChange('surveyTimeout', parseInt(e.target.value) || 0, setSurveyTimeout)}
                      min={5}
                      max={300}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        validationErrors.surveyTimeout ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{t('settings.seconds')}</span>
                  </div>
                  {validationErrors.surveyTimeout && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.surveyTimeout}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.surveyTimeoutHelp')}
                  </p>
                </div>

                {/* Google QR Display Duration */}
                <div>
                  <label
                    htmlFor="googleQrDisplayDuration"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.googleQrDuration')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      id="googleQrDisplayDuration"
                      value={googleQrDisplayDuration}
                      onChange={(e) => handleFieldChange('googleQrDisplayDuration', parseInt(e.target.value) || 0, setGoogleQrDisplayDuration)}
                      min={5}
                      max={300}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                        validationErrors.googleQrDisplayDuration ? 'border-red-500' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{t('settings.seconds')}</span>
                  </div>
                  {validationErrors.googleQrDisplayDuration && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.googleQrDisplayDuration}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.googleQrDurationHelp')}
                  </p>
                </div>
              </div>
            )}

            {/* Theme Tab - Visual theme selector with preview cards (Requirement 15.2) */}
            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.kioskThemeHelp')}</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {themesList.map((theme) => {
                    const isSelected = kioskTheme === theme.id;
                    // Get preview gradient colors for each theme
                    const previewGradient = theme.id === 'classic' 
                      ? 'from-blue-600 via-purple-600 to-indigo-600'
                      : theme.id === 'neo'
                      ? 'from-gray-800 via-slate-700 to-zinc-800'
                      : 'from-violet-700 via-fuchsia-700 to-rose-700';
                    
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setKioskTheme(theme.id)}
                        className={`w-full text-left border rounded-xl overflow-hidden transition-all duration-200 ${
                          isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-500/50 dark:border-blue-400 dark:ring-blue-400/50' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                        }`}
                      >
                        {/* Theme Preview */}
                        <div className={`h-24 bg-gradient-to-br ${previewGradient} relative`}>
                          {/* Mini QR preview */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-white rounded-lg shadow-lg flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                              </svg>
                            </div>
                          </div>
                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm shadow-lg">
                                ✓
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Theme Info */}
                        <div className="p-4 bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {theme.name}
                            </div>
                            {/* Color dots preview */}
                            <div className="flex gap-1">
                              {theme.id === 'classic' && (
                                <>
                                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                                </>
                              )}
                              {theme.id === 'neo' && (
                                <>
                                  <span className="w-3 h-3 rounded-full bg-gray-700"></span>
                                  <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-slate-600"></span>
                                </>
                              )}
                              {theme.id === 'immersive' && (
                                <>
                                  <span className="w-3 h-3 rounded-full bg-violet-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-fuchsia-500"></span>
                                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {theme.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Theme Features Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {kioskTheme === 'classic' && 'Klasik Tema Özellikleri'}
                    {kioskTheme === 'neo' && 'Neo Tema Özellikleri'}
                    {kioskTheme === 'immersive' && 'Immersive Tema Özellikleri'}
                  </h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {kioskTheme === 'classic' && (
                      <>
                        <li>• Mavi-mor gradient arka plan</li>
                        <li>• Profesyonel ve temiz görünüm</li>
                        <li>• Yumuşak animasyonlar</li>
                      </>
                    )}
                    {kioskTheme === 'neo' && (
                      <>
                        <li>• Koyu tema, cyan vurgular</li>
                        <li>• Modern ve şık tasarım</li>
                        <li>• Neon parıltı efektleri</li>
                      </>
                    )}
                    {kioskTheme === 'immersive' && (
                      <>
                        <li>• Mor-pembe gradient arka plan</li>
                        <li>• Tam ekran görsel deneyim</li>
                        <li>• Gelişmiş animasyonlar ve efektler</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Google Review Tab */}
            {activeTab === 'google-review' && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.googleReviewSubtitle')}
                  </p>
                </div>

                {/* Google Review URL */}
                <div>
                  <label
                    htmlFor="googleReviewUrl"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.googleReviewUrl')}
                  </label>
                  <input
                    type="url"
                    id="googleReviewUrl"
                    value={googleReviewUrl}
                    onChange={(e) => setGoogleReviewUrl(e.target.value)}
                    placeholder={t('settings.googleReviewUrlPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.googleReviewUrlHelp')}
                  </p>
                </div>

                {/* Google Review Title */}
                <div>
                  <label
                    htmlFor="googleReviewTitle"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.googleReviewTitle')}
                  </label>
                  <input
                    type="text"
                    id="googleReviewTitle"
                    value={googleReviewTitle}
                    onChange={(e) => setGoogleReviewTitle(e.target.value)}
                    placeholder={t('settings.googleReviewTitle')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.googleReviewTitleHelp')}
                  </p>
                </div>

                {/* Google Review Description */}
                <div>
                  <label
                    htmlFor="googleReviewDescription"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.googleReviewDescription')}
                  </label>
                  <textarea
                    id="googleReviewDescription"
                    value={googleReviewDescription}
                    onChange={(e) => setGoogleReviewDescription(e.target.value)}
                    placeholder={t('settings.googleReviewDescription')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.googleReviewDescriptionHelp')}
                  </p>
                </div>
              </div>
            )}

            {/* Google Sheets Tab */}
            {activeTab === 'sheets' && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.sheetsSubtitle')}
                  </p>
                </div>

                {/* Sheet ID */}
                <div>
                  <label
                    htmlFor="sheetsSheetId"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.sheetId')}
                  </label>
                  <input
                    type="text"
                    id="sheetsSheetId"
                    value={sheetsSheetId}
                    onChange={(e) => setSheetsSheetId(e.target.value)}
                    placeholder={t('settings.sheetIdPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.sheetIdHelp')}
                  </p>
                </div>

                {/* Sheet Name */}
                <div>
                  <label
                    htmlFor="sheetsSheetName"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.sheetName')}
                  </label>
                  <input
                    type="text"
                    id="sheetsSheetName"
                    value={sheetsSheetName}
                    onChange={(e) => setSheetsSheetName(e.target.value)}
                    placeholder={t('responses.title')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.sheetNameHelp')}
                  </p>
                </div>

                {/* Credentials */}
                <div>
                  <label
                    htmlFor="sheetsCredentials"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.credentials')}
                  </label>
                  <textarea
                    id="sheetsCredentials"
                    value={sheetsCredentials}
                    onChange={(e) => handleFieldChange('sheetsCredentials', e.target.value, setSheetsCredentials)}
                    placeholder='{"type": "service_account", "project_id": "...", ...}'
                    rows={6}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs dark:bg-gray-700 dark:text-white ${
                      validationErrors.sheetsCredentials ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {validationErrors.sheetsCredentials && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.sheetsCredentials}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                      }`}
                    >
                      {connectionTestResult.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.passwordChangeSubtitle')}
                  </p>
                </div>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.newPassword')}
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => handleFieldChange('newPassword', e.target.value, setNewPassword)}
                    placeholder={t('settings.newPasswordPlaceholder')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      validationErrors.newPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {validationErrors.newPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.newPassword}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.passwordMinLength')}
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t('settings.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => handleFieldChange('confirmPassword', e.target.value, setConfirmPassword)}
                    placeholder={t('settings.confirmPasswordPlaceholder')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                      validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {validationErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Info Box */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
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
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        {t('settings.passwordWarning')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit and Reset Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={updateSettings.isPending || Object.keys(validationErrors).length > 0}
                aria-label={t('aria.saveSettings')}
                className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateSettings.isPending ? t('settings.saving') : t('settings.saveSettings')}
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                disabled={updateSettings.isPending}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('settings.resetToDefaults')}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
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
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t('settings.infoMessage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
