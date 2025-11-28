const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('fs');

console.log('=== Preparing Database for Pi ===\n');

// Open database
const db = new Database('./data/kiosk.db');

// Check if admin_users table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'").all();

if (tables.length === 0) {
  console.log('Creating admin_users table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Check if admin user exists
const adminExists = db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE username = ?').get('admin');

if (adminExists.count === 0) {
  console.log('Creating admin user...');
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('✓ Admin user created (admin/admin123)');
} else {
  console.log('✓ Admin user already exists');
}

// Count massages
const massages = db.prepare('SELECT COUNT(*) as count FROM massages').get();
console.log(`✓ Database has ${massages.count} massages`);

db.close();

console.log('\n✓ Database ready!');
console.log('\nRun: .\\sync-db-to-pi.ps1 to sync to Raspberry Pi');
