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
- Kiosk browser startup is managed by a user service:
  - `~/.config/systemd/user/kio-kiosk.service`
  - `~/.config/autostart/kiosk.desktop` only imports the graphical session environment and starts that service
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
- If you rebuild or refresh the machine-local OpenClaw config from the repo example, make sure the OpenClaw process environment provides:
  - `OPENROUTER_API_KEY`
  - `OPENCLAW_HOOKS_TOKEN`
  - `OPENCLAW_GATEWAY_TOKEN`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_ADMIN_CHAT_ID`

## OpenClaw Runtime Upgrade

Use the dedicated helper for OpenClaw version upgrades on the Pi:

```bash
cd ~/kio-new/deployment/raspberry-pi
bash ./upgrade-openclaw.sh --dry-run
bash ./upgrade-openclaw.sh
```

What it does:
- creates a pre-feature snapshot unless skipped
- creates an OpenClaw runtime backup when the installed CLI supports it
- runs preflight `doctor`, `security audit`, and `gateway status`
- upgrades OpenClaw through `npm i -g openclaw@latest`
- optionally syncs tracked OpenClaw runtime files
- restarts PM2 `kio-openclaw`
- runs post-upgrade checks including `gateway health`

Notes:
- This keeps the existing PM2 + `~/start-openclaw.sh` production pattern.
- It does not overwrite `~/.openclaw/openclaw.json` from git.
- Use `--sync-runtime` only when you intentionally want the tracked workspace/transform files refreshed as part of the same maintenance window.

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
systemctl --user status kio-kiosk.service
tail -f /run/user/1000/kio-kiosk/launcher.log
```

## Key Files

- `setup-raspberry-pi.sh`: fresh install bootstrap
- `update-pi.sh`: standard live update
- `sync-openclaw-runtime.sh`: sync tracked OpenClaw files to runtime
- `upgrade-openclaw.sh`: snapshot, back up, upgrade, restart, and verify OpenClaw on Pi
- `backup-database.sh`: manual DB backup
- `pre-feature-snapshot.sh`: full rollback snapshot before risky feature work
- `restore-backup.sh`: interactive DB restore
- `test-kiosk-setup.sh`: post-install verification
- `start-backend-pm2.sh`: backend PM2 bootstrap helper
- `start-kiosk.sh`: Wayland-safe Chromium launcher with readiness gates and single-instance lock
- `kio-kiosk.service`: managed user service for kiosk browser startup
- `kiosk-autostart.desktop`: tiny desktop bootstrap that starts the managed user service
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
