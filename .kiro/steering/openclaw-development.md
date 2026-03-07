---
inclusion: manual
---

# OpenClaw Development Guide

OpenClaw replaces n8n for Instagram DM AI processing. KIO backend handles webhook receipt, context enrichment, and response delivery. OpenClaw handles AI generation only.

---

## Architecture

```
Meta Webhook â†’ KIO /webhook/instagram (port 3001)
  â†’ InstagramContextService.analyzeMessage(senderId, text)
    â†’ getConversationHistory (last 10 from DB)
    â†’ detectIntent (Turkish keyword â†’ category mapping)
    â†’ classifyModelTier (light/standard/advanced)
  â†’ Fetch FILTERED knowledge (?categories=X,Y) + customer (parallel)
  â†’ Build enriched Turkish prompt (includes conversation history)
  â†’ POST to OpenClaw /hooks/instagram (202, hook mapping routes to main agent)
    â†’ messageTemplate: "{{message}}" passes enriched prompt through
    â†’ sessionKey: "hook:instagram:{{senderId}}"
  â†’ KIO polls ~/.openclaw/agents/main/sessions/ JSONL (45s timeout, 2s interval)
    â†’ Session key: agent:main:hook:instagram:{senderId}
    â†’ Looks for stopReason=stop, falls back to stable assistant text (5s stability)
  â†’ Agent text found â†’ POST /api/integrations/instagram/send
  â†’ Log via POST /api/integrations/instagram/interaction (model_used, tokens_estimated)
  â†’ MC Integration (fire-and-forget):
    â†’ UPSERT mc_conversations (channel=instagram)
    â†’ INSERT mc_cost_ledger (job_source=instagram)
    â†’ INSERT mc_events (entity_type=conversation, event_type=dm_response)
```

Toggle: `USE_OPENCLAW=true` in `backend/.env`

---

## Hook Routing (CRITICAL)

```typescript
// âŒ WRONG â€” /hooks/agent creates ephemeral sessions NOT in sessions.json
const hookUrl = 'http://127.0.0.1:18789/hooks/agent';

// âœ… CORRECT â€” /hooks/instagram matches hook mapping, creates persistent sessions
const hookUrl = OPENCLAW_WEBHOOK_URL.replace(/\/hooks\/.*$/, '/hooks/instagram');
// Session key: agent:main:hook:instagram:{senderId}
```

- Hook mapping in `openclaw.json`: `match.path: "instagram"`, `messageTemplate: "{{message}}"`
- All hooks route to `main` agent â€” sessions always under `agents/main/sessions/`
- `messageTemplate: "{{message}}"` passes the enriched prompt (with knowledge context) through
- OpenClaw wraps messages in `<<<EXTERNAL_UNTRUSTED_CONTENT>>>` security tags â€” enriched prompt tells agent not to use tools

---

## File Map

| File | Purpose |
|------|---------|
| `backend/src/services/InstagramContextService.ts` | Core intelligence: intent detection (with `normalizeTurkish`), model tier routing, conversation history, context-aware follow-ups |
| `backend/src/services/DirectResponseService.ts` | Direct OpenRouter calls bypassing OpenClaw (~1-3s vs ~10-40s) |
| `backend/src/services/PipelineConfigService.ts` | Dynamic pipeline config in `mc_policies` (tiers, models, prompt, policy settings) |
| `backend/src/services/ResponsePolicyService.ts` | Policy Agent: 8-rule validation + direct OpenRouter correction |
| `backend/src/routes/instagramWebhookRoutes.ts` | Webhook handler, enrichment, direct/OpenClaw routing, policy validation, MC integration (factory: `createInstagramWebhookRoutes(db)`) |
| `backend/src/routes/instagramIntegrationRoutes.ts` | `/send` (Meta Graph API) and `/interaction` (DB log, accepts `model_used`, `tokens_estimated`) |
| `backend/src/routes/workflowTestRoutes.ts` | DM Simulator â€” runs exact same pipeline as real webhook, results in DM Kontrol feed |
| `openclaw-config/openclaw.json` | Gateway config, hooks, model routing |
| `openclaw-config/workspace/AGENTS.md` | OpenClaw workspace agent instructions (includes cross-channel guard) |

Config files in `openclaw-config/` are the source of truth. They get copied to `~/.openclaw/` for runtime.

---

## DM Intelligence (InstagramContextService)

`InstagramContextService` is the core intelligence layer. It runs synchronously before OpenClaw dispatch.

### Turkish Character Normalization (CRITICAL)
`detectIntent()` and `classifyModelTier()` use `normalizeTurkish()` to convert Turkish diacritics to ASCII before keyword matching. `KEYWORD_CATEGORY_MAP` uses ASCII-only keywords (`ucret`, `fiyat`, `calisma`). Without normalization, messages with Turkish chars (`Ã¼cret`, `Ã§alÄ±ÅŸma`) won't match.

### Context-Aware Follow-ups
`detectIntentWithContext()` handles follow-up messages. When current message has a modifier (pricing/hours/contact) but no topic (services), it checks last 3 inbound messages within 10 minutes for topic context. Example: "taekwondo kursu varmÄ±?" â†’ "Ã¼cret nedir?" â†’ detects `pricing` + `services` (from history) â†’ fetches both categories â†’ AI gives taekwondo price.

### Model Tier Routing
| Tier | Model | Trigger |
|------|-------|---------|
| light | `openai/gpt-4.1-mini` | Greetings only (no keyword match), or single-category `hours`/`contact` |
| standard | `openai/gpt-4o-mini` | Multi-category queries (default) |
| advanced | `openai/gpt-4o-mini` | Complaint patterns (`sikayet`, `memnun degil`...) or long messages (200+ chars) |

The tier's `modelId` is passed to OpenClaw `/hooks/instagram` as the `model` param, overriding the default in `openclaw.json`.

### Intent Detection
Turkish keyword map (`KEYWORD_CATEGORY_MAP`) maps message text to categories: `services`, `pricing`, `hours`, `policies`, `contact`, `faq`. Default (no match): `['general', 'faq']`. Categories are passed as `?categories=X,Y` to the knowledge API for filtered context.

### Conversation History
Fetches last 10 interactions from `instagram_interactions` table for the sender. Formatted as Turkish relative-time entries (`[5 dk Ã¶nce] mÃ¼ÅŸteri: ...`). Truncated to 2000 chars, preserving the most recent 5 entries.

### MC Integration (fire-and-forget)
After a successful OpenClaw response, the webhook handler fires three DB operations (non-blocking):
1. `UPSERT mc_conversations` â€” channel=instagram, updates last_message_at
2. `INSERT mc_cost_ledger` â€” job_source=instagram, model + estimated tokens
3. `INSERT mc_events` â€” entity_type=conversation, event_type=dm_response

### Factory Pattern
`instagramWebhookRoutes.ts` uses the same factory pattern as MC routes:
```typescript
export function createInstagramWebhookRoutes(db: Database.Database) { ... }
// In index.ts:
app.use('/webhook', createInstagramWebhookRoutes(db));
```

---

## Env Vars (backend/.env)

```
USE_OPENCLAW=true
OPENCLAW_IG_WEBHOOK_URL=http://127.0.0.1:18789/hooks/instagram
OPENCLAW_HOOKS_TOKEN=<your_hooks_token>
OPENROUTER_API_KEY=sk-or-v1-...   # Used by workflowTestRoutes simulate-full
OPEN_ROUTER_API_KEY=sk-or-v1-...  # Legacy alias (same key)
```

## AI Model Routing

**Provider:** OpenRouter (openrouter.ai)
**Primary:** `openai/gpt-4.1` - stronger general reasoning for commander/default fallback work
**Fallbacks:** gpt-4o-mini -> gemini-2.5-flash-lite
**Heartbeat:** gemini-2.5-flash-lite (cheapest)
**Sub-agents:** gpt-4.1 by default; Forge should still be spawned with codex53 for code tasks

Config in `openclaw-config/openclaw.json` under `agents.defaults.model`. OpenClaw uses `openrouter/<author>/<slug>` format.

### OpenRouter Account Gotcha
If you get `requested_providers: ["openai"]` 404 errors, check https://openrouter.ai/settings/privacy:
- **Provider Restrictions â†’ Allowed Providers** must be EMPTY
- **Routing â†’ Default Model** should be cleared or non-OpenAI
- These account-level settings override all API requests

### Changing the Primary Model
1. `openclaw-config/openclaw.json` â†’ update `agents.defaults.model.primary`
2. Copy to `~/.openclaw/openclaw.json`
3. `backend/src/routes/workflowTestRoutes.ts` â†’ update model in simulate-full
4. `backend/dist/routes/workflowTestRoutes.js` â†’ same (or hand-compile)
5. `backend/src/routes/missionControlRoutes.ts` + dist â†’ default model in agents/runs POST
6. `frontend/src/pages/admin/mc/MCAgentsPage.tsx` â†’ form default + placeholder
7. Restart OpenClaw gateway + backend

---

## Dev Workflow

### Start services
```powershell
# 1. OpenClaw gateway (system Node, any terminal)
# --bind loopback is REQUIRED for the dashboard UI to work
openclaw gateway --bind loopback --port 18789

# 2. KIO backend (Node 18 via fnm, from backend/)
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","User") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","Machine")
fnm env --use-on-cd | Out-String -Stream | Where-Object { $_ -match '^\$env:' } | ForEach-Object { Invoke-Expression $_ }
fnm use 18
node dist/index.js
```

### Compile after TS changes
```powershell
# From backend/ â€” single-file compile (full tsc fails on test files)
npx tsc src/routes/instagramWebhookRoutes.ts --outDir dist/routes --rootDir src/routes --esModuleInterop --module nodenext --moduleResolution nodenext --target es2020 --skipLibCheck --declaration false
```
Then restart the backend process.

### Test end-to-end (Real Webhook â€” requires Cloudflare tunnel + Meta)
```powershell
$body = '{"object":"instagram","entry":[{"id":"17841400730256913","messaging":[{"sender":{"id":"test_001"},"message":{"mid":"m_test","text":"masaj fiyatlari nedir"}}]}]}'
Invoke-RestMethod -Uri "http://localhost:3001/webhook/instagram" -Method POST -Body $body -ContentType "application/json"
```

### Test via DM Simulator (Preferred â€” no external dependencies)
`POST /api/workflow-test/simulate-agent` runs the EXACT same pipeline as the real webhook: intent detection â†’ KB fetch â†’ formatKnowledgeForPrompt â†’ DirectResponseService â†’ policy validation â†’ faithfulness check. Skips Meta webhook, OpenClaw gateway, and Meta Graph API send.

```powershell
# Auth: session (admin panel) or Bearer token (KIO_API_KEY from backend/.env)
$headers = @{"Authorization"="Bearer <KIO_API_KEY>"; "Content-Type"="application/json"}

# Test address (anti-hallucination check â€” should return Ã‡ay Mahallesi, not fake address)
$body = '{"message":"adresiniz nedir","senderId":"sim_test_001"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/workflow-test/simulate-agent" -Method POST -Body $body -Headers $headers

# Test pricing (should return KB prices, not hallucinated ones)
$body = '{"message":"masaj fiyatlari ne kadar","senderId":"sim_test_002"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/workflow-test/simulate-agent" -Method POST -Body $body -Headers $headers

# Test greeting (light tier, policy skipped)
$body = '{"message":"merhaba","senderId":"sim_test_003"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/workflow-test/simulate-agent" -Method POST -Body $body -Headers $headers

# Test inappropriate message (should reject)
$body = '{"message":"mutlu sonlu masaj var mi","senderId":"sim_test_004"}'
Invoke-RestMethod -Uri "http://localhost:3001/api/workflow-test/simulate-agent" -Method POST -Body $body -Headers $headers
```

Results appear in DM Kontrol Merkezi â†’ CanlÄ± AkÄ±ÅŸ tab with full pipeline trace (intent, model tier, KB categories, policy validation, timing breakdown). Use the same `senderId` across messages to test multi-turn conversation context.

**CRITICAL â€” Timestamp format:** All DB inserts must use `new Date().toISOString()` (not SQLite `datetime('now')`). ISO format (`2026-02-26T21:39:33.000Z`) sorts correctly with real webhook timestamps. Space-separated format (`2026-02-26 21:39:33`) sorts below ISO in `ORDER BY created_at DESC`, making simulator messages invisible in the feed.

**When to use the simulator (instead of real Instagram):**
- After changes to: InstagramContextService, PipelineConfigService, ResponsePolicyService, DirectResponseService, system prompt, KB entries
- To verify anti-hallucination (address, prices, hours grounded in KB)
- To test policy validation and faithfulness scoring
- To verify intent detection and model tier routing
- To check DM Kontrol feed rendering and pipeline trace display

### Inspect sessions
```powershell
# List session keys
Get-Content "$env:USERPROFILE\.openclaw\agents\main\sessions\sessions.json" | ConvertFrom-Json

# Read a specific session JSONL
Get-Content "$env:USERPROFILE\.openclaw\agents\main\sessions\<sessionId>.jsonl"
```

---

## Polling Pattern

KIO polls OpenClaw session JSONL files for the agent's response. Critical rules:

1. Session key format: `agent:main:hook:instagram:<senderId>`
2. OpenClaw creates the session ASYNC after returning 202 â€” polling must `continue` (not `break`) when key is missing
3. Look for `entry.type === 'message' && entry.message.role === 'assistant' && entry.message.stopReason === 'stop'`
4. Response text is in `entry.message.content` (array of `{type:"text", text:"..."}` or plain string)
5. Timeout: 30s with 1.5s poll interval

---

## Known Issues

1. **SKILL.md path resolution** â€” OpenClaw agent reads skills from `npm/node_modules/openclaw/skills/` instead of `~/.openclaw/workspace/skills/`. Workaround: agent uses knowledge context from enriched message.
2. **Security wrapper blocks tool calls** â€” OpenClaw wraps webhook content in `<<<EXTERNAL_UNTRUSTED_CONTENT>>>`. Agent cannot call KIO APIs via exec. This is by design. KIO handles send/log after polling.
3. **Meta OAuth token** â€” `INSTAGRAM_ACCESS_TOKEN` in `.env` is expired. Needs refresh on Meta developer portal for `/send` to work.
4. **PowerShell curl mapping** â€” OpenClaw agent runs on Windows where `curl` maps to `Invoke-WebRequest`. Agent tool calls using curl fail silently.

## Resolved Issues (2026-02-15)

- âœ… OpenRouter 404 `requested_providers: ["openai"]` â€” Account-level "Allowed Providers" was set to OpenAI only. Fix: clear it at openrouter.ai/settings/privacy.
- âœ… Customer-facing routing later standardized on GPT-4.1-mini / GPT-4o-mini via OpenRouter â€” all config files updated.
- âœ… OpenClaw updated to 2026.2.13 â€” uses `openrouter/<author>/<slug>` model format.
- âœ… Full pipeline tested: webhook â†’ OpenClaw â†’ OpenRouter â†’ response in ~6s â†’ send (Meta token expired) â†’ log OK.

## Resolved Issues (2026-02-22)

- âœ… OpenClaw WebSocket auth â€” Fixed `handleChallenge()` in `OpenClawClientService.ts`:
  - `client.id` must be a valid `GATEWAY_CLIENT_IDS` value (e.g., `'gateway-client'`, `'cli'`, `'webchat'`)
  - `client.mode` must be a valid `GATEWAY_CLIENT_MODES` value (e.g., `'backend'`, `'ui'`, `'cli'`)
  - Must include `role: 'operator'` and `scopes: ['operator.admin']` to access session/chat methods
  - Token must be read at call time (not constructor time) because singleton is created before `dotenv.config()` runs
- âœ… RPC method names â€” OpenClaw uses `sessions.patch` (not `sessions.create`), `chat.send` (not `sessions.send`), `chat.history` (not `sessions.history`)
- âœ… Response frame format â€” OpenClaw uses `{ ok, payload, error }` not `{ result, error }`. Must check `frame.payload` in addition to `frame.result`
- âœ… Data Bridge pattern â€” `DataBridgeService` packages DB data into agent prompts, solving the "blind agent" problem (agents can't call KIO APIs)
- âœ… Full Jarvis DM review pipeline: backend â†’ WebSocket auth â†’ sessions.patch â†’ chat.send â†’ Jarvis receives task â†’ responds with task_summary

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
  â†’ User clicks Onayla â†’ POST /sessions/:id/confirm
  â†’ Create mc_agent + mc_job â†’ sessions.patch (execution session)
  â†’ chat.send (task instructions) â†’ startExecutionMonitoring() (JSONL polling, 5min timeout)
  â†’ On completion â†’ update mc_jobs/mc_runs â†’ push SSE status=completed
```

### Response Polling Pattern (CRITICAL)
OpenClaw does NOT push `chat` events back over WebSocket for session responses. Agent responses go into JSONL files at `~/.openclaw/agents/main/sessions/{uuid}.jsonl`. The `pollJarvisResponse()` function reads these files directly â€” same proven pattern as `instagramWebhookRoutes.ts`.

```typescript
// âŒ WRONG â€” WebSocket chat events are NOT emitted for session responses
ocClient.on('chat', (event) => { /* never fires */ });

// âœ… CORRECT â€” Poll JSONL files directly
const response = await pollJarvisResponse(sessionKey, maxWaitMs, skipLines);
// Reads sessions.json â†’ maps key to UUID â†’ reads {uuid}.jsonl â†’ finds assistant text
```

### Multi-Turn skipLines Pattern (CRITICAL)
In multi-turn conversations, JSONL files accumulate responses from all turns. Without `skipLines`, polling returns stale responses from previous turns.

```typescript
// âŒ WRONG â€” returns stale response from turn 1 when polling for turn 2
const response = await pollJarvisResponse(sessionKey, 60000);

// âœ… CORRECT â€” snapshot line count before chat.send, skip old lines
const skipLines = getSessionLineCount(sessionKey); // snapshot BEFORE chat.send
await ocClient.call('chat.send', { sessionKey, message, idempotencyKey });
const response = await pollJarvisResponse(sessionKey, 60000, skipLines);
```

### Key Files
| File | Purpose |
|------|---------|
| `backend/src/services/OpenClawClientService.ts` | WebSocket singleton, challenge-response auth, RPC |
| `backend/src/services/DataBridgeService.ts` | Packages SQLite data into agent prompts |
| `backend/src/services/JarvisSSEManager.ts` | Server-Sent Events for real-time UI updates |
| `backend/src/routes/jarvisRoutes.ts` | Jarvis CRUD, dm-review, JSONL polling, execution monitoring |
| `frontend/src/pages/admin/mc/MCJarvisPage.tsx` | Jarvis UI (chat, TaskSummaryCard, CompletionBanner) |
| `frontend/src/hooks/useJarvisSSE.ts` | SSE hook â€” auto-reconnect, React Query invalidation |
| `frontend/src/hooks/useJarvisApi.ts` | React Query hooks for all Jarvis endpoints |

### OpenClaw WebSocket Auth Pattern (CRITICAL)
```typescript
// âŒ WRONG â€” invalid client.id and client.mode
params: {
  client: { id: 'jarvis-orchestrator', mode: 'api' },
  auth: { token: this.config.gatewayToken }  // empty if singleton created before dotenv
}

// âœ… CORRECT â€” valid enum values + role/scopes + runtime token
params: {
  minProtocol: 3, maxProtocol: 3,
  client: { id: 'gateway-client', version: '1.0.0', platform: 'node', mode: 'backend' },
  role: 'operator',
  scopes: ['operator.admin'],
  auth: { token: process.env.OPENCLAW_GATEWAY_TOKEN || '' }  // read at call time!
}
```

### RPC Method Names
| Our Method | Actual OpenClaw Method | Params |
|-----------|----------------------|--------|
| createSession | `sessions.patch` | `{ key: "agent:main:jarvis:...", label: "..." }` |
| sendMessage | `chat.send` | `{ sessionKey, message, idempotencyKey }` |
| getHistory | `chat.history` | `{ sessionKey }` |
| listSessions | `sessions.list` | `{}` |
| abort | `chat.abort` | `{ sessionKey }` |

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

### Env Vars
```
OPENCLAW_JARVIS_ENABLED=true
OPENCLAW_GATEWAY_TOKEN=<your_gateway_token>  # from openclaw.json â†’ server.auth.token
```

## Resolved Issues (2026-02-26)

- âœ… Turkish character normalization â€” `normalizeTurkish()` added to `detectIntent()` and `classifyModelTier()`. Converts Ã¼â†’u, Ã¶â†’o, ÅŸâ†’s, Ã§â†’c, ÄŸâ†’g, Ä±â†’i. Without this, "Ã¼cret" didn't match `ucret` in `KEYWORD_CATEGORY_MAP`, causing fallback to `['general', 'faq']` and OpenClaw path (30-40s).
- âœ… Context-aware follow-ups â€” `detectIntentWithContext()` merges topic categories from last 3 inbound messages (10min window). "taekwondo kursu varmÄ±?" â†’ "Ã¼cret nedir?" now correctly detects `pricing` + `services` â†’ gives taekwondo price (2000â‚º/ay) instead of massage prices.
- âœ… Direct response for standard tier â€” `standard.enabled` was `false` in live DB config, causing all standard-tier messages to fall through to OpenClaw (30-40s). Enabled via PATCH API + updated `DEFAULT_CONFIG` in `PipelineConfigService.ts`. Standard tier now uses direct OpenRouter (~3-8s total).
- âœ… System prompt improvements â€” Added conversation context rule ("use previous messages for topic context"), "don't deflect when price is available" rule, and explicit massage price breakdown with kÃ¶pÃ¼k distinction.
- âœ… Telegram session contamination â€” `agent:main:main` JSONL (522KB) had 93 Instagram hook messages + 129 heartbeat references. Deleted JSONL + removed session entry. Added cross-channel guard to `openclaw-config/workspace/AGENTS.md`.

## Resolved Issues (2026-02-23)

- âœ… JSONL polling for Jarvis responses â€” WebSocket `chat` events are NOT emitted for session responses. Replaced all WebSocket event listeners with `pollJarvisResponse()` (reads JSONL files from `~/.openclaw/agents/main/sessions/{uuid}.jsonl`). Same proven pattern as Instagram webhook polling.
- âœ… Multi-turn `skipLines` fix â€” In multi-turn conversations, JSONL files accumulate all turns. Added `skipLines` parameter to `pollJarvisResponse()` and `getSessionLineCount()` helper. All three callers (messages, dm-review, confirm) snapshot line count before `chat.send`.
- âœ… Execution monitoring converted to JSONL polling â€” Replaced `startExecutionMonitoring()` WebSocket `chat` event listener with `pollJarvisResponse(sessionKey, 300000, skipLines)`. Removed `activeExecutionTimers` map (timeout handled by `maxWaitMs`).
- âœ… Full Jarvis E2E verified â€” Planning chat â†’ task_summary detection â†’ Onayla confirm â†’ agent/job creation â†’ execution dispatch â†’ JSONL polling â†’ completion â†’ CompletionBanner in UI.

## Resolved Issues (2026-02-12)

- âœ… Knowledge base populated â€” 42 entries across 7 categories (services, pricing, hours, policies, contact, general, faq). Key names match enrichment module.
- âœ… Hardcoded `general_info` intent â€” Now fetches ALL knowledge categories instead of filtering by single intent.
- âœ… New-customer greeting â€” Enriched prompt includes "Merhaba! Ben Eform Spor Merkezi dijital asistaniyim." rule for new customers.
- âœ… DB schema fix â€” Added `faq` to knowledge_base CHECK constraint (was missing from original table creation).

---

## Context7 â€” OpenClaw Docs Reference

When you need up-to-date OpenClaw documentation, use Context7 MCP:

```
Library ID: /openclaw/openclaw  (High reputation, 4730+ snippets)
```

### Useful Queries
- `hooks configuration, webhook agent endpoint, session management` â€” hooks API, /hooks/agent params
- `WebSocket JSON-RPC protocol, sessions.create, chat.send, challenge-response auth` â€” gateway wire protocol
- `multi-workspace configuration, workspace switching, IDENTITY.md` â€” multi-agent routing + workspace structure
- `openclaw.json all settings, model routing, OpenRouter integration` â€” full config reference
- `skills directory, SKILL.md, skill configuration` â€” skill loading and config

### Key Docs from Context7
- **Hooks `/hooks/agent`**: params = `message`, `name`, `agentId`, `sessionKey`, `wakeMode`, `deliver`, `model`, `timeoutSeconds`
- **WebSocket frames**: `{type:"req", id, method, params}` / `{type:"res", id, ok, payload|error}` / `{type:"event", event, payload}`
- **Connect must be first frame** with `auth.token`, `role`, `scopes`
- **Methods**: `chat.send`, `chat.history`, `chat.abort`, `chat.inject`, `sessions.list`, `sessions.patch`, `sessions.delete`
- **Multi-agent**: `agents.list[]` with per-agent `id`, `workspace`, `model`, `tools`. `bindings[]` maps channels to agents
- **OpenRouter model format**: `openrouter/<author>/<slug>`, API key in `env.OPENROUTER_API_KEY`
- **Workspace files**: `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md` live in agent workspace dir, not `~/.openclaw/`
- **Skills**: `skills.entries` in openclaw.json, `skills.load.extraDirs` for additional dirs

---

**Last Updated:** 2026-02-27

