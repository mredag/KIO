-- Agent-to-Agent Communication Schema
-- Extends Mission Control with structured messaging, task delegation,
-- shared memory, and board-based coordination between OpenClaw agents.

-- Boards (goal-oriented workspaces grouping agents and tasks)
CREATE TABLE IF NOT EXISTS mc_boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  lead_agent_id TEXT NOT NULL,
  status TEXT CHECK(status IN ('active', 'paused', 'completed', 'archived')) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_agent_id) REFERENCES mc_agents(id)
);

CREATE INDEX IF NOT EXISTS idx_mc_boards_status ON mc_boards(status);
CREATE INDEX IF NOT EXISTS idx_mc_boards_lead ON mc_boards(lead_agent_id);

-- Board agent membership (many-to-many: boards ↔ agents)
CREATE TABLE IF NOT EXISTS mc_board_agents (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES mc_boards(id),
  FOREIGN KEY (agent_id) REFERENCES mc_agents(id),
  UNIQUE(board_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_board_agents_board ON mc_board_agents(board_id);
CREATE INDEX IF NOT EXISTS idx_mc_board_agents_agent ON mc_board_agents(agent_id);

-- Agent messages (structured inter-agent communication)
CREATE TABLE IF NOT EXISTS mc_agent_messages (
  id TEXT PRIMARY KEY,
  board_id TEXT,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  message_type TEXT CHECK(message_type IN ('nudge', 'delegation', 'status_update', 'context_share', 'query', 'response', 'broadcast')) NOT NULL,
  content TEXT NOT NULL,
  delivery_status TEXT CHECK(delivery_status IN ('pending', 'delivered', 'failed')) DEFAULT 'pending',
  error TEXT,
  metadata TEXT,           -- JSON: optional structured data
  delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES mc_boards(id),
  FOREIGN KEY (sender_id) REFERENCES mc_agents(id),
  FOREIGN KEY (recipient_id) REFERENCES mc_agents(id)
);

CREATE INDEX IF NOT EXISTS idx_mc_agent_messages_board ON mc_agent_messages(board_id);
CREATE INDEX IF NOT EXISTS idx_mc_agent_messages_sender ON mc_agent_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_mc_agent_messages_recipient ON mc_agent_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mc_agent_messages_type ON mc_agent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_mc_agent_messages_created ON mc_agent_messages(created_at);

-- Shared memory (board-scoped key-value context store)
CREATE TABLE IF NOT EXISTS mc_shared_memory (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  source_agent_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  tags TEXT DEFAULT '[]',  -- JSON array
  memory_type TEXT CHECK(memory_type IN ('context', 'finding', 'decision', 'data')) DEFAULT 'context',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES mc_boards(id),
  FOREIGN KEY (source_agent_id) REFERENCES mc_agents(id),
  UNIQUE(board_id, key)
);

CREATE INDEX IF NOT EXISTS idx_mc_shared_memory_board ON mc_shared_memory(board_id);
CREATE INDEX IF NOT EXISTS idx_mc_shared_memory_agent ON mc_shared_memory(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_shared_memory_type ON mc_shared_memory(memory_type);

-- Task dependencies (DAG edges between mc_jobs)
CREATE TABLE IF NOT EXISTS mc_task_deps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  depends_on_job_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES mc_jobs(id),
  FOREIGN KEY (depends_on_job_id) REFERENCES mc_jobs(id),
  UNIQUE(job_id, depends_on_job_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_task_deps_job ON mc_task_deps(job_id);
CREATE INDEX IF NOT EXISTS idx_mc_task_deps_depends ON mc_task_deps(depends_on_job_id);
