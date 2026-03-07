# Quick Start Guide

## Raspberry Pi Production

Normal live maintenance:

```bash
cd ~/kio-new/deployment/raspberry-pi
./update-pi.sh
```

Useful checks:

```bash
pm2 status
pm2 logs kio-backend --lines 50
pm2 logs kio-openclaw --lines 50
curl http://localhost:3001/api/kiosk/health
```

OpenClaw runtime sync:

```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

## Windows Dev Machine

Remote deploy to Pi:

```powershell
.\deployment\raspberry-pi\remote-deploy.ps1
```

Check Pi database from Windows:

```powershell
node scripts/db/check-pi-db.cjs
```

Export local data:

```powershell
node scripts/data/export-all-data.cjs
```

## Rules

- Do not use `~/spa-kiosk` for normal operations.
- Do not use `pm2 delete all` or old `kiosk-backend` names.
- Do not copy the local database onto the live Pi as a normal workflow.
- Treat `n8n-workflows/` as archived reference, not active production.