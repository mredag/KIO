const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

// Get current state
const currentState = db.prepare('SELECT * FROM kiosk_state').get();
console.log('Current state:', currentState);

// Update to survey mode with the active survey
const result = db.prepare(`
  UPDATE kiosk_state 
  SET mode = 'survey',
      updated_at = datetime('now')
  WHERE id = 1
`).run();

console.log('Update result:', result);

// Verify the update
const newState = db.prepare('SELECT * FROM kiosk_state').get();
console.log('New state:', newState);

db.close();
console.log('\n✅ Database updated! Refresh the kiosk page.');
