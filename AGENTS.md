# Repository Guidelines

## Project Structure & Module Organization
- Root uses npm workspaces: `frontend` (Vite + React + TS) and `backend` (Express + TS + SQLite).
- Backend: `backend/src/{routes,services,middleware,database,i18n}` with unit tests beside code (e.g., `*.test.ts`) and E2E under `backend/src/e2e`.
- Frontend: `frontend/src/{components,pages,layouts,stores,lib,i18n,locales,styles}` with small unit tests in `lib/*/.test.ts`.
- Deployment: `deployment/windows/*.bat`, `deployment/raspberry-pi/*` (PM2 + scripts).

## Build, Test, and Development Commands
- Install: `npm install` (installs all workspaces).
- Dev (both): `npm run dev` (backend + frontend concurrently).
- Dev (per app): `npm run dev --workspace=backend` or `npm run dev --workspace=frontend`.
- Build: `npm run build` (then start API with `npm run start:prod`).
- Frontend preview: `npm run preview --workspace=frontend` (or `preview:prod`).
- Backend tests: `npm run test --workspace=backend` (watch: `test:watch`, E2E: `test:e2e`).
- Lint all: `npm run lint`. Format: `npm run format`.

## Coding Style & Naming Conventions
- Language: TypeScript, 2‑space indentation, semicolons on, prefer named exports.
- React components/files: PascalCase (e.g., `MassageList.tsx`). Hooks: `useXxx`.
- Services/middleware: PascalCase class names (e.g., `LoggerService.ts`). Variables/functions: camelCase.
- Run ESLint before push; use Prettier via `npm run format` for `.ts/.tsx/.js/.json/.md`.

## Testing Guidelines
- Framework: Vitest. Co-locate unit tests as `*.test.ts`/`*.test.tsx`.
- E2E live under `backend/src/e2e`; run with `npm -w backend run test:e2e`.
- Add tests for new routes/services and update affected snapshots. Keep tests deterministic; avoid network.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (e.g., `feat: ...`, `fix: ...`).
- PRs include: clear summary, scope of changes, test plan, screenshots for UI, and linked issue/refs.
- CI expectation: lint and backend tests pass locally before requesting review.

## Security & Configuration Tips
- Backend loads env via `dotenv`. Never commit secrets or `.env` files.
- SQLite files and backups are managed by scripts in `deployment/`; verify paths before running.

## Agent-Specific Notes
- Keep changes minimal and scoped; do not refactor unrelated modules.
- Respect existing structure and naming; update or add tests when touching backend services/routes.
