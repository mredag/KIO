import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useMCConversations, useUpdateMCConversation } from '../../../hooks/useMissionControlApi';
import { SkeletonCard } from '../../../components/ui/Skeleton';

const CHANNEL_ICONS: Record<string, string> = { instagram: '📸', whatsapp: '💬', admin: '🖥️', webhook: '🔗' };
const STATUS_BADGE: Record<string, string> = {
  active: 'mc-badge--green',
  resolved: 'mc-badge--gray',
  escalated: 'mc-badge--red',
  waiting: 'mc-badge--amber',
};

const CHANNEL_FILTERS = [
  { key: '', label: 'Tüm Kanallar' },
  { key: 'instagram', label: '📸 Instagram' },
  { key: 'whatsapp', label: '💬 WhatsApp' },
  { key: 'admin', label: '🖥️ Admin' },
];

const STATUS_FILTERS = [
  { key: '', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'escalated', label: 'Eskalasyon' },
  { key: 'resolved', label: 'Çözüldü' },
];

export default function MCConversationsPage() {
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: conversations, isLoading } = useMCConversations({
    channel: channelFilter || undefined,
    status: statusFilter || undefined,
  });
  const updateConv = useUpdateMCConversation();

  const handleEscalate = (id: string) => updateConv.mutate({ id, status: 'escalated' });
  const handleResolve = (id: string) => updateConv.mutate({ id, status: 'resolved' });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">Kanal Operasyonları</h1></div>
          <div className="space-y-3">{[...Array(5)].map((_, i) => <SkeletonCard key={i} height="h-20" />)}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        <div className="mc-page-header mc-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <span className="text-sm">💬</span>
            </div>
            <h1 className="mc-page-title">Kanal Operasyonları</h1>
            <span className="mc-badge mc-badge--gray">{(conversations || []).length}</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-4 mb-6 mc-fade-up">
          <div className="flex gap-1.5">
            {CHANNEL_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setChannelFilter(f.key)}
                className={`mc-pill ${channelFilter === f.key ? 'mc-pill--active' : ''}`}>{f.label}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`mc-pill ${statusFilter === f.key ? 'mc-pill--active' : ''}`}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="mc-card overflow-hidden mc-fade-up-delay">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 mc-label">Kanal</th>
                <th className="text-left px-4 py-3 mc-label">Müşteri</th>
                <th className="text-left px-4 py-3 mc-label">Durum</th>
                <th className="text-left px-4 py-3 mc-label">Ajan</th>
                <th className="text-left px-4 py-3 mc-label">Son Mesaj</th>
                <th className="text-left px-4 py-3 mc-label">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(conversations || []).map((conv: any) => (
                <tr key={conv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-lg mr-1">{CHANNEL_ICONS[conv.channel] || '📨'}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{conv.channel}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 text-sm">{conv.customer_name || conv.customer_id}</td>
                  <td className="px-4 py-3">
                    <span className={`mc-badge text-[10px] ${STATUS_BADGE[conv.status] || 'mc-badge--gray'}`}>{conv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{conv.agent_name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-mono">
                    {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString('tr-TR') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {conv.status === 'active' && (
                        <>
                          <button onClick={() => handleEscalate(conv.id)} className="mc-btn text-[10px] py-1 px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Eskale</button>
                          <button onClick={() => handleResolve(conv.id)} className="mc-btn text-[10px] py-1 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">Çöz</button>
                        </>
                      )}
                      {conv.status === 'escalated' && (
                        <button onClick={() => handleResolve(conv.id)} className="mc-btn text-[10px] py-1 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">Çöz</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!conversations || conversations.length === 0) && (
            <div className="mc-empty">
              <div className="mc-empty-icon">💬</div>
              <p className="mc-empty-title">Henüz konuşma yok</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}