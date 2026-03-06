# Stable Version Note (March 6, 2026)

This commit marks a stable baseline after the major DM regression caused by autonomous OpenClaw cron/auto actions.

## Incident Summary
- Date: March 6, 2026 (Europe/Istanbul)
- Impact: Instagram DM pipeline intermittently failed to produce outbound responses for valid price/membership queries.
- Primary causes:
  - Autonomous pipeline and code changes were applied without manual approval.
  - Backend treated OpenClaw hook success payloads returned with HTTP 200 as failures (it expected 202 only).
  - Standard direct-response tier was disabled in runtime pipeline config, forcing unstable OpenClaw fallback path for price intents.

## Stabilization Actions Applied
- Reverted Forge behavior change commit that altered deterministic/generic reply behavior.
- Restored DM pipeline runtime config to approved baseline, then re-enabled standard direct-response tier for price flows.
- Disabled autonomous automation paths until explicit approval:
  - AutoPilot: disabled
  - Nightly Audit: disabled
  - Morning Briefing: disabled
  - Hardware Watchdog: disabled
- Fixed OpenClaw dispatch acceptance logic to treat valid 2xx/ok/runId responses as accepted.

## Reference Commits (stabilization chain)
- e13c936 - Revert Forge DM behavior change
- 231e4e8 - Restore required safety setter exports for build/runtime compatibility
- cc8fb2c - Accept OpenClaw 200 hook dispatch responses (not only 202)

## Operational Rule Going Forward
No autonomous config/code changes should run in production without explicit human approval.

---
Maintainer note: treat this point as a recovery baseline before introducing new DM pipeline changes.
