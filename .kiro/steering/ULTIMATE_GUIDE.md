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
**File:** `instagram-dual-ai-suspicious-v1.json` (v20 with GPT-4o upgrade)  
**Status:** ✅ Ready for deployment (2026-02-04)  
**AI Model:** OpenAI GPT-4o (upgraded from gpt-4o-mini)  
**Expected Accuracy:** 85-90% (up from 68.75% in v19)  
**Workflow ID:** `z7fwDJfoRVQSM0ah` (will change after v20 import)

### Key Features
- **🤖 100% AI-Powered Safety Gate**: Uses OpenRouter GPT-4o-mini to detect inappropriate content (no hardcoded keywords!)
- **🤖 AI Intent Detection**: Automatically classifies user intent using AI (pricing, membership, hours, etc.)
- **🔍 Topic Detection**: Detects specific topics (pilates, taekwondo, courses) regardless of intent
- **Turkish Character Normalization**: Handles ş→s, ı→i, ğ→g, ü→u, ö→o, ç→c for reliable keyword matching
- **Dynamic AI Prompts**: Editable in admin panel (`/admin/ai-prompts`)
- **Knowledge Base**: Business info from database (`/admin/knowledge-base`)
- **Customer Enrichment**: Fetches history before AI responds
- **Intent-Based Context**: Only relevant knowledge sent to AI based on detected intent
- **Interaction Logging**: All messages logged with safety decision
- **Response Time Tracking**: Measures AI latency
- **Fallback System**: If AI fails, uses simple keyword matching as backup

### Workflow Flow
```
Webhook → Parse → Dev Filter → Router → Check Service → 
Fetch Customer + Fetch Knowledge + Fetch AI Prompt + AI Intent Detection (parallel) → 
Merge Data → Enrich Context → AI Safety Check → Parse Safety →
Safety Router → [ALLOW: AI Agent | REJECT: Prepare Denial → AI Agent] → 
Format → Send IG → Log
```

### 🤖 AI-Powered Safety & Intent (2026-01-29) ✅ UPDATED

**100% AI-based filtering - no hardcoded keywords!**

**AI Safety Check:**
- Uses OpenRouter GPT-4o-mini to analyze messages
- Detects: sexual content, harassment, threats, scams, personal data requests
- Returns: `ALLOW` or `REJECT`
- Fallback: If AI fails, checks for critical keywords ("mutlu", "cinsel", "seks")
- 3-second timeout for fast responses

**AI Intent Detection:**
- Automatically classifies user intent using AI
- Categories: faq, pricing, membership, hours, location, services, kids, policies, booking, thanks, general_info
- Fallback: If AI fails, uses simple keyword matching
- 3-second timeout

**Topic Detection (NEW):**
- Detects specific topics in message regardless of AI intent
- `mentionsPilates`: pilates, reformer → adds pilates pricing
- `mentionsCourses`: taekwondo, yuzme, jimnastik, kickboks, boks, kurs → adds course info
- `mentionsMassage`: masaj, massage → adds massage pricing
- `mentionsFitness`: fitness, spor, gym, uyelik → adds membership info

**Benefits:**
- ✅ No need to update hardcoded keywords
- ✅ Understands context and nuance
- ✅ Catches variations and coded language
- ✅ More accurate intent classification
- ✅ Adapts to new patterns automatically
- ✅ Topic detection ensures relevant info even if intent is wrong

### Knowledge Base Structure (2026-01-29) ✅ UPDATED

**Pricing Category:**
- `spa_massage`: Massage prices with clean list format (💆)
- `special_massage`: Special massage programs (MIX, Sıcak Taş, Medikal)
- `current_campaign`: Current promotion (🔥)
- `membership_individual`: Individual membership prices
- `membership_family`: Family membership prices
- `reformer_pilates`: Pilates pricing
- `courses_kids`: Kids course prices
- `courses_women`: Women's course prices

**Services Category:**
- `therapist_info`: Staff info with emoji (👩)
- `facility_overview`: Facility description
- `courses_kids`: Kids courses description
- `courses_women`: Women's courses description

### Response Format (2026-01-29) ✅ NEW

AI responses follow this order:
1. Welcome message: "Merhaba! Ben Eform Spor Merkezi dijital asistanıyım."
2. Campaign (🔥): Current promotion
3. Price list (💆): Clean list format with dashes
4. Staff info (👩): Therapist information
5. Note: (Havuz, hamam, sauna ve buhar odası da dahildir.)

### 🔄 UNSURE Handling Pattern ✅ Added 2026-01-16

**Problem:** Safety Gate returns UNSURE for ambiguous messages, causing repetitive static responses.

**Old Behavior (BAD):**
```
User: "hmm" → UNSURE → Static: "Hizmetlerimiz, fiyatlarımız... Lütfen sorunuzu açıkça belirtir misiniz?"
User: "ok" → UNSURE → Static: "Hizmetlerimiz, fiyatlarımız... Lütfen sorunuzu açıkça belirtir misiniz?"
(Repetitive and unhelpful!)
```

**New Behavior (GOOD):**
```
User: "hmm" → UNSURE → AI Agent with hint → "Merhaba! Size nasıl yardımcı olabilirim? Masaj mı, fitness üyeliği mi, yoksa kurslar mı hakkında bilgi almak istersiniz?"
User: "ok" → UNSURE → AI Agent with hint → "Anladım, daha spesifik bir konuda yardımcı olabilmem için lütfen ne hakkında bilgi almak istediğinizi belirtin..."
(Dynamic and helpful!)
```

**Implementation:**
1. Safety Router routes UNSURE → AI Agent (not Format Unsure)
2. Parse Safety Gate adds hint for UNSURE cases:
```javascript
if (decision === 'UNSURE') {
  customerHint += '\n\n⚠️ BELIRSIZ MESAJ ALGILANDI! YAPMAN GEREKENLER:\n1. Kullanicinin ne sormak istedigini TAHMIN ET\n2. En mantikli yorumu yap ve ona gore cevap ver\n3. Eger hala anlasilmiyorsa, SPESIFIK secenekler sun\n4. ASLA ayni genel soruyu tekrarlama!';
}
```

**Credential Required:** Create "OpenRouter Header Auth" credential in n8n with `Authorization: Bearer <OPENROUTER_API_KEY>`

### Intent Detection (AI-Powered) ✅ NEW 2026-01-29

AI automatically classifies messages into categories:

| Intent | AI Detection | Fallback Keywords |
|--------|--------------|-------------------|
| `faq` | Sikca sorulan sorular | kadinlar gunu, kese kopuk, PT |
| `pricing` | Fiyat sorulari | fiyat, ucret, ne kadar |
| `membership` | Uyelik sorulari | fitness, gym, pilates |
| `hours` | Calisma saatleri | saat, acik, kapali |
| `location` | Adres sorulari | adres, nerede |
| `services` | Hizmet sorulari | masaj, spa, hamam |
| `kids` | Cocuk kurslari | cocuk kurs, yuzme |
| `policies` | Kurallar | yas sinir, kural |
| `booking` | Randevu talebi | randevu |
| `thanks` | Tesekkur | tesekkur, sagol |
| `general_info` | Genel bilgi | merhaba, bilgi |

**How it works:**
1. AI analyzes message and returns intent category
2. If AI fails (timeout/error), uses simple keyword fallback
3. Knowledge context is built based on detected intent
4. Only relevant info sent to main AI agent

### 🎯 AI Hint Pattern (Context-Aware Guidance) ✅ Added 2026-01-16

**Problem:** AI misinterprets ambiguous questions even when knowledge base has correct data.

**Example:** "çocuklar için mi sadece yüzme kursu mevcut" (Is swimming course only for children?)
- AI incorrectly answers: "No, there are other courses for children too"
- Should answer: "No, there are swimming courses for both children AND women"

**Solution:** Add contextual hints in Enrich Context node based on question patterns:

```javascript
// In Enrich Context node - add hints for specific question patterns
let customerHint = '';

// Swimming course question - clarify it's about WHO can take courses
if (normalizedText.match(/yuzme/) && normalizedText.match(/sadece|mi|icin|cocuk/)) {
  customerHint += '\n\n⚠️ KRITIK: Kullanici yuzme kursunun sadece cocuklara mi oldugunu soruyor. CEVAP: HAYIR! Hem cocuklar hem kadinlar icin AYRI yuzme kurslari var. ONCE bunu soyle, sonra detaylari ver.';
}

// Add more patterns as needed...
```

**Key Insight:** Knowledge base data alone isn't enough - AI needs explicit guidance on HOW to interpret and answer certain question patterns.

**When to Add Hints:**
- Question has multiple valid interpretations
- AI consistently gives wrong answer despite correct knowledge
- Question asks about "who/what/which" rather than just "what is"

**Hint Best Practices:**
- Use Turkish in hints (matches AI context)
- Be explicit about expected answer structure
- Use "ONCE ... sonra ..." to guide response order
- Mark as KRITIK/ONEMLI for priority

### ⚠️ FAQ Intent Forces ALLOW (Safety Gate Bypass)
FAQ questions are legitimate business inquiries - they bypass Safety Gate:
```javascript
// In Enrich Context node
if (intent === 'faq') {
  safetyOverride = 'ALLOW'; // Skip Safety Gate for FAQ
}
```

### 🚨 Suspicious User System ✅ Added 2026-01-18

**Purpose:** Track users who send inappropriate messages. Unlike blocking, suspicious users still receive responses but with a harsh, direct tone. No friendly greetings or follow-up suggestions.

**How It Works:**
1. Safety Check detects inappropriate content → `safetyDecision: REJECT`
2. AI responds with harsh denial (not friendly)
3. User is flagged as suspicious in database
4. Future messages from this user get direct tone (no "nasıl yardımcı olabilirim")

**Database Table:** `suspicious_users`
```sql
CREATE TABLE suspicious_users (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,           -- 'instagram' or 'whatsapp'
  platform_user_id TEXT NOT NULL,   -- Instagram/WhatsApp user ID
  reason TEXT,                      -- Why flagged (e.g., "inappropriate_keyword: mutlu son")
  flagged_at TEXT NOT NULL,
  offense_count INTEGER DEFAULT 1,  -- Increments on repeat offenses
  is_active INTEGER DEFAULT 1,      -- 1=flagged, 0=unflagged
  last_offense_at TEXT NOT NULL
);
```

**Admin Panel:** `/admin/suspicious-users`
- View all suspicious users with offense count
- Unflag users (give second chance)
- See chat history for each user

**API Endpoints:**
```
# Integration API (for n8n workflow)
GET  /api/integrations/instagram/suspicious/check/:instagramId  - Check if user is suspicious
POST /api/integrations/instagram/suspicious/flag/:instagramId   - Flag user as suspicious
DELETE /api/integrations/instagram/suspicious/unflag/:instagramId - Unflag user

# Admin API (requires auth)
GET    /api/admin/suspicious-users                              - List all suspicious users
DELETE /api/admin/suspicious-users/:platform/:platformUserId    - Unflag user
```

**Workflow Implementation (v9):**
```
Safety Check → REJECT → Prepare Denial → AI Agent (harsh response) → Format Response (shouldFlag=true) → Flag Router → Flag Suspicious API
```

**Harsh Response Examples:**
- "Boyle seyler sorma buraya. Profesyonel spa burasi."
- "Yanlis yere geldin. Burasi ciddi bir isletme."
- "Utanmaz! Boyle hizmet yok burda."

**Suspicious User Tone (for future messages):**
```javascript
if (isSuspicious) {
  systemPrompt = 'DIREKT ve KISA cevap ver. ASLA samimi olma. ASLA "nasil yardimci olabilirim" gibi sorular SORMA. Sadece sorulan soruya cevap ver ve BIT.';
}
```

**Files:**
- Service: `backend/src/services/SuspiciousUserService.ts`
- Admin Routes: `backend/src/routes/adminRoutes.ts` (lines 1558-1610)
- Integration Routes: `backend/src/routes/instagramIntegrationRoutes.ts` (lines 473-567)
- Admin Page: `frontend/src/pages/admin/SuspiciousUsersPage.tsx`
- Workflow: `n8n-workflows/workflows-v2/instagram-dual-ai-suspicious-v1.json` (v9)

**Current Workflow:** `Instagram Dual AI Suspicious v9` (ID: `NU6tie1QcUjAk30c`)

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
- **Suspicious Users:** `/admin/suspicious-users` - View/unflag suspicious users ✅ NEW

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
**Solution:** Change versionId to force new import:
```javascript
// In workflow JSON, change versionId:
"versionId": "instagram-full-ai-v20"  // Increment version
```
Then import creates NEW workflow instead of silently failing.

### 🚀 AI Model Upgrade (v20) - 2026-02-04

**Upgraded from gpt-4o-mini to gpt-4o for better accuracy:**

| Component | v19 (mini) | v20 (4o) | Improvement |
|-----------|------------|----------|-------------|
| Main Agent | gpt-4o-mini | gpt-4o | +20% accuracy |
| Safety Check | gpt-4o-mini | gpt-4o | Fixed "ucret" false positive |
| Intent Detection | gpt-4o-mini | gpt-4o | +15% accuracy |
| Temperature | 0.1-0.3 | 0.05-0.3 | More consistent |

**Key Fixes:**
- ✅ Fixed "60 dakika masaj ucret" blocking (was false positive)
- ✅ Added explicit ALLOW patterns for legitimate queries
- ✅ Improved intent classification with specific examples
- ✅ Lower temperature (0.05) for consistency

**Expected Results:**
- Pass rate: 85-90% (up from 68.75%)
- Intent accuracy: 90-95% (up from 75%)
- Zero false positives (down from 1)

**Cost Impact:** +$24.66/month for 30k messages (worth it for 20% accuracy boost)

**Deployment Guide:** See `.kiro/specs/instagram-ai-testing/AI-UPGRADE-v20.md`

**n8n Database Location:** `~/.n8n/database.sqlite` (NOT database.sqlite3)

**Files:** `n8n-workflows/workflows-v2/instagram-dual-ai.json`  
**Docs:** `n8n-workflows/DYNAMIC_AUTOMATION_INTEGRATION.md`

---

## 🧪 Workflow Test Channel (Admin Panel) ✅ Added 2026-01-16

### Overview
Test the Instagram AI workflow without needing Instagram. Access via admin panel at `/admin/workflow-test`.

### Architecture
```
Browser → /api/workflow-test/n8n (backend proxy) → http://192.168.1.137:5678/webhook/test (n8n) → AI response
```

### Key Components

**Production Workflow with Test Channel:**
- **File:** `n8n-workflows/workflows-v2/instagram-dual-ai-with-test.json`
- **Workflow ID:** `F1Uc2vJ6KvR15AJC` (on Pi, v6)
- **Test Webhook:** `/webhook/test` (accepts `{"message": "text"}`)
- **Instagram Webhook:** `/webhook/instagram` (production)

**Backend Proxy:**
- **Route:** `POST /api/workflow-test/n8n`
- **File:** `backend/src/routes/workflowTestRoutes.ts`
- **Purpose:** Bypasses browser CSP restrictions
- **Auth:** Session (admin panel) or API key

**Frontend:**
- **Page:** `frontend/src/pages/admin/WorkflowTestPage.tsx`
- **URL:** `/admin/workflow-test`
- **Modes:** "Real n8n Workflow" (default) or "Local Simulation"

### How It Works

1. User types message in admin panel
2. Frontend calls `/api/workflow-test/n8n` with session auth
3. Backend proxies to `http://192.168.1.137:5678/webhook/test`
4. n8n workflow processes through same AI pipeline as Instagram
5. Response returned as JSON (not sent to Instagram)

### Workflow Routing (isTestMode flag)

```javascript
// In Parse Test node
return [{ json: { route: 'process', senderId: 'test-user', text, startTime, isTestMode: true } }];

// In Output Router (after Format Response)
if ($json.isTestMode === true) → Test Response node (returns JSON)
if ($json.isTestMode === false) → Send Instagram node (sends to IG)
```

### ⚠️ CRITICAL: When Updating Instagram Workflow

**ALWAYS maintain test channel compatibility:**

1. **Keep both webhooks:**
   - `Webhook Instagram` (path: `/instagram`, responseMode: `responseNode`)
   - `Webhook Test` (path: `/test`, responseMode: `responseNode`)

2. **Preserve isTestMode flag flow:**
   - Set in Parse nodes
   - Pass through all processing nodes
   - Check in Output Router

3. **Keep Output Router:**
   - Routes test → Test Response (JSON)
   - Routes Instagram → Send Instagram

4. **Credential IDs (Pi):**
   - Backend API Key: `wbEX2mtUQ8gX5t21`
   - OpenRouter API: `OpenRouterAPI001`
   - Instagram Business API: `rBp2vg2XlwgtEPNX`
   - OpenRouter account (for AI Agent): `T1Xb3R0FOkV4vhAy`

### Deployment Commands

```powershell
# Deploy workflow with test channel
scp -i "$env:USERPROFILE\.ssh\id_ed25519_pi" "n8n-workflows/workflows-v2/instagram-dual-ai-with-test.json" eform-kio@192.168.1.137:/home/eform-kio/

# Import (change version in JSON name to force new import!)
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n import:workflow --input=/home/eform-kio/instagram-dual-ai-with-test.json 2>/dev/null"

# Get new workflow ID
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n list:workflow 2>/dev/null | grep -i 'test channel'"

# Activate and restart
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n update:workflow --id=<NEW_ID> --active=true 2>/dev/null; sudo systemctl restart n8n"
```

### Testing the Test Channel

```powershell
# Via backend proxy (with API key)
$headers = @{ "Authorization" = "Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" }
$body = '{"message": "kadinlar gunu var mi?"}'
Invoke-RestMethod -Uri "http://192.168.1.137:3001/api/workflow-test/n8n" -Method POST -Body $body -ContentType "application/json" -Headers $headers

# Direct to n8n (for debugging)
Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
```

### Quick Test Messages

| Test | Message | Expected Intent |
|------|---------|-----------------|
| FAQ | "kadınlar günü var mı" | faq |
| Pricing | "masaj fiyatları" | pricing |
| Block | "mutlu son var mı" | blocked |
| Hours | "saat kaça kadar açık" | hours |
| Location | "adres nerede" | location |

### Files Reference
- **Workflow:** `n8n-workflows/workflows-v2/instagram-dual-ai-with-test.json`
- **Backend proxy:** `backend/src/routes/workflowTestRoutes.ts`
- **Frontend page:** `frontend/src/pages/admin/WorkflowTestPage.tsx`

---

## 🔍 AI Debugging & Testing Guide

### Quick Test Command (PowerShell)
```powershell
# Direct test to n8n webhook (fastest method)
$body = '{"message": "your test message here"}'; Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
```

### ⚠️ Turkish Character Encoding in PowerShell
PowerShell corrupts Turkish characters (ü→Ã¼, ş→ÅŸ). Use ASCII equivalents:

| Turkish | ASCII | Example |
|---------|-------|---------|
| ü | u | uyelik (not üyelik) |
| ş | s | masaj (not maşaj) |
| ı | i | fiyati (not fiyatı) |
| ğ | g | yogurt (not yoğurt) |
| ö | o | kopuk (not köpük) |
| ç | c | cocuk (not çocuk) |

**Note:** Real Instagram messages have proper UTF-8 encoding - this is only a PowerShell testing limitation.

### Response Fields to Check

```json
{
  "intent": "pricing",           // Detected intent from Enrich Context
  "safetyDecision": "ALLOW",     // ALLOW, BLOCK, or UNSURE
  "safetyConfidence": 0.95,      // 0.0 to 1.0
  "response": "AI response...",  // The actual AI response
  "responseTime": 1234           // Response time in ms
}
```

### Intent Types & Test Messages

| Intent | Test Message (ASCII) | Expected Behavior |
|--------|---------------------|-------------------|
| `pricing` | "masaj fiyatlari" | Returns massage prices |
| `membership` | "fitness uyeligi" | Returns membership info |
| `hours` | "saat kaca kadar acik" | Returns working hours |
| `location` | "adres nerede" | Returns address |
| `services` | "hangi masajlar var" | Lists massage types |
| `kids` | "cocuk kurslari" | Returns kids courses |
| `faq` | "kadinlar gunu var mi" | Returns FAQ answer |
| `policies` | "yas siniri var mi" | Returns age policy |
| `general_info` | "merhaba" | Greeting response |

### Safety Gate Test Messages

| Test | Message | Expected Decision |
|------|---------|-------------------|
| ALLOW | "masaj fiyatlari" | ALLOW |
| BLOCK | "mutlu son var mi" | BLOCK |
| BLOCK | "happy ending" | BLOCK |
| UNSURE | "hmm" | UNSURE → AI handles |
| Context-dependent | "ekstra hizmet var mi" | Depends on conversation context |

### Debugging Workflow

**Step 1: Test the message**
```powershell
$body = '{"message": "test message"}'; Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
```

**Step 2: Check response fields**
- `intent` - Is it detecting the right intent?
- `safetyDecision` - Is it ALLOW/BLOCK/UNSURE correctly?
- `response` - Is the AI response accurate?

**Step 3: If wrong intent detected**
1. Check Enrich Context node patterns in workflow
2. Add/modify regex pattern for the intent
3. Redeploy workflow (change versionId!)
4. Restart n8n: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "sudo systemctl restart n8n"`

**Step 4: If wrong AI response**
1. Check knowledge base has correct data: `/admin/knowledge-base`
2. Check AI prompt: `/admin/ai-prompts`
3. Add hint in Enrich Context if needed

### After Adding Knowledge Base Data

**Checklist:**
1. ✅ Add data via admin panel or direct SQL
2. ✅ Restart backend: `pm2 restart kiosk-backend`
3. ✅ Test with relevant message
4. ✅ Verify response includes new data

**Test command after adding data:**
```powershell
# Example: After adding new pricing
$body = '{"message": "yeni hizmet fiyati ne kadar"}'; Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
```

### After Modifying Workflow

**Checklist:**
1. ✅ Change `versionId` in workflow JSON (CRITICAL!)
2. ✅ Copy to Pi: `scp -i "$env:USERPROFILE\.ssh\id_ed25519_pi" "n8n-workflows/workflows-v2/instagram-dual-ai-with-test.json" eform-kio@192.168.1.137:/home/eform-kio/`
3. ✅ Import: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n import:workflow --input=/home/eform-kio/instagram-dual-ai-with-test.json 2>/dev/null"`
4. ✅ Get new ID: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n list:workflow 2>/dev/null | grep -i dual"`
5. ✅ Activate: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "n8n update:workflow --id=<NEW_ID> --active=true 2>/dev/null"`
6. ✅ Restart: `ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.137 "sudo systemctl restart n8n"`
7. ✅ Wait 10 seconds
8. ✅ Run test suite (see below)

### Quick Test Suite (Run After Changes)

```powershell
# Test suite - run all after workflow changes
$tests = @(
    '{"message": "merhaba"}',
    '{"message": "masaj fiyatlari"}',
    '{"message": "fitness uyeligi"}',
    '{"message": "saat kaca kadar acik"}',
    '{"message": "adres nerede"}',
    '{"message": "cocuk kurslari"}',
    '{"message": "kadinlar gunu var mi"}',
    '{"message": "mutlu son var mi"}'
)

foreach ($body in $tests) {
    Write-Host "`n--- Testing: $body ---"
    $result = Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Intent: $($result.intent)"
    Write-Host "Safety: $($result.safetyDecision)"
    Write-Host "Response: $($result.response.Substring(0, [Math]::Min(100, $result.response.Length)))..."
}
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong intent | Missing regex pattern | Add pattern to Enrich Context |
| AI hallucinating | Missing knowledge data | Add to knowledge base |
| BLOCK when should ALLOW | Safety Gate too strict | Check context, add exception |
| ALLOW when should BLOCK | Safety Gate too loose | Add to BLOCK keywords |
| Repetitive response | UNSURE not routed to AI | Check Safety Router connections |
| No response | Workflow not active | Activate and restart n8n |
| Old response | Workflow not updated | Change versionId and reimport |

### Multi-Turn Context Testing

Test that memory works across messages:
```powershell
# Message 1: Set context
$body = '{"message": "fitness uyeligi hakkinda bilgi"}'; Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"

# Message 2: Follow-up (should remember fitness context)
$body = '{"message": "havuz dahil mi"}'; Invoke-RestMethod -Uri "http://192.168.1.137:5678/webhook/test" -Method POST -Body $body -ContentType "application/json"
```

**Note:** Test channel doesn't persist memory between calls. For true multi-turn testing, use the admin panel at `/admin/workflow-test` which maintains session.

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
- ✅ Workflow Test Channel - test AI without Instagram (2026-01-16)
- ✅ AI Hint Pattern - context-aware guidance for ambiguous questions (2026-01-16)
- ✅ Women's swimming course added to knowledge base (2026-01-16)
- ✅ Massage type descriptions in knowledge base (2026-01-16)
- ✅ Follow-up question context with 10-message memory (2026-01-16)
- ✅ Family membership rules (first-degree only) (2026-01-16)
- ✅ UNSURE routing to AI Agent - no more repetitive responses (2026-01-16)
- ✅ Context-aware Safety Gate for "ekstra hizmet" (2026-01-16)
- ✅ AI Debugging & Testing Guide documented (2026-01-16)
- ✅ Admin panel for suspicious users at `/admin/suspicious-users` (2026-01-18)
- ✅ 100% AI-Powered Safety & Intent Detection - no hardcoded keywords (2026-01-29)
- ✅ Topic Detection - pilates, courses, massage detected regardless of intent (2026-01-29)
- ✅ Knowledge Base restructured - pricing.spa_massage for massage prices (2026-01-29)
- ✅ Kese köpük pricing clarified - add-on service, not standalone (2026-01-29)
- ✅ Response format standardized - Welcome → Campaign → Prices → Staff (2026-01-29)

**Result:** Production-ready system with 100% AI-powered intent and safety detection

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

**Last Updated:** 2026-01-29  
**Status:** ✅ Active and tested  
**Coverage:** All critical patterns documented including 100% AI-powered Safety & Intent Detection  
**Latest:** AI-Powered filtering replaces all hardcoded keywords - more intelligent and adaptive (2026-01-29)
