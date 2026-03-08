# Developer Memory

This is the Forge workspace mirror of the current operating notes. Read it before code, DM, or OpenClaw changes.

## Read First
1. Read this file for the current live state.
2. Read `docs/agent-runtime-memory.md` for the fuller reference.
3. If `docs/` is not mounted inside this workspace, use absolute repo paths:
   - Pi: `/home/eform-kio/kio-new/docs/agent-runtime-memory.md`
   - Windows: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot\docs\agent-runtime-memory.md`
4. Read `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md` before live KB edits.
5. Read the relevant target files before editing.

## Current Live State
- OpenClaw agent IDs: `main`, `forge`, `instagram`, `whatsapp`
- Mission Control mirrors the channel agents as `instagram-dm` and `whatsapp-dm`
- On Pi, `main` runs `openrouter/openai/gpt-4.1` and `forge` runs `openai-codex/gpt-5.3-codex`
- Jarvis keeps `openrouter/openai/gpt-4.1` as its primary commander model
- OpenClaw handles image inputs through the global `agents.defaults.imageModel`, which is set to `openrouter/openai/gpt-4o-mini` on the Pi
- `instagram` and `whatsapp` use `openrouter/openai/gpt-4o-mini`
- Default spawned subagents now fall back to `openrouter/openai/gpt-4.1`; DeepSeek is removed from the live fallback path
- Removed agents: `nexus`, `atlas`, `ledger`
- Forge is the primary coding agent and should stay on `openai-codex/gpt-5.3-codex`
- OpenClaw owns transport and workspaces; KIO owns business logic, policy, and persistence

## DM Runtime Rules
- Instagram DM is hybrid: direct OpenRouter first, OpenClaw fallback/advanced only
- Always inspect the `EXE-...` trace before changing DM logic
- Do not assume a local-only fragment buffer exists on every machine
- Verify inbound timing behavior in the tracked Instagram webhook route before changing it
- Use compact text menus instead of relying on Instagram buttons
- Keep generic pricing and topic clarifiers deterministic and cheap when possible
- The live webhook and simulator now share the same conduct ladder before normal DM generation
- Conduct states are `normal`, `guarded`, `final_warning`, and `silent`
- `DMResponseStyleService` now injects anti-repetition style instructions; avoid reintroducing hardcoded emoji habits
- Guarded/final-warning users should not get the friendly deterministic info template path
- Keep the old visible rejection copy for obvious euphemisms like `mutlu son`; conduct escalation must stay in the background
- Obvious violators should continue to receive shorter, colder business replies with no follow-up question or extra CTA until reset/lift

## Safety and KB Rules
- The safety layer is AI-first plus a narrow euphemism guard
- Shared Telegram-bot callback buttons are disabled for operator actions. Use `/dmphr block|allow|detail <reviewId>` and `/esc approve|reject|detail|analyst <jobId>` instead of Telegram action buttons
- Treat what-to-bring / visit-preparation questions (`sort`, `havlu`, `terlik`, `bornoz`, `yanimizda bir sey getiriyor muyuz`) as normal logistics; they must not trigger DM safety phrase review
- Jarvis/Forge must not claim a Telegram review or escalation action succeeded unless the backend API response confirms success
- Policy price checks derive allowed numbers from the current KB context
- `knowledge_base.id` must stay non-null and durable
- Live KB is the `knowledge_base` table behind `/admin/knowledge-base`
- The current schema does not expose `topic_slug`
- Human conduct overrides live in `/admin/mc/dm-conduct`
- `force_normal` lifts a test account, `reset` clears offense history, and `force_silent` is the manual mute path
- The conduct UI must support search by username/ID/phone, state explanations, and explicit success/error feedback after actions
- The conduct page is a conduct-managed user list, not the full DM audience; mark test/simulator rows clearly and keep list search/pagination server-side
- Live KB changes must follow `scan -> preview -> approval -> apply -> verify -> final report`
- `/api/integrations/knowledge/*` uses `Authorization: Bearer <KIO_API_KEY>` and now supports:
  - `GET /api/integrations/knowledge/entries`
  - `GET /api/integrations/knowledge/context`
  - `POST /api/integrations/knowledge/change-sets/preview`
  - `GET /api/integrations/knowledge/change-sets/:id`
  - `POST /api/integrations/knowledge/change-sets/:id/apply`
  - `POST /api/integrations/knowledge/change-sets/:id/rollback`
- KB preview defaults to value-only changes; `description` edits require explicit opt-in with `allowDescriptionChanges=true`
- KB apply now requires `approvedChangeSetId` and explicit `approvalText` containing the exact change-set id
- KB updates should use API routes, not direct SQL edits

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
