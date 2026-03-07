/**
 * Property-Based Tests for Mission Control Skills & Momentum Endpoints
 * Feature: mission-control-premium-ui
 *
 * Properties tested:
 *   P11: Backend skill creation round-trip
 *   P12: Backend rejects skill creation with missing required fields
 *   P14: Backend momentum endpoint returns valid structure
 *   P17: Agent name uniqueness validation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import fc from 'fast-check';
import { createMissionControlRoutes } from './missionControlRoutes.js';

// Arbitrary for valid skill names (non-empty, no null bytes)
const skillNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0 && !s.includes('\0'));
const skillTextArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

function createTestApp() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE mc_agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, objective TEXT,
      model TEXT DEFAULT 'openai/gpt-4.1', provider TEXT DEFAULT 'openrouter',
      status TEXT CHECK(status IN ('active','idle','error','disabled')) DEFAULT 'idle',
      channel_scope TEXT, capabilities TEXT, guardrails TEXT,
      health_score REAL DEFAULT 100.0, total_runs INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0, total_cost REAL DEFAULT 0.0,
      avg_response_ms INTEGER DEFAULT 0, last_active_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_jobs (
      id TEXT PRIMARY KEY, title TEXT NOT NULL,
      source TEXT CHECK(source IN ('instagram','whatsapp','admin','cron','webhook','manual')) NOT NULL,
      priority TEXT DEFAULT 'medium',
      status TEXT CHECK(status IN ('queued','scheduled','running','waiting_input','completed','failed','cancelled','dead_letter')) DEFAULT 'queued',
      agent_id TEXT, payload TEXT, result TEXT, error TEXT, sla_deadline DATETIME,
      retry_count INTEGER DEFAULT 0, max_retries INTEGER DEFAULT 3, tags TEXT,
      conversation_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME, completed_at DATETIME, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_runs (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL, agent_id TEXT NOT NULL,
      status TEXT DEFAULT 'running', model TEXT,
      input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0.0, duration_ms INTEGER DEFAULT 0,
      response_text TEXT, error TEXT, metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
    );
    CREATE TABLE mc_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, event_type TEXT NOT NULL,
      from_state TEXT, to_state TEXT, message TEXT, metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_skills (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
      prerequisites TEXT DEFAULT '[]', prompt TEXT NOT NULL, test_case TEXT NOT NULL,
      status TEXT CHECK(status IN ('mastered','candidate','backlog')) DEFAULT 'candidate',
      agent_id TEXT, fit_score REAL DEFAULT 0.0, fit_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_conversations (
      id TEXT PRIMARY KEY, channel TEXT NOT NULL, customer_id TEXT NOT NULL,
      customer_name TEXT, status TEXT DEFAULT 'active', assigned_agent_id TEXT,
      message_count INTEGER DEFAULT 0, last_message_at DATETIME, context_summary TEXT,
      tags TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_documents (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, file_path TEXT, content_type TEXT,
      status TEXT DEFAULT 'uploaded', chunk_count INTEGER DEFAULT 0, tags TEXT,
      retention_days INTEGER DEFAULT 365, error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_policies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      conditions TEXT NOT NULL, actions TEXT NOT NULL, is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE mc_cost_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, agent_id TEXT,
      model TEXT NOT NULL, provider TEXT DEFAULT 'openai',
      input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0.0, job_source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE instagram_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, instagram_id TEXT, direction TEXT,
      message_text TEXT, intent TEXT, ai_response TEXT,
      response_time_ms INTEGER, model_used TEXT, tokens_estimated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const app = express();
  app.use(express.json());
  app.use('/api/mc', createMissionControlRoutes(db));
  return { app, db };
}

describe('Feature: mission-control-premium-ui — Backend Skills & Momentum', () => {
  let db: Database.Database;
  let app: Express;

  beforeAll(() => {
    const testApp = createTestApp();
    app = testApp.app;
    db = testApp.db;
  });

  afterAll(() => { db.close(); });

  beforeEach(() => {
    db.exec('DELETE FROM mc_skills');
    db.exec('DELETE FROM mc_jobs');
    db.exec('DELETE FROM mc_events');
  });

  // Sanity check
  it('GET /api/mc/dashboard returns 200', async () => {
    const res = await request(app).get('/api/mc/dashboard');
    expect(res.status).toBe(200);
  });

  it('GET /api/mc/skills returns 200', async () => {
    const res = await request(app).get('/api/mc/skills');
    expect(res.status).toBe(200);
  });

  it('GET /api/mc/momentum returns 200', async () => {
    const res = await request(app).get('/api/mc/momentum');
    expect(res.status).toBe(200);
  });

  /**
   * Property 11: Backend skill creation round-trip
   * Validates: Requirements 16.2
   */
  describe('Property 11: Backend skill creation round-trip', () => {
    it('created skill appears in GET /api/mc/skills', async () => {
      await fc.assert(
        fc.asyncProperty(skillNameArb, skillTextArb, skillTextArb, async (name, prompt, testCase) => {
          db.exec('DELETE FROM mc_skills');
          const createRes = await request(app).post('/api/mc/skills').send({ name, prompt, test_case: testCase });
          expect(createRes.status).toBe(201);
          const listRes = await request(app).get('/api/mc/skills');
          expect(listRes.status).toBe(200);
          const found = (listRes.body as any[]).find((s: any) => s.name === name);
          expect(found).toBeDefined();
          expect(found.prompt).toBe(prompt);
          expect(found.test_case).toBe(testCase);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Backend rejects skill creation with missing required fields
   * Validates: Requirements 16.4
   */
  describe('Property 12: Backend rejects skill creation with missing required fields', () => {
    it('returns 400 when required fields are missing', async () => {
      const missingFieldArb = fc.record({
        name: fc.option(skillNameArb, { nil: undefined }),
        prompt: fc.option(skillTextArb, { nil: undefined }),
        test_case: fc.option(skillTextArb, { nil: undefined }),
      }).filter(obj => !obj.name || !obj.prompt || !obj.test_case);

      await fc.assert(
        fc.asyncProperty(missingFieldArb, async (payload) => {
          const res = await request(app).post('/api/mc/skills').send(payload);
          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Backend momentum endpoint returns valid structure
   * Validates: Requirements 16.3
   */
  describe('Property 14: Backend momentum endpoint returns valid structure', () => {
    it('returns score 0-100 and valid task_similarities', async () => {
      const tagArb = fc.array(
        fc.constantFrom('coding', 'research', 'outreach', 'design', 'testing', 'deploy'),
        { minLength: 0, maxLength: 4 }
      );
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
            status: fc.constantFrom('completed', 'queued'),
            tags: tagArb,
          }), { minLength: 0, maxLength: 8 }),
          async (jobs) => {
            db.exec('DELETE FROM mc_jobs');
            const insertJob = db.prepare(
              `INSERT INTO mc_jobs (id, title, source, status, tags, completed_at) VALUES (?, ?, 'manual', ?, ?, ?)`
            );
            for (let i = 0; i < jobs.length; i++) {
              const j = jobs[i];
              insertJob.run(
                `test-job-${i}`, j.title, j.status,
                JSON.stringify(j.tags),
                j.status === 'completed' ? new Date().toISOString() : null
              );
            }
            const res = await request(app).get('/api/mc/momentum');
            expect(res.status).toBe(200);
            expect(res.body.score).toBeGreaterThanOrEqual(0);
            expect(res.body.score).toBeLessThanOrEqual(100);
            expect(Array.isArray(res.body.task_similarities)).toBe(true);
            for (const ts of res.body.task_similarities) {
              expect(ts.similarity).toBeGreaterThanOrEqual(0);
              expect(ts.similarity).toBeLessThanOrEqual(100);
              expect(typeof ts.job_id).toBe('string');
              expect(typeof ts.reason).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Agent name uniqueness validation (skill name uniqueness)
   * Validates: Requirements 13.2
   */
  describe('Property 17: Agent name uniqueness validation', () => {
    it('rejects duplicate skill names', async () => {
      await fc.assert(
        fc.asyncProperty(skillNameArb, skillTextArb, skillTextArb, async (name, prompt, testCase) => {
          db.exec('DELETE FROM mc_skills');
          const first = await request(app).post('/api/mc/skills').send({ name, prompt, test_case: testCase });
          expect(first.status).toBe(201);
          const second = await request(app).post('/api/mc/skills').send({ name, prompt: 'other', test_case: 'other' });
          expect(second.status).toBe(400);
          expect(second.body.error).toContain('already exists');
        }),
        { numRuns: 100 }
      );
    });
  });
});
