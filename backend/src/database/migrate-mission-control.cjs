/**
 * Mission Control schema migration
 * Run: node src/database/migrate-mission-control.cjs
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'kiosk.db');
console.log('Opening database:', dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Execute all CREATE statements directly
db.exec(`
CREATE TABLE IF NOT EXISTS mc_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  objective TEXT,
  model TEXT DEFAULT 'openai/gpt-4.1',
  provider TEXT DEFAULT 'openrouter',
  status TEXT CHECK(status IN ('active', 'idle', 'error', 'disabled')) DEFAULT 'idle',
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

CREATE TABLE IF NOT EXISTS mc_jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT CHECK(source IN ('instagram', 'whatsapp', 'admin', 'cron', 'webhook', 'manual')) NOT NULL,
  priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('queued', 'scheduled', 'running', 'waiting_input', 'completed', 'failed', 'cancelled', 'dead_letter')) DEFAULT 'queued',
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

CREATE TABLE IF NOT EXISTS mc_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT CHECK(status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
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

CREATE TABLE IF NOT EXISTS mc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT CHECK(entity_type IN ('job', 'run', 'agent', 'conversation', 'document', 'system')) NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  message TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mc_conversations (
  id TEXT PRIMARY KEY,
  channel TEXT CHECK(channel IN ('instagram', 'whatsapp', 'admin', 'studio')) NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  status TEXT CHECK(status IN ('active', 'waiting', 'resolved', 'escalated')) DEFAULT 'active',
  assigned_agent_id TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at DATETIME,
  context_summary TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_agent_id) REFERENCES mc_agents(id)
);

CREATE TABLE IF NOT EXISTS mc_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT,
  content_type TEXT,
  status TEXT CHECK(status IN ('uploaded', 'parsing', 'chunked', 'indexed', 'available', 'error', 'archived')) DEFAULT 'uploaded',
  chunk_count INTEGER DEFAULT 0,
  tags TEXT,
  retention_days INTEGER DEFAULT 365,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mc_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('routing', 'escalation', 'block', 'handoff', 'guardrail')) NOT NULL,
  conditions TEXT NOT NULL,
  actions TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mc_cost_ledger (
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

CREATE TABLE IF NOT EXISTS mc_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prerequisites TEXT DEFAULT '[]',
  prompt TEXT NOT NULL,
  test_case TEXT NOT NULL,
  status TEXT CHECK(status IN ('mastered', 'candidate', 'backlog')) DEFAULT 'candidate',
  agent_id TEXT,
  fit_score REAL DEFAULT 0.0,
  fit_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
);
`);
console.log('Tables created');

// Create indexes
db.exec(`
CREATE INDEX IF NOT EXISTS idx_mc_jobs_status ON mc_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_source ON mc_jobs(source);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_agent ON mc_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_created ON mc_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_runs_job ON mc_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_mc_runs_agent ON mc_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_events_entity ON mc_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mc_events_created ON mc_events(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_channel ON mc_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_customer ON mc_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_mc_documents_status ON mc_documents(status);
CREATE INDEX IF NOT EXISTS idx_mc_cost_ledger_agent ON mc_cost_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_cost_ledger_created ON mc_cost_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_skills_status ON mc_skills(status);
CREATE INDEX IF NOT EXISTS idx_mc_skills_agent ON mc_skills(agent_id);
`);
console.log('Indexes created');

// Seed default agent
const existing = db.prepare('SELECT id FROM mc_agents WHERE id = ?').get('instagram-dm');
if (!existing) {
  db.prepare(`INSERT INTO mc_agents (id, name, role, objective, model, provider, status, channel_scope, capabilities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'instagram-dm', 'Eform Instagram Asistani', 'customer_support',
    'Instagram DM uzerinden gelen musteri sorularini Turkce olarak yanitla',
    'openai/gpt-4o-mini', 'openrouter', 'active',
    JSON.stringify(['instagram']),
    JSON.stringify(['answer_questions', 'provide_pricing', 'share_hours', 'greet_customers'])
  );
  console.log('Seeded instagram-dm agent');
}

// === Approval System Migration ===
db.exec(`
CREATE TABLE IF NOT EXISTS mc_approvals (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action_type TEXT CHECK(action_type IN ('complete', 'status_change', 'output_review')) NOT NULL,
  payload TEXT,
  confidence REAL CHECK(confidence >= 0.0 AND confidence <= 1.0) NOT NULL,
  rubric_scores TEXT,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewer_note TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES mc_jobs(id),
  FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
);

CREATE INDEX IF NOT EXISTS idx_mc_approvals_job ON mc_approvals(job_id);
CREATE INDEX IF NOT EXISTS idx_mc_approvals_agent ON mc_approvals(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_approvals_status ON mc_approvals(status);
CREATE INDEX IF NOT EXISTS idx_mc_approvals_created ON mc_approvals(created_at);
`);
console.log('mc_approvals table created/verified');

// Add confidence and rubric_scores columns to mc_runs
try {
  db.exec(`ALTER TABLE mc_runs ADD COLUMN confidence REAL`);
  console.log('Added confidence column to mc_runs');
} catch (e) {
  // Column already exists — ignore
}
try {
  db.exec(`ALTER TABLE mc_runs ADD COLUMN rubric_scores TEXT`);
  console.log('Added rubric_scores column to mc_runs');
} catch (e) {
  // Column already exists — ignore
}

// Update mc_events CHECK constraint to include 'approval'
try {
  const hasApproval = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='mc_events'`).get();
  if (hasApproval && !hasApproval.sql.includes("'board'")) {
    db.exec(`
      DROP TABLE IF EXISTS mc_events_new;
      CREATE TABLE mc_events_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT CHECK(entity_type IN ('job', 'run', 'agent', 'conversation', 'document', 'system', 'approval', 'board', 'message', 'memory')) NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT,
        message TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO mc_events_new SELECT * FROM mc_events;
      DROP TABLE mc_events;
      ALTER TABLE mc_events_new RENAME TO mc_events;
      CREATE INDEX IF NOT EXISTS idx_mc_events_entity ON mc_events(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_mc_events_created ON mc_events(created_at);
    `);
    console.log('Updated mc_events CHECK constraint to include approval');
  }
} catch (e) {
  console.warn('mc_events migration warning:', e.message);
}

// Update mc_jarvis_sessions CHECK constraint to include 'awaiting_approval'
try {
  const hasAwaitingApproval = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='mc_jarvis_sessions'`).get();
  if (hasAwaitingApproval && !hasAwaitingApproval.sql.includes("'awaiting_approval'")) {
    db.exec(`
      DROP TABLE IF EXISTS mc_jarvis_sessions_new;
      CREATE TABLE mc_jarvis_sessions_new (
        id TEXT PRIMARY KEY,
        status TEXT CHECK(status IN ('planning', 'awaiting_confirmation', 'confirmed', 'running', 'completed', 'failed', 'awaiting_approval')) DEFAULT 'planning',
        title TEXT NOT NULL DEFAULT 'Yeni Görev',
        summary TEXT,
        agent_id TEXT,
        job_id TEXT,
        openclaw_session_key TEXT,
        execution_session_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES mc_agents(id),
        FOREIGN KEY (job_id) REFERENCES mc_jobs(id)
      );
      INSERT INTO mc_jarvis_sessions_new SELECT * FROM mc_jarvis_sessions;
      DROP TABLE mc_jarvis_sessions;
      ALTER TABLE mc_jarvis_sessions_new RENAME TO mc_jarvis_sessions;
      CREATE INDEX IF NOT EXISTS idx_mc_jarvis_sessions_status ON mc_jarvis_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_mc_jarvis_sessions_updated ON mc_jarvis_sessions(updated_at DESC);
    `);
    console.log('Updated mc_jarvis_sessions CHECK constraint to include awaiting_approval');
  }
} catch (e) {
  console.warn('mc_jarvis_sessions migration warning:', e.message);
}

// Seed approval confidence threshold policy
db.prepare(`INSERT OR IGNORE INTO mc_policies (id, name, type, conditions, actions, is_active, priority)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  'policy-approval-threshold',
  'approval_confidence_threshold',
  'guardrail',
  JSON.stringify({ threshold: 0.80 }),
  JSON.stringify({ action: 'require_approval' }),
  1,
  100
);
console.log('Approval confidence threshold policy seeded');

console.log('Mission Control migration complete.');
db.close();
