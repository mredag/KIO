# Agent Runtime Memory

Use this as the short, current-state reference before changing code, debugging DM behavior, or editing OpenClaw integration.

## Read Order
1. Read this file first for the current operating state.
2. Read `openclaw-config/workspace/PROJECT_MAP.md` for codebase navigation before multi-file work.
3. Read `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md` before live KB edits.
4. On Pi, treat `~/.openclaw/workspace/*.md` and `~/.openclaw/workspaces/forge/*.md` as the live agent instruction source.
5. Compare the docs with the real code/config before editing.

## Current Live Agent Set
- `main` = Jarvis commander (`openrouter/openai/gpt-4.1` on Pi)
- `forge` = primary coding agent (`openai-codex/gpt-5.3-codex`)
- `instagram` = Instagram channel agent (`openrouter/openai/gpt-4o-mini`)
- `whatsapp` = WhatsApp channel agent (`openrouter/openai/gpt-4o-mini`)
- Mission Control mirrors the channel agents as `instagram-dm` and `whatsapp-dm`.

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
- DM execution fast-debug command (preferred over ad-hoc SQL): `curl -s "http://localhost:3001/api/mc/dm-kontrol/execution/EXE-xxxxxxxx" -H "Authorization: Bearer $KIO_API_KEY"`.
- `InstagramContextService` still builds a bounded recent-history window for context: at most the last 8 messages from the last 10 minutes, then `formatConversationHistory()` caps the formatted text to 2000 chars.
- `ConversationStateService` is now the primary compact memory for follow-up planning and repair; recent history is supplemental context, not the old raw 24-hour dump.
- `analysis.formattedHistory` is still injected into both `DirectResponseService` and the OpenClaw fallback prompt, so DM token spend still includes a bounded recent-history payload until that prompt shape is changed deliberately.
- DM cost calculation is provider-aware (via `ModelCostService`) instead of a single fixed token multiplier.
- `openai-codex/*` is treated as `openai-oauth` with `cost=0` when `OPENAI_API_KEY` is not set; if API key billing is enabled, provider becomes `openai-api`.
- In current DM runtime, unprefixed `openai/*` tier models are still treated as OpenRouter-routed unless explicitly changed.
- Optional OpenAI API pricing envs for better estimates: `OPENAI_API_DEFAULT_INPUT_PER_MILLION_USD`, `OPENAI_API_DEFAULT_OUTPUT_PER_MILLION_USD`, `OPENAI_API_CODEX53_INPUT_PER_MILLION_USD`, `OPENAI_API_CODEX53_OUTPUT_PER_MILLION_USD`.
- Do not assume a local-only DM fragment buffer exists on every machine. Verify the tracked `instagramWebhookRoutes.ts` implementation before changing inbound timing behavior.
- Do not assume any old "3 merged words" or fixed 5 second buffering rule exists unless it is present in the deployed tracked code.
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
- The current KB schema is `id`, `category`, `key_name`, `value`, `description`, `is_active`, `version`, `created_at`, `updated_at`.
- The current KB schema does not expose `topic_slug`.
- Live KB data is the `knowledge_base` table shown in `/admin/knowledge-base`.
- Live KB work must follow `scan -> preview -> approval -> apply -> verify -> final report`.
- Integration KB routes expose `GET /api/integrations/knowledge/entries`, `GET /api/integrations/knowledge/context`, `POST /api/integrations/knowledge/change-sets/preview`, `GET /api/integrations/knowledge/change-sets/:id`, `POST /api/integrations/knowledge/change-sets/:id/apply`, `POST /api/integrations/knowledge/change-sets/:id/rollback`, and legacy `PUT /api/integrations/knowledge/entries/:id`.
- `/api/integrations/*` uses `Authorization: Bearer <KIO_API_KEY>`; agents should use change sets for live KB edits instead of the legacy direct `PUT`.
- KB updates must go through the admin or integration routes, not direct SQL edits.
- Policy grounding depends on the KB slice loaded into the current execution.

## Where To Look First
- DM planner and follow-up logic: `backend/src/services/InstagramContextService.ts`
- DM routing and orchestration: `backend/src/routes/instagramWebhookRoutes.ts`
- Clarifier and follow-up logic: `backend/src/services/InstagramContextService.ts`
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
- Non-main agents do not use direct SQLite access. Use the KIO HTTP API.
- For `/api/integrations/*`, use `Authorization: Bearer <KIO_API_KEY>`.
- On the Pi, `main` now runs on `openrouter/openai/gpt-4.1`. `forge` stays on `openai-codex/gpt-5.3-codex`, and channel agents `instagram` / `whatsapp` continue on `openrouter/openai/gpt-4o-mini`.
- OpenClaw image handling on the Pi uses the global `agents.defaults.imageModel` route, currently `openrouter/openai/gpt-4o-mini`.
- The live OpenClaw fallback path no longer uses DeepSeek; default spawned subagents now fall back to `openrouter/openai/gpt-4.1`.
- After changing `openclaw-config`, verify the live result from the admin panel in `Ajanlar > Protocol`.

## Working Style
- Inspect the latest failing execution trace before changing DM behavior.
- Prefer small, targeted fixes over prompt bloat.
- Preserve the current deterministic paths that reduced latency and hallucination risk.
