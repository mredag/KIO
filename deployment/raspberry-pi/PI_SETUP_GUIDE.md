# Raspberry Pi Kiosk Setup Guide

## Quick Start

### 1. Prepare the Pi

- Install Raspberry Pi OS 64-bit.
- Complete the first-boot wizard.
- Ensure the user has sudo access.
- Connect the Pi to the network.

### 2. Clone the Repository

```bash
cd ~
git clone <your-repo-url> kio-new
cd kio-new
```

### 3. Run the Installer

```bash
cd ~/kio-new/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

The installer will:
- set the kiosk static IP to `192.168.1.16`
- install Node.js 22, PM2, Chromium, and kiosk dependencies
- configure kiosk autostart
- build backend and frontend from the checked-out repo
- start `kio-backend`
- configure the watchdog and daily DB backups

### 4. Reboot

```bash
sudo reboot
```

## After Installation

Check the main services:

```bash
pm2 status
pm2 logs kio-backend --lines 50
curl http://localhost:3001/api/kiosk/health
```

Expected:
- `kio-backend` is online
- backend health returns `ok`
- Chromium starts automatically after login

## Standard Updates

For normal maintenance on a live Pi:

```bash
cd ~/kio-new/deployment/raspberry-pi
./update-pi.sh
```

Do not do piecemeal `npm install` plus manual PM2 restarts unless you are debugging a failure.

## OpenClaw Runtime

If the Pi also runs OpenClaw:

```bash
cd ~/kio-new
./deployment/raspberry-pi/sync-openclaw-runtime.sh --dry-run
./deployment/raspberry-pi/sync-openclaw-runtime.sh --restart
```

Keep this file machine-local:
- `~/.openclaw/openclaw.json`

## Manual Checks

Backend environment:

```bash
nano ~/kio-new/backend/.env
```

Important values:

```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=../data/kiosk.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

Logs and service control:

```bash
pm2 logs kio-backend
pm2 restart kio-backend
pm2 logs kio-openclaw
pm2 restart kio-openclaw
```

Kiosk display restart:

```bash
pkill chromium || pkill chromium-browser
~/start-kiosk.sh
```

## Backup and Restore

Create a backup:

```bash
~/kio-new/deployment/raspberry-pi/backup-database.sh
```

Restore a backup:

```bash
~/kio-new/deployment/raspberry-pi/restore-backup.sh
```

## Troubleshooting

Backend not starting:

```bash
pm2 logs kio-backend --lines 100
sudo ss -tlnp | grep 3001
```

Chromium not showing:

```bash
ps aux | grep chromium
curl http://localhost:3001/api/kiosk/health
```

Network issue:

```bash
ip addr show
ping 192.168.1.1
sudo systemctl restart dhcpcd
```

## Rules

- Use `update-pi.sh` for routine live updates.
- Do not use `pm2 delete all` during maintenance.
- Do not edit live KB through seed scripts.
- Treat `~/spa-kiosk` as rollback only.