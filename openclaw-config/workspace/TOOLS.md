# TOOLS - Eform Environment

## Platform Detection
- Pi production: bash on Raspberry Pi 5
- Windows dev: PowerShell on Windows 11
- Detect with `uname -s` on Pi or the PowerShell prompt on Windows

## Paths
- Pi repo: `/home/eform-kio/kio-new`
- Pi runtime OpenClaw: `/home/eform-kio/.openclaw`
- Windows repo: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`

## Auth Modes
- `/api/integrations/*`: `Authorization: Bearer <KIO_API_KEY>`
- `/api/mc/*`: local backend/admin surface in the current codebase
- Integration routes use `Authorization: Bearer <KIO_API_KEY>`

## Safe KB Workflow
Use the backend-enforced change-set flow for live KB edits:
1. `GET /api/integrations/knowledge/entries`
2. `POST /api/integrations/knowledge/change-sets/preview`
3. Wait for approval
4. `POST /api/integrations/knowledge/change-sets/:id/apply`
5. If needed: `POST /api/integrations/knowledge/change-sets/:id/rollback`

## Example Calls
```bash
# Health
curl -s http://localhost:3001/api/kiosk/health

# List KB entries
curl -s -H "Authorization: Bearer <KIO_API_KEY>" \
  http://localhost:3001/api/integrations/knowledge/entries

# Preview a KB change set
curl -s -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <KIO_API_KEY>" \
  -d '{"requestedBy":"jarvis","operations":[{"type":"update","id":"ENTRY_ID","value":"Yeni deger"}]}' \
  http://localhost:3001/api/integrations/knowledge/change-sets/preview
```

```powershell
# Health
Invoke-RestMethod -Uri "http://localhost:3001/api/kiosk/health" -Method GET

# List KB entries
Invoke-RestMethod -Uri "http://localhost:3001/api/integrations/knowledge/entries" -Method GET -Headers @{ "Authorization" = "Bearer <KIO_API_KEY>" }
```

## Build
```bash
cd /home/eform-kio/kio-new/backend
npx tsc -p tsconfig.build.json
cp src/database/*.sql dist/database/
pm2 restart kio-backend
```

## Notes
- Do not use direct SQLite access for live business data work.
- On Pi, Jarvis delegates coding to Forge.
- Verify the tracked Instagram webhook route before changing inbound timing behavior; do not assume local-only fragment buffering exists.
