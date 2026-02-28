/**
 * Jarvis Task Orchestration schema migration
 * Creates mc_jarvis_sessions and mc_jarvis_messages tables.
 * 
 * Can be run standalone: node src/database/migrate-jarvis.cjs
 * Also wired into init.ts for automatic startup migration.
 */
const Database = require('better-sqlite3');
const path = require('path');

function runJarvisMigration(db) {
  const isStandalone = !db;

  if (isStandalone) {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'kiosk.db');
    console.log('Opening database:', dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }

  // Create Jarvis planning sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mc_jarvis_sessions (
      id TEXT PRIMARY KEY,
      status TEXT CHECK(status IN ('planning', 'awaiting_confirmation', 'confirmed', 'running', 'completed', 'failed')) DEFAULT 'planning',
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
  `);
  console.log('mc_jarvis_sessions table created/verified');

  // Create Jarvis chat messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mc_jarvis_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES mc_jarvis_sessions(id)
    );
  `);
  console.log('mc_jarvis_messages table created/verified');

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mc_jarvis_sessions_status ON mc_jarvis_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_mc_jarvis_sessions_updated ON mc_jarvis_sessions(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mc_jarvis_messages_session ON mc_jarvis_messages(session_id, created_at ASC);
  `);
  console.log('Jarvis indexes created/verified');

  if (isStandalone) {
    console.log('Jarvis migration complete.');
    db.close();
  }
}

// Run standalone if executed directly
if (require.main === module) {
  runJarvisMigration();
}

module.exports = { runJarvisMigration };
