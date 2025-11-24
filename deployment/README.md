# Deployment Guide

Simple deployment instructions for Windows and Raspberry Pi.

## 🚀 Quick Start

### Raspberry Pi (Recommended)

**One-command automated setup:**
```bash
cd deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
```

See **[raspberry-pi/](raspberry-pi/)** folder for complete Raspberry Pi deployment.

### Windows

```bash
cd deployment
windows-deploy.bat
```

---

## 📁 Directory Structure

```
deployment/
├── raspberry-pi/          # 🍓 Complete Raspberry Pi solution
│   ├── setup-raspberry-pi.sh
│   ├── update-pi.sh
│   ├── RASPBERRY_PI.md
│   ├── PI_SETUP_GUIDE.md
│   ├── PI_INSTALLATION_CHECKLIST.md
│   └── ... (all Pi scripts & configs)
│
├── windows-deploy.bat     # 🪟 Windows deployment
├── WINDOWS.md             # Windows guide
├── *.bat                  # Windows scripts
└── README.md              # This file
```

---

## 📚 Platform-Specific Guides

### 🍓 Raspberry Pi
**[raspberry-pi/](raspberry-pi/)** - Complete Raspberry Pi deployment solution
- ✅ Automated one-command setup
- ✅ Manual deployment options
- ✅ Update scripts
- ✅ Watchdog service
- ✅ Auto-start configuration
- ✅ Automatic backups

**Key Files:**
- `setup-raspberry-pi.sh` - One-command installer
- `RASPBERRY_PI.md` - Complete guide
- `PI_SETUP_GUIDE.md` - Detailed instructions
- `PI_INSTALLATION_CHECKLIST.md` - Verification checklist

### 🪟 Windows
**[WINDOWS.md](WINDOWS.md)** - Windows 10/11 kiosk deployment guide
- Manual deployment steps
- Kiosk mode configuration
- Startup scripts

---

## 🎯 What Gets Deployed

- Backend API server (Node.js/Express)
- Frontend web app (React/Vite)
- SQLite database with initial data
- Media files and uploads directory
- Automated startup scripts
- Log rotation and monitoring
- PM2 process manager (Raspberry Pi)
- Watchdog service (Raspberry Pi)
- Automatic backups (Raspberry Pi)

---

## 🔧 Default Configuration

### Ports
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

### Credentials
- Username: `admin`
- Password: `admin123`

**⚠️ Change these immediately after first login!**

### Raspberry Pi Static IP
- Default: `192.168.1.16`
- Configurable in setup script

---

## 📞 Support

### Raspberry Pi
See [raspberry-pi/PI_SETUP_GUIDE.md](raspberry-pi/PI_SETUP_GUIDE.md) for:
- Detailed troubleshooting
- Common issues and solutions
- Performance optimization
- Maintenance guide

### Windows
See [WINDOWS.md](WINDOWS.md) for Windows-specific troubleshooting.

### General
Check the main [README.md](../README.md) for project overview and architecture.
