# Agent Runtime Memory

Use this as the short, current-state reference before changing code, debugging DM behavior, or editing OpenClaw integration.

## Read Order
1. Read this file first for the current operating state.
2. Read `openclaw-kio-integration-runbook.md` before changing OpenClaw behavior.
3. Read `CONTEXT7-OPENCLAW-GUIDE.md` when you need current OpenClaw docs from Context7.
4. Read `openclaw-websocket-client.md`, `openclaw-hooks-configuration.md`, and `openclaw-agent-workspaces.md` for protocol and workspace details.
5. Read `openclaw-config/workspace/PROJECT_MAP.md` for codebase navigation before multi-file work.

## Current Live Agent Set
- `main` = Jarvis commander
- `forge` = primary coding agent
- `instagram-dm` = Instagram channel agent
- `whatsapp-dm` = WhatsApp channel agent

Do not reintroduce `nexus`, `atlas`, or `ledger` unless there is a deliberate product decision.

## OpenClaw vs KIO Split
- OpenClaw owns transport, sessions, hooks, agent workspaces, and gateway protocol.
- KIO owns business logic, DM planning, policy, data access, logging, admin UI, and persistence.
- Keep changes on the KIO side unless the problem is truly transport or workspace behavior.

## DM Pipeline Facts That Must Stay True
- Instagram DM is hybrid: direct OpenRouter is the default path for light and standard tiers; OpenClaw is fallback/advanced only.
- Instagram webhook routing order is explicit in `instagramWebhookRoutes.ts`:
  1. pre-AI exits (echo/test-mode/dedup/safety block or retry)
  2. deterministic response paths (hard-fact, unknown-service guard, deterministic clarifier)
  3. direct response path when `PipelineConfigService.shouldUseDirectResponse(tier)` is true
  4. OpenClaw hook fallback only if no response exists yet (including direct failure)
- OpenClaw is skipped whenever trace marks `openclawDispatchStatus: "skipped"` with session markers like `deterministic`, `unknown-service-guard`, `deterministic-clarifier`, or `direct`.
- Instagram outbound send now auto-chunks long text replies in `instagramWebhookRoutes.ts` (safe chunk size ~950 chars) before calling Meta send API, to avoid IG `code=100/subcode=2534038` length failures.
- When a chunked Instagram send fails, pipeline trace now records chunk-level failure detail (`failedChunk`, `chunkCount`, HTTP `status`) in `metaSendError`.
- OpenClaw DM dispatch sends `model: analysis.modelId`; it does not default to Jarvis `main` model. The Instagram hook mapping targets `agentId: "instagram"` in `openclaw.json`.
- Runtime toggle source of truth is `GET /api/mc/dm-kontrol/pipeline-config` (not static docs). Current live snapshot on March 4, 2026: `directResponse.enabled=true`, `light=true`, `standard=true`, `advanced=false`.
- Every DM execution has an `execution_id` like `EXE-xxxxxxxx`. Use `GET /api/mc/dm-kontrol/execution/:executionId` before changing prompts or logic.
- DM execution fast-debug command (preferred over ad-hoc SQL): `curl -s "http://localhost:3001/api/mc/dm-kontrol/execution/EXE-xxxxxxxx" -H "Authorization: Bearer $N8N_API_KEY"`.
- `InstagramContextService` still builds a bounded recent-history window for context: at most the last 8 messages from the last 10 minutes, then `formatConversationHistory()` caps the formatted text to 2000 chars.
- `ConversationStateService` is now the primary compact memory for follow-up planning and repair; recent history is supplemental context, not the old raw 24-hour dump.
- `analysis.formattedHistory` is still injected into both `DirectResponseService` and the OpenClaw fallback prompt, so DM token spend still includes a bounded recent-history payload until that prompt shape is changed deliberately.
- DM cost calculation is provider-aware (via `ModelCostService`) instead of a single fixed token multiplier.
- `openai-codex/*` is treated as `openai-oauth` with `cost=0` when `OPENAI_API_KEY` is not set; if API key billing is enabled, provider becomes `openai-api`.
- In current DM runtime, unprefixed `openai/*` tier models are still treated as OpenRouter-routed unless explicitly changed.
- Optional OpenAI API pricing envs for better estimates: `OPENAI_API_DEFAULT_INPUT_PER_MILLION_USD`, `OPENAI_API_DEFAULT_OUTPUT_PER_MILLION_USD`, `OPENAI_API_CODEX53_INPUT_PER_MILLION_USD`, `OPENAI_API_CODEX53_OUTPUT_PER_MILLION_USD`.
- The fragment buffer is handled by `backend/src/services/DMInboundAggregationService.ts`.
- The fragment buffer is a rolling 5 second window.
- Each fragment-like inbound extends `flush_after`.
- Do not dispatch just because the merged text reached 3 words. That early-dispatch rule was removed.
- Dispatch immediately only when the newest inbound is not fragment-like, or when the rolling timer expires.
- Instagram quick replies/buttons are not the production default. Use compact plain-text menus for customer choices.
- Generic pricing clarifiers and topic-selection clarifiers should stay lightweight and deterministic when possible.
- For simple clarifiers, avoid expensive semantic enrichment and avoid policy repair loops unless the turn really needs them.

## Safety and Policy Notes
- `sexualIntentFilter.ts` is AI-first, with a narrow euphemism guard for phrases like `mutlu son`, `extra hizmet`, and `premium paket`.
- `sexualIntentFilter.ts` includes a clear-business guard for concrete pricing asks (including compact typo forms like `30daka ne kadar`) so they bypass boundary-probe hard blocks.
- The first sexual-intent gate now receives bounded conversation context from `instagram_interactions`: last 24 hours only, capped to at most 6 short lines and ~600 chars before model prompts.
- `ResponsePolicyService` now receives a compact conversation snippet for rule/faithfulness checks (max 4 lines, ~600 chars) so follow-up turns are judged with context without large token bloat.
- Rule-stage style/format failures are treated as soft signals; hard blocking should come from moderation, explicit hard-rule violations, or deterministic grounding mismatches.
- Do not turn the safety layer into a long brittle banned-word list.
- `DMSafetyPhraseService` adds an admin-reviewed DM safety loop ahead of the AI gate.
- Persistent safety config lives in `mc_policies.id='dm_safety_phrase_config'` with `hardBlockPhrases` and `reviewedSafePhrases`.
- Short ambiguous phrases that land in `retry_question` can create a `dm_safety_phrase_reviews` row and send a Telegram `Yes / No / Detail` review prompt.
- `Yes` adds the normalized phrase to the instant hard-block list. `No` adds it to the reviewed-safe list so the exact phrase stops re-alerting.
- Telegram callback actions for `dmphr:*` and `esc:*` are handled by the backend callback poller; they must not be treated as normal Jarvis chat.
- `ResponsePolicyService` price guards are not hardcoded. Allowed price values are extracted from the current formatted KB context for that execution.
- If policy flags a correct price, the real issue is usually missing or wrong KB context, not a stale hardcoded whitelist.

## Knowledge Base Rules
- `knowledge_base.id` must be non-null and durable.
- Startup backfills legacy null IDs, then normalizes topic slugs.
- KB updates must go through the admin or integration CRUD routes, not direct SQL edits.
- Policy grounding depends on the KB slice loaded into the current execution.

## Where To Look First
- DM planner and follow-up logic: `backend/src/services/InstagramContextService.ts`
- DM fragment buffering: `backend/src/services/DMInboundAggregationService.ts`
- Clarifier and semantic skip heuristics: `backend/src/services/DMPipelineHeuristics.ts`
- Semantic retrieval and rerank: `backend/src/services/DMKnowledgeRetrievalService.ts`, `backend/src/services/DMKnowledgeRerankerService.ts`
- Policy correction and grounding: `backend/src/services/ResponsePolicyService.ts`
- Instagram webhook orchestration: `backend/src/routes/instagramWebhookRoutes.ts`
- Jarvis orchestration: `backend/src/routes/jarvisRoutes.ts`
- OpenClaw client RPC: `backend/src/services/OpenClawClientService.ts`

## Deployment Facts
- Dev machine path: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`
- Pi path: `/home/eform-kio/kio-new/`
- Agent workspace docs should resolve at `~/.openclaw/workspace/docs/` (recommended symlink target: `/home/eform-kio/kio-new/docs/` on Pi).
- Pi backend process: `pm2 restart kio-backend`
- Pi OpenClaw process: `pm2 restart kio-openclaw`
- Production backend builds must use `npx tsc -p tsconfig.build.json`, then copy `src/database/*.sql` to `dist/database/`

## Workspace Hygiene
- Do not keep root-level scratch artifacts (`temp_*`, `tmp_*`, `check_*`, `verify_*`, ad-hoc CSV/LOG dumps) after debugging is done.
- Put one-off investigation assets under `investigation/` if they must be retained; otherwise delete them after deploy verification.
- Before final deploy, run a quick cleanup on local and Pi root:
  - Local: `git clean -fdn -- temp_* tmp_* check_* verify_*` (review), then `git clean -fd -- temp_* tmp_* check_* verify_*`
  - Pi: `cd /home/eform-kio/kio-new && rm -f temp_* tmp_* check_* verify_*`
- Keep operational scripts (`deployment/`, `scripts/`) and production docs (`docs/`) out of cleanup scope unless deliberately decommissioned.

## Agent Rules
- Jarvis orchestrates. It should delegate real code changes to Forge.
- Forge should stay pinned to `openai-codex/gpt-5.3-codex`.
- Non-main agents do not use direct SQLite access. Use the KIO HTTP API with `X-API-Key`.
- On the Pi, `main` now runs on `openai-codex/gpt-5.3-codex` via OpenAI Codex OAuth. Channel agents `instagram` and `whatsapp` continue on `openrouter/openai/gpt-4o-mini`.
- After changing `openclaw-config`, verify the live result from the admin panel in `Ajanlar > Protocol`.

## Working Style
- Inspect the latest failing execution trace before changing DM behavior.
- Prefer small, targeted fixes over prompt bloat.
- Preserve the current deterministic paths that reduced latency and hallucination risk.
