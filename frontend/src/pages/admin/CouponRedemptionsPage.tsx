import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useCouponRedemptions,
  useCompleteRedemption,
  useRejectRedemption,
} from '../../hooks/useAdminApi';
import { formatDateTime } from '../../lib/dateFormatter';
import { getErrorMessage } from '../../lib/errorHandler';
import { useToast } from '../../contexts/ToastContext';
import { KPICard } from '../../components/admin/KPICard';
import { DataTable, Column } from '../../components/admin/DataTable';

interface Redemption {
  id: string;
  phone: string;
  phoneMasked: string;
  couponsUsed: number;
  status: 'pending' | 'completed' | 'rejected';
  note?: string;
  createdAt: Date;
  notifiedAt?: Date;
  completedAt?: Date;
  rejectedAt?: Date;
}

export default function CouponRedemptionsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: redemptions, isLoading, error: redemptionsError } = useCouponRedemptions({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const completeRedemption = useCompleteRedemption();
  const rejectRedemption = useRejectRedemption();

  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [completeModal, setCompleteModal] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Calculate stats
  const stats = useMemo(() => {
    if (!redemptions) return { total: 0, pending: 0, completed: 0, rejected: 0 };
    
    return {
      total: redemptions.length,
      pending: redemptions.filter((r: Redemption) => r.status === 'pending').length,
      completed: redemptions.filter((r: Redemption) => r.status === 'completed').length,
      rejected: redemptions.filter((r: Redemption) => r.status === 'rejected').length,
    };
  }, [redemptions]);

  // Calculate date range based on filter
  const calculateDateRange = useMemo(() => {
    const now = new Date();
    let start = '';
    let end = '';

    switch (dateRangeFilter) {
      case 'last7days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case 'last30days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case 'last3months':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
        break;
      case 'custom':
        start = startDate;
        end = endDate;
        break;
      default:
        start = '';
        end = '';
    }

    return { start, end };
  }, [dateRangeFilter, startDate, endDate]);

  // Filter by date range
  const filteredRedemptions = useMemo(() => {
    if (!redemptions) return [];
    
    let filtered = redemptions;
    
    if (calculateDateRange.start) {
      const start = new Date(calculateDateRange.start);
      filtered = filtered.filter((r: Redemption) => new Date(r.createdAt) >= start);
    }
    
    if (calculateDateRange.end) {
      const end = new Date(calculateDateRange.end);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r: Redemption) => new Date(r.createdAt) <= end);
    }
    
    return filtered;
  }, [redemptions, calculateDateRange]);

  const handleComplete = async (redemptionId: string) => {
    try {
      await completeRedemption.mutateAsync(redemptionId);
      setCompleteModal(null);
      addToast({
        type: 'success',
        title: t('admin:coupons.redemptionCompleted'),
        duration: 3000,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addToast({
        type: 'error',
        title: t('common:messages.error'),
        message: errorMessage,
        duration: 5000,
      });
      console.error('Failed to complete redemption:', err);
    }
  };

  const handleReject = async (redemptionId: string) => {
    if (!rejectNote.trim()) {
      addToast({
        type: 'error',
        title: t('admin:coupons.rejectNoteRequired'),
        duration: 3000,
      });
      return;
    }

    try {
      await rejectRedemption.mutateAsync({ redemptionId, note: rejectNote });
      setRejectModal(null);
      setRejectNote('');
      addToast({
        type: 'success',
        title: t('admin:coupons.redemptionRejected'),
        duration: 3000,
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      addToast({
        type: 'error',
        title: t('common:messages.error'),
        message: errorMessage,
        duration: 5000,
      });
      console.error('Failed to reject redemption:', err);
    }
  };

  // Define columns for DataTable with custom rendering
  const columns: Column<Redemption>[] = [
    {
      id: 'id',
      header: t('admin:coupons.redemptionId'),
      accessor: 'id',
      render: (row) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {row.id.substring(0, 8)}...
        </span>
      ),
      width: '150px',
    },
    {
      id: 'phone',
      header: t('admin:coupons.phone'),
      accessor: 'phone',
      render: (row) => (
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {row.phoneMasked}
        </span>
      ),
      width: '150px',
    },
    {
      id: 'couponsUsed',
      header: t('admin:coupons.couponsUsed'),
      accessor: 'couponsUsed',
      sortable: true,
      width: '120px',
    },
    {
      id: 'status',
      header: t('admin:coupons.status'),
      accessor: 'status',
      render: (row) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            row.status === 'completed'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : row.status === 'rejected'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}
        >
          {row.status === 'completed'
            ? t('admin:coupons.completed')
            : row.status === 'rejected'
              ? t('admin:coupons.rejected')
              : t('admin:coupons.pending')}
        </span>
      ),
      width: '120px',
    },
    {
      id: 'createdAt',
      header: t('admin:coupons.createdAt'),
      accessor: 'createdAt',
      render: (row) => formatDateTime(row.createdAt),
      sortable: true,
      width: '180px',
    },
    {
      id: 'actions',
      header: t('admin:coupons.actions'),
      accessor: () => '', // Empty accessor for search
      render: (row) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRedemption(row);
            }}
            className="text-sky-600 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300 font-medium"
          >
            {t('admin:coupons.view')}
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCompleteModal(row.id);
                }}
                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 font-medium"
              >
                {t('admin:coupons.complete')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRejectModal(row.id);
                }}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium"
              >
                {t('admin:coupons.reject')}
              </button>
            </>
          )}
        </div>
      ),
      width: '200px',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {t('admin:coupons.redemptions')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('admin:coupons.redemptionsDescription')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title={t('admin:coupons.totalRedemptions')}
            value={stats.total}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            isLoading={isLoading}
          />
          <KPICard
            title={t('admin:coupons.pending')}
            value={stats.pending}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            status={stats.pending > 0 ? 'warning' : 'normal'}
            isLoading={isLoading}
          />
          <KPICard
            title={t('admin:coupons.completed')}
            value={stats.completed}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            status="success"
            isLoading={isLoading}
          />
          <KPICard
            title={t('admin:coupons.rejected')}
            value={stats.rejected}
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            isLoading={isLoading}
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin:coupons.filterByStatus')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="all">{t('admin:coupons.allStatuses')}</option>
                <option value="pending">{t('admin:coupons.pending')}</option>
                <option value="completed">{t('admin:coupons.completed')}</option>
                <option value="rejected">{t('admin:coupons.rejected')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin:coupons.dateRange')}
              </label>
              <select
                value={dateRangeFilter}
                onChange={(e) => {
                  setDateRangeFilter(e.target.value);
                  if (e.target.value !== 'custom') {
                    setStartDate('');
                    setEndDate('');
                  }
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="all">{t('admin:coupons.allTime')}</option>
                <option value="last7days">{t('admin:coupons.last7Days')}</option>
                <option value="last30days">{t('admin:coupons.last30Days')}</option>
                <option value="last3months">{t('admin:coupons.last3Months')}</option>
                <option value="custom">{t('admin:coupons.customRange')}</option>
              </select>
            </div>
            {dateRangeFilter === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin:coupons.startDate')}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    lang="tr"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin:coupons.endDate')}
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    lang="tr"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Redemptions Table */}
        <DataTable
          data={filteredRedemptions}
          columns={columns}
          isLoading={isLoading}
          searchable={true}
          searchPlaceholder={t('admin:coupons.searchRedemptions')}
          emptyMessage={redemptionsError ? getErrorMessage(redemptionsError) : t('admin:coupons.noRedemptions')}
          onRowClick={(row) => setSelectedRedemption(row)}
        />

        {/* Redemption Detail Modal */}
        {selectedRedemption && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {t('admin:coupons.redemptionDetails')}
                </h3>
                <button
                  onClick={() => setSelectedRedemption(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.redemptionId')}</p>
                    <p className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{selectedRedemption.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.status')}</p>
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        selectedRedemption.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : selectedRedemption.status === 'rejected'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {selectedRedemption.status === 'completed'
                        ? t('admin:coupons.completed')
                        : selectedRedemption.status === 'rejected'
                          ? t('admin:coupons.rejected')
                          : t('admin:coupons.pending')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.phone')}</p>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100">{selectedRedemption.phoneMasked}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.couponsUsed')}</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{selectedRedemption.couponsUsed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.createdAt')}</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{formatDateTime(selectedRedemption.createdAt)}</p>
                  </div>
                  {selectedRedemption.completedAt && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.completedAt')}</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{formatDateTime(selectedRedemption.completedAt)}</p>
                    </div>
                  )}
                  {selectedRedemption.rejectedAt && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin:coupons.rejectedAt')}</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{formatDateTime(selectedRedemption.rejectedAt)}</p>
                    </div>
                  )}
                </div>

                {selectedRedemption.note && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('admin:coupons.note')}</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      {selectedRedemption.note}
                    </p>
                  </div>
                )}

                {selectedRedemption.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setCompleteModal(selectedRedemption.id);
                        setSelectedRedemption(null);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      {t('admin:coupons.complete')}
                    </button>
                    <button
                      onClick={() => {
                        setRejectModal(selectedRedemption.id);
                        setSelectedRedemption(null);
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      {t('admin:coupons.reject')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Complete Modal */}
        {completeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
                {t('admin:coupons.completeRedemption')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t('admin:coupons.completeConfirm')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleComplete(completeModal)}
                  disabled={completeRedemption.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {completeRedemption.isPending
                    ? t('common:messages.loading')
                    : t('admin:coupons.confirmComplete')}
                </button>
                <button
                  onClick={() => setCompleteModal(null)}
                  disabled={completeRedemption.isPending}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 font-medium"
                >
                  {t('admin:coupons.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {rejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
                {t('admin:coupons.rejectRedemption')}
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('admin:coupons.rejectNote')}
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder={t('admin:coupons.rejectNotePlaceholder')}
                  rows={4}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleReject(rejectModal)}
                  disabled={rejectRedemption.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {rejectRedemption.isPending
                    ? t('common:messages.loading')
                    : t('admin:coupons.confirmReject')}
                </button>
                <button
                  onClick={() => {
                    setRejectModal(null);
                    setRejectNote('');
                  }}
                  disabled={rejectRedemption.isPending}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 font-medium"
                >
                  {t('admin:coupons.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
