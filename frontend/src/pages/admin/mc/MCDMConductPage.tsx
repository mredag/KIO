import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import api from '../../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../../lib/dateFormatter';

type ConductState = 'normal' | 'guarded' | 'final_warning' | 'silent';
type ManualMode = 'auto' | 'force_normal' | 'force_silent';
type Platform = 'instagram' | 'whatsapp';

interface ConductUser {
  id: string;
  platform: Platform;
  platformUserId: string;
  username?: string;
  reason: string;
  flaggedAt: string;
  offenseCount: number;
  isActive: boolean;
  lastOffenseAt: string;
  conductScore: number;
  conductState: ConductState;
  shouldReply: boolean;
  responseStyle: ConductState;
  silentUntil: string | null;
  manualMode: ManualMode;
  manualModeUntil: string | null;
  manualNote: string | null;
  lastAction: string | null;
  lastSource: string | null;
}

interface ConductEvent {
  id: string;
  platform: Platform;
  platformUserId: string;
  eventType: 'violation' | 'manual_reset' | 'manual_override';
  stateBefore: ConductState;
  stateAfter: ConductState;
  scoreDelta: number;
  offenseCount: number;
  reason: string;
  source?: string;
  messageExcerpt?: string;
  createdAt: string;
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

const stateBadgeClasses: Record<ConductState, string> = {
  normal: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  guarded: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  final_warning: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  silent: 'bg-red-500/15 text-red-300 border-red-500/25',
};

const stateLabels: Record<ConductState, string> = {
  normal: 'Normal',
  guarded: 'Guarded',
  final_warning: 'Final warning',
  silent: 'Silent',
};

const manualModeLabels: Record<ManualMode, string> = {
  auto: 'Auto',
  force_normal: 'Force normal',
  force_silent: 'Force silent',
};

const platformLabels: Record<Platform, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
};

const conductApi = {
  async getUsers(platform?: Platform): Promise<{ count: number; users: ConductUser[] }> {
    const params = platform ? { platform } : undefined;
    const { data } = await api.get('/admin/dm-conduct/users', { params });
    return data;
  },
  async getEvents(platform: Platform, platformUserId: string): Promise<{ events: ConductEvent[] }> {
    const { data } = await api.get(`/admin/dm-conduct/users/${platform}/${encodeURIComponent(platformUserId)}/events`);
    return data;
  },
  async getHistory(platform: Platform, platformUserId: string): Promise<{ messages: ChatMessage[] }> {
    const { data } = await api.get(`/admin/dm-conduct/users/${platform}/${encodeURIComponent(platformUserId)}/history`);
    return data;
  },
  async resetUser(platform: Platform, platformUserId: string): Promise<void> {
    await api.post(`/admin/dm-conduct/users/${platform}/${encodeURIComponent(platformUserId)}/reset`);
  },
  async overrideUser(input: {
    platform: Platform;
    platformUserId: string;
    mode: ManualMode;
    durationHours?: number | null;
    note?: string | null;
  }): Promise<{ success: boolean; user: ConductUser }> {
    const { data } = await api.post(
      `/admin/dm-conduct/users/${input.platform}/${encodeURIComponent(input.platformUserId)}/override`,
      {
        mode: input.mode,
        durationHours: input.durationHours ?? null,
        note: input.note ?? null,
      },
    );
    return data;
  },
};

function userKey(platform: Platform, platformUserId: string): string {
  return `${platform}:${platformUserId}`;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <GlassCard className="p-5" hover={false}>
      <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-100">{value}</div>
      <div className="mt-1 text-xs text-gray-400">{hint}</div>
    </GlassCard>
  );
}

export default function MCDMConductPage() {
  const queryClient = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<ManualMode>('force_normal');
  const [overrideDuration, setOverrideDuration] = useState<number>(24);
  const [overrideNote, setOverrideNote] = useState('');
  const [newPlatform, setNewPlatform] = useState<Platform>('instagram');
  const [newUserId, setNewUserId] = useState('');

  const usersQuery = useQuery({
    queryKey: ['mc', 'dm-conduct', 'users', platformFilter],
    queryFn: () => conductApi.getUsers(platformFilter === 'all' ? undefined : platformFilter),
    refetchInterval: 15000,
  });

  const users = usersQuery.data?.users || [];
  const selectedUser = useMemo(() => {
    if (!selectedUserKey) {
      return users[0] || null;
    }
    return users.find((user) => userKey(user.platform, user.platformUserId) === selectedUserKey) || null;
  }, [selectedUserKey, users]);

  useEffect(() => {
    if ((!selectedUserKey || !selectedUser) && users[0]) {
      setSelectedUserKey(userKey(users[0].platform, users[0].platformUserId));
    }
  }, [selectedUser, selectedUserKey, users]);

  useEffect(() => {
    if (!selectedUser) {
      setOverrideMode('force_normal');
      setOverrideDuration(24);
      setOverrideNote('');
      return;
    }

    setOverrideMode(selectedUser.manualMode);
    setOverrideDuration(24);
    setOverrideNote(selectedUser.manualNote || '');
  }, [selectedUser]);

  const eventsQuery = useQuery({
    queryKey: ['mc', 'dm-conduct', 'events', selectedUser?.platform, selectedUser?.platformUserId],
    queryFn: () => conductApi.getEvents(selectedUser!.platform, selectedUser!.platformUserId),
    enabled: !!selectedUser,
  });

  const historyQuery = useQuery({
    queryKey: ['mc', 'dm-conduct', 'history', selectedUser?.platform, selectedUser?.platformUserId],
    queryFn: () => conductApi.getHistory(selectedUser!.platform, selectedUser!.platformUserId),
    enabled: !!selectedUser,
  });

  const invalidateConduct = () => {
    queryClient.invalidateQueries({ queryKey: ['mc', 'dm-conduct'] });
  };

  const resetMutation = useMutation({
    mutationFn: ({ platform, platformUserId }: { platform: Platform; platformUserId: string }) =>
      conductApi.resetUser(platform, platformUserId),
    onSuccess: () => invalidateConduct(),
  });

  const overrideMutation = useMutation({
    mutationFn: conductApi.overrideUser,
    onSuccess: (data) => {
      invalidateConduct();
      setSelectedUserKey(userKey(data.user.platform, data.user.platformUserId));
    },
  });

  const stats = useMemo(() => ({
    total: users.length,
    silent: users.filter((user) => user.conductState === 'silent').length,
    manual: users.filter((user) => user.manualMode !== 'auto').length,
    testing: users.filter((user) => user.manualMode === 'force_normal').length,
  }), [users]);

  const handleQuickOverride = (mode: ManualMode, durationHours: number | null, note: string) => {
    if (!selectedUser) {
      return;
    }
    overrideMutation.mutate({
      platform: selectedUser.platform,
      platformUserId: selectedUser.platformUserId,
      mode,
      durationHours,
      note,
    });
  };

  const handleCreateOverride = () => {
    if (!newUserId.trim()) {
      return;
    }
    overrideMutation.mutate({
      platform: newPlatform,
      platformUserId: newUserId.trim(),
      mode: 'force_normal',
      durationHours: 24,
      note: 'test-account-lift',
    });
    setNewUserId('');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="mc-page-header mc-fade-up">
          <div>
            <h1 className="mc-page-title">DM Davranis Kontrolu</h1>
            <p className="mt-2 text-sm text-gray-400 max-w-3xl">
              Uygunsuz mesajlar icin conduct ladder durumlarini izleyin, test hesaplari icin force normal override verin,
              gerekirse kullaniciyi sessiz moddan cikarip tam reset uygulayin.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mc-fade-up-delay">
          <StatCard label="Toplam" value={stats.total} hint="Takip edilen kullanicilar" />
          <StatCard label="Silent" value={stats.silent} hint="Yanitsiz modda olanlar" />
          <StatCard label="Manual" value={stats.manual} hint="Admin override aktif" />
          <StatCard label="Test Lift" value={stats.testing} hint="Force normal ile korunan hesaplar" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <GlassCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <div className="text-sm font-semibold text-gray-100">Kullanicilar</div>
                <div className="text-xs text-gray-400">Live conduct state + manual override durumu</div>
              </div>
              <select
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value as 'all' | Platform)}
                className="mc-input w-40"
              >
                <option value="all">Tum kanallar</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_140px_120px_auto] gap-3 items-end">
                <div>
                  <label className="mc-label mb-1.5 block">Platform</label>
                  <select value={newPlatform} onChange={(event) => setNewPlatform(event.target.value as Platform)} className="mc-input">
                    <option value="instagram">Instagram</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="mc-label mb-1.5 block">Test account user id</label>
                  <input
                    value={newUserId}
                    onChange={(event) => setNewUserId(event.target.value)}
                    className="mc-input"
                    placeholder="instagram id veya telefon"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mc-label mb-1.5 block">Ne yapar?</label>
                  <div className="text-xs text-gray-400 leading-5">
                    Bu buton kullaniciyi 24 saat force normal yapar. Test hesabiniz sessize dusmeden canli akista denenebilir.
                  </div>
                </div>
                <button onClick={handleCreateOverride} className="mc-btn mc-btn--primary text-xs" disabled={overrideMutation.isPending || !newUserId.trim()}>
                  Test Lift 24h
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-gray-400 uppercase text-[11px] tracking-[0.16em]">
                  <tr>
                    <th className="px-5 py-3 text-left">User</th>
                    <th className="px-5 py-3 text-left">State</th>
                    <th className="px-5 py-3 text-left">Manual</th>
                    <th className="px-5 py-3 text-left">Offense</th>
                    <th className="px-5 py-3 text-left">Last</th>
                    <th className="px-5 py-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const active = selectedUser && userKey(user.platform, user.platformUserId) === userKey(selectedUser.platform, selectedUser.platformUserId);
                    return (
                      <tr
                        key={user.id}
                        onClick={() => setSelectedUserKey(userKey(user.platform, user.platformUserId))}
                        className={`cursor-pointer border-t border-white/5 ${active ? 'bg-sky-500/10' : 'hover:bg-white/[0.03]'}`}
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="font-medium text-gray-100">{user.username ? `@${user.username}` : user.platformUserId}</div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                            <span>{platformLabels[user.platform]}</span>
                            <span className="font-mono">{user.platformUserId}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${stateBadgeClasses[user.conductState]}`}>
                            {stateLabels[user.conductState]}
                          </span>
                          {!user.shouldReply && (
                            <div className="mt-2 text-xs text-red-300">Reply disabled</div>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-gray-200">{manualModeLabels[user.manualMode]}</div>
                          <div className="mt-1 text-xs text-gray-400">
                            {user.manualModeUntil ? `until ${formatDateTime(new Date(user.manualModeUntil))}` : user.manualNote || '-'}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-gray-100">{user.offenseCount}x</div>
                          <div className="mt-1 text-xs text-gray-400">score {user.conductScore}</div>
                        </td>
                        <td className="px-5 py-4 align-top text-xs text-gray-400">
                          <div>{formatRelativeTime(new Date(user.lastOffenseAt))}</div>
                          <div className="mt-1">{formatDateTime(new Date(user.lastOffenseAt))}</div>
                          {user.silentUntil && (
                            <div className="mt-2 text-red-300">silent until {formatDateTime(new Date(user.silentUntil))}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-xs text-gray-300 max-w-sm">
                          <div className="line-clamp-3">{user.reason}</div>
                          <div className="mt-2 text-gray-500">{user.lastAction || 'no action'} / {user.lastSource || 'unknown'}</div>
                        </td>
                      </tr>
                    );
                  })}
                  {!usersQuery.isLoading && users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">Takip edilen conduct kaydi yok.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <div className="space-y-6">
            <GlassCard className="p-5" hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-100">Secili kullanici</div>
                  {!selectedUser ? (
                    <div className="mt-3 text-sm text-gray-400">Listeden bir kayit secin veya test lift formu ile yeni bir override olusturun.</div>
                  ) : (
                    <>
                      <div className="mt-3 text-lg font-semibold text-gray-100">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.platformUserId}</div>
                      <div className="mt-1 text-xs text-gray-400">{platformLabels[selectedUser.platform]} / {selectedUser.platformUserId}</div>
                    </>
                  )}
                </div>
                {selectedUser && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${stateBadgeClasses[selectedUser.conductState]}`}>
                    {stateLabels[selectedUser.conductState]}
                  </span>
                )}
              </div>

              {selectedUser && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-white/10 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Manual mode</div>
                      <div className="mt-2 text-gray-100">{manualModeLabels[selectedUser.manualMode]}</div>
                      <div className="mt-1 text-xs text-gray-400">{selectedUser.manualNote || 'No note'}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 p-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Silent window</div>
                      <div className="mt-2 text-gray-100">{selectedUser.silentUntil ? formatDateTime(new Date(selectedUser.silentUntil)) : 'Not silent'}</div>
                      <div className="mt-1 text-xs text-gray-400">reply {selectedUser.shouldReply ? 'enabled' : 'disabled'}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleQuickOverride('force_normal', 24, 'test-account-lift')}
                      className="mc-btn mc-btn--primary text-xs"
                      disabled={overrideMutation.isPending}
                    >
                      Lift 24h
                    </button>
                    <button
                      onClick={() => handleQuickOverride('force_silent', 24, 'manual-silent')}
                      className="mc-btn mc-btn--ghost text-xs"
                      disabled={overrideMutation.isPending}
                    >
                      Silent 24h
                    </button>
                    <button
                      onClick={() => handleQuickOverride('auto', null, 'clear-override')}
                      className="mc-btn mc-btn--ghost text-xs"
                      disabled={overrideMutation.isPending}
                    >
                      Clear override
                    </button>
                    <button
                      onClick={() => resetMutation.mutate({ platform: selectedUser.platform, platformUserId: selectedUser.platformUserId })}
                      className="mc-btn mc-btn--ghost text-xs text-red-200 border-red-500/25"
                      disabled={resetMutation.isPending}
                    >
                      Full reset
                    </button>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-5 space-y-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Custom override</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select value={overrideMode} onChange={(event) => setOverrideMode(event.target.value as ManualMode)} className="mc-input">
                        <option value="auto">Auto</option>
                        <option value="force_normal">Force normal</option>
                        <option value="force_silent">Force silent</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={overrideDuration}
                        onChange={(event) => setOverrideDuration(Number(event.target.value || 24))}
                        className="mc-input"
                        placeholder="Duration hours"
                        disabled={overrideMode === 'auto'}
                      />
                      <button
                        onClick={() => handleQuickOverride(overrideMode, overrideMode === 'auto' ? null : overrideDuration, overrideNote || 'manual-override')}
                        className="mc-btn mc-btn--primary text-xs"
                        disabled={overrideMutation.isPending}
                      >
                        Apply override
                      </button>
                    </div>
                    <textarea
                      value={overrideNote}
                      onChange={(event) => setOverrideNote(event.target.value)}
                      className="mc-input w-full min-h-[92px]"
                      placeholder="Operator note"
                    />
                  </div>
                </>
              )}
            </GlassCard>

            <GlassCard className="p-5" hover={false}>
              <div className="text-sm font-semibold text-gray-100">Conduct events</div>
              <div className="mt-4 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {eventsQuery.isLoading && <div className="text-sm text-gray-400">Yukleniyor...</div>}
                {!eventsQuery.isLoading && !eventsQuery.data?.events.length && (
                  <div className="text-sm text-gray-400">Event kaydi yok.</div>
                )}
                {eventsQuery.data?.events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">{event.eventType}</div>
                      <div className="text-xs text-gray-400">{formatDateTime(new Date(event.createdAt))}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-200">
                      <span>{stateLabels[event.stateBefore]}</span>
                      <span className="text-gray-500">{'->'}</span>
                      <span>{stateLabels[event.stateAfter]}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-300">{event.reason}</div>
                    <div className="mt-2 text-xs text-gray-500">score +{event.scoreDelta} / offense {event.offenseCount} / {event.source || 'unknown'}</div>
                    {event.messageExcerpt && (
                      <div className="mt-2 rounded bg-black/20 px-2.5 py-2 text-xs text-gray-400">{event.messageExcerpt}</div>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5" hover={false}>
              <div className="text-sm font-semibold text-gray-100">Recent chat history</div>
              <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {historyQuery.isLoading && <div className="text-sm text-gray-400">Yukleniyor...</div>}
                {!historyQuery.isLoading && !historyQuery.data?.messages.length && (
                  <div className="text-sm text-gray-400">Mesaj gecmisi yok.</div>
                )}
                {(historyQuery.data?.messages || []).slice().reverse().map((message) => (
                  <div key={message.id} className={`rounded-lg px-3 py-2 ${message.direction === 'inbound' ? 'bg-white/[0.04]' : 'bg-sky-500/12 border border-sky-500/20'}`}>
                    <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                      <span>{message.direction}</span>
                      <span>{formatDateTime(new Date(message.createdAt))}</span>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-gray-100">{message.messageText}</div>
                    {message.intent && <div className="mt-2 text-xs text-gray-400">intent: {message.intent}</div>}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
