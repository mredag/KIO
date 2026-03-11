import { useState, useCallback } from 'react';
import AdminLayout from '../../../layouts/AdminLayout';
import { GlassCard } from '../../../components/mc/GlassCard';
import { TabNav } from '../../../components/mc/TabNav';
import {
  useDmFeed,
  useDmConversation,
  useDmHealth,
  useDmErrors,
  useDmModelStats,
  useDmResponseCacheStats,
  useDmResponseCacheEntries,
  useSeedDmResponseCache,
  useClearDmResponseCache,
  useDmTestMode,
  useToggleDmTestMode,
  type DmChannel,
  type DmResponseCacheEntry,
} from '../../../hooks/useDmKontrolApi';
import { useDmKontrolSSE, type DmSSEEvent } from '../../../hooks/useDmKontrolSSE';
import {
  getResponseQualityColor,
  formatTierLabel,
  inferTierFromModel,
  formatResponseTime,
} from '../../../lib/mc/dmKontrolUtils';

const TABS = [
  { key: 'live', label: 'Canlı Akış' },
  { key: 'health', label: 'Pipeline Sağlığı' },
  { key: 'errors', label: 'Pipeline Hataları' },
  { key: 'models', label: 'Model Yönlendirme' },
];

const TIER_COLORS: Record<string, string> = {
  light: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  standard: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  advanced: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const QUALITY_DOT: Record<string, string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-400',
  gray: 'bg-gray-500',
};

const PIPELINE_STEPS = [
  { key: 'intent', label: 'Intent Tespiti' },
  { key: 'behavior', label: 'Davranis / Ton' },
  { key: 'model', label: 'Model Secimi' },
  { key: 'knowledge', label: 'Bilgi Tabani' },
  { key: 'openclaw', label: 'OpenClaw Gonderim' },
  { key: 'poll', label: 'Yanit Bekleme' },
  { key: 'policy', label: 'Policy Agent' },
  { key: 'send', label: 'Meta Gonderim' },
];

const ERROR_STAGES = [
  { value: '', label: 'Tum Asamalar' },
  { value: 'context_error', label: 'Baglam Hatasi' },
  { value: 'knowledge_fetch_fail', label: 'Bilgi Tabani Hatasi' },
  { value: 'openclaw_timeout', label: 'OpenClaw Zaman Asimi' },
  { value: 'openclaw_dispatch_fail', label: 'OpenClaw Gonderim Hatasi' },
  { value: 'policy_validation_fail', label: 'Policy Ihlali' },
  { value: 'meta_send_fail', label: 'Meta Gonderim Hatasi' },
];

const CHANNEL_FILTERS: { key: DmChannel | 'all'; label: string }[] = [
  { key: 'all', label: 'Tumu' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const CONDUCT_STATE_LABELS: Record<string, string> = {
  normal: 'Normal',
  guarded: 'Guarded',
  final_warning: 'Final warning',
  silent: 'Bad customer',
};

const CONDUCT_STATE_BADGES: Record<string, string> = {
  normal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  guarded: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  final_warning: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  silent: 'bg-red-500/15 text-red-400 border-red-500/20',
};

const ANTI_REPEAT_LABELS: Record<string, string> = {
  repeat_greeting: 'tekrar selamlama yok',
  repeat_phone_cta: 'telefon CTA azaltildi',
  repeat_emoji: 'emoji tekrari yok',
  simple_fact_request: 'kisa bilgi modu',
};

const CACHE_CLASS_LABELS: Record<string, string> = {
  direct_location: 'konum',
  direct_phone: 'telefon',
  direct_hours: 'saat',
  general_info: 'genel bilgi',
  gratitude_closeout: 'kapanis',
  service_list: 'hizmet listesi',
  service_definition: 'hizmet tanimi',
  topic_price_list: 'konu fiyat listesi',
  exact_price_answer: 'net fiyat',
};

const CACHE_STATUS_FILTERS: Array<{ key: 'all' | 'active' | 'candidate'; label: string }> = [
  { key: 'all', label: 'Tumu' },
  { key: 'active', label: 'Active' },
  { key: 'candidate', label: 'Candidate' },
];

function formatCacheClassLabel(cacheClass: string | null | undefined): string {
  if (!cacheClass) return '-';
  return CACHE_CLASS_LABELS[cacheClass] || cacheClass.replace(/_/g, ' ');
}

function getCacheStatusMeta(trace: any): { label: string; className: string } | null {
  const cache = trace?.cache;
  if (!cache) return null;

  if (cache.hit === true || trace?.fastLane?.kind === 'response_cache') {
    return {
      label: 'Cache hit',
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    };
  }

  if (cache.status === 'candidate') {
    return {
      label: 'Cache adayi',
      className: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    };
  }

  if (cache.status === 'miss') {
    return {
      label: 'Cache miss',
      className: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    };
  }

  if (cache.status === 'ineligible') {
    return {
      label: 'Cache disi',
      className: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    };
  }

  return null;
}

function getBufferStatusMeta(trace: any): { label: string; className: string } | null {
  const aggregation = trace?.inboundAggregation;
  if (!aggregation) return null;

  return {
    label: aggregation.aggregated ? `Buffer x${aggregation.fragmentCount}` : 'Buffer',
    className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  };
}

function getCacheEntryStatusBadge(status: 'candidate' | 'active'): string {
  return status === 'active'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : 'bg-sky-500/15 text-sky-300 border-sky-500/20';
}

function getConductState(trace: any): string | null {
  return trace?.conductControl?.state || trace?.responseStyle?.mode || null;
}

function formatConductStateLabel(state: string | null | undefined): string {
  if (!state) return '-';
  return CONDUCT_STATE_LABELS[state] || state;
}

function getConductBadgeClass(state: string | null | undefined): string {
  if (!state) return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  return CONDUCT_STATE_BADGES[state] || 'bg-gray-500/15 text-gray-400 border-gray-500/20';
}

function formatBehaviorHint(trace: any): string[] {
  const hints: string[] = [];
  const style = trace?.responseStyle;

  if (style?.greetingPolicy === 'minimal') {
    hints.push('selamlama minimal');
  } else if (style?.greetingPolicy === 'skip_repeat_greeting') {
    hints.push('tekrar selamlama yok');
  }

  if (style?.emojiPolicy === 'none') {
    hints.push('emoji yok');
  }

  if (style?.ctaPolicy === 'minimal') {
    hints.push('cta minimal');
  } else if (style?.ctaPolicy === 'only_when_needed') {
    hints.push('cta gerektiginde');
  }

  return hints;
}

function ChannelBadge({ channel }: { channel?: string }) {
  if (channel === 'whatsapp') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/15 text-green-400 border border-green-500/25">
        💬 WA
      </span>
    );
  }
  // Default to Instagram for backward compatibility
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-pink-500/15 text-pink-400 border border-pink-500/25">
      📸 IG
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  return `${Math.floor(hrs / 24)}g önce`;
}

function TierBadge({ tier, modelUsed }: { tier: string | null; modelUsed?: string | null }) {
  const effectiveTier = (tier && tier !== 'unknown') ? tier : inferTierFromModel(modelUsed);
  if (!effectiveTier) return null; // Hide badge entirely when tier is truly unknown
  const cls = TIER_COLORS[effectiveTier] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
      {formatTierLabel(effectiveTier)}
    </span>
  );
}

function QualityDot({ responseTimeMs }: { responseTimeMs: number | null }) {
  const color = getResponseQualityColor(responseTimeMs);
  const timeText = formatResponseTime(responseTimeMs);
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full inline-block ${QUALITY_DOT[color]}`} />
      {timeText && <span className={`text-[10px] ${color === 'green' ? 'text-green-400' : color === 'yellow' ? 'text-yellow-400' : color === 'red' ? 'text-red-400' : 'text-gray-500'}`}>{timeText}</span>}
    </span>
  );
}

function getDisplayedResponseTimeMs(trace: any, responseTimeMs: number | null | undefined): number | null {
  const customerPerceivedMs = trace?.timingBreakdown?.customerPerceivedTotalMs;
  if (typeof customerPerceivedMs === 'number' && Number.isFinite(customerPerceivedMs) && customerPerceivedMs > 0) {
    return customerPerceivedMs;
  }

  if (typeof responseTimeMs === 'number' && Number.isFinite(responseTimeMs)) {
    return responseTimeMs;
  }

  return null;
}

function formatTokenSummary(trace: any): string {
  if (!trace) {
    return '~0 token';
  }

  const breakdown = trace.tokenBreakdown;
  const totalTokens = breakdown?.totalTokens ?? trace.tokensEstimated ?? 0;
  if (!breakdown) {
    return `~${totalTokens} token`;
  }

  const parts: string[] = [`~${totalTokens} token`];
  if (typeof breakdown.directTokens === 'number' && breakdown.directTokens > 0) {
    parts.push(`yanit ${breakdown.directTokens}`);
  }
  if (typeof breakdown.policyTokens === 'number' && breakdown.policyTokens > 0) {
    parts.push(`policy ${breakdown.policyTokens}`);
  }
  if (typeof breakdown.estimatedInputTokens === 'number' && breakdown.estimatedInputTokens > 0) {
    parts.push(`giris ${breakdown.estimatedInputTokens}`);
  }
  if (typeof breakdown.estimatedOutputTokens === 'number' && breakdown.estimatedOutputTokens > 0) {
    parts.push(`cikis ${breakdown.estimatedOutputTokens}`);
  }
  if (typeof breakdown.directInputTokens === 'number' && breakdown.directInputTokens > 0) {
    parts.push(`yanit-giris ${breakdown.directInputTokens}`);
  }
  if (typeof breakdown.directOutputTokens === 'number' && breakdown.directOutputTokens > 0) {
    parts.push(`yanit-cikis ${breakdown.directOutputTokens}`);
  }

  return parts.join(' | ');
}

function getStepStatus(trace: any, step: string): 'success' | 'fail' | 'pending' | 'warning' {
  if (!trace) return 'pending';
  switch (step) {
    case 'intent':
      return trace.intentCategories?.length > 0 ? 'success' : 'pending';
    case 'behavior': {
      const conductState = getConductState(trace);
      if (!conductState) return 'pending';
      return conductState === 'normal' ? 'success' : 'warning';
    }
    case 'model':
      return trace.modelTier ? 'success' : 'pending';
    case 'knowledge':
      if (trace.knowledgeFetchStatus === 'success') return 'success';
      if (trace.knowledgeFetchStatus === 'fail') return 'fail';
      return 'pending';
    case 'openclaw':
      if (trace.openclawDispatchStatus === 'success') return 'success';
      if (trace.openclawDispatchStatus === 'fail') return 'fail';
      return 'pending';
    case 'poll':
      return trace.agentPollDurationMs > 0 ? 'success' : 'pending';
    case 'policy': {
      const pv = trace.policyValidation;
      if (!pv) return 'pending';
      if (pv.status === 'pass' || pv.status === 'corrected' || pv.status === 'skipped') return 'success';
      if (pv.status === 'fallback' || pv.status === 'fail') return 'fail';
      return 'pending';
    }
    case 'send':
      if (trace.metaSendStatus === 'success') return 'success';
      if (trace.metaSendStatus === 'fail') return 'fail';
      if (trace.metaSendStatus === 'skipped') return 'success';
      return 'pending';
    default:
      return 'pending';
  }
}

const STEP_ICONS: Record<string, string> = {
  success: 'OK',
  fail: 'X',
  pending: '...',
  warning: '!',
};

const STEP_COLORS: Record<string, string> = {
  success: 'text-green-400 border-green-500/30',
  fail: 'text-red-400 border-red-500/30',
  pending: 'text-gray-500 border-gray-600/30',
  warning: 'text-amber-400 border-amber-500/30',
};

// ============================================================
// Pipeline Trace Expanded — detailed per-step breakdown
// ============================================================
function PipelineTraceExpanded({ trace }: { trace: any }) {
  const [policyOpen, setPolicyOpen] = useState(false);

  if (!trace) {
    return (
      <div className="px-3 pb-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-gray-500 mt-2 italic">Pipeline trace verisi yok</p>
      </div>
    );
  }

  const pv = trace.policyValidation;
  const conductState = getConductState(trace);
  const conductControl = trace.conductControl;
  const behaviorHints = formatBehaviorHint(trace);
  const antiRepeatSignals = Array.isArray(trace.responseStyle?.antiRepeatSignals)
    ? trace.responseStyle.antiRepeatSignals
    : [];

  const timing = trace.timingBreakdown || {};
  const safetyMs = timing.safetyFilterMs ?? trace.sexualIntent?.latencyMs ?? 0;
  const contextMs = timing.contextAnalysisMs ?? 0;
  const knowledgeMs = timing.knowledgeAssemblyMs ?? 0;
  const dispatchMs = timing.openclawDispatchMs ?? 0;
  const pollMs = trace.agentPollDurationMs || 0;
  const policyMs = pv?.totalLatencyMs || 0;
  const metaSendMs = timing.metaSendMs ?? 0;
  const totalMs = trace.totalResponseTimeMs || 0;
  const generationMs = trace.directResponse?.used ? (trace.directResponse.latencyMs || 0) : pollMs;
  const uncategorizedMs = timing.uncategorizedMs ?? Math.max(
    0,
    totalMs - safetyMs - contextMs - knowledgeMs - dispatchMs - generationMs - policyMs - metaSendMs,
  );
  const customerPerceivedMs = timing.customerPerceivedTotalMs;
  const ingestDelayMs = timing.ingestDelayMs;

  return (
    <div className="px-3 pb-3 border-t border-white/[0.06]">
      <div className="mt-3 space-y-1">
        {/* Sexual Intent Filter (pre-processing safety check) */}
        {trace.sexualIntent && (
          <>
            <div className="flex items-center gap-2">
              <StepIcon status={trace.sexualIntent.action === 'allow' ? 'success' : trace.sexualIntent.action === 'retry_question' ? 'warning' : 'error'} />
              <span className="text-xs text-gray-400">İçerik Güvenlik Filtresi</span>
              <span className="text-[10px] ml-auto flex items-center gap-1.5">
                {trace.sexualIntent.action === 'allow' && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ Güvenli</span>
                )}
                {trace.sexualIntent.action === 'retry_question' && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">⚠ Şüpheli</span>
                )}
                {trace.sexualIntent.action === 'block_message' && (
                  <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">✕ Engellendi</span>
                )}
                <span className="text-gray-600 font-mono">{Math.round(trace.sexualIntent.confidence * 100)}%</span>
                <span className="text-gray-600 font-mono">{formatResponseTime(trace.sexualIntent.latencyMs)}</span>
              </span>
            </div>
            {trace.sexualIntent.reason && (
              <div className="pl-7 text-[10px] text-gray-500 italic max-w-md">
                {trace.sexualIntent.reason}
              </div>
            )}
          </>
        )}

        {/* Intent Tespiti */}
        <div className="flex items-center gap-2">
          <StepIcon status={getStepStatus(trace, 'intent')} />
          <span className="text-xs text-gray-400">Intent Tespiti</span>
          <span className="text-[10px] text-gray-500 ml-auto">
            {trace.intentCategories?.length > 0
              ? trace.intentCategories.join(', ')
              : '—'}
          </span>
        </div>
        {trace.matchedKeywords?.length > 0 && (
          <div className="pl-7 flex flex-wrap gap-1">
            {trace.matchedKeywords.map((kw: string, i: number) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {kw}
              </span>
            ))}
          </div>
        )}
        {contextMs > 0 && (
          <div className="pl-7 text-[10px] text-gray-600 font-mono">
            Planlama {formatResponseTime(contextMs)}
          </div>
        )}

                {(trace.responseStyle || trace.conductControl) && (
          <>
            <div className="flex items-center gap-2">
              <StepIcon status={getStepStatus(trace, 'behavior')} />
              <span className="text-xs text-gray-400">Davranis / Ton</span>
              <span className="text-[10px] ml-auto flex items-center gap-1.5">
                {conductState && (
                  <span className={`px-1.5 py-0.5 rounded border ${getConductBadgeClass(conductState)}`}>
                    {formatConductStateLabel(conductState)}
                  </span>
                )}
                {conductControl?.manualMode && conductControl.manualMode !== 'auto' && (
                  <span className="px-1.5 py-0.5 rounded border bg-sky-500/10 text-sky-400 border-sky-500/20">
                    {conductControl.manualMode === 'force_normal' ? 'Force normal' : 'Force bad customer'}
                  </span>
                )}
                {conductControl?.offenseCount > 0 && (
                  <span className="text-gray-600 font-mono">offense {conductControl.offenseCount}</span>
                )}
              </span>
            </div>

            {(behaviorHints.length > 0 || antiRepeatSignals.length > 0 || conductControl?.reason) && (
              <div className="pl-7 space-y-1">
                {(behaviorHints.length > 0 || antiRepeatSignals.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {behaviorHints.map((hint: string, index: number) => (
                      <span key={`hint-${index}`} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        {hint}
                      </span>
                    ))}
                    {antiRepeatSignals.map((signal: string, index: number) => (
                      <span key={`signal-${index}`} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-300 border border-slate-500/20">
                        {ANTI_REPEAT_LABELS[signal] || signal}
                      </span>
                    ))}
                  </div>
                )}
                {conductControl?.reason && conductState && conductState !== 'normal' && (
                  <div className="text-[10px] text-gray-500 italic max-w-md">
                    {conductControl.reason}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Model Seçimi */}
        <div className="flex items-center gap-2">
          <StepIcon status={getStepStatus(trace, 'model')} />
          <span className="text-xs text-gray-400">Model Seçimi</span>
          <span className="text-[10px] text-gray-500 ml-auto flex items-center gap-1.5">
            {trace.modelId && (
              <span className="font-mono">{trace.modelId.split('/').pop()}</span>
            )}
            {trace.tierReason && (
              <span className="italic">— {trace.tierReason}</span>
            )}
          </span>
        </div>

        {/* Bilgi Tabanı */}
        <div className="flex items-center gap-2">
          <StepIcon status={getStepStatus(trace, 'knowledge')} />
          <span className="text-xs text-gray-400">Bilgi Tabanı</span>
          <span className="text-[10px] text-gray-500 ml-auto">
            {trace.knowledgeCategoriesFetched?.length > 0 && (
              <span className="mr-1.5">{trace.knowledgeCategoriesFetched.join(', ')}</span>
            )}
            {trace.knowledgeEntriesCount != null && (
              <span className="font-mono">{trace.knowledgeEntriesCount} kayıt</span>
            )}
          </span>
        </div>

        {/* Konuşma Geçmişi */}
        {trace.conversationHistory && (
          <div className="flex items-center gap-2">
            <StepIcon status={trace.conversationHistory.messageCount > 0 ? 'success' : 'pending'} />
            <span className="text-xs text-gray-400">Konuşma Geçmişi</span>
            <span className="text-[10px] text-gray-500 ml-auto">
              {trace.conversationHistory.messageCount > 0 ? (
                <span className="font-mono">{trace.conversationHistory.messageCount} mesaj</span>
              ) : (
                <span className="italic text-gray-600">yok</span>
              )}
            </span>
          </div>
        )}
        {trace.conversationHistory && trace.conversationHistory.messageCount > 0 && (
          <div className="pl-7 space-y-1 mt-1">
            {trace.conversationHistory.messages.map((msg: any, i: number) => (
              <div key={i} className="text-[10px] flex items-start gap-2">
                <span className={`px-1.5 py-0.5 rounded font-mono ${
                  msg.direction === 'inbound' 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                }`}>
                  {msg.direction === 'inbound' ? '→' : '←'}
                </span>
                <span className="text-gray-500 flex-1">{msg.text}</span>
                <span className="text-gray-600 text-[9px]">{msg.relativeTime}</span>
              </div>
            ))}
            {trace.conversationHistory.formattedForAI && (
              <details className="mt-2">
                <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400">
                  AI'ya gönderilen format
                </summary>
                <pre className="mt-1 text-[9px] text-gray-600 bg-black/20 p-2 rounded overflow-x-auto">
                  {trace.conversationHistory.formattedForAI}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* OpenClaw Gönderim / Direkt Yanıt */}
        <div className="flex items-center gap-2">
          <StepIcon status={trace.directResponse?.used ? 'success' : getStepStatus(trace, 'openclaw')} />
          <span className="text-xs text-gray-400">
            {trace.directResponse?.used ? 'Direkt Yanıt' : 'OpenClaw Gönderim'}
          </span>
          {trace.directResponse?.used ? (
            <span className="text-[9px] ml-auto flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">⚡ Direkt</span>
              <span className="text-gray-500 font-mono">{trace.directResponse.modelId?.split('/').pop()}</span>
              <span className="text-gray-600 font-mono">{formatResponseTime(trace.directResponse.latencyMs)}</span>
            </span>
          ) : trace.openclawSessionKey ? (
            <span className="text-[9px] text-gray-600 ml-auto font-mono truncate max-w-[200px]" title={trace.openclawSessionKey}>
              {trace.openclawSessionKey.replace('agent:main:', '')}
            </span>
          ) : null}
        </div>

        {/* Yanıt Bekleme (only shown for OpenClaw path) */}
        {!trace.directResponse?.used && (
          <div className="flex items-center gap-2">
            <StepIcon status={getStepStatus(trace, 'poll')} />
            <span className="text-xs text-gray-400">Yanıt Bekleme</span>
            {pollMs > 0 && (
              <span className="text-[10px] text-gray-500 ml-auto font-mono">{formatResponseTime(pollMs)}</span>
            )}
          </div>
        )}

        {/* Policy Agent — clickable to expand */}
        <div>
          <div
            className={`flex items-center gap-2 ${pv ? 'cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded' : ''}`}
            onClick={() => pv && setPolicyOpen(!policyOpen)}
          >
            <StepIcon status={getStepStatus(trace, 'policy')} />
            <span className="text-xs text-gray-400">Policy Agent</span>
            {pv && (
              <span className={`text-[10px] ml-auto flex items-center gap-1.5 ${
                pv.status === 'pass' ? 'text-green-400' :
                pv.status === 'corrected' ? 'text-yellow-400' :
                pv.status === 'fallback' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {pv.status === 'pass' ? '✓ Geçti' :
                 pv.status === 'corrected' ? `🔄 ${pv.attempts}. denemede düzeltildi` :
                 pv.status === 'fallback' ? '⚠️ Yedek yanıt' :
                 pv.status === 'skipped' ? 'Atlandı' : pv.status}
                {pv.totalLatencyMs > 0 && (
                  <span className="font-mono text-gray-500">({formatResponseTime(pv.totalLatencyMs)})</span>
                )}
                <span className="text-gray-600 text-[9px]">{policyOpen ? '▾' : '▸'}</span>
              </span>
            )}
          </div>

          {/* Policy Agent expanded detail */}
          {policyOpen && pv && (
            <div className="ml-7 mt-1 mb-1 p-2 rounded bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              {/* Summary row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                <span className="text-gray-500">Model: <span className="text-gray-300 font-mono">{pv.modelUsed?.split('/').pop() || '—'}</span></span>
                <span className="text-gray-500">Deneme: <span className="text-gray-300">{pv.attempts}</span></span>
                <span className="text-gray-500">Süre: <span className="text-gray-300 font-mono">{formatResponseTime(pv.totalLatencyMs)}</span></span>
                <span className="text-gray-500">Token: <span className="text-gray-300">~{pv.totalTokens}</span></span>
              </div>

              {/* Reason */}
              {pv.reason && (
                <div className="text-[10px]">
                  <span className="text-gray-500">Sonuç: </span>
                  <span className="text-gray-300 italic">{pv.reason}</span>
                </div>
              )}

              {/* Original rejection info (shown when status is 'corrected' or 'fallback') */}
              {pv.originalReason && (pv.status === 'corrected' || pv.status === 'fallback') && (
                <div className="pt-1 border-t border-yellow-500/10">
                  <p className="text-[10px] text-yellow-400 font-medium mb-0.5">İlk Red Sebebi:</p>
                  <p className="text-[10px] text-yellow-300/70 pl-2 italic">{pv.originalReason}</p>
                  {pv.originalViolations?.length > 0 && (
                    <div className="mt-0.5">
                      {pv.originalViolations.map((v: string, i: number) => (
                        <p key={i} className="text-[10px] text-yellow-300/60 pl-2">• Kural {v}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Current violations (for fallback — shows final rejection) */}
              {pv.violations?.length > 0 && pv.status !== 'corrected' && (
                <div className="pt-1 border-t border-red-500/10">
                  <p className="text-[10px] text-red-400 font-medium mb-0.5">İhlaller:</p>
                  {pv.violations.map((v: string, i: number) => (
                    <p key={i} className="text-[10px] text-red-300/70 pl-2">• Kural {v}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Meta Gönderim */}
        <div className="flex items-center gap-2">
          <StepIcon status={getStepStatus(trace, 'send')} />
          <span className="text-xs text-gray-400">Meta Gönderim</span>
          {trace.metaSendError && (
            <span className="text-[10px] text-red-400 ml-auto truncate max-w-[200px]" title={trace.metaSendError}>
              {trace.metaSendError}
            </span>
          )}
        </div>
      </div>

      {(trace.cache || trace.inboundAggregation) && (
        <div className="mt-3 pt-2 border-t border-white/[0.04] space-y-2">
          {trace.cache && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Yanit Cache</span>
                {getCacheStatusMeta(trace) && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getCacheStatusMeta(trace)?.className}`}>
                    {getCacheStatusMeta(trace)?.label}
                  </span>
                )}
                {trace.fastLane?.kind === 'response_cache' && (
                  <span className="text-[9px] text-emerald-300 ml-auto">AI atlandi</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400">
                <span>Sinif: <span className="text-gray-200">{formatCacheClassLabel(trace.cache.cacheClass)}</span></span>
                <span>Durum: <span className="text-gray-200">{trace.cache.status || '-'}</span></span>
                <span>Hit: <span className="text-gray-200">{trace.cache.hit ? 'evet' : 'hayir'}</span></span>
                {trace.cache.observationCount != null && (
                  <span>Gozlem: <span className="text-gray-200">{trace.cache.observationCount}</span></span>
                )}
                {trace.cache.sourceExecutionId && (
                  <span>Kaynak: <span className="font-mono text-gray-200">{trace.cache.sourceExecutionId}</span></span>
                )}
              </div>
            </div>
          )}

          {trace.inboundAggregation && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">Mesaj Buffer</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getBufferStatusMeta(trace)?.className || 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20'}`}>
                  {getBufferStatusMeta(trace)?.label || 'Buffer'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400">
                <span>Tetik: <span className="text-gray-200">{trace.inboundAggregation.trigger}</span></span>
                <span>Pencere: <span className="text-gray-200">{trace.inboundAggregation.windowMs}ms</span></span>
                <span>Parca: <span className="text-gray-200">{trace.inboundAggregation.fragmentCount}</span></span>
              </div>
              {Array.isArray(trace.inboundAggregation.fragments) && trace.inboundAggregation.fragments.length > 0 && (
                <div className="mt-1 text-[10px] text-gray-400">
                  <span className="text-gray-500">Birlesen mesajlar:</span>{' '}
                  <span className="text-gray-200">{trace.inboundAggregation.fragments.join(' + ')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timing breakdown bar */}
      {totalMs > 0 && (
        <div className="mt-3 pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[10px] text-gray-500">Süre Dağılımı</span>
            <span className="text-[10px] text-gray-400 font-mono ml-auto">{formatResponseTime(totalMs)}</span>
          </div>
          {(customerPerceivedMs && customerPerceivedMs > totalMs + 1500) || (ingestDelayMs && ingestDelayMs > 1500) ? (
            <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-gray-500">
              <span>Musteri bekleme: <span className="font-mono text-gray-300">{formatResponseTime(customerPerceivedMs)}</span></span>
              {ingestDelayMs ? (
                <span>Webhook gecikmesi: <span className="font-mono text-gray-300">{formatResponseTime(ingestDelayMs)}</span></span>
              ) : null}
              <span>Islem suresi: <span className="font-mono text-gray-300">{formatResponseTime(totalMs)}</span></span>
            </div>
          ) : null}
          {/* Stacked bar */}
          <div className="h-2 rounded-full overflow-hidden flex bg-gray-700/30">
            {safetyMs > 0 && (
              <div
                className="bg-emerald-400/60 h-full"
                style={{ width: `${(safetyMs / totalMs) * 100}%` }}
                title={`Guvenlik: ${formatResponseTime(safetyMs)}`}
              />
            )}
            {contextMs > 0 && (
              <div
                className="bg-sky-500/60 h-full"
                style={{ width: `${(contextMs / totalMs) * 100}%` }}
                title={`Planlama: ${formatResponseTime(contextMs)}`}
              />
            )}
            {knowledgeMs > 0 && (
              <div
                className="bg-cyan-500/60 h-full"
                style={{ width: `${(knowledgeMs / totalMs) * 100}%` }}
                title={`Bilgi: ${formatResponseTime(knowledgeMs)}`}
              />
            )}
            {dispatchMs > 0 && (
              <div
                className="bg-indigo-500/60 h-full"
                style={{ width: `${(dispatchMs / totalMs) * 100}%` }}
                title={`Dispatch: ${formatResponseTime(dispatchMs)}`}
              />
            )}
            {generationMs > 0 && (
              <div
                className={`${trace.directResponse?.used ? 'bg-violet-500/60' : 'bg-purple-500/60'} h-full`}
                style={{ width: `${(generationMs / totalMs) * 100}%` }}
                title={`${trace.directResponse?.used ? 'Direkt model' : 'Agent yanit'}: ${formatResponseTime(generationMs)}`}
              />
            )}
            {policyMs > 0 && (
              <div
                className="bg-yellow-500/60 h-full"
                style={{ width: `${(policyMs / totalMs) * 100}%` }}
                title={`Policy: ${formatResponseTime(policyMs)}`}
              />
            )}
            {metaSendMs > 0 && (
              <div
                className="bg-pink-500/60 h-full"
                style={{ width: `${(metaSendMs / totalMs) * 100}%` }}
                title={`Meta: ${formatResponseTime(metaSendMs)}`}
              />
            )}
            {uncategorizedMs > 0 && (
              <div
                className="bg-gray-500/40 h-full"
                style={{ width: `${(uncategorizedMs / totalMs) * 100}%` }}
                title={`Diger: ${formatResponseTime(uncategorizedMs)}`}
              />
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {safetyMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-400/60 inline-block" />
                Guvenlik {formatResponseTime(safetyMs)}
              </span>
            )}
            {contextMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-sky-500/60 inline-block" />
                Planlama {formatResponseTime(contextMs)}
              </span>
            )}
            {knowledgeMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-cyan-500/60 inline-block" />
                Bilgi {formatResponseTime(knowledgeMs)}
              </span>
            )}
            {dispatchMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-indigo-500/60 inline-block" />
                Dispatch {formatResponseTime(dispatchMs)}
              </span>
            )}
            {generationMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${trace.directResponse?.used ? 'bg-violet-500/60' : 'bg-purple-500/60'} inline-block`} />
                {trace.directResponse?.used ? 'Direkt' : 'Agent'} {formatResponseTime(generationMs)}
              </span>
            )}
            {policyMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-yellow-500/60 inline-block" />
                Policy {formatResponseTime(policyMs)}
              </span>
            )}
            {metaSendMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-pink-500/60 inline-block" />
                Meta {formatResponseTime(metaSendMs)}
              </span>
            )}
            {uncategorizedMs > 0 && (
              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-gray-500/40 inline-block" />
                Diger {formatResponseTime(uncategorizedMs)}
              </span>
            )}
            <span className="text-[9px] text-gray-400 ml-auto" title={formatTokenSummary(trace)}>
              {formatTokenSummary(trace)}
            </span>
          </div>
        </div>
      )}

      {/* New customer badge */}
      {trace.isNewCustomer && (
        <div className="mt-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            🆕 Yeni müşteri
          </span>
        </div>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: 'success' | 'fail' | 'pending' | 'warning' | 'error' }) {
  const iconMap: Record<string, string> = {
    success: '✓',
    fail: '✗',
    pending: '⏳',
    warning: '⚠',
    error: '✗',
  };
  const colorMap: Record<string, string> = {
    success: 'text-green-400 border-green-500/30',
    fail: 'text-red-400 border-red-500/30',
    pending: 'text-gray-500 border-gray-600/30',
    warning: 'text-amber-400 border-amber-500/30',
    error: 'text-red-400 border-red-500/30',
  };
  return (
    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${colorMap[status] || STEP_COLORS[status]}`}>
      {iconMap[status] || STEP_ICONS[status]}
    </span>
  );
}

// ============================================================
// Tab 1: Canlı Akış (Live Feed)
// ============================================================
function LiveFeedTab() {
  const [channelFilter, setChannelFilter] = useState<DmChannel | 'all'>('all');
  const { data, isLoading } = useDmFeed(50, channelFilter === 'all' ? undefined : channelFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const { data: conversation } = useDmConversation(selectedSender);

  const items = data?.items || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mc-card p-4 animate-pulse">
            <div className="h-4 bg-gray-700/50 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mc-empty mc-fade-up">
        <div className="mc-empty-icon">💬</div>
        <p className="mc-empty-title">Henüz DM yok</p>
        <p className="mc-empty-desc">DM pipeline aktif olduğunda mesajlar burada görünecek.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Channel Filter */}
      <div className="flex items-center gap-1.5">
        {CHANNEL_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setChannelFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              channelFilter === f.key
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                : 'bg-gray-800/40 border-gray-700/30 text-gray-500 hover:bg-gray-700/40 hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
      {/* Feed List */}
      <div className={`space-y-2 ${selectedSender ? 'w-1/2' : 'w-full'} transition-all`}>
        {items.map((dm: any) => {
          const isExpanded = expandedId === dm.id;
          const trace = dm.pipelineTrace;
          const senderId = dm.channel === 'whatsapp' ? dm.phone : dm.instagramId;
          const displayedResponseTimeMs = getDisplayedResponseTimeMs(trace, dm.responseTimeMs);
          const cacheMeta = getCacheStatusMeta(trace);
          const bufferMeta = getBufferStatusMeta(trace);
          return (
            <div key={dm.id} className="mc-card">
              <div
                className="p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : dm.id)}
              >
                <div className="flex items-center gap-2">
                  {/* Channel Badge */}
                  <ChannelBadge channel={dm.channel} />

                  {/* Direction */}
                  <span className={`text-xs font-mono ${dm.direction === 'inbound' ? 'text-sky-400' : 'text-emerald-400'}`}>
                    {dm.direction === 'inbound' ? '←' : '→'}
                  </span>

                  {/* Sender ID (clickable) */}
                  <button
                    className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-mono truncate max-w-[120px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSender(selectedSender === senderId ? null : senderId);
                    }}
                    title={senderId}
                  >
                    {senderId}
                  </button>

                  {/* Message preview */}
                  <span className="text-xs text-gray-300 truncate flex-1">
                    {(dm.messageText || dm.aiResponse || '').slice(0, 80)}
                    {(dm.messageText || dm.aiResponse || '').length > 80 ? '…' : ''}
                  </span>

                  {/* Metadata */}
                  <div className="flex items-center gap-2 shrink-0">
                    {dm.executionId && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-400 border border-gray-600/30 font-mono" title="Execution ID">
                        {dm.executionId}
                      </span>
                    )}
                    <QualityDot responseTimeMs={displayedResponseTimeMs} />
                    <TierBadge tier={dm.modelTier} modelUsed={dm.modelUsed} />
                    {cacheMeta && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cacheMeta.className}`}>
                        {cacheMeta.label}
                      </span>
                    )}
                    {bufferMeta && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${bufferMeta.className}`}>
                        {bufferMeta.label}
                      </span>
                    )}
                    {trace?.policyValidation && trace.policyValidation.status !== 'pass' && trace.policyValidation.status !== 'skipped' && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        trace.policyValidation.status === 'corrected'
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {trace.policyValidation.status === 'corrected' ? 'FIX' : '!'}
                      </span>
                    )}
                    {getConductState(trace) && getConductState(trace) !== 'normal' && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${getConductBadgeClass(getConductState(trace))}`}>
                        {formatConductStateLabel(getConductState(trace))}
                      </span>
                    )}
                    {displayedResponseTimeMs != null && dm.responseTimeMs != null && displayedResponseTimeMs > dm.responseTimeMs + 1500 && (
                      <span className="text-[9px] text-gray-500">
                        islem {formatResponseTime(dm.responseTimeMs)}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500">{timeAgo(dm.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Expanded Pipeline Trace */}
              {isExpanded && (
                <PipelineTraceExpanded trace={trace} />
              )}
            </div>
          );
        })}
      </div>

      {/* Conversation Thread Panel */}
      {selectedSender && (
        <div className="w-1/2">
          <GlassCard className="sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-100">
                Konuşma: <span className="font-mono text-sky-400">{selectedSender}</span>
              </h3>
              <button
                onClick={() => setSelectedSender(null)}
                className="text-gray-500 hover:text-gray-300 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {(conversation?.messages || []).map((msg: any) => {
                const isOutbound = msg.direction === 'outbound';
                const trace = msg.pipelineTrace;
                const pv = trace?.policyValidation;
                const displayedResponseTimeMs = getDisplayedResponseTimeMs(trace, msg.responseTimeMs);
                const qualityColor = getResponseQualityColor(displayedResponseTimeMs);
                const cacheMeta = getCacheStatusMeta(trace);
                const bufferMeta = getBufferStatusMeta(trace);
                const isTraceExpanded = expandedId === `conv-${msg.id}`;

                return (
                  <div key={msg.id} className="space-y-1">
                    {/* Inbound: customer message */}
                    {!isOutbound && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs bg-gray-700/40 border border-gray-600/20 text-gray-300">
                          <p className="whitespace-pre-wrap">{msg.messageText}</p>
                          <div className="text-[9px] text-gray-600 mt-1">{timeAgo(msg.createdAt)}</div>
                        </div>
                      </div>
                    )}

                    {/* Outbound: AI response + execution details */}
                    {isOutbound && (
                      <div className="flex justify-end">
                        <div className="max-w-[90%] space-y-1">
                          {/* Customer message that triggered this (if available) */}
                          {msg.messageText && msg.aiResponse && (
                            <div className="flex justify-start">
                              <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs bg-gray-700/40 border border-gray-600/20 text-gray-300">
                                <p className="whitespace-pre-wrap">{msg.messageText}</p>
                              </div>
                            </div>
                          )}
                          {/* AI response bubble */}
                          <div className="rounded-lg px-3 py-2 text-xs bg-sky-600/20 border border-sky-500/20 text-gray-200">
                            <p className="whitespace-pre-wrap">{msg.aiResponse || msg.messageText}</p>

                            {/* Metadata row */}
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                              {msg.executionId && (
                                <span className="px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-400 border border-gray-600/30 font-mono text-[9px]" title="Execution ID">
                                  {msg.executionId}
                                </span>
                              )}
                              {msg.modelUsed && <span className="font-mono">{msg.modelUsed.split('/').pop()}</span>}
                              {cacheMeta && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] border ${cacheMeta.className}`}>
                                  {cacheMeta.label}
                                </span>
                              )}
                              {bufferMeta && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] border ${bufferMeta.className}`}>
                                  {bufferMeta.label}
                                </span>
                              )}
                              {msg.modelTier && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] border ${TIER_COLORS[msg.modelTier] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                                  {formatTierLabel(msg.modelTier)}
                                </span>
                              )}
                              {displayedResponseTimeMs != null && (
                                <span className={`${qualityColor === 'green' ? 'text-green-400' : qualityColor === 'yellow' ? 'text-yellow-400' : qualityColor === 'red' ? 'text-red-400' : 'text-gray-500'}`}>
                                  {formatResponseTime(displayedResponseTimeMs)}
                                </span>
                              )}
                              {displayedResponseTimeMs != null && msg.responseTimeMs != null && displayedResponseTimeMs > msg.responseTimeMs + 1500 && (
                                <span className="text-gray-500">islem {formatResponseTime(msg.responseTimeMs)}</span>
                              )}
                              {msg.tokensEstimated > 0 && <span title={formatTokenSummary(trace)}>{formatTokenSummary(trace)}</span>}
                              {msg.intent && <span className="text-purple-400">#{msg.intent}</span>}
                            </div>

                            {/* Policy validation badge */}
                            {pv && pv.status !== 'skipped' && (
                              <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded ${
                                pv.status === 'pass' ? 'bg-green-500/10 text-green-400' :
                                pv.status === 'corrected' ? 'bg-yellow-500/10 text-yellow-400' :
                                pv.status === 'fallback' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'
                              }`}>
                                <span>{pv.status === 'pass' ? '✓' : pv.status === 'corrected' ? '🔄' : '⚠️'}</span>
                                <span>
                                  {pv.status === 'pass' ? 'Policy geçti' :
                                   pv.status === 'corrected' ? `${pv.attempts}. denemede düzeltildi` :
                                   pv.status === 'fallback' ? 'Yedek yanıt kullanıldı' : pv.status}
                                </span>
                                {pv.totalLatencyMs > 0 && <span className="text-gray-500">({pv.totalLatencyMs}ms)</span>}
                              </div>
                            )}

                            {/* Policy violations */}
                            {pv?.violations?.length > 0 && (
                              <div className="mt-1 pl-2 border-l-2 border-red-500/30">
                                {pv.violations.map((v: string, i: number) => (
                                  <p key={i} className="text-[10px] text-red-300/70">• {v}</p>
                                ))}
                                {pv.reason && <p className="text-[10px] text-gray-500 italic mt-0.5">{pv.reason}</p>}
                              </div>
                            )}

                            {/* Expandable pipeline trace */}
                            {trace && (
                              <button
                                className="mt-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                                onClick={() => setExpandedId(isTraceExpanded ? null : `conv-${msg.id}`)}
                              >
                                {isTraceExpanded ? '▾ Pipeline gizle' : '▸ Pipeline detayı'}
                              </button>
                            )}
                            {isTraceExpanded && trace && (
                              <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] space-y-1">
                                {PIPELINE_STEPS.map((step) => {
                                  const status = getStepStatus(trace, step.key);
                                  return (
                                    <div key={step.key} className="flex items-center gap-2">
                                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] ${STEP_COLORS[status]}`}>
                                        {STEP_ICONS[status]}
                                      </span>
                                      <span className="text-[10px] text-gray-400">{step.label}</span>
                                      {step.key === 'behavior' && getConductState(trace) && (
                                        <span className={`text-[9px] ml-auto px-1.5 py-0.5 rounded border ${getConductBadgeClass(getConductState(trace))}`}>
                                          {formatConductStateLabel(getConductState(trace))}
                                        </span>
                                      )}
                                      {step.key === 'knowledge' && trace.knowledgeEntriesCount != null && (
                                        <span className="text-[9px] text-gray-500 ml-auto">{trace.knowledgeEntriesCount} kayıt</span>
                                      )}
                                      {step.key === 'poll' && trace.agentPollDurationMs > 0 && (
                                        <span className="text-[9px] text-gray-500 ml-auto">{trace.agentPollDurationMs}ms</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="text-[9px] text-gray-600 mt-1">{timeAgo(msg.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!conversation?.messages || conversation.messages.length === 0) && (
                <p className="text-xs text-gray-500 text-center py-4">Mesaj bulunamadı</p>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
    </div>
  );
}

// ============================================================
// Tab 2: Pipeline Sağlığı (Health)
// ============================================================
function HealthTab() {
  const [period, setPeriod] = useState('today');
  const [cacheStatusFilter, setCacheStatusFilter] = useState<'all' | 'active' | 'candidate'>('all');
  const { data, isLoading } = useDmHealth(period);
  const { data: cacheStats, isLoading: cacheStatsLoading } = useDmResponseCacheStats();
  const { data: cacheEntriesData, isLoading: cacheEntriesLoading } = useDmResponseCacheEntries(cacheStatusFilter, 50);
  const seedCache = useSeedDmResponseCache();
  const clearCache = useClearDmResponseCache();
  const [cacheNotice, setCacheNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const periods = [
    { key: 'today', label: 'Bugün' },
    { key: '7d', label: '7 Gün' },
    { key: '30d', label: '30 Gün' },
  ];

  const runCachePreview = async () => {
    try {
      const result = await seedCache.mutateAsync({
        days: 30,
        dryRun: true,
        directOnly: true,
      });
      setCacheNotice({
        tone: 'info',
        text: `On izleme tamamlandi: taranan ${result.scanned}, uygun ${result.eligible}, kaydedilecek ${result.recorded}`,
      });
    } catch (error: any) {
      setCacheNotice({
        tone: 'error',
        text: error?.response?.data?.error || error?.message || 'Cache on izleme basarisiz oldu',
      });
    }
  };

  const runCacheSeed = async () => {
    try {
      const result = await seedCache.mutateAsync({
        days: 30,
        dryRun: false,
        directOnly: true,
      });
      setCacheNotice({
        tone: 'success',
        text: `Cache tohumlandi: taranan ${result.scanned}, kaydedilen ${result.recorded}`,
      });
    } catch (error: any) {
      setCacheNotice({
        tone: 'error',
        text: error?.response?.data?.error || error?.message || 'Cache tohumlama basarisiz oldu',
      });
    }
  };

  const runCacheClear = async () => {
    if (!window.confirm('DM response cache temizlensin mi?')) {
      return;
    }

    try {
      const result = await clearCache.mutateAsync();
      setCacheNotice({
        tone: 'success',
        text: `Cache temizlendi: ${result.deleted} kayit silindi`,
      });
    } catch (error: any) {
      setCacheNotice({
        tone: 'error',
        text: error?.response?.data?.error || error?.message || 'Cache temizleme basarisiz oldu',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="mc-card p-4 animate-pulse"><div className="h-8 bg-gray-700/50 rounded" /></div>
        ))}
      </div>
    );
  }

  const totalDMs = data?.totalDMs ?? 0;
  const successRate = data?.successRate ?? 0;
  const avgResponseTime = data?.avgResponseTimeMs ?? 0;
  const totalCost = data?.totalEstimatedCost ?? 0;
  const modelDist = data?.modelDistribution || [];
  const rtDist = data?.responseTimeDistribution || { green: 0, yellow: 0, red: 0 };
  const cacheEntries: DmResponseCacheEntry[] = cacheEntriesData?.items || [];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-1">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              period === p.key
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard hover={false}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Toplam DM</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{totalDMs}</p>
        </GlassCard>
        <GlassCard hover={false}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Başarı Oranı</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">
            %{successRate.toFixed(1)}
          </p>
        </GlassCard>
        <GlassCard hover={false}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ort. Yanıt Süresi</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">
            {avgResponseTime > 0 ? `${Math.round(avgResponseTime)}ms` : '—'}
          </p>
        </GlassCard>
        <GlassCard hover={false}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tahmini Maliyet</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">
            ${totalCost.toFixed(4)}
          </p>
        </GlassCard>
      </div>

      <GlassCard hover={false}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 flex-1">
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Yanit Cache</h3>
              <p className="text-xs text-gray-500 mt-1">
                Exact-match yanit cache durumu, sinif dagilimi ve seed islemleri.
              </p>
            </div>

            {cacheNotice && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${
                cacheNotice.tone === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : cacheNotice.tone === 'error'
                    ? 'border-red-500/20 bg-red-500/10 text-red-300'
                    : 'border-sky-500/20 bg-sky-500/10 text-sky-300'
              }`}>
                {cacheNotice.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Toplam</p>
                <p className="text-xl font-semibold text-gray-100 mt-1">
                  {cacheStatsLoading ? '...' : (cacheStats?.total ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">Active</p>
                <p className="text-xl font-semibold text-emerald-200 mt-1">
                  {cacheStatsLoading ? '...' : (cacheStats?.active ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-sky-500/15 bg-sky-500/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-sky-300/70">Candidate</p>
                <p className="text-xl font-semibold text-sky-200 mt-1">
                  {cacheStatsLoading ? '...' : (cacheStats?.candidate ?? 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Sinif dagilimi</div>
              {cacheStats?.classes?.length ? (
                <div className="space-y-1.5">
                  {cacheStats.classes.map((entry) => (
                    <div key={entry.cacheClass} className="flex items-center gap-3 text-xs">
                      <span className="w-32 text-gray-300">{formatCacheClassLabel(entry.cacheClass)}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-700/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500/60"
                          style={{
                            width: `${Math.max(
                              ((entry.count || 0) / Math.max(cacheStats.total || 1, 1)) * 100,
                              entry.count > 0 ? 4 : 0,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-gray-400">{entry.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Cache istatistigi henuz yok.</p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-500">Cache kayitlari</div>
                  <p className="text-xs text-gray-500 mt-1">
                    Su anda hafizada tutulan mesaj ve yanit eslesmelerini gosterir.
                  </p>
                </div>
                <div className="flex gap-1">
                  {CACHE_STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setCacheStatusFilter(filter.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        cacheStatusFilter === filter.key
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {cacheEntriesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 animate-pulse">
                      <div className="h-3 w-48 rounded bg-gray-700/50" />
                    </div>
                  ))}
                </div>
              ) : cacheEntries.length === 0 ? (
                <p className="text-xs text-gray-500">Bu filtrede cache kaydi yok.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {cacheEntries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getCacheEntryStatusBadge(entry.status)}`}>
                              {entry.status === 'active' ? 'Active' : 'Candidate'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-500/10 text-slate-300 border-slate-500/20">
                              {formatCacheClassLabel(entry.cacheClass)}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              obs {entry.observationCount}
                            </span>
                            {entry.sourceExecutionId && (
                              <span className="text-[10px] text-sky-400 font-mono">
                                {entry.sourceExecutionId}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-gray-500">Mesaj</div>
                            <div className="text-xs text-gray-200 break-words">{entry.normalizedMessage}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-gray-500">Yanit</div>
                            <div className="text-xs text-gray-300 break-words">{entry.responseText}</div>
                          </div>
                        </div>

                        <div className="text-[10px] text-gray-500 sm:text-right sm:min-w-[120px]">
                          <div>Son: {timeAgo(entry.lastSeenAt)}</div>
                          <div>Ilk: {timeAgo(entry.firstSeenAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:w-[260px] lg:justify-end">
            <button
              onClick={() => void runCachePreview()}
              disabled={seedCache.isPending || clearCache.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sky-500/20 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
            >
              On izleme
            </button>
            <button
              onClick={() => void runCacheSeed()}
              disabled={seedCache.isPending || clearCache.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Tohumla
            </button>
            <button
              onClick={() => void runCacheClear()}
              disabled={seedCache.isPending || clearCache.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              Temizle
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Model Distribution */}
      {modelDist.length > 0 && (
        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold text-gray-200 mb-3">Model Dağılımı</h3>
          <div className="space-y-2">
            {modelDist.map((m: any) => {
              const effectiveTier = (m.tier && m.tier !== 'unknown') ? m.tier : inferTierFromModel(m.model);
              const barColor = effectiveTier === 'light' ? 'bg-blue-500/60' :
                effectiveTier === 'advanced' ? 'bg-orange-500/60' : 'bg-purple-500/60';
              return (
                <div key={m.model || m.tier} className="flex items-center gap-3">
                  <span className="text-xs text-gray-300 font-mono w-40 truncate" title={m.model}>
                    {m.model?.split('/').pop() || 'Bilinmiyor'}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-gray-700/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.max(m.percentage || 0, 2)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-20 text-right">{m.count} ({(m.percentage || 0).toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Response Time Distribution */}
      <GlassCard hover={false}>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Yanıt Süresi Dağılımı</h3>
        <div className="flex gap-3">
          {[
            { key: 'green', label: '< 5s', color: 'bg-green-500/60', count: rtDist.green },
            { key: 'yellow', label: '5-15s', color: 'bg-yellow-500/60', count: rtDist.yellow },
            { key: 'red', label: '> 15s', color: 'bg-red-500/60', count: rtDist.red },
          ].map((b) => {
            const total = rtDist.green + rtDist.yellow + rtDist.red;
            const pct = total > 0 ? (b.count / total) * 100 : 0;
            return (
              <div key={b.key} className="flex-1 text-center">
                <div className="h-24 flex items-end justify-center mb-1">
                  <div
                    className={`w-full max-w-[40px] rounded-t ${b.color}`}
                    style={{ height: b.count > 0 ? `${Math.max(pct, 4)}%` : '0%' }}
                  />
                </div>
                <p className="text-xs text-gray-400">{b.label}</p>
                <p className="text-sm font-semibold text-gray-200">{b.count}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================
// Tab 3: Pipeline Hataları (Errors)
// ============================================================
function ErrorsTab() {
  const [stage, setStage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [alertBanner, setAlertBanner] = useState<any>(null);

  const filters = {
    ...(stage ? { stage } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
  const { data, isLoading } = useDmErrors(Object.keys(filters).length > 0 ? filters : undefined);

  // Listen for dm:alert events via SSE
  useDmKontrolSSE(useCallback((event: DmSSEEvent) => {
    if (event.type === 'dm:alert') {
      setAlertBanner(event.data);
      setTimeout(() => setAlertBanner(null), 30000);
    }
  }, []));

  const errors = data?.errors || [];

  const stageBorderColor = (s: string) => {
    if (['openclaw_timeout', 'openclaw_dispatch_fail', 'meta_send_fail'].includes(s)) return 'border-l-red-500';
    return 'border-l-orange-500';
  };

  const stageLabel = (s: string) => {
    const map: Record<string, string> = {
      context_error: 'Bağlam',
      knowledge_fetch_fail: 'Bilgi Tabanı',
      openclaw_timeout: 'OC Timeout',
      openclaw_dispatch_fail: 'OC Gönderim',
      meta_send_fail: 'Meta Gönderim',
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {alertBanner && (
        <div className="mc-card p-3 border border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-sm">⚠️</span>
            <span className="text-xs text-red-300 font-medium">
              Pipeline Uyarısı: Son {alertBanner.windowMinutes || 10} dakikada {alertBanner.errorCount || 0} hata tespit edildi
            </span>
            <button onClick={() => setAlertBanner(null)} className="ml-auto text-gray-500 hover:text-gray-300 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Aşama</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="mc-input text-xs py-1.5 px-2 min-w-[160px]"
          >
            {ERROR_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Başlangıç</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mc-input text-xs py-1.5 px-2"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Bitiş</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mc-input text-xs py-1.5 px-2"
          />
        </div>
      </div>

      {/* Error List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mc-card p-4 animate-pulse"><div className="h-4 bg-gray-700/50 rounded w-2/3" /></div>
          ))}
        </div>
      ) : errors.length === 0 ? (
        <div className="mc-empty mc-fade-up">
          <div className="mc-empty-icon">✅</div>
          <p className="mc-empty-title">Hata bulunamadı</p>
          <p className="mc-empty-desc">Seçili filtrelere uygun pipeline hatası yok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {errors.map((err: any) => (
            <div key={err.id} className={`mc-card p-3 border-l-2 ${stageBorderColor(err.stage)}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                  {stageLabel(err.stage)}
                </span>
                <span className="text-[10px] text-gray-500">{timeAgo(err.createdAt)}</span>
                <span className="text-[10px] text-sky-400 font-mono ml-auto">{err.instagramId}</span>
              </div>
              <p className="text-xs text-gray-400">{err.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tab 4: Model Yönlendirme (Model Routing)
// ============================================================
function ModelsTab() {
  const [period, setPeriod] = useState('today');
  const { data, isLoading } = useDmModelStats(period);

  const periods = [
    { key: 'today', label: 'Bugün' },
    { key: '7d', label: '7 Gün' },
    { key: '30d', label: '30 Gün' },
  ];

  const models = data?.models || [];

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex gap-1">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              period === p.key
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mc-card p-4 animate-pulse"><div className="h-6 bg-gray-700/50 rounded w-1/2" /></div>
          ))}
        </div>
      ) : models.length === 0 ? (
        <div className="mc-empty mc-fade-up">
          <div className="mc-empty-icon">🤖</div>
          <p className="mc-empty-title">Model verisi yok</p>
          <p className="mc-empty-desc">Seçili dönemde model yönlendirme verisi bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {models.map((m: any) => (
            <GlassCard key={m.modelId} hover={false}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-100 font-mono">
                    {m.modelId?.split('/').pop() || m.modelId}
                  </span>
                  <TierBadge tier={m.modelTier} modelUsed={m.modelId} />
                </div>
                <span className="text-xs text-gray-500">{m.messageCount} mesaj</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ort. Yanıt</p>
                  <p className="text-sm font-medium text-gray-200">
                    {m.avgResponseTimeMs > 0 ? `${Math.round(m.avgResponseTimeMs)}ms` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ort. Token</p>
                  <p className="text-sm font-medium text-gray-200">
                    {m.avgTokens > 0 ? Math.round(m.avgTokens) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Maliyet</p>
                  <p className="text-sm font-medium text-gray-200">
                    ${(m.estimatedCost || 0).toFixed(4)}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function MCDMKontrolPage() {
  const [activeTab, setActiveTab] = useState('live');
  const { connected } = useDmKontrolSSE();
  const { data: testMode } = useDmTestMode();
  const toggleTestMode = useToggleDmTestMode();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mc-fade-up">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="text-sm">📡</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-100">DM Kontrol Merkezi</h1>
              <p className="text-sm text-gray-400 mt-0.5">Instagram & WhatsApp DM pipeline izleme ve yönetim</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Test Mode Toggle */}
            <button
              onClick={() => toggleTestMode.mutate({ enabled: !testMode?.enabled })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                testMode?.enabled
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-gray-800/50 border-gray-700/50 text-gray-500 hover:bg-gray-700/50 hover:text-gray-300'
              }`}
              title={testMode?.enabled ? `Test modu aktif — sadece ${testMode.senderIds.join(', ')} yanıt alır` : 'Test modu kapalı — herkese yanıt verilir'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${testMode?.enabled ? 'bg-amber-400' : 'bg-gray-600'}`} />
              {testMode?.enabled ? '🧪 Test Modu' : 'Test Modu'}
            </button>
            {/* SSE Status */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs text-gray-400">{connected ? 'Bağlı' : 'Bağlantı koptu'}</span>
            </div>
          </div>
        </div>

        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mc-fade-up-delay">
          {activeTab === 'live' && <LiveFeedTab />}
          {activeTab === 'health' && <HealthTab />}
          {activeTab === 'errors' && <ErrorsTab />}
          {activeTab === 'models' && <ModelsTab />}
        </div>
      </div>
    </AdminLayout>
  );
}
