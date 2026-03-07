# Raspberry Pi Deployment Guide

This is the current production runbook for the Pi at `192.168.1.8`.

## Overview

- Live app directory: `~/kio-new`
- Rollback checkout: `~/spa-kiosk`
- Backend PM2 process: `kio-backend`
- OpenClaw PM2 process: `kio-openclaw`
- Backend health URL: `http://localhost:3001/api/kiosk/health`
- Admin URL: `http://192.168.1.8:3001/admin`

`~/spa-kiosk` is rollback-only. Normal maintenance happens in `~/kio-new`.

## Standard Update Procedure

```bash
cd ~/kio-new/deployment/raspberry-pi
./update-pi.sh
```

Expected behavior:
- database snapshot written to `~/kio-new/data/backups/`
- repo fast-forwards from `origin/master`
- root workspace dependencies installed via `npm ci --no-audit --no-fund`
- backend rebuilt with `npx tsc -p tsconfig.build.json`
- SQL files copied to `backend/dist/database/`
- frontend rebuilt with Vite and copied to `backend/public/`
- `kio-backend` restarted via PM2
- tracked OpenClaw files synced into `~/.openclaw/`
- `kio-openclaw` restarted
- health check retried until backend is healthy

## Fresh Install Procedure

Run this only for a new Pi or a rebuilt OS image.

```bash
cd ~/kio-new/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
sudo reboot
```

Installer responsibilities:
- install Node.js 22
- install PM2 and kiosk dependencies
- configure Chromium kiosk autostart
- build backend and frontend from the current checkout
- start `kio-backend`
- install watchdog and backup cron

## OpenClaw Runtime

Tracked source files:
- `openclaw-config/workspace/`
- `openclaw-config/workspace-whatsapp/`
- `openclaw-config/workspaces/`
- `openclaw-config/transforms/`

Runtime destination:
- `~/.openclaw/`

Sync command:

```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

Machine-local file:
- `~/.openclaw/openclaw.json`

Do not put machine-local secrets into git.

## Verification

```bash
pm2 status
pm2 logs kio-backend --lines 100
pm2 logs kio-openclaw --lines 100
curl http://localhost:3001/api/kiosk/health
ss -tlnp | grep 18789
```

Good state:
- `kio-backend` online
- `kio-openclaw` online
- backend health returns `{"status":"ok"}`
- gateway listens on `127.0.0.1:18789`

## Backups and Restore

Create backup:

```bash
cd ~/kio-new/deployment/raspberry-pi
./backup-database.sh
```

Restore backup:

```bash
cd ~/kio-new/deployment/raspberry-pi
./restore-backup.sh
```

Backups are stored under `~/kio-new/data/backups/`.

## Troubleshooting

Backend not starting:

```bash
pm2 logs kio-backend --lines 100
cd ~/kio-new/backend
npx tsc -p tsconfig.build.json
cp src/database/*.sql dist/database/
```

OpenClaw runtime drift:

```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

Chromium not visible:

```bash
pkill chromium || pkill chromium-browser
~/start-kiosk.sh
```

Native module issue after Node upgrade:

```bash
cd ~/kio-new
npm rebuild bcrypt
```

## Hard Rules

- Do not run blanket `pm2 stop all` or `pm2 delete all` during normal operations.
- Do not use KB seed or migration scripts for live content edits.
- Do not copy `node_modules` from another machine.
- Do not switch back to `~/spa-kiosk` without explicit rollback intent and a backup plan.

## Rollback Note

There is no single safe rollback command anymore. Use one of these instead:
- restore the database with `restore-backup.sh`
- deploy a known-good git commit into `~/kio-new`
- fall back to `~/spa-kiosk` only as a manual recovery operation after reviewing service impact