import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { useMCApprovals, useResolveMCApproval } from '../../../hooks/useMissionControlApi';
import { ConfidenceBar } from '../../../components/mc/ConfidenceBar';
import { RubricChart } from '../../../components/mc/RubricChart';
import { SkeletonCard } from '../../../components/ui/Skeleton';

const TABS = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylanan' },
  { key: 'rejected', label: 'Reddedilen' },
  { key: 'all', label: 'Tümü' },
] as const;

const ACTION_LABELS: Record<string, string> = {
  complete: 'Tamamlama',
  status_change: 'Durum Değişikliği',
  output_review: 'Çıktı İnceleme',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  const days = Math.floor(hrs / 24);
  return `${days}g önce`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'mc-badge--amber',
    approved: 'mc-badge--green',
    rejected: 'mc-badge--red',
  };
  const labels: Record<string, string> = {
    pending: 'Bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
  };
  return (
    <span className={`mc-badge text-[10px] ${map[status] || 'mc-badge--gray'}`}>
      {labels[status] || status}
    </span>
  );
}

export default function MCApprovalsPage() {
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const filters = activeTab === 'all' ? {} : { status: activeTab };
  const { data: approvals, isLoading, error } = useMCApprovals(filters);
  const resolveApproval = useResolveMCApproval();

  const handleResolve = (id: string, status: 'approved' | 'rejected') => {
    setResolvingId(id);
    resolveApproval.mutate(
      { id, status, reviewer_note: reviewNotes[id] || undefined },
      {
        onSettled: () => setResolvingId(null),
        onSuccess: () => {
          setExpandedId(null);
          setReviewNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
        },
      }
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">Onaylar</h1></div>
          <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} height="h-28" />)}</div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">Onaylar</h1></div>
          <div className="mc-card p-4">
            <p className="text-red-400 text-sm">Bağlantı hatası. Backend çalışıyor mu?</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const list = approvals || [];

  return (
    <AdminLayout>
      <div>
        <div className="mc-page-header mc-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="text-sm">✅</span>
            </div>
            <h1 className="mc-page-title">Onaylar</h1>
            <span className="mc-badge mc-badge--gray">{list.length}</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-6 mc-fade-up">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Approval Cards */}
        <div className="space-y-3 mc-fade-up-delay">
          {list.map((approval: any) => {
            const isExpanded = expandedId === approval.id;
            let rubricScores: Record<string, number> | null = null;
            try {
              rubricScores = approval.rubric_scores
                ? (typeof approval.rubric_scores === 'string' ? JSON.parse(approval.rubric_scores) : approval.rubric_scores)
                : null;
            } catch { /* ignore */ }

            let payload: any = null;
            try {
              payload = approval.payload
                ? (typeof approval.payload === 'string' ? JSON.parse(approval.payload) : approval.payload)
                : null;
            } catch { /* ignore */ }

            return (
              <div key={approval.id} className="mc-card p-5">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {approval.job_title || 'İsimsiz İş'}
                    </h3>
                    <StatusBadge status={approval.status} />
                    <span className="mc-badge mc-badge--blue text-[10px]">
                      {ACTION_LABELS[approval.action_type] || approval.action_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="mc-label">{timeAgo(approval.created_at)}</span>
                    <button
                      onClick={() => toggleExpand(approval.id)}
                      className="mc-btn mc-btn--ghost text-xs px-2 py-1"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Agent + Confidence Row */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="mc-label shrink-0">Ajan: <span className="text-gray-300">{approval.agent_name || '—'}</span></span>
                  <div className="flex-1 max-w-xs">
                    <ConfidenceBar value={approval.confidence ?? 0} size="sm" />
                  </div>
                </div>

                {/* Rubric Scores (always visible if present) */}
                {rubricScores && (
                  <div className="mb-3">
                    <RubricChart scores={rubricScores} />
                  </div>
                )}

                {/* Reviewer Note (for resolved) */}
                {approval.reviewer_note && approval.status !== 'pending' && (
                  <div className="mb-3 p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                    <p className="mc-label mb-1">İnceleme Notu</p>
                    <p className="text-xs text-gray-300">{approval.reviewer_note}</p>
                  </div>
                )}

                {/* Resolved At */}
                {approval.resolved_at && (
                  <p className="mc-label text-[10px]">Çözüm: {timeAgo(approval.resolved_at)}</p>
                )}

                {/* Expanded Detail Panel */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
                    {/* Payload */}
                    {payload && (
                      <div>
                        <p className="mc-label mb-1.5">Payload</p>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-gray-700 dark:text-gray-300 overflow-x-auto border border-gray-100 dark:border-gray-800 font-mono max-h-48 overflow-y-auto">
                          {JSON.stringify(payload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Job Result */}
                    {approval.job_result && (
                      <div>
                        <p className="mc-label mb-1.5">İş Sonucu</p>
                        <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-gray-700 dark:text-gray-300 overflow-x-auto border border-gray-100 dark:border-gray-800 font-mono max-h-48 overflow-y-auto">
                          {approval.job_result}
                        </pre>
                      </div>
                    )}

                    {/* Approve/Reject Actions (only for pending) */}
                    {approval.status === 'pending' && (
                      <div className="space-y-3">
                        <div>
                          <p className="mc-label mb-1.5">İnceleme Notu (opsiyonel)</p>
                          <textarea
                            value={reviewNotes[approval.id] || ''}
                            onChange={(e) => setReviewNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                            placeholder="Onay veya red sebebi..."
                            className="mc-input w-full font-mono"
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolve(approval.id, 'approved')}
                            disabled={resolvingId === approval.id}
                            className="mc-btn mc-btn--primary text-xs"
                          >
                            {resolvingId === approval.id ? '...' : '✓ Onayla'}
                          </button>
                          <button
                            onClick={() => handleResolve(approval.id, 'rejected')}
                            disabled={resolvingId === approval.id}
                            className="mc-btn mc-btn--ghost text-xs border border-red-500/20 text-red-400 hover:bg-red-500/10"
                          >
                            {resolvingId === approval.id ? '...' : '✗ Reddet'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {list.length === 0 && (
          <div className="mc-empty mc-fade-up">
            <div className="mc-empty-icon">✅</div>
            <p className="mc-empty-title">
              {activeTab === 'pending' ? 'Bekleyen onay yok' : 'Onay bulunamadı'}
            </p>
            <p className="mc-empty-desc">
              {activeTab === 'pending'
                ? 'Tüm işler güven eşiğini geçti veya henüz onay gerektiren iş yok.'
                : 'Seçili filtreye uygun onay kaydı bulunamadı.'}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}