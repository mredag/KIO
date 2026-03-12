# MEMORY - Forge

This file is a short Forge mirror. Canonical repo state lives in:
- `docs/agent-runtime-memory.md`
- `docs/project-progress.md`

## Local Reminders
- Pi root: `/home/eform-kio/kio-new/`
- Windows root: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`
- Production backend build: `npx tsc -p tsconfig.build.json` then copy all `src/database/*.sql` files into `dist/database/`
- On Pi, backend changes are not done until `pm2 restart kio-backend`, git push, and commit-hash reporting are complete.
