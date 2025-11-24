import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import { useMassages, useDeleteMassage, useUpdateMassage } from '../../hooks/useAdminApi';
import { Massage } from '../../types';

export default function MassagesPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { data: massages, isLoading, error } = useMassages();
  const deleteMassage = useDeleteMassage();
  const updateMassage = useUpdateMassage();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">{t('massages.loading')}</div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('massages.loadError')}</p>
        </div>
      </AdminLayout>
    );
  }

  const sortedMassages = massages ? [...massages].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('massages.title')}</h2>
          <button
            onClick={handleCreate}
            aria-label={t('aria.addMassage')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium"
          >
            {t('massages.addNew')}
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('massages.order')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('massages.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('massages.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('massages.flags')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('massages.reorder')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('massages.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedMassages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t('massages.noMassages')}
                  </td>
                </tr>
              ) : (
                sortedMassages.map((massage, index) => (
                  <tr key={massage.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {massage.sortOrder}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{massage.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {massage.shortDescription}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {massage.mediaType || t('massages.noMedia')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {massage.isFeatured && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                            {t('massages.featured')}
                          </span>
                        )}
                        {massage.isCampaign && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                            {t('massages.campaign')}
                          </span>
                        )}
                        {!massage.isFeatured && !massage.isCampaign && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleMoveUp(massage, index)}
                          disabled={index === 0 || updateMassage.isPending}
                          className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed touch-target"
                          title={t('massages.moveUp')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveDown(massage, index)}
                          disabled={index === sortedMassages.length - 1 || updateMassage.isPending}
                          className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed touch-target"
                          title={t('massages.moveDown')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(massage.id)}
                          aria-label={t('aria.editMassage', { name: massage.name })}
                          className="text-blue-600 hover:text-blue-900 touch-target"
                        >
                          {t('massages.edit')}
                        </button>
                        {deleteConfirm === massage.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(massage.id)}
                              disabled={deleteMassage.isPending}
                              className="text-red-600 hover:text-red-900 touch-target disabled:opacity-50"
                            >
                              {t('massages.confirm')}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              disabled={deleteMassage.isPending}
                              className="text-gray-600 hover:text-gray-900 touch-target disabled:opacity-50"
                            >
                              {t('massages.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(massage.id)}
                            aria-label={t('aria.deleteMassage', { name: massage.name })}
                            className="text-red-600 hover:text-red-900 touch-target"
                          >
                            {t('massages.delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {sortedMassages.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              {t('massages.noMassages')}
            </div>
          ) : (
            sortedMassages.map((massage, index) => (
              <div key={massage.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{massage.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{massage.shortDescription}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-sm text-gray-500">#{massage.sortOrder}</span>
                    <div className="flex flex-col gap-0">
                      <button
                        onClick={() => handleMoveUp(massage, index)}
                        disabled={index === 0 || updateMassage.isPending}
                        className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('massages.moveUp')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveDown(massage, index)}
                        disabled={index === sortedMassages.length - 1 || updateMassage.isPending}
                        className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('massages.moveDown')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {massage.mediaType || t('massages.noMedia')}
                  </span>
                  {massage.isFeatured && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                      {t('massages.featured')}
                    </span>
                  )}
                  {massage.isCampaign && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                      {t('massages.campaign')}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => handleEdit(massage.id)}
                    aria-label={t('aria.editMassage', { name: massage.name })}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-target font-medium"
                  >
                    {t('massages.edit')}
                  </button>
                  {deleteConfirm === massage.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(massage.id)}
                        disabled={deleteMassage.isPending}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors touch-target font-medium disabled:opacity-50"
                      >
                        {t('massages.confirm')}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        disabled={deleteMassage.isPending}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors touch-target font-medium disabled:opacity-50"
                      >
                        {t('massages.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(massage.id)}
                      aria-label={t('aria.deleteMassage', { name: massage.name })}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors touch-target font-medium"
                    >
                      {t('massages.delete')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
