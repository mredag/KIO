import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useKnowledgeBase,
  useCreateKnowledgeEntry,
  useUpdateKnowledgeEntry,
  useDeleteKnowledgeEntry,
} from '../../hooks/useAdminApi';
import { formatDateTime } from '../../lib/dateFormatter';

interface KnowledgeEntry {
  id: string;
  category: string;
  keyName: string;
  value: string;
  description?: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

type Category = 'services' | 'pricing' | 'hours' | 'policies' | 'contact' | 'general';

const CATEGORIES: Category[] = ['services', 'pricing', 'hours', 'policies', 'contact', 'general'];

export default function KnowledgeBasePage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: entries, isLoading, error } = useKnowledgeBase();
  const createMutation = useCreateKnowledgeEntry();
  const updateMutation = useUpdateKnowledgeEntry();
  const deleteMutation = useDeleteKnowledgeEntry();
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'general' as Category,
    keyName: '',
    value: '',
    description: '',
    isActive: true,
  });
  
  // Group entries by category
  const entriesByCategory = useMemo(() => {
    if (!entries) return {};
    
    const grouped: Record<string, KnowledgeEntry[]> = {};
    CATEGORIES.forEach(cat => {
      grouped[cat] = [];
    });
    
    entries.forEach((entry: KnowledgeEntry) => {
      if (grouped[entry.category]) {
        grouped[entry.category].push(entry);
      }
    });
    
    return grouped;
  }, [entries]);
  
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };
  
  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(formData);
      setShowCreateForm(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create entry:', error);
      alert(t('admin:knowledgeBase.createError'));
    }
  };
  
  const handleUpdate = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: formData });
      setEditingEntry(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update entry:', error);
      alert(t('admin:knowledgeBase.updateError'));
    }
  };
  
  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete entry:', error);
      alert(t('admin:knowledgeBase.deleteError'));
    }
  };
  
  const startEdit = (entry: KnowledgeEntry) => {
    setFormData({
      category: entry.category as Category,
      keyName: entry.keyName,
      value: entry.value,
      description: entry.description || '',
      isActive: entry.isActive,
    });
    setEditingEntry(entry.id);
  };
  
  const cancelEdit = () => {
    setEditingEntry(null);
    setShowCreateForm(false);
    resetForm();
  };
  
  const resetForm = () => {
    setFormData({
      category: 'general',
      keyName: '',
      value: '',
      description: '',
      isActive: true,
    });
  };
  
  // Generate AI context preview
  const generatePreview = () => {
    if (!entries) return {};
    
    const context: Record<string, Record<string, string>> = {};
    entries
      .filter((e: KnowledgeEntry) => e.isActive)
      .forEach((e: KnowledgeEntry) => {
        if (!context[e.category]) {
          context[e.category] = {};
        }
        context[e.category][e.keyName] = e.value;
      });
    
    return context;
  };
  
  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{t('admin:knowledgeBase.loadError')}</p>
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
              {t('admin:knowledgeBase.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('admin:knowledgeBase.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {t('admin:knowledgeBase.viewPreview')}
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('admin:knowledgeBase.actions.addNew')}
            </button>
          </div>
        </div>
        
        {/* AI Context Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('admin:knowledgeBase.preview')}
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('admin:knowledgeBase.previewDescription')}
                </p>
                <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-sm overflow-x-auto">
                  <code className="text-gray-900 dark:text-gray-100">
                    {JSON.stringify(generatePreview(), null, 2)}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        )}
        
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('admin:knowledgeBase.actions.addNew')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:knowledgeBase.form.categoryLabel')}
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`admin:knowledgeBase.categories.${cat}`)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:knowledgeBase.form.keyLabel')}
                </label>
                <input
                  type="text"
                  value={formData.keyName}
                  onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
                  placeholder={t('admin:knowledgeBase.form.keyPlaceholder')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('admin:knowledgeBase.form.keyHelp')}
                </p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:knowledgeBase.form.valueLabel')}
                </label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={t('admin:knowledgeBase.form.valuePlaceholder')}
                  rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('admin:knowledgeBase.form.valueHelp')}
                </p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:knowledgeBase.form.descriptionLabel')}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('admin:knowledgeBase.form.descriptionPlaceholder')}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('admin:knowledgeBase.form.isActiveLabel')}
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  {t('admin:knowledgeBase.form.isActiveHelp')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.keyName || !formData.value}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium disabled:opacity-50"
              >
                {createMutation.isPending ? t('admin:knowledgeBase.actions.saving') : t('admin:knowledgeBase.actions.save')}
              </button>
              <button
                onClick={cancelEdit}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
              >
                {t('admin:knowledgeBase.actions.cancel')}
              </button>
            </div>
          </div>
        )}
        
        {/* Entries by Category */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="space-y-4">
            {CATEGORIES.map((category) => {
              const categoryEntries = entriesByCategory[category] || [];
              const isExpanded = expandedCategories.has(category);
              
              return (
                <div
                  key={category}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                          isExpanded ? 'transform rotate-90' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t(`admin:knowledgeBase.categories.${category}`)}
                      </h3>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {categoryEntries.length}
                      </span>
                    </div>
                  </button>
                  
                  {/* Category Entries */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      {categoryEntries.length === 0 ? (
                        <div className="px-6 py-8 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('admin:knowledgeBase.empty')}
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {categoryEntries.map((entry) => (
                            <div key={entry.id} className="px-6 py-4">
                              {editingEntry === entry.id ? (
                                // Edit Form
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('admin:knowledgeBase.form.keyLabel')}
                                      </label>
                                      <input
                                        type="text"
                                        value={formData.keyName}
                                        onChange={(e) => setFormData({ ...formData, keyName: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('admin:knowledgeBase.form.descriptionLabel')}
                                      </label>
                                      <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                      />
                                    </div>
                                    
                                    <div className="md:col-span-2">
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {t('admin:knowledgeBase.form.valueLabel')}
                                      </label>
                                      <textarea
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        rows={3}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                                      />
                                    </div>
                                    
                                    <div className="md:col-span-2">
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={formData.isActive}
                                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                          className="rounded border-gray-300 dark:border-gray-600 text-sky-600 focus:ring-sky-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                          {t('admin:knowledgeBase.form.isActiveLabel')}
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdate(entry.id)}
                                      disabled={updateMutation.isPending}
                                      className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                      {updateMutation.isPending ? t('admin:knowledgeBase.actions.saving') : t('admin:knowledgeBase.actions.save')}
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      disabled={updateMutation.isPending}
                                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                      {t('admin:knowledgeBase.actions.cancel')}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // Display Entry
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                                        {entry.keyName}
                                      </h4>
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        entry.isActive
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                      }`}>
                                        {entry.isActive ? t('admin:knowledgeBase.active') : t('admin:knowledgeBase.inactive')}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        v{entry.version}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-900 dark:text-gray-100 mb-1">
                                      {entry.value}
                                    </p>
                                    {entry.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {entry.description}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                                      {t('admin:knowledgeBase.lastUpdated', { date: formatDateTime(entry.updatedAt) })}
                                    </p>
                                  </div>
                                  
                                  <div className="flex gap-2 ml-4">
                                    <button
                                      onClick={() => startEdit(entry)}
                                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 text-sm font-medium"
                                    >
                                      {t('admin:knowledgeBase.actions.edit')}
                                    </button>
                                    {deleteConfirm === entry.id ? (
                                      <>
                                        <button
                                          onClick={() => handleDelete(entry.id)}
                                          disabled={deleteMutation.isPending}
                                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50"
                                        >
                                          {t('common:confirm')}
                                        </button>
                                        <button
                                          onClick={() => setDeleteConfirm(null)}
                                          disabled={deleteMutation.isPending}
                                          className="text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium disabled:opacity-50"
                                        >
                                          {t('common:cancel')}
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => setDeleteConfirm(entry.id)}
                                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                                      >
                                        {t('admin:knowledgeBase.actions.delete')}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('admin:knowledgeBase.noEntries')}
              </h3>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
