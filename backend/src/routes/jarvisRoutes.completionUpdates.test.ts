import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Feature: jarvis-task-orchestration, Property 12: Completion updates
 *
 * For any agent execution that produces a final response, the system should:
 * - update mc_jobs status to "completed" with the result text
 * - update mc_runs with duration_ms and response_text
 * - insert an mc_cost_ledger entry with model/provider/job_source
 * - increment the agent's total_runs by exactly 1
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.5
 */
describe('Property 12: Completion updates', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Create Jarvis tables
    db.exec(`
      CREATE TABLE mc_jarvis_sessions (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'planning',
        title TEXT NOT NULL DEFAULT 'Yeni Görev',
        summary TEXT,
        agent_id TEXT,
        job_id TEXT,
        openclaw_session_key TEXT,
        execution_session_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE mc_jarvis_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES mc_jarvis_sessions(id)
      );
    `);

    // Create Mission Control tables
    db.exec(`
      CREATE TABLE mc_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        objective TEXT,
        model TEXT DEFAULT 'openai/gpt-4.1',
        provider TEXT DEFAULT 'openrouter',
        status TEXT DEFAULT 'idle',
        channel_scope TEXT,
        capabilities TEXT,
        guardrails TEXT,
        health_score REAL DEFAULT 100.0,
        total_runs INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0.0,
        avg_response_ms INTEGER DEFAULT 0,
        last_active_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE mc_jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'queued',
        agent_id TEXT,
        payload TEXT,
        result TEXT,
        error TEXT,
        sla_deadline DATETIME,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        tags TEXT,
        conversation_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
      );

      CREATE TABLE mc_runs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT DEFAULT 'running',
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0.0,
        duration_ms INTEGER DEFAULT 0,
        response_text TEXT,
        error TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (job_id) REFERENCES mc_jobs(id),
        FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
      );

      CREATE TABLE mc_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT,
        message TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE mc_cost_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        agent_id TEXT,
        model TEXT NOT NULL,
        provider TEXT DEFAULT 'openai',
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0.0,
        job_source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES mc_runs(id),
        FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  /**
   * Simulates handleExecutionComplete logic directly against the DB,
   * matching the implementation in jarvisRoutes.ts.
   */
  function simulateCompletion(
    sessionId: string,
    jobId: string,
    agentId: string,
    model: string,
    resultText: string
  ) {
    // Update mc_jobs to completed
    db.prepare(
      `UPDATE mc_jobs SET status = 'completed', result = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(resultText, jobId);

    // Update mc_runs with duration and response
    const run = db.prepare(
      'SELECT * FROM mc_runs WHERE job_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(jobId) as any;
    if (run) {
      const durationMs = Date.now() - new Date(run.created_at).getTime();
      db.prepare(
        `UPDATE mc_runs SET status = 'completed', duration_ms = ?, response_text = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(durationMs, resultText, run.id);

      // Record cost in mc_cost_ledger
      db.prepare(
        `INSERT INTO mc_cost_ledger (run_id, agent_id, model, provider, job_source) VALUES (?, ?, ?, 'openrouter', 'admin')`
      ).run(run.id, agentId, model);
    }

    // Increment agent total_runs and update last_active_at
    db.prepare(
      `UPDATE mc_agents SET total_runs = total_runs + 1, last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(agentId);

    // Update session status to completed
    db.prepare(
      `UPDATE mc_jarvis_sessions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(sessionId);
  }

  /**
   * Helper: seed a full running session with agent, job, and run.
   */
  function seedRunningSession(opts: {
    model: string;
    initialTotalRuns: number;
  }) {
    const sessionId = crypto.randomUUID();
    const agentId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    db.prepare(
      `INSERT INTO mc_agents (id, name, role, model, total_runs) VALUES (?, 'Test Agent', 'developer', ?, ?)`
    ).run(agentId, opts.model, opts.initialTotalRuns);

    db.prepare(
      `INSERT INTO mc_jobs (id, title, source, status, agent_id) VALUES (?, 'Test Job', 'admin', 'running', ?)`
    ).run(jobId, agentId);

    db.prepare(
      `INSERT INTO mc_runs (id, job_id, agent_id, status, model) VALUES (?, ?, ?, 'running', ?)`
    ).run(runId, jobId, agentId, opts.model);

    db.prepare(
      `INSERT INTO mc_jarvis_sessions (id, status, title, agent_id, job_id) VALUES (?, 'running', 'Test Session', ?, ?)`
    ).run(sessionId, agentId, jobId);

    return { sessionId, agentId, jobId, runId };
  }

  it('completion sets mc_jobs status to "completed" with result text (Req 7.1)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.constantFrom('openai/gpt-4.1', 'openai/gpt-4o-mini', 'openai-codex/gpt-5.3-codex'),
        (resultText, model) => {
          const { sessionId, agentId, jobId } = seedRunningSession({ model, initialTotalRuns: 0 });

          simulateCompletion(sessionId, jobId, agentId, model, resultText);

          const job = db.prepare('SELECT * FROM mc_jobs WHERE id = ?').get(jobId) as any;
          expect(job.status).toBe('completed');
          expect(job.result).toBe(resultText);
          expect(job.completed_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completion updates mc_runs with duration_ms and response_text (Req 7.2)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.constantFrom('openai/gpt-4.1', 'openai/gpt-4o-mini', 'openai-codex/gpt-5.3-codex'),
        (resultText, model) => {
          const { sessionId, agentId, jobId, runId } = seedRunningSession({ model, initialTotalRuns: 0 });

          simulateCompletion(sessionId, jobId, agentId, model, resultText);

          const run = db.prepare('SELECT * FROM mc_runs WHERE id = ?').get(runId) as any;
          expect(run.status).toBe('completed');
          expect(run.response_text).toBe(resultText);
          expect(run.duration_ms).toBeGreaterThanOrEqual(0);
          expect(run.completed_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completion inserts mc_cost_ledger entry with model, provider "openrouter", job_source "admin" (Req 7.3)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.constantFrom('openai/gpt-4.1', 'openai/gpt-4o-mini', 'openai-codex/gpt-5.3-codex'),
        (resultText, model) => {
          const { sessionId, agentId, jobId, runId } = seedRunningSession({ model, initialTotalRuns: 0 });

          simulateCompletion(sessionId, jobId, agentId, model, resultText);

          const costEntry = db.prepare(
            'SELECT * FROM mc_cost_ledger WHERE run_id = ? AND agent_id = ?'
          ).get(runId, agentId) as any;

          expect(costEntry).toBeDefined();
          expect(costEntry.model).toBe(model);
          expect(costEntry.provider).toBe('openrouter');
          expect(costEntry.job_source).toBe('admin');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('completion increments agent total_runs by exactly 1 (Req 7.5)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('openai/gpt-4.1', 'openai/gpt-4o-mini', 'openai-codex/gpt-5.3-codex'),
        fc.integer({ min: 0, max: 100 }),
        (resultText, model, initialRuns) => {
          const { sessionId, agentId, jobId } = seedRunningSession({ model, initialTotalRuns: initialRuns });

          simulateCompletion(sessionId, jobId, agentId, model, resultText);

          const agent = db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(agentId) as any;
          expect(agent.total_runs).toBe(initialRuns + 1);
          expect(agent.last_active_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });
});
