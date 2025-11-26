const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

// Check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

// Check kiosk state
const state = db.prepare('SELECT * FROM kiosk_state').get();
console.log('\nKiosk State:', JSON.stringify(state, null, 2));

// Check survey templates
const surveyTable = tables.find(t => t.name.includes('survey'));
if (surveyTable) {
  const surveys = db.prepare(`SELECT * FROM ${surveyTable.name}`).all();
  console.log('\nSurveys:', JSON.stringify(surveys, null, 2));
}

db.close();
