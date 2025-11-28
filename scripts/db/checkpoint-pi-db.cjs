const Database = require('better-sqlite3');

const db = new Database('./backend/data/kiosk.db');

console.log('Before checkpoint:');
const before = db.prepare('SELECT COUNT(*) as count FROM survey_templates').get();
console.log('  Surveys:', before.count);

console.log('\nCheckpointing WAL...');
db.pragma('wal_checkpoint(RESTART)');

console.log('\nAfter checkpoint:');
const after = db.prepare('SELECT COUNT(*) as count FROM survey_templates').get();
console.log('  Surveys:', after.count);

const surveys = db.prepare('SELECT name FROM survey_templates').all();
surveys.forEach(s => console.log('  -', s.name));

db.close();
console.log('\n✅ Done!');
