import { useState } from 'react';
import { Plus, Edit2, Trash2, Copy, Check } from 'lucide-react';
import {
  useAIPrompts,
  useCreateAIPrompt,
  useUpdateAIPrompt,
  useDeleteAIPrompt,
  type AIPrompt,
  type CreateAIPromptInput,
} from '../../hooks/useAIPromptsApi';

export default function AIPromptsPage() {
  const { data: prompts, isLoading } = useAIPrompts();
  const createPrompt = useCreateAIPrompt();
  const updatePrompt = useUpdateAIPrompt();
  const deletePrompt = useDeleteAIPrompt();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateAIPromptInput>({
    name: '',
    description: '',
    system_message: '',
    workflow_type: 'general',
    is_active: true,
  });

  const handleOpenModal = (prompt?: AIPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormData({
        name: prompt.name,
        description: prompt.description || '',
        system_message: prompt.system_message,
        workflow_type: prompt.workflow_type,
        is_active: prompt.is_active === 1,
      });
    } else {
      setEditingPrompt(null);
      setFormData({
        name: '',
        description: '',
        system_message: '',
        workflow_type: 'general',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPrompt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPrompt) {
        await updatePrompt.mutateAsync({
          id: editingPrompt.id,
          data: formData,
        });
      } else {
        await createPrompt.mutateAsync(formData);
      }
      handleCloseModal();
    } catch (error) {
      console.error('Error saving prompt:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu AI promptunu silmek istediğinizden emin misiniz?')) {
      try {
        await deletePrompt.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting prompt:', error);
      }
    }
  };

  const handleCopyName = (name: string, id: string) => {
    navigator.clipboard.writeText(name);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWorkflowTypeBadge = (type: string) => {
    const colors = {
      whatsapp: 'bg-green-100 text-green-800',
      instagram: 'bg-pink-100 text-pink-800',
      general: 'bg-gray-100 text-gray-800',
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI System Prompts</h1>
          <p className="text-gray-600 mt-1">
            n8n workflow'larında kullanılacak AI sistem mesajlarını yönetin
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Yeni Prompt
        </button>
      </div>

      <div className="grid gap-4">
        {prompts?.map((prompt) => (
          <div
            key={prompt.id}
            className="bg-white rounded-lg shadow p-6 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {prompt.name}
                  </h3>
                  <button
                    onClick={() => handleCopyName(prompt.name, prompt.id)}
                    className="text-gray-400 hover:text-gray-600"
                    title="İsmi kopyala"
                  >
                    {copiedId === prompt.id ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getWorkflowTypeBadge(
                      prompt.workflow_type
                    )}`}
                  >
                    {prompt.workflow_type}
                  </span>
                  {prompt.is_active === 1 ? (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                      Aktif
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                      Pasif
                    </span>
                  )}
                </div>
                {prompt.description && (
                  <p className="text-gray-600 text-sm mb-3">{prompt.description}</p>
                )}
                <div className="bg-gray-50 rounded p-3 border border-gray-200">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {prompt.system_message}
                  </pre>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Versiyon: {prompt.version} | Son güncelleme:{' '}
                  {new Date(prompt.updated_at).toLocaleString('tr-TR')}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleOpenModal(prompt)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="Düzenle"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  title="Sil"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {prompts?.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">Henüz AI prompt eklenmemiş</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              İlk promptu ekle
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingPrompt ? 'Prompt Düzenle' : 'Yeni Prompt Ekle'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    İsim (n8n'de kullanılacak) *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="whatsapp-coupon-assistant"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    n8n workflow'unda bu isimle çağrılacak
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Açıklama
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Bu promptun ne için kullanıldığını açıklayın"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workflow Tipi *
                  </label>
                  <select
                    value={formData.workflow_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        workflow_type: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">Genel</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Message *
                  </label>
                  <textarea
                    value={formData.system_message}
                    onChange={(e) =>
                      setFormData({ ...formData, system_message: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={12}
                    placeholder="Sen bir yardımsever AI asistanısın..."
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Aktif
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={createPrompt.isPending || updatePrompt.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createPrompt.isPending || updatePrompt.isPending
                      ? 'Kaydediliyor...'
                      : editingPrompt
                      ? 'Güncelle'
                      : 'Oluştur'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
