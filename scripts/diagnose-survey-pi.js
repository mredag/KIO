#!/usr/bin/env node
/**
 * Diagnostic script for survey submission issues on Raspberry Pi
 * Run this on the Pi to test survey recording
 * 
 * Usage: 
 *   cd ~/spa-kiosk/backend
 *   node ../scripts/diagnose-survey-pi.js
 * 
 * Or from project root:
 *   node scripts/diagnose-survey-pi.js
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const API_BASE = process.env.API_URL || 'http://localhost:3001';

// Helper to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runDiagnostics() {
  console.log('='.repeat(60));
  console.log('Survey Submission Diagnostics for Raspberry Pi');
  console.log('='.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Health check
  console.log('1. Testing API health...');
  try {
    const health = await makeRequest('GET', '/api/kiosk/health');
    console.log(`   ✅ Health check: ${health.status} - ${JSON.stringify(health.data)}`);
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
    console.log('   → Backend might not be running. Start with: pm2 start kiosk-backend');
    return;
  }

  // Step 2: Get kiosk state
  console.log('\n2. Getting kiosk state...');
  try {
    const state = await makeRequest('GET', '/api/kiosk/state');
    console.log(`   ✅ Kiosk state: mode=${state.data.mode}, activeSurveyId=${state.data.activeSurveyId}`);
  } catch (error) {
    console.log(`   ❌ Failed to get kiosk state: ${error.message}`);
  }

  // Step 3: Get survey templates
  console.log('\n3. Fetching survey templates...');
  let surveyId = null;
  try {
    // We need to login first to access admin endpoints
    // For now, let's try to get a survey directly if we know the ID
    // Or check the kiosk state for active survey
    const state = await makeRequest('GET', '/api/kiosk/state');
    surveyId = state.data.activeSurveyId;
    
    if (!surveyId) {
      console.log('   ⚠️  No active survey. Will use a test survey ID.');
      // Try to get any survey from the database
      surveyId = 'test-survey-id';
    }
    
    const survey = await makeRequest('GET', `/api/kiosk/survey/${surveyId}`);
    if (survey.status === 200) {
      console.log(`   ✅ Survey found: ${survey.data.title} (${survey.data.questions?.length || 0} questions)`);
      console.log(`   Survey ID: ${surveyId}`);
    } else {
      console.log(`   ⚠️  Survey not found (${survey.status}): ${JSON.stringify(survey.data)}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed to fetch survey: ${error.message}`);
  }

  // Step 4: Test survey submission with sample data
  console.log('\n4. Testing survey submission...');
  if (surveyId) {
    const testAnswers = {
      'q1': 5,
      'q2': 'Test answer',
      'q3': 'Option A',
    };
    
    console.log(`   Submitting test response with answers: ${JSON.stringify(testAnswers)}`);
    
    try {
      const submitResult = await makeRequest('POST', '/api/kiosk/survey-response', {
        surveyId: surveyId,
        answers: testAnswers,
        timestamp: new Date().toISOString(),
      });
      
      if (submitResult.status === 201) {
        console.log(`   ✅ Survey submitted successfully!`);
        console.log(`   Response ID: ${submitResult.data.responseId}`);
        console.log(`   Timestamp: ${submitResult.data.timestamp}`);
      } else if (submitResult.status === 404) {
        console.log(`   ⚠️  Survey not found. The survey ID might be invalid.`);
        console.log(`   Response: ${JSON.stringify(submitResult.data)}`);
      } else {
        console.log(`   ❌ Submission failed (${submitResult.status}): ${JSON.stringify(submitResult.data)}`);
      }
    } catch (error) {
      console.log(`   ❌ Submission error: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  Skipping submission test - no valid survey ID');
  }

  // Step 5: Check database directly (if running on Pi)
  console.log('\n5. Checking database directly...');
  try {
    const Database = require('better-sqlite3');
    const dbPath = process.env.DATABASE_PATH || './data/kiosk.db';
    
    console.log(`   Database path: ${dbPath}`);
    
    const db = new Database(dbPath, { readonly: true });
    
    // Check survey_responses table
    const responseCount = db.prepare('SELECT COUNT(*) as count FROM survey_responses').get();
    console.log(`   Total survey responses in DB: ${responseCount.count}`);
    
    // Get last 5 responses
    const recentResponses = db.prepare(`
      SELECT id, survey_id, answers, synced, created_at 
      FROM survey_responses 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    if (recentResponses.length > 0) {
      console.log(`   Last ${recentResponses.length} responses:`);
      recentResponses.forEach((r, i) => {
        const answers = JSON.parse(r.answers || '{}');
        const answerKeys = Object.keys(answers);
        console.log(`   ${i + 1}. ID: ${r.id.substring(0, 8)}... | Survey: ${r.survey_id.substring(0, 8)}... | Answers: ${answerKeys.length} keys | Synced: ${r.synced} | Created: ${r.created_at}`);
        
        // Check if answers is empty
        if (answerKeys.length === 0) {
          console.log(`      ⚠️  WARNING: Empty answers object! This is the async setState bug.`);
        }
      });
    } else {
      console.log('   ⚠️  No survey responses found in database');
    }
    
    // Check WAL status
    const walMode = db.pragma('journal_mode');
    console.log(`\n   Journal mode: ${walMode[0]?.journal_mode || 'unknown'}`);
    
    // Check for WAL files
    const fs = require('fs');
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    
    if (fs.existsSync(walPath)) {
      const walSize = fs.statSync(walPath).size;
      console.log(`   WAL file exists: ${walPath} (${walSize} bytes)`);
      if (walSize > 1000000) {
        console.log(`   ⚠️  WAL file is large. Consider running: PRAGMA wal_checkpoint(TRUNCATE);`);
      }
    }
    
    if (fs.existsSync(shmPath)) {
      console.log(`   SHM file exists: ${shmPath}`);
    }
    
    db.close();
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('   ⚠️  better-sqlite3 not available. Run this script from the backend directory.');
    } else {
      console.log(`   ❌ Database check failed: ${error.message}`);
    }
  }

  // Step 6: Check file permissions
  console.log('\n6. Checking file permissions...');
  try {
    const fs = require('fs');
    const dbPath = process.env.DATABASE_PATH || './data/kiosk.db';
    const dataDir = path.dirname(dbPath);
    
    // Check data directory
    if (fs.existsSync(dataDir)) {
      const dirStats = fs.statSync(dataDir);
      console.log(`   Data directory: ${dataDir}`);
      console.log(`   Permissions: ${(dirStats.mode & 0o777).toString(8)}`);
      console.log(`   Writable: ${fs.accessSync(dataDir, fs.constants.W_OK) === undefined ? 'Yes' : 'No'}`);
    }
    
    // Check database file
    if (fs.existsSync(dbPath)) {
      const dbStats = fs.statSync(dbPath);
      console.log(`   Database file: ${dbPath}`);
      console.log(`   Size: ${dbStats.size} bytes`);
      console.log(`   Permissions: ${(dbStats.mode & 0o777).toString(8)}`);
      
      try {
        fs.accessSync(dbPath, fs.constants.W_OK);
        console.log(`   Writable: Yes`);
      } catch {
        console.log(`   ⚠️  Writable: No - This could cause issues!`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Permission check failed: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Diagnostic Summary');
  console.log('='.repeat(60));
  console.log(`
Common issues and solutions:

1. Empty answers {} in database:
   → This is the async setState bug
   → Check SurveyMode.tsx - ensure answers are captured before setState

2. Survey not found (404):
   → No active survey configured
   → Set a survey in admin panel: Admin → Kiosk Control → Survey Mode

3. Database not writable:
   → Fix permissions: sudo chown -R $USER:$USER ~/spa-kiosk/data
   → Or: chmod 755 ~/spa-kiosk/data && chmod 644 ~/spa-kiosk/data/kiosk.db

4. WAL file too large:
   → Run checkpoint: sqlite3 data/kiosk.db "PRAGMA wal_checkpoint(TRUNCATE);"

5. Backend not running:
   → Start with: pm2 start kiosk-backend
   → Check logs: pm2 logs kiosk-backend
`);
}

runDiagnostics().catch(console.error);
