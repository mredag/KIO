import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useSurveyAnalytics, useSurveyTemplates, useDeleteSurveyResponses } from '../../hooks/useAdminApi';
import { formatDate } from '../../lib/dateFormatter';

export default function SurveyAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filters = {
    ...(startDate && { startDate: new Date(startDate).toISOString() }),
    ...(endDate && { endDate: new Date(endDate).toISOString() }),
  };

  const { data: analytics, isLoading, error } = useSurveyAnalytics(id || '', filters);
  const { data: surveys } = useSurveyTemplates();
  const deleteMutation = useDeleteSurveyResponses();

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleDeleteResponses = async () => {
    if (!id) return;
    
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteConfirm(false);
      alert('Anket yanıtları başarıyla silindi');
    } catch (error) {
      alert('Yanıtlar silinirken hata oluştu');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Yükleniyor...</div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !analytics) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Anket verileri yüklenirken hata oluştu</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button
              onClick={() => navigate('/admin/surveys')}
              className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-1"
            >
              ← Anketlere Dön
            </button>
            <h2 className="text-2xl font-bold text-gray-900">{analytics.survey.title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {analytics.survey.type === 'satisfaction' ? 'Memnuniyet Anketi' : 'Keşif Anketi'}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={id}
              onChange={(e) => navigate(`/admin/surveys/${e.target.value}/analytics`)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {surveys?.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}
                </option>
              ))}
            </select>
            {analytics && analytics.totalResponses > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                🗑️ Yanıtları Sil
              </button>
            )}
          </div>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tarih Filtresi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(startDate || endDate) && (
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Filtreleri Temizle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="text-sm font-medium opacity-90">Toplam Yanıt</div>
            <div className="text-4xl font-bold mt-2">{analytics.totalResponses}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="text-sm font-medium opacity-90">Soru Sayısı</div>
            <div className="text-4xl font-bold mt-2">{analytics.questions.length}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="text-sm font-medium opacity-90">Ortalama Yanıt Oranı</div>
            <div className="text-4xl font-bold mt-2">
              {analytics.questions.length > 0
                ? (
                    analytics.questions.reduce(
                      (sum: number, q: any) => sum + parseFloat(q.responseRate),
                      0
                    ) / analytics.questions.length
                  ).toFixed(1)
                : '0.0'}
              %
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        {analytics.timeline && analytics.timeline.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Zaman Çizelgesi</h3>
            <div className="space-y-2">
              {analytics.timeline.map((point: any) => (
                <div key={point.date} className="flex items-center gap-3">
                  <div className="text-sm text-gray-600 w-28">{formatDate(new Date(point.date))}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all"
                      style={{
                        width: `${Math.max(
                          (point.count / Math.max(...analytics.timeline.map((p: any) => p.count))) * 100,
                          10
                        )}%`,
                      }}
                    >
                      {point.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Questions Analytics */}
        <div className="space-y-6">
          {analytics.questions.map((question: any, index: number) => (
            <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                      {index + 1}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900">{question.text}</h3>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>
                      Tip: <span className="font-medium">{question.type === 'rating' ? 'Puanlama' : 'Tek Seçim'}</span>
                    </span>
                    <span>
                      Yanıt: <span className="font-medium">{question.totalAnswers}</span>
                    </span>
                    <span>
                      Oran: <span className="font-medium">{question.responseRate}%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Rating Statistics */}
              {question.type === 'rating' && question.statistics && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600">Ortalama</div>
                      <div className="text-2xl font-bold text-blue-600">{question.statistics.average}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600">En Düşük</div>
                      <div className="text-2xl font-bold text-green-600">{question.statistics.min}</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600">En Yüksek</div>
                      <div className="text-2xl font-bold text-purple-600">{question.statistics.max}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Puan Dağılımı</h4>
                    {question.statistics.distribution.map((item: any) => (
                      <div key={item.value} className="flex items-center gap-3">
                        <div className="text-sm text-gray-600 w-16">Puan {item.value}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all"
                            style={{ width: `${item.percentage}%` }}
                          >
                            {item.count} ({item.percentage}%)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single Choice Statistics */}
              {question.type === 'single-choice' && question.statistics && (
                <div className="space-y-4">
                  {question.statistics.mostSelected && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm text-green-700 font-medium">En Çok Seçilen</div>
                      <div className="text-lg font-bold text-green-900 mt-1">
                        {question.statistics.mostSelected}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Seçenek Dağılımı</h4>
                    {question.statistics.distribution.map((item: any, idx: number) => {
                      const colors = [
                        'from-blue-400 to-blue-600',
                        'from-green-400 to-green-600',
                        'from-purple-400 to-purple-600',
                        'from-pink-400 to-pink-600',
                        'from-yellow-400 to-yellow-600',
                      ];
                      const color = colors[idx % colors.length];

                      return (
                        <div key={item.value} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 font-medium">{item.value}</span>
                            <span className="text-gray-600">
                              {item.count} yanıt ({item.percentage}%)
                            </span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-6 relative overflow-hidden">
                            <div
                              className={`bg-gradient-to-r ${color} h-full rounded-full transition-all`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* No Data Message */}
        {analytics.totalResponses === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <div className="text-yellow-800 text-lg font-medium">Henüz yanıt yok</div>
            <p className="text-yellow-700 mt-2">Bu anket için henüz yanıt alınmamış.</p>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Yanıtları Sil?</h3>
              <p className="text-gray-700 mb-6">
                Bu anketin <strong>{analytics.totalResponses}</strong> yanıtını silmek istediğinizden emin misiniz? 
                Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleDeleteResponses}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Siliniyor...' : 'Evet, Sil'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
