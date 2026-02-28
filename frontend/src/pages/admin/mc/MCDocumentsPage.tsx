import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useMCDocuments, useIngestMCDocument, useQueryMCDocuments, useSyncKnowledgeBase } from '../../../hooks/useMissionControlApi';
import { SkeletonCard } from '../../../components/ui/Skeleton';

const STATUS_BADGE: Record<string, string> = {
  available: 'mc-badge--green',
  parsing: 'mc-badge--amber',
  error: 'mc-badge--red',
  indexing: 'mc-badge--blue',
};

export default function MCDocumentsPage() {
  const { data: documents, isLoading } = useMCDocuments();
  const ingestDoc = useIngestMCDocument();
  const queryDocs = useQueryMCDocuments();
  const syncKB = useSyncKnowledgeBase();
  const [showIngest, setShowIngest] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [ingestForm, setIngestForm] = useState({ title: '', content: '', content_type: 'markdown' });
  const [queryText, setQueryText] = useState('');
  const [queryResults, setQueryResults] = useState<any>(null);

  const handleIngest = () => {
    if (!ingestForm.title.trim() || !ingestForm.content.trim()) return;
    ingestDoc.mutate(ingestForm, {
      onSuccess: () => { setIngestForm({ title: '', content: '', content_type: 'markdown' }); setShowIngest(false); },
    });
  };

  const handleQuery = () => {
    if (!queryText.trim()) return;
    queryDocs.mutate({ query: queryText }, { onSuccess: (data) => setQueryResults(data) });
  };

  const handleSyncKB = () => {
    syncKB.mutate(undefined, { onSuccess: (data) => alert(`${data.synced} bilgi tabanı kaydı senkronize edildi`) });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">Dokümanlar</h1></div>
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
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <span className="text-sm">📄</span>
            </div>
            <h1 className="mc-page-title">Dokümanlar & Bilgi Tabanı</h1>
            <span className="mc-badge mc-badge--gray">{(documents || []).length}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowQuery(!showQuery); setShowIngest(false); }}
              className={`mc-pill ${showQuery ? 'mc-pill--active' : ''}`}>🔍 Sorgula</button>
            <button onClick={handleSyncKB} disabled={syncKB.isPending}
              className="mc-pill hover:mc-pill--active disabled:opacity-50">
              {syncKB.isPending ? '⏳ Senkronize...' : '🔄 KB Senkronize'}
            </button>
            <button onClick={() => { setShowIngest(!showIngest); setShowQuery(false); }}
              className="mc-btn mc-btn--primary text-xs">+ Yeni Doküman</button>
          </div>
        </div>

        {/* Query Panel */}
        {showQuery && (
          <div className="mc-card p-5 mb-6 mc-fade-up border-purple-200/50 dark:border-purple-800/30">
            <p className="mc-label mb-3">Vektör Arama</p>
            <div className="flex gap-2 mb-3">
              <input type="text" value={queryText} onChange={(e) => setQueryText(e.target.value)}
                placeholder="Arama sorgusu yazın..." className="mc-input flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()} />
              <button onClick={handleQuery} disabled={queryDocs.isPending}
                className="mc-btn mc-btn--primary text-xs disabled:opacity-50">
                {queryDocs.isPending ? '⏳' : 'Ara'}
              </button>
            </div>
            {queryResults && (
              <div className="space-y-2">
                <p className="mc-label">{queryResults.results?.length || 0} sonuç bulundu</p>
                {(queryResults.results || []).map((r: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="mc-badge mc-badge--purple text-[10px]">skor: {(r.score || 0).toFixed(3)}</span>
                      <span className="mc-label">{r.item?.metadata?.uri || 'unknown'}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">{r.item?.metadata?.text || JSON.stringify(r)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ingest Panel */}
        {showIngest && (
          <div className="mc-card p-5 mb-6 mc-fade-up">
            <p className="mc-label mb-3">Yeni Doküman Ekle</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input type="text" placeholder="Başlık" value={ingestForm.title}
                  onChange={(e) => setIngestForm({ ...ingestForm, title: e.target.value })} className="mc-input flex-1" />
                <select value={ingestForm.content_type} onChange={(e) => setIngestForm({ ...ingestForm, content_type: e.target.value })}
                  className="mc-input">
                  <option value="markdown">Markdown</option>
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <textarea placeholder="İçerik..." value={ingestForm.content}
                onChange={(e) => setIngestForm({ ...ingestForm, content: e.target.value })}
                className="mc-input w-full font-mono" rows={8} />
              <div className="flex gap-2">
                <button onClick={handleIngest} disabled={ingestDoc.isPending}
                  className="mc-btn mc-btn--primary text-xs disabled:opacity-50">
                  {ingestDoc.isPending ? '⏳ İşleniyor...' : 'Ekle & İndeksle'}
                </button>
                <button onClick={() => setShowIngest(false)} className="mc-btn mc-btn--ghost text-xs">İptal</button>
              </div>
            </div>
          </div>
        )}

        {/* Documents Table */}
        <div className="mc-card overflow-hidden mc-fade-up-delay">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 mc-label">Başlık</th>
                <th className="text-left px-4 py-3 mc-label">Tür</th>
                <th className="text-left px-4 py-3 mc-label">Durum</th>
                <th className="text-left px-4 py-3 mc-label">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(documents || []).map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{doc.title}</td>
                  <td className="px-4 py-3"><span className="mc-badge mc-badge--gray text-[10px]">{doc.content_type}</span></td>
                  <td className="px-4 py-3">
                    <span className={`mc-badge text-[10px] ${STATUS_BADGE[doc.status] || 'mc-badge--gray'}`}>{doc.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{new Date(doc.created_at).toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!documents || documents.length === 0) && (
            <div className="mc-empty">
              <div className="mc-empty-icon">📄</div>
              <p className="mc-empty-title">Henüz doküman yok</p>
              <p className="mc-empty-desc">Yeni doküman ekleyin veya KB senkronize edin.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}