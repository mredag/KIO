# Ultimate Kiro Steering Guide

**Single source of truth for all critical patterns, commands, and architecture.**

---

## Architecture Overview

```
Dev Machine (Windows, Node 18 via fnm)
├── Backend (port 3001) — Express + SQLite (WAL mode)
│   ├── /api/admin/*          — Session auth (admin panel)
│   ├── /api/kiosk/*          — Public (kiosk UI)
│   ├── /api/integrations/*   — API key auth (n8n/OpenClaw)
│   ├── /webhook/whatsapp     — Meta webhook (legacy, replaced by OpenClaw Baileys)
│   └── /webhook/instagram    — Meta webhook → OpenClaw (USE_OPENCLAW=true) or n8n
├── OpenClaw (port 18789) — AI agent gateway (Instagram + WhatsApp + Jarvis)
│   ├── Instagram hook        — GPT-4o-mini via OpenRouter, multi-model routing
│   └── WhatsApp agent        — Baileys/WhatsApp Web channel, dedicated workspace, GPT-4o-mini
├── n8n (Pi only, port 5678) — Workflow automation (legacy, disabled)
│   └── WhatsApp workflow     — Replaced by OpenClaw WhatsApp agent
└── Frontend (served by backend in prod)

Raspberry Pi 5 (192.168.1.8, Node 22.22.0, Debian 13 aarch64)
  Backend (PM2 kio-backend, port 3001) - same as above
  OpenClaw (PM2 kio-openclaw, port 18789) - Instagram AI + WhatsApp AI + Jarvis + Telegram
  Cloudflared (systemd) - tunnel webhook.eformspa.com -> localhost:3001
  n8n (systemd, disabled) - WhatsApp workflow (legacy)
```

**Dev:** Frontend :3000 + Backend :3001 + OpenClaw :18789
**Prod (Pi):** Backend :3001 serves frontend + OpenClaw :18789 for AI agents
**Old system:** `~/spa-kiosk/` (untouched rollback), n8n disabled

---

## Critical Bug Patterns

### 1. Async setState (MOST COMMON)
```typescript
// ❌ WRONG — state is stale
setAnswers(prev => ({ ...prev, [id]: value }));
submitResponse({ answers }); // Empty!

// ✅ CORRECT — use new value directly
const newAnswers = { ...answers, [id]: value };
setAnswers(newAnswers);
submitResponse({ answers: newAnswers });
```

### 2. Hardcoded Dynamic Content
```typescript
// ❌ WRONG — won't update from admin
<p>{t('survey.question1')}</p>

// ✅ CORRECT — render from database
<p>{survey.questions[index].text}</p>
```

### 3. snake_case vs camelCase Mismatch
```typescript
// ✅ Transform at API boundary (hooks)
function transformData(data: any) {
  return { purposeTags: data.purpose_tags || [], isFeatured: data.is_featured === 1 };
}
```

### 4. ESM Import Extensions (CRITICAL for production builds)
```typescript
// ❌ WRONG — Node.js ESM runtime rejects extensionless relative imports
import { InstagramContextService } from '../services/InstagramContextService';
const vsModule = await import('../services/VectorStoreService');

// ✅ CORRECT — ALL relative imports MUST have .js extension
import { InstagramContextService } from '../services/InstagramContextService.js';
const vsModule = await import('../services/VectorStoreService.js');
```
Backend is `"type": "module"` (ESM). TypeScript compiles `.ts` → `.js` but does NOT rewrite import specifiers. Node 18 ESM requires `.js` extensions on all relative imports. Dev mode (`tsx watch`) handles this transparently, but `tsc` output and `node dist/index.js` will crash without them.

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
| Meta API 190 "Cannot parse access token" on `graph.facebook.com` | Instagram User Token (IGAA*) | Use `graph.instagram.com` instead — auto-detected in `/send` endpoint |
| Two processes on same port | Zombie node process | Kill all node, wait 3s, check `Get-NetTCPConnection -LocalPort 3001 -State Listen` |
| Jarvis gets "HEARTBEAT_OK" response | Heartbeat fires on Jarvis session | Set `heartbeat.target: "none"` in openclaw.json, `isHeartbeatResponse()` filter in jarvisRoutes.ts |
| DM response takes 50s+ | Policy retry via OpenClaw | Use direct OpenRouter correction in ResponsePolicyService (~2-3s vs ~15-20s per retry) |
| DM "ücret" not matching keywords | Turkish char normalization missing | `normalizeTurkish()` in `detectIntent()` — ü→u, ö→o, ş→s, ç→c, ğ→g, ı→i |
| Follow-up gives wrong price | No conversation context in intent | `detectIntentWithContext()` merges topic from last 3 inbound messages (10min window) |
| Telegram gets Instagram persona | Polluted JSONL session | Delete stale JSONL + remove `agent:main:main` from sessions.json, add cross-channel guard to AGENTS.md |
| Direct response timeout (15s, 0 tokens) | Standard tier `enabled: false` | Enable in pipeline config via PATCH `/dm-kontrol/pipeline-config` or update `DEFAULT_CONFIG` |
| Simulator messages not in DM Kontrol feed | `datetime('now')` vs ISO timestamp | Use `new Date().toISOString()` for `created_at` — SQLite sorts space-separated format below ISO `T` format |
| Need to test DM pipeline without Instagram | No Meta webhook needed | Use `POST /api/workflow-test/simulate-agent` — runs exact same pipeline, results appear in DM Kontrol |
| Need to audit DM response quality | Nightly audit at 2AM or manual | `POST /api/mc/audit/run` — claim-level grounding check against KB, creates mc_jobs for issues |
| mc_jobs INSERT fails "no column named description" | Schema uses `payload` not `description` | Use `payload` column with JSON containing description field |
| Policy violation not notifying admin | EscalationService not wired | Check `setWebhookEscalation()` in index.ts, verify TELEGRAM_BOT_TOKEN set |
| Telegram bot not sending messages | Missing env vars | Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` in `.env` |
| Telegram 409 getUpdates conflict | OpenClaw + backend both polling same bot | Start OpenClaw first — `TelegramCallbackPoller` auto-detects and defers (30s reconciliation loop) |
| Jarvis subagent tries sqlite3 directly | Subagent has no DB access | `buildSystemContext()` pre-injects last 20 DMs + pipeline health; subagents must use HTTP API |
| DM forgets user after 40s | Inbound messages not stored in DB | Fixed: webhook now INSERTs inbound to instagram_interactions before AI processing |
| Policy flags phone as hallucination | contact KB category not fetched | Fixed: contact category ALWAYS included in KB fetch (phone/address always visible to policy agent) |
| MC integration points at raw OpenClaw agent id | OpenClaw ids differ from MC ids | Normalize through `resolveMissionControlAgentId()` (`instagram` -> `instagram-dm`, `whatsapp` -> `whatsapp-dm`) |
| WhatsApp session not connecting | QR code expired or Baileys auth issue | Re-scan QR code in OpenClaw, check `openclaw.json` channel config |
| WhatsApp messages not processed | Agent not bound to channel | Check `agents.bindings` in `openclaw.json` for `channel: "whatsapp"` match |
| WhatsApp ignore list not working | Phone format mismatch | Normalize phone: strip spaces/dashes, ensure `90` prefix (not `+90` or `0`) |
| WhatsApp appointment not notifying | Telegram env vars missing | Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` in `.env` |
| WhatsApp response too slow | Direct response disabled for tier | Check `wa_pipeline_config` in mc_policies, enable direct response for tier |
| Need to debug bad DM response | No execution tracking | Use execution ID from DM Kontrol feed → `GET /api/mc/dm-kontrol/execution/:executionId` for full pipeline trace |
| AI exposes "bilgi bankası" to customer | System term leakage | Rule 11 in ResponsePolicyService catches and rejects responses with internal terms |

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
**Path:** `backend/data/kiosk.db` (dev), `~/kio-new/data/kiosk.db` (Pi)
**Schema:** `backend/src/database/schema.sql`
**Seed:** `backend/src/database/seed-knowledge.ts` (bootstrap/default data source - not for routine live KB edits)
**Migrations:** Ad-hoc `ALTER TABLE` in `init.ts` (no formal framework)
**KB Migration Script:** `backend/scripts/migrate-kb.mjs` (bulk migration tool - not for one-off live KB edits)
**Live KB Rule:** `/admin/knowledge-base` shows live `knowledge_base` data. For live KB changes use the admin API or the preview-first integration flow in `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md`. Do not bulk-reseed live KB data to change one row.

### Key Tables
| Table | Purpose |
|-------|---------|
| `knowledge_base` | Live AI/admin KB facts (7 categories; count varies by environment) |
| `ai_system_prompts` | Dynamic AI prompts for n8n |
| `coupon_tokens/wallets/redemptions` | Coupon loyalty system |
| `instagram_interactions` | DM log with intent/sentiment + `model_used`, `tokens_estimated` columns |
| `whatsapp_interactions` | Message log + `model_used`, `tokens_estimated`, `model_tier`, `pipeline_trace`, `pipeline_error`, `media_type` columns |
| `whatsapp_appointment_requests` | Appointment requests (phone, service, date/time, status, staff_notes) |
| `whatsapp_ignore_list` | Numbers to skip AI processing (staff, suppliers, family) |
| `suspicious_users` | Repeat offender tracking |

### Mission Control Tables (mc_*)
| Table | Purpose |
|-------|---------|
| `mc_agents` | AI agent registry (role, model, health, costs) |
| `mc_jobs` | Work items with state machine (queued→running→completed), `parent_job_id` + `board_id` for delegation |
| `mc_runs` | Individual execution runs per job |
| `mc_events` | Audit log for all MC entity changes |
| `mc_conversations` | Multi-channel conversation tracking |
| `mc_documents` | Document metadata for vector store |
| `mc_policies` | Configurable rules (escalation, routing, guardrails) |
| `mc_cost_ledger` | Token usage and cost tracking per run |
| `mc_skills` | Skill registry (name, prompt, test_case, status, fit_score) |
| `mc_approvals` | Confidence-based quality gates for jobs (score, rubric, verdict, reviewer notes) |
| `mc_boards` | Agent collaboration boards (name, objective, lead_agent, status) |
| `mc_board_agents` | Board membership (agent ↔ board many-to-many) |
| `mc_agent_messages` | Inter-agent messages (sender, recipient, type, content, delivery_status) |
| `mc_shared_memory` | Board-scoped key-value store (memory_type, tags, TTL) |
| `mc_task_deps` | Task dependency graph (job_id depends_on dep_job_id) |
| `mc_gateways` | OpenClaw gateway registry (url, status, config, health) |
| `mc_tags` | Tag definitions (name, color, description) |
| `mc_tag_assignments` | Tag ↔ entity many-to-many (entity_type, entity_id) |
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
| `/ai/prompt/:name` | GET | AI system prompt (⚠️ no auth) |
| `/instagram/customer/:id` | GET | Customer data |
| `/instagram/interaction` | POST | Log interaction (accepts `modelUsed`, `tokensEstimated`) |
| `/instagram/suspicious/check/:id` | GET | Check suspicious |
| `/instagram/suspicious/flag/:id` | POST | Flag user |
| `/whatsapp/ignore-check/:phone` | GET | Check if phone is on ignore list |
| `/whatsapp/ignore-list` | GET/POST | List/add ignored numbers |
| `/whatsapp/ignore-list/:phone` | DELETE | Remove from ignore list |
| `/whatsapp/interaction` | POST | Log WhatsApp interaction |
| `/whatsapp/validate-response` | POST | Policy validation on agent response |
| `/whatsapp/appointment-requests` | GET/POST | List/create appointment requests |
| `/whatsapp/appointment-requests/:id` | PATCH | Update appointment status |
| `/whatsapp/stats` | GET | WhatsApp stats summary |
| `/whatsapp/recent-messages` | GET | Recent interactions |
| `/whatsapp/conversation/:phone` | GET | Conversation history |

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
| `/dm-kontrol/feed` | GET | Unified paginated DMs across Instagram + WhatsApp with channel filter |
| `/dm-kontrol/conversations/:id` | GET | Customer conversation thread |
| `/dm-kontrol/health` | GET | Per-channel pipeline health metrics (success rate, response time, cost) |
| `/dm-kontrol/errors` | GET | Pipeline errors (filterable by stage/date) |
| `/dm-kontrol/model-stats` | GET | Model routing statistics |
| `/dm-kontrol/test-mode` | GET/PATCH | Test mode config (toggle + sender whitelist) |
| `/dm-kontrol/execution/:executionId` | GET | Full execution detail (inbound, outbound, pipeline trace, errors, model, tokens) for debugging |
| `/dm-kontrol/wa-pipeline-config` | GET/PATCH | WhatsApp pipeline config (deep merge on PATCH) |
| `/dm-kontrol/wa-pipeline-config/reset` | POST | Reset WhatsApp pipeline config to defaults |
| `/audit/status` | GET | Nightly audit service status + config |
| `/audit/config` | GET/PATCH | Audit config (schedule, model, thresholds) |
| `/audit/run` | POST | Manual trigger — runs full audit immediately |
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
| `backend/src/services/NightlyAuditService.ts` | Nightly DM quality auditor (cron 2AM, claim-level grounding, issue grouping, mc_jobs creation). Per-channel audit config: `channels: { instagram: true, whatsapp: true }` |
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
| `/admin/mc` | MCDashboardPage | Stats, events timeline, interactions feed, Instagram + WhatsApp DM stats widget (model distribution, avg response time, cost) |
| `/admin/mc/workshop` | MCWorkshopPage | 3-column Kanban (Queued/Active/Completed), momentum sorting, bandwidth meter, heartbeat timer |
| `/admin/mc/agents` | MCAgentsPage | Tabbed layout (Personnel/Protocol/Comms), org chart, per-agent cost tracking, lifecycle badges |
| `/admin/mc/conversations` | MCConversationsPage | Channel/status filters, escalate/resolve |
| `/admin/mc/costs` | MCCostsPage | Period filter, by-model/by-agent breakdowns |
| `/admin/mc/policies` | MCPoliciesPage | Policy list with JSON conditions/actions |
| `/admin/mc/jarvis` | MCJarvisPage | AI assistant chat, task planning, DM review |
| `/admin/mc/dm-kontrol` | MCDMKontrolPage | Unified DM pipeline monitoring across Instagram + WhatsApp (live feed with channel filter, health, errors, model routing, test mode toggle) |
| `/admin/mc/autopilot` | MCAutoPilotPage | Autonomous agent engine (start/stop, config, trigger toggles, scan results, event history) |
| `/admin/mc/activity` | MCActivityPage | Real-time unified event stream, type filters, stats |

### Removed from Sidebar (backend routes still exist)
Approvals, Comms, Documents, Gateways, Skills, Tags/Custom Fields, AI Prompts, Blocked Users, Suspicious Users — removed during UI cleanup (2026-02-26). Backend API routes remain functional for programmatic access.

### ESM Compatibility Pattern
MC routes use a factory pattern to avoid ESM/CJS issues:
```typescript
// ✅ CORRECT — factory receives db from index.ts
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
**Primary Model:** GPT-4.1 (`openai/gpt-4.1`) — commander/default routing
**API Key env:** `OPENROUTER_API_KEY` in `backend/.env`
**OpenClaw config:** `openclaw-config/openclaw.json` → `~/.openclaw/openclaw.json`

### Model Routing (openclaw.json)
```json
{
  "agents.defaults.model.primary": "openrouter/openai/gpt-4.1",
  "agents.defaults.model.fallbacks": ["openrouter/openai/gpt-4o-mini", "openrouter/google/gemini-2.5-flash-lite"],
  "agents.defaults.heartbeat.model": "openrouter/google/gemini-2.5-flash-lite",
  "agents.defaults.subagents.model": "openrouter/openai/gpt-4.1",
  "agents.defaults.imageModel.primary": "openrouter/openai/gpt-4o-mini"
}
```

### OpenRouter Account Settings (CRITICAL)
If API returns `requested_providers: ["openai"]` 404 error:
1. Go to https://openrouter.ai/settings/privacy
2. Check **Provider Restrictions → Allowed Providers** — must be EMPTY (no provider restriction)
3. Check **Routing → Default Model** — clear it or set to a non-OpenAI model
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
    model: 'openai/gpt-4.1',
    messages: [...],
    provider: { ignore: ['openai'], allow_fallbacks: true }
  })
});
```

### Changing Models
1. Update `openclaw-config/openclaw.json` → copy to `~/.openclaw/openclaw.json`
2. Update `backend/src/routes/workflowTestRoutes.ts` (simulate-full endpoint)
3. Update `backend/src/database/migrate-mission-control.cjs` (seed defaults)
4. Update `frontend/src/pages/admin/mc/MCAgentsPage.tsx` (form defaults)
5. Restart OpenClaw gateway + backend

### OpenClaw + OpenRouter Integration Guide
Official docs: https://openrouter.ai/docs/guides/guides/openclaw-integration
- Model format: `openrouter/<author>/<slug>` (e.g. `openrouter/openai/gpt-4.1`)
- Config: set `OPENROUTER_API_KEY` in `env` section of `openclaw.json`
- Models list: empty `{}` objects are fine, `alias` is optional for `/model` command

---

## Instagram AI — OpenClaw Flow (Active)

**Status:** ✅ Full pipeline working (dev) with DM Intelligence + DM Kontrol Merkezi. Meta Graph API connected via `graph.instagram.com` (IGAA tokens).
**Toggle:** `USE_OPENCLAW=true` in `backend/.env`
**Model:** Dynamic — light/standard/advanced tier routing via `InstagramContextService`
**Test Mode:** `INSTAGRAM_TEST_MODE=true` + `INSTAGRAM_TEST_SENDER_IDS=id1,id2` — only whitelisted senders get AI responses. Toggleable from DM Kontrol UI.

```
Meta Webhook POST → KIO /webhook/instagram
  → InstagramContextService.analyzeMessage(senderId, text)
    → getConversationHistory (last 10 messages from DB, 24h window)
    → detectIntent (Turkish keyword → category mapping)
    → classifyModelTier (light/standard/advanced)
  → **Log inbound message to DB** (ensures conversation history for follow-ups)
    → UPSERT instagram_customers (FK safety)
    → INSERT instagram_interactions (direction=inbound)
  → Fetch FILTERED knowledge + customer data
    → ?categories=intent_cats + contact (contact ALWAYS included for phone/address)
  → DirectResponseService (light+standard tiers) OR OpenClaw (advanced/fallback)
    → Direct: OpenRouter API call (~1-8s)
    → OpenClaw: POST /hooks/instagram → poll JSONL (~30-40s)
  → **Policy Agent validation** (ResponsePolicyService — Gemini Flash Lite)
    → Checks 8 Turkish rules (no randevu, no hallucination, no capability claims, etc.)
    → If FAIL: direct OpenRouter correction (~2-3s)
    → Max 2 retries, then safe fallback ("Bizi arayın: 0326 502 58 58")
    → Violations create mc_events + Workshop jobs for admin review
  → Send reply via /api/integrations/instagram/send (graph.instagram.com for IGAA tokens)
  → Log outbound via /api/integrations/instagram/interaction (model_used, tokens_estimated)
  → MC Integration (fire-and-forget):
    → UPSERT mc_conversations (channel=instagram)
    → INSERT mc_cost_ledger (job_source=instagram, agent_id=instagram-dm)
    → INSERT mc_events (entity_type=conversation, event_type=dm_response)
```

### Model Tier Routing (InstagramContextService)
| Tier | Model | Trigger |
|------|-------|---------|
| light | `openai/gpt-4.1-mini` | Greetings only, single-category hours/contact |
| standard | `openai/gpt-4o-mini` | Multi-category queries (default) — upgraded 2026-03-02 for better Turkish quality |
| advanced | `openai/gpt-4o-mini` | Complaints, long messages (200+ chars) |

**Model Upgrade History:**
- 2026-03-02: Standard tier upgraded from `moonshotai/kimi-k2` to `openai/gpt-4o-mini` to eliminate hallucinations, improve Turkish response quality, and prevent system term exposure ("bilgi bankası", "veri tabanı"). Sexual intent filter also upgraded to GPT-4o-mini for better accuracy.

### Turkish Character Normalization (CRITICAL)
`detectIntent()` and `classifyModelTier()` use `normalizeTurkish()` to convert Turkish diacritics to ASCII before keyword matching. Without this, `ücret` won't match `ucret` in `KEYWORD_CATEGORY_MAP`.
```typescript
// ❌ WRONG — Turkish chars don't match ASCII keywords
const normalized = messageText.toLowerCase().trim();

// ✅ CORRECT — normalize Turkish chars first
const normalized = normalizeTurkish(messageText.toLowerCase().trim());
// ü→u, ö→o, ş→s, ç→c, ğ→g, ı→i, İ→i
```

### Context-Aware Intent Detection (Follow-ups)
`detectIntentWithContext()` handles follow-up messages like "ücret nedir?" after "taekwondo kursu varmı?". When current message has a modifier category (pricing/hours/contact) but no topic (services), it checks last 3 inbound messages within 10 minutes for topic context and merges categories.

### Intent Detection Categories
`services`, `pricing`, `hours`, `policies`, `contact`, `faq` — matched via Turkish keyword map in `KEYWORD_CATEGORY_MAP` (ASCII-only keywords, normalization handles diacritics). Default: `['general', 'faq']`.

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/InstagramContextService.ts` | Core intelligence: intent detection (with `normalizeTurkish`), model routing, conversation history, context-aware follow-ups |
| `backend/src/services/ResponsePolicyService.ts` | Policy Agent: post-processing validation (11 rules including system term prevention) + direct OpenRouter correction |
| `backend/src/services/DirectResponseService.ts` | Direct OpenRouter calls bypassing OpenClaw (~1-3s vs ~10-40s) |
| `backend/src/services/PipelineConfigService.ts` | Dynamic pipeline config stored in `mc_policies` (direct response tiers, models, prompt template) |
| `backend/src/services/PriceFormatterService.ts` | Mobile-optimized price formatting from KB data (emojis, grouping, category-specific templates) |
| `backend/src/routes/instagramWebhookRoutes.ts` | Webhook handler + direct/OpenClaw routing + policy validation + MC integration + execution ID generation |
| `backend/src/routes/instagramIntegrationRoutes.ts` | /send (graph.instagram.com auto-detect) and /interaction endpoints |
| `backend/src/routes/workflowTestRoutes.ts` | DM Simulator — runs exact same pipeline as real webhook (no Meta/OpenClaw needed) |
| `backend/src/routes/dmKontrolRoutes.ts` | DM Kontrol API routes including execution detail endpoint |
| `openclaw-config/openclaw.json` | Gateway + hooks + multi-model routing config |
| `openclaw-config/workspace/AGENTS.md` | OpenClaw agent instructions (includes cross-channel guard for Telegram) |

### DM Pipeline Config (Dynamic)
All DM pipeline behavior is stored as a JSON policy row in `mc_policies` (id: `dm_pipeline_config`). Editable at runtime via API — no restart needed.

| API | Method | Purpose |
|-----|--------|---------|
| `/api/mc/dm-kontrol/pipeline-config` | GET | Current config |
| `/api/mc/dm-kontrol/pipeline-config` | PATCH | Partial update (deep merge) |
| `/api/mc/dm-kontrol/pipeline-config/reset` | POST | Reset to `DEFAULT_CONFIG` |

Key config fields:
- `directResponse.tiers.{light,standard,advanced}.enabled` — toggle direct response per tier
- `directResponse.tiers.*.modelId` — model for each tier
- `directPrompt.systemTemplate` — system prompt with `{{knowledge}}` placeholder
- `policy.maxRetries` — correction attempts before fallback
- `fallbackMessage` — safe response when all retries fail

### DM Simulator (Testing Without Instagram)
`POST /api/workflow-test/simulate-agent` runs the EXACT same pipeline as the real Instagram webhook — intent detection → KB fetch → formatKnowledgeForPrompt → DirectResponseService → policy validation → faithfulness check. Skips: Meta webhook, OpenClaw gateway, Meta Graph API send.

**Auth:** Session auth (admin panel) OR Bearer token (`N8N_API_KEY`)
**Results appear in:** DM Kontrol Merkezi live feed (same DB table + SSE events as real DMs)
**UI:** Sidebar → Operasyonlar → DM Simülatör (`/admin/workflow-test`)

```powershell
# Test via API (use N8N_API_KEY from backend/.env)
$headers = @{"Authorization"="Bearer <N8N_API_KEY>"; "Content-Type"="application/json"}
$body = '{"message":"masaj fiyatlari ne kadar","senderId":"sim_test_001"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/workflow-test/simulate-agent" -Method POST -Body $body -Headers $headers
```

Response includes: `analysis` (intent, tier, keywords), `policy` (validation result), `directResponse` (latency, tokens), `responseTime`.

**CRITICAL — Timestamp format:** Simulator uses `new Date().toISOString()` for `created_at` (matching real webhook). Do NOT use SQLite `datetime('now')` — it produces space-separated format (`2026-02-26 21:39:33`) which sorts incorrectly against ISO format (`2026-02-26T21:39:33.000Z`) in `ORDER BY created_at DESC`.

**When to use the simulator:**
- After any change to the DM pipeline (InstagramContextService, PipelineConfigService, ResponsePolicyService, DirectResponseService, system prompt, KB entries)
- To verify anti-hallucination behavior (address, prices, hours should come from KB)
- To test policy validation and faithfulness checking
- To verify intent detection and model tier routing
- Results are visible in DM Kontrol → Canlı Akış tab with full pipeline trace

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workflow-test/simulate-agent` | POST | Full pipeline simulation (message, senderId) |
| `/api/workflow-test/conversation/:senderId` | GET | Get conversation history for a sender |
| `/api/workflow-test/conversation/:senderId` | DELETE | Clear conversation history |
| `/api/workflow-test/knowledge` | GET | Debug: all KB entries |

### Execution ID Tracking (Debugging Bad Responses)
Every DM pipeline execution generates a unique execution ID (format: `EXE-xxxxxxxx`) stored in both `instagram_interactions` and `whatsapp_interactions` tables. This enables precise debugging of bad responses.

**How to use:**
1. Admin marks a bad response in DM Kontrol feed
2. Copy the execution ID from the message detail
3. Call `GET /api/mc/dm-kontrol/execution/:executionId` to get full execution trace

**Response includes:**
- Inbound customer message (text, sender, timestamp)
- Outbound AI response (text, model used, tier, tokens)
- Full pipeline trace (intent detection, KB fetch, policy validation, faithfulness check)
- Any errors that occurred during processing
- Response time and all metadata

**Database schema:**
```sql
-- Added to both instagram_interactions and whatsapp_interactions
ALTER TABLE instagram_interactions ADD COLUMN execution_id TEXT;
CREATE INDEX idx_instagram_execution_id ON instagram_interactions(execution_id);
```

**When to use:**
- After any bad response to understand what went wrong
- To verify policy validation is working correctly
- To check which KB categories were fetched
- To see exact model and tier used
- To audit response quality over time

### Direct Response Path (Bypass OpenClaw)
`DirectResponseService` calls OpenRouter directly for eligible tiers. Saves ~8-30s by skipping OpenClaw session creation + JSONL polling. Controlled by `PipelineConfigService.shouldUseDirectResponse(tier)`.

Current tier config:
| Tier | Direct | Model | Skip Policy | Typical Latency |
|------|--------|-------|-------------|-----------------|
| light | ✅ enabled | gpt-4.1-mini | ✅ yes | ~1-3s |
| standard | ✅ enabled | gpt-4o-mini | ❌ no | ~3-8s |
| advanced | ❌ disabled | gpt-4o-mini | ❌ no | falls through to OpenClaw |

### Mobile-Optimized Price Formatting (PriceFormatterService)
`PriceFormatterService` transforms raw KB pricing data (pipe-separated format) into beautiful mobile-friendly displays for Instagram/WhatsApp DMs. No hardcoded prices — all data from KB.

**Key features:**
- Category-specific templates (massage, membership, courses, PT, etc.)
- Mobile-optimized layout with emojis and spacing
- Duration-based grouping for massage prices (30dk, 40dk, 60dk, 90dk)
- Footer notes preserved from KB data
- Preserves all KB data integrity

**Example transformation:**
```
KB: "30dk masaj: 800₺ | 30dk masaj + kese + köpük: 900₺ | 40dk masaj: 1.000₺"
↓
💆 Masaj Fiyatlarımız:

30dk:
  masaj → 800₺
  masaj + kese + köpük → 900₺

40dk:
  masaj → 1.000₺
```

**Usage in pipeline:**
```typescript
const formatter = new PriceFormatterService();
const formatted = formatter.formatPricing('spa_massage_pricing', rawKbValue);
// Returns: { text, category, itemCount }
```

**Supported categories:**
- `spa_massage` — duration-grouped massage pricing
- `other_massage` — MIX, Hot Stone, Medical programs
- `membership_individual` — ferdi üyelik periods
- `membership_family` — aile üyeliği periods
- `reformer_pilates` — pilates pricing
- `pt_pricing` — personal trainer pricing
- `courses_kids` — çocuk kursları
- `courses_women` — kadın kursları

### System Term Prevention (Policy Rule 11)
`ResponsePolicyService` includes Rule 11 (SİSTEM BİLGİSİ SIZINTISI) to prevent AI from exposing internal system terms to customers. This was added after Kimi K2 started saying "bilgi bankası" and "veri tabanı" in customer responses.

**Blocked terms:**
- "bilgi bankası" / "bilgi bankasında"
- "veri tabanı" / "veri tabanında"
- "sistem" (in technical context)
- "prompt" / "komut"

**System prompt changes:**
- Changed from "BILGI_BANKASI" to "verilen bilgiler"
- Added explicit instruction: "teknik terimler KULLANMA — müşteri bunları görmemeli"
- Applies to both `PipelineConfigService` and `ResponsePolicyService` prompts

**When violation detected:**
- Policy agent rejects response
- Direct OpenRouter correction (~2-3s)
- Max 2 retries, then safe fallback
- Violation logged to mc_events

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
# From backend/ directory — builds entire backend to dist/
npx tsc -p tsconfig.build.json
# Then copy assets
Copy-Item -Path "src/database/schema.sql" -Destination "dist/database/schema.sql" -Force
```
Settings: `strict: false`, `noUnusedLocals: false`, `noImplicitAny: false`. Excludes `*.test.ts` and `VectorStoreService.ts`.
DO NOT modify `backend/tsconfig.json` — `tsconfig.build.json` is the production build config.

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
1. **Security wrapper** — OpenClaw wraps all hook messages in `<<<EXTERNAL_UNTRUSTED_CONTENT>>>` tags. Agent may attempt tool calls (web_fetch to localhost, which gets blocked). The enriched prompt instructs the agent not to use tools, and the polling has a fallback for tool-stuck agents.
2. **Instagram Graph API domain** — Instagram User Tokens (`IGAA*` prefix) only work on `graph.instagram.com`, NOT `graph.facebook.com`. The `/send` endpoint auto-detects token type and uses the correct domain. API version: v25.0.
3. **Session creation delay** — Session appears in sessions.json ~5-10s after hook POST returns 202. Polling must wait patiently (45s timeout).
4. **Hook routing** — All hooks route to `main` agent regardless of agent config. Sessions are always under `agents/main/sessions/`. The `instagram` agent in agents.list is for MC tracking only.
5. **Cloudflare tunnel required for Meta webhooks** — Meta cannot reach `localhost:3001`. The user must manually start `cloudflared` tunnel before testing the Instagram DM pipeline end-to-end. Without it, Meta webhook deliveries will fail silently. The agent CANNOT start this — the user must run it themselves in a terminal.
6. **Heartbeat pollution** — OpenClaw heartbeat (`target: "last"`) fires on the most recent main agent session. If that's a Jarvis session, heartbeat responses leak into Jarvis chat. Fix: `target: "none"` in openclaw.json + `isHeartbeatResponse()` filter in `jarvisRoutes.ts` JSONL poller.
7. **Telegram session cross-channel contamination** — The `agent:main:main` session (Telegram) accumulates Instagram hook messages and heartbeat responses in its JSONL file. This causes Jarvis/Telegram to adopt Instagram DM persona. Fix: delete the polluted JSONL file + remove `agent:main:main` from sessions.json. Prevention: cross-channel guard in `openclaw-config/workspace/AGENTS.md` instructs agent to ignore Instagram hook messages when on Telegram/MC UI.

### OpenClaw Hook Routing Pattern
```typescript
// ❌ WRONG — /hooks/agent creates ephemeral sessions NOT in sessions.json
const hookUrl = 'http://127.0.0.1:18789/hooks/agent';

// ✅ CORRECT — /hooks/instagram matches hook mapping, creates persistent sessions
const hookUrl = OPENCLAW_WEBHOOK_URL.replace(/\/hooks\/.*$/, '/hooks/instagram');
// Session key: agent:main:hook:instagram:{senderId}
```

### OpenClaw messageTemplate Pattern
```json
// ❌ WRONG — uses raw text field, ignores enriched message
"messageTemplate": "Instagram DM from {{senderId}}: {{text}}"

// ✅ CORRECT — passes enriched message (with knowledge context) through
"messageTemplate": "{{message}}"
```

### Polling Bug Pattern
```typescript
// ❌ WRONG — breaks out of poll loop if session not yet created
if (!sessionInfo?.sessionId) break;

// ✅ CORRECT — continue polling, OpenClaw creates session async after 202
if (!sessionInfo?.sessionId) {
  await new Promise(r => setTimeout(r, pollInterval));
  continue;
}
```

---

## WhatsApp AI — OpenClaw Flow (Active)

**Status:** ✅ Full pipeline working. OpenClaw Baileys channel (QR code login, no Cloud API). Agent calls backend APIs via HTTP tools.
**Agent:** `whatsapp` with workspace `~/.openclaw/workspace-whatsapp`
**Model:** Dynamic — light/standard/advanced tier routing via `WhatsAppContextService`
**Channel:** Baileys (`dmPolicy: "open"`, `groupPolicy: "disabled"`)

```
WhatsApp Message → OpenClaw Baileys Channel
  → Agent receives message (workspace-whatsapp/AGENTS.md)
  → Check ignore list: GET /api/integrations/whatsapp/ignore-check/:phone
  → If ignored → skip processing
  → Detect intent (coupon keywords, appointment intent, general query)
  → If coupon keyword → call coupon API endpoints
  → If appointment intent → multi-turn collection → POST /appointment-requests → Telegram notification
  → Fetch KB: GET /api/integrations/knowledge/context?categories=X,Y
  → Generate response (direct from agent, using KB context)
  → POST /api/integrations/whatsapp/validate-response (policy validation)
  → If violation → correction retry (max 2) → fallback message
  → Send reply (OpenClaw handles via Baileys)
  → POST /api/integrations/whatsapp/interaction (log outbound + MC integration)
```

### WhatsApp Agent Config (openclaw.json)
- Agent: `whatsapp` with workspace `~/.openclaw/workspace-whatsapp`, model `openrouter/openai/gpt-4o-mini`
- Channel: WhatsApp via Baileys (`dmPolicy: "open"`, `groupPolicy: "disabled"`, `sendReadReceipts: true`)
- Binding: `{ agentId: "whatsapp", match: { channel: "whatsapp" } }`
- Lifecycle hook: `whatsapp-lifecycle` → `http://localhost:3001/webhook/openclaw/whatsapp`

### WhatsApp Pipeline Config (Dynamic)
Stored in `mc_policies` as `wa_pipeline_config` (same pattern as Instagram's `dm_pipeline_config`). Editable at runtime via API.

| API | Method | Purpose |
|-----|--------|---------|
| `/api/mc/dm-kontrol/wa-pipeline-config` | GET | Current WhatsApp pipeline config |
| `/api/mc/dm-kontrol/wa-pipeline-config` | PATCH | Partial update (deep merge) |
| `/api/mc/dm-kontrol/wa-pipeline-config/reset` | POST | Reset to defaults |

### WhatsApp Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/WhatsAppContextService.ts` | Intent detection, model routing, ignore list, coupon/appointment detection |
| `backend/src/services/WhatsAppPipelineConfigService.ts` | Dynamic pipeline config in mc_policies |
| `backend/src/routes/whatsappIntegrationRoutes.ts` | All WhatsApp API routes (12 endpoints) |
| `backend/src/routes/whatsappLifecycleRoutes.ts` | OpenClaw lifecycle webhook |
| `openclaw-config/workspace-whatsapp/AGENTS.md` | WhatsApp agent instructions |
| `openclaw-config/workspace-whatsapp/TOOLS.md` | WhatsApp agent tool definitions |

---


## Jarvis Data Bridge — OpenClaw Integration

**Status:** ✅ Full pipeline working (dev). WebSocket auth + session creation + chat.send + JSONL polling all verified.
**Toggle:** `OPENCLAW_JARVIS_ENABLED=true` in `backend/.env`
**WhatsApp data:** `buildSystemContext()` injects WhatsApp stats + last 20 messages for `whatsapp|wa|mesaj` keywords, auto-detects Turkish phone numbers and fetches full conversation history

### Flow: DM Quality Review
```
Frontend "DM Kalite Analizi" button → POST /api/mc/jarvis/dm-review
  → DataBridgeService.fetchDMReviewData(daysBack) — packages all DM data from SQLite
  → OpenClawClientService.connect() (lazy singleton, WebSocket to gateway:18789)
  → sessions.patch (key: agent:main:jarvis:jarvis:{id})
  → chat.send (enriched task with ALL data pre-loaded in prompt)
  → pollJarvisResponse() — reads JSONL files from ~/.openclaw/agents/main/sessions/
  → Persist assistant message to DB → push SSE event → UI updates
```

### Flow: Regular Chat (Planning → Confirm → Execute)
```
User types message → POST /api/mc/jarvis/sessions/:id/messages
  → Persist user message → chat.send to OpenClaw
  → startResponsePolling() → pollJarvisResponse() (JSONL polling, 60s timeout)
  → If response contains task_summary JSON → status = awaiting_confirmation
    → task_summary includes: title, objective, targetFiles, constraints,
      deliverables, verificationSteps, suggestedModel, suggestedRole
  → User clicks Onayla → POST /sessions/:id/confirm
  → Create mc_agent + mc_job → sessions.patch (execution session)
  → buildTaskInstructions() builds enriched prompt:
    → Task details FIRST (most important for agent attention)
    → targetFiles from planning (tells agent exactly which files to edit)
    → verificationSteps (tells agent how to verify its work)
    → PROJECT_MAP.md content (route→file mapping, architecture)
    → Environment info (Windows, PowerShell, paths)
  → chat.send (task instructions) → startExecutionMonitoring() (JSONL polling, 5min timeout)
  → On completion → update mc_jobs/mc_runs → push SSE status=completed
```

### Jarvis Planning Intelligence
The planning prompt (`PLANNING_SYSTEM_PROMPT` in jarvisRoutes.ts) requires structured output:
- `targetFiles`: exact file paths the agent should modify (from route→file mapping hints)
- `verificationSteps`: how to verify the change worked
- `suggestedModel`/`suggestedRole`: for MC agent creation

`PROJECT_MAP.md` (`openclaw-config/workspace/PROJECT_MAP.md` → `~/.openclaw/workspace/PROJECT_MAP.md`) provides the agent with route→file mapping, API→file mapping, key services, components, hooks, and architecture patterns. This prevents the agent from editing wrong files.

### Response Polling Pattern (CRITICAL)
OpenClaw does NOT push `chat` events back over WebSocket for session responses. Agent responses go into JSONL files at `~/.openclaw/agents/main/sessions/{uuid}.jsonl`. The `pollJarvisResponse()` function reads these files directly — same proven pattern as `instagramWebhookRoutes.ts`.

```typescript
// ❌ WRONG — WebSocket chat events are NOT emitted for session responses
ocClient.on('chat', (event) => { /* never fires */ });

// ✅ CORRECT — Poll JSONL files directly
const response = await pollJarvisResponse(sessionKey, maxWaitMs);
// Reads sessions.json → maps key to UUID → reads {uuid}.jsonl → finds assistant text
```

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/OpenClawClientService.ts` | WebSocket singleton, challenge-response auth, RPC |
| `backend/src/services/DataBridgeService.ts` | Packages SQLite data into agent prompts |
| `backend/src/services/JarvisSSEManager.ts` | Server-Sent Events for real-time UI updates |
| `backend/src/routes/jarvisRoutes.ts` | Jarvis CRUD, dm-review, JSONL polling, execution monitoring |
| `openclaw-config/workspace/PROJECT_MAP.md` | Codebase intelligence for agents (route→file, API→file mappings) |
| `frontend/src/pages/admin/mc/MCJarvisPage.tsx` | Jarvis UI (chat, TaskSummaryCard, CompletionBanner) |
| `frontend/src/hooks/useJarvisSSE.ts` | SSE hook — auto-reconnect, React Query invalidation |
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
| `/sessions/:id/confirm` | POST | Confirm plan → create agent + job → dispatch |
| `/dm-review` | POST | One-click DM quality review (data bridge) |
| `/data-bridge/instagram` | GET | Preview packaged Instagram data |
| `/data-bridge/whatsapp` | GET | Preview packaged WhatsApp data |

---

## Closed-Loop DM Quality System (Escalation + Telegram)

**Status:** ✅ Built and wired into all pipeline components.

### Architecture
```
Real-time DM → ResponsePolicyService
  ├── corrected → log only (EscalationService: log_only)
  └── fallback (critical) → EscalationService → Telegram notification + Workshop job

Nightly Audit → NightlyAuditService (2:00 AM)
  ├── hallucinated → EscalationService → Analyst agent job + Telegram
  └── partially_grounded → EscalationService → Analyst agent job

AutoPilot scans → AutoPilotService
  ├── DM failures (3+/hr) → EscalationService → Telegram notification
  └── Cost spikes → EscalationService → Telegram notification

Telegram Admin Actions (3 methods, any works):
  1. callback_query buttons → TelegramCallbackPoller (when OpenClaw is NOT running)
  2. 🌐 Panel URL button → opens Workshop in admin panel (always works)
  3. /esc text commands → Jarvis processes via API (when OpenClaw IS running)
```

### Telegram Bot Coexistence (OpenClaw + Backend)
OpenClaw and the backend share the same Telegram bot token. Only one can use `getUpdates` at a time.

**`TelegramCallbackPoller`** handles this automatically:
- On startup, checks if OpenClaw gateway is running on port 18789
- If OpenClaw is up → defers polling, logs "OpenClaw detected — deferring"
- If OpenClaw is down → starts `getUpdates` polling for `callback_query` only
- Every 30s, reconciles: if OpenClaw came up → stops polling; if it went down → resumes
- **Start order matters:** Start OpenClaw FIRST, then backend, for cleanest startup

**When OpenClaw IS running** (callback buttons won't work):
- Every notification includes a "🌐 Panel" URL button → opens Workshop in admin panel
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
| `backend/src/services/EscalationService.ts` | Decision engine — routes issues to agent/Telegram/log |
| `backend/src/services/TelegramNotificationService.ts` | Telegram Bot API — sends alerts with inline + URL buttons |
| `backend/src/services/TelegramCallbackPoller.ts` | Polls callback_query when OpenClaw is down, auto-defers when up (30s reconciliation) |
| `backend/src/routes/telegramWebhookRoutes.ts` | Receives admin decisions from Telegram callback_query (webhook mode) |

### Env Vars
```
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_ADMIN_CHAT_ID=<from @userinfobot>
```

---

## Known Security Issues

1. **`.env` has real credentials committed to git** — needs `.gitignore` fix + token rotation
2. **AI prompt routes have no auth** — `/api/integrations/ai/prompt/:name` is public
3. **No webhook signature verification in backend** — backend forwards to n8n without verifying Meta signature
4. **Instagram test mode is runtime-only** — PATCH `/dm-kontrol/test-mode` updates `process.env` in-memory, lost on restart. `.env` file is the persistent source of truth.

---

## Pi Connection

```powershell
# SSH
ssh eform-kio@192.168.1.8

# SCP
scp <local> eform-kio@192.168.1.8:<remote>

# n8n commands (via SSH)
n8n list:workflow 2>/dev/null
n8n import:workflow --input=/path/to/file.json 2>/dev/null
n8n update:workflow --id=<ID> --active=true 2>/dev/null
sudo systemctl restart n8n
```

### Direct DB Editing (Pi)
```powershell
# Emergency / forensic use only
# Routine live KB edits must go through the admin or integration API preview flow
# Do NOT use seed-knowledge.ts, migrate-kb.mjs, or bulk reseeds to change one live KB row
```
---

## Documentation Policy

**DO NOT create:** Implementation reports, feature summaries, user guides, verification reports.
**DO:** Brief 2-3 sentence summary after feature. Update steering for new patterns only.

---

**Last Updated:** 2026-03-07
**Status:** ✅ Full system deployed to Pi 5 (192.168.1.8) with OpenClaw gateway + backend + cloudflared + kiosk display. Node 22, PM2 managed, Instagram DM Intelligence (context service, model routing, Turkish char normalization, context-aware follow-ups, MC integration), Direct Response Pipeline (light+standard tiers bypass OpenClaw, ~5-7s total, standard tier on GPT-4o-mini for better Turkish quality), Pipeline Config Service (dynamic config in mc_policies, runtime-editable via API), Policy Agent (ResponsePolicyService — 11-rule validation including system term prevention + faithfulness scoring + direct OpenRouter correction, fallback creates Workshop jobs), Execution ID Tracking (unique EXE-* IDs for debugging bad responses, full pipeline trace via API), PriceFormatterService (mobile-optimized price formatting from KB data with category-specific templates), Meta Graph API connected via graph.instagram.com (IGAA token valid, v25.0), DM Kontrol Merkezi (live feed with execution IDs, pipeline health, errors, model routing, test mode toggle, policy badges per message), DM Simulator (`/api/workflow-test/simulate-agent` — full pipeline without Meta/OpenClaw, results in DM Kontrol feed), Mission Control UI (glassmorphism dark theme, 10 active MC pages — cleaned up from 17), Jarvis Data Bridge working (JSONL polling with heartbeat filter, DM quality review, planning chat, task execution, `buildSystemContext` injects last 20 DMs + pipeline health), AutoPilot autonomous agent engine (4 triggers, cron scanner, AgentDispatchService), Real-Time Activity Feed, Agent Lifecycle Orchestrator, Enhanced Dashboard with comparison metrics, live KB managed in `knowledge_base` with preview-first change protocol for agent edits, anti-hallucination architecture (formatted KB, faithfulness scoring, "SADECE BİLGİ BANKASINI KULLAN" framing, system term prevention), full backend build via tsconfig.build.json, heartbeat target set to "none". UI cleanup (2026-02-26): removed Approvals, Comms, Documents, Gateways, Skills, Tags, AI Prompts, Blocked/Suspicious Users from sidebar (backend routes preserved). Closed-Loop DM Quality System (2026-02-27): EscalationService + TelegramNotificationService + Telegram webhook — routes policy violations/audit findings/DM failures to analyst agent or Telegram admin with inline approve/reject buttons + 🌐 Panel URL fallback. TelegramCallbackPoller auto-reconciles with OpenClaw (30s check, defers when gateway is up, resumes when down). Jarvis subagent fix: AGENTS.md updated to enforce HTTP API access (no direct SQLite), buildSystemContext enriched with recent DMs + health stats. OpenClaw AGENTS.md: added `/esc` text commands for escalation handling via Telegram chat. WhatsApp OpenClaw Integration (2026-03-02): WhatsApp agent via Baileys channel (no Meta Cloud API), dedicated workspace at `openclaw-config/workspace-whatsapp/`, WhatsAppContextService (intent detection, model routing, coupon/appointment detection), WhatsAppPipelineConfigService (dynamic config in mc_policies as `wa_pipeline_config`), 12 WhatsApp API endpoints (ignore list CRUD, interaction logging, policy validation, appointment requests, stats, conversation history), lifecycle webhook at `/webhook/openclaw/whatsapp`, DM Kontrol unified feed across Instagram + WhatsApp with channel filter, buildSystemContext WhatsApp data injection + phone number auto-detection, nightly audit per-channel config.
