import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useUnifiedInteractions, useInteractionsAnalytics, useExportInteractions } from '../../hooks/useAdminApi';
import { DataTable, Column } from '../../components/admin/DataTable';
import { formatDateTime, formatRelativeTime } from '../../lib/dateFormatter';

type Platform = 'all' | 'whatsapp' | 'instagram';

interface Interaction {
  id: string;
  platform: 'whatsapp' | 'instagram';
  customerId: string;
  direction: 'inbound' | 'outbound';
  messageText: string;
  intent?: string;
  sentiment?: string;
  aiResponse?: string;
  responseTimeMs?: number;
  createdAt: Date;
}

export default function InteractionsPage() {
  const { t } = useTranslation(['admin', 'common']);
  
  // Filters
  const [platform, setPlatform] = useState<Platform>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Build filters object
  const filters = useMemo(() => {
    const f: any = {};
    if (platform !== 'all') f.platform = platform;
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    if (searchQuery) f.customerId = searchQuery;
    return f;
  }, [platform, startDate, endDate, searchQuery]);
  
  // Fetch data
  const { data: interactions, isLoading, error } = useUnifiedInteractions(filters);
  const { data: analytics } = useInteractionsAnalytics(filters);
  const exportMutation = useExportInteractions();
  
  // Handle export
  const handleExport = () => {
    exportMutation.mutate(filters);
  };
  
  // Define table columns
  const columns: Column<Interaction>[] = [
    {
      id: 'platform',
      header: t('admin:interactions.platform'),
      accessor: (row) => (
        <div className="flex items-center gap-2">
          {row.platform === 'whatsapp' ? (
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {row.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
          </span>
        </div>
      ),
      sortable: true,
      width: 'w-32',
    },
    {
      id: 'customerId',
      header: t('admin:interactions.customer'),
      accessor: (row) => (
        <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
          {row.customerId}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'direction',
      header: t('admin:interactions.direction'),
      accessor: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          row.direction === 'inbound'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
        }`}>
          {row.direction === 'inbound' ? t('admin:interactions.inbound') : t('admin:interactions.outbound')}
        </span>
      ),
      sortable: true,
      width: 'w-24',
    },
    {
      id: 'message',
      header: t('admin:interactions.message'),
      accessor: (row) => (
        <div className="max-w-md">
          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
            {row.messageText}
          </p>
        </div>
      ),
    },
    {
      id: 'intent',
      header: t('admin:interactions.intent'),
      accessor: (row) => (
        row.intent ? (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            {row.intent}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
        )
      ),
      sortable: true,
      width: 'w-28',
    },
    {
      id: 'sentiment',
      header: t('admin:interactions.sentiment'),
      accessor: (row) => (
        row.sentiment ? (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            row.sentiment === 'positive'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : row.sentiment === 'negative'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}>
            {row.sentiment}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
        )
      ),
      sortable: true,
      width: 'w-24',
    },
    {
      id: 'timestamp',
      header: t('admin:interactions.timestamp'),
      accessor: (row) => (
        <div className="text-sm">
          <div className="text-gray-900 dark:text-gray-100">{formatRelativeTime(row.createdAt)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(row.createdAt)}</div>
        </div>
      ),
      sortable: true,
      width: 'w-40',
    },
  ];
  
  if (error) {
    const isAuthError = (error as any)?.response?.status === 401;
    const errorMessage = isAuthError 
      ? t('common:messages.unauthorized', 'Your session has expired. Redirecting to login...')
      : (error as any)?.response?.data?.error || t('common:messages.error');
    
    return (
      <AdminLayout>
        <div className={`rounded-lg p-6 ${
          isAuthError 
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {isAuthError ? (
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-medium ${
                isAuthError 
                  ? 'text-yellow-800 dark:text-yellow-300'
                  : 'text-red-800 dark:text-red-300'
              }`}>
                {isAuthError ? t('common:messages.authenticationRequired', 'Authentication Required') : t('common:messages.errorOccurred', 'An Error Occurred')}
              </h3>
              <p className={`mt-1 text-sm ${
                isAuthError 
                  ? 'text-yellow-700 dark:text-yellow-400'
                  : 'text-red-700 dark:text-red-400'
              }`}>
                {errorMessage}
              </p>
              {!isAuthError && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t('common:actions.retry', 'Try Again')}
                </button>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('admin:interactions.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('admin:interactions.subtitle')}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exportMutation.isPending ? t('admin:interactions.exporting') : t('admin:interactions.export')}
          </button>
        </div>
        
        {/* Analytics Summary Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('admin:interactions.analytics.total')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {analytics.totalMessages || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('admin:interactions.analytics.uniqueCustomers')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {analytics.uniqueCustomers || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('admin:interactions.analytics.avgResponseTime')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {analytics.avgResponseTime ? `${Math.round(analytics.avgResponseTime)}ms` : '-'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t('admin:interactions.analytics.positiveRate')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {analytics.sentimentBreakdown?.positive 
                      ? `${Math.round((analytics.sentimentBreakdown.positive / analytics.totalMessages) * 100)}%`
                      : '-'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Platform Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin:interactions.filter.platform')}
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="all">{t('admin:interactions.filter.all')}</option>
                <option value="whatsapp">{t('admin:interactions.filter.whatsapp')}</option>
                <option value="instagram">{t('admin:interactions.filter.instagram')}</option>
              </select>
            </div>
            
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin:interactions.filter.startDate')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            
            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin:interactions.filter.endDate')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('admin:interactions.filter.search')}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('admin:interactions.filter.searchPlaceholder')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        
        {/* Interactions Table */}
        <DataTable
          data={interactions || []}
          columns={columns}
          pageSize={20}
          searchable={false}
          emptyMessage={t('admin:interactions.noInteractions')}
          isLoading={isLoading}
        />
      </div>
    </AdminLayout>
  );
}
