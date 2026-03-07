# Raspberry Pi Installation Checklist

## Before You Start

- [ ] Raspberry Pi OS 64-bit installed
- [ ] Repo cloned to `~/kio-new`
- [ ] User has sudo access
- [ ] Network connectivity works
- [ ] Display is connected

## Fresh Install

```bash
cd ~/kio-new/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
sudo reboot
```

- [ ] Installer completed without errors
- [ ] Pi rebooted successfully

## Core Verification

```bash
pm2 status
pm2 logs kio-backend --lines 20
curl http://localhost:3001/api/kiosk/health
```

- [ ] `kio-backend` is online
- [ ] Backend health returns `ok`
- [ ] Chromium kiosk appears after login
- [ ] Admin page loads at `http://192.168.1.16:3001/admin`

## OpenClaw Verification

```bash
pm2 logs kio-openclaw --lines 20
ss -tlnp | grep 18789
```

- [ ] `kio-openclaw` is online, or intentionally not installed on this Pi
- [ ] Gateway port `18789` is listening when OpenClaw is enabled

## Backup and Maintenance

```bash
crontab -l
~/kio-new/deployment/raspberry-pi/backup-database.sh
~/kio-new/deployment/raspberry-pi/update-pi.sh
```

- [ ] Daily backup cron exists
- [ ] Manual backup succeeds
- [ ] Standard updater runs successfully

## Final Review

- [ ] `~/kio-new` is the active deployment
- [ ] `~/spa-kiosk` is treated as rollback only
- [ ] No one is using `pm2 delete all` in maintenance notes
- [ ] `~/.openclaw/openclaw.json` remains machine-local