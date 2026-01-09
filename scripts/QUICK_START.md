# Quick Start Guide

## On Raspberry Pi

### First Time Setup
```bash
# Make scripts executable
cd ~/spa-kiosk
chmod +x scripts/*.sh
```

### After Pulling Updates

**Option 1: Full Update** (recommended if unsure)
```bash
./scripts/pi-update.sh
```
Use when:
- Dependencies might have changed
- Major updates
- First time updating

**Option 2: Quick Update** (faster)
```bash
./scripts/pi-quick-update.sh
```
Use when:
- Only code changes
- Bug fixes
- UI updates
- Translation updates

### Common Tasks

**Check if update is needed:**
```bash
cd ~/spa-kiosk
git fetch
git status
```

**View application logs:**
```bash
pm2 logs kiosk-backend
```

**Restart application:**
```bash
pm2 restart kiosk-backend
```

**Check application status:**
```bash
pm2 status
curl http://localhost:3001/api/kiosk/health
```

## On Development Machine (Windows)

### Deploy to Pi
```powershell
.\scripts\deploy\deploy-to-pi.ps1
```

### Sync Database to Pi
```powershell
.\scripts\sync\sync-db-to-pi.ps1
```

### Check Pi Database
```powershell
node scripts/db/check-pi-db.cjs
```

### Export Data
```powershell
node scripts/data/export-all-data.cjs
```

## Troubleshooting

### Update fails
```bash
# Check PM2 logs
pm2 logs kiosk-backend --lines 50

# Try manual restart
pm2 restart kiosk-backend

# If still failing, check build errors
cd ~/spa-kiosk/backend
npm run build
```

### Service won't start
```bash
# Check PM2 status
pm2 status

# Delete and recreate PM2 process
pm2 delete kiosk-backend
cd ~/spa-kiosk/backend
pm2 start npm --name kiosk-backend -- run start
pm2 save
```

### Database issues
```bash
# Check database
node scripts/db/check-pi-db.cjs

# Fix database
node scripts/db/fix-pi-database.cjs
```

## Update Frequency

- **After every git pull**: Run update script
- **Daily**: Check PM2 status
- **Weekly**: Check logs for errors
- **Monthly**: Review disk space and backups
