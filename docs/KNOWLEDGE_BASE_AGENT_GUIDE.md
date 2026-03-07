# Knowledge Base Agent Guide

## Purpose

This guide defines the safe protocol for AI-assisted updates to the live Knowledge Base.

The live KB shown in `/admin/knowledge-base` is not repo seed data. It is the `knowledge_base`
table in the live SQLite database. That means KB changes must behave like live data operations,
not bootstrap operations.

Hard rule:

- Never use `backend/src/database/seed-knowledge.ts`
- Never use `backend/scripts/migrate-kb.mjs`
- Never use direct SQLite writes for routine KB edits
- Never bulk-reseed the KB to make a single live content change

Those tools are bootstrap and migration tools, not day-to-day KB editing tools.

## Current Live Surfaces

Live data:

- Admin page: `/admin/knowledge-base`
- Admin API: `/api/admin/knowledge-base`
- Integration API: `/api/integrations/knowledge/*`

Current KB schema in this repo:

- `id`
- `category`
- `key_name`
- `value`
- `description`
- `is_active`
- `version`
- `created_at`
- `updated_at`

Important:

- The current KB schema does not expose `topic_slug`
- `/api/integrations/knowledge/*` uses `Authorization: Bearer <N8N_API_KEY>`
- The current integration API in code supports:
  - `GET /api/integrations/knowledge/entries`
  - `GET /api/integrations/knowledge/context`
  - `PUT /api/integrations/knowledge/entries/:id`
- Create and delete are currently available through the admin API, not the API-key integration API

## Protocol V1: Preview-First KB Changes

This protocol works with the current system and is mandatory for agents.

### Phase 1: Scan

Before any write, the agent must read the current live KB.

Minimum scan steps:

1. List the current KB entries from the live environment
2. Find candidate rows by `category`, `key_name`, and business meaning
3. Fetch the affected context categories to understand retrieval impact
4. Decide whether the request is:
   - `noop`
   - `update_existing`
   - `create_new`
   - `soft_disable`
   - `delete`

Rules:

- Prefer `update_existing` when the fact already exists
- Prefer `create_new` only when no existing row maps cleanly
- Prefer `soft_disable` over `delete` for temporary or uncertain facts
- If multiple rows are plausible, do not guess. Show all candidates in preview

### Phase 2: Build Preview

Before writing anything, the agent must show a preview.

The preview must include:

- Environment target: `Pi`, `Windows local`, or both
- Why the selected row(s) were chosen
- Exact row IDs that would be touched
- Operation type for each row
- Before value
- After value
- Description changes, if any
- Whether `is_active` changes
- Exact API call plan
- Risk note
- A statement that no write has happened yet

### Required Preview Format

Use this structure:

```md
KB Scan
- Environment: Pi
- Request: <user request>
- Candidate rows:
  - `<id>` `faq.some_key` - why it matches
  - `<id>` `faq.other_key` - why it was rejected or kept as fallback

KB Preview
1. UPDATE `<id>` `faq.some_key`
- Before value: `...`
- After value: `...`
- Before description: `...`
- After description: `...`
- Why: `...`
- API: `PUT /api/integrations/knowledge/entries/<id>`

Approval
- No write has happened yet.
- Reply with explicit approval to apply this KB change.
```

### Phase 3: Approval Gate

KB writes must be approval-gated.

Rules:

- Do not write before preview
- Do not combine preview and write in the same step for live KB edits
- For one-row safe edits, preview is still required
- For multi-row changes, approval is mandatory
- For delete operations, approval is mandatory

### Phase 4: Apply

After approval:

1. Apply only the rows that were previewed
2. Do not expand scope during apply
3. Do not touch unrelated rows
4. For update operations, preserve the same row `id`
5. For create operations, create exactly one new row unless the preview explicitly approved more

### Phase 5: Verify

After apply:

1. Re-fetch every changed row
2. Re-fetch the affected knowledge context
3. Confirm the written values exactly match the preview
4. Confirm no extra rows were changed

### Phase 6: Final Report

Use this structure:

```md
KB Result
- Applied operations: `1 update`
- Verified rows:
  - `<id>` `faq.some_key`
- Verified context categories: `faq`
- No unrelated rows changed: `yes`

Final State
1. `faq.some_key`
- Value: `...`
- Description: `...`
- Version: `...`
```

## Safety Rules

- Live KB data wins over repo seed defaults
- Never overwrite a row just because the repo seed differs
- Never use seed files as the source of truth for live admin-managed KB content
- Default blast radius is one row
- If a change appears to touch more than one row, the preview must explain why
- If the request is ambiguous, stop at preview and ask for confirmation

## Tooling Rules By Access Mode

### If the agent only has API key access

Allowed:

- Use `Authorization: Bearer <N8N_API_KEY>` for `/api/integrations/knowledge/*`
- `GET /api/integrations/knowledge/entries`
- `GET /api/integrations/knowledge/context`
- `PUT /api/integrations/knowledge/entries/:id`

Meaning:

- Update-only flows can be fully executed
- Create/delete flows can be scanned and previewed, but may require admin session auth or a future preview/apply API

### If the agent has admin session access

Allowed:

- `GET /api/admin/knowledge-base`
- `POST /api/admin/knowledge-base`
- `PUT /api/admin/knowledge-base/:id`
- `DELETE /api/admin/knowledge-base/:id`

Even with admin access, the same preview-first protocol still applies.

## Recommended Future Backend Design

The current system can enforce the protocol socially through agent instructions. The stronger design
is to enforce it in the backend.

### Proposed Objects

Add change-set based KB editing:

- `knowledge_change_sets`
- `knowledge_change_set_items`
- `knowledge_base_history`

Suggested fields:

- change set id
- requester
- environment
- original request text
- status: `planned | approved | applied | rolled_back | rejected`
- created_at
- approved_at
- applied_at
- per-row before snapshot
- per-row after snapshot
- verification result

### Proposed Endpoints

- `POST /api/integrations/knowledge/change-sets/preview`
- `GET /api/integrations/knowledge/change-sets/:id`
- `POST /api/integrations/knowledge/change-sets/:id/apply`
- `POST /api/integrations/knowledge/change-sets/:id/rollback`

Behavior:

- `preview` reads current KB, computes exact operations, stores the plan, performs no writes
- `apply` executes the stored plan in a transaction
- `rollback` restores the stored `before` snapshot

### Why This Is Better

- The preview becomes a real backend artifact, not just chat text
- Apply can be transaction-safe
- Rollback becomes reliable
- The system can prove exactly what changed
- Future UI can show a diff before approval

## KIO-Specific Decision Policy

For this repo, agents should follow these defaults:

- Pi is the primary live target
- Repo files are documentation and bootstrap references, not live KB truth
- When the request is "change one thing", the agent must keep scope to one KB row unless preview says otherwise
- If the requested fact does not fit any existing row, the agent should propose `create_new` in preview instead of mutating unrelated rows

## Non-Negotiable Rule

For live KB work, the minimum workflow is:

`scan -> preview -> approval -> apply -> verify -> final report`

Anything shorter is unsafe.
