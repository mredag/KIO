const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const db = new Database('./data/kiosk.db');

// Delete existing admin users
db.prepare('DELETE FROM admin_users').run();

// Create new admin user
const hash = bcrypt.hashSync('admin123', 10);
db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);

console.log('Admin user created: admin/admin123');
db.close();
