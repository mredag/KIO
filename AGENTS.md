# Repository Guidelines

## Agent Doc System
- Read order for Codex and repo-aware agents:
  1. `AGENTS.md`
  2. `docs/agent-runtime-memory.md`
  3. `docs/project-progress.md`
  4. Relevant feature guide only if the task touches that area
  5. `openclaw-config/workspace/PROJECT_MAP.md` before multi-file code work
- `AGENTS.md` is for stable repo rules, structure, guardrails, and read order.
- `docs/agent-runtime-memory.md` is the canonical current-state document for live behavior, deployment state, and critical runbooks.
- `docs/project-progress.md` is the canonical recent-change ledger.
- `docs/agent-docs-contract.md` defines document ownership, duplication limits, and update rules.
- Workspace `MEMORY.md` and `DEVELOPER_MEMORY.md` files are mirrors only. They must stay short and point back to the canonical repo docs.

## Project Structure & Module Organization
- Root uses npm workspaces: `frontend` (Vite + React + TS) and `backend` (Express + TS + SQLite).
- Backend: `backend/src/{routes,services,middleware,database,i18n}` with unit tests beside code (for example `*.test.ts`) and E2E under `backend/src/e2e`.
- Frontend: `frontend/src/{components,pages,layouts,stores,lib,i18n,locales,styles}` with small unit tests in `lib/*/.test.ts`.
- Mission Control backend routes live under `backend/src/routes/missionControlRoutes.ts` and related `backend/src/routes/*.ts` factory routes. Mission Control frontend pages live under `frontend/src/pages/admin/mc/MC*.tsx`.
- Deployment assets live in `deployment/windows/` and `deployment/raspberry-pi/`.
- OpenClaw runtime config lives under `openclaw-config/` and is synced into `~/.openclaw/` on the target machine.

## Build, Test, and Development Commands
- Install: `npm install`
- Dev (all): `npm run dev`
- Dev (backend): `npm run dev --workspace=backend`
- Dev (frontend): `npm run dev --workspace=frontend`
- Build: `npm run build`
- Backend tests: `npm run test --workspace=backend`
- Backend E2E: `npm run test:e2e --workspace=backend`
- Lint: `npm run lint`
- Format: `npm run format`

## Coding Style & Naming Conventions
- Language: TypeScript, 2-space indentation, semicolons on, prefer named exports.
- React components/files: PascalCase. Hooks: `useXxx`.
- Services and middleware: PascalCase class names. Variables and functions: camelCase.
- Run ESLint before push; use Prettier via `npm run format` for `.ts`, `.tsx`, `.js`, `.json`, and `.md`.

## Testing Guidelines
- Framework: Vitest.
- Co-locate unit tests as `*.test.ts` or `*.test.tsx`.
- Keep tests deterministic and avoid network dependence.
- Add or update tests when changing backend services, routes, or other behavior-sensitive code.

## Commit & Pull Request Guidelines
- Follow Conventional Commits such as `feat: ...` and `fix: ...`.
- PRs should include a clear summary, scope, test plan, screenshots for UI changes, and linked issues or references.
- Expect lint and backend tests to pass locally before asking for review.

## Security & Configuration Tips
- Backend loads env via `dotenv`. Never commit secrets or `.env` files.
- SQLite files and backups are managed by deployment scripts; verify paths before running them.
- Treat live `~/.openclaw/openclaw.json` as machine-local and secret-bearing. Keep repo-stored OpenClaw config examples sanitized, and do not overwrite live copies blindly.

## Stable Engineering Rules
- Keep changes minimal and scoped. Do not refactor unrelated modules.
- Respect the existing file structure and naming conventions.
- All relative backend imports must use the `.js` extension. Node ESM requires this.
- Do not modify `backend/tsconfig.json`. Use `backend/tsconfig.build.json` for production builds.
- Full backend production build is:
  - `npx tsc -p tsconfig.build.json`
  - copy all `*.sql` files into `dist/database/`
- Mission Control and other backend routes use the factory pattern `createXxxRoutes(db)` and receive the raw SQLite db instance, not `DatabaseService`.

## Stable Runtime & Deployment Facts
- Windows dev machine: backend uses Node 18 via `fnm`; OpenClaw gateway may run on system Node separately.
- Raspberry Pi production: backend and OpenClaw both run on Node 22.22.0 via PM2.
- Pi paths:
  - active system: `~/kio-new/`
  - rollback system: `~/spa-kiosk/`
- Pi OpenClaw must use the bash wrapper script `~/start-openclaw.sh`; direct PM2 launch of `openclaw gateway` is not the supported production pattern.
- After Node upgrades on the Pi, run `npm rebuild bcrypt`.
- Sync tracked OpenClaw runtime docs/config with `deployment/raspberry-pi/sync-openclaw-runtime.sh`.

## Stable Product & Agent Guardrails
- OpenClaw owns transport, sessions, hooks, and workspace bootstrap. KIO owns business logic, policy, persistence, admin UI, and reporting.
- Non-main agents do not get direct SQLite access. Use KIO HTTP APIs instead.
- For `/api/integrations/*`, use `Authorization: Bearer <KIO_API_KEY>`.
- Live Knowledge Base work must follow the preview-first flow in `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md`. Do not use seed files, reseeds, or direct SQL for live KB edits.
- DM debugging should start from the execution detail endpoint and `EXE-...` ids, not ad-hoc SQL.
- All webhook-style interaction timestamps must use `new Date().toISOString()`, not SQLite `datetime('now')`.
- `mc_jobs` uses the `payload` column for structured data. Do not assume `description` or `metadata` columns exist.
- Treat the current Pi deployment as the post-incident recovery baseline. Keep automation guards off by default unless the owner explicitly approves them in the same request.
- Do not enable cron scanners, autonomous Forge runs, scheduled prompt rewrites, or background automation without explicit owner consent in the same request.

## Feature-Specific Guides
- Read `docs/KNOWLEDGE_BASE_AGENT_GUIDE.md` before live KB edits.
- Read `docs/DM_CONDUCT_AGENT_GUIDE.md` before conduct-state work.
- Read `docs/DM_RESPONSE_CACHE_AGENT_GUIDE.md` before cache behavior changes.
- Read `docs/OPENCLAW_OPS_UPGRADE_PLAN.md` before OpenClaw runtime upgrades, gateway ops changes, or security hardening work.
- Read `docs/agent-runtime-memory.md` before changing DM behavior, OpenClaw integration, deployment behavior, or current-state-sensitive flows.
