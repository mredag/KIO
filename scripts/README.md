# Scripts Directory

Utility scripts for managing the SPA Kiosk application.

## Raspberry Pi Scripts

### Update Scripts

**`pi-update.sh`** - Full update process
- Pulls latest code
- Checks and installs dependencies if needed
- Rebuilds backend and frontend
- Restarts PM2 service
- Verifies deployment

Usage:
```bash
cd ~/spa-kiosk
./scripts/pi-update.sh
```

**`pi-quick-update.sh`** - Quick update (no dependency check)
- Pulls latest code
- Rebuilds backend and frontend
- Restarts service

Usage:
```bash
cd ~/spa-kiosk
./scripts/pi-quick-update.sh
```

### Database Scripts

**`db/check-db.cjs`** - Check local database contents
```bash
node scripts/db/check-db.cjs
```

**`db/check-pi-db.cjs`** - Check Raspberry Pi database contents
```bash
node scripts/db/check-pi-db.cjs
```

**`db/check-pi-settings.cjs`** - Check Pi system settings
```bash
node scripts/db/check-pi-settings.cjs
```

**`db/checkpoint-pi-db.cjs`** - Create database checkpoint
```bash
node scripts/db/checkpoint-pi-db.cjs
```

**`db/fix-pi-database.cjs`** - Fix database issues
```bash
node scripts/db/fix-pi-database.cjs
```

**`db/init-pi-db.cjs`** - Initialize Pi database
```bash
node scripts/db/init-pi-db.cjs
```

### Data Management Scripts

**`data/export-all-data.cjs`** - Export all data
```bash
node scripts/data/export-all-data.cjs
```

**`data/export-massages-sql.cjs`** - Export massages as SQL
```bash
node scripts/data/export-massages-sql.cjs
```

**`data/export-surveys-sql.cjs`** - Export surveys as SQL
```bash
node scripts/data/export-surveys-sql.cjs
```

**`data/import-massages.js`** - Import massages
```bash
node scripts/data/import-massages.js
```

**`data/import-on-pi.cjs`** - Import data on Pi
```bash
node scripts/data/import-on-pi.cjs
```

**`data/import-settings-pi.cjs`** - Import settings to Pi
```bash
node scripts/data/import-settings-pi.cjs
```

**`data/import-surveys-pi.cjs`** - Import surveys to Pi
```bash
node scripts/data/import-surveys-pi.cjs
```

**`data/compare-surveys.cjs`** - Compare survey data
```bash
node scripts/data/compare-surveys.cjs
```

### Sync Scripts

**`sync/migrate-and-sync.cjs`** - Migrate and sync data
```bash
node scripts/sync/migrate-and-sync.cjs
```

**`sync/sync-db-to-pi.ps1`** - Sync database to Pi (PowerShell)
```powershell
.\scripts\sync\sync-db-to-pi.ps1
```

**`sync/sync-all-to-pi.ps1`** - Sync everything to Pi (PowerShell)
```powershell
.\scripts\sync\sync-all-to-pi.ps1
```

### Admin Scripts

**`admin/create-admin.cjs`** - Create admin user
```bash
node scripts/admin/create-admin.cjs
```

**`admin/update-pi-settings.cjs`** - Update Pi settings
```bash
node scripts/admin/update-pi-settings.cjs
```

### Deployment Scripts

**`deploy/deploy-to-pi.ps1`** - Deploy to Pi (PowerShell)
```powershell
.\scripts\deploy\deploy-to-pi.ps1
```

**`deploy/setup-ssh-key.ps1`** - Setup SSH key (PowerShell)
```powershell
.\scripts\deploy\setup-ssh-key.ps1
```

## Making Scripts Executable

For bash scripts on Linux/Mac/Pi:
```bash
chmod +x scripts/*.sh
chmod +x scripts/**/*.sh
```

## Script Organization

```
scripts/
├── README.md              # This file
├── pi-update.sh          # Full Pi update
├── pi-quick-update.sh    # Quick Pi update
├── db/                   # Database utilities
├── data/                 # Data import/export
├── sync/                 # Sync utilities
├── admin/                # Admin utilities
└── deploy/               # Deployment scripts
```
