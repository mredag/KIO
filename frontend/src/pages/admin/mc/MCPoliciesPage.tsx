import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useMCPolicies, useCreateMCPolicy } from '../../../hooks/useMissionControlApi';
import { SkeletonCard } from '../../../components/ui/Skeleton';

const TYPE_BADGE: Record<string, string> = {
  routing: 'mc-badge--blue',
  escalation: 'mc-badge--red',
  block: 'mc-badge--gray',
  handoff: 'mc-badge--purple',
  auto_reply: 'mc-badge--green',
};

const TYPE_LABELS: Record<string, string> = {
  routing: 'Yönlendirme',
  escalation: 'Eskalasyon',
  block: 'Engelleme',
  handoff: 'Devir',
  auto_reply: 'Otomatik Yanıt',
};

export default function MCPoliciesPage() {
  const { data: policies, isLoading } = useMCPolicies();
  const createPolicy = useCreateMCPolicy();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'routing', conditions: '', actions: '', priority: 0 });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    try {
      createPolicy.mutate({
        name: form.name, type: form.type,
        conditions: form.conditions ? JSON.parse(form.conditions) : {},
        actions: form.actions ? JSON.parse(form.actions) : {},
        priority: form.priority,
      });
      setForm({ name: '', type: 'routing', conditions: '', actions: '', priority: 0 });
      setShowCreate(false);
    } catch {
      alert('JSON formatı hatalı. Conditions ve Actions geçerli JSON olmalı.');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">Politikalar</h1></div>
          <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} height="h-20" />)}</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        <div className="mc-page-header mc-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <span className="text-sm">📜</span>
            </div>
            <h1 className="mc-page-title">Politikalar</h1>
            <span className="mc-badge mc-badge--gray">{(policies || []).length}</span>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="mc-btn mc-btn--primary text-xs">+ Yeni Politika</button>
        </div>

        {showCreate && (
          <div className="mc-card p-5 mb-6 mc-fade-up">
            <p className="mc-label mb-3">Yeni Politika</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <input type="text" placeholder="İsim" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} className="mc-input" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mc-input">
                <option value="routing">Yönlendirme</option>
                <option value="escalation">Eskalasyon</option>
                <option value="block">Engelleme</option>
                <option value="handoff">Devir</option>
                <option value="auto_reply">Otomatik Yanıt</option>
              </select>
              <input type="number" placeholder="Öncelik" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="mc-input" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <p className="mc-label mb-1.5">Koşullar (JSON)</p>
                <textarea value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                  placeholder='{"channel": "instagram", "intent": "pricing"}'
                  className="mc-input w-full font-mono" rows={3} />
              </div>
              <div>
                <p className="mc-label mb-1.5">Aksiyonlar (JSON)</p>
                <textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })}
                  placeholder='{"route_to": "instagram-dm", "priority": "high"}'
                  className="mc-input w-full font-mono" rows={3} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="mc-btn mc-btn--primary text-xs">Oluştur</button>
              <button onClick={() => setShowCreate(false)} className="mc-btn mc-btn--ghost text-xs">İptal</button>
            </div>
          </div>
        )}

        {/* Policy Cards */}
        <div className="space-y-3 mc-fade-up-delay">
          {(policies || []).map((policy: any) => {
            let conditions: any = {};
            let actions: any = {};
            try { conditions = typeof policy.conditions === 'string' ? JSON.parse(policy.conditions) : policy.conditions; } catch { /* */ }
            try { actions = typeof policy.actions === 'string' ? JSON.parse(policy.actions) : policy.actions; } catch { /* */ }

            return (
              <div key={policy.id} className="mc-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{policy.name}</h3>
                    <span className={`mc-badge text-[10px] ${TYPE_BADGE[policy.type] || 'mc-badge--gray'}`}>
                      {TYPE_LABELS[policy.type] || policy.type}
                    </span>
                    <span className="mc-label">öncelik: {policy.priority}</span>
                  </div>
                  <span className={`mc-badge text-[10px] ${policy.enabled ? 'mc-badge--green' : 'mc-badge--gray'}`}>
                    {policy.enabled ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="mc-label mb-1.5">Koşullar</p>
                    <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-gray-700 dark:text-gray-300 overflow-x-auto border border-gray-100 dark:border-gray-800 font-mono">
                      {JSON.stringify(conditions, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="mc-label mb-1.5">Aksiyonlar</p>
                    <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-gray-700 dark:text-gray-300 overflow-x-auto border border-gray-100 dark:border-gray-800 font-mono">
                      {JSON.stringify(actions, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(!policies || policies.length === 0) && (
          <div className="mc-empty mc-fade-up">
            <div className="mc-empty-icon">📜</div>
            <p className="mc-empty-title">Henüz politika yok</p>
            <p className="mc-empty-desc">Yönlendirme veya eskalasyon kuralları ekleyin.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}