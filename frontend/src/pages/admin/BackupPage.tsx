import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useBackupInfo, useDownloadBackup } from '../../hooks/useAdminApi';
import { formatDateTime } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';
import { DataTable, Column } from '../../components/admin/DataTable';

interface BackupFile {
  filename: string;
  timestamp: string;
  size: number;
}

export default function BackupPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: backupInfo, isLoading, error } = useBackupInfo();
  const downloadBackup = useDownloadBackup();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);

  const handleDownload = async () => {
    try {
      setDownloadError(null);
      await downloadBackup.mutateAsync();
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError(err.message || 'Failed to download backup');
    }
  };

  const handleRestoreClick = (backup: BackupFile) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = () => {
    // TODO: Implement restore functionality
    console.log('Restoring backup:', selectedBackup);
    setShowRestoreModal(false);
    setSelectedBackup(null);
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

  // Define columns for DataTable
  const columns: Column<BackupFile>[] = [
    {
      id: 'filename',
      header: t('backup.filename'),
      accessor: 'filename',
      sortable: true,
    },
    {
      id: 'timestamp',
      header: t('backup.date'),
      accessor: (row) => formatDate(row.timestamp),
      sortable: true,
    },
    {
      id: 'size',
      header: t('backup.size'),
      accessor: (row) => formatFileSize(row.size),
      sortable: true,
    },
    {
      id: 'actions',
      header: t('backup.actions', 'Actions'),
      accessor: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRestoreClick(row);
          }}
          className="text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 font-medium text-sm"
        >
          {t('backup.restore', 'Restore')}
        </button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('backup.title')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('backup.subtitle')}
          </p>
        </div>

        {/* Error messages */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              Failed to load backup information. Please try again.
            </p>
          </div>
        )}

        {downloadError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{downloadError}</p>
          </div>
        )}

        {/* Backup Status Card */}
        {!isLoading && backupInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('backup.status', 'Backup Status')}
              </h2>
            </div>
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Last Backup Time */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('backup.lastBackup')}</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatDate(backupInfo.lastBackup?.timestamp)}
                  </p>
                </div>

                {/* Backup Size */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('backup.fileSize')}</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {backupInfo.lastBackup?.size ? formatFileSize(backupInfo.lastBackup.size) : 'N/A'}
                  </p>
                </div>

                {/* Total Backups */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('backup.totalBackups', 'Total Backups')}</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {backupInfo.totalBackups || 0}
                  </p>
                </div>
              </div>

              {/* Content Summary */}
              {backupInfo.lastBackup?.summary && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('backup.contentsSummary')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {backupInfo.lastBackup.summary.massages !== undefined && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('backup.massages')}</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                          {backupInfo.lastBackup.summary.massages}
                        </p>
                      </div>
                    )}
                    {backupInfo.lastBackup.summary.surveyTemplates !== undefined && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('backup.surveyTemplates')}</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                          {backupInfo.lastBackup.summary.surveyTemplates}
                        </p>
                      </div>
                    )}
                    {backupInfo.lastBackup.summary.surveyResponses !== undefined && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('backup.surveyResponses')}</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                          {backupInfo.lastBackup.summary.surveyResponses}
                        </p>
                      </div>
                    )}
                    {backupInfo.lastBackup.summary.settings !== undefined && (
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('backup.systemSettings')}</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
                          {backupInfo.lastBackup.summary.settings ? '✓' : '—'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={handleDownload}
                  disabled={downloadBackup.isPending}
                  aria-label={t('aria.downloadBackup')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {downloadBackup.isPending ? t('backup.downloading') : t('backup.downloadBackup')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backup History with DataTable */}
        {!isLoading && backupInfo && backupInfo.backupFiles && backupInfo.backupFiles.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('backup.recentBackups', { count: backupInfo.totalBackups })}
            </h2>
            <DataTable
              data={backupInfo.backupFiles}
              columns={columns}
              pageSize={10}
              searchable={true}
              searchPlaceholder={t('backup.searchBackups', 'Search backups...')}
              emptyMessage={t('backup.noBackups', 'No backups found')}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Information box */}
        {!isLoading && backupInfo && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  {t('backup.aboutBackups')}
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>{t('backup.autoBackup')}</li>
                  <li>{t('backup.retention')}</li>
                  <li>{t('backup.contents')}</li>
                  <li>{t('backup.storage')}</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('backup.confirmRestore', 'Confirm Restore')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('backup.restoreWarning', 'Are you sure you want to restore this backup? This will replace all current data.')}
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {selectedBackup.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(selectedBackup.timestamp)} • {formatFileSize(selectedBackup.size)}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common:cancel', 'Cancel')}
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
              >
                {t('backup.restore', 'Restore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
