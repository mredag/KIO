const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

const massages = db.prepare('SELECT COUNT(*) as count FROM massages').get();
const surveys = db.prepare('SELECT COUNT(*) as count FROM survey_templates').get();

console.log('Massages:', massages.count);
console.log('Surveys:', surveys.count);

if (massages.count > 0) {
  const first = db.prepare('SELECT id, name FROM massages LIMIT 3').all();
  console.log('\nFirst 3 massages:');
  first.forEach(m => console.log('-', m.name));
}

db.close();
