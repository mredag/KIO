import AdminLayout from '../../layouts/AdminLayout';
import { useDashboard, useAlerts } from '../../hooks/useAdminApi';
import { useMCDashboard, useMCSchedulerStatus, useDispatchNow } from '../../hooks/useMissionControlApi';
import { formatRelativeTime } from '../../lib/dateFormatter';
import { useTranslation } from 'react-i18next';
import { PrefetchLink } from '../../components/PrefetchLink';
import { SkeletonCard } from '../../components/ui/Skeleton';

function GlassStat({ label, value, sub, href, accent = 'sky' }: {
  label: string; value: number | string; sub?: string; href?: string; accent?: string;
}) {
  const accentMap: Record<string, string> = {
    sky: 'from-sky-500/20 to-sky-500/0 border-sky-500/20',
    green: 'from-emerald-500/20 to-emerald-500/0 border-emerald-500/20',
    red: 'from-red-500/20 to-red-500/0 border-red-500/20',
    amber: 'from-amber-500/20 to-amber-500/0 border-amber-500/20',
    purple: 'from-purple-500/20 to-purple-500/0 border-purple-500/20',
    indigo: 'from-indigo-500/20 to-indigo-500/0 border-indigo-500/20',
  };
  const card = (
    <div className={`glass-panel p-4 bg-gradient-to-br ${accentMap[accent]} transition-all duration-300 hover:scale-[1.02]`}>
      <p className="mc-label mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-100 tracking-tight">{value ?? 0}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
  return href ? <PrefetchLink to={href} className="block">{card}</PrefetchLink> : card;
}

function SchedulerMini() {
  const { data: scheduler } = useMCSchedulerStatus();
  const dispatchNow = useDispatchNow();
  if (!scheduler) return null;
  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${scheduler.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="mc-label">Scheduler</span>
        </div>
        <button
          onClick={() => dispatchNow.mutate()}
          disabled={dispatchNow.isPending}
          className="mc-btn mc-btn--primary text-[11px] px-2.5 py-1"
        >
          {dispatchNow.isPending ? '...' : 'Dispatch'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { v: scheduler.dispatched, l: 'Dispatched', c: 'text-sky-400' },
          { v: scheduler.slaBreaches, l: 'SLA Breach', c: 'text-amber-400' },
          { v: scheduler.deadLettered, l: 'Dead Letter', c: 'text-red-400' },
          { v: scheduler.lastRunAt ? new Date(scheduler.lastRunAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--', l: 'Son Çalışma', c: 'text-gray-400 font-mono text-xs' },
        ].map((s, i) => (
          <div key={i}>
            <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
            <p className="text-[9px] text-gray-600 uppercase tracking-wider">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t: _t } = useTranslation(['admin', 'common']);
  void _t; // keep i18n loaded
  const { data: status, isLoading } = useDashboard(true);
  const { data: alerts } = useAlerts(true);
  const { data: mcData, isLoading: mcLoading } = useMCDashboard();

  if (isLoading || mcLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} height="h-20" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const d = mcData || {} as any;
  const agents = d.agents || {};
  const jobs = d.jobs || {};
  const conversations = d.conversations || {};
  const cost = d.cost || { today: { cost: 0, tokens: 0 }, total: { cost: 0, tokens: 0 } };
  const events = d.recent_events || [];
  const interactions = d.recent_interactions || [];
  const igStats = d.instagram_dm_stats || {};

  return (
    <AdminLayout>
      <div className="space-y-5 mc-fade-up">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100 tracking-tight">Komuta Merkezi</h1>
            <p className="text-xs text-gray-500 mt-0.5">Sistem durumu ve operasyonel özet</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
              d.system_status === 'operational'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${d.system_status === 'operational' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {d.system_status === 'operational' ? 'Çalışıyor' : 'Sorun Var'}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="glass-panel p-4 border-l-2 border-l-amber-500/60">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400">⚠️</span>
              <span className="text-xs font-medium text-amber-300">Dikkat ({alerts.length})</span>
            </div>
            <div className="space-y-1.5">
              {alerts.slice(0, 3).map((alert: any) => (
                <PrefetchLink key={alert.id} to={`/admin/surveys/${alert.surveyId}/analytics`}
                  className="block text-xs text-gray-400 hover:text-gray-200 transition-colors truncate">
                  {alert.surveyTitle} — {alert.type === 'low_rating' ? `Puan: ${alert.answer}/5` : alert.answer}
                  <span className="text-gray-600 ml-2">{formatRelativeTime(alert.timestamp)}</span>
                </PrefetchLink>
              ))}
            </div>
          </div>
        )}

        {/* MC Stats Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassStat label="Aktif Ajanlar" value={agents.active || 0} sub={`/ ${agents.total || 0} toplam`} href="/admin/mc/agents" accent="green" />
          <GlassStat label="Kuyruk Derinliği" value={jobs.queue_depth || 0} sub={`${jobs.active_runs || 0} çalışıyor`} href="/admin/mc/workshop" accent="sky" />
          <GlassStat label="Başarısız İşler" value={jobs.failed || 0} sub={`${jobs.dead_letter || 0} dead-letter`} href="/admin/mc/workshop" accent="red" />
          <GlassStat label="Aktif Konuşmalar" value={conversations.active || 0} sub={`${conversations.total || 0} toplam`} href="/admin/mc/conversations" accent="purple" />
        </div>

        {/* MC Stats Row 2 + Business Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <GlassStat label="Bugünkü Maliyet" value={`$${(cost.today?.cost || 0).toFixed(4)}`} sub={`${(cost.today?.tokens || 0).toLocaleString()} token`} href="/admin/mc/costs" accent="amber" />
          <GlassStat label="Toplam Maliyet" value={`$${(cost.total?.cost || 0).toFixed(4)}`} sub={`${(cost.total?.tokens || 0).toLocaleString()} token`} href="/admin/mc/costs" accent="amber" />
          <GlassStat label="Anketler" value={status?.totalSurveyCount || 0} sub={`${status?.todaySurveyCount || 0} bugün`} href="/admin/survey-responses" accent="indigo" />
          <GlassStat label="Aktif Kuponlar" value={status?.activeCoupons || 0} href="/admin/coupons/redemptions" accent="green" />
        </div>

        {/* Instagram DM Stats */}
        <div>
          <span className="mc-label text-[9px] ml-1">INSTAGRAM DM</span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            <GlassStat label="Bugünkü DM" value={igStats.total_today || 0} accent="purple" />
            <GlassStat label="Ort. Yanıt Süresi" value={`${igStats.avg_response_ms || 0}ms`} accent="sky" />
            <GlassStat label="DM Maliyeti" value={`$${(igStats.cost_today || 0).toFixed(4)}`} accent="amber" />
            <GlassStat label="Tekil Gönderici" value={igStats.unique_senders || 0} accent="green" />
          </div>
          {igStats.model_distribution?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
              {igStats.model_distribution.map((m: any) => (
                <span key={m.model_used} className="px-2 py-0.5 rounded-full text-[10px] text-gray-400 bg-white/[0.04] border border-white/[0.06]">
                  {m.model_used?.split('/').pop()}: {m.count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Scheduler */}
        <SchedulerMini />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {[
            { to: '/admin/mc/workshop', label: 'Workshop', color: 'bg-sky-600 hover:bg-sky-700' },
            { to: '/admin/mc/agents', label: 'Ajanlar', color: 'bg-indigo-600 hover:bg-indigo-700' },
            { to: '/admin/mc/jarvis', label: 'Jarvis AI', color: 'bg-purple-600 hover:bg-purple-700' },
            { to: '/admin/mc/costs', label: 'API Kullanımı', color: 'bg-amber-600 hover:bg-amber-700' },
          ].map(a => (
            <PrefetchLink key={a.to} to={a.to} className={`px-3 py-1.5 ${a.color} text-white rounded-lg text-xs font-medium transition-colors`}>
              {a.label}
            </PrefetchLink>
          ))}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="px-3 py-1.5 bg-white/[0.06] text-gray-400 rounded-lg text-xs font-medium hover:bg-white/[0.1] transition-colors flex items-center gap-1.5"
          >
            Ara <kbd className="text-[9px] font-mono bg-white/[0.06] px-1 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>

        {/* Activity Feed + Instagram Messages */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Events */}
          <div className="glass-panel p-4">
            <h2 className="mc-label mb-3">SON OLAYLAR</h2>
            {events.length === 0 ? (
              <p className="text-xs text-gray-600">Henüz olay yok</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto sidebar-scroll">
                {events.slice(0, 12).map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                    <span className="text-gray-600 whitespace-nowrap font-mono text-[10px] mt-0.5">
                      {new Date(ev.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1.5 ${
                        ev.event_type === 'created' ? 'bg-emerald-500/10 text-emerald-400' :
                        ev.event_type === 'status_change' ? 'bg-sky-500/10 text-sky-400' :
                        ev.event_type === 'sla_breach' ? 'bg-amber-500/10 text-amber-400' :
                        ev.event_type === 'auto_dispatched' ? 'bg-cyan-500/10 text-cyan-400' :
                        ev.event_type?.includes('error') ? 'bg-red-500/10 text-red-400' :
                        'bg-white/[0.04] text-gray-400'
                      }`}>
                        {ev.entity_type}
                      </span>
                      <span className="text-gray-400 break-words">{ev.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instagram Messages */}
          <div className="glass-panel p-4">
            <h2 className="mc-label mb-3">SON INSTAGRAM MESAJLARI</h2>
            {interactions.length === 0 ? (
              <p className="text-xs text-gray-600">Henüz mesaj yok</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto sidebar-scroll">
                {interactions.slice(0, 10).map((msg: any) => (
                  <div key={msg.id} className="border-b border-white/[0.04] pb-2 last:border-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        msg.direction === 'inbound' ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {msg.direction === 'inbound' ? '← Gelen' : '→ Giden'}
                      </span>
                      {msg.intent && msg.direction === 'inbound' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{msg.intent}</span>
                      )}
                      <span className="text-[10px] text-gray-600 ml-auto font-mono">
                        {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{msg.message_text}</p>
                    {msg.ai_response && msg.ai_response !== msg.message_text && (
                      <p className="text-[11px] text-gray-600 truncate mt-0.5">↳ {msg.ai_response}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-[10px] text-gray-600 font-mono">
            AUTO-REFRESH 10s · <kbd className="bg-white/[0.04] px-1 py-0.5 rounded">⌘K</kbd> HIZLI ARAMA
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}


