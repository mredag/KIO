import { useState, useMemo } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useMCDashboard, useMCSchedulerStatus, useDispatchNow, useMCMetrics, useMCComparison } from '../../../hooks/useMissionControlApi';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { PrefetchLink } from '../../../components/PrefetchLink';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type RangeKey = '24h' | '3d' | '7d' | '14d' | '1m' | '3m';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '24h', label: '24 Saat' },
  { value: '3d', label: '3 Gün' },
  { value: '7d', label: '7 Gün' },
  { value: '14d', label: '14 Gün' },
  { value: '1m', label: '1 Ay' },
  { value: '3m', label: '3 Ay' },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    operational: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    down: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.operational}`}>
      {status === 'operational' ? ' Çalışıyor' : status === 'degraded' ? ' Yavaş' : ' Kapalı'}
    </span>
  );
}

function StatCard({ label, value, sub, href, color = 'sky' }: { label: string; value: number | string; sub?: string; href?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    sky: 'border-sky-500 bg-sky-50 dark:bg-sky-900/10',
    green: 'border-green-500 bg-green-50 dark:bg-green-900/10',
    red: 'border-red-500 bg-red-50 dark:bg-red-900/10',
    amber: 'border-amber-500 bg-amber-50 dark:bg-amber-900/10',
    purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/10',
    indigo: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10',
  };
  const card = (
    <div className={`rounded-lg border-l-4 ${colorMap[color] || colorMap.sky} p-4 hover:shadow-md transition-shadow`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-1">{value ?? 0}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
  return href ? <PrefetchLink to={href} className="block">{card}</PrefetchLink> : card;
}

function SchedulerWidget() {
  const { data: scheduler } = useMCSchedulerStatus();
  const dispatchNow = useDispatchNow();
  if (!scheduler) return null;
  return (
    <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${scheduler.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Scheduler {scheduler.isRunning ? 'Aktif' : 'Kapalı'}
          </h3>
        </div>
        <button
          onClick={() => dispatchNow.mutate()}
          disabled={dispatchNow.isPending}
          className="px-3 py-1 text-xs bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50 transition-colors"
        >
          {dispatchNow.isPending ? '...' : 'Dispatch Now'}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-lg font-bold text-sky-400">{scheduler.dispatched}</p>
          <p className="text-[10px] text-gray-500 uppercase">Dispatched</p>
        </div>
        <div>
          <p className="text-lg font-bold text-amber-400">{scheduler.slaBreaches}</p>
          <p className="text-[10px] text-gray-500 uppercase">SLA Breach</p>
        </div>
        <div>
          <p className="text-lg font-bold text-red-400">{scheduler.deadLettered}</p>
          <p className="text-[10px] text-gray-500 uppercase">Dead Letter</p>
        </div>
        <div>
          <p className="text-xs font-mono text-gray-400 mt-1">
            {scheduler.lastRunAt
              ? new Date(scheduler.lastRunAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '--:--:--'}
          </p>
          <p className="text-[10px] text-gray-500 uppercase">Son Çalışma</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Chart Tooltip ─── */
function ChartTooltipContent({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-gray-900/95 px-3 py-2 text-xs text-gray-200 shadow-lg border border-gray-700">
      {label && <div className="text-gray-400 mb-1">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="font-semibold text-gray-100">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="h-52">{children}</div>
    </div>
  );
}

function KpiCard({ label, value, icon, color, trend, progress }: { label: string; value: string; icon: string; color: string; trend?: number; progress?: number }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const barColorMap: Record<string, string> = {
    blue: 'bg-blue-400/60', green: 'bg-emerald-400/60', red: 'bg-red-400/60', amber: 'bg-amber-400/60',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold">{value}</p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-medium mb-1 ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColorMap[color] || barColorMap.blue}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/* ─── Metrics Charts Section ─── */
function MetricsSection() {
  const [range, setRange] = useState<RangeKey>('7d');
  const { data: metrics, isLoading } = useMCMetrics(range);
  const rangeDays = range === '24h' ? 1 : range === '3d' ? 3 : range === '7d' ? 7 : range === '14d' ? 14 : range === '1m' ? 30 : 90;
  const { data: comparison } = useMCComparison(rangeDays);

  const throughput = useMemo(() => (metrics?.throughput || []).map((p: any) => ({ period: p.period, value: p.value })), [metrics]);
  const errorRate = useMemo(() => (metrics?.error_rate || []).map((p: any) => ({ period: p.period, value: p.value })), [metrics]);
  const costSeries = useMemo(() => (metrics?.cost_series || []).map((p: any) => ({ period: p.period, value: Math.round(p.value * 10000) / 10000, tokens: p.tokens })), [metrics]);
  const cycleTime = useMemo(() => (metrics?.cycle_time || []).map((p: any) => ({ period: p.period, value: p.value })), [metrics]);
  const wip = useMemo(() => (metrics?.wip || []).map((p: any) => ({ period: p.period, queued: p.queued, running: p.running, completed: p.completed, failed: p.failed })), [metrics]);

  const kpis = metrics?.kpis;

  // Calculate trends from comparison data
  const calcTrend = (curr: number, prev: number) => {
    if (!prev || prev === 0) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const formatPeriod = (val: string) => {
    if (!val) return '';
    if (val.includes('T')) return val.split('T')[1]?.replace(':00:00', 'h') || val;
    if (val.includes('-W')) return val;
    const parts = val.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    return val;
  };

  return (
    <div className="space-y-4">
      {/* Range selector + KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">📊 Metrikler</h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                range === opt.value
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards with trends */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Aktif Ajanlar" value={String(kpis.active_agents)} icon="🤖" color="blue" progress={kpis.active_agents > 0 ? Math.min(kpis.active_agents * 20, 100) : 0} />
          <KpiCard label="Çalışan İşler" value={String(kpis.jobs_in_progress)} icon="⚡" color="green"
            trend={comparison ? calcTrend(comparison.current?.jobs || 0, comparison.previous?.jobs || 0) : undefined}
            progress={kpis.jobs_in_progress > 0 ? Math.min(kpis.jobs_in_progress * 10, 100) : 0} />
          <KpiCard label="Hata Oranı" value={`${kpis.error_rate_pct}%`} icon="⚠️" color="red"
            trend={comparison ? calcTrend(comparison.current?.failed || 0, comparison.previous?.failed || 0) : undefined}
            progress={kpis.error_rate_pct} />
          <KpiCard label="Ort. Cycle Time" value={kpis.median_cycle_time_hours !== null ? `${kpis.median_cycle_time_hours}h` : '--'} icon="⏱️" color="amber" />
        </div>
      )}

      {/* Comparison summary */}
      {comparison && (
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2 py-1 rounded-md bg-white/[0.03] text-gray-500">
            Son {comparison.days}g: {comparison.current?.jobs || 0} iş, {comparison.current?.dms || 0} DM
          </span>
          <span className="px-2 py-1 rounded-md bg-white/[0.03] text-gray-500">
            Önceki {comparison.days}g: {comparison.previous?.jobs || 0} iş, {comparison.previous?.dms || 0} DM
          </span>
          {comparison.current?.cost > 0 && (
            <span className="px-2 py-1 rounded-md bg-white/[0.03] text-gray-500">
              Maliyet: ${comparison.current.cost.toFixed(4)} ({comparison.previous?.cost > 0 ? `${calcTrend(comparison.current.cost, comparison.previous.cost) > 0 ? '+' : ''}${calcTrend(comparison.current.cost, comparison.previous.cost)}%` : 'yeni'})
            </span>
          )}
        </div>
      )}

      {isLoading && !metrics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} height="h-64" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Throughput */}
          <ChartCard title="Tamamlanan İşler" subtitle="Throughput">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={throughput} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#374151" strokeOpacity={0.3} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={32} />
                <Tooltip content={<ChartTooltipContent formatter={(v: number) => `${v} iş`} />} />
                <Bar dataKey="value" name="Tamamlanan" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cycle Time */}
          <ChartCard title="Ortalama Süre" subtitle="Cycle time (saat)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cycleTime} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#374151" strokeOpacity={0.3} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={32} />
                <Tooltip content={<ChartTooltipContent formatter={(v: number) => `${v}h`} />} />
                <Line type="monotone" dataKey="value" name="Saat" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Error Rate */}
          <ChartCard title="Hata Oranı" subtitle="Error rate (%)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={errorRate} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#374151" strokeOpacity={0.3} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={32} />
                <Tooltip content={<ChartTooltipContent formatter={(v: number) => `${v}%`} />} />
                <Line type="monotone" dataKey="value" name="Hata %" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* WIP Distribution */}
          <ChartCard title="İş Dağılımı" subtitle="Work in progress">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={wip} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#374151" strokeOpacity={0.3} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={32} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                <Area type="monotone" dataKey="queued" name="Kuyruk" stackId="wip" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.6} />
                <Area type="monotone" dataKey="running" name="Çalışan" stackId="wip" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="completed" name="Tamamlanan" stackId="wip" fill="#10b981" stroke="#10b981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="failed" name="Başarısız" stackId="wip" fill="#ef4444" stroke="#ef4444" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cost Series */}
          <ChartCard title="API Maliyeti" subtitle="Dönemsel maliyet ($)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costSeries} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#374151" strokeOpacity={0.3} />
                <XAxis dataKey="period" tickFormatter={formatPeriod} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={40} />
                <Tooltip content={<ChartTooltipContent formatter={(v: number) => `$${v.toFixed(4)}`} />} />
                <Bar dataKey="value" name="Maliyet" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

export default function MCDashboardPage() {
  const { data, isLoading, error } = useMCDashboard();

  if (isLoading) {
    return (
      <AdminLayout>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Sistem Durumu v3.0</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} height="h-24" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Sistem Durumu v3.0</h1>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">Bağlantı hatası. Backend çalışıyor mu?</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const d = data || {};
  const agents = d.agents || {};
  const jobs = d.jobs || {};
  const conversations = d.conversations || {};
  const cost = d.cost || { today: { cost: 0, tokens: 0 }, total: { cost: 0, tokens: 0 } };
  const events = d.recent_events || [];
  const interactions = d.recent_interactions || [];
  const igStats = d.instagram_dm_stats || {};

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Sistem Durumu v3.0</h1>
          <StatusBadge status={d.system_status || 'operational'} />
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Aktif Ajanlar" value={agents.active || 0} sub={`/ ${agents.total || 0} toplam`} href="/admin/mc/agents" color="green" />
          <StatCard label="Kuyruk Derinliği" value={jobs.queue_depth || 0} sub={`${jobs.active_runs || 0} çalışıyor`} href="/admin/mc/workshop" color="sky" />
          <StatCard label="Başarısız İşler" value={jobs.failed || 0} sub={`${jobs.dead_letter || 0} dead-letter`} href="/admin/mc/workshop" color="red" />
          <StatCard label="Aktif Konuşmalar" value={conversations.active || 0} sub={`${conversations.total || 0} toplam`} href="/admin/mc/conversations" color="purple" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Bugünkü Maliyet" value={`${(cost.today?.cost || 0).toFixed(4)}`} sub={`${(cost.today?.tokens || 0).toLocaleString()} token`} href="/admin/mc/costs" color="amber" />
          <StatCard label="Toplam Maliyet" value={`${(cost.total?.cost || 0).toFixed(4)}`} sub={`${(cost.total?.tokens || 0).toLocaleString()} token`} href="/admin/mc/costs" color="amber" />
          <StatCard label="Tamamlanan İşler" value={jobs.completed || 0} color="green" />
          <StatCard label="Toplam İşler" value={jobs.total || 0} color="indigo" />
        </div>

        {/* Instagram DM Stats */}
        <div className="mb-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">INSTAGRAM DM</span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2 mb-2">
            <StatCard label="Bugünkü DM" value={igStats.total_today || 0} color="purple" />
            <StatCard label="Ort. Yanıt Süresi" value={`${igStats.avg_response_ms || 0}ms`} color="sky" />
            <StatCard label="DM Maliyeti" value={`${(igStats.cost_today || 0).toFixed(4)}`} color="amber" />
            <StatCard label="Tekil Gönderici" value={igStats.unique_senders || 0} color="green" />
          </div>
          {igStats.model_distribution?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {igStats.model_distribution.map((m: any) => (
                <span key={m.model_used} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] text-gray-600 dark:text-gray-400">
                  {m.model_used?.split('/').pop()}: {m.count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Scheduler Status */}
        <SchedulerWidget />

        {/* ═══ NEW: Time-Series Metrics Charts ═══ */}
        <MetricsSection />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 my-6">
          <PrefetchLink to="/admin/mc/workshop" className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors"> Workshop</PrefetchLink>
          <PrefetchLink to="/admin/mc/agents" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"> Ajanlar</PrefetchLink>
          <PrefetchLink to="/admin/mc/documents" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"> Dokümanlar</PrefetchLink>
          <PrefetchLink to="/admin/mc/costs" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"> API Kullanımı</PrefetchLink>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors flex items-center gap-1.5"
          >
             Ara <kbd className="text-[10px] font-mono bg-gray-800 px-1 py-0.5 rounded">Ctrl+K</kbd>
          </button>
        </div>

        {/* Activity Feed + Recent Interactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Events Timeline */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4"> Son Olaylar</h2>
            {events.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Henüz olay yok</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {events.slice(0, 15).map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400 dark:text-gray-500 whitespace-nowrap text-xs mt-0.5">
                      {new Date(ev.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs mr-2 ${
                        ev.event_type === 'created' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        ev.event_type === 'status_change' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        ev.event_type === 'sla_breach' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        ev.event_type === 'auto_dispatched' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' :
                        ev.event_type?.includes('error') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {ev.entity_type}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 break-words">{ev.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Recent Instagram Interactions */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4"> Son Instagram Mesajları</h2>
            {interactions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Henüz mesaj yok</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {interactions.slice(0, 10).map((msg: any) => (
                  <div key={msg.id} className="border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        msg.direction === 'inbound' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      }`}>
                        {msg.direction === 'inbound' ? ' Gelen' : ' Giden'}
                      </span>
                      {msg.intent && msg.direction === 'inbound' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {msg.intent}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                        {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{msg.message_text}</p>
                    {msg.ai_response && msg.ai_response !== msg.message_text && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1"> {msg.ai_response}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Her 10 saniyede otomatik yenilenir  <kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[10px]">Ctrl+K</kbd> ile hızlı arama
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
