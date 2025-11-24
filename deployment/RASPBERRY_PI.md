# Raspberry Pi Deployment Guide

Deploy the SPA Digital Kiosk on Raspberry Pi OS.

## Prerequisites

1. **Raspberry Pi 3B+ or newer** (4GB RAM recommended)
2. **Raspberry Pi OS** (32-bit or 64-bit)
3. **Node.js 18+**
4. **Chromium browser** (pre-installed on Pi OS)

## Installation

### 1. Install Node.js

```bash
# Check if Node.js is installed
node --version

# If not installed or version < 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone/Copy Project

```bash
cd ~
# If using git
git clone <your-repo-url> spa-digital-kiosk
# Or copy files via USB/network

cd spa-digital-kiosk
```

### 3. Install Dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 4. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### 5. Initialize Database

```bash
cd backend
npm run db:init
npm run db:seed
cd ..
```

## Deployment

### Automated Deployment

```bash
cd deployment
chmod +x *.sh
./deploy-pi.sh
```

This script will:
- Build the frontend
- Initialize the database
- Install PM2 process manager
- Start backend with PM2
- Configure auto-start
- Launch kiosk in fullscreen

### Manual Deployment

#### Start Backend with PM2

```bash
cd deployment
chmod +x start-backend-pm2.sh
./start-backend-pm2.sh
```

#### Start Kiosk

```bash
cd deployment
chmod +x start-kiosk.sh
./start-kiosk.sh
```

## Management Scripts

### Check Status
```bash
pm2 status
pm2 logs kiosk-backend
```

### Restart Backend
```bash
pm2 restart kiosk-backend
```

### Stop Backend
```bash
pm2 stop kiosk-backend
```

### View Logs
```bash
# Real-time logs
pm2 logs kiosk-backend

# Saved logs
tail -f ~/spa-digital-kiosk/logs/backend.log
```

### Backup Database
```bash
cd deployment
./backup-database.sh
```

## Auto-Start on Boot

### Backend Auto-Start (PM2)

```bash
# Save PM2 process list
pm2 save

# Generate startup script
pm2 startup

# Copy and run the command shown
# Example: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi
```

### Kiosk Auto-Start (Desktop)

```bash
# Copy autostart file
mkdir -p ~/.config/autostart
cp deployment/kiosk-autostart.desktop ~/.config/autostart/

# Make executable
chmod +x ~/.config/autostart/kiosk-autostart.desktop
```

Or manually:
1. Edit: `nano ~/.config/lxsession/LXDE-pi/autostart`
2. Add: `@/home/pi/spa-digital-kiosk/deployment/start-kiosk.sh`

## Configuration

### Backend Port
Edit `backend/.env`:
```bash
PORT=3001
```

### Frontend URL
Edit `frontend/.env`:
```bash
VITE_API_URL=http://localhost:3001
```

### Kiosk Display
Edit `deployment/start-kiosk.sh` to customize:
- Screen resolution
- Cursor visibility
- Refresh interval

## Kiosk Mode Settings

The kiosk opens in fullscreen with:
- No address bar or toolbars
- No context menu
- Auto-refresh on errors
- Cursor hidden after 3 seconds
- Screen blanking disabled

To exit kiosk mode: Press `Alt + F4` or `Ctrl + W`

## Troubleshooting

### Port Already in Use
```bash
# Kill node processes
pkill node
sleep 3
# Restart
pm2 restart kiosk-backend
```

### Database Locked
```bash
# Stop backend
pm2 stop kiosk-backend
sleep 3
# Remove WAL files
rm ~/spa-digital-kiosk/data/kiosk.db-wal
rm ~/spa-digital-kiosk/data/kiosk.db-shm
# Restart
pm2 restart kiosk-backend
```

### Frontend Not Loading
```bash
# Rebuild frontend
cd ~/spa-digital-kiosk/frontend
npm run build
# Restart backend
pm2 restart kiosk-backend
```

### Check Logs
```bash
# PM2 logs
pm2 logs kiosk-backend

# Application logs
tail -f ~/spa-digital-kiosk/logs/backend.log
tail -f ~/spa-digital-kiosk/logs/error.log
```

### Chromium Won't Start
```bash
# Check if Chromium is installed
which chromium-browser

# Install if missing
sudo apt-get update
sudo apt-get install -y chromium-browser
```

## Performance Optimization

### Raspberry Pi Settings

```bash
# Increase GPU memory (for better graphics)
sudo raspi-config
# Advanced Options > Memory Split > 256

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable cups

# Set CPU governor to performance
echo "performance" | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### Chromium Flags

Edit `deployment/start-kiosk.sh` and add:
```bash
--disable-features=TranslateUI
--disable-infobars
--disable-suggestions-service
--disable-save-password-bubble
```

### Monitor Resources
```bash
# CPU and memory
htop

# Disk usage
df -h

# Temperature
vcgencmd measure_temp
```

## Watchdog (Auto-Recovery)

### Setup Watchdog

```bash
# Install watchdog script
cd deployment
chmod +x watchdog-kiosk.sh

# Add to crontab
crontab -e

# Add this line (check every 5 minutes)
*/5 * * * * /home/pi/spa-digital-kiosk/deployment/watchdog-kiosk.sh
```

The watchdog will:
- Check if backend is running
- Check if Chromium is running
- Restart if either is down
- Log recovery actions

## Backup

### Manual Backup
```bash
cd deployment
./backup-database.sh
```

Backups saved to: `data/backups/`

### Automated Backup

```bash
# Setup daily backup at 2 AM
crontab -e

# Add this line
0 2 * * * /home/pi/spa-digital-kiosk/deployment/backup-database.sh
```

## Updates

### Update Application
```bash
cd ~/spa-digital-kiosk

# Pull latest code (if using git)
git pull

# Reinstall dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Rebuild frontend
cd frontend
npm run build
cd ..

# Restart backend
pm2 restart kiosk-backend

# Restart kiosk
pkill chromium-browser
sleep 2
cd deployment
./start-kiosk.sh
```

### Update Node.js
```bash
# Update to latest LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
```

## Security

### Change Default Password
1. Open admin panel: `http://localhost:3000/admin`
2. Login with `admin` / `admin123`
3. Go to Settings
4. Change password

### Firewall (UFW)
```bash
# Install UFW
sudo apt-get install -y ufw

# Allow SSH (important!)
sudo ufw allow 22

# Allow backend (if accessing from other devices)
sudo ufw allow 3001

# Enable firewall
sudo ufw enable
```

### SSH Security
```bash
# Change default password
passwd

# Disable password login (use SSH keys)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart ssh
```

## Network Configuration

### Static IP (Optional)
```bash
sudo nano /etc/dhcpcd.conf

# Add at the end:
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

### WiFi Setup
```bash
sudo raspi-config
# System Options > Wireless LAN
```

## Uninstall

```bash
# Stop services
pm2 stop kiosk-backend
pm2 delete kiosk-backend
pm2 save

# Remove auto-start
pm2 unstartup systemd
rm ~/.config/autostart/kiosk-autostart.desktop

# Remove cron jobs
crontab -e
# Delete kiosk-related lines

# Delete project
cd ~
rm -rf spa-digital-kiosk
```

## Support

### Common Issues

**Backend won't start**
- Check logs: `pm2 logs kiosk-backend`
- Check port: `sudo netstat -tulpn | grep 3001`
- Verify Node.js: `node --version`

**Kiosk won't open**
- Check if Chromium is installed: `which chromium-browser`
- Check if backend is running: `curl http://localhost:3001/api/kiosk/health`
- Check display: `echo $DISPLAY` (should be `:0`)

**Database errors**
- Stop backend: `pm2 stop kiosk-backend`
- Remove WAL files: `rm data/kiosk.db-wal data/kiosk.db-shm`
- Restart: `pm2 restart kiosk-backend`

**Screen blanking**
- Edit: `sudo nano /etc/lightdm/lightdm.conf`
- Add under `[Seat:*]`:
  ```
  xserver-command=X -s 0 -dpms
  ```

### Get Help

Check the main README.md for more information.
