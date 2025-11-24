import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useSystemLogs } from '../../hooks/useAdminApi';
import { SystemLog } from '../../types';
import { formatDateTime } from '../../lib/dateFormatter';

export default function SystemLogsPage() {
  const { t } = useTranslation('admin');
  const [levelFilter, setLevelFilter] = useState<'info' | 'warn' | 'error' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Build filters for API
  const apiFilters = useMemo(() => {
    const filters: any = { limit };
    if (levelFilter !== 'all') {
      filters.level = levelFilter;
    }
    if (searchQuery.trim()) {
      filters.search = searchQuery.trim();
    }
    return filters;
  }, [levelFilter, searchQuery, limit]);

  const { data: logs, isLoading, error, refetch } = useSystemLogs(apiFilters);

  // Pagination
  const paginatedLogs = useMemo(() => {
    if (!logs) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return logs.slice(startIndex, endIndex);
  }, [logs, currentPage]);

  const totalPages = useMemo(() => {
    if (!logs) return 0;
    return Math.ceil(logs.length / itemsPerPage);
  }, [logs]);

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warn':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('logs.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('logs.subtitle')}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Level filter */}
            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                {t('logs.level')}
              </label>
              <select
                id="level"
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                aria-label={t('aria.filterLevel')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">{t('logs.allLevels')}</option>
                <option value="info">{t('logs.info')}</option>
                <option value="warn">{t('logs.warning')}</option>
                <option value="error">{t('logs.error')}</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                {t('logs.search')}
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t('logs.searchPlaceholder')}
                aria-label={t('aria.searchLogs')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Limit */}
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
                {t('logs.maxResults')}
              </label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => refetch()}
              aria-label={t('aria.refreshLogs')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-target"
            >
              {t('logs.refresh')}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              {t('logs.loadError')}
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">{t('logs.loading')}</p>
          </div>
        )}

        {/* Logs table */}
        {!isLoading && logs && (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('logs.logsTotal', { count: logs.length })}
                </h2>
                {totalPages > 1 && (
                  <span className="text-sm text-gray-600">
                    {t('logs.pageOf', { current: currentPage, total: totalPages })}
                  </span>
                )}
              </div>

              {paginatedLogs.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  {t('logs.noLogs')}
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('logs.timestamp')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('logs.level')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('logs.message')}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {t('logs.details')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedLogs.map((log: SystemLog) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {formatDate(log.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelBadgeClass(
                                  log.level
                                )}`}
                              >
                                {log.level.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {log.message}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {log.details ? (
                                <details className="cursor-pointer">
                                  <summary className="text-primary-600 hover:text-primary-700">
                                    {t('logs.viewDetails')}
                                  </summary>
                                  <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </details>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-gray-200">
                    {paginatedLogs.map((log: SystemLog) => (
                      <div key={log.id} className="px-4 py-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelBadgeClass(
                              log.level
                            )}`}
                          >
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 text-right">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 break-words">
                          {log.message}
                        </div>
                        {log.details && (
                          <details className="cursor-pointer">
                            <summary className="text-sm text-primary-600 hover:text-primary-700">
                              {t('logs.viewDetails')}
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label={t('aria.previousPage')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target"
                >
                  {t('logs.previous')}
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors touch-target ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label={t('aria.nextPage')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-target"
                >
                  {t('logs.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
