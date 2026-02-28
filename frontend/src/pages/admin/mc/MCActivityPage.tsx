import { useState, useMemo, useRef, useEffect } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useActivityFeed, useActivityStats } from '../../../hooks/useActivityApi';
import { useActivitySSE } from '../../../hooks/useActivitySSE';

// ── Event type config ──
const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  created:          { label: 'Oluşturuldu', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25' },
  status_change:    { label: 'Durum',       color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/25' },
  completed:        { label: 'Tamamlandı',  color: 'text-green-300',   bg: 'bg-green-500/15',   border: 'border-green-500/25' },
  failed:           { label: 'Başarısız',   color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-red-500/25' },
  error:            { label: 'Hata',        color: 'text-red-400',     bg: 'bg-red-500/20',     border: 'border-red-500/30' },
  dm_response:      { label: 'DM Yanıt',    color: 'text-teal-300',    bg: 'bg-teal-500/15',    border: 'border-teal-500/25' },
  dm_inbound:       { label: 'DM Gelen',    color: 'text-blue-300',    bg: 'bg-blue-500/15',    border: 'border-blue-500/25' },
  dm_error:         { label: 'DM Hata',     color: 'text-rose-300',    bg: 'bg-rose-500/15',    border: 'border-rose-500/25' },
  auto_dispatched:  { label: 'Otomatik',    color: 'text-cyan-300',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/25' },
  policy_violation: { label: 'Politika',    color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/25' },
  cost_spike:       { label: 'Maliyet',     color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/25' },
  approval_created: { label: 'Onay',        color: 'text-sky-300',     bg: 'bg-sky-500/15',     border: 'border-sky-500/25' },
  approval_reviewed:{ label: 'İncelendi',   color: 'text-violet-300',  bg: 'bg-violet-500/15',  border: 'border-violet-500/25' },
  agent_message:    { label: 'Mesaj',        color: 'text-indigo-300',  bg: 'bg-indigo-500/15',  border: 'border-indigo-500/25' },
  sla_breach:       { label: 'SLA',          color: 'text-yellow-300',  bg: 'bg-yellow-500/15',  border: 'border-yellow-500/25' },
  scan_complete:    { label: 'Tarama',       color: 'text-gray-300',    bg: 'bg-gray-500/15',    border: 'border-gray-500/25' },
};

const ENTITY_ICONS: Record<string, string> = {
  agent: '🤖', job: '📋', run: '⚡', conversation: '💬', document: '📄',
  policy: '🛡️', approval: '✅', board: '📌', autopilot: '⚙️', system: '🔧',
};

function getEventStyle(eventType: string) {
  return EVENT_CONFIG[eventType] || { label: eventType, color: 'text-gray-300', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '--:--'; }
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

// ── Feed Card ──
function FeedCard({ item }: { item: any }) {
  const style = getEventStyle(item.event_type);
  const icon = ENTITY_ICONS[item.entity_type] || '📎';

  return (
    <div className="group flex gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200">
      {/* Avatar / Icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-sm">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Event pill */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${style.bg} ${style.color} ${style.border}`}>
            {style.label}
          </span>
          {/* Entity type */}
          <span className="text-[10px] text-gray-500 font-medium uppercase">{item.entity_type}</span>
          {/* Timestamp */}
          <span className="text-[10px] text-gray-600 ml-auto whitespace-nowrap">
            {formatDate(item.created_at)} {formatTime(item.created_at)}
          </span>
        </div>
        {/* Message */}
        <p className="mt-1 text-sm text-gray-300 break-words leading-relaxed">
          {item.message || '—'}
        </p>
        {/* Metadata badges */}
        {item.metadata && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.metadata.model_used && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-white/[0.05] text-gray-500 border border-white/[0.06]">
                {item.metadata.model_used.split('/').pop()}
              </span>
            )}
            {item.metadata.intent && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {item.metadata.intent}
              </span>
            )}
            {item.metadata.response_time_ms && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-white/[0.05] text-gray-500 border border-white/[0.06]">
                {item.metadata.response_time_ms}ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter Bar ──
const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

function FilterBar({ activeFilters, onToggle, onClear }: {
  activeFilters: Set<string>;
  onToggle: (type: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={onClear}
        className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${
          activeFilters.size === 0
            ? 'bg-sky-500/15 text-sky-300 border-sky-500/25'
            : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-gray-300'
        }`}
      >
        Tümü
      </button>
      {ALL_EVENT_TYPES.map(type => {
        const style = getEventStyle(type);
        const active = activeFilters.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-colors ${
              active ? `${style.bg} ${style.color} ${style.border}` : 'bg-white/[0.03] text-gray-600 border-white/[0.06] hover:text-gray-400'
            }`}
          >
            {style.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Stat Card ──
function StatPill({ label, value, color = 'sky' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    red: 'bg-red-500/10 text-red-300 border-red-500/20',
    green: 'bg-green-500/10 text-green-300 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colors[color] || colors.sky}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
    </div>
  );
}

// ── Main Page ──
export default function MCActivityPage() {
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [isPaused, setIsPaused] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const eventTypesArr = filters.size > 0 ? Array.from(filters) : undefined;
  const { data: feedData, isLoading } = useActivityFeed(100, 0, eventTypesArr);
  const { data: stats } = useActivityStats();
  const { liveItems } = useActivitySSE();

  // Merge live SSE items with REST data
  const allItems = useMemo(() => {
    const restItems = feedData?.items || [];
    if (isPaused || liveItems.length === 0) return restItems;

    const seenIds = new Set(restItems.map((i: any) => i.id));
    const newLive = liveItems.filter((i: any) => !seenIds.has(i.id));
    const merged = [...newLive, ...restItems].slice(0, 200);

    // Apply filters to live items too
    if (filters.size > 0) {
      return merged.filter((i: any) => filters.has(i.event_type));
    }
    return merged;
  }, [feedData, liveItems, isPaused, filters]);

  const toggleFilter = (type: string) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Auto-scroll detection
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const handleScroll = () => {
      setIsPaused(el.scrollTop > 50);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Canlı Akış</h1>
            <p className="text-xs text-gray-500 mt-0.5">Tüm sistem olayları gerçek zamanlı</p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <>
                <StatPill label="Bugün" value={stats.events_today} color="sky" />
                <StatPill label="Hata (24s)" value={stats.errors_24h} color="red" />
                <StatPill label="DM" value={stats.dm_today} color="purple" />
                <StatPill label="Canlı" value={stats.active_streams} color="green" />
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/[0.02] rounded-lg border border-white/[0.06] p-3">
          <FilterBar activeFilters={filters} onToggle={toggleFilter} onClear={() => setFilters(new Set())} />
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <button
            onClick={() => { setIsPaused(false); feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="w-full py-2 text-xs text-center text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg hover:bg-sky-500/15 transition-colors"
          >
            ⏸ Akış duraklatıldı — yeni {liveItems.length} olay var. Devam etmek için tıklayın.
          </button>
        )}

        {/* Feed */}
        <div
          ref={feedRef}
          className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 sidebar-scroll"
        >
          {isLoading && allItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block w-6 h-6 border-2 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 mt-3">Yükleniyor...</p>
            </div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-16 bg-white/[0.02] rounded-lg border border-white/[0.06]">
              <p className="text-lg text-gray-400">📡</p>
              <p className="text-sm font-medium text-gray-300 mt-2">Henüz olay yok</p>
              <p className="text-xs text-gray-500 mt-1">Yeni olaylar burada görünecek</p>
            </div>
          ) : (
            allItems.map((item: any) => <FeedCard key={item.id} item={item} />)
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-[10px] text-gray-600">
            SSE ile gerçek zamanlı güncelleme • {allItems.length} olay gösteriliyor
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
