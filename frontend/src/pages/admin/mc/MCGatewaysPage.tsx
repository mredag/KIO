import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import {
  useActivateGateway,
  useCheckGateway,
  useCreateGateway,
  useDeleteGateway,
  useGatewayOpsSummary,
  useGateways,
  useUpdateGateway,
} from '../../../hooks/useGatewayApi';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-400',
  offline: 'bg-red-400',
  unknown: 'bg-gray-400',
  error: 'bg-amber-400',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Cevrimici',
  offline: 'Cevrimdisi',
  unknown: 'Bilinmiyor',
  error: 'Hata',
};

const RUNTIME_LABELS: Record<string, string> = {
  running: 'Calisiyor',
  stopped: 'Durdu',
  unknown: 'Bilinmiyor',
  error: 'Hata',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR');
}

function SummaryCard({
  label,
  value,
  meta,
  tone = 'sky',
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: 'sky' | 'green' | 'amber' | 'red';
}) {
  const tones: Record<string, string> = {
    sky: 'border-sky-500/30 bg-sky-500/10',
    green: 'border-emerald-500/30 bg-emerald-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    red: 'border-red-500/30 bg-red-500/10',
  };

  return (
    <GlassCard className={`border ${tones[tone] || tones.sky}`} hover={false}>
      <div className="space-y-1">
        <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</div>
        <div className="text-lg font-semibold text-gray-100 break-words">{value}</div>
        {meta ? <div className="text-xs text-gray-400">{meta}</div> : null}
      </div>
    </GlassCard>
  );
}

function RuntimeBadge({ status }: { status?: string | null }) {
  const tone =
    status === 'running'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : status === 'stopped'
        ? 'bg-gray-500/15 text-gray-300 border-gray-500/30'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
      {RUNTIME_LABELS[status || 'unknown'] || 'Bilinmiyor'}
    </span>
  );
}

function SeverityPill({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'sky' }) {
  const tones: Record<string, string> = {
    red: 'bg-red-500/15 text-red-300 border-red-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      <span>{label}</span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{value}</span>
    </span>
  );
}

function GatewayForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    url: initial?.url || '',
    token: initial?.token || '',
    workspace_root: initial?.workspace_root || '',
    allow_insecure_tls: initial?.allow_insecure_tls || false,
  });

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Gateway adi"
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="URL (ws://127.0.0.1:18789)"
        value={form.url}
        onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Token (opsiyonel)"
        value={form.token}
        onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))}
        type="password"
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Workspace root (opsiyonel)"
        value={form.workspace_root}
        onChange={(e) => setForm((prev) => ({ ...prev, workspace_root: e.target.value }))}
      />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={form.allow_insecure_tls}
            onChange={(e) => setForm((prev) => ({ ...prev, allow_insecure_tls: e.target.checked }))}
            className="rounded border-white/20 bg-white/5"
          />
          Insecure TLS izin ver
        </label>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">
          Iptal
        </button>
        <button
          onClick={() => onSubmit(form)}
          className="rounded-lg border border-sky-500/20 bg-sky-500/20 px-4 py-1.5 text-sm text-sky-400 hover:bg-sky-500/30"
        >
          {initial ? 'Guncelle' : 'Olustur'}
        </button>
      </div>
    </div>
  );
}

export default function MCGatewaysPage() {
  const { data: gateways = [], isLoading, refetch: refetchGateways } = useGateways();
  const {
    data: opsSummary,
    isLoading: opsLoading,
    isFetching: opsFetching,
    error: opsError,
    refetch: refetchOps,
  } = useGatewayOpsSummary();
  const createGateway = useCreateGateway();
  const updateGateway = useUpdateGateway();
  const deleteGateway = useDeleteGateway();
  const checkGateway = useCheckGateway();
  const activateGateway = useActivateGateway();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const runtimeStatus = opsSummary?.summary?.runtimeStatus ?? 'unknown';
  const securityCounts = opsSummary?.summary?.securityCounts;
  const findings = Array.isArray(opsSummary?.securityAudit?.findings) ? opsSummary.securityAudit.findings : [];
  const configIssues = Array.isArray(opsSummary?.summary?.configAuditIssues) ? opsSummary.summary.configAuditIssues : [];
  const activeGateway = opsSummary?.activeGateway;

  const handleRefresh = () => {
    refetchOps();
    refetchGateways();
  };

  const handleCreate = (data: any) => {
    createGateway.mutate(data);
    setShowForm(false);
  };

  const handleUpdate = (data: any) => {
    updateGateway.mutate({ id: editId, ...data });
    setEditId(null);
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">OpenClaw Ops</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gateway runtime, saglik, guvenlik ve kayitli baglantilar tek yerde.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
            >
              {opsFetching ? 'Yenileniyor...' : 'Yenile'}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-sky-500/20 bg-sky-500/20 px-4 py-2 text-sm text-sky-400 hover:bg-sky-500/30"
            >
              + Yeni Gateway
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="OpenClaw Surumu"
            value={opsSummary?.cli?.version || (opsLoading ? 'Yukleniyor...' : 'Bilinmiyor')}
            meta={opsSummary?.cli?.command || 'Yerel CLI'}
            tone="sky"
          />
          <SummaryCard
            label="Runtime"
            value={RUNTIME_LABELS[runtimeStatus] || 'Bilinmiyor'}
            meta={opsSummary?.gatewayStatus?.gateway?.probeUrl || 'Gateway probe yok'}
            tone={runtimeStatus === 'running' ? 'green' : runtimeStatus === 'stopped' ? 'amber' : 'red'}
          />
          <SummaryCard
            label="Guvenlik Uyarilari"
            value={
              securityCounts
                ? `${securityCounts.critical || 0} kritik / ${securityCounts.warn || 0} uyari`
                : (opsLoading ? 'Yukleniyor...' : 'Veri yok')
            }
            meta={opsSummary?.checkedAt ? `Son kontrol ${formatDate(opsSummary.checkedAt)}` : undefined}
            tone={(securityCounts?.critical || 0) > 0 ? 'red' : (securityCounts?.warn || 0) > 0 ? 'amber' : 'green'}
          />
          <SummaryCard
            label="Aktif Gateway"
            value={activeGateway?.name || 'Tanimli degil'}
            meta={activeGateway?.url || 'Kayitli aktif gateway yok'}
            tone="sky"
          />
        </div>

        {opsError ? (
          <GlassCard className="border border-red-500/20 bg-red-500/10" hover={false}>
            <div className="text-sm text-red-200">
              OpenClaw ops ozeti yuklenemedi. {(opsError as Error).message}
            </div>
          </GlassCard>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <GlassCard hover={false}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Runtime Ozeti</h2>
                <p className="mt-1 text-sm text-gray-500">
                  OpenClaw CLI uzerinden alinan canli durum, probe ve config denetimi.
                </p>
              </div>
              <RuntimeBadge status={runtimeStatus} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Gateway</div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500">Bind</dt>
                    <dd className="text-right text-gray-200">
                      {opsSummary?.gatewayStatus?.gateway?.bindMode || '—'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500">Host / Port</dt>
                    <dd className="text-right text-gray-200">
                      {opsSummary?.gatewayStatus?.gateway?.bindHost || '—'}:{opsSummary?.gatewayStatus?.gateway?.port ?? '—'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500">Service</dt>
                    <dd className="text-right text-gray-200">
                      {opsSummary?.gatewayStatus?.service?.label || '—'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500">RPC Probe</dt>
                    <dd className={`text-right ${opsSummary?.summary?.rpcOk ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {opsSummary?.summary?.rpcOk ? 'Basarili' : 'Basarisiz'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-gray-500">Health</dt>
                    <dd className={`text-right ${opsSummary?.gatewayHealth?.ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {opsSummary?.gatewayHealth?.ok ? 'OK' : 'Sorunlu'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Config ve Hata Durumu</div>
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <div className="text-gray-500">CLI config</div>
                    <div className="break-all text-gray-200">
                      {opsSummary?.gatewayStatus?.config?.cli?.path || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Runtime detay</div>
                    <div className="text-gray-200">
                      {opsSummary?.gatewayStatus?.service?.runtime?.detail || opsSummary?.gatewayHealth?.error || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Probe notu</div>
                    <div className="text-gray-200">
                      {opsSummary?.gatewayStatus?.gateway?.probeNote || '—'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-medium text-gray-300">Config denetim bulgulari</h3>
              {configIssues.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {configIssues.map((issue: any, index: number) => (
                    <div key={`${issue.code || 'issue'}-${index}`} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                      <div className="text-sm font-medium text-amber-200">{issue.message || issue.code || 'Uyari'}</div>
                      {issue.detail ? <div className="mt-1 text-xs text-amber-100/80">{issue.detail}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  Ek config denetim bulgusu yok.
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Security Audit</h2>
                <p className="mt-1 text-sm text-gray-500">
                  OpenClaw security audit ciktilari, KIO icin en kritik operasyon sinyalleri.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityPill label="Kritik" value={securityCounts?.critical || 0} tone="red" />
                <SeverityPill label="Uyari" value={securityCounts?.warn || 0} tone="amber" />
                <SeverityPill label="Bilgi" value={securityCounts?.info || 0} tone="sky" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {findings.length > 0 ? (
                findings.slice(0, 8).map((finding: any) => (
                  <div
                    key={finding.checkId}
                    className={`rounded-lg border p-3 ${
                      finding.severity === 'warn'
                        ? 'border-amber-500/20 bg-amber-500/10'
                        : finding.severity === 'critical'
                          ? 'border-red-500/20 bg-red-500/10'
                          : 'border-sky-500/20 bg-sky-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-100">{finding.title || finding.checkId}</div>
                        {finding.detail ? <div className="mt-1 text-xs text-gray-300/90 whitespace-pre-line">{finding.detail}</div> : null}
                        {finding.remediation ? (
                          <div className="mt-2 text-xs text-gray-400">Oneri: {finding.remediation}</div>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gray-300">
                        {finding.severity || 'info'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  Security audit bulgusu yok veya veri henuz gelmedi.
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {showForm ? (
          <GlassCard>
            <GatewayForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
          </GlassCard>
        ) : null}

        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Kayitli Gatewayler</h2>
            <p className="mt-1 text-sm text-gray-500">
              Mission Control icindeki gateway kayitlari ve hizli saglik kontrolleri.
            </p>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-500">Yukleniyor...</div>
          ) : (
            <div className="space-y-3">
              {(gateways as any[]).map((gateway: any) => (
                <GlassCard key={gateway.id} className={gateway.is_active ? 'ring-1 ring-sky-500/30' : ''}>
                  {editId === gateway.id ? (
                    <GatewayForm initial={gateway} onSubmit={handleUpdate} onCancel={() => setEditId(null)} />
                  ) : (
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-3 w-3 rounded-full ${STATUS_COLORS[gateway.status] || 'bg-gray-400'} ${
                          gateway.status === 'online' ? 'animate-pulse' : ''
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{gateway.name}</span>
                          {gateway.is_active ? (
                            <span className="rounded-full border border-sky-500/20 bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-400">
                              AKTIF
                            </span>
                          ) : null}
                          <span className="text-[11px] text-gray-500">{STATUS_LABELS[gateway.status] || 'Bilinmiyor'}</span>
                        </div>

                        <div className="mt-0.5 truncate font-mono text-xs text-gray-500">{gateway.url}</div>
                        {gateway.workspace_root ? (
                          <div className="mt-0.5 truncate text-xs text-gray-600">Workspace: {gateway.workspace_root}</div>
                        ) : null}
                        {gateway.last_error ? (
                          <div className="mt-0.5 truncate text-xs text-red-400/70">Uyari: {gateway.last_error}</div>
                        ) : null}
                        {gateway.last_check_at ? (
                          <div className="mt-0.5 text-[10px] text-gray-600">Son kontrol: {formatDate(gateway.last_check_at)}</div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => checkGateway.mutate(gateway.id)}
                          title="Saglik kontrolu"
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-emerald-400"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>

                        {!gateway.is_active ? (
                          <button
                            onClick={() => activateGateway.mutate(gateway.id)}
                            title="Aktif yap"
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-sky-400"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </button>
                        ) : null}

                        <button
                          onClick={() => setEditId(gateway.id)}
                          title="Duzenle"
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-amber-400"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>

                        {!gateway.is_active ? (
                          <button
                            onClick={() => {
                              if (confirm('Bu gateway silinsin mi?')) {
                                deleteGateway.mutate(gateway.id);
                              }
                            }}
                            title="Sil"
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-red-400"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </GlassCard>
              ))}

              {(gateways as any[]).length === 0 ? (
                <div className="py-8 text-center text-gray-500">Henuz gateway eklenmemis.</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
