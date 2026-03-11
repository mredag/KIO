import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import api from '../../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../../lib/dateFormatter';

type ConductState = 'normal' | 'guarded' | 'final_warning' | 'silent';
type ManualMode = 'auto' | 'force_normal' | 'force_silent';
type Platform = 'instagram' | 'whatsapp';
type ConductStateFilter = 'all' | ConductState;
type ConductManualFilter = 'all' | ManualMode | 'manual_only';
type ConductRecordFilter = 'all' | 'real_only' | 'test_only';

interface ConductUser {
  id: string;
  platform: Platform;
  platformUserId: string;
  username?: string;
  isTestLike: boolean;
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

interface ConductStats {
  total: number;
  normal: number;
  guarded: number;
  finalWarning: number;
  silent: number;
  manual: number;
  testing: number;
  testLike: number;
}

interface ConductUserListResponse {
  count: number;
  limit: number;
  offset: number;
  stats: ConductStats;
  users: ConductUser[];
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

const stateDescriptions: Record<ConductState, string> = {
  normal: 'Normal hizmet tonu. Ek kisit yok.',
  guarded: 'Kisa ve mesafeli cevap. Emoji, yumusak acilis ve gereksiz yardim azaltilir.',
  final_warning: 'Son sert uyari seviyesi. Takip sorusu, sicak kapanis ve ek yardim yok.',
  silent: 'En sert is modu. Cevap gider ama yalnizca cok kisa, duz ve is odakli bilgi verilir.',
};

const manualModeLabels: Record<ManualMode, string> = {
  auto: 'Auto',
  force_normal: 'Force normal',
  force_silent: 'Force bad customer',
};

const manualFilterLabels: Record<ConductManualFilter, string> = {
  all: 'All overrides',
  auto: 'Auto only',
  manual_only: 'Manual only',
  force_normal: 'Force normal',
  force_silent: 'Force silent',
};

const recordFilterLabels: Record<ConductRecordFilter, string> = {
  all: 'All records',
  real_only: 'Real only',
  test_only: 'Test / Sim only',
};

const platformLabels: Record<Platform, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
};

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/\u00e7/g, 'c')
    .replace(/\u011f/g, 'g')
    .replace(/\u0131/g, 'i')
    .replace(/\u00f6/g, 'o')
    .replace(/\u015f/g, 's')
    .replace(/\u00fc/g, 'u')
    .trim();
}

const conductApi = {
  async getUsers(input: {
    platform?: Platform;
    q?: string;
    state?: ConductState;
    manualMode?: ConductManualFilter;
    testLike?: Exclude<ConductRecordFilter, 'all'>;
    limit?: number;
    offset?: number;
  }): Promise<ConductUserListResponse> {
    const params = {
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.q ? { q: input.q } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(input.manualMode && input.manualMode !== 'all' ? { manualMode: input.manualMode } : {}),
      ...(input.testLike ? { testLike: input.testLike } : {}),
      ...(typeof input.limit === 'number' ? { limit: input.limit } : {}),
      ...(typeof input.offset === 'number' ? { offset: input.offset } : {}),
    };
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

const PAGE_SIZE = 50;

function isSilentActive(user: ConductUser): boolean {
  if (user.conductState !== 'silent') {
    return false;
  }

  if (!user.silentUntil) {
    return true;
  }

  return new Date(user.silentUntil).getTime() > Date.now();
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
  const [stateFilter, setStateFilter] = useState<ConductStateFilter>('all');
  const [manualFilter, setManualFilter] = useState<ConductManualFilter>('all');
  const [recordFilter, setRecordFilter] = useState<ConductRecordFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<ManualMode>('force_normal');
  const [overrideDuration, setOverrideDuration] = useState<number>(24);
  const [overrideNote, setOverrideNote] = useState('');
  const [newPlatform, setNewPlatform] = useState<Platform>('instagram');
  const [newUserId, setNewUserId] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(normalizeSearchText(searchQuery));
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [platformFilter, stateFilter, manualFilter, recordFilter]);

  const usersQuery = useQuery({
    queryKey: ['mc', 'dm-conduct', 'users', platformFilter, stateFilter, manualFilter, recordFilter, debouncedSearchQuery, page],
    queryFn: () => conductApi.getUsers({
      platform: platformFilter === 'all' ? undefined : platformFilter,
      q: debouncedSearchQuery || undefined,
      state: stateFilter === 'all' ? undefined : stateFilter,
      manualMode: manualFilter,
      testLike: recordFilter === 'all' ? undefined : recordFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    refetchInterval: 15000,
  });

  const users = usersQuery.data?.users || [];

  const selectedUser = useMemo(() => {
    if (!selectedUserKey) {
      return null;
    }
    return users.find((user) => userKey(user.platform, user.platformUserId) === selectedUserKey) || null;
  }, [users, selectedUserKey]);

  useEffect(() => {
    if (selectedUserKey && !selectedUser) {
      setSelectedUserKey(null);
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

  useEffect(() => {
    if (!actionFeedback) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setActionFeedback(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

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
    onSuccess: (_data, variables) => {
      invalidateConduct();
      if (selectedUserKey === userKey(variables.platform, variables.platformUserId)) {
        setSelectedUserKey(null);
      }
      setActionFeedback({
        type: 'success',
        message: `${variables.platformUserId} tam reset ile normal davranisa donduruldu.`,
      });
    },
    onError: (error: unknown) => {
      setActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Reset islemi basarisiz oldu.',
      });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: conductApi.overrideUser,
    onSuccess: (data) => {
      invalidateConduct();
      setSelectedUserKey(userKey(data.user.platform, data.user.platformUserId));
      const modeLabel = manualModeLabels[data.user.manualMode];
      setActionFeedback({
        type: 'success',
        message: `${data.user.platformUserId} icin ${modeLabel} uygulandi.`,
      });
    },
    onError: (error: unknown) => {
      setActionFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Override islemi basarisiz oldu.',
      });
    },
  });

  const stats = usersQuery.data?.stats || {
    total: 0,
    normal: 0,
    guarded: 0,
    finalWarning: 0,
    silent: 0,
    manual: 0,
    testing: 0,
    testLike: 0,
  };
  const totalCount = usersQuery.data?.count || 0;
  const visibleStart = totalCount === 0 ? 0 : (page * PAGE_SIZE) + 1;
  const visibleEnd = Math.min((page * PAGE_SIZE) + users.length, totalCount);
  const hasPreviousPage = page > 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < totalCount;
  const hasActiveFilters = platformFilter !== 'all'
    || stateFilter !== 'all'
    || manualFilter !== 'all'
    || recordFilter !== 'all'
    || !!debouncedSearchQuery;

  const resetFilters = () => {
    setPlatformFilter('all');
    setStateFilter('all');
    setManualFilter('all');
    setRecordFilter('all');
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setPage(0);
  };

  const handleSelectUser = (user: ConductUser) => {
    setSelectedUserKey(userKey(user.platform, user.platformUserId));
  };

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
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setPage(0);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="mc-page-header mc-fade-up">
          <div>
            <h1 className="mc-page-title">DM Davranis Kontrolu</h1>
            <p className="mt-2 text-sm text-gray-400 max-w-3xl">
              Uygunsuz mesajlar icin conduct ladder durumlarini izleyin, test hesaplari icin force normal override verin,
              gerekirse kullaniciyi bad-customer modundan cikarip tam reset uygulayin.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5 mc-fade-up-delay">
          <StatCard
            label="Toplam"
            value={totalCount}
            hint={debouncedSearchQuery ? 'Arama ile eslesen conduct kayitlari' : 'Takip edilen conduct kullanicilari'}
          />
          <StatCard label="Normal" value={stats.normal} hint="Su anda normal tonda cevap alanlar" />
          <StatCard label="Guarded" value={stats.guarded} hint="Kisa ve mesafeli moda alinmis kullanicilar" />
          <StatCard label="Final/Silent" value={stats.finalWarning + stats.silent} hint="Sert uyarida veya silent modunda olanlar" />
          <StatCard label="Silent" value={stats.silent} hint="Bad customer modunda olanlar" />
          <StatCard label="Test / Sim" value={stats.testLike} hint="Test veya simulator olarak gorunen kayitlar" />
        </div>

        <GlassCard className="p-4 mc-fade-up-delay" hover={false}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-gray-300">
              Bu sayfa tum DM kullanicilarini degil, sadece conduct ladder tarafindan takip edilen kullanicilari listeler.
              Canli veride su anda <span className="font-semibold text-gray-100">{Math.max(totalCount - stats.testLike, 0)}</span> gercek kayit ve
              <span className="font-semibold text-gray-100"> {stats.testLike}</span> test/simulator gorunumlu kayit var.
            </div>
            <div className="text-xs text-gray-500">
              Varsayilan liste son ihlale gore sirali ve sayfalanmis gelir. Tum kayitlar artik tek seferde yuklenmez.
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100">
            Cok sayida <span className="font-semibold">guarded</span> gorunmesinin nedeni bu listenin tarihsel conduct kayitlarini da tutmasi.
            Bu kayitlar sadece <span className="font-semibold">mutlu son</span> soranlar degil; onceki moderasyon sisteminden gelen
            <span className="font-semibold"> ai_detected_inappropriate</span>, <span className="font-semibold">hard_reject_keyword</span> ve euphemism hitlerini de icerir.
          </div>
        </GlassCard>

        <GlassCard className="p-5 mc-fade-up-delay">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold text-gray-100">Durumlar ne anlama geliyor?</div>
              <div className="mt-2 text-sm text-gray-400">
                Conduct ladder arka planda calisir. Gorunen cevaplar eski uygunsuz-icerik reddini korur; bu panel ise o kullanicinin
                bundan sonraki tonunu ve gerekirse bad-customer moduna gecmesini kontrol eder.
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Arama: Instagram kullanici adi, Instagram ID, telefon veya neden metni
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(stateDescriptions) as ConductState[]).map((state) => (
              <div key={state} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${stateBadgeClasses[state]}`}>
                  {stateLabels[state]}
                </div>
                <div className="mt-3 text-sm text-gray-300">{stateDescriptions[state]}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-300">
              <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Force normal</div>
              <div className="mt-2">Test hesabi bad-customer moduna dusmez. Var olan ceza kaydi silinmez, sadece cevap tonu gecici normale cekilir.</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-300">
              <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Force bad customer</div>
              <div className="mt-2">En sert cevap modu. Kullaniciya sadece cok kisa ve duz is cevabi gider; sohbet acilmaz.</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-300">
              <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Full reset</div>
              <div className="mt-2">Kullaniciyi conduct listesinden cikarir, override ve ceza skorunu sifirlar.</div>
            </div>
          </div>
        </GlassCard>

        {actionFeedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              actionFeedback.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200'
            }`}
          >
            {actionFeedback.message}
          </div>
        )}

        <div className="space-y-6">
          <GlassCard className="min-w-0 overflow-hidden p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <div className="text-sm font-semibold text-gray-100">Kullanicilar</div>
                <div className="text-xs text-gray-400">Conduct listesine girmis kayitlar. Satira tikladiginizda detay ve aksiyonlar sagdan acilir.</div>
              </div>
              <div className="text-xs text-gray-500">
                {hasActiveFilters ? 'Filtreli gorunum aktif' : 'Tum aktif conduct kayitlari'}
              </div>
            </div>

            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_180px_180px_180px_180px_auto]">
                <div className="xl:col-span-6">
                  <label className="mc-label mb-1.5 block">Ara</label>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="mc-input"
                    placeholder="instagram kullanici adi, id, telefon veya neden"
                  />
                </div>
                <div>
                  <label className="mc-label mb-1.5 block">Kanal</label>
                  <select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as 'all' | Platform)} className="mc-input">
                    <option value="all">Tum kanallar</option>
                    <option value="instagram">Instagram</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="mc-label mb-1.5 block">State</label>
                  <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as ConductStateFilter)} className="mc-input">
                    <option value="all">All states</option>
                    <option value="guarded">Guarded</option>
                    <option value="final_warning">Final warning</option>
                    <option value="silent">Silent</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mc-label mb-1.5 block">Override</label>
                  <select value={manualFilter} onChange={(event) => setManualFilter(event.target.value as ConductManualFilter)} className="mc-input">
                    <option value="all">All overrides</option>
                    <option value="auto">Auto only</option>
                    <option value="manual_only">Manual only</option>
                    <option value="force_normal">Force normal</option>
                    <option value="force_silent">Force silent</option>
                  </select>
                </div>
                <div>
                  <label className="mc-label mb-1.5 block">Kayit tipi</label>
                  <select value={recordFilter} onChange={(event) => setRecordFilter(event.target.value as ConductRecordFilter)} className="mc-input">
                    <option value="all">All records</option>
                    <option value="real_only">Real only</option>
                    <option value="test_only">Test / Sim only</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={resetFilters} className="mc-btn mc-btn--ghost text-xs w-full" disabled={!hasActiveFilters}>
                    Filtreleri temizle
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setStateFilter('silent')}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${stateFilter === 'silent' ? 'border-red-400/40 bg-red-500/15 text-red-200' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]'}`}
                >
                  Silent only
                </button>
                <button
                  onClick={() => setManualFilter('manual_only')}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${manualFilter === 'manual_only' ? 'border-sky-400/40 bg-sky-500/15 text-sky-200' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]'}`}
                >
                  Manual only
                </button>
                <button
                  onClick={() => setRecordFilter('real_only')}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${recordFilter === 'real_only' ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.06]'}`}
                >
                  Real only
                </button>
                {hasActiveFilters && (
                  <div className="flex items-center text-[11px] text-gray-500">
                    {platformFilter !== 'all' ? platformLabels[platformFilter] : 'All channels'}
                    <span className="mx-2">•</span>
                    {stateFilter === 'all' ? 'All states' : stateLabels[stateFilter]}
                    <span className="mx-2">•</span>
                    {manualFilterLabels[manualFilter]}
                    <span className="mx-2">•</span>
                    {recordFilterLabels[recordFilter]}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015]">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,2fr)_160px]">
                <div>
                  <label className="mc-label mb-1.5 block">Test lift kanal</label>
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
                <div>
                  <label className="mc-label mb-1.5 block">Ne yapar?</label>
                  <div className="text-xs text-gray-400 leading-5">
                    Bu arac yalnizca test hesaplarini 24 saat force normal yapar. Canli kullanicilari conduct modundan cikarmak icin secili kullanici panelindeki override aksiyonlarini kullanin.
                  </div>
                </div>
                <div className="flex items-end">
                  <button onClick={handleCreateOverride} className="mc-btn mc-btn--primary text-xs w-full" disabled={overrideMutation.isPending || !newUserId.trim()}>
                    {overrideMutation.isPending ? 'Isleniyor...' : 'Test Lift 24h'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10 text-xs text-gray-500">
              <div>
                {usersQuery.isFetching ? 'Liste yenileniyor...' : `${visibleStart}-${visibleEnd} / ${totalCount} kayit gosteriliyor`}
              </div>
              {debouncedSearchQuery && (
                <div>Sunucu aramasi: "{searchQuery.trim()}"</div>
              )}
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
                    const silentActive = isSilentActive(user);
                    return (
                      <tr
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className={`cursor-pointer border-t border-white/5 ${active ? 'bg-sky-500/10' : silentActive ? 'bg-red-500/[0.04] hover:bg-red-500/[0.06]' : 'hover:bg-white/[0.03]'}`}
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-gray-100">{user.username ? `@${user.username}` : user.platformUserId}</div>
                            {user.isTestLike && (
                              <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                                Test / Sim
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                            <span>{platformLabels[user.platform]}</span>
                            <span className="font-mono">{user.platformUserId}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${stateBadgeClasses[user.conductState]}`}>
                            {stateLabels[user.conductState]}
                          </span>
                          {silentActive && (
                            <>
                              <div className="mt-2 text-xs font-medium text-red-200">Bad customer mode active</div>
                              {user.silentUntil && (
                                <div className="mt-1 text-xs text-red-300">until {formatDateTime(new Date(user.silentUntil))}</div>
                              )}
                            </>
                          )}
                          {!silentActive && user.conductState === 'silent' && (
                            <div className="mt-2 text-xs text-red-300">Silent state stored</div>
                          )}
                          {user.conductState === 'final_warning' && (
                            <div className="mt-2 text-xs text-orange-200">High-risk warning state</div>
                          )}
                          {user.manualMode === 'force_silent' && (
                            <div className="mt-1 text-xs text-sky-200">Manual silent override</div>
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
                          {silentActive && user.silentUntil && (
                            <div className="mt-2 font-medium text-red-300">silent until {formatDateTime(new Date(user.silentUntil))}</div>
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
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                        {searchQuery.trim() ? 'Aramayla eslesen conduct kaydi yok.' : 'Takip edilen conduct kaydi yok.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
              <div className="text-xs text-gray-500">
                {totalCount === 0 ? 'Kayit yok.' : `${visibleStart}-${visibleEnd} / ${totalCount} kayit`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  className="mc-btn mc-btn--ghost text-xs"
                  disabled={!hasPreviousPage || usersQuery.isFetching}
                >
                  Onceki
                </button>
                <div className="text-xs text-gray-500">Sayfa {page + 1}</div>
                <button
                  onClick={() => setPage((current) => current + 1)}
                  className="mc-btn mc-btn--ghost text-xs"
                  disabled={!hasNextPage || usersQuery.isFetching}
                >
                  Sonraki
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

        {selectedUser && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUserKey(null)} />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[560px] border-l border-white/10 bg-[#07111f] shadow-2xl">
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Secili kullanici</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="text-xl font-semibold text-gray-100">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.platformUserId}</div>
                      {selectedUser.isTestLike && (
                        <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                          Test / Sim
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">{platformLabels[selectedUser.platform]} / {selectedUser.platformUserId}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${stateBadgeClasses[selectedUser.conductState]}`}>
                      {stateLabels[selectedUser.conductState]}
                    </span>
                    <button
                      onClick={() => setSelectedUserKey(null)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/[0.04]"
                    >
                      Kapat
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                  {isSilentActive(selectedUser) && (
                    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-red-200/80">Silent active</div>
                          <div className="mt-2 text-lg font-semibold text-red-100">Bad customer mode is active for this user.</div>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-red-400/30 bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-100">
                          Silent
                        </span>
                      </div>
                      <div className="mt-3 text-sm text-red-100/90">
                        {selectedUser.silentUntil
                          ? `Current silent window ends at ${formatDateTime(new Date(selectedUser.silentUntil))}.`
                          : 'This user is currently locked to silent conduct replies.'}
                      </div>
                      {selectedUser.manualMode === 'force_silent' && (
                        <div className="mt-2 text-xs text-red-100/70">Manual override: Force bad customer</div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Manual mode</div>
                      <div className="mt-2 text-gray-100">{manualModeLabels[selectedUser.manualMode]}</div>
                      <div className="mt-1 text-xs text-gray-400">{selectedUser.manualNote || 'No note'}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Silent window</div>
                      <div className="mt-2 text-gray-100">{selectedUser.silentUntil ? formatDateTime(new Date(selectedUser.silentUntil)) : 'Not active'}</div>
                      <div className="mt-1 text-xs text-gray-400">
                        {isSilentActive(selectedUser) ? 'silent reply mode active' : `reply style ${selectedUser.conductState === 'silent' ? 'minimal' : 'normal'}`}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Hizli aksiyonlar</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleQuickOverride('force_normal', 24, 'test-account-lift')}
                        className="mc-btn mc-btn--primary text-xs justify-center"
                        disabled={overrideMutation.isPending}
                      >
                        {overrideMutation.isPending ? 'Isleniyor...' : 'Lift 24h'}
                      </button>
                      <button
                        onClick={() => handleQuickOverride('force_silent', 24, 'manual-silent')}
                        className="mc-btn mc-btn--ghost text-xs justify-center"
                        disabled={overrideMutation.isPending}
                      >
                        {overrideMutation.isPending ? 'Isleniyor...' : 'Bad customer 24h'}
                      </button>
                      <button
                        onClick={() => handleQuickOverride('auto', null, 'clear-override')}
                        className="mc-btn mc-btn--ghost text-xs justify-center"
                        disabled={overrideMutation.isPending}
                      >
                        {overrideMutation.isPending ? 'Isleniyor...' : 'Clear override'}
                      </button>
                      <button
                        onClick={() => resetMutation.mutate({ platform: selectedUser.platform, platformUserId: selectedUser.platformUserId })}
                        className="mc-btn mc-btn--ghost text-xs justify-center text-red-200 border-red-500/25"
                        disabled={resetMutation.isPending}
                      >
                        {resetMutation.isPending ? 'Resetleniyor...' : 'Full reset'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-gray-500">Custom override</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select value={overrideMode} onChange={(event) => setOverrideMode(event.target.value as ManualMode)} className="mc-input">
                        <option value="auto">Auto</option>
                        <option value="force_normal">Force normal</option>
                        <option value="force_silent">Force bad customer</option>
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
                        className="mc-btn mc-btn--primary text-xs justify-center"
                        disabled={overrideMutation.isPending}
                      >
                        {overrideMutation.isPending ? 'Uygulaniyor...' : 'Apply override'}
                      </button>
                    </div>
                    <textarea
                      value={overrideNote}
                      onChange={(event) => setOverrideNote(event.target.value)}
                      className="mc-input w-full min-h-[92px]"
                      placeholder="Operator note"
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-semibold text-gray-100">Conduct events</div>
                    <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
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
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-sm font-semibold text-gray-100">Recent chat history</div>
                    <div className="mt-4 space-y-3 max-h-[320px] overflow-y-auto pr-1">
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
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
