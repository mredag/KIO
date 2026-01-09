# Raspberry Pi Deployment

Complete deployment solution for Raspberry Pi kiosk systems.

## 🚀 Quick Start

### One-Command Setup (Recommended)

For a fresh Raspberry Pi 5 with Raspberry Pi OS:

```bash
cd ~/spa-kiosk/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

This will automatically:
- ✅ Set static IP to 192.168.1.16
- ✅ Install Node.js 20, PM2, Chromium
- ✅ Configure kiosk mode with auto-start
- ✅ Deploy the application
- ✅ Set up watchdog service
- ✅ Configure automatic backups

After installation, reboot and the kiosk starts automatically!

---

## 📚 Documentation

### Setup Guides
- **[RASPBERRY_PI.md](RASPBERRY_PI.md)** - Complete deployment guide (manual + automated)
- **[PI_SETUP_GUIDE.md](PI_SETUP_GUIDE.md)** - Detailed setup instructions and troubleshooting
- **[PI_INSTALLATION_CHECKLIST.md](PI_INSTALLATION_CHECKLIST.md)** - Step-by-step verification checklist

### Scripts

#### Setup & Deployment
- **setup-raspberry-pi.sh** - Automated one-command installer
- **deploy-pi.sh** - Manual deployment script
- **update-pi.sh** - Update application to latest version

#### Kiosk Management
- **start-kiosk.sh** - Start kiosk in fullscreen mode
- **start-backend-pm2.sh** - Start backend with PM2
- **watchdog-kiosk.sh** - Monitor and restart kiosk if crashed

#### Maintenance
- **backup-database.sh** - Backup database manually

#### Configuration
- **ecosystem.config.js** - PM2 configuration
- **kiosk-autostart.desktop** - Auto-start configuration

---

## 📋 File Overview

```
raspberry-pi/
├── README.md                          # This file
├── RASPBERRY_PI.md                    # Complete deployment guide
├── PI_SETUP_GUIDE.md                  # Detailed setup & troubleshooting
├── PI_INSTALLATION_CHECKLIST.md       # Installation checklist
│
├── setup-raspberry-pi.sh              # 🚀 One-command installer
├── update-pi.sh                       # Update script
├── deploy-pi.sh                       # Manual deployment
│
├── start-kiosk.sh                     # Start kiosk display
├── start-backend-pm2.sh               # Start backend with PM2
├── watchdog-kiosk.sh                  # Watchdog service
├── backup-database.sh                 # Database backup
│
├── ecosystem.config.js                # PM2 config
└── kiosk-autostart.desktop            # Auto-start config
```

---

## 🎯 Common Tasks

### Initial Setup
```bash
./setup-raspberry-pi.sh
sudo reboot
```

### Update Application
```bash
./update-pi.sh
```

### Manual Backup
```bash
./backup-database.sh
```

### Check Status
```bash
pm2 status
pm2 logs kiosk-backend
```

### Restart Services
```bash
pm2 restart kiosk-backend
pkill chromium  # Kiosk will auto-restart
```

---

## 🔧 Configuration

### Static IP
Default: **192.168.1.16**

To change, edit `/etc/dhcpcd.conf` after installation.

### Ports
- Frontend: **3000** (served by backend)
- Backend: **3001**

### Auto-Start
- Backend: PM2 (starts on boot)
- Kiosk: Desktop autostart (starts after login)

---

## 📞 Support

### Quick Reference
- **IP Address:** 192.168.1.16
- **Admin Panel:** http://192.168.1.16:3001/admin
- **Kiosk URL:** http://localhost:3000

### Troubleshooting
See [PI_SETUP_GUIDE.md](PI_SETUP_GUIDE.md) for detailed troubleshooting steps.

### Logs
```bash
pm2 logs kiosk-backend              # Backend logs
sudo journalctl -u kiosk-watchdog   # Watchdog logs
```

---

## 🔗 Related Documentation

- [Main README](../../README.md)
- [Windows Deployment](../WINDOWS.md)
- [Deployment Overview](../README.md)
