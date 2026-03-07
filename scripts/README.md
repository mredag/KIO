# Scripts Directory

Current standard:
- Pi live app: `~/kio-new`
- Pi backend PM2 name: `kio-backend`
- Pi OpenClaw PM2 name: `kio-openclaw`
- Standard Pi update: `deployment/raspberry-pi/update-pi.sh`
- Legacy n8n workflows are archived and not part of current operations

## Recommended Paths

### Pi maintenance
Use the deployment runbook and updater:

```bash
cd ~/kio-new/deployment/raspberry-pi
./update-pi.sh
```

### Remote deploy from Windows
Use the maintained wrapper:

```powershell
.\deployment\raspberry-pi\remote-deploy.ps1
```

### OpenClaw runtime sync
```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

## Script Policy

- `scripts/pi-update.sh` and `scripts/pi-quick-update.sh` forward to the standard Pi updater.
- `scripts/pi-sync-translations.*` forward to the same remote update path because frontend changes still require the normal production build.
- `scripts/deploy/deploy-to-pi.ps1` forwards to the maintained remote deploy helper.
- Direct Pi database copy scripts are deprecated because they can overwrite live data.

## Safe Utilities Still Relevant

- `scripts/db/*`: local database inspection and maintenance helpers
- `scripts/data/*`: local import/export utilities
- `scripts/admin/*`: admin/bootstrap helpers
- `scripts/sync/migrate-and-sync.cjs`: local data migration helper

## Archived / Dangerous Paths

Do not use these as operational workflow patterns:
- old `~/spa-kiosk` paths
- old `kiosk-backend` / `spa-kiosk-backend` PM2 names
- direct DB overwrite scripts for the live Pi
- old n8n workflow instructions for current Instagram/WhatsApp production