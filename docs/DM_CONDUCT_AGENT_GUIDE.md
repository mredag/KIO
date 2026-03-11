# DM Conduct Agent Guide

## Purpose

This guide explains how agents should inspect and operate the DM conduct ladder safely.

The conduct system is the DM-side behavior control layer for suspicious or abusive users.
It is implemented primarily in [SuspiciousUserService.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/SuspiciousUserService.ts)
and enforced in the live/simulator DM pipeline before normal generation.

## Core Model

Internal conduct states:

- `normal`
- `guarded`
- `final_warning`
- `silent`

Operator-facing wording:

- Use `Bad customer` instead of `silent` in admin/operator-facing language.
- Keep `silent` only for DB/API/internal references.

Important behavior rule:

- `silent` no longer means true no-reply mode for Instagram DM.
- It means the shortest possible factual business answer, with no warmth, padding, CTA, or follow-up.

## What The Ladder Does

- `normal`: standard business reply behavior
- `guarded`: shorter, colder, less chatty business reply
- `final_warning`: final warning tone, no warmth or conversational extras
- `silent` / `Bad customer`: minimal factual business reply only

The live webhook and the simulator both apply the conduct ladder before normal DM generation.

## Hard Rules For Agents

Agents must not:

- change conduct state through KB edits
- change conduct state through prompt hacks
- use direct SQL for routine conduct operations
- treat `retry_question` from the safety layer as a conduct strike by itself

Agents should:

- use the admin UI or admin API only
- call the user `Bad customer` in operator-facing text
- use `force_normal` to temporarily lift a test account
- use `reset` when the goal is to clear offense history and return the user to normal
- use `force_silent` only when the owner explicitly wants forced bad-customer mode

## Where To Operate It

### Admin UI

Human/operator page:

- `/admin/mc/dm-conduct`

The page supports:

- search by Instagram username, Instagram ID, or phone
- filters for state, manual mode, and test-like records
- explicit action feedback after reset/override
- user event history
- recent chat history

### Admin API

All routes are under `/api/admin/dm-conduct` and require the normal admin/session surface.

List users:

- `GET /users`

Supported query params:

- `platform=instagram|whatsapp`
- `q=<search text>`
- `state=normal|guarded|final_warning|silent`
- `manualMode=auto|force_normal|force_silent|manual_only`
- `testLike=real_only|test_only`
- `limit=<n>`
- `offset=<n>`

User event history:

- `GET /users/:platform/:platformUserId/events?limit=20`

Recent message history:

- `GET /users/:platform/:platformUserId/history?limit=50`

Reset user:

- `POST /users/:platform/:platformUserId/reset`

Set manual override:

- `POST /users/:platform/:platformUserId/override`

Override body:

```json
{
  "mode": "force_normal",
  "durationHours": 24,
  "note": "manual test lift"
}
```

Allowed modes:

- `auto`
- `force_normal`
- `force_silent`

## Recommended Agent Workflow

Use this order unless the owner asked for a different flow:

1. Inspect the current user in `/admin/mc/dm-conduct` or `GET /users`
2. Read recent events with `GET /events`
3. Read recent chat history with `GET /history`
4. Decide whether the goal is:
   - observe only
   - temporary lift for testing
   - full reset
   - forced bad-customer mode
5. Apply one action only:
   - temporary lift: `override mode=force_normal`
   - full cleanup: `reset`
   - force bad-customer mode: `override mode=force_silent`
   - remove a manual override and return control to the ladder: `override mode=auto`
6. Re-read the user state and report what changed

## What To Say In Reports

Preferred wording:

- `User is in guarded state`
- `User is in final warning state`
- `User is in Bad customer mode`
- `Temporary force normal override applied for 24 hours`
- `Conduct history reset; user returned to normal`

Avoid phrasing like:

- `I changed SQL`
- `I edited the database directly`
- `I changed the prompt to clear the user`
- `The user is silent` in operator-facing text

## Pipeline Notes Agents Must Remember

- `retry_question` from the safety layer is not a conduct strike by itself
- obvious euphemistic sexual asks can escalate the ladder in the background while keeping the visible rejection copy stable
- legitimate couple-room / same-room massage questions are normal business questions and must not create conduct strikes
- pricing comparison and package-difference questions are normal business questions and must not create conduct strikes

## Where To Read The Code

- Conduct ladder state and overrides:
  [SuspiciousUserService.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/SuspiciousUserService.ts)
- Conduct admin routes:
  [adminRoutes.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/routes/adminRoutes.ts)
- Live Instagram pipeline wiring:
  [instagramWebhookRoutes.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/routes/instagramWebhookRoutes.ts)
- Simulator wiring:
  [workflowTestRoutes.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/routes/workflowTestRoutes.ts)
- Admin UI:
  [MCDMConductPage.tsx](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/frontend/src/pages/admin/mc/MCDMConductPage.tsx)

## Current Limitation

- There is no separate public "integration" API for conduct controls right now.
- Conduct actions are on the admin/session surface, not the integration API surface.
