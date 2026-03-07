# MEMORY — Forge System Knowledge

## Codebase
- **Pi root:** `/home/eform-kio/kio-new/`
- **Windows root:** `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`
- **Structure:** npm workspaces — `frontend/` (React+Vite) + `backend/` (Express+TS+SQLite)
- **Backend runtime:** Node 22 on Pi, Node 18 via fnm on Windows. ESM (`"type": "module"`)
- **Backend port:** 3001 (PM2 on Pi, tsx watch on Windows dev)
- **OpenClaw port:** 18789
- **Database (Pi):** `/home/eform-kio/kio-new/data/kiosk.db`

## Architecture Patterns
- Routes use factory pattern: `createXxxRoutes(db)` receives raw `Database.Database`
- React Query for all API calls via custom hooks in `frontend/src/hooks/`
- Tailwind CSS with dark glassmorphism theme on Mission Control pages
- i18n: Turkish primary, keys in `frontend/src/locales/tr/`

## Critical Rules (Learned the Hard Way)
1. ALL relative imports MUST have `.js` extension — Node ESM crashes without them
2. Never modify `backend/tsconfig.json` — use `tsconfig.build.json` for builds
3. `tsconfig.build.json` excludes test files + VectorStoreService
4. After build: `cp src/database/*.sql dist/database/` (ALL sql files, not just schema.sql)
5. Factory routes get raw SQLite db, NOT DatabaseService wrapper
6. On Windows: `curl` is aliased to `Invoke-WebRequest` — use `Invoke-RestMethod`
7. mc_jobs uses `payload` column (JSON), NOT `description` or `metadata`
8. Timestamps: `new Date().toISOString()`, never `datetime('now')`
9. On Pi: `pm2 restart kio-backend` after backend changes

## Work History
_(Updated during sessions)_
