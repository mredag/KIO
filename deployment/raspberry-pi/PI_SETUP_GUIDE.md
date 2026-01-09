# Raspberry Pi Kiosk Setup Guide

## Quick Start

### 1. Fresh Raspberry Pi OS Installation

1. Download Raspberry Pi Imager: https://www.raspberrypi.com/software/
2. Flash Raspberry Pi OS (64-bit, Desktop) to SD card
3. Boot Raspberry Pi and complete initial setup
4. Connect to network (Ethernet recommended)

### 2. One-Command Installation

```bash
# Clone repository
cd ~
git clone <your-repo-url> spa-kiosk
cd spa-kiosk

# Run setup script
chmod +x deployment/setup-raspberry-pi.sh
./deployment/setup-raspberry-pi.sh
```

The script will:
- ✅ Set static IP to 192.168.1.16
- ✅ Install Node.js 20, PM2, Chromium
- ✅ Configure kiosk mode
- ✅ Deploy application
- ✅ Set up auto-start on boot
- ✅ Configure watchdog service
- ✅ Set up automatic backups

### 3. Reboot

```bash
sudo reboot
```

After reboot, the kiosk will start automatically!

---

## Manual Configuration (If Needed)

### Configure Backend Environment

Edit `~/spa-kiosk/backend/.env`:

```bash
nano ~/spa-kiosk/backend/.env
```

Key settings:
```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=../data/kiosk.db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### Update Application

```bash
cd ~/spa-kiosk
./deployment/update-pi.sh
```

---

## Network Configuration

### Static IP: 192.168.1.16

Configuration is in `/etc/dhcpcd.conf`:

```bash
interface eth0
static ip_address=192.168.1.16/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

### Change Static IP

```bash
sudo nano /etc/dhcpcd.conf
# Edit the IP address
sudo reboot
```

---

## Kiosk Management

### PM2 Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs kiosk-backend

# Restart backend
pm2 restart kiosk-backend

# Stop backend
pm2 stop kiosk-backend

# Start backend
pm2 start kiosk-backend
```

### Restart Kiosk Display

```bash
# Kill Chromium
pkill chromium

# Kiosk will auto-restart via watchdog
```

### Manual Kiosk Start

```bash
~/start-kiosk.sh
```

---

## Access Points

### Kiosk Display
- URL: http://localhost:3000
- Auto-starts on boot

### Admin Panel
- URL: http://192.168.1.16:3001/admin
- From any device on network

### Backend API
- URL: http://192.168.1.16:3001/api

---

## Troubleshooting

### Backend Not Starting

```bash
# Check PM2 logs
pm2 logs kiosk-backend

# Check if port is in use
sudo netstat -tulpn | grep 3001

# Restart PM2
pm2 restart kiosk-backend
```

### Kiosk Display Not Showing

```bash
# Check if Chromium is running
ps aux | grep chromium

# Check backend health
curl http://localhost:3001/api/kiosk/health

# Restart kiosk
pkill chromium
~/start-kiosk.sh
```

### Network Issues

```bash
# Check IP configuration
ip addr show

# Test connectivity
ping 192.168.1.1

# Restart network
sudo systemctl restart dhcpcd
```

### Screen Blanking

```bash
# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Make permanent (already in startup script)
```

---

## System Services

### Watchdog Service

Monitors and restarts kiosk if it crashes:

```bash
# Check status
sudo systemctl status kiosk-watchdog

# View logs
sudo journalctl -u kiosk-watchdog -f

# Restart
sudo systemctl restart kiosk-watchdog
```

### Automatic Backups

Daily backups at 2 AM:

```bash
# View cron jobs
crontab -l

# Manual backup
~/spa-kiosk/deployment/raspberry-pi/backup-database.sh

# Backups location
ls -lh ~/spa-kiosk/data/backups/
```

---

## Performance Optimization

### Already Applied by Setup Script

- ✅ GPU memory: 256MB
- ✅ Swap: 2GB
- ✅ Disabled: Bluetooth, Avahi
- ✅ Fast boot enabled
- ✅ Screen blanking disabled

### Monitor Performance

```bash
# CPU/Memory usage
htop

# Disk usage
df -h

# Temperature
vcgencmd measure_temp
```

---

## Updating the Application

### Quick Update

```bash
cd ~/spa-kiosk
./deployment/update-pi.sh
```

### Manual Update

```bash
cd ~/spa-kiosk

# Pull latest code
git pull

# Update backend
cd backend
npm install --production
npm run build
pm2 restart kiosk-backend

# Update frontend
cd ../frontend
npm install
npm run build
rm -rf ../backend/public
cp -r dist ../backend/public
```

---

## Security Recommendations

### Change Default Password

```bash
# Change pi user password
passwd

# Change admin panel password
nano ~/spa-kiosk/backend/.env
# Update ADMIN_PASSWORD
pm2 restart kiosk-backend
```

### Enable Firewall

```bash
sudo apt-get install ufw
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3001/tcp  # Backend
sudo ufw enable
```

### Disable SSH (Optional)

```bash
sudo systemctl disable ssh
sudo systemctl stop ssh
```

---

## Backup and Restore

### Manual Backup

```bash
# Backup database
~/spa-kiosk/deployment/raspberry-pi/backup-database.sh

# Backup entire application
tar -czf ~/spa-kiosk-backup.tar.gz ~/spa-kiosk
```

### Restore Database

```bash
# Copy backup to data directory
cp ~/spa-kiosk/data/backups/kiosk-YYYYMMDD-HHMMSS.db ~/spa-kiosk/data/kiosk.db

# Restart backend
pm2 restart kiosk-backend
```

---

## Hardware Recommendations

### Raspberry Pi 5
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 32GB SD card minimum, 64GB+ recommended
- **Power**: Official 27W USB-C power supply
- **Cooling**: Active cooling recommended for 24/7 operation

### Display
- **Resolution**: 1920x1080 recommended
- **Connection**: HDMI
- **Touch**: Optional (USB touch overlay supported)

### Network
- **Ethernet**: Recommended for stability
- **WiFi**: Supported but Ethernet preferred

---

## Maintenance Schedule

### Daily (Automatic)
- ✅ Database backup (2 AM)
- ✅ Watchdog monitoring

### Weekly
- Check PM2 logs: `pm2 logs kiosk-backend --lines 100`
- Check disk space: `df -h`
- Check temperature: `vcgencmd measure_temp`

### Monthly
- Update system: `sudo apt-get update && sudo apt-get upgrade`
- Update application: `./deployment/update-pi.sh`
- Review backup files: `ls -lh ~/spa-kiosk/data/backups/`

---

## Support

### Logs Location
- Backend logs: `pm2 logs kiosk-backend`
- Watchdog logs: `sudo journalctl -u kiosk-watchdog`
- System logs: `/var/log/syslog`

### Useful Commands
```bash
# System info
uname -a
cat /etc/os-release

# Raspberry Pi info
cat /proc/cpuinfo
vcgencmd get_mem arm
vcgencmd get_mem gpu

# Network info
ip addr show
ip route show
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│ Raspberry Pi Kiosk - Quick Reference            │
├─────────────────────────────────────────────────┤
│ IP Address:    192.168.1.16                     │
│ Admin Panel:   http://192.168.1.16:3001/admin   │
│ Kiosk URL:     http://localhost:3000            │
├─────────────────────────────────────────────────┤
│ Commands:                                       │
│   pm2 status          - Check backend           │
│   pm2 logs            - View logs               │
│   pm2 restart all     - Restart backend         │
│   pkill chromium      - Restart kiosk           │
│   sudo reboot         - Reboot system           │
├─────────────────────────────────────────────────┤
│ Files:                                          │
│   ~/spa-kiosk/        - Application             │
│   ~/start-kiosk.sh    - Kiosk startup           │
│   ~/.config/autostart - Autostart config        │
└─────────────────────────────────────────────────┘
```

Print this and keep it near your Raspberry Pi!
