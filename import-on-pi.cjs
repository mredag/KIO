const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./data/kiosk.db');
const sql = fs.readFileSync('massages-import.sql', 'utf8');
db.exec(sql);

const count = db.prepare('SELECT COUNT(*) as count FROM massages').get();
console.log(`Imported ${count.count} massages`);

db.close();
