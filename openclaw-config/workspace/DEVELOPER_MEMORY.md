# Developer Memory

This is the workspace mirror of the repo's current operating notes. Read it before code, DM, or OpenClaw changes.

## Read First
1. Read this file for the current live state.
2. Read `PROJECT_MAP.md` before multi-file code work.
3. Read `docs/agent-runtime-memory.md` for the fuller reference.
4. If `docs/` is not mounted inside the workspace, use absolute repo paths:
   - Pi: `/home/eform-kio/kio-new/docs/agent-runtime-memory.md`
   - Windows: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot\docs\agent-runtime-memory.md`
5. Read `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md` before live KB edits.

## Current Live State
- OpenClaw agent IDs: `main`, `forge`, `instagram`, `whatsapp`
- Mission Control mirrors the channel agents as `instagram-dm` and `whatsapp-dm`
- On Pi, `main` runs `openrouter/openai/gpt-4.1` and `forge` runs `openai-codex/gpt-5.3-codex`
- Jarvis keeps `openrouter/openai/gpt-4.1` as its primary commander model
- OpenClaw handles image inputs through the global `agents.defaults.imageModel`, which is set to `openrouter/openai/gpt-4o-mini` on the Pi
- `instagram` and `whatsapp` use `openrouter/openai/gpt-4o-mini`
- Default spawned subagents now fall back to `openrouter/openai/gpt-4.1`; DeepSeek is removed from the live fallback path
- Removed agents: `nexus`, `atlas`, `ledger`
- Forge is the main coding agent and should stay on `openai-codex/gpt-5.3-codex`
- OpenClaw handles transport and sessions; KIO handles logic, policy, and persistence

## DM Runtime Rules
- Instagram DM uses direct OpenRouter for light and standard tiers first.
- Routing order is fixed: pre-check exits (echo/test-mode/dedup/safety) -> deterministic handlers -> direct response -> OpenClaw fallback only when no response exists yet or direct call fails.
- OpenClaw fallback dispatch uses `analysis.modelId` and Instagram hook mapping targets `agentId: "instagram"` (not Jarvis `main`).
- Use `EXE-...` traces before changing DM logic.
- Do not assume a local-only fragment buffer exists on every machine. Verify the tracked Instagram webhook route before changing inbound timing behavior.
- Use compact text menus for customer choices. Do not assume Instagram buttons render reliably.
- Keep simple clarifiers deterministic and lightweight when possible.

## Safety and KB Rules
- Safety is AI-first plus a narrow euphemism guard. Do not replace it with a giant phrase list.
- `DMSafetyPhraseService` adds an admin-reviewed DM safety loop before the normal AI safety decision.
- Persistent safety config lives in `mc_policies.id='dm_safety_phrase_config'` with `hardBlockPhrases` and `reviewedSafePhrases`.
- Short ambiguous phrases that return `retry_question` can create `dm_safety_phrase_reviews` records and send Telegram `Yes / No / Detail` review prompts.
- `Yes` promotes the normalized phrase into the instant hard-block list. `No` marks the exact phrase safe so it stops re-alerting.
- Telegram callback actions for `dmphr:*` and `esc:*` must be handled as backend control actions, not as normal Jarvis chat.
- Policy price checks read allowed values from the current KB context, not hardcoded constants.
- `knowledge_base.id` must stay non-null and durable.
- Live KB is the `knowledge_base` table behind `/admin/knowledge-base`.
- The current schema does not expose `topic_slug`.
- Live KB changes must follow `scan -> preview -> approval -> apply -> verify -> final report`.
- `/api/integrations/knowledge/*` uses `Authorization: Bearer <KIO_API_KEY>` and now supports:
  - `GET /api/integrations/knowledge/entries`
  - `GET /api/integrations/knowledge/context`
  - `POST /api/integrations/knowledge/change-sets/preview`
  - `GET /api/integrations/knowledge/change-sets/:id`
  - `POST /api/integrations/knowledge/change-sets/:id/apply`
  - `POST /api/integrations/knowledge/change-sets/:id/rollback`
  - legacy `PUT /api/integrations/knowledge/entries/:id`
- KB changes should go through the API, not direct database edits.

## Current Cost / Runtime Notes
- The Pi OpenClaw `instagram` and `whatsapp` agents now use `openrouter/openai/gpt-4o-mini` instead of Kimi.
- DM cost estimation now uses provider-aware logic (`ModelCostService`) instead of a single flat token multiplier.
- `openai-codex/*` is counted as `openai-oauth` with zero cost when `OPENAI_API_KEY` is missing; with API key billing it is treated as `openai-api`.
- In current DM routing, unprefixed `openai/*` tier models are still treated as OpenRouter-routed unless explicitly changed.
- The backend Telegram callback poller defers callback polling while OpenClaw is online and resumes when the gateway goes down. During normal gateway uptime, use the Panel URL or `/esc` text commands instead of relying on inline buttons.
- Jarvis Telegram sessions should be rotated if context grows too large; avoid carrying stale long-lived session bloat.

## Main Files To Inspect
- `backend/src/routes/instagramWebhookRoutes.ts`
- `backend/src/services/InstagramContextService.ts`
- `backend/src/services/DMKnowledgeRetrievalService.ts`
- `backend/src/services/DMKnowledgeRerankerService.ts`
- `backend/src/services/ResponsePolicyService.ts`
- `backend/src/routes/jarvisRoutes.ts`
- `backend/src/services/OpenClawClientService.ts`
