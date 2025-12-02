# Survey Recording Issue on Raspberry Pi - Troubleshooting Guide

## Quick Diagnosis Steps

### 1. SSH into the Pi and check backend logs
```bash
ssh eform-kio@192.168.1.5
pm2 logs kiosk-backend --lines 50
```

Look for:
- `[Survey] Received submission:` - Shows what data was received
- `[Survey] WARNING: Empty answers object` - Indicates async setState bug
- `[Survey] Response saved:` - Confirms database write

### 2. Run the diagnostic script
```bash
cd ~/spa-kiosk
node scripts/diagnose-survey-pi.js
```

### 3. Check database directly
```bash
cd ~/spa-kiosk/backend
sqlite3 ../data/kiosk.db "SELECT id, survey_id, answers, created_at FROM survey_responses ORDER BY created_at DESC LIMIT 5;"
```

## Common Issues and Solutions

### Issue 1: Empty Answers `{}` in Database
**Symptom:** Survey responses are saved but `answers` column contains `{}`

**Cause:** Async setState bug - the frontend submits before React state is updated

**Solution:** Already fixed in SurveyMode.tsx - ensure you have the latest code:
```typescript
// ✅ CORRECT - Pass newAnswers directly
const newAnswers = { ...answers, [questionId]: value };
setAnswers(newAnswers);
submitResponse({ surveyId: survey.id, answers: newAnswers });
```

### Issue 2: Survey Not Found (404)
**Symptom:** Backend returns 404 when submitting survey

**Cause:** No active survey configured or survey ID mismatch

**Solution:**
1. Check kiosk state: `curl http://localhost:3001/api/kiosk/state`
2. Set active survey in admin panel: Admin → Kiosk Control → Survey Mode

### Issue 3: Database Permission Issues
**Symptom:** Backend crashes or fails to write

**Cause:** File permissions on Pi

**Solution:**
```bash
sudo chown -R $USER:$USER ~/spa-kiosk/data
chmod 755 ~/spa-kiosk/data
chmod 644 ~/spa-kiosk/data/kiosk.db
```

### Issue 4: WAL File Issues
**Symptom:** Data appears to save but disappears after restart

**Cause:** WAL (Write-Ahead Log) not checkpointed

**Solution:**
```bash
cd ~/spa-kiosk/backend
sqlite3 ../data/kiosk.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### Issue 5: Network/CORS Issues
**Symptom:** Frontend shows error, backend never receives request

**Cause:** CORS or network configuration

**Solution:**
1. Check browser console (F12) for CORS errors
2. Verify `NODE_ENV=production` in backend `.env`
3. Ensure frontend is served from backend (same origin)

## Verification Commands

### Check if backend is running
```bash
pm2 status
curl http://localhost:3001/api/kiosk/health
```

### Check survey responses count
```bash
sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT COUNT(*) FROM survey_responses;"
```

### Check recent responses with answers
```bash
sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT id, LENGTH(answers), created_at FROM survey_responses ORDER BY created_at DESC LIMIT 10;"
```

### Check for empty answers
```bash
sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT COUNT(*) FROM survey_responses WHERE answers = '{}';"
```

### Restart backend after code changes
```bash
cd ~/spa-kiosk/backend
pm2 restart kiosk-backend
pm2 logs kiosk-backend --lines 20
```

## Deploy Updated Code to Pi

If you've made changes to fix the issue:

```bash
# From Windows development machine
cd C:\path\to\spa-kiosk

# Copy updated backend files
scp backend/src/routes/kioskRoutes.ts eform-kio@192.168.1.5:~/spa-kiosk/backend/src/routes/
scp scripts/diagnose-survey-pi.js eform-kio@192.168.1.5:~/spa-kiosk/scripts/

# SSH and rebuild
ssh eform-kio@192.168.1.5
cd ~/spa-kiosk/backend
npm run build
pm2 restart kiosk-backend
```

## Expected Log Output (Working)

When a survey is submitted correctly, you should see:
```
[Survey] Received submission: { surveyId: 'abc123', answersType: 'object', answersKeys: ['q1', 'q2', 'q3'], answersEmpty: false, bodyKeys: ['surveyId', 'answers', 'timestamp', 'id', 'synced'] }
[Survey] Response saved: { responseId: 'xyz789', savedAnswers: { q1: 5, q2: 'Good', q3: 'Option A' }, savedAnswersKeys: ['q1', 'q2', 'q3'] }
```

## Expected Log Output (Bug)

If the async setState bug is occurring:
```
[Survey] Received submission: { surveyId: 'abc123', answersType: 'object', answersKeys: [], answersEmpty: true, bodyKeys: ['surveyId', 'answers', 'timestamp', 'id', 'synced'] }
[Survey] WARNING: Empty answers object received! This may indicate async setState bug in frontend.
```
