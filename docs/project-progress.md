# Project Progress

This is the canonical recent-change ledger for KIO. Use it to answer "what changed recently?", "what is still open?", and "where might docs drift from reality?"

## Current Baseline
- 2026-03-12: Production baseline remains the post-incident Pi recovery state. Automation guards stay off by default unless the owner explicitly enables them in the same request.
- 2026-03-12: OpenClaw runtime is centered on four live agents: `main`, `forge`, `instagram`, and `whatsapp`. Mission Control mirrors the channel agents as `instagram-dm` and `whatsapp-dm`.
- 2026-03-12: Instagram DM is a hybrid pipeline: deterministic exits and direct OpenRouter responses first, OpenClaw fallback only when needed.
- 2026-03-12: WhatsApp runs through the dedicated OpenClaw Baileys channel while KIO remains the data, policy, and admin surface.
- 2026-03-12: Repo-native agent memory is the default documentation system. No CLEO install, no `.cleo/` directory, and no external memory platform are part of the current baseline.

## Recent Milestones
- 2026-03-02: Instagram DM standard tier moved to GPT-4o-mini for better Turkish quality and lower hallucination risk.
- 2026-03-02: Execution-level DM tracing landed with `EXE-...` ids across Instagram and WhatsApp interactions for full pipeline debugging.
- 2026-03-02: Response policy hardening added system-term leakage prevention and mobile-oriented KB price formatting.
- 2026-03-04: Live DM runtime snapshot confirmed direct-response routing enabled for light and standard tiers, with advanced still on OpenClaw fallback.
- 2026-03-06: Recovery baseline documented after the OpenClaw cron incident; autonomous guards remain disabled by default.
- 2026-03-07: Live Knowledge Base update flow hardened around preview, explicit approval text, apply, verify, and rollback.
- 2026-03-12: Agent documentation was consolidated around `AGENTS.md`, `docs/agent-runtime-memory.md`, `docs/project-progress.md`, and `docs/agent-docs-contract.md`.
- 2026-03-12: Local Windows OpenClaw CLI was reviewed and upgraded from `2026.2.25` to `2026.3.8`; a repo upgrade-and-ops plan was added before touching the Pi runtime.
- 2026-03-12: Repo-stored OpenClaw example config was sanitized for `2026.3.8`-style auth and hook security without changing the live Pi machine-local runtime yet.
- 2026-03-12: Added `deployment/raspberry-pi/upgrade-openclaw.sh` to make Pi OpenClaw upgrades repeatable with snapshot, backup, preflight, PM2 restart, and postflight checks.
- 2026-03-12: Mission Control regained an `OpenClaw Ops` page at `/admin/mc/gateways`, surfacing CLI version, runtime status, security audit findings, and the gateway registry in one place.
- 2026-03-12: The Pi repo docs and tracked OpenClaw runtime files were synced into `~/.openclaw/`, and `kio-openclaw` was restarted without overwriting the machine-local `~/.openclaw/openclaw.json`.
- 2026-03-12: The `codex/turkish-dm-humanizer` branch was re-validated with targeted backend tests and a master PR note was prepared so the tested DM humanizer tranche can be merged without the newer OpenClaw ops/docs work.
- 2026-03-12: PR `#3` merged `codex/turkish-dm-humanizer` into `master` as commit `08c0f55`, and the merged tree was re-verified locally with the same targeted DM/backend tests plus a frontend production build.
- 2026-03-12: Pi production backend was reconciled to merged `master` by staging a clean `08c0f55` checkout, rebuilding it with the repo production build path, preserving `backend/.env` and `data/`, and restarting PM2 from `~/kio-new/backend` with `humanizer.enabled=true` still verified.
- 2026-03-12: Repo hygiene cleanup removed committed root-level scratch artifacts, old DM review mock screenshots, and stale temp query files; `backend/scripts/simulateRealDmTraffic.ts` now defaults to the real repo `data/kiosk.db` path instead of a tracked Pi snapshot file.
- 2026-03-12: Repo-side DM fast-lane fix centralized generic-info detection around shared semantic signals, so service-specific asks like `kickboks hakkinda bilgi verirmisin` no longer fall into the deterministic generic info template path.
- 2026-03-12: Repo-side DM membership grounding was hardened so membership-scope questions can rerank focused `membership_includes` evidence from already loaded categories, while deterministic policy validation now rejects separately priced services such as reformer pilates when they are presented as membership-included without explicit KB support.
- 2026-03-12: Repo-side DM pricing flow was hardened so broad massage/spa pricing asks such as `Masaj ucreti ne kadar` now stay on a shared deterministic path: the planner/simple-turn logic marks them as directly answerable, and the webhook/simulator can answer from the grounded massage pricing template instead of asking an unnecessary `hangi masaj` clarifier.
- 2026-03-12: Live Pi KB change-set `e552836f-d8ef-405c-9ef2-2a6512e73460` updated `services.membership_includes` so fitness/spor salonu memberships now explicitly include mat pilates, while reformer pilates is stated as a separate paid service.
- 2026-03-12: Live Pi KB change-set `3e984706-4fd1-4164-908a-78c86e3a3fd1` corrected the same canonical `services.membership_includes` row so fitness/spor salonu memberships now say `step aerobik ve pilates dersleri`, while reformer pilates remains a separate paid service.
- 2026-03-12: Commit `e29c23f` deployed the shared DM grounding tranche to the Pi on merged `master`, making the `kickboks` generic-info fix, the membership grounding/policy guard, and the broad massage-pricing deterministic answer path live in production.
- 2026-03-14: Instagram DM reply finalization gained a shared assistant-identity layer. The first assistant reply in an active chat window now introduces itself as the Eform Spor Merkezi AI digital assistant, and explicit bot/AI identity questions are answered with a canonical disclosure without relying only on prompt wording.

## Open Work
- Keep `README.md` aligned enough for human onboarding while treating it as an overview, not the live runtime contract.
- Keep feature-specific guides current when conduct rules, response cache behavior, KB workflow, or deployment runbooks change.
- Repeat the Pi OpenClaw runtime sync after future `openclaw-config/` or workspace-doc changes.
- Continue trimming workspace mirror docs if they grow beyond short pointers plus tiny runtime-specific reminders.
- Decide when the archived Pi pre-cutover trees can be deleted after enough soak time without rollback needs.
- Upgrade the Pi OpenClaw runtime to `2026.3.8` only after backup, doctor, security-audit, and channel verification steps are followed.
- Apply the same OpenClaw config hardening to the live Pi machine-local config only after backup and runtime verification.
- Harmonize the shorter membership wording still present in `pricing.membership_individual` with the canonical `services.membership_includes` row if you want membership answers to stay fully consistent across all retrieved slices.

## Known Drift
- `README.md` still contains older architecture/runtime wording and should not be treated as the source of truth for what is live today.
- Historical workspace memory files grew into alternate status documents; they now need to remain thin mirrors instead of parallel canon.
- The repo-stored OpenClaw example now targets `2026.3.8` semantics, but Pi runtime parity and the live machine-local secret migration still need explicit verification.

## Last Verified
- 2026-03-15: Broad massage/spa overview asks can now reuse the deterministic generic info template. The template was extended to include the live `hamam_sauna_access` KB fact so messages like `masaj ve sauna hakkinda bilgi alabilir miyim` can return pricing plus current spa-access info instead of generated summary text.
- 2026-03-15: The deterministic generic massage/spa info template was restyled into a more polished front-desk summary format, keeping the same live KB-backed facts while replacing pipe-heavy raw output with cleaner section wording.
- 2026-03-15: The same generic massage/spa template was further optimized for phone screens: multiline sections, one price per line, split contact lines, and a spa block that can mention `havuz` when current KB facility rows confirm pool availability.
- 2026-03-15: The phone-optimized generic massage/spa template now also supports a compact `kese kopuk +100 TL` note, a KB-driven pool-temperature line, a combined `hamam/sauna/buhar/kapali havuz` access line, and cleaner `Steel Towers` address formatting for mobile DM bubbles.
- 2026-03-15: Kiosk boot reliability was hardened so browser persistence no longer restores stale runtime mode/offline state on reload; the kiosk now boots from live `/api/kiosk/state` while still keeping reusable cache/theme data. The frontend theme chain was also corrected to accept live `showcase` theme values.
- 2026-03-15: Kiosk admin discoverability was improved: `/admin/kiosk-control` now links directly to the theme/timing tabs in `/admin/settings`, and the sidebar keeps the `SISTEM` group expanded so kiosk settings are easier to find.
- 2026-03-15: Showcase digital-menu performance was trimmed by rendering only the main active video in-column, replacing heavy blurred side videos with lightweight previews, and memoizing the showcase massage selection path.
- 2026-03-16: Kiosk boot hardening now treats broken upload media as data-quality issues instead of letting them cascade into SPA/static failures. Kiosk menu responses strip missing `/uploads/...` references, `/uploads` static serving fails fast instead of falling through into the frontend catch-all, and production frontend serving prefers `backend/public` to match the Pi deploy layout.
- 2026-03-16: Kiosk was simplified into a media-free runtime design. Customer-facing kiosk menu responses now strip all massage media fields, and kiosk themes render generated fallback visuals instead of depending on uploaded MP4/photo assets. This removes media files from the kiosk boot critical path.
- 2026-03-16: Raspberry Pi kiosk startup was redesigned around Wayland/labwc. The desktop autostart entry is now only a lightweight bootstrap that imports session environment and starts a managed `kio-kiosk.service`, while the real `start-kiosk.sh` launcher waits for the Wayland socket plus backend readiness before opening Chromium.
- 2026-03-15: Coupon runtime policy wiring was tightened: token expiration now uses the live coupon policy, duplicate consume responses calculate `remainingToFree` from the current redemption threshold, and consume rate limiting now follows `max_coupons_per_day` instead of the old inflated test limits.
- 2026-03-15: Coupon consume idempotency was repaired at the service layer so replaying the same token for the same normalized phone returns the original success balance instead of `ALREADY_USED`, while cross-customer token reuse still fails.
- 2026-03-15: Broad multi-service overview asks such as `masaj ve sauna hakkinda bilgi alabilir miyim` now stay on a direct-answer overview path instead of `answer_then_clarify`; the planner strips incidental price/hour categories when the customer did not explicitly ask for them.
- 2026-03-15: Clarification fallback behavior tightened:
  - one clarification is still allowed for an unclear user turn
  - the second unresolved turn in the same clarification thread routes to phone/contact fallback
  - old clarification replies no longer leak into unrelated later topics when counting the fallback budget
- 2026-03-12: Documentation hierarchy reviewed and consolidated.
- 2026-03-12: Pi backend cutover re-verified:
  - `~/kio-new` is on `master` `e29c23f` with a clean git status
  - `pm2` runs `kio-backend` from `/home/eform-kio/kio-new/backend/dist/index.js`
  - `/api/kiosk/health` returns `status=ok`
  - `/api/mc/dm-kontrol/pipeline-config` still reports `humanizer.enabled=true`
  - archived rollback trees live under `/home/eform-kio/kio-archives/`
- 2026-03-12: Change ownership examples verified:
  - DM pipeline behavior change -> `docs/agent-runtime-memory.md`
  - Deployment/runtime change on Pi -> `docs/agent-runtime-memory.md`
  - Mission Control feature addition -> `docs/project-progress.md` plus any feature-specific guide
  - OpenClaw workspace instruction change -> `AGENTS.md` or workspace `AGENTS.md`, with `docs/project-progress.md` updated if the change is milestone-worthy
- 2026-03-12: Local DM regression verification passed on Windows Node 18:
  - targeted backend suite passed for `DMPipelineHeuristics`, `DMResponseCacheService`, `DMKnowledgeRetrievalService`, `ResponsePolicyService`, and `DMRealTrafficRegression`
  - `npx tsc -p tsconfig.build.json` passed in `backend/`
  - frontend production build passed
- 2026-03-12: Local broad-massage-pricing verification passed on Windows Node 18:
  - targeted backend suite passed for `GenericInfoTemplateService`, `DMPipelineHeuristics`, `InstagramContextService`, and `DMRealTrafficRegression`
  - `Masaj ucreti ne kadar` now stays on the simple-turn path locally with `generic_massage_pricing_signal`
  - planner overrides broad massage pricing clarifiers to `answer_directly` with grounded pricing instructions
  - `npx tsc -p tsconfig.build.json` passed in `backend/`
- 2026-03-12: Live Pi simulator verification:
  - `kickboks hakkinda bilgi verirmisin` returned a service-grounded kickboks answer instead of the deterministic generic-info template
  - `Masaj ucreti ne kadar` returned the grounded massage pricing summary directly, without asking `hangi masaj`
  - `1 aylik uyelik icerisinde tesisinizde yararlanabilecegim imkanlar nelerdir` returned a materially correct answer that included step aerobik ve pilates dersleri and kept reformer pilates separate
  - live KB row `bf7484c229047cb9075bfb339eefa19e` was re-verified through both the integration API and direct SQLite read from `/home/eform-kio/kio-new/data/kiosk.db` at version `3`
- 2026-03-12: Read order verified for repo and OpenClaw workspace entrypoints:
  1. `AGENTS.md`
  2. `docs/agent-runtime-memory.md`
  3. `docs/project-progress.md`
  4. Relevant feature guide only if needed
