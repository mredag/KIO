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
    sortOrder: 0,
  });

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

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
          sortOrder: massage.sortOrder,
        });
      }
    }
  }, [isEditMode, id, massages]);

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
    setFormData({
      ...formData,
      sessions: [...formData.sessions, { name: '', price: 0 }],
    });
  };

  const handleRemoveSession = (index: number) => {
    if (formData.sessions.length > 1) {
      setFormData({
        ...formData,
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
    setFormData({ ...formData, sessions: newSessions });
  };

  const handleTagToggle = (tag: string) => {
    if (formData.purposeTags.includes(tag)) {
      setFormData({
        ...formData,
        purposeTags: formData.purposeTags.filter((t) => t !== tag),
      });
    } else {
      setFormData({
        ...formData,
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
        setFormData({ ...formData, mediaType: 'video' });
      } else if (file.type.startsWith('image/')) {
        setFormData({ ...formData, mediaType: 'photo' });
      }
    }
  };

  const isSubmitting = createMassage.isPending || updateMassage.isPending || uploading;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Masajı Düzenle' : 'Yeni Masaj Oluştur'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{submitError}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Masaj Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={100}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            <p className="mt-1 text-sm text-gray-500">{formData.name.length}/100 karakter</p>
          </div>

          {/* Short Description */}
          <div>
            <label
              htmlFor="shortDescription"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Kısa Açıklama <span className="text-red-500">*</span>
            </label>
            <textarea
              id="shortDescription"
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              rows={2}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.shortDescription ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={200}
            />
            {errors.shortDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.shortDescription}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {formData.shortDescription.length}/200 karakter
            </p>
          </div>

          {/* Long Description */}
          <div>
            <label
              htmlFor="longDescription"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Detaylı Açıklama
            </label>
            <textarea
              id="longDescription"
              value={formData.longDescription}
              onChange={(e) => setFormData({ ...formData, longDescription: e.target.value })}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.longDescription ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={2000}
            />
            {errors.longDescription && (
              <p className="mt-1 text-sm text-red-600">{errors.longDescription}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {formData.longDescription.length}/2000 karakter
            </p>
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Süre
            </label>
            <input
              type="text"
              id="duration"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder={t('massages.durationPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Media Upload */}
          <div>
            <label htmlFor="media" className="block text-sm font-medium text-gray-700 mb-1">
              Medya (Video veya Fotoğraf)
            </label>
            <input
              type="file"
              id="media"
              accept="video/mp4,image/jpeg,image/png"
              onChange={handleMediaFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {errors.mediaFile && <p className="mt-1 text-sm text-red-600">{errors.mediaFile}</p>}
            <p className="mt-1 text-sm text-gray-500">
              Desteklenen formatlar: MP4 (maks 50MB), JPEG/PNG (maks 5MB)
            </p>
            {formData.mediaUrl && !mediaFile && (
              <p className="mt-2 text-sm text-gray-600">
                Mevcut medya: <span className="font-medium">{formData.mediaUrl}</span>
              </p>
            )}
            {mediaFile && (
              <p className="mt-2 text-sm text-green-600">
                Yeni dosya seçildi: <span className="font-medium">{mediaFile.name}</span>
              </p>
            )}
          </div>

          {/* Purpose Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('massages.purposeTags')}</label>
            <div className="flex flex-wrap gap-2">
              {PURPOSE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors touch-target ${
                    formData.purposeTags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Sessions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seanslar <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {formData.sessions.map((session, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={session.name}
                      onChange={(e) => handleSessionChange(index, 'name', e.target.value)}
                      placeholder={t('massages.sessionNamePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="w-32 relative">
                    <span className="absolute left-3 top-2 text-gray-500">₺</span>
                    <input
                      type="number"
                      value={session.price}
                      onChange={(e) =>
                        handleSessionChange(index, 'price', parseFloat(e.target.value) || 0)
                      }
                      placeholder={t('massages.sessionPricePlaceholder')}
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {formData.sessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSession(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 touch-target"
                    >
                      Kaldır
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.sessions && <p className="mt-1 text-sm text-red-600">{errors.sessions}</p>}
            <button
              type="button"
              onClick={handleAddSession}
              className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Seans Ekle
            </button>
          </div>

          {/* Flags */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isFeatured"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isFeatured" className="ml-2 text-sm text-gray-700">
                Öne Çıkan (vurgulanan bölümde görünür)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isCampaign"
                checked={formData.isCampaign}
                onChange={(e) => setFormData({ ...formData, isCampaign: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isCampaign" className="ml-2 text-sm text-gray-700">
                Kampanya (slayt gösterisinde görünür)
              </label>
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label htmlFor="sortOrder" className="block text-sm font-medium text-gray-700 mb-1">
              Sıralama
            </label>
            <input
              type="number"
              id="sortOrder"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
              }
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Düşük sayılar listede önce görünür
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="rounded-lg bg-green-50 p-4 border border-green-200">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-green-800">
                  {isEditMode ? 'Masaj başarıyla güncellendi!' : 'Masaj başarıyla oluşturuldu!'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={isSubmitting || showSuccess}
              className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
              className="flex-1 md:flex-none px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all duration-200 touch-target font-medium disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              İptal
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
