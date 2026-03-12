# OpenClaw Ops and Upgrade Plan

This guide captures the current OpenClaw upgrade posture for KIO, the upstream features worth adopting, and the safest path to upgrade the Pi runtime without breaking the current recovery baseline.

## Current Baseline
- The repo-stored OpenClaw example config has now been sanitized and updated for `2026.3.8`-style auth and hook settings.
- Local Windows dev CLI was upgraded and verified on 2026-03-12: `OpenClaw 2026.3.8 (3caab92)`.
- Pi production runtime has not been upgraded by this repo task. Verify the actual Pi version before assuming parity with Windows.
- KIO should continue treating OpenClaw as the transport, session, hook, and workspace layer. KIO remains the source of truth for business logic, policy, persistence, admin UI, and reporting.

## Best Upstream Features To Reuse In KIO

### 1. Backups Before Runtime Changes
- Upstream now supports `openclaw backup create` and `openclaw backup verify`.
- KIO should use this before Pi runtime upgrades, service recovery work, or risky workspace changes.
- Best fit: add it to the Pi deploy/recovery checklist and any future "repair OpenClaw" runbook.

### 2. Health and Readiness Surfaces
- Upstream now exposes stronger health/status surfaces around the gateway.
- KIO can use these for a Mission Control "OpenClaw Ops" view instead of relying on process status alone.
- Best fit:
  - show version
  - show gateway health/readiness
  - show last doctor/security-audit result
  - show whether the gateway is local-only, LAN, or externally exposed

### 3. Security Audit and Secrets Workflow
- Upstream now has `openclaw security audit` and `openclaw secrets ...`.
- This is the highest-value operational upgrade for KIO because the live machine-local configs still need the same secret/session-key cleanup.
- Best fit:
  - move hook tokens, gateway tokens, and bot tokens out of live machine-local config
  - adopt SecretRef-style machine-local resolution on Pi
  - run security audit before major runtime changes

### 4. Bindings and Topic Routing
- Upstream added better agent binding tooling and topic-aware routing for chat surfaces.
- KIO can borrow this idea for Telegram admin operations and any future internal support inboxes.
- Best fit:
  - route approvals to one topic/agent
  - route incident alerts to another
  - keep customer-facing channel agents separate from operator workflows

### 5. Context-Engine Pattern
- Upstream's new context-engine plugin direction is good architectural inspiration even if KIO does not adopt the plugin API directly.
- KIO can centralize prompt/context assembly for Instagram, WhatsApp, and Jarvis behind a shared internal service.
- Best fit:
  - one context assembler
  - one policy for trimming/history windows
  - one place to inject system facts and runbook context

### 6. Structured Workflow Tools
- Upstream workflow-oriented tooling is useful inspiration for KIO operator actions.
- Best fit:
  - KB preview -> approval -> apply -> verify
  - prompt/policy edits with explicit confirmation
  - operator-reviewed repair jobs from Mission Control

## Low-Priority Or Skip For Now
- Extra channel plugins that do not serve the spa workflow directly.
- Unreleased `main`-branch features such as multimodal memory indexing or pre-tool-call hooks.
- Replacing KIO's business logic with OpenClaw-native workflows. KIO should stay the business and policy layer.

## What KIO Should Build Next

### OpenClaw Ops Surface In Mission Control
- A small OpenClaw Ops surface now exists at `/admin/mc/gateways`; keep it focused instead of turning it into a giant subsystem.
- Minimum useful widgets:
  - installed/runtime version
  - gateway health/readiness
  - last backup result
  - last doctor result
  - last security audit result
  - exposure/auth summary

### Runtime Hardening Backlog
- Keep secrets out of repo-stored OpenClaw config files and examples.
- Add a safer hook session-key policy.
- Turn off insecure Control UI auth outside local-only debugging.
- Decide whether memory search should be configured properly or explicitly disabled.

### Better Operator Routing
- Split customer traffic, Telegram admin traffic, and internal ops flows more deliberately.
- Keep Jarvis as the coordinator, but use cleaner bindings/topics for:
  - approvals
  - incidents
  - nightly audit findings
  - code and runtime repair tasks

## Current Audit Findings Relevant To KIO
- `hooks.allowRequestSessionKey=true` is enabled. This should either be disabled or constrained with explicit allowed prefixes.
- The initial Windows machine-local audit found `hooks.defaultSessionKey` unset. Upstream flags this as a warning.
- The initial Windows machine-local audit found `gateway.controlUi.allowInsecureAuth=true`. Keep only for local/debug use.
- The initial Windows machine-local audit found hook and gateway tokens stored inline in config.
- Memory search is enabled but no embedding provider is configured on the upgraded Windows CLI environment.
- The Windows install also reported legacy session state and orphan transcripts. Treat this as local-maintenance noise, not a signal to touch the Pi blindly.

Status after repo hardening work on 2026-03-12:
- repo-stored example config now uses environment-backed values instead of inline tokens
- repo-stored example config now sets `hooks.defaultSessionKey`
- repo-stored example config now constrains request session keys with `["hook:"]`
- repo-stored example config now disables memory search by default until an embedding provider is configured deliberately
- live Pi machine-local config still needs separate verification and migration

## Machine-Local Env Contract
If the live OpenClaw runtime uses the sanitized repo/example config shape, the process environment should provide:
- `OPENROUTER_API_KEY`
- `OPENCLAW_HOOKS_TOKEN`
- `OPENCLAW_GATEWAY_TOKEN`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`

## Pi Upgrade Checklist To 2026.3.8

Recommended command path from the repo:
- `cd ~/kio-new/deployment/raspberry-pi && bash ./upgrade-openclaw.sh --dry-run`
- `cd ~/kio-new/deployment/raspberry-pi && bash ./upgrade-openclaw.sh`

### 1. Capture Current State On Pi
- `openclaw --version`
- `pm2 status`
- `cat ~/.openclaw/openclaw.json | head`
- confirm the active app root is still `~/kio-new/`

### 2. Create Backup Before Any Change
- `openclaw backup create`
- if desired, also run `openclaw backup verify <archive-path>`
- do not skip this before touching the runtime or service wrapper

### 3. Run Preflight Diagnostics
- `openclaw doctor`
- `openclaw security audit`
- `openclaw gateway status`

### 4. Upgrade OpenClaw On Pi
- use the package-manager path, not the git-updater path:
  - `npm i -g openclaw@latest`
- verify:
  - `openclaw --version`

### 5. Restart The Real Pi Runtime Pattern
- KIO uses PM2 plus the bash wrapper `~/start-openclaw.sh`.
- Do not switch the Pi to `openclaw gateway install` service management as part of this upgrade.
- Restart only with the production pattern already documented for the Pi.

### 6. Re-Run Post-Upgrade Checks
- `openclaw doctor`
- `openclaw security audit`
- `openclaw gateway status`
- `openclaw gateway health`

### 7. Functional Verification
- verify Jarvis can connect
- verify Instagram hook still routes to `instagram`
- verify WhatsApp binding still routes to `whatsapp`
- verify Telegram admin path still works
- verify JSONL polling behavior still matches KIO expectations

### 8. Only Then Consider Hardening Changes
- do not combine runtime upgrade and config hardening in one blind step on Pi
- once `2026.3.8` is stable, apply:
  - machine-local secrets migration if still inline
  - hook session-key restrictions if the live config still lacks prefixes/defaults
  - Control UI auth tightening if debug-only flags are still present

## Recommended Order For KIO
1. Keep the repo config and docs aligned with the new OpenClaw feature review.
2. Upgrade and verify the Pi runtime safely with `deployment/raspberry-pi/upgrade-openclaw.sh`.
3. Expand the Mission Control OpenClaw Ops surface only if a new widget replaces a manual check.
4. Migrate secrets and tighten hook/gateway security settings.
5. Revisit memory search only if you want semantic ops recall.

## Useful Commands
```bash
openclaw --version
openclaw doctor
openclaw security audit
openclaw backup create --dry-run --json
openclaw gateway status
openclaw gateway health
openclaw hooks list
openclaw plugins list
```
