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
- The live webhook and the simulator now share the same conduct ladder wiring before normal DM generation.
- Conduct states are `normal`, `guarded`, `final_warning`, and `silent`.
- `DMResponseStyleService` now adds anti-repetition tone guidance. Emoji should be optional, not routine.
- Guarded/final-warning users should not receive the friendly deterministic info template path.
- For obvious euphemisms like `mutlu son`, the visible reply should stay the legacy rejection wording; conduct escalation happens in the background.
- Users with obvious prior violations should get shorter, colder business replies with no follow-up question or extra CTA until reset/lift.

## Safety and KB Rules
- Safety is AI-first plus a narrow euphemism guard. Do not replace it with a giant phrase list.
- `DMSafetyPhraseService` adds an admin-reviewed DM safety loop before the normal AI safety decision.
- Shared Telegram-bot callback buttons are unreliable while OpenClaw is online. Use `/dmphr block|allow|detail <reviewId>` with `POST /api/integrations/dm-safety/reviews/:reviewId/decision` for DM safety review fallback.
- Questions about what to bring or wear for a visit (`sort`, `havlu`, `terlik`, `bornoz`, `yanimizda bir sey getiriyor muyuz`) are normal logistics, not safety-review candidates.
- Persistent safety config lives in `mc_policies.id='dm_safety_phrase_config'` with `hardBlockPhrases` and `reviewedSafePhrases`.
- Short ambiguous phrases that return `retry_question` can create `dm_safety_phrase_reviews` records and send Telegram `Yes / No / Detail` review prompts.
- `Yes` promotes the normalized phrase into the instant hard-block list. `No` marks the exact phrase safe so it stops re-alerting.
- Telegram callback actions for `dmphr:*` and `esc:*` must be handled as backend control actions, not as normal Jarvis chat.
- Policy price checks read allowed values from the current KB context, not hardcoded constants.
- `knowledge_base.id` must stay non-null and durable.
- Live KB is the `knowledge_base` table behind `/admin/knowledge-base`.
- The current schema does not expose `topic_slug`.
- Human conduct overrides now live in `/admin/mc/dm-conduct`.
- `force_normal` is the correct lift path for test accounts; `reset` clears offense history; `force_silent` manually mutes.
- The conduct page must remain operator-usable: search by username/ID/phone, explain states, and show success/error feedback after actions.
- The conduct page is a conduct-managed user list, not the full DM audience; mark test/simulator rows clearly and keep list search/pagination server-side.
- Live KB changes must follow `scan -> preview -> approval -> apply -> verify -> final report`.
- `/api/integrations/knowledge/*` uses `Authorization: Bearer <KIO_API_KEY>` and now supports:
  - `GET /api/integrations/knowledge/entries`
  - `GET /api/integrations/knowledge/context`
  - `POST /api/integrations/knowledge/change-sets/preview`
  - `GET /api/integrations/knowledge/change-sets/:id`
  - `POST /api/integrations/knowledge/change-sets/:id/apply`
  - `POST /api/integrations/knowledge/change-sets/:id/rollback`
- KB preview defaults to value-only changes; `description` edits require explicit opt-in with `allowDescriptionChanges=true`
- KB apply now requires `approvedChangeSetId` and explicit `approvalText` containing the exact change-set id
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
- `backend/src/services/SuspiciousUserService.ts`
- `backend/src/services/DMResponseStyleService.ts`
- `frontend/src/pages/admin/mc/MCDMConductPage.tsx`
- `backend/src/routes/jarvisRoutes.ts`
- `backend/src/services/OpenClawClientService.ts`
