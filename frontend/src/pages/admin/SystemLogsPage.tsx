import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useSystemLogs } from '../../hooks/useAdminApi';
import { SystemLog } from '../../types';
import { formatDateTime } from '../../lib/dateFormatter';
import { DataTable, Column } from '../../components/admin/DataTable';

export default function SystemLogsPage() {
  const { t } = useTranslation('admin');
  const [levelFilter, setLevelFilter] = useState<'info' | 'warn' | 'error' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Filter logs by date range (client-side)
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    
    let filtered = [...logs];
    
    // Apply date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(log => new Date(log.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter(log => new Date(log.created_at) <= end);
    }
    
    return filtered;
  }, [logs, startDate, endDate]);

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  const getLevelBadge = (level: string) => {
    const badges = {
      error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-200', label: 'ERROR' },
      warn: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-200', label: 'WARN' },
      info: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-200', label: 'INFO' },
    };
    const badge = badges[level as keyof typeof badges] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', label: level.toUpperCase() };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const handleExport = useCallback(() => {
    if (!filteredLogs || filteredLogs.length === 0) return;
    
    // Create CSV content
    const headers = ['Timestamp', 'Level', 'Message', 'Details'];
    const rows = filteredLogs.map(log => [
      formatDate(log.created_at),
      log.level.toUpperCase(),
      log.message,
      log.details ? JSON.stringify(log.details) : ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `system-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredLogs]);

  // Define columns for DataTable
  const columns: Column<SystemLog>[] = [
    {
      id: 'created_at',
      header: t('logs.timestamp'),
      accessor: (row) => formatDate(row.created_at),
      sortable: true,
      width: 'w-48',
    },
    {
      id: 'level',
      header: t('logs.level'),
      accessor: (row) => getLevelBadge(row.level),
      sortable: true,
      width: 'w-28',
    },
    {
      id: 'message',
      header: t('logs.message'),
      accessor: 'message',
      sortable: true,
    },
    {
      id: 'details',
      header: t('logs.details'),
      accessor: (row) => (
        row.details ? (
          <details className="cursor-pointer">
            <summary className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 text-sm">
              {t('logs.viewDetails')}
            </summary>
            <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto max-w-md">
              {JSON.stringify(row.details, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-gray-400 dark:text-gray-600">—</span>
        )
      ),
      width: 'w-32',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('logs.title')}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t('logs.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              aria-label={t('aria.refreshLogs')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('logs.refresh')}
            </button>
            <button
              onClick={handleExport}
              disabled={!filteredLogs || filteredLogs.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('logs.export', 'Export')}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Level filter */}
            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('logs.level')}
              </label>
              <select
                id="level"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as any)}
                aria-label={t('aria.filterLevel')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="all">{t('logs.allLevels')}</option>
                <option value="info">{t('logs.info')}</option>
                <option value="warn">{t('logs.warning')}</option>
                <option value="error">{t('logs.error')}</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('logs.startDate', 'Start Date')}
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('logs.endDate', 'End Date')}
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Search */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('logs.search')}
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('logs.searchPlaceholder')}
                aria-label={t('aria.searchLogs')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Limit */}
            <div>
              <label htmlFor="limit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('logs.maxResults')}
              </label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(levelFilter !== 'all' || startDate || endDate || searchQuery) && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('logs.activeFilters', 'Active filters')}:</span>
                {levelFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md">
                    Level: {levelFilter}
                    <button onClick={() => setLevelFilter('all')} className="hover:text-gray-900 dark:hover:text-gray-100">×</button>
                  </span>
                )}
                {startDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md">
                    From: {startDate}
                    <button onClick={() => setStartDate('')} className="hover:text-gray-900 dark:hover:text-gray-100">×</button>
                  </span>
                )}
                {endDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md">
                    To: {endDate}
                    <button onClick={() => setEndDate('')} className="hover:text-gray-900 dark:hover:text-gray-100">×</button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md">
                    Search: {searchQuery}
                    <button onClick={() => setSearchQuery('')} className="hover:text-gray-900 dark:hover:text-gray-100">×</button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setLevelFilter('all');
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                  }}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium"
                >
                  {t('logs.clearAll', 'Clear all')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              {t('logs.loadError')}
            </p>
          </div>
        )}

        {/* Logs DataTable */}
        {!isLoading && filteredLogs && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('logs.logsTotal', { count: filteredLogs.length })}
              </h2>
            </div>
            <DataTable
              data={filteredLogs}
              columns={columns}
              pageSize={20}
              searchable={false}
              emptyMessage={t('logs.noLogs')}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
