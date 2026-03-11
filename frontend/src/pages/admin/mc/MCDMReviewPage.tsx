import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../../layouts/AdminLayout'
import { GlassCard } from '../../../components/mc/GlassCard'
import {
  useCreateDmReviewJob,
  useDmReviewConfig,
  useDmReviewFinding,
  useDmReviewFindings,
  useDmReviewPromptPreview,
  useDmReviewRun,
  useDmReviewRuns,
  useLaunchDmReviewJarvis,
  useStartDmReviewRun,
  useUpdateDmReviewConfig,
} from '../../../hooks/useDmReviewApi'

const STATUS_COLORS: Record<string, string> = {
  strong: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  mixed: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  weak: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  critical: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
  queued: 'border-slate-400/20 bg-slate-400/10 text-slate-100',
  running: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  completed: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  failed: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
}

const STATUS_LABELS: Record<string, string> = {
  strong: 'Guclu',
  mixed: 'Karisik',
  weak: 'Zayif',
  critical: 'Kritik',
  queued: 'Sirada',
  running: 'Calisiyor',
  completed: 'Tamamlandi',
  failed: 'Hatali',
}

const FLAG_LABELS: Record<string, string> = {
  repetitive_reply: 'Tekrar eden yanit',
  over_talking_after_closeout: 'Kapanistan sonra devam',
  hallucination_suspected: 'Halusinasyon suphe',
  missed_customer_need: 'Musteri ihtiyaci kacirildi',
  weak_clarifier: 'Zayif netlestirme',
  slow_simple_turn: 'Yavas basit tur',
  conduct_mishandled: 'Davranis yonetimi sorunu',
}

const OUTCOME_LABELS: Record<string, string> = {
  resolved: 'Cozuldu',
  partially_resolved: 'Kismen cozuldu',
  unresolved: 'Cozulmedi',
  conversation_over_bot_continued: 'Bot gereksiz devam etti',
  blocked: 'Engellendi',
  unknown: 'Belirsiz',
}

type RunViewTab = 'brief' | 'signals' | 'actions'
type DetailViewTab = 'overview' | 'signals' | 'transcript'
type ReviewSetupTab = 'scope' | 'threadPrompt' | 'runPrompt' | 'preview'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('tr-TR')
}

function formatRelative(value?: string | null) {
  if (!value) return '-'
  const diffMs = Date.now() - new Date(value).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'az once'
  if (mins < 60) return `${mins} dk once`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} sa once`
  return `${Math.floor(hours / 24)} g once`
}

function averageQuality(scores: Record<string, any>) {
  const values = ['accuracy', 'helpfulness', 'tone', 'efficiency', 'intentCapture'].map(key =>
    Number(scores?.[key] || 0)
  )
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function qualityTone(score: number) {
  if (score >= 8)
    return { label: 'saglam', hero: 'from-emerald-400/20 via-cyan-400/8 to-slate-950' }
  if (score >= 6) return { label: 'izlenmeli', hero: 'from-cyan-400/20 via-sky-400/8 to-slate-950' }
  if (score >= 4)
    return { label: 'kirilgan', hero: 'from-amber-400/20 via-orange-400/8 to-slate-950' }
  return { label: 'acil dikkat', hero: 'from-rose-400/20 via-amber-400/8 to-slate-950' }
}

function formatFlagLabel(value?: string | null) {
  if (!value) return '-'
  return FLAG_LABELS[value] || value
}

function formatOutcomeLabel(value?: string | null) {
  if (!value) return '-'
  return OUTCOME_LABELS[value] || value
}

function formatSuggestionGroupLabel(value: string) {
  if (value === 'pipeline') return 'Pipeline'
  if (value === 'knowledgeBase') return 'Bilgi bankasi'
  if (value === 'tone') return 'Ton'
  return value
}

function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cx(
        'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]',
        STATUS_COLORS[value] || STATUS_COLORS.queued
      )}
    >
      {STATUS_LABELS[value] || value}
    </span>
  )
}

function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'cyan' | 'amber' | 'rose' | 'emerald'
}) {
  const color =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      : tone === 'amber'
        ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
        : tone === 'rose'
          ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
          : tone === 'emerald'
            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
            : 'border-white/10 bg-white/[0.04] text-slate-200'
  return (
    <span className={cx('rounded-full border px-2.5 py-1 text-[11px]', color)}>{children}</span>
  )
}

function StatCard({
  label,
  value,
  hint,
  className = '',
  compact = false,
}: {
  label: string
  value: string
  hint?: string
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cx('rounded-2xl border border-white/10 bg-white/[0.03] p-4', className)}>
      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className={cx('mt-2 font-semibold text-white', compact ? 'text-lg' : 'text-3xl')}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</div> : null}
    </div>
  )
}

function ScoreRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-100">{label}</span>
        <span className="text-xs font-semibold text-slate-400">{value.toFixed(1)}/10</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cx('h-full rounded-full bg-gradient-to-r', tone)}
          style={{ width: `${Math.max(0, Math.min(100, value * 10))}%` }}
        />
      </div>
    </div>
  )
}

function SectionTabs({
  tabs,
  activeTab,
  onTabChange,
  compact = false,
}: {
  tabs: Array<{ key: string; label: string }>
  activeTab: string
  onTabChange: (key: string) => void
  compact?: boolean
}) {
  return (
    <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
      {tabs.map(tab => {
        const isActive = tab.key === activeTab
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cx(
              'rounded-xl px-3 py-2 transition',
              compact ? 'text-xs' : 'text-sm',
              isActive
                ? 'bg-cyan-400/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function DetailCard({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('rounded-2xl border border-white/10 bg-white/[0.03] p-4', className)}>
      <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function MCDMReviewPage() {
  const navigate = useNavigate()
  const configQuery = useDmReviewConfig()
  const runsQuery = useDmReviewRuns(25)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null)
  const [daysBack, setDaysBack] = useState(7)
  const [channel, setChannel] = useState<'instagram' | 'whatsapp' | 'both'>('instagram')
  const [model, setModel] = useState('openai/gpt-4.1')
  const [maxThreadsPerRun, setMaxThreadsPerRun] = useState(80)
  const [targetCustomerId, setTargetCustomerId] = useState('')
  const [threadReviewPromptTemplate, setThreadReviewPromptTemplate] = useState('')
  const [runSummaryPromptTemplate, setRunSummaryPromptTemplate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [flagFilter, setFlagFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [unresolvedOnly, setUnresolvedOnly] = useState(false)
  const [hallucinationOnly, setHallucinationOnly] = useState(false)
  const [repetitiveOnly, setRepetitiveOnly] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [showAllTranscript, setShowAllTranscript] = useState(false)
  const [runViewTab, setRunViewTab] = useState<RunViewTab>('brief')
  const [detailViewTab, setDetailViewTab] = useState<DetailViewTab>('overview')
  const [reviewSetupTab, setReviewSetupTab] = useState<ReviewSetupTab>('scope')

  const listRun = useMemo(
    () =>
      runsQuery.data?.runs.find(run => run.id === selectedRunId) || runsQuery.data?.runs[0] || null,
    [runsQuery.data?.runs, selectedRunId]
  )
  const runPollMs = listRun?.status === 'queued' || listRun?.status === 'running' ? 4000 : 0
  const runQuery = useDmReviewRun(selectedRunId || listRun?.id || null, runPollMs)
  const activeRun = runQuery.data || listRun || null
  const findingsQuery = useDmReviewFindings(
    activeRun?.id || null,
    {
      status: statusFilter || undefined,
      customerId: customerFilter || undefined,
      flag: flagFilter || undefined,
      unresolvedOnly,
      hallucinationOnly,
      repetitiveOnly,
      limit: 200,
    },
    runPollMs
  )
  const findingQuery = useDmReviewFinding(activeRun?.id || null, selectedFindingId)

  const startRun = useStartDmReviewRun()
  const updateConfig = useUpdateDmReviewConfig()
  const createJob = useCreateDmReviewJob()
  const launchJarvis = useLaunchDmReviewJarvis()
  const promptPreview = useDmReviewPromptPreview()

  useEffect(() => {
    if (configQuery.data) {
      setDaysBack(configQuery.data.daysBack)
      setChannel(configQuery.data.channel)
      setModel(configQuery.data.model)
      setMaxThreadsPerRun(configQuery.data.maxThreadsPerRun)
      setThreadReviewPromptTemplate(configQuery.data.threadReviewPromptTemplate)
      setRunSummaryPromptTemplate(configQuery.data.runSummaryPromptTemplate)
    }
  }, [configQuery.data])

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.runs?.length) setSelectedRunId(runsQuery.data.runs[0].id)
  }, [runsQuery.data?.runs, selectedRunId])

  useEffect(() => {
    const firstFinding = findingsQuery.data?.findings?.[0]
    if (!selectedFindingId && firstFinding) setSelectedFindingId(firstFinding.id)
    if (
      selectedFindingId &&
      findingsQuery.data?.findings &&
      !findingsQuery.data.findings.some(finding => finding.id === selectedFindingId)
    ) {
      setSelectedFindingId(firstFinding?.id || null)
    }
  }, [findingsQuery.data?.findings, selectedFindingId])

  useEffect(() => {
    setShowAllTranscript(false)
    setDetailViewTab('overview')
  }, [selectedFindingId])

  const summary = activeRun?.summary || {}
  const findings = findingsQuery.data?.findings || []
  const selectedFinding =
    findingQuery.data || findings.find(finding => finding.id === selectedFindingId) || null
  const quality = averageQuality(summary.scoreAverages || {})
  const heroTone = qualityTone(quality)
  const topFlags = Array.isArray(summary.topFlags) ? summary.topFlags : []
  const topNeeds = Array.isArray(summary.topNeeds) ? summary.topNeeds : []
  const repeatedAnswers = Array.isArray(summary.repeatedAnswers) ? summary.repeatedAnswers : []
  const recommendations = Array.isArray(summary.recommendations) ? summary.recommendations : []
  const hallucinationIssues = Array.isArray(selectedFinding?.groundingSummary?.issues)
    ? selectedFinding.groundingSummary.issues
    : []
  const transcriptMessages = selectedFinding?.transcript?.messages || []
  const visibleTranscript = showAllTranscript ? transcriptMessages : transcriptMessages.slice(-12)
  const selectedScores = selectedFinding?.review?.scores || {}
  const suggestionGroups = ['pipeline', 'knowledgeBase', 'tone'] as const
  const promptPreviewData = promptPreview.data?.preview || null
  const activeRunScope =
    typeof activeRun?.settings?.targetCustomerId === 'string'
      ? activeRun.settings.targetCustomerId
      : null

  const buildRunInput = () => ({
    daysBack,
    channel,
    model: model.trim(),
    maxThreadsPerRun,
    targetCustomerId: targetCustomerId.trim() || undefined,
    threadReviewPromptTemplate,
    runSummaryPromptTemplate,
  })

  const handleStartRun = async () => {
    try {
      setActionMessage(null)
      const result = await startRun.mutateAsync(buildRunInput())
      setSelectedRunId(result.runId)
      setSelectedFindingId(null)
      setActionMessage(`Run baslatildi: ${result.runId}`)
    } catch (error: any) {
      setActionMessage(error?.response?.data?.error || 'Run baslatilamadi.')
    }
  }

  const handleSaveDefaults = async () => {
    try {
      setActionMessage(null)
      await updateConfig.mutateAsync({
        daysBack,
        channel,
        model: model.trim(),
        maxThreadsPerRun,
        threadReviewPromptTemplate,
        runSummaryPromptTemplate,
      })
      setActionMessage('Varsayilan DM review ayarlari kaydedildi.')
    } catch (error: any) {
      setActionMessage(error?.response?.data?.error || 'Ayarlar kaydedilemedi.')
    }
  }

  const handleRefreshPromptPreview = async () => {
    try {
      setActionMessage(null)
      await promptPreview.mutateAsync(buildRunInput())
    } catch (error: any) {
      setActionMessage(error?.response?.data?.error || 'Prompt onizlemesi alinamadi.')
    }
  }

  const handleLaunchJarvis = async () => {
    if (!activeRun?.id) return
    try {
      setActionMessage(null)
      const result = await launchJarvis.mutateAsync(activeRun.id)
      setActionMessage(result.message || `Jarvis oturumu acildi: ${result.sessionId}`)
      navigate('/admin/mc/jarvis')
    } catch (error: any) {
      setActionMessage(error?.response?.data?.error || 'Jarvis review baslatilamadi.')
    }
  }

  const handleCreateJob = async () => {
    if (!selectedFinding?.id) return
    try {
      setActionMessage(null)
      const result = await createJob.mutateAsync({
        findingId: selectedFinding.id,
        priority: 'medium',
      })
      setActionMessage(`Forge / Workshop isi olustu: ${result.job.title}`)
    } catch (error: any) {
      setActionMessage(error?.response?.data?.error || 'Is olusturulamadi.')
    }
  }

  const clearFilters = () => {
    setStatusFilter('')
    setFlagFilter('')
    setCustomerFilter('')
    setUnresolvedOnly(false)
    setHallucinationOnly(false)
    setRepetitiveOnly(false)
  }

  const renderRunView = () => {
    if (runViewTab === 'brief') {
      return (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <DetailCard label="Hizli ozet" className="bg-slate-950/45">
            <div className="space-y-4 text-sm leading-relaxed text-slate-200">
              <p className="line-clamp-6">
                {summary.summary || activeRun?.progressMessage || 'Henuz secili run ozeti yok.'}
              </p>
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  En guclu sinyaller
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topFlags.length ? (
                    topFlags.slice(0, 6).map((flag: string) => (
                      <Chip
                        key={flag}
                        tone={
                          flag.includes('hallucination')
                            ? 'rose'
                            : flag.includes('repetitive')
                              ? 'amber'
                              : 'cyan'
                        }
                      >
                        {formatFlagLabel(flag)}
                      </Chip>
                    ))
                  ) : (
                    <span className="text-slate-500">Belirgin sinyal yok.</span>
                  )}
                </div>
              </div>
            </div>
          </DetailCard>
          <DetailCard label="En cok arananlar">
            <div className="flex flex-wrap gap-2">
              {topNeeds.length ? (
                topNeeds.slice(0, 6).map((need: string) => (
                  <Chip key={need} tone="cyan">
                    {need}
                  </Chip>
                ))
              ) : (
                <span className="text-sm text-slate-500">Need sinyali yok.</span>
              )}
            </div>
          </DetailCard>
        </div>
      )
    }

    if (runViewTab === 'signals') {
      return (
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <DetailCard label="Skorlar">
            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreRow
                label="Dogruluk"
                value={Number(summary.scoreAverages?.accuracy || 0)}
                tone="from-cyan-400/35 to-sky-400/10"
              />
              <ScoreRow
                label="Fayda"
                value={Number(summary.scoreAverages?.helpfulness || 0)}
                tone="from-emerald-400/35 to-cyan-400/10"
              />
              <ScoreRow
                label="Ton"
                value={Number(summary.scoreAverages?.tone || 0)}
                tone="from-violet-400/35 to-fuchsia-400/10"
              />
              <ScoreRow
                label="Verim"
                value={Number(summary.scoreAverages?.efficiency || 0)}
                tone="from-amber-400/35 to-orange-400/10"
              />
              <ScoreRow
                label="Intent"
                value={Number(summary.scoreAverages?.intentCapture || 0)}
                tone="from-fuchsia-400/35 to-cyan-400/10"
              />
            </div>
          </DetailCard>
          <DetailCard label="Tekrarlanan cevaplar">
            {repeatedAnswers.length ? (
              <div className="space-y-2">
                {repeatedAnswers.slice(0, 4).map((item: any) => (
                  <div
                    key={`${item.text}-${item.count}`}
                    className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100"
                  >
                    <div className="line-clamp-2">{item.text}</div>
                    <div className="mt-1 text-xs text-amber-200/75">{item.count} kez tekrar</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">Belirgin tekrar izi yok.</div>
            )}
          </DetailCard>
        </div>
      )
    }

    return (
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <DetailCard label="Siradaki operator adimi">
          <div className="space-y-2">
            {recommendations.length ? (
              recommendations.slice(0, 5).map((item: string, index: number) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200"
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-semibold text-cyan-100">
                    {index + 1}
                  </div>
                  <div className="leading-relaxed">{item}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">Oneri yok.</div>
            )}
          </div>
        </DetailCard>
        <DetailCard label="Inceleme ozeti">
          <div className="grid gap-3 sm:grid-cols-2 text-sm text-slate-200">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Olusturuldu
              </div>
              <div className="mt-1">{formatDateTime(activeRun?.createdAt)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Tamamlandi
              </div>
              <div className="mt-1">{formatDateTime(activeRun?.completedAt)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Musteri</div>
              <div className="mt-1">{String(activeRun?.totalCustomers || 0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Model</div>
              <div className="mt-1">{activeRun?.model || '-'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Kanal</div>
              <div className="mt-1">{activeRun?.channel || '-'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Scope</div>
              <div className="mt-1">{activeRunScope || 'tum uygun kullanicilar'}</div>
            </div>
          </div>
        </DetailCard>
      </div>
    )
  }

  const renderDetailView = () => {
    if (!selectedFinding) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-lg rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-300">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Nasil kullanilir?
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <span className="font-semibold text-white">1.</span> Soldaki panelden yeni inceleme
                baslatin veya kayitli bir run secin.
              </div>
              <div>
                <span className="font-semibold text-white">2.</span> Inceleme kuyrugundan bir
                finding secin.
              </div>
              <div>
                <span className="font-semibold text-white">3.</span> Sagdaki tablarla ozet, sinyal
                ve transkripti inceleyip aksiyon alin.
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (detailViewTab === 'overview') {
      return (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  Ne oldu?
                </div>
                <div className="mt-2 max-w-3xl text-base leading-relaxed text-white">
                  {selectedFinding.review?.summary || 'Summary yok'}
                </div>
              </div>
              <StatusPill value={selectedFinding.overallStatus} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(selectedFinding.flags || []).map(flag => (
                <Chip
                  key={flag}
                  tone={
                    flag.includes('hallucination')
                      ? 'rose'
                      : flag.includes('repetitive')
                        ? 'amber'
                        : 'cyan'
                  }
                >
                  {formatFlagLabel(flag)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <DetailCard label="Ihtiyac haritasi">
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Ana ihtiyac
                  </div>
                  <div className="mt-1 text-slate-100">
                    {selectedFinding.review?.primaryNeed || selectedFinding.primaryNeed || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Ikincil ihtiyaclar
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.isArray(selectedFinding.review?.secondaryNeeds) &&
                    selectedFinding.review.secondaryNeeds.length ? (
                      selectedFinding.review.secondaryNeeds.map((need: string) => (
                        <Chip key={need}>{need}</Chip>
                      ))
                    ) : (
                      <span className="text-slate-500">Yok</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Acik kalanlar
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.isArray(selectedFinding.review?.unresolvedNeeds) &&
                    selectedFinding.review.unresolvedNeeds.length ? (
                      selectedFinding.review.unresolvedNeeds.map((need: string) => (
                        <Chip key={need} tone="amber">
                          {need}
                        </Chip>
                      ))
                    ) : (
                      <span className="text-slate-500">Belirgin acik kalmamis</span>
                    )}
                  </div>
                </div>
              </div>
            </DetailCard>

            <DetailCard label="Skorlar">
              <div className="space-y-3">
                <ScoreRow
                  label="Dogruluk"
                  value={Number(selectedScores.accuracy || 0)}
                  tone="from-cyan-400/35 to-sky-400/10"
                />
                <ScoreRow
                  label="Fayda"
                  value={Number(selectedScores.helpfulness || 0)}
                  tone="from-emerald-400/35 to-cyan-400/10"
                />
                <ScoreRow
                  label="Ton"
                  value={Number(selectedScores.tone || 0)}
                  tone="from-violet-400/35 to-fuchsia-400/10"
                />
                <ScoreRow
                  label="Verim"
                  value={Number(selectedScores.efficiency || 0)}
                  tone="from-amber-400/35 to-orange-400/10"
                />
                <ScoreRow
                  label="Intent"
                  value={Number(selectedScores.intentCapture || 0)}
                  tone="from-fuchsia-400/35 to-cyan-400/10"
                />
              </div>
            </DetailCard>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Mesaj" value={String(selectedFinding.messageCount || 0)} compact />
            <StatCard
              label="Musteri hissi"
              value={selectedFinding.review?.customerMood || '-'}
              compact
            />
            <StatCard
              label="Sonuc"
              value={formatOutcomeLabel(selectedFinding.review?.conversationOutcome)}
              compact
            />
          </div>
        </div>
      )
    }

    if (detailViewTab === 'signals') {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <DetailCard label="Kural bazli sinyaller">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard
                  label="Tekrar"
                  value={String(selectedFinding.deterministicMetrics?.repeatedResponseCount || 0)}
                  compact
                />
                <StatCard
                  label="Kapanis"
                  value={String(selectedFinding.deterministicMetrics?.closeoutFollowups || 0)}
                  compact
                />
                <StatCard
                  label="Acik soru"
                  value={String(selectedFinding.deterministicMetrics?.unresolvedQuestionCount || 0)}
                  compact
                />
                <StatCard
                  label="Yavas basit tur"
                  value={selectedFinding.deterministicMetrics?.hasSlowSimpleTurn ? 'yes' : 'no'}
                  compact
                />
              </div>
            </DetailCard>

            <DetailCard label="Dogrulama">
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                  label="Incelenen"
                  value={String(selectedFinding.groundingSummary?.auditedResponses || 0)}
                  compact
                />
                <StatCard
                  label="Halusinasyon"
                  value={String(selectedFinding.groundingSummary?.hallucinatedResponses || 0)}
                  className="bg-rose-500/10"
                  compact
                />
                <StatCard
                  label="Kismen"
                  value={String(selectedFinding.groundingSummary?.partiallyGroundedResponses || 0)}
                  className="bg-amber-500/10"
                  compact
                />
              </div>
              <div className="mt-4 space-y-2">
                {hallucinationIssues.length ? (
                  hallucinationIssues.slice(0, 4).map((issue: any, index: number) => (
                    <div
                      key={`${issue.interactionId}-${index}`}
                      className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-300"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Chip tone={issue.score === 'hallucinated' ? 'rose' : 'amber'}>
                          {issue.score || 'issue'}
                        </Chip>
                        <span className="text-[11px] text-slate-500">
                          {issue.interactionId || '-'}
                        </span>
                      </div>
                      {Array.isArray(issue.claims)
                        ? issue.claims.slice(0, 2).map((claim: any, claimIndex: number) => (
                            <div
                              key={`${issue.interactionId}-${claimIndex}`}
                              className="mt-2 leading-relaxed"
                            >
                              <span className="font-medium text-white">
                                {claim.issueType || 'issue'}:
                              </span>{' '}
                              {claim.reason || claim.claim}
                            </div>
                          ))
                        : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
                    Bu finding icin grounding problemi kaydi yok.
                  </div>
                )}
              </div>
            </DetailCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {suggestionGroups.map(group => {
              const items = Array.isArray(selectedFinding.review?.suggestions?.[group])
                ? selectedFinding.review.suggestions[group]
                : []
              const gradient =
                group === 'pipeline'
                  ? 'from-cyan-400/15 to-slate-950'
                  : group === 'knowledgeBase'
                    ? 'from-amber-400/15 to-slate-950'
                    : 'from-violet-400/15 to-slate-950'
              return (
                <div
                  key={group}
                  className={cx(
                    'rounded-2xl border border-white/10 bg-gradient-to-br p-4',
                    gradient
                  )}
                >
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    {formatSuggestionGroupLabel(group)}
                  </div>
                  <div className="mt-3 space-y-2">
                    {items.length ? (
                      items.map((item: string) => (
                        <div
                          key={item}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-relaxed text-slate-200"
                        >
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">Oneri yok.</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
              Konusma akisi
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {transcriptMessages.length} mesaj
            </div>
          </div>
          {transcriptMessages.length > 12 ? (
            <button
              onClick={() => setShowAllTranscript(!showAllTranscript)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]"
            >
              {showAllTranscript ? 'Kisalt' : `Tumunu Goster (${transcriptMessages.length})`}
            </button>
          ) : null}
        </div>
        <div className="space-y-3">
          {visibleTranscript.map(message => (
            <div
              key={message.id}
              className={cx(
                'rounded-2xl border px-4 py-3',
                message.direction === 'inbound'
                  ? 'border-cyan-400/20 bg-cyan-400/6'
                  : 'border-violet-400/20 bg-violet-400/7'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                <div className="font-medium text-slate-200">
                  {message.direction === 'inbound' ? 'Customer' : 'Assistant'}
                </div>
                <div>{formatDateTime(message.createdAt)}</div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white">
                {message.text}
              </div>
              {message.intent || message.modelUsed || message.responseTimeMs ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.intent ? <Chip>{message.intent}</Chip> : null}
                  {message.modelUsed ? <Chip tone="cyan">{message.modelUsed}</Chip> : null}
                  {message.responseTimeMs ? (
                    <Chip tone="amber">{message.responseTimeMs}ms</Chip>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="mc-page-header mc-fade-up">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
              DM
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Konusma kalite inceleme
              </div>
              <h1 className="mc-page-title">DM Inceleme</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                1. Inceleme baslat veya gecmis bir run sec. 2. Alttaki kuyruktan bulgu sec. 3.
                Sagdaki tablardan sorunu anlayip aksiyon al.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip tone="cyan">1. Inceleme baslat</Chip>
                <Chip tone="amber">2. Bulgu sec</Chip>
                <Chip tone="emerald">3. Incele ve aksiyon al</Chip>
              </div>
            </div>
          </div>
        </div>
        {actionMessage ? (
          <GlassCard
            className="border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100"
            hover={false}
          >
            {actionMessage}
          </GlassCard>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <GlassCard className="flex min-h-0 flex-col overflow-hidden p-0" hover={false}>
            <div className={cx('border-b border-white/10 bg-gradient-to-br p-5', heroTone.hero)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeRun ? <StatusPill value={activeRun.status} /> : null}
                    {activeRun?.id ? <Chip>{activeRun.id.slice(0, 8)}</Chip> : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {quality.toFixed(1)}/10 genel kalite
                  </h2>
                  <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-relaxed text-slate-200/85">
                    {summary.summary || activeRun?.progressMessage || 'Henuz secili run ozeti yok.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-right">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    Durum
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">{heroTone.label}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {activeRun
                      ? `${activeRun.reviewedThreads} / ${activeRun.totalThreads} thread incelendi`
                      : 'Run bekleniyor'}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Thread"
                  value={String(activeRun?.reviewedThreads || 0)}
                  hint={`${activeRun?.totalThreads || 0} aday thread`}
                  className="bg-slate-950/50"
                />
                <StatCard
                  label="Halusinasyon"
                  value={String(summary.hallucinationRiskThreads || 0)}
                  hint="risk tasiyan thread"
                  className="bg-rose-500/10"
                />
                <StatCard
                  label="Tekrar"
                  value={String(summary.repetitiveThreads || 0)}
                  hint="tekrar izi olan thread"
                  className="bg-amber-500/10"
                />
                <StatCard
                  label="Cost"
                  value={`$${Number(summary.usage?.costUsd ?? activeRun?.totalCostUsd ?? 0).toFixed(3)}`}
                  hint={`${Number(summary.usage?.totalTokens ?? activeRun?.totalTokens ?? 0).toLocaleString('tr-TR')} token`}
                  className="bg-cyan-500/10"
                />
              </div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTabs
                  tabs={[
                    { key: 'brief', label: 'Ozet' },
                    { key: 'signals', label: 'Sinyaller' },
                    { key: 'actions', label: 'Aksiyonlar' },
                  ]}
                  activeTab={runViewTab}
                  onTabChange={key => setRunViewTab(key as RunViewTab)}
                />
                <div className="flex flex-wrap gap-2">
                  {topFlags.slice(0, 3).map((flag: string) => (
                    <Chip
                      key={flag}
                      tone={
                        flag.includes('hallucination')
                          ? 'rose'
                          : flag.includes('repetitive')
                            ? 'amber'
                            : 'cyan'
                      }
                    >
                      {formatFlagLabel(flag)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="mt-4 max-h-[180px] overflow-auto">{renderRunView()}</div>
            </div>
          </GlassCard>

          <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <GlassCard className="p-4" hover={false}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    1. Inceleme baslat
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">Yeni inceleme</div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-400">
                    Bu panelden yeni analiz baslatilir veya varsayilanlar kaydedilir.
                  </div>
                </div>
                {activeRun ? <StatusPill value={activeRun.status} /> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone="cyan">{channel}</Chip>
                <Chip>{model || 'model yok'}</Chip>
                {targetCustomerId.trim() ? <Chip tone="amber">tek kullanici</Chip> : null}
              </div>
              <div className="mt-4">
                <SectionTabs
                  tabs={[
                    { key: 'scope', label: 'Scope' },
                    { key: 'threadPrompt', label: 'Thread prompt' },
                    { key: 'runPrompt', label: 'Run prompt' },
                    { key: 'preview', label: 'Prompt preview' },
                  ]}
                  activeTab={reviewSetupTab}
                  onTabChange={key => setReviewSetupTab(key as ReviewSetupTab)}
                  compact
                />
              </div>
              <div className="mt-4">
                {reviewSetupTab === 'scope' ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          Kanal
                        </span>
                        <select
                          value={channel}
                          onChange={event =>
                            setChannel(event.target.value as 'instagram' | 'whatsapp' | 'both')
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                        >
                          <option value="instagram">Instagram</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="both">Iki kanal birlikte</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          Geriye donuk gun
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={daysBack}
                          onChange={event => setDaysBack(Number(event.target.value))}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                        Tam model kimligi
                      </span>
                      <input
                        type="text"
                        value={model}
                        onChange={event => setModel(event.target.value)}
                        placeholder="openai/gpt-5.4-pro"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                      />
                      <div className="mt-2 text-xs leading-relaxed text-slate-400">
                        Buraya OpenRouter&apos;in anlayacagi model id&apos;sini aynen yaz. Run
                        sirasinda review istegi bu string ile gonderilir.
                      </div>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          Maks. thread
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={300}
                          value={maxThreadsPerRun}
                          onChange={event => setMaxThreadsPerRun(Number(event.target.value))}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          Tek kullanici scope
                        </span>
                        <input
                          type="text"
                          value={targetCustomerId}
                          onChange={event => setTargetCustomerId(event.target.value)}
                          placeholder="Instagram ID veya WhatsApp numarasi"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                        />
                        <div className="mt-2 text-xs leading-relaxed text-slate-400">
                          Doluysa sadece bu kullanicinin threadleri incelenir. Instagram icin id,
                          WhatsApp icin telefon numarasi kullan.
                        </div>
                      </label>
                    </div>
                  </div>
                ) : null}

                {reviewSetupTab === 'threadPrompt' ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-xs leading-relaxed text-cyan-50">
                      Bu metin, her thread icin review modeline user prompt olarak aynen gider.
                      Asagidaki degiskenler runtime&apos;da doldurulur:
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(promptPreviewData?.variables.threadReview || []).map(variable => (
                          <Chip key={variable} tone="cyan">
                            {variable}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={threadReviewPromptTemplate}
                      onChange={event => setThreadReviewPromptTemplate(event.target.value)}
                      rows={16}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-cyan-400/30"
                    />
                  </div>
                ) : null}

                {reviewSetupTab === 'runPrompt' ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-xs leading-relaxed text-cyan-50">
                      Bu prompt, run sonunda tum finding&apos;ler uzerinden genel ozet uretmek icin
                      aynen modele gonderilir.
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(promptPreviewData?.variables.runSummary || []).map(variable => (
                          <Chip key={variable} tone="cyan">
                            {variable}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={runSummaryPromptTemplate}
                      onChange={event => setRunSummaryPromptTemplate(event.target.value)}
                      rows={12}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-cyan-400/30"
                    />
                  </div>
                ) : null}

                {reviewSetupTab === 'preview' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                            Efektif prompt
                          </div>
                          <div className="mt-1 text-sm text-slate-300">
                            Model: <span className="font-medium text-white">{model || '-'}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {promptPreviewData?.sample.note ||
                              'Canli thread ornegini gormek icin onizlemeyi yenile.'}
                          </div>
                        </div>
                        <button
                          onClick={handleRefreshPromptPreview}
                          disabled={promptPreview.isPending}
                          className="rounded-xl border border-white/10 px-3.5 py-2 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-60"
                        >
                          {promptPreview.isPending ? 'Yenileniyor...' : 'Onizlemeyi Yenile'}
                        </button>
                      </div>
                      {promptPreviewData?.sample.customerId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Chip tone="amber">{promptPreviewData.sample.channel}</Chip>
                          <Chip>{promptPreviewData.sample.customerId}</Chip>
                          {promptPreviewData.sample.mode === 'thread' ? (
                            <Chip tone="emerald">canli thread</Chip>
                          ) : (
                            <Chip>ornek preview</Chip>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          Thread review prompt
                        </div>
                        <pre className="mt-2 max-h-[220px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/85 p-4 text-xs leading-relaxed text-slate-200">
                          {promptPreviewData?.threadReviewPrompt ||
                            'Prompt onizlemesi henuz alinmadi.'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                          Run summary prompt
                        </div>
                        <pre className="mt-2 max-h-[180px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/85 p-4 text-xs leading-relaxed text-slate-200">
                          {promptPreviewData?.runSummaryPrompt ||
                            'Prompt onizlemesi henuz alinmadi.'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                <button
                  onClick={handleStartRun}
                  disabled={startRun.isPending}
                  className="rounded-xl border border-cyan-400/25 bg-cyan-400/15 px-4 py-2.5 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
                >
                  {startRun.isPending ? 'Inceleme baslatiliyor...' : 'Incelemeyi Baslat'}
                </button>
                <button
                  onClick={handleRefreshPromptPreview}
                  disabled={promptPreview.isPending}
                  className="rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-60"
                >
                  {promptPreview.isPending ? 'Prompt okunuyor...' : 'Prompt Onizle'}
                </button>
                <button
                  onClick={handleSaveDefaults}
                  disabled={updateConfig.isPending}
                  className="rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-60"
                >
                  {updateConfig.isPending ? 'Kaydediliyor...' : 'Varsayilanlari Kaydet'}
                </button>
              </div>
            </GlassCard>

            <GlassCard className="overflow-hidden p-0" hover={false}>
              <div className="border-b border-white/10 bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  Kayitli incelemeler
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {runsQuery.data?.runs.length || 0} kayitli run
                </div>
                <div className="mt-1 text-sm text-slate-400">Eski bir sonucu acmak icin tikla.</div>
              </div>
              <div className="max-h-[320px] space-y-2 overflow-auto p-3">
                {runsQuery.data?.runs.map(run => {
                  const runQuality = averageQuality(run.summary?.scoreAverages || {})
                  return (
                    <button
                      key={run.id}
                      onClick={() => {
                        setSelectedRunId(run.id)
                        setSelectedFindingId(null)
                      }}
                      className={cx(
                        'w-full rounded-2xl border p-4 text-left transition',
                        activeRun?.id === run.id
                          ? 'border-cyan-400/35 bg-cyan-400/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {run.id.slice(0, 8)}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {run.totalThreads} thread · {run.totalMessages} mesaj · {run.channel}
                          </div>
                          {typeof run.settings?.targetCustomerId === 'string' &&
                          run.settings.targetCustomerId ? (
                            <div className="mt-2">
                              <Chip tone="amber">{run.settings.targetCustomerId}</Chip>
                            </div>
                          ) : null}
                        </div>
                        <StatusPill value={run.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                        <div>
                          <div className="uppercase tracking-[0.22em] text-slate-500">Kalite</div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {runQuality.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.22em] text-slate-500">Zaman</div>
                          <div className="mt-1 text-slate-300">{formatRelative(run.createdAt)}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </GlassCard>
          </div>
        </div>
        <div className="grid gap-5 xl:h-[74vh] xl:grid-cols-[minmax(340px,0.84fr)_minmax(0,1.16fr)]">
          <GlassCard className="flex min-h-0 flex-col overflow-hidden p-0" hover={false}>
            <div className="border-b border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    2. Bulgu sec
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    Bulgular · {findings.length}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Filtrele, sonra listeden bir bulgu sec.
                  </div>
                </div>
                <button
                  onClick={clearFilters}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                >
                  Filtreleri Sifirla
                </button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/30"
                >
                  <option value="">Tum durumlar</option>
                  <option value="critical">Kritik</option>
                  <option value="weak">Zayif</option>
                  <option value="mixed">Karisik</option>
                  <option value="strong">Guclu</option>
                </select>
                <input
                  value={customerFilter}
                  onChange={event => setCustomerFilter(event.target.value)}
                  placeholder="Musteri id veya @handle"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/30"
                />
                <input
                  value={flagFilter}
                  onChange={event => setFlagFilter(event.target.value)}
                  placeholder="Sinyal ara"
                  className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/30 md:col-span-2"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setUnresolvedOnly(!unresolvedOnly)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs',
                    unresolvedOnly
                      ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                      : 'border-white/10 text-slate-400'
                  )}
                >
                  Acik kalan
                </button>
                <button
                  onClick={() => setHallucinationOnly(!hallucinationOnly)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs',
                    hallucinationOnly
                      ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
                      : 'border-white/10 text-slate-400'
                  )}
                >
                  Halusinasyon
                </button>
                <button
                  onClick={() => setRepetitiveOnly(!repetitiveOnly)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs',
                    repetitiveOnly
                      ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                      : 'border-white/10 text-slate-400'
                  )}
                >
                  Tekrar
                </button>
              </div>
            </div>
            <div className="min-h-0 space-y-3 overflow-auto p-3">
              {findings.map(finding => (
                <button
                  key={finding.id}
                  onClick={() => setSelectedFindingId(finding.id)}
                  className={cx(
                    'w-full rounded-2xl border p-4 text-left transition',
                    selectedFinding?.id === finding.id
                      ? 'border-cyan-400/35 bg-cyan-400/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">
                        {finding.customerName || finding.customerId}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {finding.primaryNeed || 'Belirsiz ihtiyac'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill value={finding.overallStatus} />
                      <div className="text-xs font-semibold text-slate-400">
                        {finding.overallScore}/10
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <StatCard label="Mesaj" value={String(finding.messageCount)} compact />
                    <StatCard label="Flag" value={String(finding.flags?.length || 0)} compact />
                    <StatCard label="Zaman" value={formatRelative(finding.startedAt)} compact />
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-300">
                    {finding.review?.summary || 'Summary yok'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(finding.flags || []).slice(0, 4).map(flag => (
                      <Chip
                        key={flag}
                        tone={
                          flag.includes('hallucination')
                            ? 'rose'
                            : flag.includes('repetitive')
                              ? 'amber'
                              : 'cyan'
                        }
                      >
                        {formatFlagLabel(flag)}
                      </Chip>
                    ))}
                  </div>
                </button>
              ))}
              {!findings.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
                  Bu filtrelerle finding bulunamadi.
                </div>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard className="flex min-h-0 flex-col overflow-hidden p-0" hover={false}>
            <div className="border-b border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                    3. Detay ve aksiyon
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {selectedFinding?.customerName || 'Bulgu detayi'}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {selectedFinding
                      ? `${selectedFinding.customerId} · ${formatDateTime(selectedFinding.startedAt)}`
                      : 'Soldaki listeden bir bulgu sec.'}
                  </div>
                </div>
                {selectedFinding ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/admin/interactions?customerId=${encodeURIComponent(selectedFinding.customerId)}`}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.05]"
                    >
                      Konusmayi Ac
                    </Link>
                    <button
                      onClick={handleCreateJob}
                      disabled={!selectedFinding || createJob.isPending}
                      className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-400/15 disabled:opacity-50"
                    >
                      {createJob.isPending ? 'Gorev aciliyor...' : 'Forge / Workshop Gorevi'}
                    </button>
                    <button
                      onClick={handleLaunchJarvis}
                      disabled={
                        !activeRun || activeRun.status !== 'completed' || launchJarvis.isPending
                      }
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.05] disabled:opacity-50"
                    >
                      {launchJarvis.isPending ? 'Jarvis...' : "Jarvis'e Gonder"}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-4">
                <SectionTabs
                  tabs={[
                    { key: 'overview', label: 'Genel bakis' },
                    { key: 'signals', label: 'Sinyaller' },
                    { key: 'transcript', label: 'Transkript' },
                  ]}
                  activeTab={detailViewTab}
                  onTabChange={key => setDetailViewTab(key as DetailViewTab)}
                />
              </div>
            </div>
            <div className="min-h-0 overflow-auto p-5">{renderDetailView()}</div>
          </GlassCard>
        </div>
      </div>
    </AdminLayout>
  )
}
