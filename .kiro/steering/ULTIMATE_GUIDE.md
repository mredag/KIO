# Ultimate Kiro Steering Guide

**Purpose:** Single-source reference for all critical patterns, commands, and solutions. Start here for any task.

---

## 🎯 Core Principles

1. **Database is source of truth** - Never hardcode dynamic content
2. **setState is async** - Never use state immediately after setState  
3. **Transform at API boundary** - Backend (snake_case) → Frontend (camelCase)
4. **Test UI changes** - Run Puppeteer after UI/UX work
5. **Minimal documentation** - Code speaks, brief summaries only

---

## 🚨 Critical Bug Patterns (Top 3)

### 1. Async setState Bug ⚠️ MOST COMMON
**Symptom:** Empty data `{}` saved to database  
**Cause:** Using state immediately after setState

```typescript
// ❌ WRONG
setAnswers(prev => ({ ...prev, [id]: value }));
submitResponse({ answers }); // Empty!

// ✅ CORRECT
const newAnswers = { ...answers, [id]: value };
setAnswers(newAnswers);
submitResponse({ answers: newAnswers });
```

**Triggers:** Auto-advance, form submit, setTimeout with state

---

### 2. Hardcoded Dynamic Content ⚠️ VERY COMMON
**Symptom:** Content doesn't update when changed in admin  
**Cause:** Using i18n/hardcoded values instead of database

```typescript
// ❌ WRONG
<p>{t('survey.question1')}</p>

// ✅ CORRECT
<p>{survey.questions[index].text}</p>
```

**Triggers:** Surveys, forms, menus, any DB-driven content

---

### 3. snake_case vs camelCase Mismatch
**Symptom:** "Cannot read properties of undefined"  
**Cause:** Backend returns snake_case, frontend expects camelCase

```typescript
// ✅ Transform in API hooks
function transformData(data: any) {
  return {
    purposeTags: data.purpose_tags || [],
    isFeatured: data.is_featured === 1,
  };
}
```

**Location:** `frontend/src/hooks/useAdminApi.ts` or `useKioskApi.ts`

---

## 📋 Quick Decision Tree

| Symptom | Cause | Solution |
|---------|-------|----------|
| Empty `{}` in DB | Async setState | Use new value directly |
| Content not updating | Hardcoded | Render from database |
| Property undefined | snake_case mismatch | Add transform in API hook |
| Port in use | Process conflict | Kill all node processes |
| Connection refused | Server not ready | Wait 8-10 seconds |
| Not iterable | Wrong data type | Add Array.isArray() check |

---

## 🔧 Essential Commands

### Server Management
```powershell
# Check processes
listProcesses

# Kill all node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start servers (wait 8-10 sec after)
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")
timeout /t 10 /nobreak
```

### Testing & Debugging
```bash
# UI test
node test-my-app-now.js

# E2E tests
npm run test:e2e --workspace=backend

# Health check
curl http://localhost:3001/api/kiosk/health

# DB check
node -e "const db = require('better-sqlite3')('./data/kiosk.db'); console.log(db.prepare('SELECT COUNT(*) FROM massages').get()); db.close();"
```

---

## ✅ Implementation Checklist

### Before Coding
- [ ] Check database schema - what fields exist?
- [ ] Will this data change dynamically?
- [ ] Do I need state immediately after setState?
- [ ] Is data snake_case or camelCase?

### After Coding
- [ ] Run Puppeteer tests for UI changes
- [ ] Verify data persistence in database
- [ ] Check browser console for errors
- [ ] Test on mobile viewport (375x667px)

### Code Quality
- [ ] Transform data in API hooks, not components
- [ ] Use dynamic state: `Record<string, any>`
- [ ] Detect data changes: `useEffect(() => {}, [data?.id])`
- [ ] Map over arrays, don't hardcode elements

---

## 🎓 Key Patterns

### Dynamic State Management
```typescript
// ✅ Flexible for any number of items
const [answers, setAnswers] = useState<Record<string, any>>({});
const [currentIndex, setCurrentIndex] = useState(0);

// ✅ Reset when data changes
useEffect(() => {
  resetState();
}, [data?.id, resetState]);
```

### Data Transformation (API Hooks)
```typescript
// ✅ Transform at boundary
export function useData() {
  return useQuery({
    queryKey: ['data'],
    queryFn: async () => {
      const response = await api.get('/endpoint');
      return response.data.map(transformData);
    },
  });
}

function transformData(data: any) {
  return {
    purposeTags: data.purpose_tags || [],
    isFeatured: data.is_featured === 1,
  };
}
```

### Dynamic Rendering
```typescript
// ✅ Always map from database
{items.map((item, index) => (
  <div key={item.id}>
    <h3>{item.title}</h3>
    <p>{item.description}</p>
  </div>
))}
```

---

## 🚀 Deployment (Raspberry Pi)

### Critical Steps
1. Remove test files: `find src -name "*.test.ts" -delete`
2. Set `NODE_ENV=production` in `.env`
3. Never copy node_modules - always `npm install` on target
4. Frontend served on port 3001 (not 3000) in production
5. Use relative URLs (`/api`) for network portability

### Verification
```bash
pm2 status  # Should show: kiosk-backend | online
curl http://localhost:3001/api/kiosk/health  # {"status":"ok"}
grep NODE_ENV ~/spa-kiosk/backend/.env  # NODE_ENV=production
```

---

## 🎯 Project Configuration

### URLs
- **Frontend Dev:** http://localhost:3000 (Vite)
- **Backend Dev:** http://localhost:3001 (Express)
- **Production:** http://localhost:3001 (single server)

### Architecture
- **Dev:** Separate frontend (3000) + backend (3001)
- **Prod:** Backend serves frontend on 3001
- **Database:** SQLite with snake_case fields
- **Frontend:** React + TypeScript with camelCase

### Testing
- **Unit:** `npm run test --workspace=backend`
- **E2E:** `npm run test:e2e --workspace=backend`
- **UI:** `node test-my-app-now.js`

---

## 📝 Documentation Policy

**DO NOT create:**
- Implementation reports
- Feature summaries
- User guides (unless requested)
- Verification reports

**DO:**
- Brief 2-3 sentence summary after feature
- Update steering files for new patterns only
- Update README for major changes only

---

## 🔗 Detailed Steering Files

Use these for deep dives on specific topics:

- **react-state-async.md** - setState patterns, examples, testing
- **dynamic-data-rendering.md** - Dynamic rendering, red flags
- **data-transformation.md** - Full transformation patterns
- **ui-ux-testing.md** - Puppeteer testing, server management
- **process-management.md** - Server lifecycle, timing
- **troubleshooting-quick-reference.md** - 10 common errors
- **deployment-raspberry-pi.md** - Full deployment process
- **minimal-documentation.md** - Documentation policy

---

## 🛠️ Troubleshooting Quick Reference

### Full Reset (when all else fails)
```powershell
# 1. Kill all node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
timeout /t 3 /nobreak

# 2. Start backend
controlPwshProcess(action: "start", path: "backend", command: "npm run dev")
timeout /t 10 /nobreak

# 3. Start frontend
controlPwshProcess(action: "start", path: "frontend", command: "npm run dev")
timeout /t 10 /nobreak

# 4. Test
node test-my-app-now.js
```

### Common Fixes
- **Port in use:** Kill all node, wait 3 sec, restart
- **Connection refused:** Wait 8-10 sec for server startup
- **Property undefined:** Add transform function in API hook
- **Empty data in DB:** Use new value directly, not state
- **Content not updating:** Render from database, not i18n

---

## ✨ Success Metrics

This guide has solved:
- ✅ Async setState bugs (empty survey answers)
- ✅ Hardcoded content (questions not updating)
- ✅ Data transformation errors (property access)
- ✅ Server startup issues (port conflicts)
- ✅ Database persistence problems
- ✅ UI/UX regressions

**Result:** 100% test pass rate, production-ready system

---

**Last Updated:** 2025-11-28  
**Status:** ✅ Active and tested  
**Coverage:** All critical patterns documented
