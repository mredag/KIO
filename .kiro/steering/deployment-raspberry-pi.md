---
inclusion: manual
---

# Raspberry Pi Deployment

**Pi:** `192.168.1.8`
**User:** `eform-kio`
**Node:** `22.22.0`
**Live app:** `~/kio-new`
**Rollback checkout:** `~/spa-kiosk`

## Live Services

| Service | Manager | Port | Expected state |
| --- | --- | --- | --- |
| `kio-backend` | PM2 | `3001` | `online` |
| `kio-openclaw` | PM2 | `18789` | `online` |
| `cloudflared` | systemd | n/a | `enabled` |
| Chromium kiosk | autostart | n/a | starts after login |

## Standard Update

```bash
cd ~/kio-new/deployment/raspberry-pi
./update-pi.sh
```

This is the only normal live-update path.

It:
- backs up `data/kiosk.db`
- fast-forwards git from `origin/master`
- runs `npm ci --no-audit --no-fund`
- rebuilds backend with `tsconfig.build.json`
- copies SQL assets into `backend/dist/database/`
- rebuilds frontend and refreshes `backend/public/`
- restarts `kio-backend`
- syncs tracked OpenClaw runtime files
- restarts `kio-openclaw`
- verifies backend health

## OpenClaw Runtime Sync

```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

Rules:
- tracked source is `openclaw-config/`
- runtime destination is `~/.openclaw/`
- `~/.openclaw/openclaw.json` is machine-local and not tracked

## Manual Verification

```bash
pm2 status
curl http://localhost:3001/api/kiosk/health
pm2 logs kio-backend --lines 100
pm2 logs kio-openclaw --lines 100
ss -tlnp | grep 18789
```

## Hard Rules

1. Use `tsconfig.build.json` for backend production builds.
2. Copy all SQL files into `backend/dist/database/` after backend build.
3. Use `npm ci --no-audit --no-fund` on the Pi, not ad hoc per-workspace installs.
4. Do not copy `node_modules` from another machine.
5. Do not use blanket `pm2 stop all` or `pm2 delete all` during normal operations.
6. Do not use KB seed or migration scripts for live KB edits.
7. `~/spa-kiosk` is rollback only.

## Recovery Notes

Preferred recovery order:
1. inspect logs
2. restore DB from `~/kio-new/data/backups/` if data is the issue
3. redeploy a known-good commit into `~/kio-new`
4. use `~/spa-kiosk` only as a manual rollback decision

## Cloudflared Warning

Only one machine should run the production tunnel for the same tunnel ID. Do not let both the dev machine and Pi serve the same webhook tunnel at the same time.