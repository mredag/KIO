const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const db = new Database('./backend/data/kiosk.db');

console.log('Checking database...');

// Check if settings exist
const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

if (!settings) {
  console.log('Settings not found, initializing...');
  
  // Insert default settings
  db.prepare(`
    INSERT INTO settings (
      id, admin_username, admin_password_hash, kiosk_mode, 
      slideshow_interval, language, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    1,
    'admin',
    bcrypt.hashSync('admin123', 10),
    'digital_menu',
    5000,
    'tr'
  );
  
  console.log('✅ Settings initialized');
} else {
  console.log('✅ Settings exist');
  console.log('   Username:', settings.admin_username);
  console.log('   Mode:', settings.kiosk_mode);
  console.log('   Language:', settings.language);
}

// Check admin_users table
const adminUser = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');

if (!adminUser) {
  console.log('Admin user not found, creating...');
  
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
    'admin',
    bcrypt.hashSync('admin123', 10)
  );
  
  console.log('✅ Admin user created');
} else {
  console.log('✅ Admin user exists');
}

db.close();
console.log('\n✅ Database fixed! You can now login with admin/admin123');
