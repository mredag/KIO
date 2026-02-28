import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import {
  useCronJobs,
  useCronJobDetail,
  useToggleCronJob,
  useTriggerCronJob,
  useAuditStatus,
  useAuditHistory,
  useRunAudit,
  useAuditConfig,
  useUpdateAuditConfig,
} from '../../../hooks/useCronApi';

// ── Helpers ──

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-400 shadow-green-400/50',
    stopped: 'bg-gray-500',
    unknown: 'bg-amber-400 shadow-amber-400/50',
    success: 'bg-green-400 shadow-green-400/50',
    failed: 'bg-red-400 shadow-red-400/50',
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shadow-sm ${colors[status] || colors.unknown} ${status === 'active' ? 'animate-pulse' : ''}`}
      role="status"
      aria-label={status}
    />
  );
}

function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    ai: 'bg-purple-900/30 text-purple-300 border-purple-700/50',
    scheduler: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    system: 'bg-gray-800/50 text-gray-300 border-gray-700/50',
    data: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
  };
  const labels: Record<string, string> = {
    ai: 'AI', scheduler: 'Zamanlayıcı', system: 'Sistem', data: 'Veri',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[category] || styles.system}`}>
      {labels[category] || category}
    </span>
  );
}

function cronToHuman(schedule: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length === 6) {
    const secs = parts[0];
    if (secs.startsWith('*/')) return `Her ${secs.replace('*/', '')}s`;
    return `Her ${secs}s`;
  }
  const [min, hour, dom, mon, dow] = parts;
  if (min === '*' && hour === '*') return 'Her dakika';
  if (min.startsWith('*/')) return `Her ${min.replace('*/', '')} dk`;
  if (hour.startsWith('*/')) return `Her ${hour.replace('*/', '')} saat`;
  if (dom === '*' && mon === '*' && dow === '*') {
    return `Her gün ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  return schedule;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) {
    const a = Math.abs(diff);
    if (a < 60000) return `${Math.round(a / 1000)}s sonra`;
    if (a < 3600000) return `${Math.round(a / 60000)}dk sonra`;
    if (a < 86400000) return `${Math.round(a / 3600000)}sa sonra`;
    return `${Math.round(a / 86400000)}g sonra`;
  }
  if (diff < 60000) return `${Math.round(diff / 1000)}s önce`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}dk önce`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}sa önce`;
  return `${Math.round(diff / 86400000)}g önce`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Toggle Switch ──
function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!enabled); }}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? 'bg-green-600' : 'bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`} />
    </button>
  );
}

// ── Job Detail Panel (expanded row) ──
function JobDetailPanel({ jobId, onTrigger, onToggle }: {
  jobId: string;
  onTrigger: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const { data: detail, isLoading } = useCronJobDetail(jobId);

  if (isLoading) {
    return (
      <div className="px-4 py-4 bg-gray-800/30 border-t border-gray-800">
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded bg-gray-700/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const events = detail.recentEvents || [];

  return (
    <div className="px-4 py-4 bg-gray-800/20 border-t border-gray-800/50">
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4">
        {detail.canTrigger && (
          <button
            onClick={(e) => { e.stopPropagation(); onTrigger(detail.id); }}
            className="px-3 py-1.5 rounded-lg bg-purple-900/40 border border-purple-700/40 text-purple-300 hover:bg-purple-800/50 transition-colors text-xs flex items-center gap-1.5"
          >
            ▶ Şimdi Çalıştır
          </button>
        )}
        {detail.canToggle && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">{detail.status === 'active' ? 'Aktif' : 'Durdurulmuş'}</span>
            <ToggleSwitch
              enabled={detail.status === 'active'}
              onChange={(v) => onToggle(detail.id, v)}
            />
          </div>
        )}
        {detail.configEndpoint && (
          <span className="text-[10px] text-gray-500 font-mono ml-auto" title="Config endpoint">
            {detail.configEndpoint}
          </span>
        )}
        {!detail.canTrigger && !detail.canToggle && (
          <span className="text-xs text-gray-500 italic">Bu görev sistem tarafından yönetilir — manuel kontrol yok</span>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg bg-gray-900/50 border border-gray-700/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Zamanlama</p>
          <p className="text-sm text-gray-200 font-mono mt-1">{detail.schedule}</p>
        </div>
        <div className="rounded-lg bg-gray-900/50 border border-gray-700/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Saat Dilimi</p>
          <p className="text-sm text-gray-200 mt-1">{detail.timezone}</p>
        </div>
        <div className="rounded-lg bg-gray-900/50 border border-gray-700/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Son Çalışma</p>
          <p className="text-sm text-gray-200 mt-1">
            {detail.lastRunAt ? formatDateTime(detail.lastRunAt) : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-900/50 border border-gray-700/30 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sonraki Çalışma</p>
          <p className="text-sm text-gray-200 mt-1">
            {detail.nextRunAt ? formatRelativeTime(detail.nextRunAt) : '—'}
          </p>
        </div>
      </div>

      {/* Recent events */}
      {events.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-400 mb-2">Son Olaylar</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {events.map((evt: any) => {
              let meta: any = {};
              try { meta = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata || {}; } catch {}
              const isError = evt.event_type?.includes('error') || evt.event_type?.includes('fail') || evt.event_type?.includes('breach');
              return (
                <div key={evt.id} className="flex items-start gap-2 py-1.5 px-2 rounded bg-gray-900/40 text-xs">
                  <StatusDot status={isError ? 'failed' : 'success'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{evt.message}</p>
                    {meta && Object.keys(meta).length > 0 && (
                      <p className="text-gray-600 truncate mt-0.5 font-mono text-[10px]">
                        {JSON.stringify(meta).substring(0, 120)}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 whitespace-nowrap flex-shrink-0">
                    {evt.created_at ? formatDateTime(evt.created_at) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {events.length === 0 && (
        <p className="text-xs text-gray-600 italic">Bu görev için henüz olay kaydı yok</p>
      )}
    </div>
  );
}

// ── Audit Detail Panel ──
function AuditPanel() {
  const { data: status } = useAuditStatus();
  const { data: history } = useAuditHistory(5);
  const { data: config } = useAuditConfig();
  const updateConfig = useUpdateAuditConfig();
  const runAudit = useRunAudit();
  const [showConfig, setShowConfig] = useState(false);

  const lastRun = status?.lastRun;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🔍</span> Gece DM Denetimi
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors text-xs"
          >
            ⚙️
          </button>
          <button
            onClick={() => runAudit.mutate()}
            disabled={runAudit.isPending || status?.isRunning}
            className="px-3 py-1.5 rounded-lg bg-purple-900/50 border border-purple-700/50 text-purple-300 hover:bg-purple-800/50 transition-colors text-xs disabled:opacity-50"
          >
            {runAudit.isPending || status?.isRunning ? '⏳ Çalışıyor...' : '▶ Şimdi Çalıştır'}
          </button>
        </div>
      </div>

      {lastRun && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg border-l-4 border-green-500/50 bg-green-900/10 p-3">
            <p className="text-xs text-gray-400">Doğru</p>
            <p className="text-xl font-bold text-green-300">{lastRun.grounded ?? 0}</p>
          </div>
          <div className="rounded-lg border-l-4 border-amber-500/50 bg-amber-900/10 p-3">
            <p className="text-xs text-gray-400">Kısmi</p>
            <p className="text-xl font-bold text-amber-300">{lastRun.partiallyGrounded ?? 0}</p>
          </div>
          <div className="rounded-lg border-l-4 border-red-500/50 bg-red-900/10 p-3">
            <p className="text-xs text-gray-400">Uydurma</p>
            <p className="text-xl font-bold text-red-300">{lastRun.hallucinated ?? 0}</p>
          </div>
          <div className="rounded-lg border-l-4 border-sky-500/50 bg-sky-900/10 p-3">
            <p className="text-xs text-gray-400">İncelenen</p>
            <p className="text-xl font-bold text-sky-300">{lastRun.audited ?? 0}</p>
          </div>
        </div>
      )}

      {showConfig && config && (
        <div className="mb-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700/50 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-xs text-gray-400">Zamanlama</label>
              <p className="text-gray-200 font-mono">{config.cronSchedule}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">Model</label>
              <p className="text-gray-200 font-mono text-xs">{config.model}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">Maks Yanıt</label>
              <p className="text-gray-200">{config.maxResponsesPerAudit}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400">Geriye Bakış</label>
              <p className="text-gray-200">{config.lookbackHours} saat</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
            <span className="text-sm text-gray-300">Aktif</span>
            <ToggleSwitch
              enabled={config.enabled}
              onChange={(v) => updateConfig.mutate({ enabled: v })}
            />
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">Son Denetimler</h3>
        {history?.length > 0 ? (
          <div className="space-y-1.5">
            {history.map((h: any, i: number) => {
              let meta: any = {};
              try { meta = typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata || {}; } catch {}
              return (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/50 text-sm">
                  <div className="flex items-center gap-2">
                    <StatusDot status={meta.hallucinated > 0 ? 'failed' : 'success'} />
                    <span className="text-gray-300">{h.message}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {h.created_at ? formatDateTime(h.created_at) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Henüz denetim yapılmadı</p>
        )}
      </div>

      {runAudit.data && (
        <div className="mt-3 p-3 rounded-lg bg-purple-900/20 border border-purple-700/30 text-sm">
          <p className="text-purple-300">
            ✅ Denetim tamamlandı: {runAudit.data.audited} incelendi,{' '}
            {runAudit.data.grounded} doğru, {runAudit.data.hallucinated} uydurma,{' '}
            {runAudit.data.jobsCreated} görev oluşturuldu
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function MCCronPage() {
  const { data: jobs, isLoading } = useCronJobs();
  const toggleJob = useToggleCronJob();
  const triggerJob = useTriggerCronJob();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ jobId: string; message: string } | null>(null);

  const categories = ['ai', 'scheduler', 'system', 'data'];
  const categoryLabels: Record<string, string> = {
    ai: '🤖 AI Ajanlar',
    scheduler: '📋 Zamanlayıcılar',
    system: '🔧 Sistem Bakım',
    data: '💾 Veri İşlemleri',
  };

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = (jobs || []).filter((j: any) => j.category === cat);
    return acc;
  }, {} as Record<string, any[]>);

  const totalActive = (jobs || []).filter((j: any) => j.status === 'active').length;
  const totalStopped = (jobs || []).filter((j: any) => j.status === 'stopped').length;
  const totalJobs = (jobs || []).length;

  const handleToggle = (jobId: string, enabled: boolean) => {
    toggleJob.mutate({ jobId, enabled });
  };

  const handleTrigger = (jobId: string) => {
    setTriggerResult(null);
    triggerJob.mutate(jobId, {
      onSuccess: (data) => {
        setTriggerResult({ jobId, message: data.message || 'Görev tetiklendi' });
        setTimeout(() => setTriggerResult(null), 5000);
      },
      onError: (err) => {
        setTriggerResult({ jobId, message: `Hata: ${err.message}` });
        setTimeout(() => setTriggerResult(null), 5000);
      },
    });
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="text-3xl">⏰</span>
              Zamanlanmış Görevler
            </h1>
            <p className="text-gray-400 mt-1">
              {totalJobs} görev — {totalActive} aktif
              {totalStopped > 0 && <span className="text-red-400"> · {totalStopped} durdurulmuş</span>}
              <span className="text-gray-600 ml-2">· Detay için satıra tıklayın</span>
            </p>
          </div>
        </div>

        {/* Trigger result toast */}
        {triggerResult && (
          <div className="mb-4 p-3 rounded-lg bg-purple-900/20 border border-purple-700/30 text-sm text-purple-300 flex items-center gap-2 animate-fade-in">
            <span>✅</span> {triggerResult.message}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Job List */}
        {!isLoading && (
          <div className="space-y-6 mb-8">
            {categories.map(cat => {
              const catJobs = grouped[cat];
              if (!catJobs || catJobs.length === 0) return null;
              return (
                <div key={cat}>
                  <h2 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    {categoryLabels[cat]}
                    <span className="text-xs text-gray-600">({catJobs.length})</span>
                  </h2>
                  <div className="bg-gray-900 rounded-lg border border-gray-700 divide-y divide-gray-800/50 overflow-hidden">
                    {catJobs.map((job: any) => {
                      const isExpanded = expandedId === job.id;
                      return (
                        <div key={job.id}>
                          <div
                            className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                              isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-800/20'
                            }`}
                            onClick={() => setExpandedId(isExpanded ? null : job.id)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : job.id); } }}
                          >
                            {/* Expand chevron */}
                            <svg
                              className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>

                            {/* Status dot */}
                            <StatusDot status={job.status} />

                            {/* Name + description */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-200">{job.name}</span>
                                <CategoryBadge category={job.category} />
                                {job.canTrigger && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400 border border-purple-800/30">
                                    tetiklenebilir
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{job.description}</p>
                            </div>

                            {/* Schedule */}
                            <div className="hidden sm:block text-right flex-shrink-0">
                              <span className="text-xs font-mono text-gray-500" title={job.schedule}>
                                {cronToHuman(job.schedule)}
                              </span>
                              {job.timezone !== 'system' && (
                                <p className="text-[10px] text-gray-600">{job.timezone}</p>
                              )}
                            </div>

                            {/* Last run */}
                            <div className="hidden md:block text-right w-28 flex-shrink-0">
                              {job.lastRunAt ? (
                                <div>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <StatusDot status={job.lastRunStatus} />
                                    <span className="text-xs text-gray-400">{formatRelativeTime(job.lastRunAt)}</span>
                                  </div>
                                  {job.lastRunDetail && (
                                    <p className="text-[10px] text-gray-600 truncate mt-0.5" title={job.lastRunDetail}>
                                      {job.lastRunDetail.substring(0, 40)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-600">—</span>
                              )}
                            </div>

                            {/* Next run */}
                            <div className="hidden lg:block text-right w-24 flex-shrink-0">
                              <span className="text-xs text-gray-500">
                                {job.nextRunAt ? formatRelativeTime(job.nextRunAt) : '—'}
                              </span>
                            </div>

                            {/* Quick toggle (for toggleable jobs) */}
                            {job.canToggle && (
                              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <ToggleSwitch
                                  enabled={job.status === 'active'}
                                  onChange={(v) => handleToggle(job.id, v)}
                                  disabled={toggleJob.isPending}
                                />
                              </div>
                            )}
                          </div>

                          {/* Expanded detail panel */}
                          {isExpanded && (
                            <JobDetailPanel
                              jobId={job.id}
                              onTrigger={handleTrigger}
                              onToggle={handleToggle}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Audit Detail Panel */}
        <AuditPanel />
      </div>
    </AdminLayout>
  );
}
