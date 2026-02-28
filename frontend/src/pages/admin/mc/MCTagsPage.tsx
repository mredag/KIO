import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, useCustomFields, useCreateCustomField, useDeleteCustomField } from '../../../hooks/useTagsApi';

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

function TagForm({ onSubmit, onCancel }: { onSubmit: (d: any) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [description, setDescription] = useState('');
  return (
    <div className="space-y-3">
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Etiket Adı" value={name} onChange={e => setName(e.target.value)} />
      <div className="flex items-center gap-2">
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
        placeholder="Açıklama (opsiyonel)" value={description} onChange={e => setDescription(e.target.value)} />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">İptal</button>
        <button onClick={() => onSubmit({ name, color, description })} className="px-4 py-1.5 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">Oluştur</button>
      </div>
    </div>
  );
}

function FieldForm({ onSubmit, onCancel }: { onSubmit: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', field_type: 'text', entity_type: 'job', options: '', required: false });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <input className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
          placeholder="Alan Adı" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-sky-500/50 focus:outline-none"
          value={form.field_type} onChange={e => setForm(p => ({ ...p, field_type: e.target.value }))}>
          <option value="text">Metin</option><option value="number">Sayı</option><option value="date">Tarih</option>
          <option value="select">Seçim</option><option value="boolean">Evet/Hayır</option>
        </select>
        <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-sky-500/50 focus:outline-none"
          value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}>
          <option value="job">İş</option><option value="agent">Ajan</option>
        </select>
      </div>
      {form.field_type === 'select' && (
        <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-sky-500/50 focus:outline-none"
          placeholder="Seçenekler (virgülle ayırın)" value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} />
      )}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={form.required} onChange={e => setForm(p => ({ ...p, required: e.target.checked }))} className="rounded bg-white/5 border-white/20" />
          Zorunlu
        </label>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200">İptal</button>
        <button onClick={() => onSubmit({ ...form, options: form.field_type === 'select' ? form.options.split(',').map(s => s.trim()) : undefined })}
          className="px-4 py-1.5 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">Oluştur</button>
      </div>
    </div>
  );
}

const FIELD_TYPE_LABELS: Record<string, string> = { text: 'Metin', number: 'Sayı', date: 'Tarih', select: 'Seçim', boolean: 'Evet/Hayır' };
const ENTITY_TYPE_LABELS: Record<string, string> = { job: 'İş', agent: 'Ajan' };

export default function MCTagsPage() {
  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const { data: fields = [], isLoading: fieldsLoading } = useCustomFields();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const createField = useCreateCustomField();
  const deleteField = useDeleteCustomField();
  const [tab, setTab] = useState<'tags' | 'fields'>('tags');
  const [showTagForm, setShowTagForm] = useState(false);
  const [showFieldForm, setShowFieldForm] = useState(false);

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">Etiketler & Özel Alanlar</h1>
            <p className="text-sm text-gray-500 mt-1">İş, ajan ve konuşmaları organize edin</p>
          </div>
        </div>

        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit">
          <button onClick={() => setTab('tags')} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === 'tags' ? 'bg-white/10 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>
            Etiketler ({(tags as any[]).length})
          </button>
          <button onClick={() => setTab('fields')} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === 'fields' ? 'bg-white/10 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>
            Özel Alanlar ({(fields as any[]).length})
          </button>
        </div>

        {tab === 'tags' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowTagForm(true)} className="px-4 py-2 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">+ Yeni Etiket</button>
            </div>
            {showTagForm && <GlassCard><TagForm onSubmit={d => { createTag.mutate(d); setShowTagForm(false); }} onCancel={() => setShowTagForm(false)} /></GlassCard>}
            {tagsLoading ? <div className="text-center py-8 text-gray-500">Yükleniyor...</div> : (
              <div className="flex flex-wrap gap-2">
                {(tags as any[]).map((tag: any) => (
                  <div key={tag.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm text-gray-300">{tag.name}</span>
                    {tag.description && <span className="text-xs text-gray-600 hidden group-hover:inline">— {tag.description}</span>}
                    <button onClick={() => { if (confirm(`"${tag.name}" etiketi silinsin mi?`)) deleteTag.mutate(tag.id); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                {(tags as any[]).length === 0 && <div className="text-gray-500 text-sm">Henüz etiket eklenmemiş</div>}
              </div>
            )}
          </div>
        )}

        {tab === 'fields' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowFieldForm(true)} className="px-4 py-2 text-sm bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 border border-sky-500/20">+ Yeni Alan</button>
            </div>
            {showFieldForm && <GlassCard><FieldForm onSubmit={d => { createField.mutate(d); setShowFieldForm(false); }} onCancel={() => setShowFieldForm(false)} /></GlassCard>}
            {fieldsLoading ? <div className="text-center py-8 text-gray-500">Yükleniyor...</div> : (
              <div className="space-y-2">
                {(fields as any[]).map((f: any) => (
                  <GlassCard key={f.id}>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{f.name}</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded-full text-violet-400 bg-violet-400/10">{FIELD_TYPE_LABELS[f.field_type] || f.field_type}</span>
                          <span className="px-1.5 py-0.5 text-[10px] rounded-full text-cyan-400 bg-cyan-400/10">{ENTITY_TYPE_LABELS[f.entity_type] || f.entity_type}</span>
                          {f.required ? <span className="px-1.5 py-0.5 text-[10px] rounded-full text-amber-400 bg-amber-400/10">Zorunlu</span> : null}
                        </div>
                        {f.options && <div className="text-xs text-gray-500 mt-1">Seçenekler: {typeof f.options === 'string' ? f.options : JSON.stringify(f.options)}</div>}
                      </div>
                      <button onClick={() => { if (confirm('Bu alan silinsin mi?')) deleteField.mutate(f.id); }}
                        className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </GlassCard>
                ))}
                {(fields as any[]).length === 0 && <div className="text-center py-8 text-gray-500">Henüz özel alan eklenmemiş</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
