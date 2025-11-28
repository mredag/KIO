const Database = require('better-sqlite3');

const db = new Database('./backend/data/kiosk.db');

console.log('Checking system_settings table...');
const row = db.prepare('SELECT * FROM system_settings WHERE id = 1').get();

if (row) {
  console.log('✅ Settings found:');
  console.log(JSON.stringify(row, null, 2));
} else {
  console.log('❌ No settings found!');
}

db.close();
