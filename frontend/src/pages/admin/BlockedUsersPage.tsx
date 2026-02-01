import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { formatDateTime, formatRelativeTime } from '../../lib/dateFormatter';

interface BlockedUser {
  id: string;
  platform: 'instagram' | 'whatsapp';
  platformUserId: string;
  username?: string;
  reason: string;
  blockedAt: string;
  expiresAt: string;
  blockCount: number;
  isActive: boolean;
  isPermanent?: boolean;
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
  async getBlockedUsers(): Promise<{ count: number; users: BlockedUser[] }> {
    // Try admin API first (requires session)
    const adminResponse = await fetch('/api/admin/blocked-users', { credentials: 'include' });
    if (adminResponse.ok) {
      const data = await adminResponse.json();
      console.log('[BlockedUsers] Fetched from admin API:', data);
      return data;
    }
    
    // Fallback to integration API (works without session for internal use)
    console.log('[BlockedUsers] Admin API failed, trying integration API...');
    const integrationResponse = await fetch('/api/integrations/instagram/blocked-users', { credentials: 'include' });
    if (integrationResponse.ok) {
      const data = await integrationResponse.json();
      console.log('[BlockedUsers] Fetched from integration API:', data);
      return data;
    }
    
    // Both failed
    const errorData = await adminResponse.json().catch(() => ({}));
    console.error('[BlockedUsers] Both APIs failed:', adminResponse.status, errorData);
    if (adminResponse.status === 401) {
      throw new Error('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
    }
    throw new Error(errorData.error || 'Failed to fetch blocked users');
  },
  async unblockUser(platform: string, platformUserId: string): Promise<void> {
    const response = await fetch(`/api/admin/blocked-users/${platform}/${encodeURIComponent(platformUserId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to unblock user');
  },
  async permaBlockUser(platform: string, platformUserId: string): Promise<void> {
    const response = await fetch(`/api/admin/blocked-users/${platform}/${encodeURIComponent(platformUserId)}/permanent`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to permanently block user');
  },
  async getChatHistory(platform: string, platformUserId: string): Promise<{ messages: ChatMessage[] }> {
    const response = await fetch(`/api/admin/blocked-users/${platform}/${encodeURIComponent(platformUserId)}/history`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch chat history');
    return response.json();
  },
};

export default function BlockedUsersPage() {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ type: 'unblock' | 'permablock'; user: BlockedUser } | null>(null);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: api.getBlockedUsers,
    refetchInterval: 30000,
  });

  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chat-history', selectedUser?.platform, selectedUser?.platformUserId],
    queryFn: () => selectedUser ? api.getChatHistory(selectedUser.platform, selectedUser.platformUserId) : null,
    enabled: !!selectedUser,
  });

  const unblockMutation = useMutation({
    mutationFn: ({ platform, platformUserId }: { platform: string; platformUserId: string }) =>
      api.unblockUser(platform, platformUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      setConfirmAction(null);
    },
  });

  const permaBlockMutation = useMutation({
    mutationFn: ({ platform, platformUserId }: { platform: string; platformUserId: string }) =>
      api.permaBlockUser(platform, platformUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      setConfirmAction(null);
    },
  });

  const getRemainingTime = (expiresAt: string, isPermanent?: boolean) => {
    if (isPermanent) return 'Kalıcı';
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return 'Süresi doldu';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours} saat ${minutes % 60} dk`;
    return `${minutes} dk`;
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Engelli kullanıcılar yüklenirken hata oluştu.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Sayfayı Yenile
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Engelli Kullanıcılar</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Uygunsuz mesaj gönderen ve geçici/kalıcı olarak engellenen kullanıcılar
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Engelli</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{data?.count || 0}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Kalıcı Engel</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {data?.users.filter((u: BlockedUser) => u.isPermanent).length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Geçici Engel</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {data?.users.filter((u: BlockedUser) => !u.isPermanent).length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
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
              <p className="text-gray-600 dark:text-gray-400">Engelli kullanıcı bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sebep</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">İhlal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Engellenme</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kalan Süre</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.users.map((user: BlockedUser) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {user.platform === 'instagram' ? (
                            <svg className="w-5 h-5 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {user.platform === 'instagram' ? 'Instagram' : 'WhatsApp'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          {user.username && (
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">@{user.username}</span>
                          )}
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{user.platformUserId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate block">{user.reason}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.blockCount >= 5 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                          user.blockCount >= 3 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                        }`}>
                          {user.blockCount}x
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-gray-900 dark:text-gray-100">{formatRelativeTime(new Date(user.blockedAt))}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(new Date(user.blockedAt))}</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.isPermanent ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800' :
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}>
                          {getRemainingTime(user.expiresAt, user.isPermanent)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="px-3 py-1.5 text-xs font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors"
                          >
                            Geçmiş
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'unblock', user })}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          >
                            Kaldır
                          </button>
                          {!user.isPermanent && (
                            <button
                              onClick={() => setConfirmAction({ type: 'permablock', user })}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                              Kalıcı
                            </button>
                          )}
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

      {/* Chat History Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Mesaj Geçmişi
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedUser.username ? `@${selectedUser.username}` : selectedUser.platformUserId}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Yükleniyor...</p>
                </div>
              ) : !chatHistory?.messages.length ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">Mesaj geçmişi bulunamadı</p>
                </div>
              ) : (
                [...chatHistory.messages].reverse().map((msg: ChatMessage) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.direction === 'inbound'
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                          : 'bg-sky-600 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.messageText}</p>
                      <div className={`flex items-center gap-2 mt-1 text-xs ${
                        msg.direction === 'inbound' ? 'text-gray-500 dark:text-gray-400' : 'text-sky-200'
                      }`}>
                        <span>{formatDateTime(new Date(msg.createdAt))}</span>
                        {msg.intent && (
                          <span className={`px-1.5 py-0.5 rounded ${
                            msg.direction === 'inbound' 
                              ? 'bg-gray-200 dark:bg-gray-600' 
                              : 'bg-sky-500'
                          }`}>
                            {msg.intent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {confirmAction.type === 'unblock' ? 'Engeli Kaldır' : 'Kalıcı Engelle'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {confirmAction.type === 'unblock'
                ? `${confirmAction.user.username ? `@${confirmAction.user.username}` : confirmAction.user.platformUserId} kullanıcısının engelini kaldırmak istediğinize emin misiniz?`
                : `${confirmAction.user.username ? `@${confirmAction.user.username}` : confirmAction.user.platformUserId} kullanıcısını kalıcı olarak engellemek istediğinize emin misiniz?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'unblock') {
                    unblockMutation.mutate({ platform: confirmAction.user.platform, platformUserId: confirmAction.user.platformUserId });
                  } else {
                    permaBlockMutation.mutate({ platform: confirmAction.user.platform, platformUserId: confirmAction.user.platformUserId });
                  }
                }}
                disabled={unblockMutation.isPending || permaBlockMutation.isPending}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  confirmAction.type === 'unblock'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(unblockMutation.isPending || permaBlockMutation.isPending) ? 'İşleniyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
