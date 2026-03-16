# Agent Runtime Memory

This is the canonical current-state document for KIO. Use it before changing code, debugging DM behavior, editing OpenClaw integration, or reasoning about what is live right now.

## Document Role
- Canonical owner for live behavior, deployment state, architecture split, and critical operating runbooks.
- Recent shipped work and active drift belong in `docs/project-progress.md`.
- Stable repo rules and guardrails belong in `AGENTS.md`.
- Document ownership and duplication rules live in `docs/agent-docs-contract.md`.

## Read Order
1. Read repo `AGENTS.md` first for stable repo rules and guardrails.
2. Read this file for the current operating state.
3. Read `docs/project-progress.md` for the recent-change ledger and known drift.
4. Read the relevant feature guide only if the task touches that area.
5. Read `openclaw-config/workspace/PROJECT_MAP.md` for codebase navigation before multi-file work.
6. On Pi, treat `~/.openclaw/workspace/*.md` and `~/.openclaw/workspaces/forge/*.md` as the live agent instruction source.
7. Compare the docs with the real code/config before editing.

## Use This vs Other Docs
- Update this file for behavior/runtime/deployment changes.
- Update `docs/project-progress.md` for milestones, recent changes, open work, and drift notes.
- Update `AGENTS.md` only for stable instructions, not routine status churn.
- Keep workspace `MEMORY.md` and `DEVELOPER_MEMORY.md` files as short mirrors that point back here.

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
- DM response cache is `DMResponseCacheService.ts`: exact-match only, Instagram-side, and used only for safe simple turns.
- Cache activation is evidence-based, not immediate: a response stays `candidate` until repeated observations promote it to `active`.
- DM Kontrol backend exposes cache ops at `GET /api/mc/dm-kontrol/response-cache/stats`, `GET /api/mc/dm-kontrol/response-cache/entries`, `POST /api/mc/dm-kontrol/response-cache/seed`, and `POST /api/mc/dm-kontrol/response-cache/clear`.
- Full operational guide for agents lives in `docs/DM_RESPONSE_CACHE_AGENT_GUIDE.md`.
- A real cache hit appears in pipeline trace as `fastLane.kind = "response_cache"` plus a populated `trace.cache` block.
- Instagram DM replies now apply a shared assistant-identity disclosure layer in code. On the first assistant reply in a fresh active chat window, normal customer-facing reply paths should introduce the bot as `Eform Spor Merkezi yapay zeka dijital asistani`. Do not copy this into every template by hand, and do not force the intro into sexual/moderation rejection replies.
- If the customer explicitly asks whether they are talking to AI / a bot / a digital assistant, the reply should explicitly disclose that it is the Eform Spor Merkezi AI digital assistant. This is enforced in code after generation, not left to prompt luck.
- Instagram inbound fragment buffering is tracked in `DMInboundAggregationService.ts` and wired only in the live Instagram webhook path.
- The current buffer rule is limited to short fragments only: no punctuation, max 24 chars, max 3 tokens, with a 5 second rolling window before flush.
- Instagram quick replies/buttons are not the production default. Use compact plain-text menus for customer choices.
- Generic pricing clarifiers and topic-selection clarifiers should stay lightweight and deterministic when possible.
- For simple clarifiers, avoid expensive semantic enrichment and avoid policy repair loops unless the turn really needs them.
- Clarification budget is now per active unresolved thread, not a loose recent-history count. One clarification reply is acceptable; if the user is still unclear on the very next unresolved turn, route them to the contact phone instead of asking a second clarifier.
- Broad massage/spa pricing asks such as `Masaj ucreti ne kadar` should be treated as directly answerable when the live KB already has the full massage pricing row. Do not bounce these turns back with `hangi masaj` unless the customer asks for a specific massage type or duration.
- Broad service-overview asks such as `masaj ve sauna hakkinda bilgi alabilir miyim` should stay on a direct-answer overview path. Do not drag in price/hour clarification unless the customer explicitly asks for those dimensions.
- Broad massage/spa overview asks can now reuse the deterministic generic info template when the request is generic enough. That template should carry live massage pricing plus the current sauna/hamam access fact from KB, instead of forcing generated prose every time.
- That generic massage/spa template should read like a polished front-desk summary, not a raw dump: concise opener, mobile-friendly multiline sections, live price snapshot, spa-access fact, location, contact, and therapist info.
- The spa section can combine the direct access rule from `policies.hamam_sauna_access` with facility-level pool availability from `services.facility_overview` or `general.facility_description`, so it can mention `havuz` without hardcoding it into one static sentence.
- The same template can now surface a short `kese kopuk +100 TL` line from the live `faq.kese_kopuk_fiyat` / `services.massage_kese_kopuk` facts, and can add a pool-temperature line from `faq.havuz_sicaklik` when that KB fact exists.
- Address output in the mobile summary is intentionally normalized for readability: `Steel Tower Is Merkezi (Steel Towers)` should collapse to `Steel Towers` in the compact location line instead of echoing the raw admin text verbatim.
- Kiosk frontend boot should trust live server state, not stale browser persistence. Only reusable cache/theme data should survive reloads; transient fields like `mode`, `activeSurveyId`, `isOffline`, and QR-view flags must reset on boot and sync from `/api/kiosk/state`.
- Live kiosk state can now return `theme: "showcase"`. Frontend theme typing and theme-application logic must accept `showcase` as a first-class kiosk theme instead of remapping or dropping it.
- The kiosk theme and timing controls still live under `/admin/settings`, while `/admin/kiosk-control` is the mode switcher. Keep quick links between them so operators can find theme/timing controls without hunting through the sidebar.
- Showcase-mode performance should avoid multiple blurred autoplaying videos at once. Prefer one active video path plus lightweight non-main previews so the Pi kiosk stays smooth.
- Kiosk boot must tolerate missing uploaded media. Kiosk-facing menu responses should strip broken `/uploads/...` media URLs before the frontend sees them, and backend `/uploads` requests must fail fast with a real 404 instead of falling through into the SPA catch-all.
- Kiosk is now intentionally media-free on the customer-facing path. `/api/kiosk/menu` should strip `media_type` and `media_url` for all massages, and kiosk themes should render generated text-first visuals instead of depending on uploaded videos/photos.
- Production frontend serving on the Pi should prefer `backend/public` when present, because `deployment/raspberry-pi/update-pi.sh` copies the built frontend there. Do not hard-wire kiosk boot to depend only on `frontend/dist`.
- Service-specific `bilgi` asks such as `kickboks hakkinda bilgi verirmisin` should stay off the generic info template path when the service/topic is already explicit in the message.
- The live webhook and the simulator now share the same conduct ladder wiring: `DMSafetyPhraseService` plus `SuspiciousUserService` run before normal DM generation.
- DM conduct states are `normal`, `guarded`, `final_warning`, and `silent` (operator-facing label: `Bad customer`).
- Operator-facing UI, reports, and agent messages should say `Bad customer`; keep `silent` only for DB/API/internal references.
- Permanent blocks are a separate `UserBlockService` layer, not the same thing as `silent` / `Bad customer`.
- Active blocked users are checked before normal DM generation and can skip replies entirely with `blocked/temporary` or `blocked/permanent`.
- `DMResponseStyleService` now injects anti-repetition style guidance into direct-response prompts and OpenClaw fallback prompts. Emoji should be optional, not habitual.
- Deterministic clarifier templates stay normal-only, but the generic `bilgi almak istiyorum` info template is still allowed for any user who is not in internal `silent` / operator-facing `Bad customer` mode.
- For obvious sexual/euphemistic asks such as `mutlu son`, the visible customer-facing reply should stay the legacy rejection copy; the conduct ladder should escalate in the background.
- Legitimate couple / same-room massage requests such as `esimle gelecegim`, `beraber ayni odada`, `iki kisilik oda`, or `cift odaniz var mi` are normal business questions. They must stay `allow`, must not create conduct strikes, and should route to room-availability grounding.
- Users with prior obvious violations should keep receiving colder, shorter business replies with no follow-up question or extra CTA until they are reset or lifted.
- The highest conduct state is no longer true no-reply behavior for Instagram DM. `silent` now means bad-customer mode: reply with the shortest possible factual business answer and no conversational padding.

## Safety and Policy Notes
- `sexualIntentFilter.ts` is AI-first, with a narrow euphemism guard for phrases like `mutlu son`, `extra hizmet`, and `premium paket`.
- `sexualIntentFilter.ts` includes a clear-business guard for concrete pricing asks (including compact typo forms like `30daka ne kadar`) so they bypass boundary-probe hard blocks.
- Price/package comparison questions such as `aradaki fark nedir`, `1300 ile 1800 farki`, or `hangi paket neyi kapsiyor` are normal business questions. They must stay `allow` and must not create conduct strikes.
- Normal visit-preparation questions such as `sort getiriyor muyuz`, `yanimizda bir sey getiriyor muyuz`, `havlu/terlik/bornoz gerekli mi` must stay `allow` and must not trigger DM safety phrase review.
- Couple-room and same-room massage questions must stay on the business-safe path. Do not let spouse/partner wording push them into conduct escalation or DM safety review.
- `retry_question` from the safety layer is not a conduct violation by itself. Do not escalate `guarded/final_warning/Bad customer` solely from ambiguous-but-unconfirmed phrasing.
- The first sexual-intent gate now receives bounded conversation context from `instagram_interactions`: last 24 hours only, capped to at most 6 short lines and ~600 chars before model prompts.
- `ResponsePolicyService` now receives a compact conversation snippet for rule/faithfulness checks (max 4 lines, ~600 chars) so follow-up turns are judged with context without large token bloat.
- Age and minor signals (`yas`, `18`, `cocuk`, `ebeveyn`, `veli`) must keep `policies` in the fetched KB slice even inside follow-up pricing/service context.
- `ResponsePolicyService` now has a deterministic age-policy contradiction guard. Replies like `yasa bakmiyoruz` must fail when KB evidence says massage/spa is `18+` or otherwise age-restricted.
- Duration-led massage follow-ups (`uzun sureli masaj`, `kisa sureli`, `60 dk`, `90dk`, `seans`) must force `pricing` alongside `services`; otherwise policy repair can ground on unrelated package prices.
- Service-specific pricing validation now checks the service + duration + price tuple, not just the naked number. Do not let `Medikal 60dk -> 1300` pass just because `1300` exists elsewhere in KB.
- Membership-scope answers must not claim `reformer pilates` is included in fitness/spor salonu membership unless the KB explicitly says so. The current canonical KB wording is that membership includes `step aerobik ve pilates dersleri`, while reformer pilates remains a separate paid service.
- Room / couple-room questions must preserve FAQ grounding and answer directly from `faq.massage_room_options`; do not ask the customer the same room-availability question back.
- Direct address/location questions such as `adresiniz nerede`, `neredesiniz`, or `Iskenderun'un neresindesiniz` must force `answer_directly` from contact KB. Do not ask which area the customer is near unless they explicitly ask for transport detail.
- Gratitude-prefixed standalone hours questions such as `tesekkurler acilis kapanis saatleriniz` and pure `tesekkurler` / closure turns must break stale service-topic carryover instead of reviving the previous service context.
- Campaign fast-lane replies must trigger only on real campaign/group-discount inquiry shape. A bare word like `firsat` inside unrelated praise, staff feedback, or contact text must not route to the deterministic campaign template.
- Rule-stage style/format failures are treated as soft signals; hard blocking should come from moderation, explicit hard-rule violations, or deterministic grounding mismatches.
- Do not turn the safety layer into a long brittle banned-word list.
- `DMSafetyPhraseService` adds an admin-reviewed DM safety loop ahead of the AI gate.
- Persistent safety config lives in `mc_policies.id='dm_safety_phrase_config'` with `hardBlockPhrases` and `reviewedSafePhrases`.
- Short ambiguous phrases that land in `retry_question` can create a `dm_safety_phrase_reviews` row and send a Telegram review prompt with text commands, not callback buttons.
- On the shared Telegram bot, operator callbacks are not part of the reliable runbook. Use command/API flow instead: `/dmphr block|allow|detail <reviewId>` -> `POST /api/integrations/dm-safety/reviews/:reviewId/decision`.
- Escalation actions follow the same rule: use `/esc approve|reject|detail|analyst <jobId>` plus API confirmation. Panel URL buttons are fine; approval/review callback buttons are not trusted.
- `block` adds the normalized phrase to the instant hard-block list. `allow` adds it to the reviewed-safe list so the exact phrase stops re-alerting.
- Jarvis must not treat `dmphr:*`, `/esc`, button labels, or callback-like text as a completed action unless the backend API confirms success for that exact id.
- `ResponsePolicyService` price guards are not hardcoded. Allowed price values are extracted from the current formatted KB context for that execution.
- If policy flags a correct price, the real issue is usually missing or wrong KB context, not a stale hardcoded whitelist.
- Human overrides for conduct state live in `/admin/mc/dm-conduct`.
- `force_normal` is the correct way to lift a test account before or during DM testing; `reset` clears offense history; `force_silent` now means force bad-customer mode.
- Admin permanent block lives under `/api/admin/blocked-users/:platform/:platformUserId/permanent`.
- Do not try to clear conduct state with KB edits, direct SQL, or prompt hacks.
- Full operational guide for agents lives in `docs/DM_CONDUCT_AGENT_GUIDE.md`.
- The DM conduct page supports search by Instagram username/ID/phone, explicit success-error feedback after actions, visible explanations of all conduct states, and a dedicated detail panel for the selected user.
- The DM conduct page is not an all-users inbox; it lists only conduct-managed users, marks test/simulator-like rows, and keeps list search/pagination server-side so large tables do not load in one shot.
- DM Kontrol now surfaces `Davranis / Ton`, conduct state, customer-perceived wait vs processing time, and token breakdown from `pipelineTrace`. Keep `conductControl`, `responseStyle`, `timingBreakdown`, and `tokenBreakdown` populated when changing the pipeline.

## Knowledge Base Rules
- `knowledge_base.id` must be non-null and durable.
- The current KB schema is `id`, `category`, `key_name`, `value`, `description`, `is_active`, `version`, `created_at`, `updated_at`.
- The current KB schema does not expose `topic_slug`.
- Live KB data is the `knowledge_base` table shown in `/admin/knowledge-base`.
- Live KB work must follow `scan -> preview -> approval -> apply -> verify -> final report`.
- Integration KB routes expose `GET /api/integrations/knowledge/entries`, `GET /api/integrations/knowledge/context`, `POST /api/integrations/knowledge/change-sets/preview`, `GET /api/integrations/knowledge/change-sets/:id`, `POST /api/integrations/knowledge/change-sets/:id/apply`, and `POST /api/integrations/knowledge/change-sets/:id/rollback`.
- `/api/integrations/*` uses `Authorization: Bearer <KIO_API_KEY>`.
- KB preview defaults to value-only changes; `description` edits require explicit opt-in with `allowDescriptionChanges=true`.
- KB apply now requires `approvedChangeSetId` and explicit `approvalText` containing the exact change-set id.
- Legacy direct `PUT /api/integrations/knowledge/entries/:id` is disabled for API consumers.
- KB updates must go through the admin or integration routes, not direct SQL edits.
- Policy grounding depends on the KB slice loaded into the current execution.
- Price updates must scan `pricing` first, then review related `faq` / `services` rows only if those rows repeat the same fact. Do not widen scope silently.
- For massage price changes, start with `pricing.complete_massage_pricing`. The generic `bilgi almak istiyorum` reply uses that live row dynamically, so changing it updates the template automatically.
- If the owner sends an image with new prices, extract a structured list first, mark unreadable items, then build the KB preview from that list.
- Coupon token expiration and consume-side `remainingToFree` values should come from live coupon policy, not hardcoded `24h` or `4 kupon` assumptions.
- Coupon consume rate limits should honor `coupon_settings.max_coupons_per_day`; do not leave inflated test-only limits wired into production middleware.
- Coupon token consume must stay idempotent for the same normalized phone. Replayed consume requests for the original customer should return the existing success balance, while a reused token from a different phone must still return `ALREADY_USED`.

## Where To Look First
- DM planner and follow-up logic: `backend/src/services/InstagramContextService.ts`
- DM routing and orchestration: `backend/src/routes/instagramWebhookRoutes.ts`
- Clarifier and follow-up logic: `backend/src/services/InstagramContextService.ts`
- Semantic retrieval and rerank: `backend/src/services/DMKnowledgeRetrievalService.ts`, `backend/src/services/DMKnowledgeRerankerService.ts`
- Policy correction and grounding: `backend/src/services/ResponsePolicyService.ts`
- Instagram webhook orchestration: `backend/src/routes/instagramWebhookRoutes.ts`
- Conduct ladder + overrides: `backend/src/services/SuspiciousUserService.ts`
- DM style variation: `backend/src/services/DMResponseStyleService.ts`
- Conduct admin UI: `frontend/src/pages/admin/mc/MCDMConductPage.tsx`
- Jarvis orchestration: `backend/src/routes/jarvisRoutes.ts`
- OpenClaw client RPC: `backend/src/services/OpenClawClientService.ts`

## Deployment Facts
- Dev machine path: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`
- Pi path: `/home/eform-kio/kio-new/`
- Agent workspace docs should resolve at `~/.openclaw/workspace/docs/` (recommended symlink target: `/home/eform-kio/kio-new/docs/` on Pi).
- Pi backend process: `pm2 restart kio-backend`
- On March 12, 2026, Pi backend cutover completed: PM2 `kio-backend` now runs from `/home/eform-kio/kio-new/backend` on `master` commit `e29c23f`.
- The Pi `~/kio-new` checkout was reconciled from a clean staged `master` clone, and `git status --short` is now clean there.
- The previous live repo trees were archived instead of deleted:
  - `/home/eform-kio/kio-archives/kio-new-pre-master-cutover-20260312-092212`
  - `/home/eform-kio/kio-archives/kio-humanizer-test-merged-c31eb64-20260312-092247`
- Fresh Pi safety bundle for the cutover lives at `/home/eform-kio/kio-backups/pi-master-reconcile-20260312-090916` and includes repo tarballs, diffs, `.env` backups, `~/.openclaw/openclaw.json`, PM2 state, and a consistent SQLite backup.
- Post-cutover verification on March 12, 2026: `/api/kiosk/health` returned `status=ok`, and `/api/mc/dm-kontrol/pipeline-config` still reported `humanizer.enabled=true`.
- Before deploying the March 12 grounding/pricing fix tranche, a fresh Pi snapshot was captured at `/home/eform-kio/kio-backups/pre-feature/20260312-192012`, and the deploy also created SQLite backups under `/home/eform-kio/kio-new/data/backups/`.
- Current Pi deploy note: `deployment/raspberry-pi/update-pi.sh` may require `PUPPETEER_SKIP_DOWNLOAD=1` on the Pi so `npm ci` does not fail trying to download a Chrome build that KIO does not need at runtime.
- Pi OpenClaw process: `pm2 restart kio-openclaw`
- On March 12, 2026, the Pi repo-side OpenClaw docs/workspaces were synced from `openclaw-config/` into `~/.openclaw/` with `deployment/raspberry-pi/sync-openclaw-runtime.sh --restart`; machine-local `~/.openclaw/openclaw.json` was intentionally not overwritten.
- The Pi is still running OpenClaw `2026.3.2` after that sync. The repo example and local Windows CLI review already target `2026.3.8`, so version parity is still pending.
- On the current Pi OpenClaw `2026.3.2`, `openclaw gateway health` can take about 15 seconds even when RPC is healthy after restart. For quick post-restart checks, prefer `pm2 status` plus `openclaw gateway status --json`.
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
