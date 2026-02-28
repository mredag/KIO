/**
 * KB Migration Script — replaces all knowledge_base records with migration data.
 * Run from backend/ with: node scripts/migrate-kb.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'kiosk.db');
// Migration source: originally from docs/kb-migration-package/exports/knowledge-base-2026-02-23.json (deleted after migration completed 2026-02-23)
// Current KB data lives in seed-knowledge.ts (61 entries). Re-seed via: node -e "import('./src/database/seed-knowledge.js').then(m => m.seedKnowledge(db))"
const migrationPath = join(__dirname, '..', 'data', 'backups', 'knowledge-base-latest.json');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Read migration data
const records = JSON.parse(readFileSync(migrationPath, 'utf-8'));
console.log(`Migration file: ${records.length} records`);

// Backup current state
const current = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
console.log(`Current DB: ${current.count} records`);

// Create backup
const backupDir = join(__dirname, '..', 'data', 'backups');
const backupFile = join(backupDir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const allCurrent = db.prepare('SELECT * FROM knowledge_base').all();
const { writeFileSync, mkdirSync } = await import('fs');
mkdirSync(backupDir, { recursive: true });
writeFileSync(backupFile, JSON.stringify(allCurrent, null, 2));
console.log(`Backup saved: ${backupFile}`);

// Execute migration in a transaction
const migrate = db.transaction(() => {
  // Delete all existing records
  const deleted = db.prepare('DELETE FROM knowledge_base').run();
  console.log(`Deleted: ${deleted.changes} records`);

  // Insert all migration records
  const insert = db.prepare(`
    INSERT INTO knowledge_base (id, category, key_name, value, description, is_active, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const r of records) {
    const id = r.id || randomUUID();
    insert.run(id, r.category, r.key_name, r.value, r.description, r.is_active, r.version, r.created_at, r.updated_at);
    inserted++;
  }
  console.log(`Inserted: ${inserted} records`);
  return inserted;
});

const count = migrate();

// Verify
const verify = db.prepare('SELECT category, COUNT(*) as count FROM knowledge_base GROUP BY category ORDER BY category').all();
console.log('\nCategory distribution:');
for (const row of verify) {
  console.log(`  ${row.category}: ${row.count}`);
}
const total = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get();
console.log(`\nTotal: ${total.count} records`);

// Quick data spot-check
const phone = db.prepare("SELECT value FROM knowledge_base WHERE key_name = 'phone'").get();
console.log(`\nSpot check — phone: ${phone?.value?.substring(0, 40)}...`);

const membership = db.prepare("SELECT value FROM knowledge_base WHERE key_name = 'membership_individual'").get();
console.log(`Spot check — ferdi üyelik: ${membership?.value?.substring(0, 50)}...`);

db.close();
console.log('\n✅ Migration complete!');
