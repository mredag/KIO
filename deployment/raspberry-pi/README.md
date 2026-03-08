# Raspberry Pi Deployment

Current production layout:
- Live system: `~/kio-new`
- Rollback checkout: `~/spa-kiosk` (do not use for normal updates)
- Backend PM2 process: `kio-backend`
- OpenClaw PM2 process: `kio-openclaw`
- Standard maintenance command: `cd ~/kio-new/deployment/raspberry-pi && ./update-pi.sh`

## Fresh Install

1. Clone the repo into `~/kio-new`.
2. Run the one-command installer:

```bash
cd ~/kio-new/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

3. Reboot the Pi:

```bash
sudo reboot
```

Notes:
- The installer assumes Raspberry Pi OS with sudo access.
- It installs Node.js 22, PM2, Chromium, the kiosk watchdog, and the backend build.
- If this Pi also runs OpenClaw, keep `~/.openclaw/openclaw.json` machine-local and sync tracked workspace files with `./sync-openclaw-runtime.sh --restart`.

## Standard Maintenance

Use this for normal production updates:

```bash
cd ~/kio-new/deployment/raspberry-pi
./update-pi.sh
```

What it does:
- backs up `data/kiosk.db`
- `git pull --ff-only origin master`
- `npm ci --no-audit --no-fund`
- builds backend with `tsconfig.build.json`
- copies SQL files into `backend/dist/database/`
- builds frontend and copies it into `backend/public/`
- restarts `kio-backend`
- syncs tracked OpenClaw runtime files and restarts `kio-openclaw`
- checks `http://localhost:3001/api/kiosk/health`

## OpenClaw Runtime Sync

Tracked workspace and transform files live in `openclaw-config/` and sync to `~/.openclaw/`.

```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

Rules:
- `openclaw-config/openclaw.json` stays ignored and machine-local.
- Do not overwrite `~/.openclaw/openclaw.json` from git.
- Workspace markdown files (`AGENTS.md`, `DEVELOPER_MEMORY.md`, `KNOWLEDGE_BASE.md`, and similar `*.md` runtime docs) are refreshed when the repo copy is newer, so live agent instructions do not stay stale after docs-only updates.

## Backups and Restore

Create a manual backup:

```bash
cd ~/kio-new/deployment/raspberry-pi
./backup-database.sh
```

Create a pre-feature rollback snapshot:

```bash
cd ~/kio-new/deployment/raspberry-pi
./pre-feature-snapshot.sh
```

Use this before risky DM/policy/prompt changes. Record both the printed snapshot directory and `git rev-parse --short HEAD` so rollback has an exact code + runtime baseline.

This captures:
- current git SHA
- SQLite database copy
- backend `.env`
- OpenClaw runtime archive
- PM2 status and health response

Restore a backup:

```bash
cd ~/kio-new/deployment/raspberry-pi
./restore-backup.sh
```

## Status and Logs

```bash
pm2 status
pm2 logs kio-backend
pm2 logs kio-openclaw
sudo journalctl -u kiosk-watchdog -f
curl http://localhost:3001/api/kiosk/health
```

## Key Files

- `setup-raspberry-pi.sh`: fresh install bootstrap
- `update-pi.sh`: standard live update
- `sync-openclaw-runtime.sh`: sync tracked OpenClaw files to runtime
- `backup-database.sh`: manual DB backup
- `pre-feature-snapshot.sh`: full rollback snapshot before risky feature work
- `restore-backup.sh`: interactive DB restore
- `test-kiosk-setup.sh`: post-install verification
- `start-backend-pm2.sh`: backend PM2 bootstrap helper
- `watchdog-kiosk.sh`: kiosk/backend watchdog

## Hard Rules

- Do not use `pm2 delete all` in normal maintenance.
- Do not edit live KB through seed or migration scripts.
- Do not treat `~/spa-kiosk` as the active deployment.
- Do not copy `node_modules` between machines.

## Related Docs

- [RASPBERRY_PI.md](RASPBERRY_PI.md)
- [PI_SETUP_GUIDE.md](PI_SETUP_GUIDE.md)
- [PI_INSTALLATION_CHECKLIST.md](PI_INSTALLATION_CHECKLIST.md)
