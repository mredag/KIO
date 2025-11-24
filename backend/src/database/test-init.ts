/**
 * Test script to verify database initialization
 * Run with: npm run dev -- src/database/test-init.ts
 */

import { initializeDatabase } from './init.js';
import { DatabaseService } from './DatabaseService.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB_PATH = './test-kiosk.db';

// Clean up any existing test database
if (existsSync(TEST_DB_PATH)) {
  unlinkSync(TEST_DB_PATH);
  console.log('Removed existing test database');
}

// Initialize database
console.log('\n=== Initializing Database ===');
const db = initializeDatabase(TEST_DB_PATH);
const dbService = new DatabaseService(db);

// Test database operations
console.log('\n=== Testing Database Operations ===');

// Test 1: Get kiosk state
console.log('\n1. Testing kiosk state:');
const kioskState = dbService.getKioskState();
console.log('Kiosk state:', kioskState);

// Test 2: Get system settings
console.log('\n2. Testing system settings:');
const settings = dbService.getSettings();
console.log('Settings:', {
  slideshow_timeout: settings.slideshow_timeout,
  survey_timeout: settings.survey_timeout,
  google_qr_display_duration: settings.google_qr_display_duration,
});

// Test 3: Get survey templates
console.log('\n3. Testing survey templates:');
const templates = dbService.getSurveyTemplates();
console.log(`Found ${templates.length} survey templates:`);
templates.forEach(t => {
  console.log(`  - ${t.name} (${t.type}): ${t.questions.length} questions`);
});

// Test 4: Create a test massage
console.log('\n4. Testing massage creation:');
const massage = dbService.createMassage({
  name: 'Swedish Massage',
  short_description: 'Relaxing full body massage',
  long_description: 'A classic Swedish massage using gentle, flowing strokes to promote relaxation.',
  duration: '60 minutes',
  media_type: 'photo',
  media_url: '/uploads/swedish-massage.jpg',
  purpose_tags: ['Relaxation', 'Stress Relief'],
  sessions: [
    { name: '60 minutes', price: 80 },
    { name: '90 minutes', price: 110 },
  ],
  is_featured: true,
  is_campaign: false,
  sort_order: 1,
});
console.log('Created massage:', massage.name);

// Test 5: Get all massages
console.log('\n5. Testing massage retrieval:');
const massages = dbService.getMassages();
console.log(`Found ${massages.length} massage(s)`);

// Test 6: Create a survey response
console.log('\n6. Testing survey response creation:');
const satisfactionTemplate = templates.find(t => t.type === 'satisfaction');
if (satisfactionTemplate) {
  const response = dbService.createSurveyResponse({
    survey_id: satisfactionTemplate.id,
    answers: {
      q1: '5',
      q2: null,
    },
  });
  console.log('Created survey response:', response.id);
}

// Test 7: Update kiosk heartbeat
console.log('\n7. Testing heartbeat update:');
dbService.updateKioskHeartbeat();
const updatedState = dbService.getKioskState();
console.log('Heartbeat updated:', updatedState.last_heartbeat);

// Test 8: Create a log entry
console.log('\n8. Testing system logging:');
const log = dbService.createLog({
  level: 'info',
  message: 'Database test completed successfully',
  details: { test: true, timestamp: new Date().toISOString() },
});
console.log('Created log entry:', log.id);

// Test 9: Transaction test
console.log('\n9. Testing transaction:');
dbService.transaction(() => {
  dbService.updateKioskState({ mode: 'survey', active_survey_id: satisfactionTemplate?.id || null });
  dbService.createLog({
    level: 'info',
    message: 'Kiosk mode changed to survey',
    details: { mode: 'survey' },
  });
});
console.log('Transaction completed successfully');

console.log('\n=== All Tests Passed! ===');
console.log(`\nTest database created at: ${TEST_DB_PATH}`);
console.log('You can inspect it with: sqlite3 test-kiosk.db');

// Close database
dbService.close();
