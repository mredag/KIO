# Knowledge Base Operations

Canonical repo copy: `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md`
This workspace file is the runtime mirror for OpenClaw agents.

## Hard Rules

- Live KB data is the `knowledge_base` table shown in `/admin/knowledge-base`.
- Do not use `sqlite3`, direct SQL writes, or ad-hoc file edits for routine KB changes.
- Do not use `seed-knowledge.ts` or `migrate-kb.mjs` for live KB edits.
- Do not bulk-reseed live KB data to change one row.
- After every KB write, refetch the changed row and the affected KB context.

## Required Protocol

For live KB changes, the workflow is mandatory:

`scan -> preview -> approval -> apply -> verify -> final report`

That means:

1. Read the current KB first
2. Identify the exact row IDs involved
3. Show a preview before any write
4. Wait for approval
5. Apply only the previewed change
6. Refetch and verify
7. Report exactly what changed

Default change policy:

- Change only `value` unless the owner explicitly asked to edit `description`
- If a preview would change `description`, set `allowDescriptionChanges=true` only when the owner explicitly requested it
- `apply` must include `approvedChangeSetId` and `approvalText`
- `approvalText` must include the exact change-set id and an explicit approval phrase such as `Onayliyorum. Change-set <id> uygula.`

## Current Data Model

Current KB fields in this repo:

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

- The current schema does not expose `topic_slug`

## Allowed Categories

- `services`
- `pricing`
- `hours`
- `policies`
- `contact`
- `general`
- `faq`

## Access Modes

- OpenClaw agent access to `/api/integrations/knowledge/*`: `Authorization: Bearer <KIO_API_KEY>`
- Admin UI/API: authenticated browser session
- Integration KB routes use `Authorization: Bearer <KIO_API_KEY>`

## API-Key Routes Available Today

Base URL: `http://localhost:3001`

- `GET /api/integrations/knowledge/entries`
- `GET /api/integrations/knowledge/context`
- `POST /api/integrations/knowledge/change-sets/preview`
- `GET /api/integrations/knowledge/change-sets/:id`
- `POST /api/integrations/knowledge/change-sets/:id/apply`
- `POST /api/integrations/knowledge/change-sets/:id/rollback`

Meaning:

- Create, update, delete, and rollback flows should use the change-set API
- Legacy direct `PUT` is disabled for API consumers

## Preview Requirements

Before any write, the agent must show:

- target environment
- candidate rows
- chosen row IDs
- exact operation type
- before value
- after value
- exact API call plan
- statement that no write has happened yet

## Price Update Notes

- Scan `pricing` first for any price-change request.
- For massage pricing, start with `pricing.complete_massage_pricing`.
- The generic `bilgi almak istiyorum` reply uses that live row dynamically, so changing that row updates the template automatically.
- Only inspect related `faq` / `services` rows when they repeat the same price fact.
- Do not widen scope silently just because multiple rows contain similar numbers.
- If the owner sends an image, extract a structured price list first, flag unreadable lines, then preview from the extracted list.
- Approval for live price writes still requires the exact change-set id in the approval text.

## Safety Rules

- Prefer update over duplicate create
- Prefer `is_active=false` over delete for temporary facts
- Default blast radius is one row
- If more than one row may be affected, do not guess
- If the request is ambiguous, stop after preview

## Verification Rules

After apply:

- refetch changed row
- refetch affected category context
- confirm exact value match
- report that no unrelated rows changed
