import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';

interface RewardTier {
  id: number;
  name: string;
  nameTr: string;
  couponsRequired: number;
  description: string;
  descriptionTr: string;
  isActive: boolean;
  sortOrder: number;
}

interface PolicyData {
  defaultRedemptionThreshold: number;
  tokenExpirationHours: number;
  maxCouponsPerDay: number;
  rewardTiers: RewardTier[];
}

export default function CouponSettingsPage() {
  const queryClient = useQueryClient();
  
  // Form state
  const [threshold, setThreshold] = useState(4);
  const [expirationHours, setExpirationHours] = useState(24);
  const [maxPerDay, setMaxPerDay] = useState(10);
  
  // Tier form state
  const [editingTier, setEditingTier] = useState<RewardTier | null>(null);
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState({
    name: '',
    nameTr: '',
    couponsRequired: 4,
    description: '',
    descriptionTr: '',
    isActive: true,
    sortOrder: 0,
  });

  // Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch policy
  const { data: policy, isLoading } = useQuery<PolicyData>({
    queryKey: ['couponPolicy'],
    queryFn: async () => {
      const res = await fetch('/api/admin/policy', { credentials: 'include' });
      if (!res.ok) throw new Error('Politika yüklenemedi');
      return res.json();
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: { defaultRedemptionThreshold?: number; tokenExpirationHours?: number; maxCouponsPerDay?: number }) => {
      const res = await fetch('/api/admin/policy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Güncelleme başarısız');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couponPolicy'] });
      setSuccessMsg('Ayarlar kaydedildi');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  // Create tier mutation
  const createTier = useMutation({
    mutationFn: async (data: typeof tierForm) => {
      const res = await fetch('/api/admin/policy/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Oluşturma başarısız');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couponPolicy'] });
      setShowTierForm(false);
      resetTierForm();
      setSuccessMsg('Ödül seviyesi oluşturuldu');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  // Update tier mutation
  const updateTier = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof tierForm> }) => {
      const res = await fetch(`/api/admin/policy/tiers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Güncelleme başarısız');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couponPolicy'] });
      setEditingTier(null);
      setShowTierForm(false);
      resetTierForm();
      setSuccessMsg('Ödül seviyesi güncellendi');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  // Delete tier mutation
  const deleteTier = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/policy/tiers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Silme başarısız');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couponPolicy'] });
      setSuccessMsg('Ödül seviyesi silindi');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  // Initialize form with policy data
  useEffect(() => {
    if (policy) {
      setThreshold(policy.defaultRedemptionThreshold);
      setExpirationHours(policy.tokenExpirationHours);
      setMaxPerDay(policy.maxCouponsPerDay);
    }
  }, [policy]);

  const resetTierForm = () => {
    setTierForm({
      name: '',
      nameTr: '',
      couponsRequired: 4,
      description: '',
      descriptionTr: '',
      isActive: true,
      sortOrder: 0,
    });
  };

  const handleEditTier = (tier: RewardTier) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      nameTr: tier.nameTr,
      couponsRequired: tier.couponsRequired,
      description: tier.description,
      descriptionTr: tier.descriptionTr,
      isActive: tier.isActive,
      sortOrder: tier.sortOrder,
    });
    setShowTierForm(true);
  };

  const handleSaveSettings = () => {
    updateSettings.mutate({
      defaultRedemptionThreshold: threshold,
      tokenExpirationHours: expirationHours,
      maxCouponsPerDay: maxPerDay,
    });
  };

  const handleSaveTier = () => {
    if (editingTier) {
      updateTier.mutate({ id: editingTier.id, data: tierForm });
    } else {
      createTier.mutate(tierForm);
    }
  };

  const handleDeleteTier = (id: number) => {
    if (window.confirm('Bu ödül seviyesini silmek istediğinizden emin misiniz?')) {
      deleteTier.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Yükleniyor...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kupon Ayarları</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Kupon sistemi kurallarını ve ödül seviyelerini yönetin
          </p>
        </div>

        {/* Messages */}
        {successMsg && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-200">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{errorMsg}</p>
          </div>
        )}

        {/* General Settings Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Genel Ayarlar</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kupon sistemi temel kuralları</p>
          </div>
          <div className="p-6 space-y-6">
            {/* Default Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Varsayılan Kupon Eşiği
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
                  min={1}
                  max={100}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">kupon = 1 ödül</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Müşterinin ödül kazanması için gereken minimum kupon sayısı
              </p>
            </div>

            {/* Token Expiration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Geçerlilik Süresi
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={expirationHours}
                  onChange={(e) => setExpirationHours(parseInt(e.target.value) || 1)}
                  min={1}
                  max={168}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">saat</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Oluşturulan kupon kodlarının geçerlilik süresi (1-168 saat)
              </p>
            </div>

            {/* Max Per Day */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Günlük Kupon Limiti
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={maxPerDay}
                  onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 1)}
                  min={1}
                  max={50}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">kupon/gün</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Bir müşterinin günde kazanabileceği maksimum kupon sayısı
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSaveSettings}
                disabled={updateSettings.isPending}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateSettings.isPending ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
              </button>
            </div>
          </div>
        </div>

        {/* Reward Tiers Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ödül Seviyeleri</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Farklı kupon sayıları için ödül seçenekleri</p>
            </div>
            <button
              onClick={() => { resetTierForm(); setEditingTier(null); setShowTierForm(true); }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Yeni Seviye
            </button>
          </div>
          <div className="p-6">
            {/* Tiers List */}
            <div className="space-y-3">
              {policy?.rewardTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`p-4 rounded-lg border ${tier.isActive ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50' : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-60'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                        <span className="text-lg font-bold text-sky-600 dark:text-sky-400">{tier.couponsRequired}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{tier.nameTr}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{tier.descriptionTr || tier.description}</p>
                        {!tier.isActive && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                            Pasif
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTier(tier)}
                        className="p-2 text-gray-500 hover:text-sky-600 dark:text-gray-400 dark:hover:text-sky-400 transition-colors"
                        title="Düzenle"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteTier(tier.id)}
                        className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                        title="Sil"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(!policy?.rewardTiers || policy.rewardTiers.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Henüz ödül seviyesi tanımlanmamış
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tier Form Modal */}
        {showTierForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {editingTier ? 'Ödül Seviyesi Düzenle' : 'Yeni Ödül Seviyesi'}
                </h3>
                <button
                  onClick={() => { setShowTierForm(false); setEditingTier(null); }}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Türkçe Ad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tierForm.nameTr}
                    onChange={(e) => setTierForm({ ...tierForm, nameTr: e.target.value })}
                    placeholder="Ücretsiz Masaj"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    İngilizce Ad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tierForm.name}
                    onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                    placeholder="Free Massage"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gereken Kupon Sayısı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={tierForm.couponsRequired}
                    onChange={(e) => setTierForm({ ...tierForm, couponsRequired: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Türkçe Açıklama
                  </label>
                  <textarea
                    value={tierForm.descriptionTr}
                    onChange={(e) => setTierForm({ ...tierForm, descriptionTr: e.target.value })}
                    placeholder="4 kupon karşılığında ücretsiz masaj"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    İngilizce Açıklama
                  </label>
                  <textarea
                    value={tierForm.description}
                    onChange={(e) => setTierForm({ ...tierForm, description: e.target.value })}
                    placeholder="Redeem 4 coupons for a free massage"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tierActive"
                    checked={tierForm.isActive}
                    onChange={(e) => setTierForm({ ...tierForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                  />
                  <label htmlFor="tierActive" className="text-sm text-gray-700 dark:text-gray-300">
                    Aktif
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => { setShowTierForm(false); setEditingTier(null); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTier}
                  disabled={createTier.isPending || updateTier.isPending || !tierForm.name || !tierForm.nameTr}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(createTier.isPending || updateTier.isPending) ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
