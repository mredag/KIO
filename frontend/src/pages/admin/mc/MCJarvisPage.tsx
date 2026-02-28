import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import {
  useJarvisSessions,
  useJarvisSession,
  useJarvisMessages,
  useCreateJarvisSession,
  useSendJarvisMessage,
  useConfirmJarvisSession,
  useStartDMReview,
  JarvisSession,
  JarvisMessage,
} from '../../../hooks/useJarvisApi';
import { useJarvisSSE, SSEEvent } from '../../../hooks/useJarvisSSE';
import { AgentStatusIndicator, AgentPhase } from '../../../components/mc/AgentStatusIndicator';

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  planning: { badge: 'mc-badge--blue', label: 'Planlama' },
  awaiting_confirmation: { badge: 'mc-badge--amber', label: 'Onay Bekliyor' },
  confirmed: { badge: 'mc-badge--purple', label: 'Onaylandı' },
  running: { badge: 'mc-badge--blue', label: 'Çalışıyor' },
  awaiting_approval: { badge: 'mc-badge--amber', label: 'Kalite Onayı' },
  completed: { badge: 'mc-badge--green', label: 'Tamamlandı' },
  failed: { badge: 'mc-badge--red', label: 'Başarısız' },
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function tryParseTaskSummary(content: string): Record<string, unknown> | null {
  try {
    const match = content.match(/```json\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*"type"\s*:\s*"task_summary"[\s\S]*\})/);
    if (match) {
      const parsed = JSON.parse(match[1] || match[0]);
      if (parsed.type === 'task_summary') return parsed;
    }
  } catch { /* ignore */ }
  return null;
}


// ─── Task Summary Card ───────────────────────────────────────────────
function TaskSummaryCard({
  summary,
  onConfirm,
  onEdit,
  isConfirming,
}: {
  summary: Record<string, unknown>;
  onConfirm: () => void;
  onEdit: () => void;
  isConfirming: boolean;
}) {
  return (
    <div className="mc-card p-4 border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10 my-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">📋</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">Görev Özeti</span>
        <span className="mc-badge mc-badge--amber text-[10px]">Onay Bekliyor</span>
      </div>
      {summary.title ? (
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{String(summary.title)}</p>
      ) : null}
      {summary.objective ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{String(summary.objective)}</p>
      ) : null}
      {Array.isArray(summary.deliverables) && summary.deliverables.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Çıktılar:</p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
            {(summary.deliverables as string[]).map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}
      {summary.suggestedModel ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-3">🧠 {String(summary.suggestedModel)}</p>
      ) : null}
      <div className="flex gap-2 pt-2 border-t border-amber-200 dark:border-amber-800/40">
        <button onClick={onConfirm} disabled={isConfirming} className="mc-btn mc-btn--primary text-xs flex-1">
          {isConfirming ? 'Onaylanıyor...' : '✓ Onayla'}
        </button>
        <button onClick={onEdit} disabled={isConfirming} className="mc-btn mc-btn--ghost text-xs flex-1">
          ✎ Düzelt
        </button>
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────
function MessageBubble({ message }: { message: JarvisMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[11px]">🤖</span>
          </div>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-sky-600 text-white rounded-tr-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
        }`}>
          {message.content}
        </div>
        <span className={`text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex-shrink-0 self-end ${isUser ? 'text-right' : ''}`}>
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}

// ─── Completion Banner ───────────────────────────────────────────────
function CompletionBanner({ session }: { session: JarvisSession }) {
  if (session.status !== 'completed' && session.status !== 'failed') return null;
  const isOk = session.status === 'completed';
  return (
    <div className={`mx-4 mb-3 rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
      isOk
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
    }`}>
      <span>{isOk ? '✅' : '❌'}</span>
      <span>{isOk ? 'Görev başarıyla tamamlandı.' : 'Görev başarısız oldu.'}</span>
    </div>
  );
}

// ─── Session Sidebar Item ────────────────────────────────────────────
function SessionItem({
  session,
  isSelected,
  onClick,
}: {
  session: JarvisSession;
  isSelected: boolean;
  onClick: () => void;
}) {
  const st = STATUS_MAP[session.status] || STATUS_MAP.planning;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 ${
        isSelected
          ? 'bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <p className={`text-sm font-medium truncate ${
          isSelected ? 'text-sky-700 dark:text-sky-300' : 'text-gray-900 dark:text-gray-100'
        }`}>
          {session.title}
        </p>
        <span className={`mc-badge ${st.badge} text-[9px] ml-2 flex-shrink-0`}>{st.label}</span>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        {formatDate(session.updated_at)} · {formatTime(session.updated_at)}
      </p>
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function MCJarvisPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [agentDetail, setAgentDetail] = useState<string | null>(null);
  const [agentContext, setAgentContext] = useState<'planning' | 'execution'>('planning');
  const [agentStartedAt, setAgentStartedAt] = useState<number | undefined>();
  const [streamingMessages, setStreamingMessages] = useState<JarvisMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Data hooks
  const { data: sessions, isLoading: sessionsLoading } = useJarvisSessions();
  const { data: session } = useJarvisSession(selectedSessionId);
  const { data: messages } = useJarvisMessages(selectedSessionId);
  const createSession = useCreateJarvisSession();
  const sendMessage = useSendJarvisMessage();
  const confirmSession = useConfirmJarvisSession();
  const startDMReview = useStartDMReview();

  // SSE handler
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'typing') {
      setIsTyping(true);
      setAgentPhase('connecting');
      setAgentStartedAt(Date.now());
    } else if (event.type === 'agent_status') {
      setIsTyping(true);
      const phase = event.data.phase as AgentPhase;
      setAgentPhase(phase);
      setAgentDetail((event.data.detail as string) || null);
      if (event.data.context === 'execution') setAgentContext('execution');
      // Keep the original startedAt for elapsed timer continuity
      if (!agentStartedAt) setAgentStartedAt(Date.now());
    } else if (event.type === 'message') {
      setIsTyping(true);
      setAgentPhase('agent_responding');
      // Append streaming chunk to local state
      const msg = event.data as unknown as JarvisMessage;
      if (msg && msg.content) {
        setStreamingMessages(prev => {
          const existing = prev.find(m => m.id === msg.id);
          if (existing) {
            return prev.map(m => m.id === msg.id ? { ...m, content: msg.content } : m);
          }
          return [...prev, {
            id: msg.id || `stream-${Date.now()}`,
            session_id: selectedSessionId || '',
            role: 'assistant',
            content: msg.content,
            created_at: msg.created_at || new Date().toISOString(),
          } as JarvisMessage];
        });
      }
    } else if (event.type === 'message_complete') {
      setIsTyping(false);
      setAgentPhase('idle');
      setAgentDetail(null);
      setAgentStartedAt(undefined);
      // Don't clear streamingMessages immediately — the React Query invalidation
      // (in useJarvisSSE) will refetch persisted messages. Once the refetch completes,
      // the allMessages merge logic filters out duplicates via persistedIds.
      // If there's no streaming message yet (operational tasks skip 'message' events),
      // inject the completed message into streaming so it's visible until refetch lands.
      const completedMsg = event.data as Record<string, unknown>;
      if (completedMsg?.id && completedMsg?.content) {
        setStreamingMessages([{
          id: completedMsg.id as string,
          session_id: selectedSessionId || '',
          role: 'assistant',
          content: completedMsg.content as string,
          created_at: (completedMsg.created_at as string) || new Date().toISOString(),
        }]);
      }
    } else if (event.type === 'status') {
      setIsTyping(false);
      setAgentPhase('idle');
      setAgentDetail(null);
      setAgentStartedAt(undefined);
    } else if (event.type === 'error') {
      setIsTyping(false);
      setAgentPhase('idle');
      setAgentDetail(null);
      setAgentStartedAt(undefined);
    }
  }, [selectedSessionId, agentStartedAt]);

  useJarvisSSE(selectedSessionId, handleSSEEvent);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessages, isTyping]);

  // Merge persisted messages with streaming messages
  const allMessages = (() => {
    const persisted = messages || [];
    if (streamingMessages.length === 0) return persisted;
    const persistedIds = new Set(persisted.map(m => m.id));
    const newStreaming = streamingMessages.filter(m => !persistedIds.has(m.id));
    return [...persisted, ...newStreaming];
  })();

  // Clear streaming state once persisted data has caught up (all streaming IDs are in persisted)
  useEffect(() => {
    if (streamingMessages.length === 0 || !messages) return;
    const persistedIds = new Set(messages.map(m => m.id));
    const allCaughtUp = streamingMessages.every(m => persistedIds.has(m.id));
    if (allCaughtUp) setStreamingMessages([]);
  }, [messages, streamingMessages]);

  // Find task summary in the latest assistant message for awaiting_confirmation sessions
  const taskSummary = (() => {
    if (session?.status !== 'awaiting_confirmation') return null;
    const assistantMsgs = allMessages.filter(m => m.role === 'assistant');
    if (assistantMsgs.length === 0) return null;
    const last = assistantMsgs[assistantMsgs.length - 1];
    return tryParseTaskSummary(last.content);
  })();

  const handleCreateSession = () => {
    createSession.mutate(undefined, {
      onSuccess: (newSession) => {
        setSelectedSessionId(newSession.id);
        setStreamingMessages([]);
        setIsTyping(false);
      },
    });
  };

  const handleStartDMReview = () => {
    startDMReview.mutate(30, {
      onSuccess: (result) => {
        setSelectedSessionId(result.sessionId);
        setStreamingMessages([]);
        setIsTyping(true);
        setAgentPhase('connecting');
        setAgentContext('planning');
        setAgentStartedAt(Date.now());
      },
    });
  };

  const handleSendMessage = () => {
    const content = inputValue.trim();
    if (!content || !selectedSessionId || sendMessage.isPending) return;
    setInputValue('');
    setIsTyping(true);
    setAgentPhase('connecting');
    setAgentContext('planning');
    setAgentStartedAt(Date.now());
    sendMessage.mutate({ sessionId: selectedSessionId, content });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirm = () => {
    if (!selectedSessionId) return;
    confirmSession.mutate(selectedSessionId);
  };

  const handleEdit = () => {
    inputRef.current?.focus();
  };

  const canSend = session?.status === 'planning' || session?.status === 'awaiting_confirmation';

  return (
    <AdminLayout>
      <div className="mc-fade-up" style={{ height: 'calc(100vh - 140px)', minHeight: '500px' }}>
        <div className="flex h-full gap-4">
          {/* ─── Session Sidebar ─────────────────────────────── */}
          <div className="w-[280px] flex-shrink-0 flex flex-col mc-card" style={{ hover: 'none' } as any}>
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <button
                onClick={handleCreateSession}
                disabled={createSession.isPending}
                className="mc-btn mc-btn--primary text-xs w-full mb-2"
              >
                {createSession.isPending ? 'Oluşturuluyor...' : '+ Yeni Görev'}
              </button>
              <button
                onClick={handleStartDMReview}
                disabled={startDMReview.isPending}
                className="mc-btn mc-btn--ghost text-xs w-full border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400"
              >
                {startDMReview.isPending ? 'Veri çekiliyor...' : '📊 DM Kalite Analizi'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessionsLoading ? (
                <div className="space-y-2 p-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (sessions || []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-gray-400 dark:text-gray-500">Henüz görev yok</p>
                </div>
              ) : (
                (sessions || []).map((s: JarvisSession) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isSelected={s.id === selectedSessionId}
                    onClick={() => {
                      setSelectedSessionId(s.id);
                      setStreamingMessages([]);
                      setIsTyping(false);
                      setAgentPhase('idle');
                      setAgentDetail(null);
                      setAgentStartedAt(undefined);
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* ─── Message Area ────────────────────────────────── */}
          <div className="flex-1 flex flex-col mc-card overflow-hidden" style={{ hover: 'none' } as any}>
            {!selectedSessionId ? (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-4xl mb-3 opacity-40">🤖</div>
                <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-1">Jarvis</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Yeni bir görev oluşturun veya mevcut bir görevi seçin.</p>
                <div className="flex gap-2">
                  <button onClick={handleCreateSession} disabled={createSession.isPending} className="mc-btn mc-btn--primary text-xs">
                    + Yeni Görev
                  </button>
                  <button onClick={handleStartDMReview} disabled={startDMReview.isPending} className="mc-btn mc-btn--ghost text-xs border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                    {startDMReview.isPending ? 'Veri çekiliyor...' : '📊 DM Kalite Analizi'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">🤖</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {session?.title || 'Yeni Görev'}
                    </span>
                  </div>
                  {session && (
                    <span className={`mc-badge ${STATUS_MAP[session.status]?.badge || 'mc-badge--gray'} text-[10px]`}>
                      {STATUS_MAP[session.status]?.label || session.status}
                    </span>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  {allMessages.length === 0 && !isTyping && (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Görevinizi tanımlayarak başlayın. Jarvis size sorular soracak.
                      </p>
                    </div>
                  )}
                  {allMessages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {taskSummary && (
                    <TaskSummaryCard
                      summary={taskSummary}
                      onConfirm={handleConfirm}
                      onEdit={handleEdit}
                      isConfirming={confirmSession.isPending}
                    />
                  )}
                  {isTyping && (
                    <AgentStatusIndicator
                      phase={agentPhase}
                      detail={agentDetail}
                      context={agentContext}
                      startedAt={agentStartedAt}
                    />
                  )}
                  {session && <CompletionBanner session={session} />}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                  {canSend ? (
                    <div className="flex gap-2">
                      <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Mesajınızı yazın..."
                        rows={1}
                        className="mc-input flex-1 resize-none"
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || sendMessage.isPending}
                        className="mc-btn mc-btn--primary text-xs px-4 self-end"
                      >
                        {sendMessage.isPending ? '...' : 'Gönder'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
                      {session?.status === 'running' ? 'Görev çalışıyor...' : 'Bu oturum artık mesaj kabul etmiyor.'}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
