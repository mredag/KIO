import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = '/api/mc';
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const RISK_COLORS: Record<string, string> = { low: 'text-emerald-400 bg-emerald-400/10', medium: 'text-amber-400 bg-amber-400/10', high: 'text-red-400 bg-red-400/10' };
const RISK_LABELS: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' };
const STATUS_COLORS: Record<string, string> = { mastered: 'text-emerald-400 bg-emerald-400/10', candidate: 'text-sky-400 bg-sky-400/10', backlog: 'text-gray-400 bg-gray-400/10' };
const STATUS_LABELS: Record<string, string> = { mastered: 'Ustalaşmış', candidate: 'Aday', backlog: 'Beklemede' };
const CATEGORY_OPTIONS = ['general', 'instagram', 'whatsapp', 'admin', 'analytics', 'automation'];

function SkillForm({ onSubmit, onCancel }: { onSubmit: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', prompt: '', test_case: '', description: '', category: 'general', risk_level: 'low' });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
          placeholder="Beceri Adı" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-sky-500/50 focus:outline-none"
          value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Açıklama" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none h-20"
        placeholder="Prompt" value={form.prompt} onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))} />
      <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none h-16"
        placeholder="Test Case" value={form.test_case} onChange={e => setForm(p => ({ ...p, test_case: e.target.value }))} />
      <div className="flex items-center gap-3">
        <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-sky-500/50 focus:outline-none"
          value={form.risk_level} onChange={e => setForm(p => ({ ...p, risk_level: e.target.value }))}>
          <option value="low">Risk: Düşük</option><option value="medium">Risk: Orta</option><option value="high">Risk: Yüksek</option>
        </select>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">İptal</button>
        <button onClick={() => onSubmit(form)} className="px-4 py-1.5 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">Oluştur</button>
      </div>
    </div>
  );
}

export default function MCSkillsPage() {
  const qc = useQueryClient();
  const { data: skills = [], isLoading } = useQuery({ queryKey: ['mc-skills'], queryFn: () => apiFetch('/skills') });
  const { data: localSkills = [] } = useQuery({ queryKey: ['mc-skills-local'], queryFn: () => apiFetch('/skills/local') });
  const createSkill = useMutation({
    mutationFn: (d: any) => apiFetch('/skills', { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-skills'] }),
  });
  const deleteSkill = useMutation({
    mutationFn: (id: string) => apiFetch(`/skills/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mc-skills'] }),
  });

  const [tab, setTab] = useState<'installed' | 'local'>('installed');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const filtered = (skills as any[]).filter((s: any) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && s.category !== catFilter) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Beceri Mağazası</h1>
            <p className="text-sm text-gray-500 mt-1">Agent becerilerini yönetin ve keşfedin</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">+ Yeni Beceri</button>
        </div>

        {showForm && (
          <GlassCard><SkillForm onSubmit={d => { createSkill.mutate(d); setShowForm(false); }} onCancel={() => setShowForm(false)} /></GlassCard>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit">
          {[{ key: 'installed', label: `Yüklü (${(skills as any[]).length})` }, { key: 'local', label: `Yerel (${(localSkills as any[]).length})` }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === t.key ? 'bg-white/10 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'installed' && (
          <>
            <div className="flex gap-3">
              <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
                placeholder="Beceri ara..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-sky-500/50 focus:outline-none"
                value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                <option value="">Tüm Kategoriler</option>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {isLoading ? <div className="text-center py-8 text-gray-500">Yükleniyor...</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((skill: any) => (
                  <GlassCard key={skill.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-200">{skill.name}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${STATUS_COLORS[skill.status] || 'text-gray-400 bg-gray-400/10'}`}>{STATUS_LABELS[skill.status] || skill.status}</span>
                          {skill.category && <span className="px-1.5 py-0.5 text-[10px] rounded-full text-violet-400 bg-violet-400/10">{skill.category}</span>}
                          {skill.risk_level && <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${RISK_COLORS[skill.risk_level] || ''}`}>{RISK_LABELS[skill.risk_level] || skill.risk_level}</span>}
                        </div>
                        {skill.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</p>}
                        {skill.fit_score > 0 && <div className="mt-1.5"><div className="h-1 bg-white/5 rounded-full overflow-hidden w-24"><div className="h-full bg-sky-400/60 rounded-full" style={{ width: `${skill.fit_score * 100}%` }} /></div></div>}
                      </div>
                      <button onClick={() => { if (confirm('Bu beceri silinsin mi?')) deleteSkill.mutate(skill.id); }}
                        className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'local' && (
          <div className="space-y-2">
            {(localSkills as any[]).map((s: any) => (
              <GlassCard key={s.name}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">📦</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-200">{s.name}</span>
                    <div className="text-xs text-gray-500 font-mono truncate">{s.path}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full ${s.has_index ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 bg-gray-500/10'}`}>
                    {s.has_index ? 'index.js ✓' : 'index.js yok'}
                  </span>
                </div>
              </GlassCard>
            ))}
            {(localSkills as any[]).length === 0 && <div className="text-center py-8 text-gray-500">Yerel beceri bulunamadı</div>}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
