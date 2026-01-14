# Admin AI Assistant - WhatsApp Kiosk Management System

## 🎯 Vision

A WhatsApp-based AI assistant that allows authorized administrators to manage the SPA Kiosk system through natural language commands. Send a message like "update massage prices from this image" and the system handles OCR, validation, and database updates automatically.

**Key Insight:** Since only 1-2 admins will use this, we can make it **fully AI-driven** with tool calling - no complex keyword routing needed.

---

## 🔴 QA Review Findings & Required Tasks

### Finding 1: Admin AI tools reference session-only endpoints
**Problem:** Current admin routes (`/api/admin/knowledge-base`, `/api/admin/massages`) require `authMiddleware` (session-based), which won't work for n8n API key calls.

**Solution:** Create dedicated `/api/integrations/admin/*` routes secured by `apiKeyAuth` + admin phone validation.

### Finding 2: `/api/admin/ai-prompts` is unauthenticated
**Problem:** `createAIPromptsRoutes` is mounted without `authMiddleware`, exposing prompts to anyone.

**Solution:** Add `authMiddleware` to admin AI prompts routes.

### Finding 3: Admin phone allowlist only in n8n
**Problem:** Backend endpoints accept any `admin_phone` payload from API-key caller. No server-side validation.

**Solution:** Add backend-side admin phone allowlist validation middleware.

### Finding 4: Database migration path doesn't match repo conventions
**Problem:** No `backend/src/database/migrations/` directory. Project uses `schema.sql` + runtime scripts.

**Solution:** Add `admin_action_log` table to `schema.sql` and wire CRUD helpers into `DatabaseService`.

### Finding 5: Bulk price updates don't match massage data model
**Problem:** Prices live in `massages.sessions` JSON array, not a single `price` column. Bulk update with `{name, price}` is ambiguous.

**Solution:** Define bulk update payload to target specific sessions by massage name + session name.

### Finding 6: System status endpoint doesn't exist
**Problem:** Plan proposes `GET /api/integrations/admin/status` but no such route exists.

**Solution:** Create system status endpoint aggregating backend health, service statuses, and message counts.

---

## 📋 Implementation Tasks (Ordered by Priority)

### Task 1: Secure Admin AI Prompts Routes
**File:** `backend/src/routes/aiPromptsRoutes.ts`
**Change:** Add `authMiddleware` to all routes

```typescript
// Before: No auth
router.get('/', async (_req, res) => { ... });

// After: Session auth required
import { authMiddleware } from '../middleware/authMiddleware.js';
router.use(authMiddleware); // Apply to all routes
```

**Acceptance:** All `/api/admin/ai-prompts/*` routes return 401 without valid session.

---

### Task 2: Add Admin Phone Allowlist Middleware
**File:** `backend/src/middleware/adminPhoneAuth.ts` (new)

```typescript
import { Request, Response, NextFunction } from 'express';

// Load from env: ADMIN_PHONES=905551234567,905559876543
const ADMIN_PHONES = (process.env.ADMIN_PHONES || '').split(',').filter(Boolean);

export function adminPhoneAuth(req: Request, res: Response, next: NextFunction): void {
  const adminPhone = req.body.admin_phone || req.query.admin_phone;
  
  if (!adminPhone) {
    res.status(400).json({ error: { code: 'MISSING_ADMIN_PHONE', message: 'admin_phone required' } });
    return;
  }
  
  // Normalize phone (remove +, spaces)
  const normalized = adminPhone.replace(/[\s+\-]/g, '');
  
  if (!ADMIN_PHONES.includes(normalized)) {
    res.status(403).json({ error: { code: 'NOT_ADMIN', message: 'Phone not in admin allowlist' } });
    return;
  }
  
  req.adminPhone = normalized; // Attach for logging
  next();
}
```

**Acceptance:** Requests without valid admin phone return 403.

---

### Task 3: Add admin_action_log Table to Schema
**File:** `backend/src/database/schema.sql`

```sql
-- Admin action audit log
CREATE TABLE IF NOT EXISTS admin_action_log (
  id TEXT PRIMARY KEY,
  admin_phone TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN (
    'kb_create', 'kb_update', 'kb_delete',
    'prompt_create', 'prompt_update', 'prompt_delete',
    'massage_create', 'massage_update', 'massage_delete',
    'price_bulk_update', 'system_action'
  )),
  target_table TEXT,           -- 'knowledge_base', 'ai_system_prompts', 'massages'
  target_id TEXT,              -- ID of affected record
  before_value TEXT,           -- JSON snapshot before change
  after_value TEXT,            -- JSON snapshot after change
  status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_phone ON admin_action_log(admin_phone);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON admin_action_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_type ON admin_action_log(action_type);
```

**Acceptance:** Table exists after database init, indexes created.

---

### Task 4: Add DatabaseService Helpers for Admin Action Log
**File:** `backend/src/database/DatabaseService.ts`

```typescript
// Add to DatabaseService class

createAdminActionLog(data: {
  adminPhone: string;
  actionType: string;
  targetTable?: string;
  targetId?: string;
  beforeValue?: any;
  afterValue?: any;
  status?: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  ipAddress?: string;
}): void {
  const id = randomUUID();
  const now = new Date().toISOString();
  
  this.db.prepare(`
    INSERT INTO admin_action_log (
      id, admin_phone, action_type, target_table, target_id,
      before_value, after_value, status, error_message, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.adminPhone,
    data.actionType,
    data.targetTable || null,
    data.targetId || null,
    data.beforeValue ? JSON.stringify(data.beforeValue) : null,
    data.afterValue ? JSON.stringify(data.afterValue) : null,
    data.status || 'success',
    data.errorMessage || null,
    data.ipAddress || null,
    now
  );
}

getAdminActionLogs(filters?: {
  adminPhone?: string;
  actionType?: string;
  limit?: number;
}): any[] {
  let query = 'SELECT * FROM admin_action_log WHERE 1=1';
  const params: any[] = [];
  
  if (filters?.adminPhone) {
    query += ' AND admin_phone = ?';
    params.push(filters.adminPhone);
  }
  if (filters?.actionType) {
    query += ' AND action_type = ?';
    params.push(filters.actionType);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return this.db.prepare(query).all(...params) as any[];
}
```

**Acceptance:** Can create and query admin action logs.

---

### Task 5: Create Admin Integration Routes
**File:** `backend/src/routes/adminIntegrationRoutes.ts` (new)

These routes are for n8n AI tools - secured by `apiKeyAuth` + `adminPhoneAuth`.

```typescript
import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { adminPhoneAuth } from '../middleware/adminPhoneAuth.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';

export function createAdminIntegrationRoutes(db: DatabaseService): Router {
  const router = Router();
  const kbService = new KnowledgeBaseService(db);
  
  // All routes require API key + admin phone
  router.use(apiKeyAuth);
  router.use(adminPhoneAuth);
  
  // GET /api/integrations/admin/knowledge-base
  router.get('/knowledge-base', (req, res) => {
    const { category } = req.query;
    const entries = kbService.getAll(category as string);
    res.json(entries);
  });
  
  // PUT /api/integrations/admin/knowledge-base/:id
  router.put('/knowledge-base/:id', (req, res) => {
    const { id } = req.params;
    const before = kbService.getById(id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    
    const updated = kbService.update(id, req.body);
    
    db.createAdminActionLog({
      adminPhone: req.adminPhone!,
      actionType: 'kb_update',
      targetTable: 'knowledge_base',
      targetId: id,
      beforeValue: before,
      afterValue: updated,
      ipAddress: req.ip
    });
    
    res.json(updated);
  });
  
  // GET /api/integrations/admin/ai-prompts
  router.get('/ai-prompts', (req, res) => {
    const prompts = db['db'].prepare('SELECT * FROM ai_system_prompts ORDER BY name').all();
    res.json(prompts);
  });
  
  // PUT /api/integrations/admin/ai-prompts/:id
  router.put('/ai-prompts/:id', (req, res) => {
    const { id } = req.params;
    const before = db['db'].prepare('SELECT * FROM ai_system_prompts WHERE id = ?').get(id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    
    // Update logic...
    const after = /* updated prompt */;
    
    db.createAdminActionLog({
      adminPhone: req.adminPhone!,
      actionType: 'prompt_update',
      targetTable: 'ai_system_prompts',
      targetId: id,
      beforeValue: before,
      afterValue: after,
      ipAddress: req.ip
    });
    
    res.json(after);
  });
  
  // GET /api/integrations/admin/massages
  router.get('/massages', (req, res) => {
    const massages = db.getMassages();
    res.json(massages);
  });
  
  // PUT /api/integrations/admin/massages/:id/sessions
  // Update specific session prices within a massage
  router.put('/massages/:id/sessions', (req, res) => {
    const { id } = req.params;
    const { sessionName, price } = req.body;
    
    const massage = db.getMassageById(id);
    if (!massage) return res.status(404).json({ error: 'Massage not found' });
    
    const before = { ...massage };
    const sessions = massage.sessions.map(s => 
      s.name === sessionName ? { ...s, price } : s
    );
    
    const updated = db.updateMassage(id, { sessions });
    
    db.createAdminActionLog({
      adminPhone: req.adminPhone!,
      actionType: 'massage_update',
      targetTable: 'massages',
      targetId: id,
      beforeValue: before,
      afterValue: updated,
      ipAddress: req.ip
    });
    
    res.json(updated);
  });
  
  // POST /api/integrations/admin/prices/bulk
  // Bulk update prices from OCR results
  router.post('/prices/bulk', (req, res) => {
    const { updates } = req.body;
    // updates: [{ massageName, sessionName, price }]
    
    const results = [];
    const massages = db.getMassages();
    
    for (const update of updates) {
      // Fuzzy match massage name
      const massage = findBestMatch(massages, update.massageName);
      if (!massage) {
        results.push({ ...update, status: 'not_found' });
        continue;
      }
      
      // Find session
      const sessionIdx = massage.sessions.findIndex(s => 
        normalize(s.name).includes(normalize(update.sessionName || '60'))
      );
      
      if (sessionIdx === -1) {
        results.push({ ...update, status: 'session_not_found' });
        continue;
      }
      
      // Update
      const before = { ...massage };
      massage.sessions[sessionIdx].price = update.price;
      db.updateMassage(massage.id, { sessions: massage.sessions });
      
      db.createAdminActionLog({
        adminPhone: req.adminPhone!,
        actionType: 'price_bulk_update',
        targetTable: 'massages',
        targetId: massage.id,
        beforeValue: before.sessions[sessionIdx],
        afterValue: massage.sessions[sessionIdx],
        ipAddress: req.ip
      });
      
      results.push({ ...update, status: 'updated', massageId: massage.id });
    }
    
    res.json({ results, updated: results.filter(r => r.status === 'updated').length });
  });
  
  // GET /api/integrations/admin/status
  router.get('/status', (req, res) => {
    const kioskState = db.getKioskState();
    const lastHeartbeat = new Date(kioskState.last_heartbeat);
    const kioskOnline = (Date.now() - lastHeartbeat.getTime()) < 30000;
    
    // Get 24h message counts
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
    const waCount = db['db'].prepare(
      'SELECT COUNT(*) as count FROM whatsapp_interactions WHERE created_at > ?'
    ).get(yesterday) as any;
    const igCount = db['db'].prepare(
      'SELECT COUNT(*) as count FROM instagram_interactions WHERE created_at > ?'
    ).get(yesterday) as any;
    
    res.json({
      backend: 'online',
      kiosk: kioskOnline ? 'online' : 'offline',
      kioskLastSeen: kioskState.last_heartbeat,
      kioskMode: kioskState.mode,
      messages24h: {
        whatsapp: waCount?.count || 0,
        instagram: igCount?.count || 0
      }
    });
  });
  
  // GET /api/integrations/admin/logs
  router.get('/logs', (req, res) => {
    const { limit = 20 } = req.query;
    const logs = db.getAdminActionLogs({ limit: Number(limit) });
    res.json(logs);
  });
  
  return router;
}

// Helper: Normalize Turkish text for fuzzy matching
function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/ş/g, 's').replace(/ı/g, 'i')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '');
}

// Helper: Find best matching massage by name
function findBestMatch(massages: any[], name: string): any | null {
  const normalized = normalize(name);
  return massages.find(m => normalize(m.name).includes(normalized) || normalized.includes(normalize(m.name)));
}
```

**Acceptance:** All admin integration routes work with API key + admin phone validation.

---

### Task 6: Mount Admin Integration Routes
**File:** `backend/src/index.ts`

```typescript
import { createAdminIntegrationRoutes } from './routes/adminIntegrationRoutes.js';

// Add after other integration routes
app.use('/api/integrations/admin', createAdminIntegrationRoutes(dbService));
```

**Acceptance:** Routes accessible at `/api/integrations/admin/*`.

---

### Task 7: Add ADMIN_PHONES to Environment
**File:** `backend/.env.example`

```env
# Admin phone allowlist (comma-separated, no + prefix)
ADMIN_PHONES=905551234567,905559876543
```

**Acceptance:** Environment variable documented and loaded.

---

## 🧠 Architecture (Updated)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN AI ASSISTANT                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   WhatsApp Message (Text or Image)                                   │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────────┐                                                    │
│   │   Verify    │──── NOT ADMIN ───▶ Route to Customer Workflow     │
│   │   Admin?    │     (n8n check)                                    │
│   └──────┬──────┘                                                    │
│          │ IS ADMIN                                                  │
│          ▼                                                           │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              AI AGENT WITH TOOLS (GPT-4o-mini)               │   │
│   │  ┌─────────────────────────────────────────────────────┐    │   │
│   │  │  Tools call /api/integrations/admin/* endpoints      │    │   │
│   │  │  (apiKeyAuth + adminPhoneAuth + audit logging)       │    │   │
│   │  │                                                       │    │   │
│   │  │  • list_knowledge_base    • update_knowledge_base    │    │   │
│   │  │  • list_ai_prompts        • update_ai_prompt         │    │   │
│   │  │  • list_massages          • update_massage_session   │    │   │
│   │  │  • get_system_status      • bulk_update_prices       │    │   │
│   │  │  • analyze_image (Vision) • get_admin_logs           │    │   │
│   │  └─────────────────────────────────────────────────────┘    │   │
│   └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                               │
│                    │  Reply WhatsApp │                               │
│                    └─────────────────┘                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Layers

| Layer | Location | Purpose |
|-------|----------|---------|
| 1. n8n Phone Check | Workflow | Quick filter, route non-admins to customer workflow |
| 2. API Key Auth | `apiKeyAuth` middleware | Verify n8n API key |
| 3. Admin Phone Auth | `adminPhoneAuth` middleware | Server-side allowlist validation |
| 4. Audit Logging | `admin_action_log` table | Track all changes with before/after |

---

## 🛠️ AI Agent Tools (Updated)

| Tool | Endpoint | Auth |
|------|----------|------|
| `list_knowledge_base` | GET /api/integrations/admin/knowledge-base | apiKey + adminPhone |
| `update_knowledge_base` | PUT /api/integrations/admin/knowledge-base/:id | apiKey + adminPhone |
| `list_ai_prompts` | GET /api/integrations/admin/ai-prompts | apiKey + adminPhone |
| `update_ai_prompt` | PUT /api/integrations/admin/ai-prompts/:id | apiKey + adminPhone |
| `list_massages` | GET /api/integrations/admin/massages | apiKey + adminPhone |
| `update_massage_session` | PUT /api/integrations/admin/massages/:id/sessions | apiKey + adminPhone |
| `bulk_update_prices` | POST /api/integrations/admin/prices/bulk | apiKey + adminPhone |
| `get_system_status` | GET /api/integrations/admin/status | apiKey + adminPhone |
| `get_admin_logs` | GET /api/integrations/admin/logs | apiKey + adminPhone |
| `analyze_image` | Gemini Vision API | Direct call |

---

## 📊 Bulk Price Update Payload

**Problem:** Prices are in `massages.sessions` JSON array, not a single field.

**Solution:** Target by massage name + session name (with fuzzy matching).

```typescript
// Request
POST /api/integrations/admin/prices/bulk
{
  "admin_phone": "905551234567",
  "updates": [
    { "massageName": "Klasik Masaj", "sessionName": "60 Dakika", "price": 700 },
    { "massageName": "Aromaterapi", "sessionName": "60dk", "price": 800 },
    { "massageName": "Thai Masaj", "price": 900 }  // defaults to first session
  ]
}

// Response
{
  "results": [
    { "massageName": "Klasik Masaj", "sessionName": "60 Dakika", "price": 700, "status": "updated", "massageId": "abc123" },
    { "massageName": "Aromaterapi", "sessionName": "60dk", "price": 800, "status": "updated", "massageId": "def456" },
    { "massageName": "Thai Masaj", "price": 900, "status": "updated", "massageId": "ghi789" }
  ],
  "updated": 3
}
```

**Fuzzy Matching:**
- Normalizes Turkish characters (ş→s, ı→i, etc.)
- Partial name matching
- Session name defaults to first session if not specified

---

## 📋 Implementation Checklist

### Phase 1: Backend Security & Foundation (Day 1-2)

- [ ] **Task 1:** Add `authMiddleware` to `/api/admin/ai-prompts` routes
- [ ] **Task 2:** Create `adminPhoneAuth` middleware
- [ ] **Task 3:** Add `admin_action_log` table to `schema.sql`
- [ ] **Task 4:** Add `DatabaseService` helpers for admin action log
- [ ] **Task 7:** Add `ADMIN_PHONES` to `.env.example`

### Phase 2: Admin Integration Routes (Day 2-3)

- [ ] **Task 5:** Create `adminIntegrationRoutes.ts` with all endpoints
- [ ] **Task 6:** Mount routes in `index.ts`
- [ ] Write unit tests for new routes
- [ ] Test with curl/Postman

### Phase 3: n8n Workflow (Day 3-4)

- [ ] Create `whatsapp-admin-assistant.json` workflow
- [ ] Implement admin phone check node
- [ ] Add AI Agent with Code Tool nodes
- [ ] Test text commands

### Phase 4: Vision AI (Day 4-5)

- [ ] Add WhatsApp media download node
- [ ] Integrate Gemini Vision for OCR
- [ ] Implement price extraction + fuzzy matching
- [ ] Test with real price list images

### Phase 5: Polish & Deploy (Day 5-6)

- [ ] Error handling and edge cases
- [ ] Conversation memory for context
- [ ] Deploy to Pi
- [ ] End-to-end testing

---

## 📁 Files to Create/Modify

### New Files
```
backend/src/middleware/adminPhoneAuth.ts       # Admin phone validation
backend/src/routes/adminIntegrationRoutes.ts   # Admin API for n8n
n8n-workflows/workflows-v2/whatsapp-admin-assistant.json
```

### Modified Files
```
backend/src/database/schema.sql                # Add admin_action_log table
backend/src/database/DatabaseService.ts        # Add log helpers
backend/src/database/types.ts                  # Add AdminActionLog type
backend/src/routes/aiPromptsRoutes.ts          # Add authMiddleware
backend/src/index.ts                           # Mount new routes
backend/.env.example                           # Add ADMIN_PHONES
```

---

## 🖼️ Image Processing Flow

```
1. Admin sends image + "fiyatları güncelle"
2. n8n detects image attachment
3. Download from WhatsApp Media API
4. Send to Gemini Vision with prompt:
   "Extract prices from this Turkish price list. Return JSON array:
    [{service: string, price: number, duration: string|null}]"
5. AI Agent receives extracted prices
6. Agent calls bulk_update_prices tool with admin_phone
7. Backend validates admin, updates prices, logs actions
8. Reply with summary
```

---

## 📊 Example Conversations

### Update Prices from Image
```
👤 Admin: [sends price list image] fiyatları güncelle

🤖 AI: Resmi analiz ediyorum...

Bulduğum fiyatlar:
1. Klasik Masaj 60dk: 700₺
2. Aromaterapi 60dk: 800₺
3. Thai Masaj 60dk: 900₺

Bu fiyatları güncelleyeyim mi?

👤 Admin: evet

🤖 AI: ✅ 3 fiyat güncellendi!
• Klasik Masaj: 650₺ → 700₺
• Aromaterapi: 750₺ → 800₺
• Thai Masaj: 850₺ → 900₺
```

### Check System Status
```
👤 Admin: sistem durumu

🤖 AI: 📊 Sistem Durumu

🟢 Backend: Çalışıyor
🟢 Kiosk: Online (son görülme: 5 sn önce)
📺 Mod: digital-menu

📈 Son 24 Saat:
• WhatsApp: 47 mesaj
• Instagram: 23 DM
```

### Update Knowledge Base
```
👤 Admin: pazar günü saat kaçta açılıyoruz?

🤖 AI: 🕐 Mevcut: Pazar 12:00-20:00

👤 Admin: 11'e çek

🤖 AI: ✅ Pazar saati güncellendi: 11:00-20:00
(knowledge_base/hours/sunday_hours)
```

---

## ✅ Success Criteria

1. **Security:** 
   - Only whitelisted phones can execute admin commands
   - All actions logged with before/after values
   - API key + admin phone double validation

2. **Accuracy:** 
   - 90%+ price extraction from images
   - Fuzzy matching handles Turkish variations

3. **Audit:** 
   - Every change tracked in `admin_action_log`
   - Can review who changed what and when

4. **UX:** 
   - Natural Turkish conversation
   - AI asks for confirmation on destructive actions

5. **Speed:** 
   - <10s for text commands
   - <30s for image processing

---

**Created:** 2026-01-09
**Updated:** 2026-01-09 (QA findings addressed)
**Status:** Ready for Implementation
**Version:** 3.0 (Security-hardened)
