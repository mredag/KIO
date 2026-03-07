import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import {
  useMCAgents,
  useCreateMCAgent,
  useUpdateMCAgent,
  useDeleteMCAgent,
  useSyncMCAgents,
  useMCJobs,
  useMCEvents,
  useMCCosts,
  useAgentFiles,
  useAgentFile,
  useUpdateAgentFile,
} from '../../../hooks/useMissionControlApi';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { GlassCard } from '../../../components/mc/GlassCard';
import { TabNav } from '../../../components/mc/TabNav';
import { useCommsMessages } from '../../../hooks/useAgentCommsApi';

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'personnel', label: 'Personnel', icon: '👥' },
  { key: 'protocol', label: 'Protocol', icon: '⚙️' },
  { key: 'comms', label: 'Comms', icon: '💬' },
];

const STATUS_MAP: Record<string, { badge: string; label: string; dot: string }> = {
  active: { badge: 'mc-badge--green', label: 'Aktif', dot: 'bg-emerald-500' },
  idle: { badge: 'mc-badge--gray', label: 'Boşta', dot: 'bg-gray-400' },
  busy: { badge: 'mc-badge--blue', label: 'Meşgul', dot: 'bg-sky-500' },
  error: { badge: 'mc-badge--red', label: 'Hata', dot: 'bg-red-500' },
  disabled: { badge: 'mc-badge--gray', label: 'Devre Dışı', dot: 'bg-gray-300' },
};

const AVATAR_COLORS = ['bg-sky-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];

function getAvatarColor(name: string) {
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── AgentAvatar ─────────────────────────────────────────────────────────────

function AgentAvatar({ name, status, size = 'sm' }: { name: string; status: string; size?: 'sm' | 'lg' }) {
  const dotColor = STATUS_MAP[status]?.dot || 'bg-gray-400';
  const sizeClasses = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  const dotSize = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="relative inline-block">
      <div className={`${sizeClasses} rounded-lg ${getAvatarColor(name)} flex items-center justify-center text-white font-semibold`}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div className={`absolute -bottom-0.5 -right-0.5 ${dotSize} rounded-full ${dotColor} border-2 border-white dark:border-gray-900`} />
    </div>
  );
}


// ─── Intelligence Roster (Left Sidebar) ──────────────────────────────────────

function IntelligenceRoster({
  agents,
  selectedId,
  onSelect,
}: {
  agents: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-64 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 space-y-1">
      {agents.map((agent: any) => {
        const isSelected = agent.id === selectedId;
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
              isSelected
                ? 'bg-sky-500/10 border border-sky-500/30 dark:bg-sky-400/10 dark:border-sky-400/20'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'
            }`}
          >
            <AgentAvatar name={agent.name} status={agent.status} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {agent.name}
              </p>
              <p className="mc-label mt-0.5 truncate">{agent.role || 'Ajan'}</p>
            </div>
          </button>
        );
      })}
      {agents.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 dark:text-gray-500">Henüz ajan yok</p>
        </div>
      )}
    </div>
  );
}

// ─── Agent Detail View (Center Panel) ────────────────────────────────────────

const COST_WARNING_THRESHOLD = 1.0; // $1.00/day

function AgentTodayCost({ agentId }: { agentId: string }) {
  const { data: costs } = useMCCosts({ agent_id: agentId, period: 'today' });
  const todayCost = costs?.total_cost ?? 0;
  const exceedsThreshold = todayCost > COST_WARNING_THRESHOLD;

  return (
    <>
      <p className={`text-lg font-bold ${exceedsThreshold ? 'text-red-400' : 'text-gray-900 dark:text-gray-50'}`}>
        ${Number(todayCost).toFixed(3)}
        {exceedsThreshold && <span className="ml-1 text-xs">⚠️</span>}
      </p>
      <p className="mc-label mt-0.5">Bugün</p>
    </>
  );
}

function AgentDetailView({ agent }: { agent: any }) {
  return (
    <div className="flex-1 min-w-0">
      <GlassCard hover={false} className="p-6">
        {/* Header: Avatar + Name + Role */}
        <div className="flex items-start gap-4 mb-6">
          <AgentAvatar name={agent.name} status={agent.status} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">{agent.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{agent.role || 'Ajan'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`mc-badge ${STATUS_MAP[agent.status]?.badge || 'mc-badge--gray'} text-[10px]`}>
                {STATUS_MAP[agent.status]?.label || agent.status}
              </span>
              {agent.lifecycle_status && agent.lifecycle_status !== 'idle' && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  agent.lifecycle_status === 'online' ? 'text-emerald-400 bg-emerald-400/10' :
                  agent.lifecycle_status === 'provisioning' ? 'text-amber-400 bg-amber-400/10 animate-pulse' :
                  agent.lifecycle_status === 'offline' ? 'text-red-400 bg-red-400/10' :
                  agent.lifecycle_status === 'error' ? 'text-rose-400 bg-rose-400/10' :
                  'text-gray-400 bg-gray-400/10'
                }`}>
                  {agent.lifecycle_status === 'online' ? '🟢 Çevrimiçi' :
                   agent.lifecycle_status === 'provisioning' ? '🟡 Hazırlanıyor' :
                   agent.lifecycle_status === 'offline' ? '🔴 Çevrimdışı' :
                   agent.lifecycle_status === 'error' ? '❌ Hata' : agent.lifecycle_status}
                </span>
              )}
              {agent.last_seen_at && (
                <span className="text-[10px] text-gray-500">Son: {new Date(agent.last_seen_at).toLocaleString('tr-TR')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Mission Directive */}
        {agent.objective && (
          <div className="mb-5">
            <h3 className="mc-label mb-2">MISSION DIRECTIVE</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{agent.objective}</p>
          </div>
        )}

        {/* Operational Bio */}
        {agent.role && (
          <div className="mb-5">
            <h3 className="mc-label mb-2">OPERATIONAL BIO</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {agent.role} — {agent.objective || 'Görev tanımı belirtilmemiş.'}
            </p>
          </div>
        )}

        {/* Model / Provider / Capabilities Info */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
          <h3 className="mc-label mb-2">SYSTEM CONFIG</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <p className="mc-label mb-1">MODEL</p>
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">🧠 {agent.model}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <p className="mc-label mb-1">PROVIDER</p>
              <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">☁️ {agent.provider}</p>
            </div>
          </div>
          {/* Capabilities */}
          {agent.capabilities && (() => {
            try {
              const caps: string[] = JSON.parse(agent.capabilities);
              if (Array.isArray(caps) && caps.length > 0) {
                return (
                  <div className="mt-3">
                    <p className="mc-label mb-1.5">CAPABILITIES</p>
                    <div className="flex flex-wrap gap-1.5">
                      {caps.map((cap: string, i: number) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            } catch {
              return null;
            }
          })()}
        </div>

        {/* Stats Row — Cost Tracking */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{agent.total_runs || 0}</p>
            <p className="mc-label mt-0.5">Çalışma</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-50">{((agent.total_tokens || 0) / 1000).toFixed(1)}k</p>
            <p className="mc-label mt-0.5">Token</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-50">${(agent.total_cost || 0).toFixed(3)}</p>
            <p className="mc-label mt-0.5">Toplam</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <AgentTodayCost agentId={agent.id} />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}


// ─── Active Task & Activity Panel (Right) ────────────────────────────────────

function ActiveTaskPanel({ agentId }: { agentId: string }) {
  const { data: runningJobs } = useMCJobs({ agent_id: agentId, status: 'running' });
  const { data: events } = useMCEvents({ entity_type: 'agent', entity_id: agentId, limit: 10 });

  const activeJob = runningJobs?.[0];

  return (
    <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">
      {/* Active Task Card */}
      <GlassCard hover={false} className="p-4">
        <h3 className="mc-label mb-3">ACTIVE TASK</h3>
        {activeJob ? (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activeJob.title}</p>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div className="bg-sky-500 h-1.5 rounded-full transition-all duration-500" style={{ width: '50%' }} />
            </div>
            <p className="mc-label mt-1.5">Çalışıyor...</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-2xl opacity-30 mb-1">💤</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Aktif görev yok</p>
          </div>
        )}
      </GlassCard>

      {/* Recent Activity */}
      <GlassCard hover={false} className="p-4">
        <h3 className="mc-label mb-3">RECENT ACTIVITY</h3>
        {events && events.length > 0 ? (
          <div className="space-y-2">
            {events
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 8)
              .map((event: any) => (
                <div key={event.id} className="flex items-start gap-2 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    event.event_type?.includes('error') ? 'bg-red-500' :
                    event.event_type?.includes('complete') ? 'bg-emerald-500' : 'bg-sky-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{event.event_type}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                      {new Date(event.created_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400 dark:text-gray-500">Henüz etkinlik yok</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Org Chart ───────────────────────────────────────────────────────────────

// ─── Role Color Themes for Org Chart ─────────────────────────────────────────

const ROLE_THEMES: Record<string, { bg: string; border: string; label: string; glow: string; icon: string }> = {
  owner: {
    bg: 'bg-gradient-to-br from-amber-900/60 to-amber-800/40',
    border: 'border-amber-500/60',
    label: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    icon: '👑',
  },
  lead_intelligence_orchestrator: {
    bg: 'bg-gradient-to-br from-blue-900/60 to-indigo-800/40',
    border: 'border-blue-500/60',
    label: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    icon: '🧠',
  },
  customer_support: {
    bg: 'bg-gradient-to-br from-sky-900/60 to-cyan-800/40',
    border: 'border-sky-500/60',
    label: 'text-sky-400',
    glow: 'shadow-sky-500/20',
    icon: '💬',
  },
  data_intelligence: {
    bg: 'bg-gradient-to-br from-teal-900/60 to-cyan-800/40',
    border: 'border-teal-500/60',
    label: 'text-teal-400',
    glow: 'shadow-teal-500/20',
    icon: '📊',
  },
  developer: {
    bg: 'bg-gradient-to-br from-red-900/60 to-rose-800/40',
    border: 'border-red-500/60',
    label: 'text-red-400',
    glow: 'shadow-red-500/20',
    icon: '🔧',
  },
  project_manager: {
    bg: 'bg-gradient-to-br from-purple-900/60 to-fuchsia-800/40',
    border: 'border-purple-500/60',
    label: 'text-purple-400',
    glow: 'shadow-purple-500/20',
    icon: '📋',
  },
  finance: {
    bg: 'bg-gradient-to-br from-emerald-900/60 to-green-800/40',
    border: 'border-emerald-500/60',
    label: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    icon: '💰',
  },
};

function getRoleTheme(role: string) {
  return ROLE_THEMES[role] || {
    bg: 'bg-gradient-to-br from-gray-900/60 to-gray-800/40',
    border: 'border-gray-500/60',
    label: 'text-gray-400',
    glow: 'shadow-gray-500/20',
    icon: '🤖',
  };
}

function OrgChartCard({
  agent,
  isSelected,
  onClick,
  size = 'normal',
}: {
  agent: any;
  isSelected: boolean;
  onClick: () => void;
  size?: 'large' | 'normal';
}) {
  const theme = getRoleTheme(agent.role);
  const statusInfo = STATUS_MAP[agent.status] || STATUS_MAP.idle;
  const isLarge = size === 'large';

  return (
    <button
      onClick={onClick}
      className={`
        relative text-left rounded-xl border-2 backdrop-blur-sm transition-all duration-300
        ${theme.bg} ${theme.border}
        ${isSelected ? `ring-2 ring-offset-2 ring-offset-gray-950 ring-sky-500 shadow-lg ${theme.glow}` : 'hover:scale-[1.02] hover:shadow-lg'}
        ${isLarge ? 'px-8 py-5 min-w-[320px]' : 'px-5 py-4 min-w-[260px]'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          flex items-center justify-center rounded-xl text-white font-bold flex-shrink-0
          ${isLarge ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-lg'}
          ${getAvatarColor(agent.name)}
        `}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${theme.label}`}>
            {agent.role?.replace(/_/g, ' ')}
          </p>
          <p className={`font-bold text-white truncate ${isLarge ? 'text-xl' : 'text-base'}`}>
            {agent.name}
          </p>
          {agent.objective && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{agent.objective}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <div className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
            <span className="text-[10px] text-gray-400">
              Status: {statusInfo.label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function OrgChart({
  agents,
  selectedId,
  onSelect,
}: {
  agents: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Find orchestrator (Jarvis or agent with orchestrator role)
  const orchestrator = agents.find(
    (a: any) =>
      a.name?.toLowerCase().includes('jarvis') ||
      a.role?.toLowerCase().includes('orchestrator')
  );
  // All other agents are subordinates
  const subordinates = agents.filter((a: any) => a.id !== orchestrator?.id);

  return (
    <GlassCard hover={false} className="p-6 mt-4">
      <h3 className="mc-label mb-6">ORGANIZATIONAL CHART</h3>
      <div className="flex flex-col items-center gap-0">

        {/* Level 1: Orchestrator */}
        {orchestrator && (
          <>
            <OrgChartCard
              agent={orchestrator}
              isSelected={selectedId === orchestrator.id}
              onClick={() => onSelect(orchestrator.id)}
              size="large"
            />

            {/* Tree connector: vertical trunk */}
            {subordinates.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-gradient-to-b from-blue-500/40 to-gray-600/30" />
                {/* Horizontal branch line */}
                <div
                  className="h-px bg-gradient-to-r from-transparent via-gray-500/40 to-transparent"
                  style={{ width: `${Math.min(subordinates.length * 280, 800)}px` }}
                />
              </div>
            )}
          </>
        )}

        {/* Level 2: Sub-agents in a grid */}
        {subordinates.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-0">
            {subordinates.map((agent: any) => (
              <div key={agent.id} className="flex flex-col items-center">
                {/* Vertical connector from branch to node */}
                {orchestrator && (
                  <div className="w-px h-4 bg-gray-600/30" />
                )}
                <OrgChartCard
                  agent={agent}
                  isSelected={selectedId === agent.id}
                  onClick={() => onSelect(agent.id)}
                />
              </div>
            ))}
          </div>
        )}

        {agents.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">Ajan bulunamadı</p>
        )}
      </div>
    </GlassCard>
  );
}






// ─── Personnel Tab ───────────────────────────────────────────────────────────

function PersonnelTab({
  agents,
  selectedId,
  onSelect,
}: {
  agents: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedAgent = agents.find((a: any) => a.id === selectedId);

  return (
    <div className="mc-fade-up">
      <div className="flex gap-6">
        {/* Left: Intelligence Roster */}
        <IntelligenceRoster agents={agents} selectedId={selectedId} onSelect={onSelect} />

        {/* Center: Agent Detail View */}
        {selectedAgent ? (
          <AgentDetailView agent={selectedAgent} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl opacity-30 mb-2">👈</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Bir ajan seçin</p>
            </div>
          </div>
        )}

        {/* Right: Active Task & Activity */}
        {selectedAgent && <ActiveTaskPanel agentId={selectedAgent.id} />}
      </div>

      {/* Org Chart below */}
      <OrgChart agents={agents} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

// ─── Protocol Tab ────────────────────────────────────────────────────────────

function ProtocolTab({
  agents,
  selectedId,
  onSelect,
}: {
  agents: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const updateAgent = useUpdateMCAgent();
  const createAgent = useCreateMCAgent();
  const deleteAgent = useDeleteMCAgent();
  const syncAgents = useSyncMCAgents();
  const selectedAgent = agents.find((a: any) => a.id === selectedId);

  const [editForm, setEditForm] = useState({
    model: '',
    provider: '',
    capabilities: '',
    guardrails: '',
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    role: '',
    objective: '',
    model: 'openai/gpt-4.1',
    provider: 'openrouter',
  });
  const [showCreate, setShowCreate] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Sync edit form when selected agent changes
  useEffect(() => {
    if (selectedAgent) {
      // capabilities comes from DB as JSON string — display as formatted text
      let capsDisplay = '';
      if (selectedAgent.capabilities) {
        try {
          const parsed = typeof selectedAgent.capabilities === 'string'
            ? JSON.parse(selectedAgent.capabilities)
            : selectedAgent.capabilities;
          capsDisplay = JSON.stringify(parsed, null, 2);
        } catch {
          capsDisplay = selectedAgent.capabilities;
        }
      }
      setEditForm({
        model: selectedAgent.model || '',
        provider: selectedAgent.provider || '',
        capabilities: capsDisplay,
        guardrails: selectedAgent.guardrails || '',
      });
      setSaveError(null);
      setSaveSuccess(false);
      setCapabilitiesError(null);
    }
  }, [selectedAgent?.id]);

  const handleSave = () => {
    if (!selectedAgent) return;
    setSaveError(null);
    setSaveSuccess(false);
    setCapabilitiesError(null);

    // Parse capabilities JSON before sending
    let parsedCapabilities: any = null;
    if (editForm.capabilities.trim()) {
      try {
        parsedCapabilities = JSON.parse(editForm.capabilities);
      } catch {
        setCapabilitiesError('Geçersiz JSON formatı');
        return;
      }
    }

    updateAgent.mutate(
      {
        id: selectedAgent.id,
        model: editForm.model,
        provider: editForm.provider,
        capabilities: parsedCapabilities,
        guardrails: editForm.guardrails,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
        onError: (err: any) => {
          setSaveError(err?.response?.data?.error || err?.message || 'Kaydetme başarısız oldu');
        },
      }
    );
  };

  const handleCreate = () => {
    const trimmed = {
      name: createForm.name.trim(),
      role: createForm.role.trim(),
      objective: createForm.objective.trim(),
      model: createForm.model.trim(),
      provider: createForm.provider.trim(),
    };
    if (!trimmed.name || !trimmed.role || !trimmed.objective || !trimmed.model || !trimmed.provider) {
      setCreateError('Tüm alanlar zorunludur: isim, rol, hedef, model, provider');
      return;
    }
    // Check uniqueness
    const nameExists = agents.some((a: any) => a.name.toLowerCase() === trimmed.name.toLowerCase());
    if (nameExists) {
      setCreateError('Bu isimde bir ajan zaten mevcut');
      return;
    }
    setCreateError(null);
    createAgent.mutate(trimmed, {
      onSuccess: (data: any) => {
        setCreateForm({ name: '', role: '', objective: '', model: 'openai/gpt-4.1', provider: 'openrouter' });
        setShowCreate(false);
        // Auto-select the newly created agent
        if (data?.id) {
          onSelect(data.id);
        }
      },
      onError: (err: any) => {
        setCreateError(err?.response?.data?.error || err?.message || 'Oluşturma başarısız oldu');
      },
    });
  };

  return (
    <div className="mc-fade-up">
      <div className="flex gap-6">
        {/* Left: Agent list for selection */}
        <IntelligenceRoster agents={agents} selectedId={selectedId} onSelect={onSelect} />

        {/* Right: Config form */}
        <div className="flex-1">
          {/* Action buttons */}
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={() => {
                setSyncResult(null);
                syncAgents.mutate(undefined, {
                  onSuccess: (data: any) => {
                    setSyncResult(`Senkronize: ${data.synced} ajan (${data.created} yeni, ${data.updated} guncellendi, ${data.removed} silindi)`);
                    setTimeout(() => setSyncResult(null), 5000);
                  },
                  onError: (err: any) => {
                    setSyncResult(`Hata: ${err?.response?.data?.error || err?.message}`);
                  },
                });
              }}
              className="mc-btn mc-btn--ghost text-xs"
              disabled={syncAgents.isPending}
            >
              {syncAgents.isPending ? 'Senkronize ediliyor...' : '🔄 OpenClaw Sync'}
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="mc-btn mc-btn--primary text-xs">
              {showCreate ? 'Iptal' : '+ Yeni Ajan'}
            </button>
          </div>

          {/* Sync result feedback */}
          {syncResult && (
            <div className={`mb-4 p-2 rounded-lg text-xs ${syncResult.startsWith('Hata') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
              {syncResult}
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <GlassCard hover={false} className="p-5 mb-6">
              <h3 className="mc-label mb-3">YENİ AJAN OLUŞTUR</h3>
              {createError && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {createError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="İsim *" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="mc-input" />
                <input type="text" placeholder="Rol *" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="mc-input" />
                <input type="text" placeholder="Model *" value={createForm.model} onChange={(e) => setCreateForm({ ...createForm, model: e.target.value })} className="mc-input" />
                <input type="text" placeholder="Provider *" value={createForm.provider} onChange={(e) => setCreateForm({ ...createForm, provider: e.target.value })} className="mc-input" />
                <textarea placeholder="Hedef / Objective *" value={createForm.objective} onChange={(e) => setCreateForm({ ...createForm, objective: e.target.value })} className="mc-input col-span-2" rows={2} />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleCreate} className="mc-btn mc-btn--primary text-xs" disabled={createAgent.isPending}>
                  {createAgent.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
                <button onClick={() => { setShowCreate(false); setCreateError(null); }} className="mc-btn mc-btn--ghost text-xs">İptal</button>
              </div>
            </GlassCard>
          )}

          {/* Edit selected agent config */}
          {selectedAgent ? (
            <>
            <GlassCard hover={false} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <AgentAvatar name={selectedAgent.name} status={selectedAgent.status} />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{selectedAgent.name}</h3>
                  <p className="mc-label">{selectedAgent.role}</p>
                </div>
              </div>

              {saveError && (
                <div className="mb-4 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="mb-4 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400">
                  Yapılandırma başarıyla kaydedildi
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mc-label mb-1 block">MODEL</label>
                  <input type="text" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} className="mc-input w-full" />
                </div>
                <div>
                  <label className="mc-label mb-1 block">PROVIDER</label>
                  <input type="text" value={editForm.provider} onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })} className="mc-input w-full" />
                </div>
                <div>
                  <label className="mc-label mb-1 block">CAPABILITIES (JSON)</label>
                  <textarea
                    value={editForm.capabilities}
                    onChange={(e) => {
                      setEditForm({ ...editForm, capabilities: e.target.value });
                      setCapabilitiesError(null);
                    }}
                    className={`mc-input w-full font-mono text-xs ${capabilitiesError ? 'border-red-500/50' : ''}`}
                    rows={4}
                    placeholder='["search", "code", "analysis"]'
                  />
                  {capabilitiesError && (
                    <p className="text-xs text-red-500 mt-1">{capabilitiesError}</p>
                  )}
                </div>
                <div>
                  <label className="mc-label mb-1 block">GUARDRAILS</label>
                  <textarea value={editForm.guardrails} onChange={(e) => setEditForm({ ...editForm, guardrails: e.target.value })} className="mc-input w-full" rows={3} placeholder="Güvenlik kuralları..." />
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={handleSave} className="mc-btn mc-btn--primary text-xs" disabled={updateAgent.isPending}>
                    {updateAgent.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  {selectedAgent.id !== 'main' && (
                    <>
                      {deleteConfirm === selectedAgent.id ? (
                        <div className="flex gap-1 items-center">
                          <span className="text-xs text-red-400">Emin misin?</span>
                          <button
                            onClick={() => {
                              deleteAgent.mutate(selectedAgent.id, {
                                onSuccess: () => {
                                  setDeleteConfirm(null);
                                  onSelect('');
                                },
                              });
                            }}
                            className="mc-btn text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                            disabled={deleteAgent.isPending}
                          >
                            {deleteAgent.isPending ? 'Siliniyor...' : 'Evet, Sil'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="mc-btn mc-btn--ghost text-xs">
                            Iptal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(selectedAgent.id)}
                          className="mc-btn text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                        >
                          Sil
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </GlassCard>
            <CoreFilesPanel agentId={selectedAgent.id} />
            </>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <p className="text-2xl opacity-30 mb-2">⚙️</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Yapılandırmak için bir ajan seçin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




// ─── Comms Tab ───────────────────────────────────────────────────────────────

// ─── Core Files Panel ────────────────────────────────────────────────────────

function CoreFilesPanel({ agentId }: { agentId: string }) {
  const { data: filesData, isLoading } = useAgentFiles(agentId);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const { data: fileData, isLoading: fileLoading } = useAgentFile(agentId, openFile);
  const updateFile = useUpdateAgentFile();
  const [editContent, setEditContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Sync editor content when file loads
  useEffect(() => {
    if (fileData) {
      setEditContent(fileData.content || '');
      setDirty(false);
      setSaveOk(false);
    }
  }, [fileData?.filename, fileData?.content]);

  const handleSave = () => {
    if (!openFile) return;
    updateFile.mutate(
      { agentId, filename: openFile, content: editContent },
      {
        onSuccess: () => {
          setDirty(false);
          setSaveOk(true);
          setTimeout(() => setSaveOk(false), 3000);
        },
      }
    );
  };

  if (isLoading) return <div className="text-xs text-gray-400 py-2">Dosyalar yükleniyor...</div>;

  const files = filesData?.files || [];
  const existingFiles = files.filter(f => f.exists);
  const missingFiles = files.filter(f => !f.exists);

  return (
    <GlassCard hover={false} className="p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="mc-label">CORE FILES (OpenClaw)</h3>
        <span className="text-[10px] text-gray-400 font-mono">
          {existingFiles.length}/{files.length} dosya
        </span>
      </div>

      {/* File chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {files.map(f => (
          <button
            key={f.name}
            onClick={() => setOpenFile(openFile === f.name ? null : f.name)}
            className={`
              text-[11px] px-2.5 py-1 rounded-md border transition-all font-mono
              ${openFile === f.name
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : f.exists
                  ? 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/10'
                  : 'bg-white/[0.02] border-white/5 text-gray-500 hover:border-white/10'
              }
            `}
          >
            {f.exists ? '📄' : '○'} {f.name}
            {f.exists && <span className="ml-1 text-[9px] text-gray-500">{(f.size / 1024).toFixed(1)}k</span>}
          </button>
        ))}
      </div>

      {/* Editor */}
      {openFile && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-300">{openFile}</span>
              {fileData && !fileData.exists && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">yeni dosya</span>
              )}
              {dirty && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">değiştirildi</span>
              )}
              {saveOk && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">kaydedildi ✓</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleSave}
                disabled={!dirty || updateFile.isPending}
                className="mc-btn mc-btn--primary text-[11px] px-3 py-1 disabled:opacity-30"
              >
                {updateFile.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button
                onClick={() => { setOpenFile(null); setDirty(false); }}
                className="mc-btn mc-btn--ghost text-[11px] px-2 py-1"
              >
                Kapat
              </button>
            </div>
          </div>
          {fileLoading ? (
            <div className="text-xs text-gray-400 py-4 text-center">Yükleniyor...</div>
          ) : (
            <textarea
              value={editContent}
              onChange={(e) => { setEditContent(e.target.value); setDirty(true); }}
              className="mc-input w-full font-mono text-xs leading-relaxed"
              rows={Math.min(25, Math.max(8, editContent.split('\n').length + 2))}
              spellCheck={false}
            />
          )}
        </div>
      )}

      {/* Missing files hint */}
      {missingFiles.length > 0 && !openFile && (
        <p className="text-[10px] text-gray-500 mt-2">
          Eksik dosyalar tıklanarak oluşturulabilir: {missingFiles.map(f => f.name).join(', ')}
        </p>
      )}
    </GlassCard>
  );
}

// ─── Comms Tab ───────────────────────────────────────────────────────────────

function CommsTab({
  agents,
  selectedId,
  onSelect,
}: {
  agents: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: sentData } = useCommsMessages(
    selectedId ? { sender_id: selectedId, limit: 50 } : undefined
  );
  const { data: recvData } = useCommsMessages(
    selectedId ? { recipient_id: selectedId, limit: 50 } : undefined
  );

  const agentMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of agents) m[a.id] = a.name;
    return m;
  }, [agents]);

  // Merge sent + received, deduplicate by id, sort newest first
  const messages = useMemo(() => {
    const all = [
      ...(sentData?.messages || []),
      ...(recvData?.messages || []),
    ];
    const seen = new Set<string>();
    const unique = all.filter((m: any) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    return unique.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [sentData, recvData]);

  const TYPE_COLORS: Record<string, string> = {
    nudge: 'border-l-amber-500 dark:border-l-amber-400',
    delegation: 'border-l-purple-500 dark:border-l-purple-400',
    status_update: 'border-l-sky-500 dark:border-l-sky-400',
    context_share: 'border-l-emerald-500 dark:border-l-emerald-400',
    query: 'border-l-indigo-500 dark:border-l-indigo-400',
    response: 'border-l-teal-500 dark:border-l-teal-400',
    broadcast: 'border-l-pink-500 dark:border-l-pink-400',
  };

  const TYPE_LABELS: Record<string, string> = {
    nudge: '🔔 Nudge',
    delegation: '📋 Delegasyon',
    status_update: '📊 Durum',
    context_share: '🔗 Bağlam',
    query: '❓ Sorgu',
    response: '💬 Yanıt',
    broadcast: '📢 Yayın',
  };

  return (
    <div className="mc-fade-up">
      <div className="flex gap-6">
        <IntelligenceRoster agents={agents} selectedId={selectedId} onSelect={onSelect} />

        <div className="flex-1">
          {selectedId ? (
            messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((msg: any) => {
                  const isSent = msg.sender_id === selectedId;
                  const borderColor = TYPE_COLORS[msg.message_type] || 'border-l-gray-500';
                  return (
                    <GlassCard key={msg.id} hover={false} className={`p-4 border-l-2 ${borderColor}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="mc-badge mc-badge--purple text-[10px]">
                              {TYPE_LABELS[msg.message_type] || msg.message_type}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                              {isSent ? '→' : '←'} {agentMap[isSent ? msg.recipient_id : msg.sender_id] || (isSent ? msg.recipient_id : msg.sender_id)}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                              msg.delivery_status === 'delivered'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : msg.delivery_status === 'failed'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {msg.delivery_status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-3">
                            {msg.content}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">
                          {new Date(msg.created_at).toLocaleString('tr-TR')}
                        </span>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            ) : (
              <div className="mc-empty">
                <div className="mc-empty-icon">💬</div>
                <p className="mc-empty-title">Henüz iletişim yok</p>
                <p className="mc-empty-desc">Bu ajan için kayıtlı mesaj veya etkinlik bulunamadı.</p>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <p className="text-2xl opacity-30 mb-2">💬</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">İletişim geçmişini görmek için bir ajan seçin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MCAgentsPage() {
  const { data: agents, isLoading } = useMCAgents();
  const [activeTab, setActiveTab] = useState('personnel');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agentList = agents || [];

  // Auto-select first agent on load
  useEffect(() => {
    if (agentList.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agentList[0].id);
    }
  }, [agentList, selectedAgentId]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mc-fade-up">
          <div className="mc-page-header"><h1 className="mc-page-title">Ajanlar</h1></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} height="h-48" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div>
        {/* Page Header */}
        <div className="mc-page-header mc-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <h1 className="mc-page-title">Ajanlar</h1>
            <span className="mc-badge mc-badge--gray">{agentList.length}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mc-fade-up">
          <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        {activeTab === 'personnel' && (
          <PersonnelTab agents={agentList} selectedId={selectedAgentId} onSelect={setSelectedAgentId} />
        )}
        {activeTab === 'protocol' && (
          <ProtocolTab agents={agentList} selectedId={selectedAgentId} onSelect={setSelectedAgentId} />
        )}
        {activeTab === 'comms' && (
          <CommsTab agents={agentList} selectedId={selectedAgentId} onSelect={setSelectedAgentId} />
        )}
      </div>
    </AdminLayout>
  );
}
