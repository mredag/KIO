import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useBackupInfo, useDownloadBackup } from '../../hooks/useAdminApi';
import { formatDateTime } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';

export default function BackupPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: backupInfo, isLoading, error } = useBackupInfo();
  const downloadBackup = useDownloadBackup();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    try {
      setDownloadError(null);
      await downloadBackup.mutateAsync();
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'Failed to download backup');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('common:time.never', 'Hiç');
    return formatDateTime(dateString);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('backup.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('backup.subtitle')}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              Failed to load backup information. Please try again.
            </p>
          </div>
        )}

        {downloadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{downloadError}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading backup information...</p>
          </div>
        )}

        {/* Backup information */}
        {!isLoading && backupInfo && (
          <>
            {/* Last backup info */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('backup.lastBackup')}
                </h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('backup.timestamp')}</p>
                    <p className="mt-1 text-base text-gray-900">
                      {formatDate(backupInfo.lastBackup?.timestamp)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('backup.fileSize')}</p>
                    <p className="mt-1 text-base text-gray-900">
                      {backupInfo.lastBackup?.size
                        ? formatFileSize(backupInfo.lastBackup.size)
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {backupInfo.lastBackup?.summary && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">
                      {t('backup.contentsSummary')}
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {backupInfo.lastBackup.summary.massages !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('backup.massages')}:</span>
                          <span className="font-medium text-gray-900">
                            {backupInfo.lastBackup.summary.massages}
                          </span>
                        </div>
                      )}
                      {backupInfo.lastBackup.summary.surveyTemplates !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('backup.surveyTemplates')}:</span>
                          <span className="font-medium text-gray-900">
                            {backupInfo.lastBackup.summary.surveyTemplates}
                          </span>
                        </div>
                      )}
                      {backupInfo.lastBackup.summary.surveyResponses !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('backup.surveyResponses')}:</span>
                          <span className="font-medium text-gray-900">
                            {backupInfo.lastBackup.summary.surveyResponses}
                          </span>
                        </div>
                      )}
                      {backupInfo.lastBackup.summary.settings !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('backup.systemSettings')}:</span>
                          <span className="font-medium text-gray-900">
                            {backupInfo.lastBackup.summary.settings ? t('backup.included') : t('backup.notIncluded')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={handleDownload}
                    disabled={downloadBackup.isPending}
                    aria-label={t('aria.downloadBackup')}
                    className="w-full md:w-auto px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target"
                  >
                    {downloadBackup.isPending ? t('backup.downloading') : t('backup.downloadBackup')}
                  </button>
                </div>
              </div>
            </div>

            {/* Backup history */}
            {backupInfo.backupFiles && backupInfo.backupFiles.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('backup.recentBackups', { count: backupInfo.totalBackups })}
                  </h2>
                </div>
                
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('backup.filename')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('backup.date')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('backup.size')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {backupInfo.backupFiles.map((file: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {file.filename}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(file.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatFileSize(file.size)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-200">
                  {backupInfo.backupFiles.map((file: any, index: number) => (
                    <div key={index} className="px-4 py-4 space-y-2">
                      <div className="font-medium text-sm text-gray-900 break-all">
                        {file.filename}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('backup.date')}:</span>
                        <span className="text-gray-900">{formatDate(file.timestamp)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{t('backup.size')}:</span>
                        <span className="text-gray-900">{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Information box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                {t('backup.aboutBackups')}
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>{t('backup.autoBackup')}</li>
                <li>{t('backup.retention')}</li>
                <li>{t('backup.contents')}</li>
                <li>{t('backup.storage')}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
