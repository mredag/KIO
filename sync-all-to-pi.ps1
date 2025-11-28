# Complete Database Sync to Raspberry Pi
# Syncs massages, surveys, and admin user

param(
    [string]$PiHost = "192.168.1.5",
    [string]$PiUser = "eform-kio"
)

Write-Host "=== Complete Database Sync to Pi ===" -ForegroundColor Cyan
Write-Host ""

# Export all data
Write-Host "Exporting data from Windows..." -ForegroundColor Yellow
node export-massages-sql.cjs
node export-surveys-sql.cjs
node migrate-and-sync.cjs

# Create backup on Pi
Write-Host "Creating backup on Pi..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "cd ~/spa-kiosk/deployment/raspberry-pi && bash backup-before-deploy.sh"

# Stop backend
Write-Host "Stopping Pi backend..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "pm2 stop kiosk-backend"

# Copy SQL files
Write-Host "Copying data files..." -ForegroundColor Yellow
scp massages-import.sql surveys-import.sql import-on-pi.cjs import-surveys-pi.cjs ${PiUser}@${PiHost}:~/spa-kiosk/backend/

# Import data
Write-Host "Importing data on Pi..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "cd ~/spa-kiosk/backend ; node import-on-pi.cjs ; node import-surveys-pi.cjs"

# Start backend
Write-Host "Starting Pi backend..." -ForegroundColor Yellow
ssh ${PiUser}@${PiHost} "pm2 start kiosk-backend"

Start-Sleep -Seconds 5

# Verify
Write-Host "Verifying..." -ForegroundColor Yellow
$health = ssh ${PiUser}@${PiHost} "curl -s http://localhost:3001/api/kiosk/health"

if ($health -match "ok") {
    Write-Host ""
    Write-Host "SUCCESS: All data synced to Pi!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Synced:" -ForegroundColor Cyan
    Write-Host "- 10 massages" -ForegroundColor Cyan
    Write-Host "- 10 surveys" -ForegroundColor Cyan
    Write-Host "- Admin user (admin/admin123)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access: http://${PiHost}:3001" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Health check failed!" -ForegroundColor Red
    exit 1
}
