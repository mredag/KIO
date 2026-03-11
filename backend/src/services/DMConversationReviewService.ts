import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'crypto'
import {
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
  isGenericInfoRequest,
  isStandaloneCloseoutMessage,
  normalizeTemplateText,
} from './DMPipelineHeuristics.js'
import { DMGroundingAuditService, type DMGroundingAuditResult } from './DMGroundingAuditService.js'
import {
  addUsageMetrics,
  extractUsageMetrics,
  ZERO_USAGE_METRICS,
  type UsageMetrics,
} from './UsageMetrics.js'

type ReviewChannel = 'instagram' | 'whatsapp' | 'both'
type RunStatus = 'queued' | 'running' | 'completed' | 'failed'
type FindingStatus = 'strong' | 'mixed' | 'weak' | 'critical'
type ConversationOutcome =
  | 'resolved'
  | 'partially_resolved'
  | 'unresolved'
  | 'conversation_over_bot_continued'
  | 'blocked'
  | 'unknown'

interface ConfigRow {
  conditions?: string
}

interface KnowledgeBaseRow {
  category: string
  key_name: string
  value: string
}

interface RawInteractionRow {
  id: string
  customer_id: string
  channel: 'instagram' | 'whatsapp'
  customer_name: string | null
  direction: 'inbound' | 'outbound'
  message_text: string
  intent: string | null
  sentiment: string | null
  ai_response: string | null
  response_time_ms: number | null
  model_used: string | null
  model_tier: string | null
  pipeline_trace: string | null
  pipeline_error: string | null
  execution_id: string | null
  created_at: string
}

interface ReviewUsageEnvelope {
  usage?: Record<string, unknown>
  cost?: unknown
}

export interface DMConversationReviewConfig {
  daysBack: number
  channel: ReviewChannel
  threadGapMinutes: number
  includeTestTraffic: boolean
  minMessagesPerThread: number
  maxThreadsPerRun: number
  maxMessagesPerThread: number
  model: string
  maxTokens: number
  temperature: number
  concurrency: number
  threadReviewPromptTemplate: string
  runSummaryPromptTemplate: string
}

export interface DMConversationReviewRunInput extends Partial<DMConversationReviewConfig> {
  targetCustomerId?: string | null
}

export interface DMConversationReviewPromptPreview {
  config: DMConversationReviewConfig
  targetCustomerId: string | null
  threadReviewPrompt: string
  runSummaryPrompt: string
  sample: {
    mode: 'sample' | 'thread'
    channel: ReviewChannel
    customerId: string | null
    threadKey: string | null
    note: string
  }
  variables: {
    threadReview: string[]
    runSummary: string[]
  }
  defaults: {
    threadReviewPromptTemplate: string
    runSummaryPromptTemplate: string
  }
}

export interface DMConversationThreadMessage {
  id: string
  direction: 'inbound' | 'outbound'
  text: string
  intent: string | null
  sentiment: string | null
  aiResponse: string | null
  responseTimeMs: number | null
  modelUsed: string | null
  modelTier: string | null
  pipelineTrace: Record<string, unknown> | null
  pipelineError: string | null
  executionId: string | null
  createdAt: string
}

export interface DMConversationThreadSnapshot {
  threadKey: string
  channel: 'instagram' | 'whatsapp'
  customerId: string
  customerName: string | null
  conversationId: string | null
  startedAt: string
  endedAt: string
  messageCount: number
  inboundCount: number
  outboundCount: number
  messages: DMConversationThreadMessage[]
}

export interface ThreadDeterministicMetrics {
  repeatedResponseCount: number
  repeatedResponseSamples: Array<{ hash: string; text: string; count: number }>
  repeatedGreetingCount: number
  repeatedCtaCount: number
  closeoutFollowups: number
  unresolvedQuestionCount: number
  hasSlowSimpleTurn: boolean
  avgResponseTimeMs: number
  slowestResponseTimeMs: number
  pipelineErrorCount: number
  policyCorrectionCount: number
  policyFallbackCount: number
  lastMessageDirection: 'inbound' | 'outbound' | null
  heuristicOutcome: ConversationOutcome
}

export interface ThreadGroundingSummary {
  auditedResponses: number
  hallucinatedResponses: number
  partiallyGroundedResponses: number
  issues: Array<{
    interactionId: string
    score: string
    claims: Array<{ claim: string; issueType: string; reason: string }>
  }>
}

export interface ThreadLLMReview {
  scores: {
    accuracy: number
    helpfulness: number
    tone: number
    efficiency: number
    intentCapture: number
  }
  overallStatus: FindingStatus
  flags: string[]
  primaryNeed: string
  secondaryNeeds: string[]
  unresolvedNeeds: string[]
  customerMood: string
  conversationOutcome: ConversationOutcome
  summary: string
  suggestions: {
    pipeline: string[]
    knowledgeBase: string[]
    tone: string[]
  }
  evidence: string[]
}

export interface DMConversationReviewFinding {
  id: string
  runId: string
  channel: 'instagram' | 'whatsapp'
  customerId: string
  customerName: string | null
  conversationId: string | null
  threadKey: string
  startedAt: string
  endedAt: string
  messageCount: number
  overallScore: number
  overallStatus: FindingStatus
  primaryNeed: string
  flags: string[]
  transcript: DMConversationThreadSnapshot
  deterministicMetrics: ThreadDeterministicMetrics
  groundingSummary: ThreadGroundingSummary
  review: ThreadLLMReview
  createdAt: string
}

export interface DMConversationReviewRun {
  id: string
  status: RunStatus
  channel: ReviewChannel
  daysBack: number
  model: string
  totalThreads: number
  reviewedThreads: number
  totalCustomers: number
  totalMessages: number
  totalTokens: number
  totalCostUsd: number
  progressMessage: string | null
  error: string | null
  summary: Record<string, unknown> | null
  settings: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

interface ThreadReviewContext {
  snapshot: DMConversationThreadSnapshot
  deterministicMetrics: ThreadDeterministicMetrics
  groundingSummary: ThreadGroundingSummary
  review: ThreadLLMReview
  usage: UsageMetrics
}

let reviewServiceSingleton: DMConversationReviewService | null = null

const POLICY_ID = 'dm_review_config'
const POLICY_NAME = 'DM Conversation Review Config'
const THREAD_REVIEW_SCHEMA_JSON =
  '{"scores":{"accuracy":7,"helpfulness":6,"tone":8,"efficiency":5,"intentCapture":6},"overallStatus":"mixed","flags":["repetitive_reply"],"primaryNeed":"...","secondaryNeeds":["..."],"unresolvedNeeds":["..."],"customerMood":"...","conversationOutcome":"partially_resolved","summary":"...","suggestions":{"pipeline":["..."],"knowledgeBase":["..."],"tone":["..."]},"evidence":["..."]}'
const RUN_SUMMARY_SCHEMA_JSON =
  '{"summary":"...","topFlags":["..."],"topNeeds":["..."],"recommendations":["..."]}'
const THREAD_REVIEW_PROMPT_VARIABLES = [
  '{{allowedStatuses}}',
  '{{allowedOutcomes}}',
  '{{allowedFlags}}',
  '{{threadMetaJson}}',
  '{{transcript}}',
  '{{deterministicMetricsJson}}',
  '{{groundingSummaryJson}}',
  '{{threadReviewSchemaJson}}',
]
const RUN_SUMMARY_PROMPT_VARIABLES = ['{{runAggregateJson}}', '{{runSummarySchemaJson}}']
const DEFAULT_THREAD_REVIEW_PROMPT_TEMPLATE = [
  'Bu musteri DM threadini bastan sona incele.',
  'Sadece gecerli JSON dondur. Markdown, aciklama veya kod blogu yazma.',
  'Tum serbest metin alanlarini Turkce yaz.',
  'Skorlari 1-10 arasinda gercekci ve ayirt edici ver. Her alana otomatik olarak 1 verme.',
  'Allowed overallStatus: {{allowedStatuses}}',
  'Allowed conversationOutcome: {{allowedOutcomes}}',
  'Allowed flags: {{allowedFlags}}',
  '',
  'Thread meta:',
  '{{threadMetaJson}}',
  '',
  'Transkript:',
  '{{transcript}}',
  '',
  'Kural bazli sinyaller:',
  '{{deterministicMetricsJson}}',
  '',
  'Dogrulama ozeti:',
  '{{groundingSummaryJson}}',
  '',
  'JSON semasi:',
  '{{threadReviewSchemaJson}}',
].join('\n')
const DEFAULT_RUN_SUMMARY_PROMPT_TEMPLATE = [
  'Kaydedilmis bir DM conversation review run ozeti cikar.',
  'Sadece gecerli JSON dondur.',
  'Tum serbest metin alanlarini Turkce yaz.',
  '',
  'Run ozeti:',
  '{{runAggregateJson}}',
  '',
  'JSON semasi:',
  '{{runSummarySchemaJson}}',
].join('\n')
const DEFAULT_CONFIG: DMConversationReviewConfig = {
  daysBack: 7,
  channel: 'instagram',
  threadGapMinutes: 480,
  includeTestTraffic: false,
  minMessagesPerThread: 2,
  maxThreadsPerRun: 80,
  maxMessagesPerThread: 60,
  model: 'openai/gpt-4.1',
  maxTokens: 1400,
  temperature: 0.1,
  concurrency: 2,
  threadReviewPromptTemplate: DEFAULT_THREAD_REVIEW_PROMPT_TEMPLATE,
  runSummaryPromptTemplate: DEFAULT_RUN_SUMMARY_PROMPT_TEMPLATE,
}
const GREETING_PATTERN = /\b(merhaba|selam|iyi gunler|iyi aksamlar|hos geldiniz)\b/
const CTA_PATTERN = /\b(arayabilir|iletisim|telefon|whatsapp|randevu|detayli bilgi|arayin)\b/
const SIMPLE_HOURS_PATTERN = /\b(saat|acik|kapali|kaca kadar|kacta)\b/
const QUESTION_PATTERN = /[?？]|\b(mi|mı|mu|mü)\b/i
const TEST_LIKE_CUSTOMER_IDS = new Set(['simulator', 'simulator-user', 'dm-simulator'])

export function setDMConversationReviewService(service: DMConversationReviewService): void {
  reviewServiceSingleton = service
}

export function getDMConversationReviewService(): DMConversationReviewService | null {
  return reviewServiceSingleton
}

export class DMConversationReviewService {
  private activeRuns = new Set<string>()
  private groundingAudit: DMGroundingAuditService

  constructor(private db: Database.Database) {
    this.groundingAudit = new DMGroundingAuditService(process.env.OPENROUTER_API_KEY || '')
    this.ensureConfigExists()
    setDMConversationReviewService(this)
  }

  getConfig(): DMConversationReviewConfig {
    try {
      const row = this.db
        .prepare('SELECT conditions FROM mc_policies WHERE id = ?')
        .get(POLICY_ID) as ConfigRow | undefined
      const saved = row?.conditions ? JSON.parse(row.conditions) : {}
      return this.resolveConfig(saved)
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  saveConfig(partial: Partial<DMConversationReviewConfig>): DMConversationReviewConfig {
    const next = this.resolveConfig(partial)
    this.db
      .prepare(
        `
      UPDATE mc_policies
      SET conditions = ?, updated_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(JSON.stringify(next), POLICY_ID)
    return next
  }

  getPromptPreview(
    input: DMConversationReviewRunInput = {}
  ): DMConversationReviewPromptPreview {
    const config = this.resolveConfig(input)
    const targetCustomerId = normalizeScopeCustomerId(input.targetCustomerId)
    const previewThread =
      this.selectPromptPreviewThread(config, targetCustomerId) ||
      this.buildSamplePromptThread(config, targetCustomerId)
    const deterministicMetrics = this.buildDeterministicMetrics(previewThread)
    const groundingSummary = this.buildPreviewGroundingSummary(previewThread)
    const runAggregate = this.buildPromptPreviewRunAggregate(previewThread, deterministicMetrics)

    return {
      config,
      targetCustomerId,
      threadReviewPrompt: this.buildThreadReviewPrompt(
        previewThread,
        deterministicMetrics,
        groundingSummary,
        config
      ),
      runSummaryPrompt: this.buildRunSummaryPrompt(runAggregate, config),
      sample: {
        mode: previewThread.threadKey.startsWith('preview:') ? 'sample' : 'thread',
        channel: previewThread.channel,
        customerId: previewThread.customerId,
        threadKey: previewThread.threadKey.startsWith('preview:') ? null : previewThread.threadKey,
        note: previewThread.threadKey.startsWith('preview:')
          ? 'Canli thread bulunamadigi icin ornek bir preview kullaniliyor. Grounding ozeti preview modunda hizli placeholder ile doldurulur.'
          : 'Prompt, secili threadin son goruntusuyle render edildi. Grounding ozeti preview modunda hizli placeholder ile doldurulur.',
      },
      variables: {
        threadReview: [...THREAD_REVIEW_PROMPT_VARIABLES],
        runSummary: [...RUN_SUMMARY_PROMPT_VARIABLES],
      },
      defaults: {
        threadReviewPromptTemplate: DEFAULT_THREAD_REVIEW_PROMPT_TEMPLATE,
        runSummaryPromptTemplate: DEFAULT_RUN_SUMMARY_PROMPT_TEMPLATE,
      },
    }
  }

  startRun(overrides: DMConversationReviewRunInput = {}): DMConversationReviewRun {
    const config = this.resolveConfig(overrides)
    const targetCustomerId = normalizeScopeCustomerId(overrides.targetCustomerId)
    const runId = randomUUID()
    const now = new Date().toISOString()
    const settings = targetCustomerId ? { ...config, targetCustomerId } : config

    this.db
      .prepare(
        `
      INSERT INTO dm_review_runs (
        id, status, channel, days_back, model, total_threads, reviewed_threads,
        total_customers, total_messages, total_tokens, total_cost_usd, progress_message,
        error, summary_json, settings_json, started_at, completed_at, created_at, updated_at
      ) VALUES (?, 'queued', ?, ?, ?, 0, 0, 0, 0, 0, 0, ?, NULL, NULL, ?, NULL, NULL, ?, ?)
    `
      )
      .run(
        runId,
        config.channel,
        config.daysBack,
        config.model,
        'Queued',
        JSON.stringify(settings),
        now,
        now
      )

    this.emitEvent(
      'system',
      runId,
      'dm_review_started',
      `DM review basladi (${config.daysBack} gun, ${config.channel})`,
      {
        daysBack: config.daysBack,
        channel: config.channel,
        model: config.model,
        targetCustomerId,
      }
    )

    queueMicrotask(() => {
      void this.processRun(runId).catch(error => {
        console.error(
          '[DMReview] Run %s failed: %s',
          runId,
          error instanceof Error ? error.message : String(error)
        )
      })
    })

    return this.getRun(runId)!
  }

  listRuns(limit = 20): DMConversationReviewRun[] {
    const rows = this.db
      .prepare(
        `
      SELECT *
      FROM dm_review_runs
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(Math.min(Math.max(limit, 1), 100)) as any[]
    return rows.map(row => this.mapRunRow(row))
  }

  getRun(runId: string): DMConversationReviewRun | null {
    const row = this.db.prepare('SELECT * FROM dm_review_runs WHERE id = ?').get(runId) as any
    return row ? this.mapRunRow(row) : null
  }

  getLatestCompletedRun(channel: ReviewChannel = 'instagram'): DMConversationReviewRun | null {
    const row = this.db
      .prepare(
        `
      SELECT *
      FROM dm_review_runs
      WHERE status = 'completed' AND channel = ?
      ORDER BY completed_at DESC, created_at DESC
      LIMIT 1
    `
      )
      .get(channel) as any
    return row ? this.mapRunRow(row) : null
  }

  listFindings(
    runId: string,
    filters?: {
      status?: string
      customerId?: string
      flag?: string
      unresolvedOnly?: boolean
      hallucinationOnly?: boolean
      repetitiveOnly?: boolean
      limit?: number
    }
  ): DMConversationReviewFinding[] {
    const conditions = ['run_id = ?']
    const params: any[] = [runId]

    if (filters?.status) {
      conditions.push('overall_status = ?')
      params.push(normalizeFindingStatus(filters.status))
    }
    if (filters?.customerId) {
      conditions.push("(lower(customer_id) LIKE ? OR lower(COALESCE(customer_name, '')) LIKE ?)")
      const search = `%${String(filters.customerId).trim().toLowerCase()}%`
      params.push(search, search)
    }
    if (filters?.flag) {
      conditions.push('flags_json LIKE ?')
      params.push(`%${filters.flag}%`)
    }
    if (filters?.unresolvedOnly) {
      conditions.push(
        `(review_json LIKE '%"conversationOutcome":"unresolved"%' OR review_json LIKE '%"conversationOutcome":"partially_resolved"%')`
      )
    }
    if (filters?.hallucinationOnly) {
      conditions.push(`flags_json LIKE '%hallucination_suspected%'`)
    }
    if (filters?.repetitiveOnly) {
      conditions.push(
        `(flags_json LIKE '%repetitive_reply%' OR flags_json LIKE '%over_talking_after_closeout%')`
      )
    }

    const rows = this.db
      .prepare(
        `
      SELECT *
      FROM dm_review_findings
      WHERE ${conditions.join(' AND ')}
      ORDER BY overall_score ASC, thread_started_at DESC
      LIMIT ?
    `
      )
      .all(...params, Math.min(Math.max(filters?.limit || 200, 1), 500)) as any[]

    return rows.map(row => this.mapFindingRow(row))
  }

  getFinding(runId: string, findingId: string): DMConversationReviewFinding | null {
    const row = this.db
      .prepare(
        `
      SELECT *
      FROM dm_review_findings
      WHERE id = ? AND run_id = ?
    `
      )
      .get(findingId, runId) as any
    return row ? this.mapFindingRow(row) : null
  }

  createJobFromFinding(
    findingId: string,
    options?: { priority?: string; agentId?: string | null }
  ) {
    const finding = this.db
      .prepare('SELECT * FROM dm_review_findings WHERE id = ?')
      .get(findingId) as any
    if (!finding) {
      throw new Error('Review finding not found')
    }

    const review = safeJsonParse(finding.review_json) || {}
    const flags: string[] = safeJsonParse(finding.flags_json) || []
    const jobId = randomUUID()
    const priority = options?.priority || 'medium'
    const agentId = options?.agentId || this.findForgeAgentId()
    const title = `[DM Review] ${finding.primary_need || 'Review finding'} - ${finding.customer_id}`
    const payload = {
      source: 'dm_review',
      findingId,
      runId: finding.run_id,
      customerId: finding.customer_id,
      primaryNeed: finding.primary_need,
      overallStatus: finding.overall_status,
      flags,
      summary: review.summary || null,
      suggestions: review.suggestions || {},
      conversationId: finding.conversation_id || null,
      threadKey: finding.thread_key,
    }

    this.db
      .prepare(
        `
      INSERT INTO mc_jobs (id, title, source, priority, status, agent_id, payload, conversation_id, created_at, updated_at)
      VALUES (?, ?, 'manual', ?, 'queued', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
      )
      .run(
        jobId,
        title,
        priority,
        agentId,
        JSON.stringify(payload),
        finding.conversation_id || null
      )

    this.emitEvent(
      'job',
      jobId,
      'created',
      `DM review findingi icin gorev olusturuldu (${finding.customer_id})`,
      {
        findingId,
        runId: finding.run_id,
        customerId: finding.customer_id,
      }
    )

    return { id: jobId, title, status: 'queued' }
  }

  buildJarvisReviewPacket(runId: string, maxFindings = 10): string {
    const run = this.getRun(runId)
    if (!run) {
      throw new Error('DM review run not found')
    }

    const findings = this.listFindings(runId, { limit: maxFindings })
    const summary = (run.summary || {}) as Record<string, any>
    const lines = [
      '# DM Conversation Review',
      '',
      `Run ID: ${run.id}`,
      `Channel: ${run.channel}`,
      `Status: ${run.status}`,
      `Days Back: ${run.daysBack}`,
      `Threads: ${run.totalThreads}`,
      `Customers: ${run.totalCustomers}`,
      `Messages: ${run.totalMessages}`,
      '',
      '## Summary',
      String(summary.summary || 'No summary available'),
      '',
      '## Top Wants',
      ...normalizeStringArray(summary.topNeeds)
        .slice(0, 8)
        .map((need, index) => `${index + 1}. ${need}`),
      '',
      '## Key Findings',
    ]

    findings.forEach((finding, index) => {
      lines.push(`### Finding ${index + 1}`)
      lines.push(`- Customer: ${finding.customerId}`)
      lines.push(`- Need: ${finding.primaryNeed || '-'}`)
      lines.push(`- Score: ${finding.overallScore.toFixed(1)} / 10`)
      lines.push(`- Status: ${finding.overallStatus}`)
      lines.push(`- Flags: ${(finding.flags || []).join(', ') || '-'}`)
      lines.push(`- Summary: ${finding.review.summary}`)
      lines.push(
        `- Suggestions: ${(finding.review.suggestions.pipeline || []).slice(0, 2).join(' | ') || '-'}`
      )
    })

    lines.push(
      '',
      'This packet came from the saved DM review run. Use /api/mc/dm-review for structured drilldown.'
    )
    return lines.join('\n')
  }

  getLatestSummaryForSystemContext(): string | null {
    const run = this.getLatestCompletedRun('instagram')
    if (!run || !run.summary) {
      return null
    }

    const summary = run.summary as Record<string, any>
    const topFlags = countLabels(normalizeStringArray(summary.topFlags || []))
    const lines = [
      '## DM Conversation Review (Latest Completed Run)',
      `- Run: ${run.id}`,
      `- Threads: ${run.totalThreads}`,
      `- Customers: ${run.totalCustomers}`,
      `- Messages: ${run.totalMessages}`,
      `- Summary: ${String(summary.summary || '-')}`,
      `- Top wants: ${normalizeStringArray(summary.topNeeds).slice(0, 5).join(', ') || '-'}`,
      `- Top issues: ${Object.keys(topFlags).slice(0, 5).join(', ') || '-'}`,
    ]
    return lines.join('\n')
  }

  private ensureConfigExists(): void {
    const existing = this.db.prepare('SELECT id FROM mc_policies WHERE id = ?').get(POLICY_ID)
    if (!existing) {
      this.db
        .prepare(
          `
        INSERT INTO mc_policies (id, name, type, conditions, actions, is_active, priority, created_at, updated_at)
        VALUES (?, ?, 'guardrail', ?, '{}', 1, 80, datetime('now'), datetime('now'))
      `
        )
        .run(POLICY_ID, POLICY_NAME, JSON.stringify(DEFAULT_CONFIG))
    }
  }

  private resolveConfig(
    input: Partial<DMConversationReviewConfig> | Record<string, unknown>
  ): DMConversationReviewConfig {
    const partial = this.pickConfigFields(input)
    const next = { ...DEFAULT_CONFIG, ...partial }
    return {
      daysBack: clampInteger(next.daysBack, 1, 30, DEFAULT_CONFIG.daysBack),
      channel: isReviewChannel(next.channel) ? next.channel : DEFAULT_CONFIG.channel,
      threadGapMinutes: clampInteger(
        next.threadGapMinutes,
        30,
        1440,
        DEFAULT_CONFIG.threadGapMinutes
      ),
      includeTestTraffic: Boolean(next.includeTestTraffic),
      minMessagesPerThread: clampInteger(
        next.minMessagesPerThread,
        1,
        50,
        DEFAULT_CONFIG.minMessagesPerThread
      ),
      maxThreadsPerRun: clampInteger(next.maxThreadsPerRun, 1, 500, DEFAULT_CONFIG.maxThreadsPerRun),
      maxMessagesPerThread: clampInteger(
        next.maxMessagesPerThread,
        10,
        300,
        DEFAULT_CONFIG.maxMessagesPerThread
      ),
      model: normalizeNonEmptyString(next.model, DEFAULT_CONFIG.model),
      maxTokens: clampInteger(next.maxTokens, 200, 4000, DEFAULT_CONFIG.maxTokens),
      temperature: clampNumber(next.temperature, 0, 1, DEFAULT_CONFIG.temperature),
      concurrency: clampInteger(next.concurrency, 1, 6, DEFAULT_CONFIG.concurrency),
      threadReviewPromptTemplate: normalizeNonEmptyString(
        next.threadReviewPromptTemplate,
        DEFAULT_CONFIG.threadReviewPromptTemplate
      ),
      runSummaryPromptTemplate: normalizeNonEmptyString(
        next.runSummaryPromptTemplate,
        DEFAULT_CONFIG.runSummaryPromptTemplate
      ),
    }
  }

  private pickConfigFields(
    input: Partial<DMConversationReviewConfig> | Record<string, unknown>
  ): Partial<DMConversationReviewConfig> {
    return {
      daysBack: asNumber(input.daysBack),
      channel: isReviewChannel(input.channel) ? input.channel : undefined,
      threadGapMinutes: asNumber(input.threadGapMinutes),
      includeTestTraffic:
        typeof input.includeTestTraffic === 'boolean' ? input.includeTestTraffic : undefined,
      minMessagesPerThread: asNumber(input.minMessagesPerThread),
      maxThreadsPerRun: asNumber(input.maxThreadsPerRun),
      maxMessagesPerThread: asNumber(input.maxMessagesPerThread),
      model: typeof input.model === 'string' ? input.model : undefined,
      maxTokens: asNumber(input.maxTokens),
      temperature: asNumber(input.temperature),
      concurrency: asNumber(input.concurrency),
      threadReviewPromptTemplate:
        typeof input.threadReviewPromptTemplate === 'string'
          ? input.threadReviewPromptTemplate
          : undefined,
      runSummaryPromptTemplate:
        typeof input.runSummaryPromptTemplate === 'string'
          ? input.runSummaryPromptTemplate
          : undefined,
    }
  }

  private async processRun(runId: string): Promise<void> {
    if (this.activeRuns.has(runId)) {
      return
    }
    this.activeRuns.add(runId)

    const run = this.getRun(runId)
    if (!run) {
      this.activeRuns.delete(runId)
      return
    }

    const config = this.resolveConfig(run.settings || {})
    const targetCustomerId = normalizeScopeCustomerId((run.settings || {}).targetCustomerId)

    try {
      this.updateRun(runId, {
        status: 'running',
        startedAt: new Date().toISOString(),
        progressMessage: 'Conversation threads are being collected',
      })

      const kbText = this.buildKnowledgeBaseText()
      const threads = this.buildThreads(config, targetCustomerId)
      const customers = new Set(threads.map(thread => `${thread.channel}:${thread.customerId}`))
      const totalMessages = threads.reduce((sum, thread) => sum + thread.messageCount, 0)
      this.updateRun(runId, {
        totalThreads: threads.length,
        totalCustomers: customers.size,
        totalMessages,
        progressMessage: `${threads.length} thread prepared`,
      })

      const toReview = threads.slice(0, config.maxThreadsPerRun)
      let aggregateUsage = ZERO_USAGE_METRICS
      const contexts: ThreadReviewContext[] = []
      const batchSize = Math.max(1, config.concurrency)

      for (let index = 0; index < toReview.length; index += batchSize) {
        const batch = toReview.slice(index, index + batchSize)
        const results = await Promise.all(
          batch.map(thread => this.reviewThread(thread, kbText, config))
        )
        for (const result of results) {
          contexts.push(result)
          aggregateUsage = addUsageMetrics(aggregateUsage, result.usage)
          this.persistFinding(runId, result)
        }

        this.updateRun(runId, {
          reviewedThreads: contexts.length,
          totalTokens: aggregateUsage.totalTokens,
          totalCostUsd: roundCost(aggregateUsage.costUsd),
          progressMessage: `${contexts.length}/${toReview.length} threads reviewed`,
        })
      }

      const summary = await this.buildRunSummary(runId, contexts, config, aggregateUsage)
      this.updateRun(runId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        reviewedThreads: contexts.length,
        totalTokens: aggregateUsage.totalTokens,
        totalCostUsd: roundCost(aggregateUsage.costUsd),
        progressMessage: 'Completed',
        summary,
      })

      this.emitEvent(
        'system',
        runId,
        'dm_review_completed',
        `DM review tamamlandi (${contexts.length} thread)`,
        {
          runId,
          totalThreads: threads.length,
          reviewedThreads: contexts.length,
          totalMessages,
        }
      )
    } catch (error: any) {
      this.updateRun(runId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: error?.message || 'Unknown error',
        progressMessage: 'Failed',
      })
      this.emitEvent(
        'system',
        runId,
        'dm_review_failed',
        `DM review hatasi: ${error?.message || 'Unknown error'}`,
        {
          runId,
        }
      )
    } finally {
      this.activeRuns.delete(runId)
    }
  }

  private buildThreads(
    config: DMConversationReviewConfig,
    targetCustomerId: string | null = null
  ): DMConversationThreadSnapshot[] {
    const rows = this.fetchInteractions(config, targetCustomerId)
    const grouped = new Map<string, RawInteractionRow[]>()
    for (const row of rows) {
      const key = `${row.channel}:${row.customer_id}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(row)
    }

    const threads: DMConversationThreadSnapshot[] = []
    for (const customerRows of grouped.values()) {
      customerRows.sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      )
      let buffer: RawInteractionRow[] = []

      const flush = () => {
        if (buffer.length < config.minMessagesPerThread) {
          buffer = []
          return
        }
        threads.push(this.createThreadSnapshot(buffer, config.maxMessagesPerThread))
        buffer = []
      }

      for (const row of customerRows) {
        if (buffer.length > 0) {
          const previous = buffer[buffer.length - 1]
          const gapMs = new Date(row.created_at).getTime() - new Date(previous.created_at).getTime()
          if (gapMs > config.threadGapMinutes * 60000) {
            flush()
          }
        }
        buffer.push(row)
      }
      flush()
    }

    return threads.sort(
      (left, right) => new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime()
    )
  }

  private createThreadSnapshot(
    rows: RawInteractionRow[],
    maxMessagesPerThread: number
  ): DMConversationThreadSnapshot {
    const keepHead = Math.ceil(maxMessagesPerThread / 3)
    const trimmedRows =
      rows.length > maxMessagesPerThread
        ? [...rows.slice(0, keepHead), ...rows.slice(-(maxMessagesPerThread - keepHead))]
        : rows
    const first = trimmedRows[0]
    const last = trimmedRows[trimmedRows.length - 1]
    const conversationId = this.lookupConversationId(first.channel, first.customer_id)
    const messages: DMConversationThreadMessage[] = trimmedRows.map(row => ({
      id: row.id,
      direction: row.direction,
      text:
        row.direction === 'outbound'
          ? row.ai_response || row.message_text || ''
          : row.message_text || '',
      intent: row.intent,
      sentiment: row.sentiment,
      aiResponse: row.ai_response,
      responseTimeMs: row.response_time_ms,
      modelUsed: row.model_used,
      modelTier: row.model_tier,
      pipelineTrace: safeJsonParse(row.pipeline_trace),
      pipelineError: row.pipeline_error,
      executionId: row.execution_id,
      createdAt: row.created_at,
    }))

    return {
      threadKey: `${first.channel}:${first.customer_id}:${first.created_at}`,
      channel: first.channel,
      customerId: first.customer_id,
      customerName: first.customer_name,
      conversationId,
      startedAt: first.created_at,
      endedAt: last.created_at,
      messageCount: rows.length,
      inboundCount: rows.filter(row => row.direction === 'inbound').length,
      outboundCount: rows.filter(row => row.direction === 'outbound').length,
      messages,
    }
  }

  private fetchInteractions(
    config: DMConversationReviewConfig,
    targetCustomerId: string | null = null
  ): RawInteractionRow[] {
    const cutoff = new Date(Date.now() - config.daysBack * 86400000).toISOString()
    const rows: RawInteractionRow[] = []
    if (config.channel === 'instagram' || config.channel === 'both') {
      rows.push(...this.fetchInstagramInteractions(cutoff, config.includeTestTraffic, targetCustomerId))
    }
    if (config.channel === 'whatsapp' || config.channel === 'both') {
      rows.push(...this.fetchWhatsAppInteractions(cutoff, config.includeTestTraffic, targetCustomerId))
    }
    return rows
      .filter(row => config.includeTestTraffic || !this.isTestLikeRow(row))
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
  }

  private fetchInstagramInteractions(
    cutoff: string,
    includeTestTraffic: boolean,
    targetCustomerId: string | null
  ): RawInteractionRow[] {
    const conditions = ['i.created_at >= ?']
    const params: any[] = [cutoff]
    if (!includeTestTraffic) {
      conditions.push(`i.instagram_id NOT LIKE 'sim_%'`)
      conditions.push(`lower(COALESCE(c.name, '')) NOT LIKE '%dm simulator%'`)
    }
    if (targetCustomerId) {
      conditions.push('i.instagram_id = ?')
      params.push(targetCustomerId)
    }

    return this.db
      .prepare(
        `
      SELECT
        i.id,
        i.instagram_id AS customer_id,
        'instagram' AS channel,
        c.name AS customer_name,
        i.direction,
        i.message_text,
        i.intent,
        i.sentiment,
        i.ai_response,
        i.response_time_ms,
        i.model_used,
        i.model_tier,
        i.pipeline_trace,
        i.pipeline_error,
        i.execution_id,
        i.created_at
      FROM instagram_interactions i
      LEFT JOIN instagram_customers c ON c.instagram_id = i.instagram_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.created_at ASC
    `
      )
      .all(...params) as RawInteractionRow[]
  }

  private fetchWhatsAppInteractions(
    cutoff: string,
    includeTestTraffic: boolean,
    targetCustomerId: string | null
  ): RawInteractionRow[] {
    const conditions = ['w.created_at >= ?']
    const params: any[] = [cutoff]
    if (!includeTestTraffic) {
      conditions.push(`w.phone NOT LIKE 'sim_%'`)
    }
    if (targetCustomerId) {
      conditions.push('w.phone = ?')
      params.push(targetCustomerId)
    }

    return this.db
      .prepare(
        `
      SELECT
        w.id,
        w.phone AS customer_id,
        'whatsapp' AS channel,
        NULL AS customer_name,
        w.direction,
        w.message_text,
        w.intent,
        w.sentiment,
        w.ai_response,
        w.response_time_ms,
        w.model_used,
        w.model_tier,
        w.pipeline_trace,
        w.pipeline_error,
        w.execution_id,
        w.created_at
      FROM whatsapp_interactions w
      WHERE ${conditions.join(' AND ')}
      ORDER BY w.created_at ASC
    `
      )
      .all(...params) as RawInteractionRow[]
  }

  private isTestLikeRow(row: RawInteractionRow): boolean {
    const customerId = normalizeTemplateText(row.customer_id)
    const customerName = normalizeTemplateText(row.customer_name || '')
    return (
      TEST_LIKE_CUSTOMER_IDS.has(customerId) ||
      customerId.startsWith('test') ||
      customerName.includes('simulator') ||
      customerName.includes('test hesabi')
    )
  }

  private buildKnowledgeBaseText(): string {
    const rows = this.db
      .prepare(
        `
      SELECT category, key_name, value
      FROM knowledge_base
      WHERE is_active = 1
      ORDER BY category, key_name
    `
      )
      .all() as KnowledgeBaseRow[]
    const grouped = new Map<string, string[]>()
    for (const row of rows) {
      if (!grouped.has(row.category)) {
        grouped.set(row.category, [])
      }
      grouped.get(row.category)!.push(`${row.key_name}: ${row.value}`)
    }
    return Array.from(grouped.entries())
      .map(([category, entries]) => `[${category}]\n${entries.join('\n')}`)
      .join('\n\n')
  }

  private async reviewThread(
    snapshot: DMConversationThreadSnapshot,
    kbText: string,
    config: DMConversationReviewConfig
  ): Promise<ThreadReviewContext> {
    const deterministicMetrics = this.buildDeterministicMetrics(snapshot)
    const groundingResults = await this.auditThreadGrounding(snapshot, kbText)
    const groundingSummary = this.summarizeGroundingResults(groundingResults)
    const reviewResult = await this.reviewThreadWithLLM(
      snapshot,
      deterministicMetrics,
      groundingSummary,
      config
    )
    const review = reviewResult.review

    if (
      groundingSummary.hallucinatedResponses > 0 &&
      !review.flags.includes('hallucination_suspected')
    ) {
      review.flags.push('hallucination_suspected')
    }
    if (
      deterministicMetrics.closeoutFollowups > 0 &&
      !review.flags.includes('over_talking_after_closeout')
    ) {
      review.flags.push('over_talking_after_closeout')
    }
    if (
      deterministicMetrics.repeatedResponseCount > 0 &&
      !review.flags.includes('repetitive_reply')
    ) {
      review.flags.push('repetitive_reply')
    }
    if (deterministicMetrics.hasSlowSimpleTurn && !review.flags.includes('slow_simple_turn')) {
      review.flags.push('slow_simple_turn')
    }
    review.flags = dedupeStrings(review.flags)

    if (review.conversationOutcome === 'unknown') {
      review.conversationOutcome = deterministicMetrics.heuristicOutcome
    }
    if (!review.primaryNeed) {
      review.primaryNeed = this.detectPrimaryNeed(snapshot)
    }

    return {
      snapshot,
      deterministicMetrics,
      groundingSummary,
      review,
      usage: addUsageMetrics(reviewResult.usage, groundingResults.usage),
    }
  }

  private buildDeterministicMetrics(
    snapshot: DMConversationThreadSnapshot
  ): ThreadDeterministicMetrics {
    const outbound = snapshot.messages.filter(message => message.direction === 'outbound')
    const responseTimes = outbound
      .map(message => (typeof message.responseTimeMs === 'number' ? message.responseTimeMs : null))
      .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)

    const repeatedFingerprints = new Map<string, { count: number; text: string }>()
    let repeatedGreetingCount = 0
    let repeatedCtaCount = 0
    let closeoutFollowups = 0
    let unresolvedQuestionCount = 0
    let hasSlowSimpleTurn = false
    let pipelineErrorCount = 0
    let policyCorrectionCount = 0
    let policyFallbackCount = 0

    for (const message of outbound) {
      const normalized = normalizeFingerprintText(message.text)
      if (normalized) {
        const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 12)
        const existing = repeatedFingerprints.get(hash)
        repeatedFingerprints.set(hash, {
          count: (existing?.count || 0) + 1,
          text: existing?.text || message.text.trim(),
        })
      }

      if (GREETING_PATTERN.test(normalizeTemplateText(message.text))) {
        repeatedGreetingCount += 1
      }
      if (CTA_PATTERN.test(normalizeTemplateText(message.text))) {
        repeatedCtaCount += 1
      }
      if (message.pipelineError) {
        pipelineErrorCount += 1
      }

      const policyTrace = safeJsonParseFromUnknown(message.pipelineTrace?.policyValidation)
      const attempts = Number(policyTrace?.attempts || 0)
      if (attempts > 1 || policyTrace?.status === 'corrected') {
        policyCorrectionCount += 1
      }
      if (policyTrace?.finalAction === 'fallback' || policyTrace?.status === 'fallback') {
        policyFallbackCount += 1
      }
    }

    for (let index = 0; index < snapshot.messages.length; index += 1) {
      const current = snapshot.messages[index]
      if (current.direction !== 'inbound') {
        continue
      }

      const nextOutbound =
        snapshot.messages.slice(index + 1).find(message => message.direction === 'outbound') || null
      if (isStandaloneCloseoutMessage(current.text) && nextOutbound) {
        closeoutFollowups += 1
      }

      const normalizedInbound = normalizeTemplateText(current.text)
      const looksQuestionLike = QUESTION_PATTERN.test(normalizedInbound) || Boolean(current.intent)
      if (looksQuestionLike && !nextOutbound) {
        unresolvedQuestionCount += 1
      }

      const isSimpleTurn =
        isGenericInfoRequest(current.text) ||
        isDirectLocationQuestion(current.text) ||
        isDirectPhoneQuestion(current.text) ||
        isSimpleHoursQuestion(current.text) ||
        isStandaloneCloseoutMessage(current.text)

      if (isSimpleTurn && nextOutbound?.responseTimeMs && nextOutbound.responseTimeMs > 10000) {
        hasSlowSimpleTurn = true
      }
    }

    const repeatedResponseSamples = Array.from(repeatedFingerprints.entries())
      .map(([hash, entry]) => ({ hash, text: entry.text, count: entry.count }))
      .filter(entry => entry.count > 1)
      .sort((left, right) => right.count - left.count)
      .slice(0, 8)
    const repeatedResponseCount = repeatedResponseSamples.reduce(
      (sum, sample) => sum + sample.count - 1,
      0
    )
    const avgResponseTimeMs = responseTimes.length
      ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
      : 0
    const slowestResponseTimeMs = responseTimes.length ? Math.max(...responseTimes) : 0

    const baseMetrics: ThreadDeterministicMetrics = {
      repeatedResponseCount,
      repeatedResponseSamples,
      repeatedGreetingCount,
      repeatedCtaCount,
      closeoutFollowups,
      unresolvedQuestionCount,
      hasSlowSimpleTurn,
      avgResponseTimeMs,
      slowestResponseTimeMs,
      pipelineErrorCount,
      policyCorrectionCount,
      policyFallbackCount,
      lastMessageDirection: snapshot.messages[snapshot.messages.length - 1]?.direction || null,
      heuristicOutcome: 'unknown',
    }
    baseMetrics.heuristicOutcome = this.inferHeuristicOutcome(snapshot, baseMetrics)
    return baseMetrics
  }

  private inferHeuristicOutcome(
    snapshot: DMConversationThreadSnapshot,
    metrics: ThreadDeterministicMetrics
  ): ConversationOutcome {
    const outboundTexts = snapshot.messages
      .filter(message => message.direction === 'outbound')
      .map(message => normalizeTemplateText(message.text))
    const conductState = snapshot.messages
      .map(message => safeJsonParseFromUnknown(message.pipelineTrace?.conductControl))
      .find(Boolean)?.state

    if (
      conductState === 'silent' ||
      outboundTexts.some(text => text.includes('boyle bir hizmet yok'))
    ) {
      return 'blocked'
    }
    if (metrics.closeoutFollowups > 0) {
      return 'conversation_over_bot_continued'
    }
    if (metrics.unresolvedQuestionCount > 0) {
      return metrics.pipelineErrorCount > 0 ? 'unresolved' : 'partially_resolved'
    }
    if (metrics.policyFallbackCount > 0 || metrics.pipelineErrorCount > 0) {
      return 'partially_resolved'
    }
    if (snapshot.outboundCount === 0) {
      return 'unresolved'
    }
    if (snapshot.messages[snapshot.messages.length - 1]?.direction === 'inbound') {
      return 'partially_resolved'
    }
    return 'resolved'
  }

  private async auditThreadGrounding(
    snapshot: DMConversationThreadSnapshot,
    kbText: string
  ): Promise<{ results: DMGroundingAuditResult[]; usage: UsageMetrics }> {
    let usage = ZERO_USAGE_METRICS
    const results: DMGroundingAuditResult[] = []

    for (const message of snapshot.messages) {
      if (message.direction !== 'outbound') {
        continue
      }

      const modelId = (message.modelUsed || '').toLowerCase()
      if (!message.text || modelId.startsWith('deterministic/') || modelId.startsWith('cache/')) {
        continue
      }

      const result = await this.groundingAudit.auditResponse(
        {
          interactionId: message.id,
          customerId: snapshot.customerId,
          channel: snapshot.channel,
          customerMessage: this.findPreviousInboundText(snapshot, message.id),
          aiResponse: message.text,
          modelUsed: message.modelUsed,
          modelTier: message.modelTier,
        },
        kbText,
        this.getGroundingOptions()
      )

      results.push(result)
      usage = addUsageMetrics(usage, result.usage)
    }

    return { results, usage }
  }

  private summarizeGroundingResults(results: {
    results: DMGroundingAuditResult[]
    usage: UsageMetrics
  }): ThreadGroundingSummary {
    const auditedResponses = results.results.filter(result => !result.skipped).length
    const hallucinatedResponses = results.results.filter(
      result => !result.skipped && result.score === 'hallucinated'
    ).length
    const partiallyGroundedResponses = results.results.filter(
      result => !result.skipped && result.score === 'partially_grounded'
    ).length
    const issues = results.results
      .filter(result => !result.skipped && result.ungroundedClaims.length > 0)
      .map(result => ({
        interactionId: result.interactionId,
        score: result.score,
        claims: result.ungroundedClaims.map(claim => ({
          claim: claim.claim,
          issueType: claim.issueType,
          reason: claim.reason,
        })),
      }))

    return {
      auditedResponses,
      hallucinatedResponses,
      partiallyGroundedResponses,
      issues,
    }
  }

  private async reviewThreadWithLLM(
    snapshot: DMConversationThreadSnapshot,
    deterministicMetrics: ThreadDeterministicMetrics,
    groundingSummary: ThreadGroundingSummary,
    config: DMConversationReviewConfig
  ): Promise<{ review: ThreadLLMReview; usage: UsageMetrics }> {
    const fallback = this.buildHeuristicReview(snapshot, deterministicMetrics, groundingSummary)
    const apiKey = process.env.OPENROUTER_API_KEY || ''
    if (!apiKey) {
      return { review: fallback, usage: ZERO_USAGE_METRICS }
    }

    const prompt = this.buildThreadReviewPrompt(
      snapshot,
      deterministicMetrics,
      groundingSummary,
      config
    )
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'KIO DM Conversation Review',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(45000),
      })

      if (!response.ok) {
        return { review: fallback, usage: ZERO_USAGE_METRICS }
      }

      const data = (await response.json()) as ReviewUsageEnvelope & {
        choices?: Array<{ message?: { content?: string | null } }>
      }
      const content = data.choices?.[0]?.message?.content?.trim() || ''
      const cleaned = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()
      const parsed = safeJsonParse(cleaned) || {}
      return {
        review: this.mergeReviewWithFallback(parsed, fallback),
        usage: extractUsageMetrics(data, prompt, content),
      }
    } catch {
      return { review: fallback, usage: ZERO_USAGE_METRICS }
    }
  }

  private buildThreadReviewPrompt(
    snapshot: DMConversationThreadSnapshot,
    deterministicMetrics: ThreadDeterministicMetrics,
    groundingSummary: ThreadGroundingSummary,
    config: DMConversationReviewConfig
  ): string {
    const transcript = snapshot.messages
      .map(message => {
        const role = message.direction === 'inbound' ? 'Customer' : 'Assistant'
        const meta = []
        if (message.intent) meta.push(`intent=${message.intent}`)
        if (message.modelUsed) meta.push(`model=${message.modelUsed}`)
        if (message.responseTimeMs) meta.push(`rt=${message.responseTimeMs}ms`)
        return `- [${role}] ${message.text}${meta.length ? ` (${meta.join(', ')})` : ''}`
      })
      .join('\n')

    return renderPromptTemplate(config.threadReviewPromptTemplate, {
      allowedStatuses: 'strong, mixed, weak, critical',
      allowedOutcomes:
        'resolved, partially_resolved, unresolved, conversation_over_bot_continued, blocked, unknown',
      allowedFlags:
        'repetitive_reply, over_talking_after_closeout, hallucination_suspected, missed_customer_need, weak_clarifier, slow_simple_turn, conduct_mishandled',
      threadMetaJson: JSON.stringify(
        {
          threadKey: snapshot.threadKey,
          channel: snapshot.channel,
          customerId: snapshot.customerId,
          customerName: snapshot.customerName,
          conversationId: snapshot.conversationId,
          startedAt: snapshot.startedAt,
          endedAt: snapshot.endedAt,
          messageCount: snapshot.messageCount,
        },
        null,
        2
      ),
      transcript,
      deterministicMetricsJson: JSON.stringify(deterministicMetrics, null, 2),
      groundingSummaryJson: JSON.stringify(groundingSummary, null, 2),
      threadReviewSchemaJson: THREAD_REVIEW_SCHEMA_JSON,
    })
  }

  private buildRunSummaryPrompt(
    runAggregate: Record<string, unknown>,
    config: DMConversationReviewConfig
  ): string {
    return renderPromptTemplate(config.runSummaryPromptTemplate, {
      runAggregateJson: JSON.stringify(runAggregate, null, 2),
      runSummarySchemaJson: RUN_SUMMARY_SCHEMA_JSON,
    })
  }

  private selectPromptPreviewThread(
    config: DMConversationReviewConfig,
    targetCustomerId: string | null
  ): DMConversationThreadSnapshot | null {
    const previewConfig: DMConversationReviewConfig = {
      ...config,
      minMessagesPerThread: 1,
      maxThreadsPerRun: 1,
    }
    return this.buildThreads(previewConfig, targetCustomerId)[0] || null
  }

  private buildSamplePromptThread(
    config: DMConversationReviewConfig,
    targetCustomerId: string | null
  ): DMConversationThreadSnapshot {
    const channel = config.channel === 'both' ? 'instagram' : config.channel
    const customerId =
      targetCustomerId || (channel === 'whatsapp' ? '+905551112233' : '17841400000000000')
    const customerName = channel === 'instagram' ? '@ornek_musteri' : null
    return {
      threadKey: `preview:${channel}:${customerId}`,
      channel,
      customerId,
      customerName,
      conversationId: null,
      startedAt: new Date(Date.now() - 600000).toISOString(),
      endedAt: new Date(Date.now() - 120000).toISOString(),
      messageCount: 4,
      inboundCount: 2,
      outboundCount: 2,
      messages: [
        {
          id: 'preview-1',
          direction: 'inbound',
          text:
            channel === 'whatsapp'
              ? 'Adresinizi paylasir misiniz?'
              : 'Iskenderunun neresindesiniz?',
          intent: 'contact',
          sentiment: null,
          aiResponse: null,
          responseTimeMs: null,
          modelUsed: null,
          modelTier: null,
          pipelineTrace: null,
          pipelineError: null,
          executionId: null,
          createdAt: new Date(Date.now() - 600000).toISOString(),
        },
        {
          id: 'preview-2',
          direction: 'outbound',
          text: 'Tesisimiz Prime Mall AVM yani tarafindadir.',
          intent: null,
          sentiment: null,
          aiResponse: 'Tesisimiz Prime Mall AVM yani tarafindadir.',
          responseTimeMs: 420,
          modelUsed: 'deterministic/contact-location-v1',
          modelTier: 'deterministic',
          pipelineTrace: { fastLane: { used: true, kind: 'deterministic_contact_location' } },
          pipelineError: null,
          executionId: 'EXE-preview-1',
          createdAt: new Date(Date.now() - 598000).toISOString(),
        },
        {
          id: 'preview-3',
          direction: 'inbound',
          text: 'Tesekkurler, tamamdir.',
          intent: 'closeout',
          sentiment: 'positive',
          aiResponse: null,
          responseTimeMs: null,
          modelUsed: null,
          modelTier: null,
          pipelineTrace: null,
          pipelineError: null,
          executionId: null,
          createdAt: new Date(Date.now() - 180000).toISOString(),
        },
        {
          id: 'preview-4',
          direction: 'outbound',
          text: 'Rica ederiz.',
          intent: null,
          sentiment: null,
          aiResponse: 'Rica ederiz.',
          responseTimeMs: 55,
          modelUsed: 'deterministic/closeout-v1',
          modelTier: 'deterministic',
          pipelineTrace: { fastLane: { used: true, kind: 'deterministic_closeout' } },
          pipelineError: null,
          executionId: 'EXE-preview-2',
          createdAt: new Date(Date.now() - 120000).toISOString(),
        },
      ],
    }
  }

  private buildPreviewGroundingSummary(
    snapshot: DMConversationThreadSnapshot
  ): ThreadGroundingSummary {
    return {
      auditedResponses: snapshot.outboundCount,
      hallucinatedResponses: 0,
      partiallyGroundedResponses: 0,
      issues: [],
    }
  }

  private buildPromptPreviewRunAggregate(
    snapshot: DMConversationThreadSnapshot,
    deterministicMetrics: ThreadDeterministicMetrics
  ): Record<string, unknown> {
    const primaryNeed = this.detectPrimaryNeed(snapshot)
    const flags = dedupeStrings(
      [
        deterministicMetrics.repeatedResponseCount > 0 ? 'repetitive_reply' : '',
        deterministicMetrics.closeoutFollowups > 0 ? 'over_talking_after_closeout' : '',
        deterministicMetrics.hasSlowSimpleTurn ? 'slow_simple_turn' : '',
      ].filter(Boolean)
    )

    return {
      previewMode: true,
      threads: 1,
      scoreAverages: {
        accuracy: 8,
        helpfulness: 7,
        tone: 8,
        efficiency: deterministicMetrics.hasSlowSimpleTurn ? 4 : 8,
        intentCapture: 7,
      },
      topFlags: flags,
      topNeeds: primaryNeed ? [primaryNeed] : [],
      repeatedAnswers: deterministicMetrics.repeatedResponseSamples,
      unresolvedThreads: deterministicMetrics.heuristicOutcome === 'resolved' ? 0 : 1,
      hallucinationRiskThreads: 0,
      repetitiveThreads: flags.includes('repetitive_reply') ? 1 : 0,
      sampleFindings: [
        {
          customerId: snapshot.customerId,
          channel: snapshot.channel,
          primaryNeed,
          outcome: deterministicMetrics.heuristicOutcome,
          flags,
          summary: 'Preview verisi. Gercek run oldugunda bu alan kaydedilmis finding ozetleriyle dolar.',
        },
      ],
    }
  }

  private buildHeuristicReview(
    snapshot: DMConversationThreadSnapshot,
    deterministicMetrics: ThreadDeterministicMetrics,
    groundingSummary: ThreadGroundingSummary
  ): ThreadLLMReview {
    const primaryNeed = this.detectPrimaryNeed(snapshot)
    const flags: string[] = []
    if (deterministicMetrics.repeatedResponseCount > 0) flags.push('repetitive_reply')
    if (deterministicMetrics.closeoutFollowups > 0) flags.push('over_talking_after_closeout')
    if (
      groundingSummary.hallucinatedResponses > 0 ||
      groundingSummary.partiallyGroundedResponses > 0
    )
      flags.push('hallucination_suspected')
    if (deterministicMetrics.unresolvedQuestionCount > 0) flags.push('missed_customer_need')
    if (deterministicMetrics.hasSlowSimpleTurn) flags.push('slow_simple_turn')
    if (
      deterministicMetrics.policyCorrectionCount > 0 &&
      deterministicMetrics.avgResponseTimeMs > 10000
    )
      flags.push('weak_clarifier')

    const accuracy = clampScore(
      9 -
        groundingSummary.hallucinatedResponses * 3 -
        groundingSummary.partiallyGroundedResponses * 2 -
        deterministicMetrics.policyFallbackCount -
        deterministicMetrics.pipelineErrorCount
    )
    const helpfulness = clampScore(
      8 -
        deterministicMetrics.unresolvedQuestionCount * 2 -
        deterministicMetrics.policyFallbackCount -
        (deterministicMetrics.closeoutFollowups > 0 ? 2 : 0)
    )
    const tone = clampScore(
      8 -
        deterministicMetrics.repeatedGreetingCount -
        deterministicMetrics.closeoutFollowups * 2 -
        deterministicMetrics.repeatedCtaCount
    )
    const efficiency = clampScore(
      9 -
        (deterministicMetrics.hasSlowSimpleTurn ? 3 : 0) -
        (deterministicMetrics.avgResponseTimeMs > 12000 ? 2 : 0) -
        deterministicMetrics.repeatedResponseCount
    )
    const intentCapture = clampScore(
      8 -
        deterministicMetrics.unresolvedQuestionCount * 2 -
        (primaryNeed === 'Belirsiz ihtiyac' ? 2 : 0)
    )
    const overallScore = averageScore([accuracy, helpfulness, tone, efficiency, intentCapture])
    const overallStatus: FindingStatus =
      overallScore >= 8
        ? 'strong'
        : overallScore >= 6
          ? 'mixed'
          : overallScore >= 4
            ? 'weak'
            : 'critical'
    const conversationOutcome = deterministicMetrics.heuristicOutcome

    return {
      scores: { accuracy, helpfulness, tone, efficiency, intentCapture },
      overallStatus,
      flags: dedupeStrings(flags),
      primaryNeed,
      secondaryNeeds: normalizeStringArray(this.detectSecondaryNeeds(snapshot)),
      unresolvedNeeds:
        conversationOutcome === 'resolved'
          ? []
          : [`"${primaryNeed}" ihtiyaci tam olarak kapanmamis olabilir.`],
      customerMood: this.detectCustomerMood(snapshot),
      conversationOutcome,
      summary: this.buildHeuristicSummary(
        primaryNeed,
        conversationOutcome,
        flags,
        deterministicMetrics,
        groundingSummary
      ),
      suggestions: {
        pipeline: dedupeStrings(
          [
            deterministicMetrics.closeoutFollowups > 0
              ? 'Karsilikli kapanis mesajlari yeni bir ihtiyac yoksa yeniden yanit uretmemeli.'
              : '',
            deterministicMetrics.hasSlowSimpleTurn
              ? 'Basit konum, telefon, saat ve genel bilgi sorularini daha erken deterministic veya cache-first yola al.'
              : '',
            deterministicMetrics.policyCorrectionCount > 0
              ? 'Gec duzeltilen zayif clarifier durumlari icin planner ve direct response davranisini gozden gecir.'
              : '',
          ].filter(Boolean)
        ),
        knowledgeBase: dedupeStrings(
          [
            groundingSummary.hallucinatedResponses > 0
              ? 'Halusinasyon riski tasiyan iddialar icin bilgi bankasi kayitlarini genislet veya netlestir.'
              : '',
            groundingSummary.partiallyGroundedResponses > 0
              ? 'Kismen dogrulanan cevaplar icin daha net FAQ veya fiyat satirlari ekle.'
              : '',
          ].filter(Boolean)
        ),
        tone: dedupeStrings(
          [
            deterministicMetrics.repeatedResponseCount > 0
              ? 'Kisa takip mesajlarinda tekrar eden kapanis ve CTA dilini azalt.'
              : '',
            deterministicMetrics.closeoutFollowups > 0
              ? '"Size de" gibi karsilikli kapanislara yeni soru yoksa yanit verme.'
              : '',
          ].filter(Boolean)
        ),
      },
      evidence: dedupeStrings(
        [
          deterministicMetrics.repeatedResponseCount > 0
            ? `${deterministicMetrics.repeatedResponseCount} tekrar eden giden yanit tespit edildi.`
            : '',
          deterministicMetrics.closeoutFollowups > 0
            ? `${deterministicMetrics.closeoutFollowups} kez musteri kapanisindan sonra yanit devam etti.`
            : '',
          deterministicMetrics.hasSlowSimpleTurn
            ? 'En az bir basit tur 10 saniyeden uzun surdu.'
            : '',
          groundingSummary.hallucinatedResponses > 0
            ? `${groundingSummary.hallucinatedResponses} yanitta halusinasyon riski bulundu.`
            : '',
          groundingSummary.partiallyGroundedResponses > 0
            ? `${groundingSummary.partiallyGroundedResponses} yanit sadece kismen dogrulandi.`
            : '',
          deterministicMetrics.policyCorrectionCount > 0
            ? `${deterministicMetrics.policyCorrectionCount} yanit policy duzeltmesi gerektirdi.`
            : '',
        ].filter(Boolean)
      ),
    }
  }

  private mergeReviewWithFallback(
    parsed: Record<string, any>,
    fallback: ThreadLLMReview
  ): ThreadLLMReview {
    return {
      scores: {
        accuracy: clampScore(parsed?.scores?.accuracy ?? fallback.scores.accuracy),
        helpfulness: clampScore(parsed?.scores?.helpfulness ?? fallback.scores.helpfulness),
        tone: clampScore(parsed?.scores?.tone ?? fallback.scores.tone),
        efficiency: clampScore(parsed?.scores?.efficiency ?? fallback.scores.efficiency),
        intentCapture: clampScore(parsed?.scores?.intentCapture ?? fallback.scores.intentCapture),
      },
      overallStatus: normalizeFindingStatus(parsed?.overallStatus ?? fallback.overallStatus),
      flags: dedupeStrings(normalizeStringArray(parsed?.flags).concat(fallback.flags)),
      primaryNeed: String(parsed?.primaryNeed || fallback.primaryNeed || ''),
      secondaryNeeds: dedupeStrings(
        normalizeStringArray(parsed?.secondaryNeeds).concat(fallback.secondaryNeeds)
      ),
      unresolvedNeeds: dedupeStrings(
        normalizeStringArray(parsed?.unresolvedNeeds).concat(fallback.unresolvedNeeds)
      ),
      customerMood: String(parsed?.customerMood || fallback.customerMood || 'neutral'),
      conversationOutcome: normalizeConversationOutcome(
        parsed?.conversationOutcome ?? fallback.conversationOutcome
      ),
      summary: String(parsed?.summary || fallback.summary || ''),
      suggestions: {
        pipeline: dedupeStrings(
          normalizeStringArray(parsed?.suggestions?.pipeline).concat(fallback.suggestions.pipeline)
        ),
        knowledgeBase: dedupeStrings(
          normalizeStringArray(parsed?.suggestions?.knowledgeBase).concat(
            fallback.suggestions.knowledgeBase
          )
        ),
        tone: dedupeStrings(
          normalizeStringArray(parsed?.suggestions?.tone).concat(fallback.suggestions.tone)
        ),
      },
      evidence: dedupeStrings(normalizeStringArray(parsed?.evidence).concat(fallback.evidence)),
    }
  }

  private async buildRunSummary(
    runId: string,
    contexts: ThreadReviewContext[],
    config: DMConversationReviewConfig,
    usage: UsageMetrics
  ): Promise<Record<string, unknown>> {
    const scoreAverages = {
      accuracy: averageScore(contexts.map(context => context.review.scores.accuracy)),
      helpfulness: averageScore(contexts.map(context => context.review.scores.helpfulness)),
      tone: averageScore(contexts.map(context => context.review.scores.tone)),
      efficiency: averageScore(contexts.map(context => context.review.scores.efficiency)),
      intentCapture: averageScore(contexts.map(context => context.review.scores.intentCapture)),
    }
    const allFlags = contexts.flatMap(context => context.review.flags)
    const primaryNeeds = contexts.map(context => context.review.primaryNeed).filter(Boolean)
    const heuristicSummary = {
      runId,
      summary: this.buildRunSummaryText(contexts, scoreAverages, allFlags, primaryNeeds),
      scoreAverages,
      topFlags: Object.entries(countLabels(allFlags))
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([flag]) => flag),
      topNeeds: Object.entries(countLabels(primaryNeeds))
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([need]) => need),
      repeatedAnswers: countFingerprintSamples(
        contexts.flatMap(context => context.deterministicMetrics.repeatedResponseSamples)
      ).slice(0, 8),
      unresolvedThreads: contexts.filter(
        context => context.review.conversationOutcome !== 'resolved'
      ).length,
      hallucinationRiskThreads: contexts.filter(
        context => context.groundingSummary.hallucinatedResponses > 0
      ).length,
      repetitiveThreads: contexts.filter(context =>
        context.review.flags.includes('repetitive_reply')
      ).length,
      recommendations: dedupeStrings(
        [
          contexts.some(context => context.review.flags.includes('over_talking_after_closeout'))
            ? 'Tighten no-send logic after reciprocal closeouts.'
            : '',
          contexts.some(context => context.review.flags.includes('slow_simple_turn'))
            ? 'Push more simple turns into deterministic or cache-first paths.'
            : '',
          contexts.some(context => context.review.flags.includes('hallucination_suspected'))
            ? 'Use review findings to strengthen KB coverage and grounding.'
            : '',
        ].filter(Boolean)
      ),
      model: config.model,
      usage,
    }

    const apiKey = process.env.OPENROUTER_API_KEY || ''
    if (!apiKey || contexts.length === 0) {
      return heuristicSummary
    }

    const synthesisPrompt = this.buildRunSummaryPrompt(
      {
        threads: contexts.length,
        scoreAverages,
        topFlags: heuristicSummary.topFlags,
        topNeeds: heuristicSummary.topNeeds,
        repeatedAnswers: heuristicSummary.repeatedAnswers,
        unresolvedThreads: heuristicSummary.unresolvedThreads,
        hallucinationRiskThreads: heuristicSummary.hallucinationRiskThreads,
        repetitiveThreads: heuristicSummary.repetitiveThreads,
        sampleFindings: contexts.slice(0, 12).map(context => ({
          customerId: context.snapshot.customerId,
          primaryNeed: context.review.primaryNeed,
          outcome: context.review.conversationOutcome,
          flags: context.review.flags,
          summary: context.review.summary,
        })),
      },
      config
    )

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'KIO DM Review Summary',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.1,
          max_tokens: 900,
          messages: [{ role: 'user', content: synthesisPrompt }],
        }),
        signal: AbortSignal.timeout(45000),
      })
      if (!response.ok) {
        return heuristicSummary
      }

      const data = (await response.json()) as ReviewUsageEnvelope & {
        choices?: Array<{ message?: { content?: string | null } }>
      }
      const content = data.choices?.[0]?.message?.content?.trim() || ''
      const cleaned = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim()
      const parsed = safeJsonParse(cleaned) || {}
      return {
        ...heuristicSummary,
        summary: String(parsed?.summary || heuristicSummary.summary),
        topFlags: selectSummaryArray(parsed?.topFlags, heuristicSummary.topFlags),
        topNeeds: selectSummaryArray(parsed?.topNeeds, heuristicSummary.topNeeds),
        recommendations: dedupeStrings(
          normalizeStringArray(parsed?.recommendations).concat(
            normalizeStringArray(heuristicSummary.recommendations)
          )
        ),
        usage: addUsageMetrics(usage, extractUsageMetrics(data, synthesisPrompt, content)),
      }
    } catch {
      return heuristicSummary
    }
  }

  private persistFinding(runId: string, context: ThreadReviewContext): void {
    const overallScore = averageScore(Object.values(context.review.scores))
    const now = new Date().toISOString()
    this.db
      .prepare(
        `
      INSERT INTO dm_review_findings (
        id, run_id, channel, customer_id, customer_name, conversation_id,
        thread_key, thread_started_at, thread_ended_at, message_count,
        transcript_json, metrics_json, grounding_json, review_json,
        overall_score, overall_status, primary_need, flags_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        randomUUID(),
        runId,
        context.snapshot.channel,
        context.snapshot.customerId,
        context.snapshot.customerName,
        context.snapshot.conversationId,
        context.snapshot.threadKey,
        context.snapshot.startedAt,
        context.snapshot.endedAt,
        context.snapshot.messageCount,
        JSON.stringify(context.snapshot),
        JSON.stringify(context.deterministicMetrics),
        JSON.stringify(context.groundingSummary),
        JSON.stringify(context.review),
        overallScore,
        context.review.overallStatus,
        context.review.primaryNeed,
        JSON.stringify(context.review.flags),
        now
      )
  }

  private findPreviousInboundText(
    snapshot: DMConversationThreadSnapshot,
    messageId: string
  ): string {
    const index = snapshot.messages.findIndex(message => message.id === messageId)
    if (index <= 0) {
      return ''
    }
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = snapshot.messages[cursor]
      if (candidate.direction === 'inbound') {
        return candidate.text
      }
    }
    return ''
  }

  private detectPrimaryNeed(snapshot: DMConversationThreadSnapshot): string {
    const inboundText = snapshot.messages
      .filter(message => message.direction === 'inbound')
      .map(message => normalizeTemplateText(message.text))
      .join(' ')
    if (/\b(fiyat|ucret|ne kadar|tl|lira)\b/.test(inboundText)) return 'Fiyat bilgisi'
    if (/\b(adres|konum|nerede|neresindesiniz|yer)\b/.test(inboundText)) return 'Konum bilgisi'
    if (/\b(telefon|numara|iletisim|whatsapp)\b/.test(inboundText)) return 'Iletisim bilgisi'
    if (/\b(saat|acik|kapali|kaca kadar)\b/.test(inboundText)) return 'Calisma saatleri'
    if (/\b(randevu|rezervasyon|yer ayirt)\b/.test(inboundText)) return 'Randevu talebi'
    if (
      /\b(uyelik|fitness|havuz|hamam|sauna|masaj|spa|kurs|reformer|pilates|pt)\b/.test(inboundText)
    )
      return 'Hizmet bilgisi'
    if (/\b(tesekkur|sag ol|anladim|tamam)\b/.test(inboundText)) return 'Kapanis mesaji'
    return 'Belirsiz ihtiyac'
  }

  private detectSecondaryNeeds(snapshot: DMConversationThreadSnapshot): string[] {
    const joined = snapshot.messages
      .filter(message => message.direction === 'inbound')
      .map(message => normalizeTemplateText(message.text))
      .join(' ')
    const needs = []
    if (/\b(adres|konum|nerede|yer)\b/.test(joined)) needs.push('Konum bilgisi')
    if (/\b(telefon|iletisim|numara)\b/.test(joined)) needs.push('Iletisim bilgisi')
    if (/\b(saat|acik|kapali)\b/.test(joined)) needs.push('Calisma saatleri')
    if (/\b(fiyat|ucret|ne kadar|tl|lira)\b/.test(joined)) needs.push('Fiyat bilgisi')
    if (/\b(randevu|rezervasyon)\b/.test(joined)) needs.push('Randevu talebi')
    return needs
  }

  private detectCustomerMood(snapshot: DMConversationThreadSnapshot): string {
    const inbound = snapshot.messages
      .filter(message => message.direction === 'inbound')
      .map(message => normalizeTemplateText(message.text))
      .join(' ')
    if (/\b(sacma|dalga|rezalet|kotu|memnun degil)\b/.test(inbound)) return 'Olumsuz veya gerilimli'
    if (/\b(tesekkur|sag ol|harika|super)\b/.test(inbound)) return 'Olumlu ve kibar'
    if (/\b(merhaba|selam|bilgi|fiyat|adres|telefon|saat)\b/.test(inbound))
      return 'Nötr ve is odakli'
    return 'Nötr'
  }

  private buildHeuristicSummary(
    primaryNeed: string,
    outcome: ConversationOutcome,
    flags: string[],
    metrics: ThreadDeterministicMetrics,
    groundingSummary: ThreadGroundingSummary
  ): string {
    const parts = [`Ana ihtiyac "${primaryNeed}" gibi görünüyor.`]
    if (outcome !== 'resolved')
      parts.push(`Konusma sonucu "${formatConversationOutcomeLabel(outcome)}" gibi duruyor.`)
    if (flags.includes('repetitive_reply')) parts.push('Asistan yanitlarinda belirgin tekrar var.')
    if (flags.includes('over_talking_after_closeout'))
      parts.push('Musteri kapatmaya gectikten sonra bot konusmayi gereksiz uzatti.')
    if (flags.includes('hallucination_suspected'))
      parts.push('Dogrulama kontrolu bir veya daha fazla yanitta halusinasyon riski gosteriyor.')
    if (metrics.hasSlowSimpleTurn) parts.push('Basit bir tur beklenenden daha yavas kaldi.')
    if (
      groundingSummary.hallucinatedResponses === 0 &&
      groundingSummary.partiallyGroundedResponses === 0 &&
      outcome === 'resolved'
    ) {
      parts.push('Guclu bir dogrulama sorunu tespit edilmedi.')
    }
    return parts.join(' ')
  }

  private buildRunSummaryText(
    contexts: ThreadReviewContext[],
    scoreAverages: Record<string, number>,
    flags: string[],
    primaryNeeds: string[]
  ): string {
    if (contexts.length === 0) {
      return 'Secilen DM review filtrelerine uyan thread bulunamadi.'
    }
    const topFlag =
      Object.entries(countLabels(flags)).sort((left, right) => right[1] - left[1])[0]?.[0] || 'none'
    const topNeed =
      Object.entries(countLabels(primaryNeeds)).sort((left, right) => right[1] - left[1])[0]?.[0] ||
      'Belirsiz ihtiyac'
    const averageOverall = averageScore(Object.values(scoreAverages))
    return `${contexts.length} thread incelendi. Ortalama konusma kalitesi ${averageOverall.toFixed(1)}/10 seviyesinde. En sik musteri ihtiyaci "${topNeed}", en yaygin sorun ise "${formatFlagLabel(topFlag)}" oldu.`
  }

  private getGroundingOptions() {
    return {
      model: 'google/gemini-2.5-flash-lite',
      maxTokens: 900,
      temperature: 0.1,
      timeoutMs: 25000,
      title: 'KIO DM Review Grounding',
    }
  }

  private lookupConversationId(channel: string, customerId: string): string | null {
    const row = this.db
      .prepare(
        `
      SELECT id
      FROM mc_conversations
      WHERE channel = ? AND customer_id = ?
      LIMIT 1
    `
      )
      .get(channel, customerId) as { id?: string } | undefined
    return row?.id || null
  }

  private updateRun(
    runId: string,
    updates: Partial<{
      status: RunStatus
      startedAt: string | null
      completedAt: string | null
      totalThreads: number
      reviewedThreads: number
      totalCustomers: number
      totalMessages: number
      totalTokens: number
      totalCostUsd: number
      progressMessage: string | null
      error: string | null
      summary: Record<string, unknown> | null
    }>
  ): void {
    const fields: string[] = ['updated_at = ?']
    const params: any[] = [new Date().toISOString()]
    if (updates.status !== undefined) {
      fields.push('status = ?')
      params.push(updates.status)
    }
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?')
      params.push(updates.startedAt)
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?')
      params.push(updates.completedAt)
    }
    if (updates.totalThreads !== undefined) {
      fields.push('total_threads = ?')
      params.push(updates.totalThreads)
    }
    if (updates.reviewedThreads !== undefined) {
      fields.push('reviewed_threads = ?')
      params.push(updates.reviewedThreads)
    }
    if (updates.totalCustomers !== undefined) {
      fields.push('total_customers = ?')
      params.push(updates.totalCustomers)
    }
    if (updates.totalMessages !== undefined) {
      fields.push('total_messages = ?')
      params.push(updates.totalMessages)
    }
    if (updates.totalTokens !== undefined) {
      fields.push('total_tokens = ?')
      params.push(updates.totalTokens)
    }
    if (updates.totalCostUsd !== undefined) {
      fields.push('total_cost_usd = ?')
      params.push(updates.totalCostUsd)
    }
    if (updates.progressMessage !== undefined) {
      fields.push('progress_message = ?')
      params.push(updates.progressMessage)
    }
    if (updates.error !== undefined) {
      fields.push('error = ?')
      params.push(updates.error)
    }
    if (updates.summary !== undefined) {
      fields.push('summary_json = ?')
      params.push(updates.summary ? JSON.stringify(updates.summary) : null)
    }
    params.push(runId)
    this.db.prepare(`UPDATE dm_review_runs SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  }

  private mapRunRow(row: any): DMConversationReviewRun {
    return {
      id: row.id,
      status: row.status,
      channel: row.channel,
      daysBack: row.days_back,
      model: row.model,
      totalThreads: row.total_threads || 0,
      reviewedThreads: row.reviewed_threads || 0,
      totalCustomers: row.total_customers || 0,
      totalMessages: row.total_messages || 0,
      totalTokens: row.total_tokens || 0,
      totalCostUsd: row.total_cost_usd || 0,
      progressMessage: row.progress_message || null,
      error: row.error || null,
      summary: safeJsonParse(row.summary_json),
      settings: safeJsonParse(row.settings_json),
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapFindingRow(row: any): DMConversationReviewFinding {
    return {
      id: row.id,
      runId: row.run_id,
      channel: row.channel,
      customerId: row.customer_id,
      customerName: row.customer_name,
      conversationId: row.conversation_id,
      threadKey: row.thread_key,
      startedAt: row.thread_started_at,
      endedAt: row.thread_ended_at,
      messageCount: row.message_count,
      overallScore: Number(row.overall_score || 0),
      overallStatus: normalizeFindingStatus(row.overall_status),
      primaryNeed: row.primary_need || '',
      flags: normalizeStringArray(safeJsonParse(row.flags_json)),
      transcript: safeJsonParse(row.transcript_json),
      deterministicMetrics: safeJsonParse(row.metrics_json),
      groundingSummary: safeJsonParse(row.grounding_json),
      review: safeJsonParse(row.review_json),
      createdAt: row.created_at,
    }
  }

  private findForgeAgentId(): string | null {
    const row = this.db
      .prepare(
        `
      SELECT id
      FROM mc_agents
      WHERE lower(name) LIKE '%forge%' OR lower(role) LIKE '%forge%'
      LIMIT 1
    `
      )
      .get() as { id?: string } | undefined
    return row?.id || null
  }

  private emitEvent(
    entityType: string,
    entityId: string,
    eventType: string,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    this.db
      .prepare(
        `
      INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        entityType,
        entityId,
        eventType,
        message,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString()
      )
  }
}

function safeJsonParse(value: string | null | undefined): any {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function safeJsonParseFromUnknown(value: unknown): any {
  if (!value) return null
  if (typeof value === 'string') return safeJsonParse(value)
  if (typeof value === 'object') return value
  return null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim()).filter(Boolean)
}

function normalizeFindingStatus(value: unknown): FindingStatus {
  return value === 'strong' || value === 'mixed' || value === 'weak' || value === 'critical'
    ? value
    : 'mixed'
}

function normalizeConversationOutcome(value: unknown): ConversationOutcome {
  switch (value) {
    case 'resolved':
    case 'partially_resolved':
    case 'unresolved':
    case 'conversation_over_bot_continued':
    case 'blocked':
    case 'unknown':
      return value
    default:
      return 'unknown'
  }
}

function formatConversationOutcomeLabel(value: ConversationOutcome): string {
  switch (value) {
    case 'resolved':
      return 'cozuldu'
    case 'partially_resolved':
      return 'kismen cozuldu'
    case 'unresolved':
      return 'cozulmedi'
    case 'conversation_over_bot_continued':
      return 'bot gereksiz devam etti'
    case 'blocked':
      return 'engellendi'
    default:
      return 'belirsiz'
  }
}

function formatFlagLabel(value: string): string {
  switch (value) {
    case 'repetitive_reply':
      return 'tekrar eden yanit'
    case 'over_talking_after_closeout':
      return 'kapanistan sonra devam'
    case 'hallucination_suspected':
      return 'halusinasyon suphe'
    case 'missed_customer_need':
      return 'musteri ihtiyaci kacirildi'
    case 'weak_clarifier':
      return 'zayif netlestirme'
    case 'slow_simple_turn':
      return 'yavas basit tur'
    case 'conduct_mishandled':
      return 'davranis yonetimi sorunu'
    default:
      return value || 'sinyal'
  }
}

function clampScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)))
}

function averageScore(values: Array<number | string>): number {
  const normalized = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0)
  if (normalized.length === 0) return 0
  return Number((normalized.reduce((sum, value) => sum + value, 0) / normalized.length).toFixed(1))
}

function roundCost(value: number): number {
  return Number(value.toFixed(6))
}

function normalizeFingerprintText(text: string): string {
  return normalizeTemplateText(text)
    .replace(
      /\b(merhaba|selam|iyi gunler|iyi aksamlar|sevgiler|tesekkurler|rica ederiz|arayabilirsiniz)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
}

function isSimpleHoursQuestion(text: string): boolean {
  const normalized = normalizeTemplateText(text)
  return SIMPLE_HOURS_PATTERN.test(normalized)
}

function countLabels(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = String(value || '').trim()
    if (!key) return acc
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function countFingerprintSamples(
  samples: Array<{ hash: string; text: string; count: number }>
): Array<{ text: string; count: number }> {
  const map = new Map<string, number>()
  for (const sample of samples) {
    if (!sample?.text) continue
    map.set(sample.text, (map.get(sample.text) || 0) + sample.count)
  }
  return Array.from(map.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((left, right) => right.count - left.count)
}

function renderPromptTemplate(
  template: string,
  replacements: Record<string, string | number | boolean>
): string {
  let output = String(template || '')
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{{${key}}}`, String(value ?? ''))
  }
  return output
}

function isReviewChannel(value: unknown): value is ReviewChannel {
  return value === 'instagram' || value === 'whatsapp' || value === 'both'
}

function asNumber(value: unknown): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Number(Math.min(max, Math.max(min, numeric)).toFixed(2))
}

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || fallback
}

function normalizeScopeCustomerId(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

function selectSummaryArray(primary: unknown, fallback: unknown): string[] {
  const primaryItems = normalizeStringArray(primary)
  if (primaryItems.length > 0) return dedupeStrings(primaryItems)
  return dedupeStrings(normalizeStringArray(fallback))
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = String(value || '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}
