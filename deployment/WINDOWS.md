# Windows Deployment Guide

Deploy the SPA Digital Kiosk on Windows 10/11.

## Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Git** (optional) - [Download](https://git-scm.com/)

## Installation

### 1. Install Dependencies

```bash
# From project root
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### 3. Initialize Database

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
windows-deploy.bat
```

This script will:
- Build the frontend
- Initialize the database
- Start the backend server
- Open the kiosk in fullscreen

### Manual Deployment

#### Start Backend
```bash
cd deployment
start-backend.bat
```

#### Start Kiosk (Chrome)
```bash
cd deployment
start-kiosk-chrome.bat
```

#### Start Kiosk (Edge)
```bash
cd deployment
start-kiosk-edge.bat
```

## Management Scripts

### Check Status
```bash
cd deployment
check-status.bat
```

### View Logs
```bash
cd deployment
view-logs.bat
```

### Restart Backend
```bash
cd deployment
restart-backend.bat
```

### Stop Backend
```bash
cd deployment
stop-backend.bat
```

### Backup Database
```bash
cd deployment
backup-database.bat
```

## Auto-Start on Boot

### Option 1: Task Scheduler (Recommended)

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Kiosk Backend"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `C:\path\to\deployment\start-backend.bat`
7. Create another task for kiosk:
   - Name: "Kiosk Frontend"
   - Trigger: "At log on"
   - Program: `C:\path\to\deployment\start-kiosk-chrome.bat`

### Option 2: Startup Folder

1. Press `Win + R`
2. Type: `shell:startup`
3. Create shortcuts to:
   - `deployment/start-backend.bat`
   - `deployment/start-kiosk-chrome.bat`

## Configuration

### Backend Port
Edit `backend/.env`:
```
PORT=3001
```

### Frontend URL
Edit `frontend/.env`:
```
VITE_API_URL=http://localhost:3001
```

## Kiosk Mode Settings

The kiosk opens in fullscreen with:
- No address bar
- No toolbars
- No context menu
- Auto-refresh on errors
- Cursor hidden after 3 seconds

To exit kiosk mode: Press `Alt + F4`

## Troubleshooting

### Port Already in Use
```bash
# Kill all node processes
taskkill /F /IM node.exe
timeout /t 3
# Restart backend
cd deployment
start-backend.bat
```

### Database Locked
```bash
# Stop backend first
cd deployment
stop-backend.bat
timeout /t 3
# Restart
start-backend.bat
```

### Frontend Not Loading
```bash
# Rebuild frontend
cd frontend
npm run build
cd ../deployment
restart-backend.bat
```

### Check Logs
```bash
# Backend logs
type ..\logs\backend.log

# Error logs
type ..\logs\error.log
```

## Updates

### Update Application
```bash
# Pull latest code (if using git)
git pull

# Reinstall dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Rebuild and restart
cd deployment
windows-deploy.bat
```

### Update Database Schema
```bash
cd backend
npm run db:migrate
cd ..
```

## Security

### Change Default Password
1. Open admin panel: `http://localhost:3000/admin`
2. Login with `admin` / `admin123`
3. Go to Settings
4. Change password

### Firewall Rules
If accessing from other devices:
1. Open Windows Firewall
2. Allow inbound on port 3001 (backend)
3. Allow inbound on port 3000 (frontend)

## Performance

### Optimize for Kiosk
- Disable Windows updates during business hours
- Disable sleep mode
- Set power plan to "High Performance"
- Disable screen saver

### Monitor Resources
```bash
# Check CPU/Memory usage
tasklist /FI "IMAGENAME eq node.exe"
```

## Backup

### Manual Backup
```bash
cd deployment
backup-database.bat
```

Backups saved to: `data/backups/`

### Automated Backup
Use Task Scheduler to run `backup-database.bat` daily.

## Uninstall

```bash
# Stop services
cd deployment
stop-backend.bat

# Remove auto-start (if configured)
# Delete from Task Scheduler or Startup folder

# Delete project folder
cd ../..
rmdir /s spa-digital-kiosk
```

## Support

### Common Issues

**Backend won't start**
- Check if port 3001 is available
- Check logs in `logs/error.log`
- Verify Node.js is installed: `node --version`

**Kiosk won't open**
- Check if Chrome/Edge is installed
- Try the other browser script
- Check if backend is running: `http://localhost:3001/api/kiosk/health`

**Database errors**
- Stop backend
- Delete `data/kiosk.db-wal` and `data/kiosk.db-shm`
- Restart backend

### Get Help

Check the main README.md for more information.
