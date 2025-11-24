# Troubleshooting Quick Reference

## Common Errors & Instant Solutions

### 1. "Cannot read properties of undefined (reading 'X')"

**Symptoms:**
```
Cannot read properties of undefined (reading 'length')
Cannot read properties of undefined (reading 'purposeTags')
```

**Cause:** Data type mismatch - backend returns snake_case, frontend expects camelCase

**Solution:**
1. Check `data-transformation.md` steering file
2. Add transformation function in API hook
3. Example:
```typescript
function transformData(data: any) {
  return {
    purposeTags: data.purpose_tags || [],
    isFeatured: data.is_featured === 1,
  };
}
```

**Files to check:**
- `frontend/src/hooks/useAdminApi.ts`
- `frontend/src/hooks/useKioskApi.ts`

---

### 2. "X is not iterable"

**Symptoms:**
```
massages is not iterable
TypeError: X is not iterable
```

**Cause:** Variable is object instead of array, or undefined

**Solution:**
```typescript
// Add safety check
const items = data && Array.isArray(data) 
  ? [...data].sort(...)
  : [];
```

**Files to check:**
- Component files trying to map/spread data
- Check API response format in Network tab

---

### 3. "No routes matched location"

**Symptoms:**
```
No routes matched location "/admin/massages/new"
```

**Cause:** Missing route definition

**Solution:**
Add route to `frontend/src/App.tsx`:
```typescript
<Route
  path="/admin/massages/new"
  element={
    <ProtectedRoute>
      <MassageFormPage />
    </ProtectedRoute>
  }
/>
```

---

### 4. "listen EADDRINUSE: address already in use"

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Cause:** Port already occupied by another process

**Solution:**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
timeout /t 3 /nobreak
# Then restart servers
```

---

### 5. Data Not Persisting to Database

**Symptoms:**
- API returns empty array
- Database shows 0 records after creation
- Changes disappear after backend restart

**Causes & Solutions:**

**A. Hot Reload Not Detecting Changes**
```bash
# Restart backend
controlPwshProcess(action: "stop", processId: X)
timeout /t 3 /nobreak
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
timeout /t 10 /nobreak
```

**B. WAL Checkpoint Issue**
```javascript
const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');
db.pragma('wal_checkpoint(FULL)');
db.close();
```

**C. Use Direct Database Insertion**
```bash
node insert-massages-direct.js
```

---

### 6. "Something went wrong" Error Boundary

**Symptoms:**
- Page shows generic error message
- Error boundary catches exception

**Debugging Steps:**
1. Check browser console for actual error
2. Look for property access errors
3. Check data transformation
4. Verify API response format
5. Add null checks

**Common Causes:**
- Missing data transformation
- Undefined properties
- Type mismatches
- Missing null checks

---

### 7. Kiosk Shows "No massages available"

**Symptoms:**
- Kiosk displays empty state
- API returns empty arrays
- Database has records

**Debugging Steps:**

**Step 1: Check API**
```bash
curl http://localhost:3001/api/kiosk/menu
```

**Step 2: Check Database**
```javascript
const db = new Database('./data/kiosk.db');
const count = db.prepare('SELECT COUNT(*) FROM massages').get();
console.log('Count:', count);
db.close();
```

**Step 3: Check Transformation**
- Verify transformation function exists in `useKioskApi.ts`
- Check browser console for errors
- Verify data format matches frontend types

**Step 4: Clear Cache**
```javascript
// In browser console
localStorage.clear();
location.reload();
```

---

### 8. Backend Not Responding

**Symptoms:**
- Connection refused errors
- Timeout errors
- No response from API

**Solution:**
```bash
# Check if backend is running
listProcesses

# Check backend logs
getProcessOutput(processId: X, lines: 20)

# Restart if needed
controlPwshProcess(action: "stop", processId: X)
timeout /t 3 /nobreak
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
timeout /t 10 /nobreak
```

---

### 9. Frontend Not Updating

**Symptoms:**
- Changes not visible
- Old data still showing
- Stale cache

**Solution:**
```bash
# Hard refresh browser
Ctrl + Shift + R (Windows)
Cmd + Shift + R (Mac)

# Or clear cache programmatically
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

### 10. Puppeteer Test Failures

**Symptoms:**
- Tests timeout
- Elements not found
- Navigation fails

**Solutions:**

**A. Wait Longer**
```javascript
await new Promise(resolve => setTimeout(resolve, 3000));
```

**B. Check Selectors**
```javascript
// Try multiple selectors
const button = await page.$('button[type="submit"]') ||
               await page.$('button:has-text("Submit")');
```

**C. Verify Servers Running**
```bash
listProcesses
# Should show both backend and frontend
```

**D. Check Screenshots**
```bash
# Screenshots show what Puppeteer sees
explorer my-app-screenshots
```

---

## Quick Diagnostic Commands

### Check Everything
```bash
# 1. Check processes
listProcesses

# 2. Check backend health
curl http://localhost:3001/api/kiosk/health

# 3. Check frontend
curl http://localhost:3000

# 4. Check database
node -e "const db = require('better-sqlite3')('./data/kiosk.db'); console.log(db.prepare('SELECT COUNT(*) FROM massages').get()); db.close();"

# 5. Run test
node test-kiosk-page.js
```

### Full Reset
```bash
# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait
timeout /t 3 /nobreak

# Start backend
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")

# Wait
timeout /t 10 /nobreak

# Start frontend
controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")

# Wait
timeout /t 10 /nobreak

# Test
node test-kiosk-page.js
```

---

## Prevention Checklist

Before making changes:
- ✅ Check existing steering files
- ✅ Understand data flow (backend → API → frontend)
- ✅ Know the transformation requirements
- ✅ Have test scripts ready
- ✅ Know how to restart servers

After making changes:
- ✅ Run Puppeteer tests
- ✅ Check browser console
- ✅ Verify API responses
- ✅ Check database directly
- ✅ Test on mobile viewport
- ✅ Document any new issues

---

## When to Use Each Steering File

### data-transformation.md
- Property access errors
- Type mismatches
- snake_case/camelCase issues
- Boolean conversion problems

### ui-ux-testing.md
- After UI changes
- Visual verification needed
- Accessibility checks
- Responsive design testing

### process-management.md
- Server startup issues
- Port conflicts
- Process management
- Timing problems

### troubleshooting-quick-reference.md (this file)
- Quick error lookup
- Instant solutions
- Diagnostic commands
- Common patterns

---

## Emergency Contacts

If all else fails:
1. Check `FINAL_SUCCESS_REPORT.md` for working state
2. Review `MASSAGE_CREATION_REPORT.md` for detailed process
3. Check git history for recent changes
4. Restart everything from scratch
5. Document new issues in steering files
