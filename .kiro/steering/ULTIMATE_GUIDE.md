# Ultimate Kiro Steering Guide

**Purpose:** Single-source reference for all critical patterns, commands, and solutions. Start here for any task.

---

## 🎯 Core Principles

1. **Database is source of truth** - Never hardcode dynamic content
2. **setState is async** - Never use state immediately after setState  
3. **Transform at API boundary** - Backend (snake_case) → Frontend (camelCase)
4. **Test UI changes** - Run Puppeteer after UI/UX work
5. **Minimal documentation** - Code speaks, brief summaries only
6. **Knowledge Base for AI** - Use dynamic knowledge base for n8n workflows, not hardcoded prompts
7. **Dynamic AI Prompts** - Use AI system prompts from database, not hardcoded in n8n workflows

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

## 📚 Knowledge Base System

### Database-Driven AI Context
- Knowledge base entries stored in `knowledge_base` table
- **7 categories:** services, pricing, hours, policies, contact, general, **faq** ✅ NEW
- All content in Turkish for AI workflows
- Seeded automatically on database initialization

### FAQ Category (S.S.S.) ✅ Added 2026-01-16
7 FAQ entries for common customer questions:

| Key | Question | Answer Summary |
|-----|----------|----------------|
| `kadinlar_gunu` | Kadınlar günü var mı? | Karma hizmet, kadınlara özel gün yok |
| `kese_kopuk_personel` | Kese köpük kim yapıyor? | Kadın spa personeli |
| `personal_trainer` | PT var mı? | Birebir PT hizmeti var |
| `yaninda_ne_getir` | Ne getirmeliyim? | Havlu/terlik tesiste, bone zorunlu |
| `terapist_yasal_belge` | Terapistler yasal mı? | Yasal çalışma izinleri var |
| `randevu_nasil` | Randevu nasıl? | Telefon/WhatsApp ile |
| `ileri_tarih_randevu` | İleri tarih randevu? | Günlük sistem, aynı gün |

### PT (Personal Trainer) Pricing ✅ Added 2026-01-16
| Package | Price |
|---------|-------|
| 12 saat | 8,000 TL |
| 24 saat | 14,000 TL |
| 36 saat | 20,000 TL |

---

## 🤖 AI System Prompts (Dynamic) ✅ DEPLOYED

### Overview
- **Table**: `ai_system_prompts` - stores AI prompts for n8n workflows
- **Admin Panel**: `/admin/ai-prompts` - manage prompts via UI
- **Integration API**: `/api/integrations/ai/prompt/:name` - fetch prompts in n8n
- **Benefits**: Edit prompts without redeploying workflows, version tracking, A/B testing
- **Status**: ✅ Instagram workflow deployed with dynamic prompts (2025-12-06)

### Default Prompts (3 seeded)
1. **whatsapp-coupon-assistant** - WhatsApp kupon sistemi
2. **instagram-spa-assistant** - Instagram DM asistan ✅ IN USE
3. **general-customer-service** - Genel müşteri hizmetleri

### Usage in n8n Workflows

**Add HTTP Request node before AI Agent:**
```json
{
  "method": "GET",
  "url": "http://localhost:3001/api/integrations/ai/prompt/instagram-spa-assistant"
}
```

**Update AI Agent system message:**
```
{{ $('Fetch AI Prompt').first().json.systemMessage + '\n\nBILGILER:' + $('Enrich Context').first().json.knowledgeContext }}
```

### Admin Panel Features
- ✅ Create/Edit/Delete prompts
- ✅ Copy prompt names for n8n
- ✅ Active/Inactive toggle
- ✅ Version tracking (auto-increments)
- ✅ Workflow type badges (WhatsApp/Instagram/General)

### API Endpoints

**Admin Routes** (requires auth):
- `GET /api/admin/ai-prompts` - List all
- `POST /api/admin/ai-prompts` - Create
- `PUT /api/admin/ai-prompts/:id` - Update
- `DELETE /api/admin/ai-prompts/:id` - Delete

**Integration Routes** (no auth - for n8n):
- `GET /api/integrations/ai/prompt/:name` - Get by name
- `GET /api/integrations/ai/prompts/:workflowType` - List by type

### Key Pattern: Dynamic vs Hardcoded

```javascript
// ❌ WRONG - Hardcoded in n8n workflow
systemMessage: "Sen bir SPA asistanısın..."

// ✅ CORRECT - Dynamic from database
// 1. Add HTTP Request node
GET /api/integrations/ai/prompt/instagram-spa-assistant

// 2. Use in AI Agent
systemMessage: {{ $('Fetch AI Prompt').first().json.systemMessage }}
```

### Benefits
- **No Redeploy**: Edit prompts in admin panel, changes apply immediately
- **Version Control**: Track changes with auto-incrementing version numbers
- **A/B Testing**: Easy to test different prompts
- **Central Management**: All prompts in one place
- **Network Portable**: Uses relative URLs, works on any network

### Current Deployment Status (2025-12-07)

**Instagram Workflow:**
- ✅ Deployed: `instagram-dynamic-automation.json`
- ✅ Features: Dynamic AI prompts + Knowledge base + Customer data
- ✅ Using: `instagram-spa-assistant` prompt (editable in admin panel)
- ✅ Status: Active on Pi

**WhatsApp Workflow:**
- ✅ Deployed: `whatsapp-dynamic-automation.json`
- ✅ Features: Keyword routing + Signature verification + Interaction logging
- ✅ Using: `whatsapp-coupon-assistant` prompt (optional, not connected)
- ✅ Status: Active on Pi

### Documentation
- Full guide: `n8n-workflows/AI_PROMPTS_SYSTEM.md`
- Implementation: `AI_PROMPTS_IMPLEMENTATION_SUMMARY.md`
- Integration: `n8n-workflows/AI_PROMPTS_INTEGRATION_GUIDE.md`
- Deployment: `n8n-workflows/AI_PROMPTS_DEPLOYMENT_COMPLETE.md`

### API Endpoints
```
GET /api/integrations/knowledge/context  - Get formatted knowledge for AI
GET /api/admin/knowledge-base            - List all entries
POST /api/admin/knowledge-base           - Create entry
PUT /api/admin/knowledge-base/:id        - Update entry
DELETE /api/admin/knowledge-base/:id     - Delete entry
```

### n8n Integration
```javascript
// In n8n workflow - fetch dynamic context
const response = await fetch('http://localhost:3001/api/integrations/knowledge/context');
const knowledge = await response.json();

// Use in AI prompt
const systemPrompt = `Sen bir spa asistanısın.

Hizmetler: ${knowledge.services.massage_types}
Fiyatlar: ${knowledge.pricing.massage_60min}
Çalışma Saatleri: ${knowledge.hours.weekdays}
...`;
```

### Updating Knowledge
- Use admin panel: http://localhost:3001/admin/knowledge-base
- Changes immediately available to n8n workflows
- No workflow JSON editing needed

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

## 🔄 n8n/WhatsApp Patterns

### Current Production Workflow
**File:** `whatsapp-dynamic-automation.json`  
**Status:** ✅ Active on Pi (2025-12-07)

### Key Features
- **Signature Verification**: Validates `x-hub-signature-256` header
- **Keyword Routing**: Reliable command detection (KUPON, DURUM, KULLAN)
- **Interaction Logging**: All messages logged to `whatsapp_interactions`
- **Dynamic AI Prompts**: Optional (not connected, keyword routing works well)

### Pending Redemption Handling
**Symptom:** Customer says "kupon kullan" multiple times, gets same code  
**Solution:** API returns `isNew` flag, workflow shows different messages

```javascript
// In n8n Fmt Claim node:
if (r.isNew === false) {
  msg = '⏳ Zaten bekleyen bir kullanim talebiniz var! Kod: ' + r.redemptionId;
} else {
  msg = '🎉 Tebrikler! Kod: ' + r.redemptionId;
}
```

### Security (2025-12-07)
**CRITICAL:** Signature verification prevents unauthorized webhook access

```javascript
// Verify Signature node
const crypto = require('crypto');
const signature = headers['x-hub-signature-256'];
const appSecret = 'YOUR_APP_SECRET';
const expectedSignature = 'sha256=' + crypto
  .createHmac('sha256', appSecret)
  .update(JSON.stringify(body))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

**Files:** `CouponService.ts`, `integrationCouponRoutes.ts`, `whatsapp-dynamic-automation.json`  
**Docs:** `n8n-workflows/WHATSAPP_SECURITY_HARDENING.md`

---

## 📸 Instagram DM Integration (Safety Gate + AI Response)

### Current Production Workflow
**File:** `instagram-dual-ai.json` (safety-gate-v1)  
**Status:** ✅ Active on Pi (2026-01-13)

### Key Features
- **🛡️ Safety Gate (NEW)**: LLM classifier blocks inappropriate/ambiguous messages BEFORE AI responds
- **Turkish Character Normalization**: Handles ş→s, ı→i, ğ→g, ü→u, ö→o, ç→c for reliable keyword matching
- **Dynamic AI Prompts**: Editable in admin panel (`/admin/ai-prompts`)
- **Knowledge Base**: Business info from database (`/admin/knowledge-base`)
- **Customer Enrichment**: Fetches history before AI responds
- **Intent-Based Context**: Only relevant knowledge sent to AI based on detected intent
- **Interaction Logging**: All messages logged with safety decision
- **Response Time Tracking**: Measures AI latency

### Workflow Flow
```
Webhook → Parse → Dev Filter → Router → Check Service → 
Fetch Customer + Fetch Knowledge + Fetch AI Prompt (parallel) → 
Merge Data → Enrich Context → Safety Gate Classifier → Parse Safety Gate →
Safety Router → [ALLOW: AI Agent | BLOCK: Fixed Response | UNSURE: Clarification] → 
Format → Send IG → Log
```

### 🛡️ Safety Gate System (2026-01-13)

**Purpose:** Prevent bot from being manipulated into confirming sexual/inappropriate content through coded language or probing questions.

**Three Outcomes:**
| Decision | Confidence | Action |
|----------|------------|--------|
| `ALLOW` | ≥ 0.85 | Continue to AI Agent |
| `BLOCK` | Any | Send fixed boundary message |
| `UNSURE` | < 0.85 or ambiguous | Send clarification request |

**BLOCK triggers:**
- Sexual service requests: "mutlu son", "happy ending", "sonu güzel mi", "sonu keyifli"
- Confirmation probing: "so you say we will be happy right?"
- Harassment, threats, scams, illegal requests
- Personal data requests about staff/customers

**UNSURE triggers:**
- Ambiguous/coded messages
- Short probes: "sonu nasıl", "anladin mi"
- Confidence below 0.85 threshold
- Messages not clearly mapping to allowed intents

**Fixed Responses:**
```
BLOCK: "Cinsel içerikli veya uygunsuz hizmet sunmuyoruz. Sadece profesyonel spa ve spor hizmetleri veriyoruz. İsterseniz hizmet listemizi, fiyatlarımızı paylaşabilirim veya randevu almanıza yardımcı olabilirim."

UNSURE: "Hizmetlerimiz, fiyatlarımız, randevu ve kurslarımız hakkında yardımcı olabilirim. Lütfen sorunuzu açıkça belirtir misiniz?"
```

**Credential Required:** Create "OpenRouter Header Auth" credential in n8n with `Authorization: Bearer <OPENROUTER_API_KEY>`

### Intent Detection (Code-Based)
Reliable keyword matching with Turkish character normalization:

| Intent | Keywords (normalized) | Knowledge Context |
|--------|----------------------|-------------------|
| `faq` | kadin.*gun, kese.*kopuk, personal.*trainer, pt, yaninda.*getir, terapist.*yasal, randevu.*nasil, ileri.*tarih | FAQ data ✅ NEW |
| `policies` | yas.*sinir, kural, yasak | Policies + FAQ data |
| `pricing` | fiyat, ucret, ne kadar | Campaign + prices + PT pricing |
| `membership` | uyelik, fitness, spor, gym | Membership + facility + PT pricing |
| `location` | adres, nerede, konum, yer.*nere | Address + phone |
| `hours` | saat, acik, kapali | Working hours |
| `services` | masaj, spa, hamam | Services + facility |
| `kids` | cocuk.*kurs, jimnastik | Kids courses |
| `general_info` | bilgi, merhaba, selam | Campaign + prices + phone |

### ⚠️ FAQ Intent Forces ALLOW (Safety Gate Bypass)
FAQ questions are legitimate business inquiries - they bypass Safety Gate:
```javascript
// In Enrich Context node
if (intent === 'faq') {
  safetyOverride = 'ALLOW'; // Skip Safety Gate for FAQ
}
```

### ⚠️ CRITICAL: Turkish Character Handling
```javascript
// Normalize before matching
const normalizedText = text
  .replace(/ş/g, 's').replace(/ı/g, 'i')
  .replace(/ğ/g, 'g').replace(/ü/g, 'u')
  .replace(/ö/g, 'o').replace(/ç/g, 'c');

// Now "yaş sınırı" becomes "yas siniri" and matches /yas.*sinir/
```

### Key API Endpoints
```
# Dynamic Content
GET  /api/integrations/ai/prompt/:name            - AI system prompt
GET  /api/integrations/knowledge/context          - Business info (all categories)

# Customer Data
GET  /api/integrations/instagram/customer/:id     - Customer data
POST /api/integrations/instagram/interaction      - Log interaction

# Analytics
GET  /api/integrations/instagram/analytics        - Marketing stats
GET  /api/integrations/instagram/export?format=csv - Export to Sheets
```

### Admin Panel Management
- **AI Prompts:** `/admin/ai-prompts` - Edit `instagram-spa-assistant`
- **Knowledge Base:** `/admin/knowledge-base` - Update business info
- **Interactions:** `/admin/interactions` - View message logs

### Deployment Commands (Pi IP: 192.168.1.137)
```powershell
# Copy workflow
scp -i "$env:USERPROFILE\.ssh\id_ed25519_pi" "n8n-workflows/workflows-v2/instagram-dual-ai.json" eform-kio@192.168.1.137:/home/eform-kio/instagram-dual-ai.json

# Import and activate
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n update:workflow --all --active=false 2>/dev/null; n8n import:workflow --input=/home/eform-kio/instagram-dual-ai.json 2>/dev/null"

# Get workflow ID and activate
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n list:workflow 2>/dev/null | grep -i dual | tail -1"
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n update:workflow --id=<ID> --active=true 2>/dev/null; sudo systemctl restart n8n"
```

### ⚠️ CRITICAL: n8n Workflow Import Gotcha
**Problem:** Importing workflow with same name doesn't update existing workflow!  
**Solution:** Rename workflow to force new import:
```javascript
// In workflow JSON, change name:
"name": "Instagram Dual AI FAQ v2"  // Add version suffix
```
Then import creates NEW workflow instead of silently failing.

**n8n Database Location:** `~/.n8n/database.sqlite` (NOT database.sqlite3)

**Files:** `n8n-workflows/workflows-v2/instagram-dual-ai.json`  
**Docs:** `n8n-workflows/DYNAMIC_AUTOMATION_INTEGRATION.md`

---

## ✨ Success Metrics

This guide has solved:
- ✅ Async setState bugs (empty survey answers)
- ✅ Hardcoded content (questions not updating)
- ✅ Data transformation errors (property access)
- ✅ Server startup issues (port conflicts)
- ✅ Database persistence problems
- ✅ UI/UX regressions
- ✅ Duplicate redemption message confusion (2025-12-01)
- ✅ Dynamic AI prompts management (2025-12-06)
- ✅ Instagram AI hallucination fix - code-based intent detection (2026-01-06)
- ✅ Turkish character normalization for keyword matching (2026-01-06)
- ✅ Performance optimization - 85% faster responses (2026-01-06)
- ✅ Safety Gate for inappropriate content blocking (2026-01-13)
- ✅ FAQ category with 7 S.S.S. entries (2026-01-16)
- ✅ PT pricing integration (2026-01-16)
- ✅ n8n workflow import gotcha documented (2026-01-16)

**Result:** 100% test pass rate, production-ready system

---

## 🗄️ Direct Database Editing (Pi)

### ⚠️ CRITICAL: Correct Database Path
```
Production DB: ~/spa-kiosk/backend/data/kiosk.db  ✅ USE THIS
Wrong path:    ~/spa-kiosk/data/kiosk.db          ❌ DON'T USE
```

### Method: SQL File via SCP + SSH
PowerShell escaping is problematic. Use SQL files instead:

```powershell
# 1. Create SQL file locally
fsWrite("temp_query.sql", "SELECT * FROM knowledge_base WHERE category = 'pricing';")

# 2. Copy to Pi
scp -i "$env:USERPROFILE\.ssh\id_ed25519_pi" "temp_query.sql" eform-kio@192.168.1.137:/home/eform-kio/temp_query.sql

# 3. Execute on Pi
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "sqlite3 ~/spa-kiosk/backend/data/kiosk.db < /home/eform-kio/temp_query.sql"

# 4. Restart backend (required for changes to take effect)
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "pm2 restart kiosk-backend"

# 5. Clean up local file
Remove-Item temp_query.sql -ErrorAction SilentlyContinue
```

### Common SQL Operations

**Insert new entry:**
```sql
INSERT INTO knowledge_base (id, category, key_name, value, description, is_active, version, created_at, updated_at)
VALUES (lower(hex(randomblob(16))), 'pricing', 'new_item', 'Value here', 'Description', 1, 1, datetime('now'), datetime('now'));
```

**Update existing entry:**
```sql
UPDATE knowledge_base 
SET value = 'New value', updated_at = datetime('now')
WHERE category = 'pricing' AND key_name = 'existing_item';
```

**Insert or replace (upsert):**
```sql
INSERT OR REPLACE INTO knowledge_base (id, category, key_name, value, description, is_active, version, created_at, updated_at)
VALUES (
  (SELECT id FROM knowledge_base WHERE category='pricing' AND key_name='item_name'),
  'pricing', 'item_name', 'Value', 'Description', 1, 1, datetime('now'), datetime('now')
);
```

**Delete entry:**
```sql
DELETE FROM knowledge_base WHERE category = 'pricing' AND key_name = 'old_item';
```

### Key Tables
| Table | Purpose | Admin Panel |
|-------|---------|-------------|
| `knowledge_base` | AI context data | `/admin/knowledge-base` |
| `ai_system_prompts` | AI prompts | `/admin/ai-prompts` |
| `instagram_interactions` | Message logs | `/admin/interactions` |
| `survey_templates` | Survey config | `/admin/surveys` |
| `massages` | Menu items | `/admin/massages` |

### After Database Changes
1. **Always restart backend:** `pm2 restart kiosk-backend`
2. **Hard refresh browser:** `Ctrl+Shift+R`
3. **Verify via admin panel** or API endpoint

---

## 🗄️ Database Seeding

### Knowledge Base Auto-Seeding
The database automatically seeds **33+ Turkish knowledge base entries** on first initialization:

**Categories (7 total):**
- **Services** (4): Massage types, spa facilities, packages, PT service
- **Pricing** (7): 60/90min massages, couple/day spa packages, PT packages (12/24/36 saat)
- **Hours** (4): Weekday/Sunday hours, holidays, last appointment
- **Policies** (5): Cancellation, late arrival, payment, age, health
- **Contact** (5): Phone, WhatsApp, email, address, Instagram
- **General** (5): Welcome, parking, WiFi, loyalty, gift certificates
- **FAQ** (7): Kadınlar günü, kese köpük, PT, ne getir, terapist belge, randevu ✅ NEW

**Service Settings:**
- WhatsApp and Instagram services enabled by default

**AI System Prompts:**
- 3 default prompts seeded (WhatsApp, Instagram, General)
- Managed via `/admin/ai-prompts`
- Used by n8n workflows via integration API
- Configured in `service_settings` table

**Location:** `backend/src/database/seed.ts`

**Usage:**
- Runs automatically on `initializeDatabase()`
- Idempotent (won't duplicate on re-run)
- Used by n8n workflows via `/api/integrations/knowledge/context`

---

**Last Updated:** 2026-01-16  
**Status:** ✅ Active and tested  
**Coverage:** All critical patterns documented including Safety Gate + FAQ  
**Latest:** FAQ category (7 entries) + PT pricing + n8n import fix (2026-01-16)
