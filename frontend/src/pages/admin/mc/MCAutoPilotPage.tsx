import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import {
  useAutoPilotStatus,
  useAutoPilotConfig,
  useUpdateAutoPilotConfig,
  useStartAutoPilot,
  useStopAutoPilot,
  useAutoPilotHistory,
} from '../../../hooks/useAutoPilotApi';
import { useAutoPilotSSE } from '../../../hooks/useAutoPilotSSE';

function StatusBadge({ running }: { running: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
      running
        ? 'bg-green-900/30 text-green-300 border border-green-700/50'
        : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
    }`}>
      <span className={`w-2 h-2 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
      {running ? 'Çalışıyor' : 'Durduruldu'}
    </span>
  );
}

function StatCard({ label, value, color = 'sky' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    sky: 'border-sky-500/50 bg-sky-900/10',
    green: 'border-green-500/50 bg-green-900/10',
    red: 'border-red-500/50 bg-red-900/10',
    amber: 'border-amber-500/50 bg-amber-900/10',
    purple: 'border-purple-500/50 bg-purple-900/10',
  };
  return (
    <div className={`rounded-lg border-l-4 ${colors[color] || colors.sky} p-4`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-50 mt-1">{value ?? 0}</p>
    </div>
  );
}

function TriggerToggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-green-600' : 'bg-gray-600'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </label>
  );
}

function EventIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    autopilot_started: '🚀',
    autopilot_completed: '✅',
    autopilot_failed: '❌',
    autopilot_created: '📋',
    autopilot_error: '⚠️',
    auto_approved: '🤖',
    needs_review: '👁️',
  };
  return <span className="text-lg">{icons[type] || '📌'}</span>;
}

export default function MCAutoPilotPage() {
  useAutoPilotSSE();
  const { data: status, isLoading: statusLoading } = useAutoPilotStatus();
  const { data: config } = useAutoPilotConfig();
  const { data: history } = useAutoPilotHistory(30);
  const updateConfig = useUpdateAutoPilotConfig();
  const startAP = useStartAutoPilot();
  const stopAP = useStopAutoPilot();
  const [showConfig, setShowConfig] = useState(false);

  const isRunning = status?.isRunning ?? false;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              AutoPilot
              <StatusBadge running={isRunning} />
            </h1>
            <p className="text-gray-400 mt-1">Otonom ajan yürütme motoru — görevleri otomatik algılar ve yürütür</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
            >
              ⚙️ Ayarlar
            </button>
            {isRunning ? (
              <button
                onClick={() => stopAP.mutate()}
                disabled={stopAP.isPending}
                className="px-4 py-2 rounded-lg bg-red-900/50 border border-red-700/50 text-red-300 hover:bg-red-800/50 transition-colors text-sm"
              >
                ⏹ Durdur
              </button>
            ) : (
              <button
                onClick={() => startAP.mutate()}
                disabled={startAP.isPending}
                className="px-4 py-2 rounded-lg bg-green-900/50 border border-green-700/50 text-green-300 hover:bg-green-800/50 transition-colors text-sm"
              >
                ▶ Başlat
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {statusLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Toplam Tarama" value={status?.totalScans ?? 0} color="sky" />
            <StatCard label="Gönderilen" value={status?.totalDispatched ?? 0} color="purple" />
            <StatCard label="Tamamlanan" value={status?.totalCompleted ?? 0} color="green" />
            <StatCard label="Başarısız" value={status?.totalFailed ?? 0} color="red" />
            <StatCard label="Aktif İş" value={status?.activeJobs ?? 0} color="amber" />
          </div>
        )}

        {/* Config Panel */}
        {showConfig && config && (
          <div className="mb-6 bg-gray-900 rounded-lg border border-gray-700 p-5">
            <h2 className="text-lg font-semibold mb-4">⚙️ AutoPilot Ayarları</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Genel</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Tarama Aralığı</span>
                    <span className="text-sm text-gray-400">{config.scanIntervalSeconds}s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Maks Eşzamanlı İş</span>
                    <span className="text-sm text-gray-400">{config.maxConcurrentJobs}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Oto-Onay Eşiği</span>
                    <span className="text-sm text-gray-400">{(config.autoApproveThreshold * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Tetikleyiciler</h3>
                <TriggerToggle
                  label="Zamanlanmış Görevler"
                  enabled={config.enabledTriggers?.scheduledJobs ?? true}
                  onChange={(v) => updateConfig.mutate({ enabledTriggers: { scheduledJobs: v } })}
                />
                <TriggerToggle
                  label="DM Pipeline Hataları"
                  enabled={config.enabledTriggers?.dmFailures ?? true}
                  onChange={(v) => updateConfig.mutate({ enabledTriggers: { dmFailures: v } })}
                />
                <TriggerToggle
                  label="Politika İhlalleri"
                  enabled={config.enabledTriggers?.policyViolations ?? true}
                  onChange={(v) => updateConfig.mutate({ enabledTriggers: { policyViolations: v } })}
                />
                <TriggerToggle
                  label="Maliyet Artışları"
                  enabled={config.enabledTriggers?.costSpikes ?? true}
                  onChange={(v) => updateConfig.mutate({ enabledTriggers: { costSpikes: v } })}
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Scan Results */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-5">
            <h2 className="text-lg font-semibold mb-4">📡 Son Tarama Sonuçları</h2>
            {status?.recentResults?.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {status.recentResults.slice().reverse().map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/50 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-sky-900/30 text-sky-300 border border-sky-800/50">
                        {r.trigger}
                      </span>
                      <span className="text-gray-300">{r.details}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {r.jobsCreated > 0 && <span className="text-amber-400">+{r.jobsCreated} iş</span>}
                      {r.jobsDispatched > 0 && <span className="text-green-400">→{r.jobsDispatched} gönderildi</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Henüz tarama sonucu yok</p>
            )}
          </div>

          {/* Event History */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-5">
            <h2 className="text-lg font-semibold mb-4">📜 Olay Geçmişi</h2>
            {history?.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.map((evt: any) => (
                  <div key={evt.id} className="flex items-start gap-3 py-2 px-3 rounded bg-gray-800/50 text-sm">
                    <EventIcon type={evt.event_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 truncate">{evt.message}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(evt.created_at).toLocaleString('tr-TR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Henüz olay yok</p>
            )}
          </div>
        </div>

        {/* Last scan info */}
        {status?.lastScanAt && (
          <div className="mt-4 text-xs text-gray-500 text-center">
            Son tarama: {new Date(status.lastScanAt).toLocaleString('tr-TR')}
            {status.lastDispatchAt && ` · Son gönderim: ${new Date(status.lastDispatchAt).toLocaleString('tr-TR')}`}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
