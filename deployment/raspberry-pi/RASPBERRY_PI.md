# Raspberry Pi Deployment Guide

Complete guide for deploying the SPA Digital Kiosk on Raspberry Pi OS.

## 🚀 Quick Start (Recommended)

**For fresh Raspberry Pi 5 with Raspberry Pi OS:**

```bash
cd ~/spa-kiosk/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

This automated script handles everything:
- ✅ Set static IP to 192.168.1.16
- ✅ Install Node.js 20, PM2, Chromium
- ✅ Configure kiosk mode with auto-start
- ✅ Deploy the application
- ✅ Set up watchdog service
- ✅ Configure automatic backups

**After installation:** Reboot and the kiosk starts automatically!

**For detailed instructions:** See [PI_SETUP_GUIDE.md](PI_SETUP_GUIDE.md)

**For verification:** Use [PI_INSTALLATION_CHECKLIST.md](PI_INSTALLATION_CHECKLIST.md)

---

## Prerequisites

- **Raspberry Pi 3B+ or newer** (Pi 5 recommended, 4GB+ RAM)
- **Raspberry Pi OS** (64-bit recommended)
- **Fresh installation** (or backup existing data)
- **Network connection** (Ethernet recommended)

---

## Management

### PM2 Commands

```bash
pm2 status                    # Check backend status
pm2 logs kiosk-backend        # View logs
pm2 restart kiosk-backend     # Restart backend
pm2 stop kiosk-backend        # Stop backend
```

### Kiosk Control

```bash
pkill chromium                # Restart kiosk (auto-restarts via watchdog)
~/start-kiosk.sh              # Manual kiosk start
```

### Updates

```bash
cd ~/spa-kiosk/deployment/raspberry-pi
./update-pi.sh                # Update to latest version
```

### Backups

```bash
./backup-database.sh          # Manual backup
crontab -l                    # View scheduled backups (daily 2 AM)
```

---

## Configuration

### Backend Environment

Edit `~/spa-kiosk/backend/.env`:

```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=../data/kiosk.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

After changes: `pm2 restart kiosk-backend`

### Static IP

Default: **192.168.1.16**

To change:
```bash
sudo nano /etc/dhcpcd.conf
# Edit IP address
sudo reboot
```

### Kiosk Display

Edit `~/start-kiosk.sh` to customize Chromium flags.

---

## Troubleshooting

### Backend Not Starting

```bash
pm2 logs kiosk-backend                    # Check logs
sudo netstat -tulpn | grep 3001           # Check port
pm2 restart kiosk-backend                 # Restart
```

### Kiosk Not Displaying

```bash
ps aux | grep chromium                    # Check if running
curl http://localhost:3001/api/kiosk/health  # Check backend
~/start-kiosk.sh                          # Manual start
```

### Database Issues

```bash
pm2 stop kiosk-backend
rm ~/spa-kiosk/data/kiosk.db-wal
rm ~/spa-kiosk/data/kiosk.db-shm
pm2 restart kiosk-backend
```

### Network Issues

```bash
ip addr show                              # Check IP
ping 192.168.1.1                          # Test router
sudo systemctl restart dhcpcd             # Restart network
```

### Screen Blanking

```bash
xset s off
xset -dpms
xset s noblank
```

---

## Performance Optimization

### Monitor Resources

```bash
htop                          # CPU/Memory
df -h                         # Disk usage
vcgencmd measure_temp         # Temperature
```

### Optimizations (Applied by Setup Script)

- ✅ GPU memory: 256MB
- ✅ Swap: 2GB
- ✅ Disabled: Bluetooth, Avahi
- ✅ Fast boot enabled
- ✅ Screen blanking disabled

### Additional Tweaks

```bash
# CPU governor to performance
echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Disable more services
sudo systemctl disable cups
```

---

## Security

### Change Passwords

```bash
passwd                                    # Change pi user password
nano ~/spa-kiosk/backend/.env             # Change admin password
pm2 restart kiosk-backend
```

### Firewall

```bash
sudo apt-get install ufw
sudo ufw allow 22/tcp                     # SSH
sudo ufw allow 3001/tcp                   # Backend
sudo ufw enable
```

### SSH Security

```bash
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart ssh
```

---

## System Services

### Watchdog Service

Monitors and restarts kiosk if crashed:

```bash
sudo systemctl status kiosk-watchdog      # Check status
sudo journalctl -u kiosk-watchdog -f      # View logs
sudo systemctl restart kiosk-watchdog     # Restart
```

### Automatic Backups

Daily at 2 AM:

```bash
crontab -l                                # View schedule
~/spa-kiosk/deployment/raspberry-pi/backup-database.sh  # Manual backup
ls -lh ~/spa-kiosk/data/backups/          # View backups
```

---

## Hardware Recommendations

### Raspberry Pi 5
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 32GB SD card minimum, 64GB+ recommended
- **Power**: Official 27W USB-C power supply
- **Cooling**: Active cooling for 24/7 operation

### Display
- **Resolution**: 1920x1080 recommended
- **Connection**: HDMI
- **Touch**: Optional USB touch overlay

### Network
- **Ethernet**: Recommended for stability
- **WiFi**: Supported but Ethernet preferred

---

## Maintenance Schedule

### Daily (Automatic)
- Database backup (2 AM)
- Watchdog monitoring

### Weekly
```bash
pm2 logs kiosk-backend --lines 100        # Check logs
df -h                                     # Check disk space
vcgencmd measure_temp                     # Check temperature
```

### Monthly
```bash
sudo apt-get update && sudo apt-get upgrade  # Update system
./update-pi.sh                            # Update application
ls -lh ~/spa-kiosk/data/backups/          # Review backups
```

---

## Uninstall

```bash
pm2 stop kiosk-backend
pm2 delete kiosk-backend
pm2 save
pm2 unstartup systemd
rm ~/.config/autostart/kiosk.desktop
crontab -e  # Remove backup cron job
cd ~ && rm -rf spa-kiosk
```

---

## Access Points

- **Kiosk Display**: http://localhost:3000 (auto-starts)
- **Admin Panel**: http://192.168.1.16:3001/admin (from network)
- **Backend API**: http://192.168.1.16:3001/api

---

## Support

### Documentation
- [PI_SETUP_GUIDE.md](PI_SETUP_GUIDE.md) - Detailed setup & troubleshooting
- [PI_INSTALLATION_CHECKLIST.md](PI_INSTALLATION_CHECKLIST.md) - Verification checklist
- [Main README](../../README.md) - Project overview

### Logs
```bash
pm2 logs kiosk-backend                    # Backend logs
sudo journalctl -u kiosk-watchdog         # Watchdog logs
tail -f ~/spa-kiosk/logs/backend.log      # Application logs
```

### System Info
```bash
uname -a                                  # System info
cat /proc/cpuinfo                         # CPU info
vcgencmd get_mem arm && vcgencmd get_mem gpu  # Memory info
```
