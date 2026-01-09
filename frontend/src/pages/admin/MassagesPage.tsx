import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useMassages, useDeleteMassage, useUpdateMassage } from '../../hooks/useAdminApi';
import { Massage } from '../../types';
import { DataTable, Column } from '../../components/admin/DataTable';

type ViewMode = 'table' | 'card';

export default function MassagesPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { data: massages, isLoading, error } = useMassages();
  const deleteMassage = useDeleteMassage();
  const updateMassage = useUpdateMassage();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkLayout, setBulkLayout] = useState<Massage['layoutTemplate']>('price-list');
  const [applyingBulk, setApplyingBulk] = useState(false);
  
  // New state for filters and view mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [layoutFilter, setLayoutFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter massages based on selected filters
  const filteredMassages = useMemo(() => {
    if (!massages) return [];
    
    let filtered = [...massages];
    
    // Apply layout filter
    if (layoutFilter !== 'all') {
      filtered = filtered.filter(m => m.layoutTemplate === layoutFilter);
    }
    
    // Apply status filter
    if (statusFilter === 'featured') {
      filtered = filtered.filter(m => m.isFeatured);
    } else if (statusFilter === 'campaign') {
      filtered = filtered.filter(m => m.isCampaign);
    }
    
    // Sort by sortOrder
    return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [massages, layoutFilter, statusFilter]);

  // Define DataTable columns
  const columns: Column<Massage>[] = [
    {
      id: 'sortOrder',
      header: t('massages.order'),
      accessor: 'sortOrder',
      sortable: true,
      width: 'w-20',
    },
    {
      id: 'name',
      header: t('massages.name'),
      accessor: (row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{row.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
            {row.shortDescription}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      id: 'mediaType',
      header: t('massages.type'),
      accessor: (row) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          {row.mediaType || t('massages.noMedia')}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'layoutTemplate',
      header: t('massages.layoutTemplate'),
      accessor: (row) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
          {row.layoutTemplate === 'info-tags'
            ? t('massages.layoutOptionInfoTags')
            : row.layoutTemplate === 'media-focus'
              ? t('massages.layoutOptionMediaFocus')
              : row.layoutTemplate === 'immersive-showcase'
                ? t('massages.layoutOptionImmersive')
                : t('massages.layoutOptionPriceList')}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'flags',
      header: t('massages.flags'),
      accessor: (row) => (
        <div className="flex gap-2">
          {row.isFeatured && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
              {t('massages.featured')}
            </span>
          )}
          {row.isCampaign && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              {t('massages.campaign')}
            </span>
          )}
          {!row.isFeatured && !row.isCampaign && (
            <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: t('massages.actions'),
      accessor: (row) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row.id);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium"
          >
            {t('massages.edit')}
          </button>
          {deleteConfirm === row.id ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.id);
                }}
                disabled={deleteMassage.isPending}
                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 font-medium disabled:opacity-50"
              >
                {t('massages.confirm')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(null);
                }}
                disabled={deleteMassage.isPending}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 font-medium disabled:opacity-50"
              >
                {t('massages.cancel')}
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm(row.id);
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 font-medium"
            >
              {t('massages.delete')}
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleDelete = async (id: string) => {
    try {
      await deleteMassage.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete massage:', error);
      alert(t('massages.deleteError'));
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/admin/massages/${id}/edit`);
  };

  const handleCreate = () => {
    navigate('/admin/massages/new');
  };

  const handleMoveUp = async (massage: Massage, index: number) => {
    if (index === 0 || !massages) return;

    const sortedMassages = [...massages].sort((a, b) => a.sortOrder - b.sortOrder);
    const prevMassage = sortedMassages[index - 1];

    try {
      // Swap sort orders - backend expects snake_case
      await Promise.all([
        updateMassage.mutateAsync({
          id: massage.id,
          data: { sort_order: prevMassage.sortOrder } as any,
        }),
        updateMassage.mutateAsync({
          id: prevMassage.id,
          data: { sort_order: massage.sortOrder } as any,
        }),
      ]);
    } catch (error) {
      console.error('Failed to reorder massages:', error);
      alert(t('massages.reorderError'));
    }
  };

  const handleMoveDown = async (massage: Massage, index: number) => {
    if (!massages) return;

    const sortedMassages = [...massages].sort((a, b) => a.sortOrder - b.sortOrder);
    if (index === sortedMassages.length - 1) return;

    const nextMassage = sortedMassages[index + 1];

    try {
      // Swap sort orders - backend expects snake_case
      await Promise.all([
        updateMassage.mutateAsync({
          id: massage.id,
          data: { sort_order: nextMassage.sortOrder } as any,
        }),
        updateMassage.mutateAsync({
          id: nextMassage.id,
          data: { sort_order: massage.sortOrder } as any,
        }),
      ]);
    } catch (error) {
      console.error('Failed to reorder massages:', error);
      alert(t('massages.reorderError'));
    }
  };

  const handleApplyBulkLayout = async () => {
    if (!massages || massages.length === 0) return;
    setApplyingBulk(true);
    try {
      const toSnake = (massage: Massage) => ({
        name: massage.name,
        short_description: massage.shortDescription,
        long_description: massage.longDescription || undefined,
        duration: massage.duration || undefined,
        media_type: massage.mediaType || undefined,
        media_url: massage.mediaUrl || undefined,
        purpose_tags: massage.purposeTags || [],
        sessions: massage.sessions || [],
        is_featured: massage.isFeatured,
        is_campaign: massage.isCampaign,
        sort_order: massage.sortOrder,
        layout_template: bulkLayout,
      });

      await Promise.all(
        massages.map((massage) =>
          updateMassage.mutateAsync({
            id: massage.id,
            data: toSnake(massage) as any,
          })
        )
      );
    } catch (bulkError) {
      console.error('Failed to apply bulk layout:', bulkError);
      alert(t('massages.reorderError'));
    } finally {
      setApplyingBulk(false);
    }
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{t('massages.loadError')}</p>
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('massages.title')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage massage services and their display settings
            </p>
          </div>
          <button
            onClick={handleCreate}
            aria-label={t('aria.addMassage')}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('massages.addNew')}
          </button>
        </div>

        {/* Filters and View Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>

            {/* Layout Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('massages.layoutTemplate')}
              </label>
              <select
                value={layoutFilter}
                onChange={(e) => setLayoutFilter(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="all">All Layouts</option>
                <option value="price-list">{t('massages.layoutOptionPriceList')}</option>
                <option value="info-tags">{t('massages.layoutOptionInfoTags')}</option>
                <option value="media-focus">{t('massages.layoutOptionMediaFocus')}</option>
                <option value="immersive-showcase">{t('massages.layoutOptionImmersive')}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('massages.statusFilter')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="all">{t('massages.allStatus')}</option>
                <option value="featured">{t('massages.featuredOnly')}</option>
                <option value="campaign">{t('massages.campaignOnly')}</option>
              </select>
            </div>

            {/* Bulk Layout Changer */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('massages.bulkLayoutChange')}
              </label>
              <div className="flex gap-2">
                <select
                  value={bulkLayout}
                  onChange={(e) => setBulkLayout(e.target.value as Massage['layoutTemplate'])}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  <option value="price-list">{t('massages.layoutOptionPriceList')}</option>
                  <option value="info-tags">{t('massages.layoutOptionInfoTags')}</option>
                  <option value="media-focus">{t('massages.layoutOptionMediaFocus')}</option>
                  <option value="immersive-showcase">{t('massages.layoutOptionImmersive')}</option>
                </select>
                <button
                  onClick={handleApplyBulkLayout}
                  disabled={applyingBulk || updateMassage.isPending}
                  className="px-3 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {applyingBulk ? t('massages.loading') : t('massages.apply')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <DataTable
            data={filteredMassages}
            columns={columns}
            pageSize={10}
            searchable={true}
            searchPlaceholder={t('massages.searchPlaceholder')}
            emptyMessage={t('massages.noMassages')}
            isLoading={isLoading}
            onRowClick={(massage) => handleEdit(massage.id)}
          />
        )}

        {/* Card View */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </div>
              ))
            ) : filteredMassages.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t('massages.noMassages')}
                  </h3>
                </div>
              </div>
            ) : (
              filteredMassages.map((massage, index) => (
                <div
                  key={massage.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleEdit(massage.id)}
                >
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                        {massage.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {massage.shortDescription}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">
                      #{massage.sortOrder}
                    </span>
                  </div>

                  {/* Media Preview */}
                  {massage.mediaUrl && (
                    <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                      {massage.mediaType === 'photo' ? (
                        <img
                          src={massage.mediaUrl}
                          alt={massage.name}
                          className="w-full h-32 object-cover"
                        />
                      ) : massage.mediaType === 'video' ? (
                        <video
                          src={massage.mediaUrl}
                          className="w-full h-32 object-cover"
                          muted
                        />
                      ) : null}
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                      {massage.mediaType || t('massages.noMedia')}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                      {massage.layoutTemplate === 'info-tags'
                        ? t('massages.layoutOptionInfoTags')
                        : massage.layoutTemplate === 'media-focus'
                          ? t('massages.layoutOptionMediaFocus')
                          : massage.layoutTemplate === 'immersive-showcase'
                            ? t('massages.layoutOptionImmersive')
                            : t('massages.layoutOptionPriceList')}
                    </span>
                    {massage.isFeatured && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                        {t('massages.featured')}
                      </span>
                    )}
                    {massage.isCampaign && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                        {t('massages.campaign')}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(massage, index);
                      }}
                      disabled={index === 0 || updateMassage.isPending}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={t('massages.moveUp')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(massage, index);
                      }}
                      disabled={index === filteredMassages.length - 1 || updateMassage.isPending}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={t('massages.moveDown')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="flex-1"></div>
                    {deleteConfirm === massage.id ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(massage.id);
                          }}
                          disabled={deleteMassage.isPending}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {t('massages.confirm')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(null);
                          }}
                          disabled={deleteMassage.isPending}
                          className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                          {t('massages.cancel')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(massage.id);
                        }}
                        className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                      >
                        {t('massages.delete')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
