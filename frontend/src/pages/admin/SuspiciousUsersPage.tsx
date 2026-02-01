import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { formatDateTime, formatRelativeTime } from '../../lib/dateFormatter';

interface SuspiciousUser {
  id: string;
  platform: 'instagram' | 'whatsapp';
  platformUserId: string;
  username?: string;
  reason: string;
  flaggedAt: string;
  offenseCount: number;
  isActive: boolean;
  lastOffenseAt: string;
}

interface ChatMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  messageText: string;
  intent?: string;
  sentiment?: string;
  aiResponse?: string;
  createdAt: string;
}

const api = {
  async getSuspiciousUsers(): Promise<{ count: number; users: SuspiciousUser[] }> {
    const response = await fetch('/api/admin/suspicious-users', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch suspicious users');
    return response.json();
  },
  async unflagUser(platform: string, platformUserId: string): Promise<void> {
    const response = await fetch(`/api/admin/suspicious-users/${platform}/${encodeURIComponent(platformUserId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to unflag user');
  },
  async getChatHistory(platform: string, platformUserId: string): Promise<{ messages: ChatMessage[] }> {
    const response = await fetch(`/api/admin/blocked-users/${platform}/${encodeURIComponent(platformUserId)}/history`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch chat history');
    return response.json();
  },
  async getBlockingStatus(serviceName: string): Promise<{ serviceName: string; blockingEnabled: boolean }> {
    const response = await fetch(`/api/admin/services/${serviceName}/blocking/status`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch blocking status');
    return response.json();
  },
  async toggleBlocking(serviceName: string, enabled: boolean): Promise<void> {
    const response = await fetch(`/api/admin/services/${serviceName}/blocking/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) throw new Error('Failed to toggle blocking');
  },
};

export default function SuspiciousUsersPage() {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ user: SuspiciousUser } | null>(null);
  const [selectedUser, setSelectedUser] = useState<SuspiciousUser | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['suspicious-users'],
    queryFn: api.getSuspiciousUsers,
    refetchInterval: 30000,
  });

  const { data: blockingStatus, isLoading: isLoadingBlocking } = useQuery({
    queryKey: ['blocking-status', 'instagram'],
    queryFn: () => api.getBlockingStatus('instagram'),
    refetchInterval: 30000,
  });

  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chat-history', selectedUser?.platform, selectedUser?.platformUserId],
    queryFn: () => selectedUser ? api.getChatHistory(selectedUser.platform, selectedUser.platformUserId) : null,
    enabled: !!selectedUser,
  });

  const unflagMutation = useMutation({
    mutationFn: ({ platform, platformUserId }: { platform: string; platformUserId: string }) =>
      api.unflagUser(platform, platformUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspicious-users'] });
      setConfirmAction(null);
    },
  });

  const toggleBlockingMutation = useMutation({
    mutationFn: ({ serviceName, enabled }: { serviceName: string; enabled: boolean }) =>
      api.toggleBlocking(serviceName, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocking-status'] });
    },
  });

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Şüpheli kullanıcılar yüklenirken hata oluştu.'}
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Şüpheli Kullanıcılar</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Uygunsuz mesaj gönderen kullanıcılar. Bu kullanıcılara daha direkt yanıt verilir.
            </p>
          </div>
          
          {!isLoadingBlocking && blockingStatus && (
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Engelleme Sistemi</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {blockingStatus.blockingEnabled ? 'Aktif' : 'Pasif'}
                </p>
              </div>
              <button
                onClick={() => toggleBlockingMutation.mutate({ 
                  serviceName: 'instagram', 
                  enabled: !blockingStatus.blockingEnabled 
                })}
                disabled={toggleBlockingMutation.isPending}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  blockingStatus.blockingEnabled 
                    ? 'bg-red-600' 
                    : 'bg-gray-300 dark:bg-gray-600'
                } ${toggleBlockingMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    blockingStatus.blockingEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Şüpheli</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{data?.count || 0}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Çoklu İhlal</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {data?.users.filter((u: SuspiciousUser) => u.offenseCount >= 3).length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Yükleniyor...</p>
            </div>
          ) : !data?.users.length ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">Şüpheli kullanıcı bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Platform</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sebep</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">İhlal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Son İhlal</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.users.map((user: SuspiciousUser) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Instagram</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          {user.username && <span className="text-sm font-medium text-gray-900 dark:text-gray-100">@{user.username}</span>}
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{user.platformUserId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate block">{user.reason}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.offenseCount >= 5 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          user.offenseCount >= 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        }`}>
                          {user.offenseCount}x
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-gray-900 dark:text-gray-100">{formatRelativeTime(new Date(user.lastOffenseAt))}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(new Date(user.lastOffenseAt))}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50"
                          >
                            Geçmiş
                          </button>
                          <button
                            onClick={() => setConfirmAction({ user })}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50"
                          >
                            Kaldır
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mesaj Geçmişi</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.platformUserId}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingHistory ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto"></div></div>
              ) : !chatHistory?.messages.length ? (
                <div className="text-center py-8"><p className="text-gray-600 dark:text-gray-400">Mesaj geçmişi bulunamadı</p></div>
              ) : (
                [...chatHistory.messages].reverse().map((msg: ChatMessage) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.direction === 'inbound' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'bg-sky-600 text-white'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.messageText}</p>
                      <div className={`flex items-center gap-2 mt-1 text-xs ${msg.direction === 'inbound' ? 'text-gray-500 dark:text-gray-400' : 'text-sky-200'}`}>
                        <span>{formatDateTime(new Date(msg.createdAt))}</span>
                        {msg.intent && <span className={`px-1.5 py-0.5 rounded ${msg.direction === 'inbound' ? 'bg-gray-200 dark:bg-gray-600' : 'bg-sky-500'}`}>{msg.intent}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Şüpheli İşaretini Kaldır</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {confirmAction.user.username ? `@${confirmAction.user.username}` : confirmAction.user.platformUserId} kullanıcısının şüpheli işaretini kaldırmak istediğinize emin misiniz?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">İptal</button>
              <button
                onClick={() => unflagMutation.mutate({ platform: confirmAction.user.platform, platformUserId: confirmAction.user.platformUserId })}
                disabled={unflagMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {unflagMutation.isPending ? 'İşleniyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
