# Deployment Guide

Simple deployment instructions for Windows and Raspberry Pi.

## Quick Start

### Windows
```bash
cd deployment
windows-deploy.bat
```

### Raspberry Pi
```bash
cd deployment
chmod +x *.sh
./deploy-pi.sh
```

## Platform-Specific Guides

- [Windows Deployment](WINDOWS.md) - For Windows 10/11 kiosk systems
- [Raspberry Pi Deployment](RASPBERRY_PI.md) - For Raspberry Pi kiosk systems

## What Gets Deployed

- Backend API server (Node.js/Express)
- Frontend web app (React/Vite)
- SQLite database with initial data
- Media files and uploads directory
- Automated startup scripts
- Log rotation and monitoring

## Default Ports

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Default Credentials

- Username: `admin`
- Password: `admin123`

**⚠️ Change these immediately after first login!**

## Support

For issues, check the troubleshooting section in your platform-specific guide.
