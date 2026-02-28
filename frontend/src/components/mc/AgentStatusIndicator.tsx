import { useState, useEffect, useRef } from 'react';

export type AgentPhase = 'connecting' | 'waiting_session' | 'agent_thinking' | 'agent_responding' | 'finalizing' | 'idle';

interface AgentStatusIndicatorProps {
  phase: AgentPhase;
  detail?: string | null;
  context?: 'planning' | 'execution';
  startedAt?: number;
}

const PHASE_CONFIG: Record<AgentPhase, { icon: string; label: string; color: string; pulse: boolean }> = {
  connecting: { icon: '🔌', label: 'OpenClaw bağlantısı kuruluyor...', color: 'text-amber-500', pulse: true },
  waiting_session: { icon: '⏳', label: 'Oturum oluşturuluyor...', color: 'text-amber-500', pulse: true },
  agent_thinking: { icon: '🧠', label: 'Ajan düşünüyor...', color: 'text-indigo-500', pulse: true },
  agent_responding: { icon: '✍️', label: 'Ajan yanıt yazıyor...', color: 'text-sky-500', pulse: false },
  finalizing: { icon: '✅', label: 'Yanıt tamamlanıyor...', color: 'text-emerald-500', pulse: false },
  idle: { icon: '💤', label: 'Beklemede', color: 'text-gray-400', pulse: false },
};

export function AgentStatusIndicator({ phase, detail, context, startedAt }: AgentStatusIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt || phase === 'idle' || phase === 'finalizing') {
      setElapsed(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startedAt, phase]);

  const config = PHASE_CONFIG[phase];
  const isExecution = context === 'execution';

  return (
    <div className="flex items-start gap-3 max-w-[80%]">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-xs">🤖</span>
      </div>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 min-w-[200px]">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm ${config.pulse ? 'animate-pulse' : ''}`}>{config.icon}</span>
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>
        {isExecution && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Görev yürütülüyor</p>
        )}
        {detail && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{detail}</p>
        )}
        {elapsed > 0 && phase !== 'finalizing' && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{elapsed}s</span>
          </div>
        )}
      </div>
    </div>
  );
}
