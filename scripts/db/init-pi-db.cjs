const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const dbPath = './backend/data/kiosk.db';
const schemaPath = './backend/src/database/schema.sql';

console.log('Initializing database...');

// Read schema
const schema = fs.readFileSync(schemaPath, 'utf8');

// Create/open database
const db = new Database(dbPath);

// Execute schema (split by semicolon and execute each statement)
console.log('Creating tables...');
const statements = schema.split(';').filter(s => s.trim());
for (const stmt of statements) {
  if (stmt.trim()) {
    db.exec(stmt);
  }
}

// Insert default settings
console.log('Inserting default settings...');
const hash = bcrypt.hashSync('admin123', 10);

db.prepare(`
  INSERT OR REPLACE INTO system_settings (
    id, admin_password_hash, slideshow_timeout, survey_timeout,
    google_qr_display_duration, kiosk_theme, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`).run(1, hash, 60, 60, 10, 'classic');

// Insert default kiosk state
console.log('Setting kiosk state...');
db.prepare(`
  INSERT OR REPLACE INTO kiosk_state (id, mode, last_heartbeat, updated_at)
  VALUES (?, ?, datetime('now'), datetime('now'))
`).run(1, 'digital-menu');

db.close();

console.log('\n✅ Database initialized successfully!');
console.log('   Login: admin / admin123');
