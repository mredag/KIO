const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

const schema = db.prepare("PRAGMA table_info(massages)").all();
console.log('Massage columns:', schema.map(c => c.name));

const massages = db.prepare('SELECT * FROM massages').all();
console.log('Massages:', massages.length);
if (massages.length > 0) {
  console.log('First massage:', massages[0]);
}

db.close();
