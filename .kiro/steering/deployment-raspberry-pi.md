---
inclusion: manual
---

# Raspberry Pi Deployment

**Pi:** 192.168.1.8 | **User:** eform-kio | **Node:** 22.x | **OS:** Debian 13 (trixie) aarch64
**New system:** `~/kio-new/` | **Old system (rollback):** `~/spa-kiosk/`
**SSH:** `ssh eform-kio@192.168.1.8` (default key `~/.ssh/id_ed25519`)

## Running Services

| Service | Manager | Port | Status |
|---------|---------|------|--------|
| kio-backend | PM2 | 3001 | online |
| kio-openclaw | PM2 (bash wrapper) | 18789 | online |
| cloudflared | systemd | — | enabled |
| Chromium kiosk | autostart | — | enabled |
| n8n | systemd | 5678 | disabled |

## Deploy Updates

```bash
# SSH into Pi
ssh eform-kio@192.168.1.8

# Pull latest code
cd ~/kio-new && git pull

# Build backend
cd backend && npx tsc -p tsconfig.build.json
cp src/database/*.sql dist/database/

# Build frontend
cd ../frontend && npx vite build

# Restart services
pm2 restart kio-backend
pm2 restart kio-openclaw  # only if openclaw config changed
```

## Critical Rules

1. Use `tsconfig.build.json` for backend builds (NOT `tsconfig.json`)
2. Copy ALL `*.sql` files to `dist/database/` after build (schema.sql + agent-comms-schema.sql + mission-control-schema.sql)
3. Set `NODE_ENV=production` in `.env`
4. Never copy `node_modules` — always `npm install` on Pi
5. Frontend served by backend on port 3001 in production (not separate server)
6. After Node version upgrade: `npm rebuild bcrypt` (native module)
7. OpenClaw requires Node >= 22.12 — Pi has 22.22.0 via NodeSource
8. PM2 starts OpenClaw via bash wrapper `~/start-openclaw.sh` (direct binary doesn't spawn gateway)

## OpenClaw Config (Pi-specific)

Config at `~/.openclaw/openclaw.json` — uses Linux paths (not Windows).
Workspace at `~/.openclaw/workspace/` — all agent files (AGENTS.md, SOUL.md, TOOLS.md, etc.)

To update OpenClaw config from dev machine:
```powershell
scp openclaw-config/openclaw.json eform-kio@192.168.1.8:~/.openclaw/openclaw.json
# IMPORTANT: edit the file to replace Windows paths with Linux paths
scp -r openclaw-config/workspace/* eform-kio@192.168.1.8:~/.openclaw/workspace/
ssh eform-kio@192.168.1.8 "pm2 restart kio-openclaw"
```

## Cloudflared Split-Brain Warning

Only ONE machine should run cloudflared with the same tunnel ID. If both dev and Pi run it, Meta webhooks randomly split between machines. Stop cloudflared on dev when Pi handles production.

## Verification

```bash
pm2 list                                    # Both processes online
curl http://localhost:3001/api/kiosk/health  # {"status":"ok"}
ss -tlnp | grep 18789                       # OpenClaw gateway listening
sudo systemctl status cloudflared            # active (running)
```

## Rollback to Old System

```bash
pm2 stop all && pm2 delete all
sudo systemctl enable --now pm2-eform-kio.service n8n.service cloudflared.service
mv ~/.config/autostart/kiosk.desktop.disabled ~/.config/autostart/kiosk.desktop
sudo reboot
```

## Common Errors

| Error | Fix |
|-------|-----|
| `MODULE_NOT_FOUND bcrypt` | `npm rebuild bcrypt` (Node version mismatch) |
| `ENOENT agent-comms-schema.sql` | `cp src/database/*.sql dist/database/` |
| `Jarvis migration failed: require is not defined` | Harmless — `.cjs` migration already ran |
| OpenClaw port not listening | Check `pm2 logs kio-openclaw`, restart with `pm2 restart kio-openclaw` |
| EROFS read-only filesystem | OOM caused kernel panic — reboot Pi, check `free -h` |
| Cloudflared tunnel conflict | Stop cloudflared on dev machine |

**Last Updated:** 2026-02-28
