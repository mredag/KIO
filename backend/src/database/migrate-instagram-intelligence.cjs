/**
 * Instagram DM Intelligence schema migration
 * Adds model_used and tokens_estimated columns to instagram_interactions,
 * plus indexes for MC conversation upsert and model-based queries.
 *
 * Can be run standalone: node src/database/migrate-instagram-intelligence.cjs
 * Also wired into init.ts for automatic startup migration.
 */
const Database = require('better-sqlite3');
const path = require('path');

function runInstagramIntelligenceMigration(db) {
  const isStandalone = !db;

  if (isStandalone) {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'kiosk.db');
    console.log('Opening database:', dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }

  // 1. Add model_used column to instagram_interactions
  try {
    db.prepare('ALTER TABLE instagram_interactions ADD COLUMN model_used TEXT').run();
    console.log('Added model_used column to instagram_interactions');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('model_used column already exists — skipping');
    } else {
      throw e;
    }
  }

  // 2. Add tokens_estimated column to instagram_interactions
  try {
    db.prepare('ALTER TABLE instagram_interactions ADD COLUMN tokens_estimated INTEGER DEFAULT 0').run();
    console.log('Added tokens_estimated column to instagram_interactions');
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('tokens_estimated column already exists — skipping');
    } else {
      throw e;
    }
  }

  // 3. Unique index on mc_conversations(channel, customer_id) for upsert support
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mc_conversations_channel_customer
      ON mc_conversations(channel, customer_id);
  `);
  console.log('idx_mc_conversations_channel_customer index created/verified');

  // 4. Index on instagram_interactions(model_used) for model distribution queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_instagram_interactions_model
      ON instagram_interactions(model_used);
  `);
  console.log('idx_instagram_interactions_model index created/verified');

  if (isStandalone) {
    console.log('Instagram Intelligence migration complete.');
    db.close();
  }
}

// Run standalone if executed directly
if (require.main === module) {
  runInstagramIntelligenceMigration();
}

module.exports = { runInstagramIntelligenceMigration };
