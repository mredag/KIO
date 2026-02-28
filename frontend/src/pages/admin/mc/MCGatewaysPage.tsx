import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import { useGateways, useCreateGateway, useUpdateGateway, useDeleteGateway, useCheckGateway, useActivateGateway } from '../../../hooks/useGatewayApi';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-emerald-400', offline: 'bg-red-400', unknown: 'bg-gray-400', error: 'bg-amber-400',
};
const STATUS_LABELS: Record<string, string> = {
  online: 'Çevrimiçi', offline: 'Çevrimdışı', unknown: 'Bilinmiyor', error: 'Hata',
};

function GatewayForm({ initial, onSubmit, onCancel }: { initial?: any; onSubmit: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '', url: initial?.url || '', token: initial?.token || '',
    workspace_root: initial?.workspace_root || '', allow_insecure_tls: initial?.allow_insecure_tls || false,
  });
  return (
    <div className="space-y-3">
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Gateway Adı" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="URL (ws://127.0.0.1:18789)" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Token (opsiyonel)" value={form.token} onChange={e => setForm(p => ({ ...p, token: e.target.value }))} type="password" />
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Workspace Root (opsiyonel)" value={form.workspace_root} onChange={e => setForm(p => ({ ...p, workspace_root: e.target.value }))} />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={form.allow_insecure_tls} onChange={e => setForm(p => ({ ...p, allow_insecure_tls: e.target.checked }))}
            className="rounded bg-white/5 border-white/20" />
          Güvensiz TLS'ye İzin Ver
        </label>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">İptal</button>
        <button onClick={() => onSubmit(form)} className="px-4 py-1.5 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">
          {initial ? 'Güncelle' : 'Oluştur'}
        </button>
      </div>
    </div>
  );
}

export default function MCGatewaysPage() {
  const { data: gateways = [], isLoading } = useGateways();
  const createGw = useCreateGateway();
  const updateGw = useUpdateGateway();
  const deleteGw = useDeleteGateway();
  const checkGw = useCheckGateway();
  const activateGw = useActivateGateway();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const handleCreate = (data: any) => { createGw.mutate(data); setShowForm(false); };
  const handleUpdate = (data: any) => { updateGw.mutate({ id: editId, ...data }); setEditId(null); };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Gateway Yönetimi</h1>
            <p className="text-sm text-gray-500 mt-1">OpenClaw gateway bağlantılarını yönetin</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">
            + Yeni Gateway
          </button>
        </div>

        {showForm && (
          <GlassCard><GatewayForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} /></GlassCard>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Yükleniyor...</div>
        ) : (
          <div className="space-y-3">
            {(gateways as any[]).map((gw: any) => (
              <GlassCard key={gw.id} className={gw.is_active ? 'ring-1 ring-sky-500/30' : ''}>
                {editId === gw.id ? (
                  <GatewayForm initial={gw} onSubmit={handleUpdate} onCancel={() => setEditId(null)} />
                ) : (
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[gw.status] || 'bg-gray-400'} ${gw.status === 'online' ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">{gw.name}</span>
                        {gw.is_active ? <span className="px-1.5 py-0.5 text-[10px] bg-sky-500/15 text-sky-400 rounded-full border border-sky-500/20">AKTİF</span> : null}
                        <span className="text-[11px] text-gray-500">{STATUS_LABELS[gw.status]}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 font-mono truncate">{gw.url}</div>
                      {gw.workspace_root && <div className="text-xs text-gray-600 mt-0.5 truncate">📁 {gw.workspace_root}</div>}
                      {gw.last_error && <div className="text-xs text-red-400/70 mt-0.5 truncate">⚠ {gw.last_error}</div>}
                      {gw.last_check_at && <div className="text-[10px] text-gray-600 mt-0.5">Son kontrol: {new Date(gw.last_check_at).toLocaleString('tr-TR')}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => checkGw.mutate(gw.id)} title="Sağlık Kontrolü"
                        className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                      </button>
                      {!gw.is_active && (
                        <button onClick={() => activateGw.mutate(gw.id)} title="Aktif Yap"
                          className="p-1.5 text-gray-500 hover:text-sky-400 hover:bg-white/5 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                      )}
                      <button onClick={() => setEditId(gw.id)} title="Düzenle"
                        className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      {!gw.is_active && (
                        <button onClick={() => { if (confirm('Bu gateway silinsin mi?')) deleteGw.mutate(gw.id); }} title="Sil"
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
            {(gateways as any[]).length === 0 && <div className="text-center py-8 text-gray-500">Henüz gateway eklenmemiş</div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
