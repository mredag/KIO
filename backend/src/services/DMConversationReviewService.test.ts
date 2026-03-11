import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import {
  DMConversationReviewService,
  type DMConversationThreadSnapshot,
} from './DMConversationReviewService.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE mc_policies (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      conditions TEXT,
      actions TEXT,
      is_active INTEGER,
      priority INTEGER,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE instagram_customers (
      instagram_id TEXT PRIMARY KEY,
      name TEXT
    );
    CREATE TABLE instagram_interactions (
      id TEXT PRIMARY KEY,
      instagram_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_text TEXT NOT NULL,
      intent TEXT,
      sentiment TEXT,
      ai_response TEXT,
      response_time_ms INTEGER,
      model_used TEXT,
      model_tier TEXT,
      pipeline_trace TEXT,
      pipeline_error TEXT,
      execution_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE whatsapp_interactions (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_text TEXT NOT NULL,
      intent TEXT,
      sentiment TEXT,
      ai_response TEXT,
      response_time_ms INTEGER,
      model_used TEXT,
      model_tier TEXT,
      pipeline_trace TEXT,
      pipeline_error TEXT,
      execution_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE knowledge_base (
      id TEXT PRIMARY KEY,
      category TEXT,
      key_name TEXT,
      value TEXT,
      is_active INTEGER
    );
    CREATE TABLE dm_review_runs (
      id TEXT PRIMARY KEY,
      status TEXT,
      channel TEXT,
      days_back INTEGER,
      model TEXT,
      total_threads INTEGER,
      reviewed_threads INTEGER,
      total_customers INTEGER,
      total_messages INTEGER,
      total_tokens INTEGER,
      total_cost_usd REAL,
      progress_message TEXT,
      error TEXT,
      summary_json TEXT,
      settings_json TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE dm_review_findings (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      channel TEXT,
      customer_id TEXT,
      customer_name TEXT,
      conversation_id TEXT,
      thread_key TEXT,
      thread_started_at TEXT,
      thread_ended_at TEXT,
      message_count INTEGER,
      transcript_json TEXT,
      metrics_json TEXT,
      grounding_json TEXT,
      review_json TEXT,
      overall_score REAL,
      overall_status TEXT,
      primary_need TEXT,
      flags_json TEXT,
      created_at TEXT
    );
    CREATE TABLE mc_conversations (
      id TEXT PRIMARY KEY,
      channel TEXT,
      customer_id TEXT
    );
    CREATE TABLE mc_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT,
      entity_id TEXT,
      event_type TEXT,
      message TEXT,
      metadata TEXT,
      created_at TEXT
    );
    CREATE TABLE mc_agents (
      id TEXT PRIMARY KEY,
      name TEXT,
      role TEXT
    );
    CREATE TABLE mc_jobs (
      id TEXT PRIMARY KEY,
      title TEXT,
      source TEXT,
      priority TEXT,
      status TEXT,
      agent_id TEXT,
      payload TEXT,
      conversation_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `)
  return db
}

describe('DMConversationReviewService', () => {
  it('splits threads by inactivity gap and excludes simulator traffic by default', () => {
    const db = createTestDb()
    const service = new DMConversationReviewService(db)

    db.prepare(`INSERT INTO instagram_customers (instagram_id, name) VALUES (?, ?)`).run(
      'cust-1',
      'Real User'
    )
    db.prepare(`INSERT INTO instagram_customers (instagram_id, name) VALUES (?, ?)`).run(
      'sim_123',
      'DM Simulator'
    )

    const insert = db.prepare(`
      INSERT INTO instagram_interactions (
        id, instagram_id, direction, message_text, ai_response, response_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    insert.run('1', 'cust-1', 'inbound', 'merhaba', null, null, '2026-03-08T10:00:00.000Z')
    insert.run(
      '2',
      'cust-1',
      'outbound',
      'merhaba',
      'Merhaba, nasil yardimci olabilirim?',
      1200,
      '2026-03-08T10:00:02.000Z'
    )
    insert.run('3', 'cust-1', 'inbound', 'fiyatlar', null, null, '2026-03-08T20:30:00.000Z')
    insert.run(
      '4',
      'cust-1',
      'outbound',
      'fiyatlar',
      'Hangi hizmet icin fiyat istediniz?',
      1400,
      '2026-03-08T20:30:02.000Z'
    )
    insert.run('5', 'sim_123', 'inbound', 'test', null, null, '2026-03-08T09:00:00.000Z')
    insert.run('6', 'sim_123', 'outbound', 'test', 'test', 100, '2026-03-08T09:00:01.000Z')

    const threads = service['buildThreads'](service.getConfig()) as DMConversationThreadSnapshot[]
    expect(threads).toHaveLength(2)
    expect(threads.every(thread => thread.customerId !== 'sim_123')).toBe(true)
  })

  it('detects repeated replies, closeout followups and slow simple turns', () => {
    const db = createTestDb()
    const service = new DMConversationReviewService(db)

    const snapshot: DMConversationThreadSnapshot = {
      threadKey: 'instagram:cust-1:2026-03-08T10:00:00.000Z',
      channel: 'instagram',
      customerId: 'cust-1',
      customerName: 'Real User',
      conversationId: null,
      startedAt: '2026-03-08T10:00:00.000Z',
      endedAt: '2026-03-08T10:05:00.000Z',
      messageCount: 6,
      inboundCount: 3,
      outboundCount: 3,
      messages: [
        {
          id: '1',
          direction: 'inbound',
          text: 'saat kaca kadar aciksiniz?',
          intent: 'hours',
          sentiment: null,
          aiResponse: null,
          responseTimeMs: null,
          modelUsed: null,
          modelTier: null,
          pipelineTrace: null,
          pipelineError: null,
          executionId: null,
          createdAt: '2026-03-08T10:00:00.000Z',
        },
        {
          id: '2',
          direction: 'outbound',
          text: 'Tesisimiz 08:00-00:00 saatleri arasinda aciktir.',
          intent: null,
          sentiment: null,
          aiResponse: 'Tesisimiz 08:00-00:00 saatleri arasinda aciktir.',
          responseTimeMs: 15001,
          modelUsed: 'openai/gpt-4.1-mini',
          modelTier: 'light',
          pipelineTrace: { policyValidation: { attempts: 2, status: 'corrected' } },
          pipelineError: null,
          executionId: 'EXE-1',
          createdAt: '2026-03-08T10:00:15.000Z',
        },
        {
          id: '3',
          direction: 'inbound',
          text: 'size de',
          intent: null,
          sentiment: null,
          aiResponse: null,
          responseTimeMs: null,
          modelUsed: null,
          modelTier: null,
          pipelineTrace: null,
          pipelineError: null,
          executionId: null,
          createdAt: '2026-03-08T10:01:00.000Z',
        },
        {
          id: '4',
          direction: 'outbound',
          text: 'Anladim, iyi gunler dilerim.',
          intent: null,
          sentiment: null,
          aiResponse: 'Anladim, iyi gunler dilerim.',
          responseTimeMs: 600,
          modelUsed: 'openai/gpt-4.1-mini',
          modelTier: 'light',
          pipelineTrace: null,
          pipelineError: null,
          executionId: 'EXE-2',
          createdAt: '2026-03-08T10:01:01.000Z',
        },
        {
          id: '5',
          direction: 'inbound',
          text: 'tamam',
          intent: null,
          sentiment: null,
          aiResponse: null,
          responseTimeMs: null,
          modelUsed: null,
          modelTier: null,
          pipelineTrace: null,
          pipelineError: null,
          executionId: null,
          createdAt: '2026-03-08T10:02:00.000Z',
        },
        {
          id: '6',
          direction: 'outbound',
          text: 'Anladim, iyi gunler dilerim.',
          intent: null,
          sentiment: null,
          aiResponse: 'Anladim, iyi gunler dilerim.',
          responseTimeMs: 500,
          modelUsed: 'openai/gpt-4.1-mini',
          modelTier: 'light',
          pipelineTrace: null,
          pipelineError: null,
          executionId: 'EXE-3',
          createdAt: '2026-03-08T10:02:01.000Z',
        },
      ],
    }

    const metrics = service['buildDeterministicMetrics'](snapshot)
    expect(metrics.repeatedResponseCount).toBeGreaterThan(0)
    expect(metrics.closeoutFollowups).toBeGreaterThan(0)
    expect(metrics.hasSlowSimpleTurn).toBe(true)
    expect(metrics.policyCorrectionCount).toBe(1)
  })

  it('filters findings by partial customer id or handle', () => {
    const db = createTestDb()
    const service = new DMConversationReviewService(db)

    db.prepare(
      `
      INSERT INTO dm_review_runs (
        id, status, channel, days_back, model, total_threads, reviewed_threads,
        total_customers, total_messages, total_tokens, total_cost_usd, progress_message,
        error, summary_json, settings_json, started_at, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, 2, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
    `
    ).run(
      'run-1',
      'completed',
      'instagram',
      7,
      'openai/gpt-4.1',
      '2026-03-10T00:00:00.000Z',
      '2026-03-10T00:00:00.000Z'
    )

    db.prepare(
      `
      INSERT INTO dm_review_findings (
        id, run_id, channel, customer_id, customer_name, conversation_id,
        thread_key, thread_started_at, thread_ended_at, message_count,
        transcript_json, metrics_json, grounding_json, review_json,
        overall_score, overall_status, primary_need, flags_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      'finding-1',
      'run-1',
      'instagram',
      '1452244026404093',
      'ridvan_mintac36',
      null,
      'instagram:1452244026404093:2026-03-10T00:00:00.000Z',
      '2026-03-10T00:00:00.000Z',
      '2026-03-10T00:10:00.000Z',
      2,
      JSON.stringify({ messages: [] }),
      JSON.stringify({}),
      JSON.stringify({}),
      JSON.stringify({
        scores: { accuracy: 7, helpfulness: 7, tone: 7, efficiency: 7, intentCapture: 7 },
        overallStatus: 'mixed',
        flags: ['repetitive_reply'],
        primaryNeed: 'Hizmet bilgisi',
        secondaryNeeds: [],
        unresolvedNeeds: [],
        customerMood: 'Nötr',
        conversationOutcome: 'partially_resolved',
        summary: 'Test summary',
        suggestions: { pipeline: [], knowledgeBase: [], tone: [] },
        evidence: [],
      }),
      7,
      'mixed',
      'Hizmet bilgisi',
      JSON.stringify(['repetitive_reply']),
      '2026-03-10T00:10:00.000Z'
    )

    expect(service.listFindings('run-1', { customerId: '145224' })).toHaveLength(1)
    expect(service.listFindings('run-1', { customerId: 'ridvan' })).toHaveLength(1)
  })

  it('can scope thread collection to one instagram or whatsapp customer', () => {
    const db = createTestDb()
    const service = new DMConversationReviewService(db)

    db.prepare(`INSERT INTO instagram_customers (instagram_id, name) VALUES (?, ?)`).run(
      'ig-1',
      'Instagram User'
    )
    db.prepare(`INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      'ig-in-1',
      'ig-1',
      'inbound',
      'merhaba',
      '2026-03-09T10:00:00.000Z'
    )
    db.prepare(`INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, ai_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'ig-out-1',
      'ig-1',
      'outbound',
      'Merhaba',
      'Merhaba, nasil yardimci olabilirim?',
      '2026-03-09T10:00:02.000Z'
    )
    db.prepare(`INSERT INTO whatsapp_interactions (id, phone, direction, message_text, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      'wa-in-1',
      '+905551112233',
      'inbound',
      'adres?',
      '2026-03-09T11:00:00.000Z'
    )
    db.prepare(`INSERT INTO whatsapp_interactions (id, phone, direction, message_text, ai_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'wa-out-1',
      '+905551112233',
      'outbound',
      'Adres',
      'Prime Mall AVM yani',
      '2026-03-09T11:00:02.000Z'
    )

    const instagramThreads = service['buildThreads'](
      { ...service.getConfig(), channel: 'instagram' },
      'ig-1'
    ) as DMConversationThreadSnapshot[]
    expect(instagramThreads).toHaveLength(1)
    expect(instagramThreads[0].customerId).toBe('ig-1')

    const whatsappThreads = service['buildThreads'](
      { ...service.getConfig(), channel: 'whatsapp' },
      '+905551112233'
    ) as DMConversationThreadSnapshot[]
    expect(whatsappThreads).toHaveLength(1)
    expect(whatsappThreads[0].channel).toBe('whatsapp')
    expect(whatsappThreads[0].customerId).toBe('+905551112233')
  })

  it('renders prompt preview with exact model and scoped customer input', () => {
    const db = createTestDb()
    const service = new DMConversationReviewService(db)

    db.prepare(`INSERT INTO instagram_customers (instagram_id, name) VALUES (?, ?)`).run(
      '1452244026404093',
      'ridvan_mintac36'
    )
    db.prepare(`INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, intent, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'ig-prompt-1',
      '1452244026404093',
      'inbound',
      'Iskenderunun neresindesiniz?',
      'contact',
      '2026-03-09T12:00:00.000Z'
    )
    db.prepare(`INSERT INTO instagram_interactions (id, instagram_id, direction, message_text, ai_response, model_used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'ig-prompt-2',
      '1452244026404093',
      'outbound',
      'Adres',
      'Prime Mall AVM yani',
      'deterministic/contact-location-v1',
      '2026-03-09T12:00:01.000Z'
    )

    const preview = service.getPromptPreview({
      model: 'openai/gpt-5.4-pro',
      channel: 'instagram',
      targetCustomerId: '1452244026404093',
      threadReviewPromptTemplate:
        'MODEL {{threadMetaJson}}\n{{transcript}}\n{{deterministicMetricsJson}}\n{{groundingSummaryJson}}',
      runSummaryPromptTemplate: 'RUN {{runAggregateJson}}',
    })

    expect(preview.config.model).toBe('openai/gpt-5.4-pro')
    expect(preview.targetCustomerId).toBe('1452244026404093')
    expect(preview.sample.mode).toBe('thread')
    expect(preview.threadReviewPrompt).toContain('1452244026404093')
    expect(preview.threadReviewPrompt).toContain('Prime Mall AVM yani')
    expect(preview.runSummaryPrompt).toContain('RUN')
  })
})
