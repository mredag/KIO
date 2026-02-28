import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useMCCosts } from '../../../hooks/useMissionControlApi';
import { SkeletonCard } from '../../../components/ui/Skeleton';

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Hafta' },
  { key: 'month', label: 'Ay' },
  { key: '', label: 'Tümü' },
];

export default function MCCostsPage() {
  const [period, setPeriod] = useState('week');
  const { data, isLoading, error } = useMCCosts({ period });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">API Kullanımı</h1></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} height="h-24" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">API Kullanımı</h1></div>
          <div className="mc-card p-6 border-red-200 dark:border-red-800/50">
            <p className="text-red-600 dark:text-red-400 text-sm">Maliyet verileri yüklenemedi. Backend bağlantısını kontrol edin.</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const summary = data?.summary || {};
  const byModel = data?.by_model || [];
  const byAgent = data?.by_agent || [];
  const recent = data?.recent || [];

  return (
    <AdminLayout>
      <div>
        <div className="mc-page-header mc-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="text-sm">💰</span>
            </div>
            <h1 className="mc-page-title">API Kullanımı</h1>
          </div>
          <div className="flex gap-1.5">
            {PERIOD_OPTIONS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`mc-pill ${period === p.key ? 'mc-pill--active' : ''}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 mc-fade-up">
          <div className="mc-stat mc-stat--amber">
            <p className="mc-label mb-2">Toplam Maliyet</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">${(summary.total_cost || 0).toFixed(4)}</p>
          </div>
          <div className="mc-stat mc-stat--sky">
            <p className="mc-label mb-2">Giriş Token</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{(summary.total_input_tokens || 0).toLocaleString()}</p>
          </div>
          <div className="mc-stat mc-stat--indigo">
            <p className="mc-label mb-2">Çıkış Token</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{(summary.total_output_tokens || 0).toLocaleString()}</p>
          </div>
          <div className="mc-stat mc-stat--green">
            <p className="mc-label mb-2">Toplam Çalışma</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{summary.total_runs || 0}</p>
          </div>
        </div>

        {/* By Model + By Agent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 mc-fade-up-delay">
          <div className="mc-card p-5">
            <p className="mc-label mb-4">Model Bazında</p>
            {byModel.length === 0 ? (
              <div className="mc-empty py-6"><div className="mc-empty-icon">🧠</div><p className="mc-empty-title">Veri yok</p></div>
            ) : (
              <div className="space-y-2">
                {byModel.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.model}</p>
                      <p className="mc-label mt-0.5">{m.provider} • {m.runs} çalışma</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-50">${(m.cost || 0).toFixed(4)}</p>
                      <p className="mc-label mt-0.5">{((m.input_tokens || 0) + (m.output_tokens || 0)).toLocaleString()} token</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mc-card p-5">
            <p className="mc-label mb-4">Ajan Bazında</p>
            {byAgent.length === 0 ? (
              <div className="mc-empty py-6"><div className="mc-empty-icon">🤖</div><p className="mc-empty-title">Veri yok</p></div>
            ) : (
              <div className="space-y-2">
                {byAgent.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.agent_name || a.agent_id}</p>
                      <p className="mc-label mt-0.5">{a.runs} çalışma</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-50">${(a.cost || 0).toFixed(4)}</p>
                      <p className="mc-label mt-0.5">{((a.input_tokens || 0) + (a.output_tokens || 0)).toLocaleString()} token</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Runs Table */}
        <div className="mc-card overflow-hidden mc-fade-up-delay-2">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <p className="mc-label">Son İşlemler</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-3 py-2 mc-label">Model</th>
                  <th className="text-left px-3 py-2 mc-label">Provider</th>
                  <th className="text-right px-3 py-2 mc-label">Giriş</th>
                  <th className="text-right px-3 py-2 mc-label">Çıkış</th>
                  <th className="text-right px-3 py-2 mc-label">Maliyet</th>
                  <th className="text-right px-3 py-2 mc-label">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recent.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100 text-xs">{r.model}</td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{r.provider}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-xs font-mono">{(r.input_tokens || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 text-xs font-mono">{(r.output_tokens || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-gray-50 text-xs font-mono">${(r.cost || 0).toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-400 font-mono">{new Date(r.created_at).toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {recent.length === 0 && (
              <div className="mc-empty"><div className="mc-empty-icon">💰</div><p className="mc-empty-title">Henüz maliyet kaydı yok</p></div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}