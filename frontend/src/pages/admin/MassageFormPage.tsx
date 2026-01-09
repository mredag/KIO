import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../layouts/AdminLayout';
import {
  useMassages,
  useCreateMassage,
  useUpdateMassage,
} from '../../hooks/useAdminApi';
import { Session } from '../../types';
import api from '../../lib/api';

const PURPOSE_TAGS = [
  'Rahatlama',
  'Stres Azaltma',
  'Enerji Dengeleme',
  'Kas Gevşetme',
  'Kan Dolaşımı',
  'Ağrı Azaltma',
  'Aromaterapi',
  'Uyku Kalitesi',
  'Derin Terapi',
  'Kronik Ağrı',
  'Kas Düğümleri',
  'Refleksoloji',
  'Enerji Akışı',
  'Organ Desteği',
  'Hamam',
  'Cilt Bakımı',
  'Temizlik',
  'Premium',
  'Karma Teknik',
  'Tam Rahatlama',
  'Medikal',
  'Bölgesel Tedavi',
  'Ağrı Yönetimi',
  'Sıcak Taş',
  'Enerji Noktaları',
  'Terapötik',
  'Kapsamlı Bakım',
  'Detoks',
  'Esneklik',
  'Spor Sonrası İyileşme',
];

interface FormData {
  name: string;
  shortDescription: string;
  longDescription: string;
  duration: string;
  mediaType: 'video' | 'photo' | '';
  mediaUrl: string;
  purposeTags: string[];
  sessions: Session[];
  isFeatured: boolean;
  isCampaign: boolean;
  layoutTemplate: 'price-list' | 'info-tags' | 'media-focus' | 'immersive-showcase';
  sortOrder: number;
}

interface ValidationErrors {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  sessions?: string;
  mediaFile?: string;
}

export default function MassageFormPage() {
  const { t } = useTranslation('admin');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = id !== 'new';

  const { data: massages } = useMassages();
  const createMassage = useCreateMassage();
  const updateMassage = useUpdateMassage();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    shortDescription: '',
    longDescription: '',
    duration: '',
    mediaType: '',
    mediaUrl: '',
    purposeTags: [],
    sessions: [{ name: '', price: 0 }],
    isFeatured: false,
    isCampaign: false,
    layoutTemplate: 'price-list',
    sortOrder: 0,
  });

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load existing massage data in edit mode
  useEffect(() => {
    if (isEditMode && massages) {
      const massage = massages.find((m) => m.id === id);
      if (massage) {
        setFormData({
          name: massage.name,
          shortDescription: massage.shortDescription,
          longDescription: massage.longDescription || '',
          duration: massage.duration || '',
          mediaType: massage.mediaType || '',
          mediaUrl: massage.mediaUrl || '',
          purposeTags: massage.purposeTags || [],
          sessions: massage.sessions.length > 0 ? massage.sessions : [{ name: '', price: 0 }],
          isFeatured: massage.isFeatured,
          isCampaign: massage.isCampaign,
          layoutTemplate: massage.layoutTemplate || 'price-list',
          sortOrder: massage.sortOrder,
        });
      }
    }
  }, [isEditMode, id, massages]);

  // Track unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Mark as having unsaved changes when form data changes
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Name validation (1-100 characters)
    if (!formData.name.trim()) {
      newErrors.name = 'Masaj adı zorunludur';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Masaj adı 100 karakteri geçemez';
    }

    // Short description validation (1-200 characters)
    if (!formData.shortDescription.trim()) {
      newErrors.shortDescription = 'Kısa açıklama zorunludur';
    } else if (formData.shortDescription.length > 200) {
      newErrors.shortDescription = 'Kısa açıklama 200 karakteri geçemez';
    }

    // Long description validation (max 2000 characters)
    if (formData.longDescription && formData.longDescription.length > 2000) {
      newErrors.longDescription = 'Detaylı açıklama 2000 karakteri geçemez';
    }

    // Sessions validation
    if (formData.sessions.length === 0) {
      newErrors.sessions = 'En az bir seans gereklidir';
    } else {
      const hasInvalidSession = formData.sessions.some(
        (s) => !s.name.trim() || s.price <= 0
      );
      if (hasInvalidSession) {
        newErrors.sessions = 'Tüm seansların adı ve pozitif fiyatı olmalıdır';
      }
    }

    // Media file validation
    if (mediaFile) {
      const maxVideoSize = 50 * 1024 * 1024; // 50MB
      const maxImageSize = 5 * 1024 * 1024; // 5MB

      if (mediaFile.type.startsWith('video/')) {
        if (!mediaFile.type.includes('mp4')) {
          newErrors.mediaFile = 'Sadece MP4 video formatı desteklenmektedir';
        } else if (mediaFile.size > maxVideoSize) {
          newErrors.mediaFile = 'Video dosyası 50MB\'ı geçemez';
        }
      } else if (mediaFile.type.startsWith('image/')) {
        if (!['image/jpeg', 'image/png'].includes(mediaFile.type)) {
          newErrors.mediaFile = 'Sadece JPEG ve PNG görsel formatları desteklenmektedir';
        } else if (mediaFile.size > maxImageSize) {
          newErrors.mediaFile = 'Görsel dosyası 5MB\'ı geçemez';
        }
      } else {
        newErrors.mediaFile = 'Sadece video (MP4) ve görsel (JPEG, PNG) dosyaları desteklenmektedir';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMediaUpload = async (): Promise<string | null> => {
    if (!mediaFile) return formData.mediaUrl || null;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('media', mediaFile);

      const response = await api.post('/admin/upload', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.url;
    } catch (error) {
      console.error('Media upload failed:', error);
      throw new Error('Failed to upload media file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    try {
      // Upload media if new file selected
      let mediaUrl = formData.mediaUrl;
      if (mediaFile) {
        const uploadedUrl = await handleMediaUpload();
        if (!uploadedUrl) {
          setSubmitError('Medya dosyası yüklenemedi');
          return;
        }
        mediaUrl = uploadedUrl;
      }

      const submitData = {
        name: formData.name.trim(),
        short_description: formData.shortDescription.trim(),
        long_description: formData.longDescription.trim() || undefined,
        duration: formData.duration.trim() || undefined,
        media_type: formData.mediaType || undefined,
        media_url: mediaUrl || undefined,
        purpose_tags: formData.purposeTags,
        sessions: formData.sessions,
        is_featured: formData.isFeatured,
        is_campaign: formData.isCampaign,
        layout_template: formData.layoutTemplate,
        sort_order: formData.sortOrder,
      };

      if (isEditMode) {
        await updateMassage.mutateAsync({ id: id!, data: submitData as any });
      } else {
        await createMassage.mutateAsync(submitData as any);
      }

      // Show success message
      setShowSuccess(true);
      setSubmitError('');
      setHasUnsavedChanges(false);
      
      // Navigate after brief delay to show success feedback
      setTimeout(() => {
        navigate('/admin/massages');
      }, 1000);
    } catch (error: any) {
      console.error('Failed to save massage:', error);
      setSubmitError(
        error.response?.data?.error || 'Masaj kaydedilemedi. Lütfen tekrar deneyin.'
      );
      setShowSuccess(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/massages');
  };

  const handleAddSession = () => {
    updateFormData({
      sessions: [...formData.sessions, { name: '', price: 0 }],
    });
  };

  const handleRemoveSession = (index: number) => {
    if (formData.sessions.length > 1) {
      updateFormData({
        sessions: formData.sessions.filter((_, i) => i !== index),
      });
    }
  };

  const handleSessionChange = (index: number, field: 'name' | 'price', value: string | number) => {
    const newSessions = [...formData.sessions];
    newSessions[index] = {
      ...newSessions[index],
      [field]: value,
    };
    updateFormData({ sessions: newSessions });
  };

  const handleTagToggle = (tag: string) => {
    if (formData.purposeTags.includes(tag)) {
      updateFormData({
        purposeTags: formData.purposeTags.filter((t) => t !== tag),
      });
    } else {
      updateFormData({
        purposeTags: [...formData.purposeTags, tag],
      });
    }
  };

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      // Determine media type from file
      if (file.type.startsWith('video/')) {
        updateFormData({ mediaType: 'video' });
      } else if (file.type.startsWith('image/')) {
        updateFormData({ mediaType: 'photo' });
      }
    }
  };

  const isSubmitting = createMassage.isPending || updateMassage.isPending || uploading;

  // Preview Card Component
  const PreviewCard = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Live Preview</h3>
      
      <div className="space-y-4">
        {/* Preview Header */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
            {formData.name || 'Massage Name'}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {formData.shortDescription || 'Short description will appear here...'}
          </p>
        </div>

        {/* Media Preview */}
        {(formData.mediaUrl || mediaFile) && (
          <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            {mediaFile ? (
              mediaFile.type.startsWith('video/') ? (
                <video
                  src={URL.createObjectURL(mediaFile)}
                  className="w-full h-40 object-cover"
                  muted
                  loop
                  autoPlay
                />
              ) : (
                <img
                  src={URL.createObjectURL(mediaFile)}
                  alt="Preview"
                  className="w-full h-40 object-cover"
                />
              )
            ) : formData.mediaType === 'photo' ? (
              <img
                src={formData.mediaUrl}
                alt={formData.name}
                className="w-full h-40 object-cover"
              />
            ) : formData.mediaType === 'video' ? (
              <video
                src={formData.mediaUrl}
                className="w-full h-40 object-cover"
                muted
              />
            ) : null}
          </div>
        )}

        {/* Layout Badge */}
        <div>
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
            {formData.layoutTemplate === 'info-tags'
              ? t('massages.layoutOptionInfoTags')
              : formData.layoutTemplate === 'media-focus'
                ? t('massages.layoutOptionMediaFocus')
                : formData.layoutTemplate === 'immersive-showcase'
                  ? t('massages.layoutOptionImmersive')
                  : t('massages.layoutOptionPriceList')}
          </span>
        </div>

        {/* Purpose Tags */}
        {formData.purposeTags.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Purpose Tags:</p>
            <div className="flex flex-wrap gap-1">
              {formData.purposeTags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
              {formData.purposeTags.length > 5 && (
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  +{formData.purposeTags.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sessions */}
        {formData.sessions.length > 0 && formData.sessions[0].name && (
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Sessions:</p>
            <div className="space-y-2">
              {formData.sessions.map((session, idx) => (
                session.name && (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{session.name}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      ₺{session.price.toFixed(2)}
                    </span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {/* Flags */}
        <div className="flex gap-2">
          {formData.isFeatured && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
              Featured
            </span>
          )}
          {formData.isCampaign && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              Campaign
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Masajı Düzenle' : 'Yeni Masaj Oluştur'}
          </h2>
          {hasUnsavedChanges && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              You have unsaved changes
            </p>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
              {submitError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-300">{submitError}</p>
                </div>
              )}

              {/* Section: Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Basic Information</h3>
                
                {/* Name */}
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Masaj Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={100}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formData.name.length}/100 karakter</p>
                </div>

                {/* Short Description */}
                <div className="mb-4">
                  <label
                    htmlFor="shortDescription"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Kısa Açıklama <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) => updateFormData({ shortDescription: e.target.value })}
                    rows={2}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent ${
                      errors.shortDescription ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={200}
                  />
                  {errors.shortDescription && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.shortDescription}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formData.shortDescription.length}/200 karakter
                  </p>
                </div>

                {/* Duration */}
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Süre
                  </label>
                  <input
                    type="text"
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => updateFormData({ duration: e.target.value })}
                    placeholder={t('massages.durationPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Section: Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Description</h3>
                
                <div>
                  <label
                    htmlFor="longDescription"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Detaylı Açıklama
                  </label>
                  <textarea
                    id="longDescription"
                    value={formData.longDescription}
                    onChange={(e) => updateFormData({ longDescription: e.target.value })}
                    rows={6}
                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent ${
                      errors.longDescription ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={2000}
                  />
                  {errors.longDescription && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.longDescription}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formData.longDescription.length}/2000 karakter
                  </p>
                </div>
              </div>

              {/* Section: Sessions & Pricing */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Sessions & Pricing <span className="text-red-500">*</span>
                </h3>
                
                <div className="space-y-3">
                  {formData.sessions.map((session, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={session.name}
                          onChange={(e) => handleSessionChange(index, 'name', e.target.value)}
                          placeholder={t('massages.sessionNamePlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                      </div>
                      <div className="w-32 relative">
                        <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">₺</span>
                        <input
                          type="number"
                          value={session.price}
                          onChange={(e) =>
                            handleSessionChange(index, 'price', parseFloat(e.target.value) || 0)
                          }
                          placeholder={t('massages.sessionPricePlaceholder')}
                          min="0"
                          step="0.01"
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                      </div>
                      {formData.sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSession(index)}
                          className="px-3 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.sessions && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sessions}</p>}
                <button
                  type="button"
                  onClick={handleAddSession}
                  className="mt-3 px-4 py-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-medium"
                >
                  + Seans Ekle
                </button>
              </div>

              {/* Section: Purpose Tags */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Purpose Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {PURPOSE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        formData.purposeTags.includes(tag)
                          ? 'bg-sky-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section: Flags */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Display Options</h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isFeatured"
                      checked={formData.isFeatured}
                      onChange={(e) => updateFormData({ isFeatured: e.target.checked })}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <label htmlFor="isFeatured" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Öne Çıkan (vurgulanan bölümde görünür)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isCampaign"
                      checked={formData.isCampaign}
                      onChange={(e) => updateFormData({ isCampaign: e.target.checked })}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <label htmlFor="isCampaign" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Kampanya (slayt gösterisinde görünür)
                    </label>
                  </div>
                </div>
              </div>

              {/* Section: Sort Order */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Sort Order</h3>
                <div>
                  <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sıralama
                  </label>
                  <input
                    type="number"
                    id="sortOrder"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      updateFormData({ sortOrder: parseInt(e.target.value) || 0 })
                    }
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Düşük sayılar listede önce görünür
                  </p>
                </div>
              </div>

              {/* Success Message */}
              {showSuccess && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      {isEditMode ? 'Masaj başarıyla güncellendi!' : 'Masaj başarıyla oluşturuldu!'}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={isSubmitting || showSuccess}
                  className="flex-1 md:flex-none px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showSuccess ? (
                    <span className="flex items-center justify-center">
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Kaydedildi!
                    </span>
                  ) : isSubmitting ? (
                    uploading ? 'Yükleniyor...' : 'Kaydediliyor...'
                  ) : isEditMode ? (
                    'Masajı Güncelle'
                  ) : (
                    'Masaj Oluştur'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting || showSuccess}
                  className="flex-1 md:flex-none px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>

          {/* Right Column - Media, Preview, Layout */}
          <div className="space-y-6">
            {/* Media Upload Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Media Upload</h3>
              <div>
                <label htmlFor="media" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video or Photo
                </label>
                <input
                  type="file"
                  id="media"
                  accept="video/mp4,image/jpeg,image/png"
                  onChange={handleMediaFileChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                {errors.mediaFile && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.mediaFile}</p>}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Supported: MP4 (max 50MB), JPEG/PNG (max 5MB)
                </p>
                {formData.mediaUrl && !mediaFile && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Current: <span className="font-medium">{formData.mediaUrl.split('/').pop()}</span>
                  </p>
                )}
                {mediaFile && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    New file: <span className="font-medium">{mediaFile.name}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Preview Card */}
            <PreviewCard />

            {/* Layout Template Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('massages.layoutTemplate')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('massages.layoutTemplateHelp')}</p>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => updateFormData({ layoutTemplate: 'price-list' })}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    formData.layoutTemplate === 'price-list'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('massages.layoutOptionPriceList')}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {t('massages.layoutOptionPriceListDescription')}
                      </p>
                    </div>
                    {formData.layoutTemplate === 'price-list' && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ layoutTemplate: 'info-tags' })}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    formData.layoutTemplate === 'info-tags'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('massages.layoutOptionInfoTags')}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {t('massages.layoutOptionInfoTagsDescription')}
                      </p>
                    </div>
                    {formData.layoutTemplate === 'info-tags' && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ layoutTemplate: 'media-focus' })}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    formData.layoutTemplate === 'media-focus'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('massages.layoutOptionMediaFocus')}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {t('massages.layoutOptionMediaFocusDescription')}
                      </p>
                    </div>
                    {formData.layoutTemplate === 'media-focus' && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData({ layoutTemplate: 'immersive-showcase' })}
                  className={`w-full text-left border rounded-lg p-3 transition-colors ${
                    formData.layoutTemplate === 'immersive-showcase'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('massages.layoutOptionImmersive')}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {t('massages.layoutOptionImmersiveDescription')}
                      </p>
                    </div>
                    {formData.layoutTemplate === 'immersive-showcase' && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white text-xs">
                        ✓
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
