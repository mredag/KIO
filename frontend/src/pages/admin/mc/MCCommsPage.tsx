import { useState } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import { TabNav } from '../../../components/mc/TabNav';
import {
  useBoards,
  useBoard,
  useCreateBoard,
  useCommsMessages,
  useSendMessage,
  useSharedMemory,
  useWriteMemory,
  useDeleteMemory,
  useBoardActivity,
} from '../../../hooks/useAgentCommsApi';
import { useCommsSSE } from '../../../hooks/useCommsSSE';
import { useMCAgents } from '../../../hooks/useMissionControlApi';

const TABS = [
  { key: 'boards', label: 'Panolar' },
  { key: 'messages', label: 'Mesajlar' },
  { key: 'detail', label: 'Detay' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  completed: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  archived: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
};

const MSG_TYPE_COLORS: Record<string, string> = {
  nudge: 'bg-red-500/15 text-red-400 border-red-500/20',
  delegation: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  status_update: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  context_share: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  query: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  response: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  broadcast: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
};

const DELIVERY_COLORS: Record<string, string> = {
  delivered: 'bg-emerald-400',
  pending: 'bg-amber-400',
  failed: 'bg-red-400',
};

const MEMORY_TYPE_COLORS: Record<string, string> = {
  context: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  finding: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  decision: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  data: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};


/* ─── Helper: format relative time ─── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  return `${Math.floor(hrs / 24)}g önce`;
}

/* ─── Helper: find agent name by id ─── */
function agentName(agents: any[], id: string): string {
  const a = agents?.find((ag: any) => ag.id === id);
  return a?.name || a?.role || id;
}

/* ═══════════════════════════════════════
   CreateBoardModal (Task 12.3)
   ═══════════════════════════════════════ */
function CreateBoardModal({
  isOpen,
  onClose,
  agents,
}: {
  isOpen: boolean;
  onClose: () => void;
  agents: any[];
}) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [leadAgentId, setLeadAgentId] = useState('');
  const [error, setError] = useState('');
  const createBoard = useCreateBoard();

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) { setError('Pano adı gerekli'); return; }
    if (!leadAgentId) { setError('Lider ajan seçin'); return; }
    setError('');
    createBoard.mutate(
      { name: name.trim(), objective: objective.trim() || undefined, lead_agent_id: leadAgentId },
      {
        onSuccess: () => {
          setName(''); setObjective(''); setLeadAgentId(''); setError('');
          onClose();
        },
        onError: (err: any) => setError(err?.response?.data?.error || 'Hata oluştu'),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="mc-glass rounded-2xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-100">Yeni Pano Oluştur</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Pano Adı</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500/50"
              placeholder="Örn: Instagram Optimizasyonu"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hedef</label>
            <textarea
              value={objective} onChange={(e) => setObjective(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500/50 resize-none"
              rows={3} placeholder="Pano hedefini açıklayın..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Lider Ajan</label>
            <select
              value={leadAgentId} onChange={(e) => setLeadAgentId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-sky-500/50"
            >
              <option value="">Ajan seçin...</option>
              {(agents || []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name || a.role || a.id}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">İptal</button>
          <button
            onClick={handleSubmit}
            disabled={createBoard.isPending}
            className="px-4 py-2 text-sm bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition-colors disabled:opacity-50"
          >
            {createBoard.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════
   BoardOverviewSection (Tab 1: Panolar)
   ═══════════════════════════════════════ */
function BoardOverviewSection({
  onSelectBoard,
  agents,
}: {
  onSelectBoard: (id: string) => void;
  agents: any[];
}) {
  const { data: boardsData, isLoading } = useBoards();
  const [showCreate, setShowCreate] = useState(false);
  const boards = boardsData?.boards || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Panolar</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition-colors"
        >
          + Yeni Pano
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-glass rounded-lg p-4 animate-pulse h-32" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <GlassCard hover={false}>
          <p className="text-sm text-gray-500 text-center py-8">Henüz pano yok. Yeni bir pano oluşturun.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board: any) => (
            <button
              key={board.id}
              onClick={() => onSelectBoard(board.id)}
              className="text-left w-full"
            >
              <GlassCard>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-gray-100 truncate flex-1">{board.name}</h3>
                    <span className={`ml-2 px-2 py-0.5 text-[10px] font-medium rounded-full border ${STATUS_COLORS[board.status] || STATUS_COLORS.archived}`}>
                      {board.status}
                    </span>
                  </div>
                  {board.objective && (
                    <p className="text-xs text-gray-400 line-clamp-2">{board.objective}</p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Lider: {agentName(agents, board.lead_agent_id)}
                    </span>
                    {board.member_count !== undefined && (
                      <span>{board.member_count} üye</span>
                    )}
                    {board.active_job_count !== undefined && (
                      <span>{board.active_job_count} görev</span>
                    )}
                  </div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      <CreateBoardModal isOpen={showCreate} onClose={() => setShowCreate(false)} agents={agents} />
    </div>
  );
}


/* ═══════════════════════════════════════
   MessageFeedSection (Tab 2: Mesajlar)
   ═══════════════════════════════════════ */
function MessageFeedSection({ agents, boards }: { agents: any[]; boards: any[] }) {
  const [filters, setFilters] = useState<{
    sender_id?: string;
    recipient_id?: string;
    message_type?: string;
    board_id?: string;
  }>({});
  const { data: msgData, isLoading } = useCommsMessages({ ...filters, limit: 50 });
  const messages = msgData?.messages || [];

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.sender_id || ''}
          onChange={(e) => updateFilter('sender_id', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50"
        >
          <option value="">Gönderen</option>
          {(agents || []).map((a: any) => (
            <option key={a.id} value={a.id}>{a.name || a.role || a.id}</option>
          ))}
        </select>
        <select
          value={filters.recipient_id || ''}
          onChange={(e) => updateFilter('recipient_id', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50"
        >
          <option value="">Alıcı</option>
          {(agents || []).map((a: any) => (
            <option key={a.id} value={a.id}>{a.name || a.role || a.id}</option>
          ))}
        </select>
        <select
          value={filters.message_type || ''}
          onChange={(e) => updateFilter('message_type', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50"
        >
          <option value="">Tür</option>
          <option value="nudge">Nudge</option>
          <option value="delegation">Delegasyon</option>
          <option value="status_update">Durum</option>
          <option value="context_share">Bağlam</option>
          <option value="query">Sorgu</option>
          <option value="response">Yanıt</option>
          <option value="broadcast">Yayın</option>
        </select>
        <select
          value={filters.board_id || ''}
          onChange={(e) => updateFilter('board_id', e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50"
        >
          <option value="">Pano</option>
          {(boards || []).map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Message list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-glass rounded-lg p-3 animate-pulse h-16" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <GlassCard hover={false}>
          <p className="text-sm text-gray-500 text-center py-8">Henüz mesaj yok.</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {messages.map((msg: any) => (
            <GlassCard key={msg.id}>
              <div className="flex items-center gap-3">
                {/* Delivery status dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DELIVERY_COLORS[msg.delivery_status] || DELIVERY_COLORS.pending}`} />

                {/* Sender → Recipient */}
                <div className="flex items-center gap-1 text-xs text-gray-300 min-w-0 flex-shrink-0">
                  <span className="font-medium truncate max-w-[80px]">{agentName(agents, msg.sender_id)}</span>
                  <span className="text-gray-600">→</span>
                  <span className="font-medium truncate max-w-[80px]">{agentName(agents, msg.recipient_id)}</span>
                </div>

                {/* Type badge */}
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border flex-shrink-0 ${MSG_TYPE_COLORS[msg.message_type] || MSG_TYPE_COLORS.response}`}>
                  {msg.message_type}
                </span>

                {/* Content preview */}
                <p className="text-xs text-gray-400 truncate flex-1 min-w-0">{msg.content}</p>

                {/* Timestamp */}
                <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(msg.created_at)}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════
   BoardDetailView (Task 12.2)
   ═══════════════════════════════════════ */
function BoardDetailView({
  boardId,
  agents,
}: {
  boardId: string;
  agents: any[];
}) {
  const { data: boardData, isLoading } = useBoard(boardId);
  const { data: memoryData } = useSharedMemory({ board_id: boardId });
  const { data: msgData } = useCommsMessages({ board_id: boardId, limit: 20 });
  const { data: _activityData } = useBoardActivity(boardId);
  const deleteMemory = useDeleteMemory();

  // SSE for real-time updates
  useCommsSSE(boardId);

  const board = boardData?.board;
  const boardAgents = boardData?.agents || [];
  const boardJobs = boardData?.jobs || [];
  const memoryItems = memoryData?.items || [];
  const boardMessages = msgData?.messages || [];

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="mc-glass rounded-lg p-4 animate-pulse h-24" />)}</div>;
  }

  if (!board) {
    return (
      <GlassCard hover={false}>
        <p className="text-sm text-gray-500 text-center py-8">Pano bulunamadı.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Board header */}
      <GlassCard hover={false}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">{board.name}</h2>
            {board.objective && <p className="text-xs text-gray-400 mt-1">{board.objective}</p>}
          </div>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${STATUS_COLORS[board.status] || STATUS_COLORS.archived}`}>
            {board.status}
          </span>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent List */}
        <GlassCard hover={false}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Üyeler</h3>
          {boardAgents.length === 0 ? (
            <p className="text-xs text-gray-500">Henüz üye yok.</p>
          ) : (
            <div className="space-y-2">
              {boardAgents.map((ba: any) => (
                <div key={ba.agent_id || ba.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <span className="text-[10px] text-sky-400 font-bold">
                      {agentName(agents, ba.agent_id || ba.id).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-gray-300">{agentName(agents, ba.agent_id || ba.id)}</span>
                  {(ba.agent_id || ba.id) === board.lead_agent_id && (
                    <span className="px-1.5 py-0.5 text-[9px] bg-sky-500/15 text-sky-400 border border-sky-500/20 rounded-full">Lider</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Task Dependency Graph */}
        <GlassCard hover={false}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Görevler</h3>
          {boardJobs.length === 0 ? (
            <p className="text-xs text-gray-500">Henüz görev yok.</p>
          ) : (
            <div className="space-y-2">
              {boardJobs.map((job: any) => {
                const deps: string[] = (() => {
                  try { return JSON.parse(job.depends_on || '[]'); } catch { return []; }
                })();
                return (
                  <div key={job.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      job.status === 'completed' ? 'bg-emerald-400' :
                      job.status === 'running' ? 'bg-sky-400' :
                      'bg-gray-500'
                    }`} />
                    <span className="text-gray-300 truncate">{job.title}</span>
                    <span className="text-[10px] text-gray-600">({job.status})</span>
                    {deps.length > 0 && (
                      <span className="text-[10px] text-gray-600">
                        → {deps.map((d: string) => {
                          const depJob = boardJobs.find((j: any) => j.id === d);
                          return depJob?.title || d.slice(0, 8);
                        }).join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Shared Memory Panel */}
      <GlassCard hover={false}>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Paylaşılan Hafıza</h3>
        {memoryItems.length === 0 ? (
          <p className="text-xs text-gray-500 mb-3">Henüz hafıza öğesi yok.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {memoryItems.map((item: any) => {
              const tags: string[] = (() => {
                try { return typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []); } catch { return []; }
              })();
              return (
                <div key={item.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-200">{item.key}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] rounded-full border ${MEMORY_TYPE_COLORS[item.memory_type] || MEMORY_TYPE_COLORS.context}`}>
                        {item.memory_type}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteMemory.mutate(item.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Sil"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{item.value}</p>
                  {tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {tags.map((tag: string, i: number) => (
                        <span key={i} className="px-1.5 py-0.5 text-[9px] bg-white/5 text-gray-500 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <AddMemoryForm boardId={boardId} agents={agents} />
      </GlassCard>

      {/* Message History (board-scoped) */}
      <GlassCard hover={false}>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mesaj Geçmişi</h3>
        {boardMessages.length === 0 ? (
          <p className="text-xs text-gray-500 mb-3">Bu panoda henüz mesaj yok.</p>
        ) : (
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {boardMessages.map((msg: any) => (
              <div key={msg.id} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DELIVERY_COLORS[msg.delivery_status] || DELIVERY_COLORS.pending}`} />
                <span className="text-gray-300 font-medium">{agentName(agents, msg.sender_id)}</span>
                <span className="text-gray-600">→</span>
                <span className="text-gray-300">{agentName(agents, msg.recipient_id)}</span>
                <span className={`px-1.5 py-0.5 text-[9px] rounded-full border ${MSG_TYPE_COLORS[msg.message_type] || MSG_TYPE_COLORS.response}`}>
                  {msg.message_type}
                </span>
                <span className="text-gray-500 truncate flex-1">{msg.content}</span>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(msg.created_at)}</span>
              </div>
            ))}
          </div>
        )}
        <SendMessageForm boardId={boardId} boardAgents={boardAgents} agents={agents} />
      </GlassCard>
    </div>
  );
}


/* ─── AddMemoryForm ─── */
function AddMemoryForm({ boardId, agents }: { boardId: string; agents: any[] }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [tags, setTags] = useState('');
  const [memoryType, setMemoryType] = useState('context');
  const [sourceAgentId, setSourceAgentId] = useState('');
  const writeMemory = useWriteMemory();

  const handleSubmit = () => {
    if (!key.trim() || !value.trim() || !sourceAgentId) return;
    const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
    writeMemory.mutate(
      { board_id: boardId, source_agent_id: sourceAgentId, key: key.trim(), value: value.trim(), tags: tagArr, memory_type: memoryType },
      { onSuccess: () => { setKey(''); setValue(''); setTags(''); } }
    );
  };

  return (
    <div className="border-t border-white/5 pt-3 space-y-2">
      <h4 className="text-[11px] text-gray-500 font-medium">Yeni Hafıza Ekle</h4>
      <div className="grid grid-cols-2 gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Anahtar"
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-sky-500/50" />
        <select value={memoryType} onChange={(e) => setMemoryType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50">
          <option value="context">context</option>
          <option value="finding">finding</option>
          <option value="decision">decision</option>
          <option value="data">data</option>
        </select>
      </div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Değer"
        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-sky-500/50 resize-none" rows={2} />
      <div className="grid grid-cols-2 gap-2">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Etiketler (virgülle)"
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-sky-500/50" />
        <select value={sourceAgentId} onChange={(e) => setSourceAgentId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50">
          <option value="">Kaynak Ajan</option>
          {(agents || []).map((a: any) => (
            <option key={a.id} value={a.id}>{a.name || a.role || a.id}</option>
          ))}
        </select>
      </div>
      <button onClick={handleSubmit} disabled={writeMemory.isPending || !key.trim() || !value.trim() || !sourceAgentId}
        className="px-3 py-1.5 text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition-colors disabled:opacity-50">
        {writeMemory.isPending ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </div>
  );
}

/* ─── SendMessageForm ─── */
function SendMessageForm({
  boardId,
  boardAgents,
  agents,
}: {
  boardId: string;
  boardAgents: any[];
  agents: any[];
}) {
  const [recipientId, setRecipientId] = useState('');
  const [messageType, setMessageType] = useState('status_update');
  const [content, setContent] = useState('');
  const sendMessage = useSendMessage();

  // Use first board agent as default sender (lead agent concept)
  const senderOptions = boardAgents.length > 0 ? boardAgents : agents || [];
  const [senderId, setSenderId] = useState('');

  const handleSend = () => {
    if (!senderId || !recipientId || !content.trim()) return;
    sendMessage.mutate(
      { sender_id: senderId, recipient_id: recipientId, message_type: messageType, content: content.trim(), board_id: boardId },
      { onSuccess: () => setContent('') }
    );
  };

  return (
    <div className="border-t border-white/5 pt-3 space-y-2">
      <h4 className="text-[11px] text-gray-500 font-medium">Mesaj Gönder</h4>
      <div className="grid grid-cols-3 gap-2">
        <select value={senderId} onChange={(e) => setSenderId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50">
          <option value="">Gönderen</option>
          {senderOptions.map((a: any) => (
            <option key={a.agent_id || a.id} value={a.agent_id || a.id}>
              {agentName(agents, a.agent_id || a.id)}
            </option>
          ))}
        </select>
        <select value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50">
          <option value="">Alıcı</option>
          {senderOptions.map((a: any) => (
            <option key={a.agent_id || a.id} value={a.agent_id || a.id}>
              {agentName(agents, a.agent_id || a.id)}
            </option>
          ))}
        </select>
        <select value={messageType} onChange={(e) => setMessageType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-500/50">
          <option value="nudge">Nudge</option>
          <option value="delegation">Delegasyon</option>
          <option value="status_update">Durum</option>
          <option value="context_share">Bağlam</option>
          <option value="query">Sorgu</option>
          <option value="response">Yanıt</option>
        </select>
      </div>
      <div className="flex gap-2">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mesaj içeriği..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-sky-500/50 resize-none" rows={2} />
        <button onClick={handleSend} disabled={sendMessage.isPending || !senderId || !recipientId || !content.trim()}
          className="self-end px-4 py-1.5 text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition-colors disabled:opacity-50">
          {sendMessage.isPending ? '...' : 'Gönder'}
        </button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════
   Main Page Component (Task 12.1)
   ═══════════════════════════════════════ */
export default function MCCommsPage() {
  const [activeTab, setActiveTab] = useState('boards');
  const [selectedBoardId, setSelectedBoardId] = useState<string | undefined>();
  const { data: agentsRaw } = useMCAgents();
  const { data: boardsData } = useBoards();

  const agents = agentsRaw || [];
  const boards = boardsData?.boards || [];

  const handleSelectBoard = (id: string) => {
    setSelectedBoardId(id);
    setActiveTab('detail');
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-4 mc-fade-up">
        <div className="flex items-center gap-3">
          <h1 className="mc-font-inter text-2xl font-bold text-gray-100">İletişim</h1>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20 rounded-full">
            Agent Comms
          </span>
        </div>

        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'boards' && (
          <BoardOverviewSection onSelectBoard={handleSelectBoard} agents={agents} />
        )}

        {activeTab === 'messages' && (
          <MessageFeedSection agents={agents} boards={boards} />
        )}

        {activeTab === 'detail' && (
          selectedBoardId ? (
            <BoardDetailView boardId={selectedBoardId} agents={agents} />
          ) : (
            <GlassCard hover={false}>
              <p className="text-sm text-gray-500 text-center py-12">
                Bir pano seçin
              </p>
            </GlassCard>
          )
        )}
      </div>
    </AdminLayout>
  );
}
