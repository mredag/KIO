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

## Open Work
- Keep `README.md` aligned enough for human onboarding while treating it as an overview, not the live runtime contract.
- Keep feature-specific guides current when conduct rules, response cache behavior, KB workflow, or deployment runbooks change.
- Repeat the Pi OpenClaw runtime sync after future `openclaw-config/` or workspace-doc changes.
- Continue trimming workspace mirror docs if they grow beyond short pointers plus tiny runtime-specific reminders.
- Decide when the archived Pi pre-cutover trees can be deleted after enough soak time without rollback needs.
- Upgrade the Pi OpenClaw runtime to `2026.3.8` only after backup, doctor, security-audit, and channel verification steps are followed.
- Apply the same OpenClaw config hardening to the live Pi machine-local config only after backup and runtime verification.

## Known Drift
- `README.md` still contains older architecture/runtime wording and should not be treated as the source of truth for what is live today.
- Historical workspace memory files grew into alternate status documents; they now need to remain thin mirrors instead of parallel canon.
- Root-level scratch and investigation artifacts still exist in this repo and should be cleaned when the related work is closed out.
- The repo-stored OpenClaw example now targets `2026.3.8` semantics, but Pi runtime parity and the live machine-local secret migration still need explicit verification.

## Last Verified
- 2026-03-12: Documentation hierarchy reviewed and consolidated.
- 2026-03-12: Pi backend cutover re-verified:
  - `~/kio-new` is on `master` `08c0f55` with a clean git status
  - `pm2` runs `kio-backend` from `/home/eform-kio/kio-new/backend/dist/index.js`
  - `/api/kiosk/health` returns `status=ok`
  - `/api/mc/dm-kontrol/pipeline-config` still reports `humanizer.enabled=true`
  - archived rollback trees live under `/home/eform-kio/kio-archives/`
- 2026-03-12: Change ownership examples verified:
  - DM pipeline behavior change -> `docs/agent-runtime-memory.md`
  - Deployment/runtime change on Pi -> `docs/agent-runtime-memory.md`
  - Mission Control feature addition -> `docs/project-progress.md` plus any feature-specific guide
  - OpenClaw workspace instruction change -> `AGENTS.md` or workspace `AGENTS.md`, with `docs/project-progress.md` updated if the change is milestone-worthy
- 2026-03-12: Read order verified for repo and OpenClaw workspace entrypoints:
  1. `AGENTS.md`
  2. `docs/agent-runtime-memory.md`
  3. `docs/project-progress.md`
  4. Relevant feature guide only if needed
