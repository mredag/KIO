-- Mission Control Schema
-- AI Operations Control Plane for Eform Spa Kiosk

-- Agents registry
CREATE TABLE IF NOT EXISTS mc_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  objective TEXT,
  model TEXT DEFAULT 'openai/gpt-4.1',
  provider TEXT DEFAULT 'openrouter',
  status TEXT CHECK(status IN ('active', 'idle', 'error', 'disabled')) DEFAULT 'idle',
  channel_scope TEXT, -- JSON array: ["instagram", "whatsapp", "admin"]
  capabilities TEXT, -- JSON array of capability strings
  guardrails TEXT, -- JSON policy text
  health_score REAL DEFAULT 100.0,
  total_runs INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0.0,
  avg_response_ms INTEGER DEFAULT 0,
  last_active_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Jobs (Workshop)
CREATE TABLE IF NOT EXISTS mc_jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT CHECK(source IN ('instagram', 'whatsapp', 'admin', 'cron', 'webhook', 'manual')) NOT NULL,
  priority TEXT CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK(status IN ('queued', 'scheduled', 'running', 'waiting_input', 'completed', 'failed', 'cancelled', 'dead_letter')) DEFAULT 'queued',
  agent_id TEXT,
  payload TEXT, -- JSON
  result TEXT, -- JSON
  error TEXT,
  sla_deadline DATETIME,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  tags TEXT, -- JSON array
  conversation_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
);

-- Runs (execution instances)
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
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (job_id) REFERENCES mc_jobs(id),
  FOREIGN KEY (agent_id) REFERENCES mc_agents(id)
);

-- Events (timeline audit log)
CREATE TABLE IF NOT EXISTS mc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT CHECK(entity_type IN ('job', 'run', 'agent', 'conversation', 'document', 'system')) NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- e.g. 'status_change', 'created', 'error', 'retry', 'escalation'
  from_state TEXT,
  to_state TEXT,
  message TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversations (channel threads)
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
  tags TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_agent_id) REFERENCES mc_agents(id)
);

-- Documents (knowledge ingestion)
CREATE TABLE IF NOT EXISTS mc_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT,
  content_type TEXT, -- 'markdown', 'pdf', 'text', 'json'
  status TEXT CHECK(status IN ('uploaded', 'parsing', 'chunked', 'indexed', 'available', 'error', 'archived')) DEFAULT 'uploaded',
  chunk_count INTEGER DEFAULT 0,
  tags TEXT, -- JSON array
  retention_days INTEGER DEFAULT 365,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Policies (routing, escalation, guardrails)
CREATE TABLE IF NOT EXISTS mc_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('routing', 'escalation', 'block', 'handoff', 'guardrail')) NOT NULL,
  conditions TEXT NOT NULL, -- JSON
  actions TEXT NOT NULL, -- JSON
  is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cost ledger
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mc_jobs_status ON mc_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_source ON mc_jobs(source);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_agent ON mc_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_created ON mc_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_jobs_priority ON mc_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_mc_runs_job ON mc_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_mc_runs_agent ON mc_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_runs_created ON mc_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_events_entity ON mc_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mc_events_created ON mc_events(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_channel ON mc_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_status ON mc_conversations(status);
CREATE INDEX IF NOT EXISTS idx_mc_conversations_customer ON mc_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_mc_documents_status ON mc_documents(status);
CREATE INDEX IF NOT EXISTS idx_mc_cost_ledger_agent ON mc_cost_ledger(agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_cost_ledger_created ON mc_cost_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_mc_cost_ledger_model ON mc_cost_ledger(model);

-- Skills (Intelligence page)
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

CREATE INDEX IF NOT EXISTS idx_mc_skills_status ON mc_skills(status);
CREATE INDEX IF NOT EXISTS idx_mc_skills_agent ON mc_skills(agent_id);


-- Approvals (quality gates)
CREATE TABLE IF NOT EXISTS mc_approvals (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action_type TEXT CHECK(action_type IN ('complete', 'status_change', 'output_review')) NOT NULL,
  payload TEXT,           -- JSON: context about the action
  confidence REAL CHECK(confidence >= 0.0 AND confidence <= 1.0) NOT NULL,
  rubric_scores TEXT,     -- JSON: { "correctness": 0.9, "completeness": 0.7, ... }
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
