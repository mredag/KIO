# Sync Windows Database to Raspberry Pi
# Safely transfers your local database to the Pi

param(
    [string]$PiHost = "192.168.1.5",
    [string]$PiUser = "eform-kio"
)

Write-Host "=== Database Sync to Raspberry Pi ===" -ForegroundColor Cyan
Write-Host ""

# Check if local database exists
if (-not (Test-Path "data/kiosk.db")) {
    Write-Host "ERROR: Local database not found at data/kiosk.db" -ForegroundColor Red
    exit 1
}

# Checkpoint local database
Write-Host "Checkpointing local database..." -ForegroundColor Yellow
node -e "const db = require('better-sqlite3')('./data/kiosk.db'); db.pragma('wal_checkpoint(TRUNCATE)'); console.log('Checkpointed'); db.close();"

# Create backup on Pi first
Write-Host "Creating backup on Pi..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "cd ~/spa-kiosk/deployment/raspberry-pi && bash backup-before-deploy.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create backup on Pi" -ForegroundColor Red
    exit 1
}

# Stop Pi backend
Write-Host "Stopping Pi backend..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "pm2 stop kiosk-backend"

# Copy database to correct location (backend uses backend/data/kiosk.db)
Write-Host "Copying database to Pi..." -ForegroundColor Yellow
scp data/kiosk.db ${PiUser}@${PiHost}:~/spa-kiosk/backend/data/kiosk.db

# Also remove WAL files to prevent corruption
ssh ${PiUser}@${PiHost} "rm -f ~/spa-kiosk/backend/data/kiosk.db-wal ~/spa-kiosk/backend/data/kiosk.db-shm"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to copy database" -ForegroundColor Red
    Write-Host "Restoring from backup..." -ForegroundColor Yellow
    ssh ${PiUser}@${PiHost} "cd ~/spa-kiosk/deployment/raspberry-pi && bash restore-backup.sh"
    exit 1
}

# Start Pi backend
Write-Host "Starting Pi backend..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "pm2 start kiosk-backend"

Start-Sleep -Seconds 5

# Verify
Write-Host "Verifying sync..." -ForegroundColor Yellow
$health = ssh ${PiUser}@${PiHost} "curl -s http://localhost:3001/api/kiosk/health"

if ($health -match "ok") {
    Write-Host ""
    Write-Host "SUCCESS: Database synced to Pi!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pi is now running with your Windows database" -ForegroundColor Cyan
    Write-Host "Access: http://${PiHost}:3001" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Health check failed!" -ForegroundColor Red
    Write-Host "Restoring from backup..." -ForegroundColor Yellow
    ssh ${PiUser}@${PiHost} "cd ~/spa-kiosk/deployment/raspberry-pi && bash restore-backup.sh"
    exit 1
}
