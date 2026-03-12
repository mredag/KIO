# DM Response Cache Agent Guide

## Purpose

This guide explains how to inspect, verify, seed, and clear the Instagram DM response cache safely.

The DM response cache is:

- exact-match only
- Instagram-side only
- read/write local only, with no extra model call
- limited to safe, simple turns

It is implemented in [DMResponseCacheService.ts](/D:/PERSONEL/Eform-Resepsion-Kiosk-ClawBot/backend/src/services/DMResponseCacheService.ts).

## What The Cache Stores

Each cache row represents a specific lookup key:

- cache class
- normalized customer message
- knowledge-base signature
- pipeline-config signature
- conduct state
- cache version

The stored row also keeps:

- the cached response text
- observation count
- `candidate` or `active` status
- source execution id
- first seen / last seen / expiry timestamps

Important:

- `candidate` means the response has been seen, but is not yet trusted enough for live hits.
- `active` means the response won the evidence race for that exact lookup key and can be served directly.

## Where To See It

### Admin UI

DM Kontrol Merkezi:

- `Health` tab
- `Yanit Cache` card

This panel now shows:

- total / active / candidate counts
- class distribution
- filterable cache rows
- seed / clear actions

The filterable row list shows:

- status
- cache class
- normalized customer message
- cached response
- observation count
- source execution id
- first seen / last seen relative times

### Live Feed / Execution Trace

DM Kontrol feed and execution trace show whether the cache was used for a specific message:

- `Cache hit`
- `Cache adayi`
- `Cache miss`
- `Cache disi`

A real hit appears as:

- `fastLane.kind = "response_cache"`
- populated `trace.cache`
- `AI atlandi` badge in the trace UI

## API Surfaces

All routes live under `/api/mc/dm-kontrol`.

Read-only inspection:

- `GET /response-cache/stats`
- `GET /response-cache/entries?status=all|active|candidate&limit=50`

Operations:

- `POST /response-cache/seed`
- `POST /response-cache/clear`

## Safe Workflow For Agents

Use this order unless the owner asked for something different:

1. Check status with `GET /response-cache/stats`
2. Inspect current rows with `GET /response-cache/entries`
3. If you want to estimate seeding impact, run `POST /response-cache/seed` with `dryRun=true`
4. If approved, run `POST /response-cache/seed` with `dryRun=false`
5. Re-check `stats` and `entries`
6. Verify real usage in DM Kontrol feed or an execution detail
7. If rollback is needed, run `POST /response-cache/clear`

## Example Requests

Preview seed impact:

```bash
curl -X POST http://localhost:3001/api/mc/dm-kontrol/response-cache/seed \
  -H "Content-Type: application/json" \
  -d "{\"days\":30,\"dryRun\":true,\"directOnly\":true}"
```

List active entries:

```bash
curl "http://localhost:3001/api/mc/dm-kontrol/response-cache/entries?status=active&limit=50"
```

Clear cache:

```bash
curl -X POST http://localhost:3001/api/mc/dm-kontrol/response-cache/clear
```

## Guardrails

Agents must not:

- write directly to the `dm_response_cache` table
- invent cache rows manually
- bulk-modify the cache with ad-hoc SQL
- assume a cache hit without checking `trace.cache` or `fastLane.kind`

Agents should:

- prefer read-only inspection first
- use `dryRun=true` before seeding when the effect is uncertain
- remember that cache keys are invalidated by KB/config signature changes
- clear the cache only when explicitly needed, because it removes both `active` and `candidate` evidence

## Current Limitations

- The cache is read-only from the UI except for `seed` and `clear`
- There is no per-row delete yet
- The cache is currently Instagram-only
