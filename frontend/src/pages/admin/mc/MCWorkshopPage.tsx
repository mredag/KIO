import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import {
  useMCJobs,
  useUpdateMCJobStatus,
  useCreateMCJob,
  useMCMomentum,
  useMCDashboard,
  useMCAgents,
  useMCJobDetail,
} from '../../../hooks/useMissionControlApi';
import { GlassCard } from '../../../components/mc/GlassCard';
import { MomentumGauge } from '../../../components/mc/MomentumGauge';
import { HeartbeatTimer } from '../../../components/mc/HeartbeatTimer';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { getMomentumColor, sortByMomentum, calculateBandwidth } from '../../../lib/mc/momentumUtils';
import { partitionJobs, countJobsByStatus } from '../../../lib/mc/workshopUtils';

/* ─── MomentumTaskCard ─── */
function MomentumTaskCard({
  job,
  similarity,
  onStatusChange,
  onClick,
}: {
  job: any;
  similarity?: number;
  reason?: string;
  onStatusChange: (id: string, status: string) => void;
  onClick?: () => void;
}) {
  const hasSim = similarity !== undefined && similarity >= 0;
  const color = hasSim ? getMomentumColor(similarity) : null;
  const tags: string[] = (() => {
    try { return JSON.parse(job.tags || '[]'); } catch { return []; }
  })();
  const isDeepWork = (job.priority === 'critical' || job.priority === 'high');
  const isLowMomentum = hasSim && similarity < 40;
  const [dragging, setDragging] = useState(false);

  const COLOR_BAR: Record<string, string> = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  const handleDragStart = (e: React.DragEvent) => {
    setDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ jobId: job.id, fromStatus: job.status }));
  };
  const handleDragEnd = () => setDragging(false);

  return (
    <div
      className={`mc-glass rounded-lg overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-sky-500/30' : ''} ${dragging ? 'opacity-40 scale-95' : ''}`}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Momentum accent bar */}
      {color && (
        <div className={`h-1 ${COLOR_BAR[color]}`} />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between mb-1.5">
          <h4 className="text-sm font-medium text-gray-100 line-clamp-2 flex-1">{job.title}</h4>
          {hasSim && (
            <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              color === 'green' ? 'bg-emerald-500/20 text-emerald-400' :
              color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {similarity}%
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag: string) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Complexity badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isDeepWork ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
          }`}>
            {isDeepWork ? 'Deep Work' : 'Quick Win'}
          </span>
          {isLowMomentum && (
            <span className="text-[10px] text-red-400">⚠ Context Switch</span>
          )}
        </div>

        {/* Agent + meta */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-2">
          {job.agent_name && <span>🤖 {job.agent_name}</span>}
          {job.retry_count > 0 && <span className="text-amber-500">↻ {job.retry_count}</span>}
        </div>

        {/* Start button for queued */}
        {job.status === 'queued' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(job.id, 'running'); }}
            className="mc-btn mc-btn--primary text-xs py-1 px-3 w-full"
          >
            Start →
          </button>
        )}

        {/* Error display */}
        {job.error && (
          <p className="text-[10px] text-red-400 bg-red-900/20 rounded p-1.5 mt-1 line-clamp-2">{job.error}</p>
        )}
      </div>
    </div>
  );
}

/* ─── ActivityLogModal ─── */
function ActivityLogModal({ isOpen, onClose, jobId }: { isOpen: boolean; onClose: () => void; jobId: string }) {
  const { data: jobDetail, isLoading } = useMCJobDetail(isOpen ? jobId : undefined);

  if (!isOpen) return null;

  const runs = jobDetail?.runs || [];
  const events = jobDetail?.events || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Activity Log"
    >
      <div className="mc-glass rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="mc-font-inter text-lg font-semibold text-gray-100">
            {jobDetail?.title || 'Activity Log'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-lg">✕</button>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-800/40 rounded" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Timeline */}
            {runs.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Runs</h4>
                <div className="space-y-2">
                  {runs.map((run: any, i: number) => (
                    <RunEntry key={run.id || i} run={run} />
                  ))}
                </div>
              </div>
            )}
            {events.length > 0 && (
              <div>
                <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Events</h4>
                <div className="space-y-1">
                  {events.map((evt: any, i: number) => (
                    <div key={evt.id || i} className="flex items-start gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${evt.event_type?.includes('error') ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      <div>
                        <span className="text-gray-300">{evt.event_type}</span>
                        <span className="text-gray-500 ml-2">{new Date(evt.created_at).toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {runs.length === 0 && events.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No activity recorded</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RunEntry({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  const isError = run.status === 'failed' || run.status === 'error';

  return (
    <div className="mc-glass rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <span className="text-xs text-gray-300 font-medium">{run.model || 'Unknown model'}</span>
        <span className="text-[10px] text-gray-500 ml-auto">
          {run.tokens_used ? `${run.tokens_used} tokens` : ''}
          {run.duration_ms ? ` · ${(run.duration_ms / 1000).toFixed(1)}s` : ''}
          {run.cost ? ` · $${Number(run.cost).toFixed(4)}` : ''}
        </span>
      </div>
      {run.response_text && (
        <>
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-sky-400 hover:text-sky-300">
            {expanded ? 'Hide response' : 'Show response'}
          </button>
          {expanded && (
            <pre className="text-[10px] text-gray-400 bg-gray-900/50 rounded p-2 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {run.response_text}
            </pre>
          )}
        </>
      )}
      {run.error && (
        <p className="text-[10px] text-red-400 mt-1">{run.error}</p>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function MCWorkshopPage() {
  const { data: jobs, isLoading } = useMCJobs();
  const { data: momentum } = useMCMomentum();
  const { data: dashboard } = useMCDashboard();
  const { data: agents } = useMCAgents();
  const updateStatus = useUpdateMCJobStatus();
  const createJob = useCreateMCJob();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [activityJobId, setActivityJobId] = useState<string | null>(null);

  const handleStatusChange = (id: string, status: string) => updateStatus.mutate({ id, status });
  const handleDragDrop = (jobId: string, targetStatus: string) => {
    // Map kanban column status to valid mc_jobs status
    const statusMap: Record<string, string> = {
      queued: 'queued',
      active: 'running',
      completed: 'completed',
    };
    const newStatus = statusMap[targetStatus];
    if (newStatus) updateStatus.mutate({ id: jobId, status: newStatus });
  };
  const handleCreateJob = () => {
    if (!newTitle.trim()) return;
    createJob.mutate({ title: newTitle, source: 'manual', priority: 'medium' });
    setNewTitle('');
    setShowCreate(false);
  };

  const allJobs = jobs || [];
  const counts = countJobsByStatus(allJobs);
  const partitioned = partitionJobs(allJobs);

  // Momentum-based sorting for queued column
  const sortedQueued = momentum?.task_similarities?.length
    ? sortByMomentum(partitioned.queued, momentum.task_similarities)
    : partitioned.queued;

  // Bandwidth calculation
  const activeAgentCount = (agents || []).filter((a: any) => a.status === 'active').length;
  const runningJobCount = allJobs.filter((j: any) => j.status === 'running').length;
  const bandwidth = calculateBandwidth(runningJobCount, activeAgentCount);

  // Similarity map for queued cards
  const simMap = new Map<string, { job_id: string; similarity: number; reason: string }>(
    (momentum?.task_similarities || []).map((s: any) => [s.job_id, s]),
  );

  // Today's cost from dashboard
  const todayCost = dashboard?.costs?.today_cost ?? 0;
  const todayTokens = dashboard?.costs?.today_tokens ?? 0;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up p-4 md:p-6">
          <h1 className="mc-font-inter text-2xl font-bold text-gray-100 mb-4">Workshop</h1>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} height="h-64" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 mc-fade-up">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="mc-font-inter text-2xl font-bold text-gray-100">Workshop</h1>
            <button onClick={() => setShowCreate(!showCreate)} className="mc-btn mc-btn--primary text-xs">+ Yeni İş</button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Status counters */}
            <div className="flex items-center gap-3">
              <CounterBadge label="Queued" count={counts.queued} color="gray" />
              <CounterBadge label="Active" count={counts.active} color="sky" />
              <CounterBadge label="Done" count={counts.completed} color="emerald" />
            </div>
            {/* Bandwidth */}
            <MomentumGauge value={bandwidth} size={48} label="BW" />
            {/* Heartbeat */}
            <HeartbeatTimer intervalSeconds={300} />
            {/* Cost */}
            <div className="text-xs text-gray-400">
              <span className="text-gray-200 font-medium">${Number(todayCost).toFixed(2)}</span>
              <span className="ml-1">/ {todayTokens.toLocaleString()} tok</span>
            </div>
          </div>
        </div>

        {/* Create job inline */}
        {showCreate && (
          <GlassCard>
            <div className="flex gap-2">
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="İş başlığı..." className="mc-input flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateJob()} autoFocus />
              <button onClick={handleCreateJob} className="mc-btn mc-btn--primary text-xs">Oluştur</button>
              <button onClick={() => setShowCreate(false)} className="mc-btn mc-btn--ghost text-xs">İptal</button>
            </div>
          </GlassCard>
        )}

        {/* 3-column Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Queued */}
          <KanbanColumn label="Queued" dot="bg-gray-400" count={sortedQueued.length} status="queued" onDrop={handleDragDrop}>
            {sortedQueued.map((job: any) => {
              const sim = simMap.get(job.id);
              return (
                <MomentumTaskCard
                  key={job.id}
                  job={job}
                  similarity={sim?.similarity}
                  reason={sim?.reason}
                  onStatusChange={handleStatusChange}
                />
              );
            })}
          </KanbanColumn>

          {/* Active */}
          <KanbanColumn label="Active" dot="bg-sky-500" count={partitioned.active.length} status="active" onDrop={handleDragDrop}>
            {partitioned.active.map((job: any) => {
              const isFailed = job.status === 'failed' || job.status === 'dead_letter';
              return (
                <div key={job.id} className="relative">
                  {isFailed && (
                    <span className="absolute -top-1 -right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 z-10">
                      {job.status === 'dead_letter' ? 'DL' : 'FAIL'}
                    </span>
                  )}
                  <MomentumTaskCard job={job} onStatusChange={handleStatusChange} />
                </div>
              );
            })}
          </KanbanColumn>

          {/* Completed */}
          <KanbanColumn label="Completed" dot="bg-emerald-500" count={partitioned.completed.length} status="completed" onDrop={handleDragDrop}>
            {partitioned.completed.map((job: any) => (
              <MomentumTaskCard
                key={job.id}
                job={job}
                onStatusChange={handleStatusChange}
                onClick={() => setActivityJobId(job.id)}
              />
            ))}
          </KanbanColumn>
        </div>

        {/* Activity Log Modal */}
        {activityJobId && (
          <ActivityLogModal
            isOpen={!!activityJobId}
            onClose={() => setActivityJobId(null)}
            jobId={activityJobId}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function CounterBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'text-gray-400',
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500 uppercase">{label}</span>
      <span className={`mc-font-inter text-sm font-semibold ${colorMap[color] || 'text-gray-300'}`}>{count}</span>
    </div>
  );
}

function KanbanColumn({ label, dot, count, status, onDrop, children }: {
  label: string; dot: string; count: number; status: string;
  onDrop?: (jobId: string, targetStatus: string) => void; children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data?.jobId && data?.fromStatus !== status) {
        onDrop?.(data.jobId, status);
      }
    } catch { /* ignore */ }
  };

  return (
    <div
      className={`bg-gray-800/20 rounded-xl p-3 min-h-[200px] border transition-colors ${
        dragOver ? 'border-sky-500/50 bg-sky-900/10' : 'border-gray-800/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{label}</h3>
        <span className="text-[10px] text-gray-600 ml-auto">{count}</span>
      </div>
      <div className="space-y-2">
        {children}
        {count === 0 && <p className="text-xs text-gray-600 text-center py-4 italic">Empty</p>}
      </div>
    </div>
  );
}
