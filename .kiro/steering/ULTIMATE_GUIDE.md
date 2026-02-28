# Ultimate Kiro Steering Guide

**Single source of truth for all critical patterns, commands, and architecture.**

---

## Architecture Overview

```
Dev Machine (Windows)
â”œâ”€â”€ Backend (port 3001) â€” Express + SQLite (WAL mode)
â”‚   â”œâ”€â”€ /api/admin/*          â€” Session auth (admin panel)
â”‚   â”œâ”€â”€ /api/kiosk/*          â€” Public (kiosk UI)
â”‚   â”œâ”€â”€ /api/integrations/*   â€” API key auth (n8n/OpenClaw)
â”‚   â”œâ”€â”€ /webhook/whatsapp     â€” Meta webhook â†’ forwards to n8n
â”‚   â””â”€â”€ /webhook/instagram    â€” Meta webhook â†’ OpenClaw (USE_OPENCLAW=true) or n8n
â”œâ”€â”€ OpenClaw (port 18789) â€” AI agent gateway (replaces n8n for Instagram)
â”‚   â””â”€â”€ Instagram hook        â€” Kimi K2 via OpenRouter, multi-model routing
â”œâ”€â”€ n8n (Pi only, port 5678) â€” Workflow automation (WhatsApp only now)
â”‚   â””â”€â”€ WhatsApp workflow     â€” Keyword routing (KUPON/DURUM/KULLAN)
â””â”€â”€ Frontend (served by backend in prod)

Raspberry Pi (192.168.1.8)
â”œâ”€â”€ Backend (PM2, port 3001) â€” same as above
â”œâ”€â”€ n8n (systemd, port 5678) â€” WhatsApp workflow
â””â”€â”€ OpenClaw (planned)       â€” Instagram AI (not yet deployed to Pi)
```

**Dev:** Frontend :3000 + Backend :3001 + OpenClaw :18789
**Prod (Pi):** Backend :3001 serves everything (single server)

---

## Critical Bug Patterns

### 1. Async setState (MOST COMMON)
```typescript
// âŒ WRONG â€” state is stale
setAnswers(prev => ({ ...prev, [id]: value }));
submitResponse({ answers }); // Empty!

// âœ… CORRECT â€” use new value directly
const newAnswers = { ...answers, [id]: value };
setAnswers(newAnswers);
submitResponse({ answers: newAnswers });
```

### 2. Hardcoded Dynamic Content
```typescript
// âŒ WRONG â€” won't update from admin
<p>{t('survey.question1')}</p>

// âœ… CORRECT â€” render from database
<p>{survey.questions[index].text}</p>
```

### 3. snake_case vs camelCase Mismatch
```typescript
// âœ… Transform at API boundary (hooks)
function transformData(data: any) {
  return { purposeTags: data.purpose_tags || [], isFeatured: data.is_featured === 1 };
}
```

### 4. ESM Import Extensions (CRITICAL for production builds)
```typescript
// âŒ WRONG â€” Node.js ESM runtime rejects extensionless relative imports
import { InstagramContextService } from '../services/InstagramContextService';
const vsModule = await import('../services/VectorStoreService');

// âœ… CORRECT â€” ALL relative imports MUST have .js extension
import { InstagramContextService } from '../services/InstagramContextService.js';
const vsModule = await import('../services/VectorStoreService.js');
```
Backend is `"type": "module"` (ESM). TypeScript compiles `.ts` â†’ `.js` but does NOT rewrite import specifiers. Node 18 ESM requires `.js` extensions on all relative imports. Dev mode (`tsx watch`) handles this transparently, but `tsc` output and `node dist/index.js` will crash without them.

---

## Quick Decision Tree

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty `{}` in DB | Async setState | Use new value directly |
| Content not updating | Hardcoded | Render from database |
| Property undefined | snake_case mismatch | Transform in API hook |
| Port in use | Process conflict | Kill all node, wait 3s |
| Connection refused | Server not ready | Wait 8-10s after start |
| Not iterable | Wrong data type | `Array.isArray()` check |
| OpenRouter 404 `requested_providers` | Account provider restriction | Clear Allowed Providers at openrouter.ai/settings/privacy |
| ERR_MODULE_NOT_FOUND (dist) | Missing `.js` extension in import | Add `.js` to all relative imports in source |
| Meta API 190 "Cannot parse access token" on `graph.facebook.com` | Instagram User Token (IGAA*) | Use `graph.instagram.com` instead â€” auto-detected in `/send` endpoint |
| Two processes on same port | Zombie node process | Kill all node, wait 3s, check `Get-NetTCPConnection -LocalPort 3001 -State Listen` |
| Jarvis gets "HEARTBEAT_OK" response | Heartbeat fires on Jarvis session | Set `heartbeat.target: "none"` in openclaw.json, `isHeartbeatResponse()` filter in jarvisRoutes.ts |
| DM response takes 50s+ | Policy retry via OpenClaw | Use direct OpenRouter correction in ResponsePolicyService (~2-3s vs ~15-20s per retry) |
| DM "Ã¼cret" not matching keywords | Turkish char normalization missing | `normalizeTurkish()` in `detectIntent()` â€” Ã¼â†’u, Ã¶â†’o, ÅŸâ†’s, Ã§â†’c, ÄŸâ†’g, Ä±â†’i |
| Follow-up gives wrong price | No conversation context in intent | `detectIntentWithContext()` merges topic from last 3 inbound messages (10min window) |
| Telegram gets Instagram persona | Polluted JSONL session | Delete stale JSONL + remove `agent:main:main` from sessions.json, add cross-channel guard to AGENTS.md |
| Direct response timeout (15s, 0 tokens) | Standard tier `enabled: false` | Enable in pipeline config via PATCH `/dm-kontrol/pipeline-config` or update `DEFAULT_CONFIG` |
| Simulator messages not in DM Kontrol feed | `datetime('now')` vs ISO timestamp | Use `new Date().toISOString()` for `created_at` â€” SQLite sorts space-separated format below ISO `T` format |
| Need to test DM pipeline without Instagram | No Meta webhook needed | Use `POST /api/workflow-test/simulate-agent` â€” runs exact same pipeline, results appear in DM Kontrol |
| Need to audit DM response quality | Nightly audit at 2AM or manual | `POST /api/mc/audit/run` â€” claim-level grounding check against KB, creates mc_jobs for issues |
| mc_jobs INSERT fails "no column named description" | Schema uses `payload` not `description` | Use `payload` column with JSON containing description field |
| Policy violation not notifying admin | EscalationService not wired | Check `setWebhookEscalation()` in index.ts, verify TELEGRAM_BOT_TOKEN set |
| Telegram bot not sending messages | Missing env vars | Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` in `.env` |
| Telegram 409 getUpdates conflict | OpenClaw + backend both polling same bot | Start OpenClaw first â€” `TelegramCallbackPoller` auto-detects and defers (30s reconciliation loop) |
| Jarvis subagent tries sqlite3 directly | Subagent has no DB access | `buildSystemContext()` pre-injects last 20 DMs + pipeline health; subagents must use HTTP API |

---

## Essential Commands

```powershell
# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Health check
curl http://localhost:3001/api/kiosk/health

# Start OpenClaw gateway
openclaw gateway --port 18789

# Start backend with fnm (Node 18)
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "User") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
fnm env --use-on-cd | Out-String -Stream | Where-Object { $_ -match '^\$env:' } | ForEach-Object { Invoke-Expression $_ }
fnm use 18
node dist/index.js   # from backend/
```

---

## Database

**Engine:** SQLite with WAL mode, `better-sqlite3`
**Path:** `backend/data/kiosk.db` (dev), `~/spa-kiosk/backend/data/kiosk.db` (Pi)
**Schema:** `backend/src/database/schema.sql`
**Seed:** `backend/src/database/seed-knowledge.ts` (idempotent, 61 Turkish entries â€” migrated 2026-02-23)
**Migrations:** Ad-hoc `ALTER TABLE` in `init.ts` (no formal framework)
**KB Migration Script:** `backend/scripts/migrate-kb.mjs` (replaces all KB entries, creates backup first)

### Key Tables
| Table | Purpose |
|-------|---------|
| `knowledge_base` | AI context (7 categories, 33+ entries) |
| `ai_system_prompts` | Dynamic AI prompts for n8n |
| `coupon_tokens/wallets/redemptions` | Coupon loyalty system |
| `instagram_interactions` | DM log with intent/sentiment + `model_used`, `tokens_estimated` columns |
| `whatsapp_interactions` | Message log |
| `suspicious_users` | Repeat offender tracking |

### Mission Control Tables (mc_*)
| Table | Purpose |
|-------|---------|
| `mc_agents` | AI agent registry (role, model, health, costs) |
| `mc_jobs` | Work items with state machine (queuedâ†’runningâ†’completed), `parent_job_id` + `board_id` for delegation |
| `mc_runs` | Individual execution runs per job |
| `mc_events` | Audit log for all MC entity changes |
| `mc_conversations` | Multi-channel conversation tracking |
| `mc_documents` | Document metadata for vector store |
| `mc_policies` | Configurable rules (escalation, routing, guardrails) |
| `mc_cost_ledger` | Token usage and cost tracking per run |
| `mc_skills` | Skill registry (name, prompt, test_case, status, fit_score) |
| `mc_approvals` | Confidence-based quality gates for jobs (score, rubric, verdict, reviewer notes) |
| `mc_boards` | Agent collaboration boards (name, objective, lead_agent, status) |
| `mc_board_agents` | Board membership (agent â†” board many-to-many) |
| `mc_agent_messages` | Inter-agent messages (sender, recipient, type, content, delivery_status) |
| `mc_shared_memory` | Board-scoped key-value store (memory_type, tags, TTL) |
| `mc_task_deps` | Task dependency graph (job_id depends_on dep_job_id) |
| `mc_gateways` | OpenClaw gateway registry (url, status, config, health) |
| `mc_tags` | Tag definitions (name, color, description) |
| `mc_tag_assignments` | Tag â†” entity many-to-many (entity_type, entity_id) |
| `mc_custom_fields` | Custom field definitions (name, type, entity_type, required) |
| `mc_custom_field_values` | Custom field values per entity |

**Schema:** `backend/src/database/mission-control-schema.sql` + `backend/src/database/agent-comms-schema.sql`
**Migration:** `backend/src/database/migrate-mission-control.cjs` (core MC), `ensureSchema()` in agentCommsRoutes.ts (agent-comms + approvals)

---

## n8n Integration API

**Auth:** Bearer token (`N8N_API_KEY` env var)
**Base:** `http://localhost:3001/api/integrations`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/coupons/consume` | POST | Consume token (rate limited) |
| `/coupons/claim` | POST | Redeem coupons (rate limited) |
| `/coupons/wallet/:phone` | GET | Check balance |
| `/knowledge/context?categories=X,Y` | GET | Knowledge for AI (category-filtered) |
| `/knowledge/entries` | GET | List all KB entries (raw, for agents) |
| `/knowledge/entries/:id` | PUT | Update KB entry (value, description, category) |
| `/ai/prompt/:name` | GET | AI system prompt (âš ï¸ no auth) |
| `/instagram/customer/:id` | GET | Customer data |
| `/instagram/interaction` | POST | Log interaction (accepts `modelUsed`, `tokensEstimated`) |
| `/instagram/suspicious/check/:id` | GET | Check suspicious |
| `/instagram/suspicious/flag/:id` | POST | Flag user |

---

## Mission Control API

**Base:** `http://localhost:3001/api/mc`
**Auth:** Session auth (same as admin panel)
**Pattern:** Factory function `createMissionControlRoutes(db)` receives raw SQLite db instance

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | System overview (agents, jobs, costs, events, interactions) |
| `/agents` | GET/POST | List/create AI agents |
| `/agents/:id` | GET/PATCH/DELETE | Agent CRUD with recent runs & events |
| `/jobs` | GET/POST | List/create jobs (filterable by status/source/agent) |
| `/jobs/:id` | GET | Job detail with runs & events |
| `/jobs/:id/status` | PATCH | State machine transitions with auto-retry |
| `/runs` | POST | Create execution run |
| `/runs/:id/complete` | PATCH | Complete run with token/cost tracking |
| `/conversations` | GET/POST | Multi-channel conversation tracking |
| `/conversations/:id` | PATCH | Update status/assignment |
| `/events` | GET | Audit log (filterable by entity) |
| `/costs` | GET | Cost analytics (by period/agent/model) |
| `/documents` | GET | List vector store documents |
| `/documents/ingest` | POST | Ingest document into Vectra vector store |
| `/documents/query` | POST | Semantic search across documents |
| `/documents/sync-kb` | POST | Sync knowledge_base table to vector store |
| `/policies` | GET/POST | Guardrail/routing policies |
| `/skills` | GET/POST | List/create skills (name, prompt, test_case required) |
| `/skills/:id` | PATCH/DELETE | Update/delete skill |
| `/momentum` | GET | Jaccard similarity score + per-task similarities |
| `/webhook/openclaw` | POST | OpenClaw lifecycle events (start/end/error) |
| `/approvals` | GET | List approvals (filterable by status/agent) |
| `/approvals/:id` | GET | Approval detail with rubric |
| `/approvals/:id/review` | PATCH | Submit review verdict (approved/rejected/revision_requested) |
| `/comms/send` | POST | Send inter-agent message (validates agents, delivers via OpenClaw) |
| `/comms/messages` | GET | List messages (paginated, filterable by sender/recipient/type/board) |
| `/comms/broadcast` | POST | Broadcast message to all board members |
| `/comms/delegate` | POST | Delegate task with dependencies (creates mc_jobs + mc_task_deps) |
| `/comms/task-completed` | POST | Notify board lead of task completion |
| `/comms/memory` | GET/POST/DELETE | Shared memory CRUD (upsert by board+key, filterable) |
| `/boards` | GET/POST | List/create collaboration boards |
| `/boards/:id` | GET/PATCH/DELETE | Board CRUD with members, jobs, memory |
| `/boards/:id/agents` | POST/DELETE | Board membership management |
| `/boards/:id/activity` | GET | Board activity feed (messages + events merged) |
| `/boards/:id/stream` | GET | SSE stream for real-time board updates |
| `/autopilot/status` | GET | AutoPilot status + stats |
| `/autopilot/config` | GET/PATCH | AutoPilot config (trigger toggles, thresholds) |
| `/autopilot/start` | POST | Start the engine |
| `/autopilot/stop` | POST | Stop the engine |
| `/autopilot/dispatch/:jobId` | POST | Manual dispatch a specific job |
| `/autopilot/stream` | GET | SSE stream for real-time AutoPilot events |
| `/autopilot/history` | GET | Recent AutoPilot events from mc_events |
| `/dm-kontrol/stream` | GET | SSE stream for real-time DM events |
| `/dm-kontrol/feed` | GET | Paginated recent DMs with pipeline trace |
| `/dm-kontrol/conversations/:id` | GET | Customer conversation thread |
| `/dm-kontrol/health` | GET | Pipeline health metrics (success rate, response time, cost) |
| `/dm-kontrol/errors` | GET | Pipeline errors (filterable by stage/date) |
| `/dm-kontrol/model-stats` | GET | Model routing statistics |
| `/dm-kontrol/test-mode` | GET/PATCH | Test mode config (toggle + sender whitelist) |
| `/audit/status` | GET | Nightly audit service status + config |
| `/audit/config` | GET/PATCH | Audit config (schedule, model, thresholds) |
| `/audit/run` | POST | Manual trigger â€” runs full audit immediately |
| `/audit/history` | GET | Past audit runs (limit param) |
| `/audit/latest` | GET | Most recent audit detail with all issues |
| `/audit/:runId` | GET | Specific audit run detail |

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/routes/missionControlRoutes.ts` | All MC API routes (factory pattern) |
| `backend/src/services/VectorStoreService.ts` | Vectra vector store (ingest/query/sync) |
| `backend/src/database/mission-control-schema.sql` | 9 MC tables schema (includes mc_skills) |
| `frontend/src/hooks/useMissionControlApi.ts` | React Query hooks for all MC endpoints |
| `frontend/src/pages/admin/mc/MC*.tsx` | 10 active MC pages (Dashboard, Workshop, Agents, Jarvis, Conversations, Costs, Policies, DM Kontrol, AutoPilot, Activity) |
| `frontend/src/components/mc/*.tsx` | Shared MC components (GlassCard, TabNav, MomentumGauge, HeartbeatTimer) |
| `frontend/src/lib/mc/*.ts` | MC utility functions (momentumUtils, workshopUtils, eventUtils) |
| `backend/src/routes/agentCommsRoutes.ts` | Agent comms + boards + delegation + memory routes (factory pattern) |
| `backend/src/services/CommsSSEManager.ts` | Board-scoped + global SSE for real-time comms updates |
| `backend/src/database/agent-comms-schema.sql` | 5 agent-comms tables schema |
| `frontend/src/components/mc/ConfidenceBar.tsx` | Approval confidence score visualization (UI removed from sidebar) |
| `frontend/src/components/mc/RubricChart.tsx` | Approval rubric radar chart (UI removed from sidebar) |
| `backend/src/routes/dmKontrolRoutes.ts` | DM Kontrol API routes (feed, health, errors, model-stats, test-mode) |
| `backend/src/services/DmSSEManager.ts` | DM-scoped SSE for real-time pipeline events |
| `frontend/src/pages/admin/mc/MCDMKontrolPage.tsx` | DM Kontrol UI (live feed, health, errors, models, test mode toggle) |
| `frontend/src/hooks/useDmKontrolApi.ts` | React Query hooks for DM Kontrol endpoints |
| `frontend/src/hooks/useDmKontrolSSE.ts` | SSE hook for real-time DM updates |
| `frontend/src/lib/mc/dmKontrolUtils.ts` | DM Kontrol utility functions |
| `backend/src/routes/autopilotRoutes.ts` | AutoPilot API routes (status, config, start/stop, dispatch, SSE, history) |
| `backend/src/services/AutoPilotService.ts` | AutoPilot engine (cron scanner, 4 triggers, config in mc_policies) |
| `backend/src/services/AgentDispatchService.ts` | Agent dispatch (OpenClaw session + JSONL polling + mc_runs/mc_jobs update) |
| `backend/src/services/AutoPilotSSEManager.ts` | Global SSE broadcaster for AutoPilot events |
| `frontend/src/pages/admin/mc/MCAutoPilotPage.tsx` | AutoPilot UI (stats, config, trigger toggles, scan results, event history) |
| `frontend/src/hooks/useAutoPilotApi.ts` | React Query hooks for AutoPilot endpoints |
| `frontend/src/hooks/useAutoPilotSSE.ts` | SSE hook for real-time AutoPilot updates |
| `backend/src/routes/activityRoutes.ts` | Activity feed API routes (events + DM aggregation, SSE) |
| `backend/src/services/NightlyAuditService.ts` | Nightly DM quality auditor (cron 2AM, claim-level grounding, issue grouping, mc_jobs creation) |
| `backend/src/routes/auditRoutes.ts` | Audit API routes (status, config, manual run, history, detail) |
| `backend/src/services/ActivitySSEManager.ts` | SSE broadcaster for activity feed |
| `frontend/src/pages/admin/mc/MCActivityPage.tsx` | Real-time activity feed UI |
| `frontend/src/hooks/useActivityApi.ts` | React Query hooks for activity feed |
| `frontend/src/hooks/useActivitySSE.ts` | SSE hook for real-time activity updates |
| `backend/src/routes/gatewayRoutes.ts` | Gateway CRUD + health check (UI removed from sidebar) |
| `backend/src/services/AgentLifecycleService.ts` | Agent lifecycle orchestrator (provision, checkin, reconcile) |
| `backend/src/routes/tagsRoutes.ts` | Tags + custom fields CRUD routes (UI removed from sidebar) |

### Frontend Routes (Active)
| Path | Page | Purpose |
|------|------|---------|
| `/admin/mc` | MCDashboardPage | Stats, events timeline, interactions feed, Instagram DM stats widget (model distribution, avg response time, cost) |
| `/admin/mc/workshop` | MCWorkshopPage | 3-column Kanban (Queued/Active/Completed), momentum sorting, bandwidth meter, heartbeat timer |
| `/admin/mc/agents` | MCAgentsPage | Tabbed layout (Personnel/Protocol/Comms), org chart, per-agent cost tracking, lifecycle badges |
| `/admin/mc/conversations` | MCConversationsPage | Channel/status filters, escalate/resolve |
| `/admin/mc/costs` | MCCostsPage | Period filter, by-model/by-agent breakdowns |
| `/admin/mc/policies` | MCPoliciesPage | Policy list with JSON conditions/actions |
| `/admin/mc/jarvis` | MCJarvisPage | AI assistant chat, task planning, DM review |
| `/admin/mc/dm-kontrol` | MCDMKontrolPage | DM pipeline monitoring (live feed, health, errors, model routing, test mode toggle) |
| `/admin/mc/autopilot` | MCAutoPilotPage | Autonomous agent engine (start/stop, config, trigger toggles, scan results, event history) |
| `/admin/mc/activity` | MCActivityPage | Real-time unified event stream, type filters, stats |

### Removed from Sidebar (backend routes still exist)
Approvals, Comms, Documents, Gateways, Skills, Tags/Custom Fields, AI Prompts, Blocked Users, Suspicious Users â€” removed during UI cleanup (2026-02-26). Backend API routes remain functional for programmatic access.

### ESM Compatibility Pattern
MC routes use a factory pattern to avoid ESM/CJS issues:
```typescript
// âœ… CORRECT â€” factory receives db from index.ts
export function createMissionControlRoutes(db: Database.Database) {
  _db = db;
  return router;
}
// In index.ts:
app.use('/api/mc', createMissionControlRoutes(db));
```

---

## OpenRouter Multi-Model Routing

**Provider:** OpenRouter (openrouter.ai)
**Primary Model:** Kimi K2 (`moonshotai/kimi-k2`) â€” cost-effective, good Turkish
**API Key env:** `OPENROUTER_API_KEY` in `backend/.env`
**OpenClaw config:** `openclaw-config/openclaw.json` â†’ `~/.openclaw/openclaw.json`

### Model Routing (openclaw.json)
```json
{
  "agents.defaults.model.primary": "openrouter/moonshotai/kimi-k2",
  "agents.defaults.model.fallbacks": ["openrouter/openai/gpt-4o-mini", "openrouter/deepseek/deepseek-chat", "openrouter/google/gemini-2.5-flash-lite"],
  "agents.defaults.heartbeat.model": "openrouter/google/gemini-2.5-flash-lite",
  "agents.defaults.subagents.model": "openrouter/deepseek/deepseek-chat",
  "agents.defaults.imageModel.primary": "openrouter/openai/gpt-4o-mini"
}
```

### OpenRouter Account Settings (CRITICAL)
If API returns `requested_providers: ["openai"]` 404 error:
1. Go to https://openrouter.ai/settings/privacy
2. Check **Provider Restrictions â†’ Allowed Providers** â€” must be EMPTY (no provider restriction)
3. Check **Routing â†’ Default Model** â€” clear it or set to a non-OpenAI model
4. These are account-level settings that override ALL API requests including OpenClaw

### Direct API Call Pattern
```typescript
// workflowTestRoutes.ts simulate-full endpoint
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://spa-kiosk.local',
    'X-Title': 'SPA Workflow Test'
  },
  body: JSON.stringify({
    model: 'moonshotai/kimi-k2',
    messages: [...],
    provider: { ignore: ['openai'], allow_fallbacks: true }
  })
});
```

### Changing Models
1. Update `openclaw-config/openclaw.json` â†’ copy to `~/.openclaw/openclaw.json`
2. Update `backend/src/routes/workflowTestRoutes.ts` (simulate-full endpoint)
3. Update `backend/src/database/migrate-mission-control.cjs` (seed defaults)
4. Update `frontend/src/pages/admin/mc/MCAgentsPage.tsx` (form defaults)
5. Restart OpenClaw gateway + backend

### OpenClaw + OpenRouter Integration Guide
Official docs: https://openrouter.ai/docs/guides/guides/openclaw-integration
- Model format: `openrouter/<author>/<slug>` (e.g. `openrouter/moonshotai/kimi-k2`)
- Config: set `OPENROUTER_API_KEY` in `env` section of `openclaw.json`
- Models list: empty `{}` objects are fine, `alias` is optional for `/model` command

---

## Instagram AI â€” OpenClaw Flow (Active)

**Status:** âœ… Full pipeline working (dev) with DM Intelligence + DM Kontrol Merkezi. Meta Graph API connected via `graph.instagram.com` (IGAA tokens).
**Toggle:** `USE_OPENCLAW=true` in `backend/.env`
**Model:** Dynamic â€” light/standard/advanced tier routing via `InstagramContextService`
**Test Mode:** `INSTAGRAM_TEST_MODE=true` + `INSTAGRAM_TEST_SENDER_IDS=id1,id2` â€” only whitelisted senders get AI responses. Toggleable from DM Kontrol UI.

```
Meta Webhook POST â†’ KIO /webhook/instagram
  â†’ InstagramContextService.analyzeMessage(senderId, text)
    â†’ getConversationHistory (last 10 messages from DB)
    â†’ detectIntent (Turkish keyword â†’ category mapping)
    â†’ classifyModelTier (light/standard/advanced)
  â†’ Fetch FILTERED knowledge + customer data (parallel)
    â†’ ?categories=services,pricing (from intent detection)
  â†’ Build enriched Turkish prompt (includes conversation history)
  â†’ POST to OpenClaw /hooks/instagram (202, hook mapping routes to main agent)
    â†’ messageTemplate: "{{message}}" passes enriched prompt through
    â†’ sessionKey: "hook:instagram:{{senderId}}"
  â†’ Poll ~/.openclaw/agents/main/sessions/ for response (45s timeout, 2s interval)
    â†’ Session key: agent:main:hook:instagram:{senderId}
    â†’ Looks for stopReason=stop, falls back to stable assistant text
  â†’ **Policy Agent validation** (ResponsePolicyService â€” Gemini Flash Lite)
    â†’ Checks 8 Turkish rules (no randevu, no hallucination, no capability claims, etc.)
    â†’ If FAIL: direct OpenRouter correction (~2-3s) instead of re-dispatching to OpenClaw (~15-20s)
    â†’ Max 2 retries, then safe fallback ("Bizi arayÄ±n: 0326 502 58 58")
    â†’ Violations create mc_events + Workshop jobs for admin review
  â†’ Send reply via /api/integrations/instagram/send (graph.instagram.com for IGAA tokens)
  â†’ Log via /api/integrations/instagram/interaction (model_used, tokens_estimated)
  â†’ MC Integration (fire-and-forget):
    â†’ UPSERT mc_conversations (channel=instagram)
    â†’ INSERT mc_cost_ledger (job_source=instagram, agent_id=instagram)
    â†’ INSERT mc_events (entity_type=conversation, event_type=dm_response)
```

### Model Tier Routing (InstagramContextService)
| Tier | Model | Trigger |
|------|-------|---------|
| light | `google/gemini-2.5-flash-lite` | Greetings only, single-category hours/contact |
| standard | `moonshotai/kimi-k2` | Multi-category queries (default) |
| advanced | `openai/gpt-4o-mini` | Complaints, long messages (200+ chars) |

### Turkish Character Normalization (CRITICAL)
`detectIntent()` and `classifyModelTier()` use `normalizeTurkish()` to convert Turkish diacritics to ASCII before keyword matching. Without this, `Ã¼cret` won't match `ucret` in `KEYWORD_CATEGORY_MAP`.
```typescript
// âŒ WRONG â€” Turkish chars don't match ASCII keywords
const normalized = messageText.toLowerCase().trim();

// âœ… CORRECT â€” normalize Turkish chars first
const normalized = normalizeTurkish(messageText.toLowerCase().trim());
// Ã¼â†’u, Ã¶â†’o, ÅŸâ†’s, Ã§â†’c, ÄŸâ†’g, Ä±â†’i, Ä°â†’i
```

### Context-Aware Intent Detection (Follow-ups)
`detectIntentWithContext()` handles follow-up messages like "Ã¼cret nedir?" after "taekwondo kursu varmÄ±?". When current message has a modifier category (pricing/hours/contact) but no topic (services), it checks last 3 inbound messages within 10 minutes for topic context and merges categories.

### Intent Detection Categories
`services`, `pricing`, `hours`, `policies`, `contact`, `faq` â€” matched via Turkish keyword map in `KEYWORD_CATEGORY_MAP` (ASCII-only keywords, normalization handles diacritics). Default: `['general', 'faq']`.

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/InstagramContextService.ts` | Core intelligence: intent detection (with `normalizeTurkish`), model routing, conversation history, context-aware follow-ups |
| `backend/src/services/ResponsePolicyService.ts` | Policy Agent: post-processing validation (8 rules) + direct OpenRouter correction |
| `backend/src/services/DirectResponseService.ts` | Direct OpenRouter calls bypassing OpenClaw (~1-3s vs ~10-40s) |
| `backend/src/services/PipelineConfigService.ts` | Dynamic pipeline config stored in `mc_policies` (direct response tiers, models, prompt template) |
| `backend/src/routes/instagramWebhookRoutes.ts` | Webhook handler + direct/OpenClaw routing + policy validation + MC integration |
| `backend/src/routes/instagramIntegrationRoutes.ts` | /send (graph.instagram.com auto-detect) and /interaction endpoints |
| `backend/src/routes/workflowTestRoutes.ts` | DM Simulator â€” runs exact same pipeline as real webhook (no Meta/OpenClaw needed) |
| `openclaw-config/openclaw.json` | Gateway + hooks + multi-model routing config |
| `openclaw-config/workspace/AGENTS.md` | OpenClaw agent instructions (includes cross-channel guard for Telegram) |

### DM Pipeline Config (Dynamic)
All DM pipeline behavior is stored as a JSON policy row in `mc_policies` (id: `dm_pipeline_config`). Editable at runtime via API â€” no restart needed.

| API | Method | Purpose |
|-----|--------|---------|
| `/api/mc/dm-kontrol/pipeline-config` | GET | Current config |
| `/api/mc/dm-kontrol/pipeline-config` | PATCH | Partial update (deep merge) |
| `/api/mc/dm-kontrol/pipeline-config/reset` | POST | Reset to `DEFAULT_CONFIG` |

Key config fields:
- `directResponse.tiers.{light,standard,advanced}.enabled` â€” toggle direct response per tier
- `directResponse.tiers.*.modelId` â€” model for each tier
- `directPrompt.systemTemplate` â€” system prompt with `{{knowledge}}` placeholder
- `policy.maxRetries` â€” correction attempts before fallback
- `fallbackMessage` â€” safe response when all retries fail

### DM Simulator (Testing Without Instagram)
`POST /api/workflow-test/simulate-agent` runs the EXACT same pipeline as the real Instagram webhook â€” intent detection â†’ KB fetch â†’ formatKnowledgeForPrompt â†’ DirectResponseService â†’ policy validation â†’ faithfulness check. Skips: Meta webhook, OpenClaw gateway, Meta Graph API send.

**Auth:** Session auth (admin panel) OR Bearer token (`N8N_API_KEY`)
**Results appear in:** DM Kontrol Merkezi live feed (same DB table + SSE events as real DMs)
**UI:** Sidebar â†’ Operasyonlar â†’ DM SimÃ¼latÃ¶r (`/admin/workflow-test`)

```powershell
# Test via API (use N8N_API_KEY from backend/.env)
$headers = @{"Authorization"="Bearer <N8N_API_KEY>"; "Content-Type"="application/json"}
$body = '{"message":"masaj fiyatlari ne kadar","senderId":"sim_test_001"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/workflow-test/simulate-agent" -Method POST -Body $body -Headers $headers
```

Response includes: `analysis` (intent, tier, keywords), `policy` (validation result), `directResponse` (latency, tokens), `responseTime`.

**CRITICAL â€” Timestamp format:** Simulator uses `new Date().toISOString()` for `created_at` (matching real webhook). Do NOT use SQLite `datetime('now')` â€” it produces space-separated format (`2026-02-26 21:39:33`) which sorts incorrectly against ISO format (`2026-02-26T21:39:33.000Z`) in `ORDER BY created_at DESC`.

**When to use the simulator:**
- After any change to the DM pipeline (InstagramContextService, PipelineConfigService, ResponsePolicyService, DirectResponseService, system prompt, KB entries)
- To verify anti-hallucination behavior (address, prices, hours should come from KB)
- To test policy validation and faithfulness checking
- To verify intent detection and model tier routing
- Results are visible in DM Kontrol â†’ CanlÄ± AkÄ±ÅŸ tab with full pipeline trace

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workflow-test/simulate-agent` | POST | Full pipeline simulation (message, senderId) |
| `/api/workflow-test/conversation/:senderId` | GET | Get conversation history for a sender |
| `/api/workflow-test/conversation/:senderId` | DELETE | Clear conversation history |
| `/api/workflow-test/knowledge` | GET | Debug: all KB entries |

### Direct Response Path (Bypass OpenClaw)
`DirectResponseService` calls OpenRouter directly for eligible tiers. Saves ~8-30s by skipping OpenClaw session creation + JSONL polling. Controlled by `PipelineConfigService.shouldUseDirectResponse(tier)`.

Current tier config:
| Tier | Direct | Model | Skip Policy | Typical Latency |
|------|--------|-------|-------------|-----------------|
| light | âœ… enabled | gemini-2.5-flash-lite | âœ… yes | ~1-2s |
| standard | âœ… enabled | kimi-k2 | âŒ no | ~3-8s |
| advanced | âŒ disabled | gpt-4o-mini | âŒ no | falls through to OpenClaw |

### Compilation (Single-File)
Full `tsc` build fails due to pre-existing errors in test files. Use single-file compile:
```powershell
# From backend/ directory
npx tsc src/routes/instagramWebhookRoutes.ts --outDir dist/routes --rootDir src/routes --esModuleInterop --module nodenext --moduleResolution nodenext --target es2020 --skipLibCheck --declaration false
```
Then restart the backend process.

### Full Backend Build (tsconfig.build.json)
A relaxed tsconfig that excludes test files and VectorStoreService, allowing full compilation:
```powershell
# From backend/ directory â€” builds entire backend to dist/
npx tsc -p tsconfig.build.json
# Then copy assets
Copy-Item -Path "src/database/schema.sql" -Destination "dist/database/schema.sql" -Force
```
Settings: `strict: false`, `noUnusedLocals: false`, `noImplicitAny: false`. Excludes `*.test.ts` and `VectorStoreService.ts`.
DO NOT modify `backend/tsconfig.json` â€” `tsconfig.build.json` is the production build config.

### OpenClaw Commands
```powershell
# Start gateway
openclaw gateway --port 18789

# Test webhook manually
$body = '{"object":"instagram","entry":[{"id":"17841400730256913","messaging":[{"sender":{"id":"test_001"},"message":{"text":"masaj fiyatlari"}}]}]}'
Invoke-RestMethod -Uri "http://localhost:3001/webhook/instagram" -Method POST -Body $body -ContentType "application/json"

# Check sessions
Get-Content "$env:USERPROFILE\.openclaw\agents\main\sessions\sessions.json" | ConvertFrom-Json
```

### OpenClaw Known Issues
1. **Security wrapper** â€” OpenClaw wraps all hook messages in `<<<EXTERNAL_UNTRUSTED_CONTENT>>>` tags. Agent may attempt tool calls (web_fetch to localhost, which gets blocked). The enriched prompt instructs the agent not to use tools, and the polling has a fallback for tool-stuck agents.
2. **Instagram Graph API domain** â€” Instagram User Tokens (`IGAA*` prefix) only work on `graph.instagram.com`, NOT `graph.facebook.com`. The `/send` endpoint auto-detects token type and uses the correct domain. API version: v25.0.
3. **Session creation delay** â€” Session appears in sessions.json ~5-10s after hook POST returns 202. Polling must wait patiently (45s timeout).
4. **Hook routing** â€” All hooks route to `main` agent regardless of agent config. Sessions are always under `agents/main/sessions/`. The `instagram` agent in agents.list is for MC tracking only.
5. **Cloudflare tunnel required for Meta webhooks** â€” Meta cannot reach `localhost:3001`. The user must manually start `cloudflared` tunnel before testing the Instagram DM pipeline end-to-end. Without it, Meta webhook deliveries will fail silently. The agent CANNOT start this â€” the user must run it themselves in a terminal.
6. **Heartbeat pollution** â€” OpenClaw heartbeat (`target: "last"`) fires on the most recent main agent session. If that's a Jarvis session, heartbeat responses leak into Jarvis chat. Fix: `target: "none"` in openclaw.json + `isHeartbeatResponse()` filter in `jarvisRoutes.ts` JSONL poller.
7. **Telegram session cross-channel contamination** â€” The `agent:main:main` session (Telegram) accumulates Instagram hook messages and heartbeat responses in its JSONL file. This causes Jarvis/Telegram to adopt Instagram DM persona. Fix: delete the polluted JSONL file + remove `agent:main:main` from sessions.json. Prevention: cross-channel guard in `openclaw-config/workspace/AGENTS.md` instructs agent to ignore Instagram hook messages when on Telegram/MC UI.

### OpenClaw Hook Routing Pattern
```typescript
// âŒ WRONG â€” /hooks/agent creates ephemeral sessions NOT in sessions.json
const hookUrl = 'http://127.0.0.1:18789/hooks/agent';

// âœ… CORRECT â€” /hooks/instagram matches hook mapping, creates persistent sessions
const hookUrl = OPENCLAW_WEBHOOK_URL.replace(/\/hooks\/.*$/, '/hooks/instagram');
// Session key: agent:main:hook:instagram:{senderId}
```

### OpenClaw messageTemplate Pattern
```json
// âŒ WRONG â€” uses raw text field, ignores enriched message
"messageTemplate": "Instagram DM from {{senderId}}: {{text}}"

// âœ… CORRECT â€” passes enriched message (with knowledge context) through
"messageTemplate": "{{message}}"
```

### Polling Bug Pattern
```typescript
// âŒ WRONG â€” breaks out of poll loop if session not yet created
if (!sessionInfo?.sessionId) break;

// âœ… CORRECT â€” continue polling, OpenClaw creates session async after 202
if (!sessionInfo?.sessionId) {
  await new Promise(r => setTimeout(r, pollInterval));
  continue;
}
```

---

## Jarvis Data Bridge â€” OpenClaw Integration

**Status:** âœ… Full pipeline working (dev). WebSocket auth + session creation + chat.send + JSONL polling all verified.
**Toggle:** `OPENCLAW_JARVIS_ENABLED=true` in `backend/.env`

### Flow: DM Quality Review
```
Frontend "DM Kalite Analizi" button â†’ POST /api/mc/jarvis/dm-review
  â†’ DataBridgeService.fetchDMReviewData(daysBack) â€” packages all DM data from SQLite
  â†’ OpenClawClientService.connect() (lazy singleton, WebSocket to gateway:18789)
  â†’ sessions.patch (key: agent:main:jarvis:jarvis:{id})
  â†’ chat.send (enriched task with ALL data pre-loaded in prompt)
  â†’ pollJarvisResponse() â€” reads JSONL files from ~/.openclaw/agents/main/sessions/
  â†’ Persist assistant message to DB â†’ push SSE event â†’ UI updates
```

### Flow: Regular Chat (Planning â†’ Confirm â†’ Execute)
```
User types message â†’ POST /api/mc/jarvis/sessions/:id/messages
  â†’ Persist user message â†’ chat.send to OpenClaw
  â†’ startResponsePolling() â†’ pollJarvisResponse() (JSONL polling, 60s timeout)
  â†’ If response contains task_summary JSON â†’ status = awaiting_confirmation
    â†’ task_summary includes: title, objective, targetFiles, constraints,
      deliverables, verificationSteps, suggestedModel, suggestedRole
  â†’ User clicks Onayla â†’ POST /sessions/:id/confirm
  â†’ Create mc_agent + mc_job â†’ sessions.patch (execution session)
  â†’ buildTaskInstructions() builds enriched prompt:
    â†’ Task details FIRST (most important for agent attention)
    â†’ targetFiles from planning (tells agent exactly which files to edit)
    â†’ verificationSteps (tells agent how to verify its work)
    â†’ PROJECT_MAP.md content (routeâ†’file mapping, architecture)
    â†’ Environment info (Windows, PowerShell, paths)
  â†’ chat.send (task instructions) â†’ startExecutionMonitoring() (JSONL polling, 5min timeout)
  â†’ On completion â†’ update mc_jobs/mc_runs â†’ push SSE status=completed
```

### Jarvis Planning Intelligence
The planning prompt (`PLANNING_SYSTEM_PROMPT` in jarvisRoutes.ts) requires structured output:
- `targetFiles`: exact file paths the agent should modify (from routeâ†’file mapping hints)
- `verificationSteps`: how to verify the change worked
- `suggestedModel`/`suggestedRole`: for MC agent creation

`PROJECT_MAP.md` (`openclaw-config/workspace/PROJECT_MAP.md` â†’ `~/.openclaw/workspace/PROJECT_MAP.md`) provides the agent with routeâ†’file mapping, APIâ†’file mapping, key services, components, hooks, and architecture patterns. This prevents the agent from editing wrong files.

### Response Polling Pattern (CRITICAL)
OpenClaw does NOT push `chat` events back over WebSocket for session responses. Agent responses go into JSONL files at `~/.openclaw/agents/main/sessions/{uuid}.jsonl`. The `pollJarvisResponse()` function reads these files directly â€” same proven pattern as `instagramWebhookRoutes.ts`.

```typescript
// âŒ WRONG â€” WebSocket chat events are NOT emitted for session responses
ocClient.on('chat', (event) => { /* never fires */ });

// âœ… CORRECT â€” Poll JSONL files directly
const response = await pollJarvisResponse(sessionKey, maxWaitMs);
// Reads sessions.json â†’ maps key to UUID â†’ reads {uuid}.jsonl â†’ finds assistant text
```

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/OpenClawClientService.ts` | WebSocket singleton, challenge-response auth, RPC |
| `backend/src/services/DataBridgeService.ts` | Packages SQLite data into agent prompts |
| `backend/src/services/JarvisSSEManager.ts` | Server-Sent Events for real-time UI updates |
| `backend/src/routes/jarvisRoutes.ts` | Jarvis CRUD, dm-review, JSONL polling, execution monitoring |
| `openclaw-config/workspace/PROJECT_MAP.md` | Codebase intelligence for agents (routeâ†’file, APIâ†’file mappings) |
| `frontend/src/pages/admin/mc/MCJarvisPage.tsx` | Jarvis UI (chat, TaskSummaryCard, CompletionBanner) |
| `frontend/src/hooks/useJarvisSSE.ts` | SSE hook â€” auto-reconnect, React Query invalidation |
| `frontend/src/hooks/useJarvisApi.ts` | React Query hooks for all Jarvis endpoints |

### OpenClaw WebSocket Auth (CRITICAL)
- `client.id`: must be valid `GATEWAY_CLIENT_IDS` (use `'gateway-client'`)
- `client.mode`: must be valid `GATEWAY_CLIENT_MODES` (use `'backend'`)
- Must include `role: 'operator'`, `scopes: ['operator.admin']`
- Token must be read at call time (`process.env.OPENCLAW_GATEWAY_TOKEN`), not constructor time (singleton created before dotenv)

### RPC Methods
| Action | Method | Key Params |
|--------|--------|-----------|
| Create session | `sessions.patch` | `{ key, label }` |
| Send message | `chat.send` | `{ sessionKey, message, idempotencyKey }` |
| Get history | `chat.history` | `{ sessionKey }` |
| Abort | `chat.abort` | `{ sessionKey }` |

### Jarvis API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions` | GET/POST | List/create planning sessions |
| `/sessions/:id` | GET | Session detail with agent/job |
| `/sessions/:id/messages` | GET/POST | Messages CRUD + OpenClaw forwarding |
| `/sessions/:id/stream` | GET | SSE endpoint for real-time updates |
| `/sessions/:id/confirm` | POST | Confirm plan â†’ create agent + job â†’ dispatch |
| `/dm-review` | POST | One-click DM quality review (data bridge) |
| `/data-bridge/instagram` | GET | Preview packaged Instagram data |

---

## Closed-Loop DM Quality System (Escalation + Telegram)

**Status:** âœ… Built and wired into all pipeline components.

### Architecture
```
Real-time DM â†’ ResponsePolicyService
  â”œâ”€â”€ corrected â†’ log only (EscalationService: log_only)
  â””â”€â”€ fallback (critical) â†’ EscalationService â†’ Telegram notification + Workshop job

Nightly Audit â†’ NightlyAuditService (2:00 AM)
  â”œâ”€â”€ hallucinated â†’ EscalationService â†’ Analyst agent job + Telegram
  â””â”€â”€ partially_grounded â†’ EscalationService â†’ Analyst agent job

AutoPilot scans â†’ AutoPilotService
  â”œâ”€â”€ DM failures (3+/hr) â†’ EscalationService â†’ Telegram notification
  â””â”€â”€ Cost spikes â†’ EscalationService â†’ Telegram notification

Telegram Admin Actions (3 methods, any works):
  1. callback_query buttons â†’ TelegramCallbackPoller (when OpenClaw is NOT running)
  2. ðŸŒ Panel URL button â†’ opens Workshop in admin panel (always works)
  3. /esc text commands â†’ Jarvis processes via API (when OpenClaw IS running)
```

### Telegram Bot Coexistence (OpenClaw + Backend)
OpenClaw and the backend share the same Telegram bot token. Only one can use `getUpdates` at a time.

**`TelegramCallbackPoller`** handles this automatically:
- On startup, checks if OpenClaw gateway is running on port 18789
- If OpenClaw is up â†’ defers polling, logs "OpenClaw detected â€” deferring"
- If OpenClaw is down â†’ starts `getUpdates` polling for `callback_query` only
- Every 30s, reconciles: if OpenClaw came up â†’ stops polling; if it went down â†’ resumes
- **Start order matters:** Start OpenClaw FIRST, then backend, for cleanest startup

**When OpenClaw IS running** (callback buttons won't work):
- Every notification includes a "ðŸŒ Panel" URL button â†’ opens Workshop in admin panel
- Admin can type `/esc approve <jobId>` to Jarvis in Telegram (AGENTS.md has instructions)
- Admin can manage jobs directly from the web UI at `/admin/mc/workshop`

### Escalation Rules
| Issue Type | Severity | Action |
|------------|----------|--------|
| policy_violation_critical | critical | Telegram notification |
| policy_violation_corrected | low | Log only (auto-handled) |
| audit: hallucinated | high | Analyst agent + Telegram |
| audit: partially_grounded | medium | Analyst agent only |
| dm_pipeline_failure (3+/hr) | high | Telegram notification |
| cost_spike | medium | Telegram notification |
| repeated_violations (3+/hr) | critical | Telegram (urgent) |

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/EscalationService.ts` | Decision engine â€” routes issues to agent/Telegram/log |
| `backend/src/services/TelegramNotificationService.ts` | Telegram Bot API â€” sends alerts with inline + URL buttons |
| `backend/src/services/TelegramCallbackPoller.ts` | Polls callback_query when OpenClaw is down, auto-defers when up (30s reconciliation) |
| `backend/src/routes/telegramWebhookRoutes.ts` | Receives admin decisions from Telegram callback_query (webhook mode) |

### Env Vars
```
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_ADMIN_CHAT_ID=<from @userinfobot>
```

---

## Known Security Issues

1. **`.env` has real credentials committed to git** â€” needs `.gitignore` fix + token rotation
2. **AI prompt routes have no auth** â€” `/api/integrations/ai/prompt/:name` is public
3. **No webhook signature verification in backend** â€” backend forwards to n8n without verifying Meta signature
4. **Instagram test mode is runtime-only** â€” PATCH `/dm-kontrol/test-mode` updates `process.env` in-memory, lost on restart. `.env` file is the persistent source of truth.

---

## Pi Connection

```powershell
# SSH
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_pi" eform-kio@192.168.1.8

# SCP
scp -i "$env:USERPROFILE\.ssh\id_ed25519_pi" <local> eform-kio@192.168.1.8:<remote>

# n8n commands (via SSH)
n8n list:workflow 2>/dev/null
n8n import:workflow --input=/path/to/file.json 2>/dev/null
n8n update:workflow --id=<ID> --active=true 2>/dev/null
sudo systemctl restart n8n
```

### Direct DB Editing (Pi)
```powershell
# Use SQL files â€” PowerShell escaping is problematic
fsWrite("temp_query.sql", "SELECT * FROM knowledge_base;")
scp -i ... temp_query.sql eform-kio@192.168.1.8:/tmp/
ssh -i ... "sqlite3 ~/spa-kiosk/backend/data/kiosk.db < /tmp/temp_query.sql"
ssh -i ... "pm2 restart kiosk-backend"  # Required after changes
```

---

## Documentation Policy

**DO NOT create:** Implementation reports, feature summaries, user guides, verification reports.
**DO:** Brief 2-3 sentence summary after feature. Update steering for new patterns only.

---

**Last Updated:** 2026-02-27
**Status:** âœ… Production on Pi (192.168.1.8), OpenClaw Instagram pipeline working with Kimi K2 (dev), Instagram DM Intelligence (context service, model routing, Turkish char normalization, context-aware follow-ups, MC integration), Direct Response Pipeline (light+standard tiers bypass OpenClaw, ~5-7s total), Pipeline Config Service (dynamic config in mc_policies, runtime-editable via API), Policy Agent (ResponsePolicyService â€” 8-rule validation + faithfulness scoring + direct OpenRouter correction, fallback creates Workshop jobs), Meta Graph API connected via graph.instagram.com (IGAA token valid, v25.0), DM Kontrol Merkezi (live feed, pipeline health, errors, model routing, test mode toggle, policy badges per message), DM Simulator (`/api/workflow-test/simulate-agent` â€” full pipeline without Meta/OpenClaw, results in DM Kontrol feed), Mission Control UI (glassmorphism dark theme, 10 active MC pages â€” cleaned up from 17), Jarvis Data Bridge working (JSONL polling with heartbeat filter, DM quality review, planning chat, task execution, `buildSystemContext` injects last 20 DMs + pipeline health), AutoPilot autonomous agent engine (4 triggers, cron scanner, AgentDispatchService), Real-Time Activity Feed, Agent Lifecycle Orchestrator, Enhanced Dashboard with comparison metrics, KB migrated to 61 entries with Turkish diacritics, anti-hallucination architecture (formatted KB, faithfulness scoring, "SADECE BÄ°LGÄ° BANKASINI KULLAN" framing), full backend build via tsconfig.build.json, heartbeat target set to "none". UI cleanup (2026-02-26): removed Approvals, Comms, Documents, Gateways, Skills, Tags, AI Prompts, Blocked/Suspicious Users from sidebar (backend routes preserved). Closed-Loop DM Quality System (2026-02-27): EscalationService + TelegramNotificationService + Telegram webhook â€” routes policy violations/audit findings/DM failures to analyst agent or Telegram admin with inline approve/reject buttons + ðŸŒ Panel URL fallback. TelegramCallbackPoller auto-reconciles with OpenClaw (30s check, defers when gateway is up, resumes when down). Jarvis subagent fix: AGENTS.md updated to enforce HTTP API access (no direct SQLite), buildSystemContext enriched with recent DMs + health stats. OpenClaw AGENTS.md: added `/esc` text commands for escalation handling via Telegram chat.
