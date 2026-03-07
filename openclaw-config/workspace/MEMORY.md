# MEMORY — Jarvis

## System
- Project: Eform Spor Merkezi (spa & fitness, İskenderun, Hatay)
- Production: Raspberry Pi 5 (192.168.1.8, Node 22.22.0, Debian 13)
  - Backend: PM2 kio-backend, port 3001
  - OpenClaw: PM2 kio-openclaw, port 18789
  - Cloudflared: systemd, tunnel webhook.eformspa.com → localhost:3001
  - Codebase: `/home/eform-kio/kio-new/`
  - Database: `/home/eform-kio/kio-new/data/kiosk.db`
- Dev: Windows 11, Node 18 (fnm) + Node 25 (system)
  - Codebase: `D:\PERSONEL\Eform-Resepsion-Kiosk-ClawBot`
  - Database: `backend\data\kiosk.db`
- Old system: `~/spa-kiosk/` on Pi (untouched rollback)

## Team
| Agent | Role | Model |
|-------|------|-------|
| forge | Senior Developer | GPT-5.3 Codex (openai-codex) |
| instagram | DM Specialist | Kimi K2 |

## Key Learnings
- web_fetch BLOCKED for localhost — use exec + curl/Invoke-RestMethod
- Pi uses Node 22 for everything; Windows uses fnm Node 18 for backend
- Full tsc build: `npx tsc -p tsconfig.build.json` then `cp src/database/*.sql dist/database/`
- Instagram DMs: just output Turkish text, backend handles send/log
- Meta IGAA tokens require graph.instagram.com (not graph.facebook.com)
- OpenClaw heartbeat target = "none" (prevents session pollution)
- Telegram 409 conflict: OpenClaw and TelegramCallbackPoller share bot token — poller auto-defers
- Codex OAuth tokens expire ~10 days — refresh token should auto-renew
- Sub-agents have NO direct DB access — must use HTTP API with X-API-Key header
- mc_jobs table uses `payload` column (JSON), NOT `description` or `metadata`
- Timestamps: always `new Date().toISOString()`, never SQLite `datetime('now')`

## Recent Events
_(Updated automatically during sessions)_
