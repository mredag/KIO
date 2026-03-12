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

## Separate Hard-Block System

The conduct ladder is not the same thing as the blocked-users system.

There is a separate hard-block layer implemented in
[UserBlockService.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/UserBlockService.ts).

Key distinction:

- `dm-conduct` changes reply behavior and tone
- `blocked-users` can skip replies entirely

Important behavior:

- active blocked users are checked before normal DM generation
- when a user is actively blocked, the webhook marks `shouldReply: false`
- the pipeline skips KB, AI, policy, and Meta send
- pipeline trace uses models like `blocked/temporary` or `blocked/permanent`

For Instagram, a permanent block is therefore stronger than `Bad customer` mode.

## Permanent Ban Logic

Permanent bans can happen in two ways:

1. Manual admin permanent block
2. Automatic heuristic permanent block

Automatic heuristic permanent block is evaluated in
[PermanentBanHeuristics.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/PermanentBanHeuristics.ts)
and applied from:

- [instagramWebhookRoutes.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/routes/instagramWebhookRoutes.ts)
- [workflowTestRoutes.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/routes/workflowTestRoutes.ts)

Current heuristic categories:

- `severe_abuse`
- `moderate_repeat_abuse`
- `vulgar_sexual_spam`

Important:

- a single innocent business question must not trigger permanent ban
- a single euphemistic sexual question by itself must not trigger permanent ban
- repeated vulgar sexual spam after prior warnings can trigger permanent ban
- severe slur / hate / high-confidence abusive wording can trigger permanent ban immediately

## Hard Rules For Agents

Agents must not:

- change conduct state through KB edits
- change conduct state through prompt hacks
- use direct SQL for routine conduct operations
- treat `retry_question` from the safety layer as a conduct strike by itself
- confuse `force_silent` with a permanent block

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

Related blocked-users page:

- `/admin/blocked-users`

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

### Blocked Users API

Permanent block controls are not on the `dm-conduct` route group.
They live under `/api/admin/blocked-users`.

List blocked users:

- `GET /api/admin/blocked-users`

Get blocked-user history:

- `GET /api/admin/blocked-users/:platform/:platformUserId/history`

Manually unblock:

- `DELETE /api/admin/blocked-users/:platform/:platformUserId`

Manually permanent-block:

- `POST /api/admin/blocked-users/:platform/:platformUserId/permanent`

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
   - hard block / permanent block
5. Apply one action only:
   - temporary lift: `override mode=force_normal`
   - full cleanup: `reset`
   - force bad-customer mode: `override mode=force_silent`
   - remove a manual override and return control to the ladder: `override mode=auto`
   - hard permanent block: `POST /api/admin/blocked-users/:platform/:platformUserId/permanent`
   - remove hard block: `DELETE /api/admin/blocked-users/:platform/:platformUserId`
6. Re-read the user state and report what changed

## What To Say In Reports

Preferred wording:

- `User is in guarded state`
- `User is in final warning state`
- `User is in Bad customer mode`
- `User is permanently blocked`
- `Temporary force normal override applied for 24 hours`
- `Conduct history reset; user returned to normal`

Avoid phrasing like:

- `I changed SQL`
- `I edited the database directly`
- `I changed the prompt to clear the user`
- `The user is silent` in operator-facing text
- `force_silent means permanently blocked`

## Pipeline Notes Agents Must Remember

- `retry_question` from the safety layer is not a conduct strike by itself
- obvious euphemistic sexual asks can escalate the ladder in the background while keeping the visible rejection copy stable
- legitimate couple-room / same-room massage questions are normal business questions and must not create conduct strikes
- pricing comparison and package-difference questions are normal business questions and must not create conduct strikes
- permanent ban is a separate hard-block layer checked before normal DM generation
- automatic permanent ban also escalates conduct state, but the blocked-users layer is what actually suppresses replies

## Where To Read The Code

- Conduct ladder state and overrides:
  [SuspiciousUserService.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/SuspiciousUserService.ts)
- Hard blocks and permanent blocks:
  [UserBlockService.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/UserBlockService.ts)
- Permanent-ban heuristics:
  [PermanentBanHeuristics.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/PermanentBanHeuristics.ts)
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
- Permanent-block operations are also on the admin/session surface.
