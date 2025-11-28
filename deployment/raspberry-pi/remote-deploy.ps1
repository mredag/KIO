# Remote Deployment Script for Raspberry Pi (PowerShell)
# Connects to Raspberry Pi and deploys the application

$PI_HOST = "192.168.1.5"
$PI_USER = "eform-kio"
$PI_PASSWORD = "901801701"
$APP_DIR = "spa-kiosk"

Write-Host "🚀 Starting remote deployment to Raspberry Pi..." -ForegroundColor Green
Write-Host "Target: $PI_USER@$PI_HOST"
Write-Host ""

# Check if plink (PuTTY) is available
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue
$pscpPath = Get-Command pscp -ErrorAction SilentlyContinue

if (-not $plinkPath -or -not $pscpPath) {
    Write-Host "❌ PuTTY tools (plink/pscp) not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PuTTY from: https://www.putty.org/" -ForegroundColor Yellow
    Write-Host "Or use the manual deployment steps below:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual Deployment Steps:" -ForegroundColor Cyan
    Write-Host "1. Use WinSCP or FileZilla to copy project files to Pi" -ForegroundColor White
    Write-Host "2. SSH to Pi: ssh $PI_USER@$PI_HOST" -ForegroundColor White
    Write-Host "3. Run: cd ~/spa-kiosk/deployment/raspberry-pi" -ForegroundColor White
    Write-Host "4. Run: chmod +x setup-raspberry-pi.sh" -ForegroundColor White
    Write-Host "5. Run: ./setup-raspberry-pi.sh" -ForegroundColor White
    Write-Host "6. Reboot: sudo reboot" -ForegroundColor White
    exit 1
}

# Test connection
Write-Host "📡 Testing SSH connection..." -ForegroundColor Cyan
$testCmd = "echo 'Connection successful!'"
$result = echo y | plink -ssh -pw $PI_PASSWORD $PI_USER@$PI_HOST $testCmd 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to connect to Raspberry Pi" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  - IP address: $PI_HOST"
    Write-Host "  - Username: $PI_USER"
    Write-Host "  - Password"
    Write-Host "  - Network connection"
    exit 1
}

Write-Host "✅ Connection successful!" -ForegroundColor Green
Write-Host ""

# Create app directory on Pi
Write-Host "📁 Creating application directory..." -ForegroundColor Cyan
echo y | plink -ssh -pw $PI_PASSWORD $PI_USER@$PI_HOST "mkdir -p ~/$APP_DIR"

Write-Host "✅ Directory created!" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Copying project files to Raspberry Pi..." -ForegroundColor Cyan
Write-Host "This may take several minutes..." -ForegroundColor Yellow
Write-Host ""

# Copy files using pscp
$sourceDir = Join-Path $PSScriptRoot "../.."
$excludePatterns = @(
    "node_modules",
    "dist",
    ".git",
    "data/kiosk.db*",
    "backend/test-kiosk.db",
    "logs",
    ".kiro",
    "*.log",
    "my-app-screenshots",
    "backend/screenshots"
)

Write-Host "Note: For large projects, consider using WinSCP for better progress tracking" -ForegroundColor Yellow
Write-Host ""

# Use pscp to copy files
pscp -r -pw $PI_PASSWORD $sourceDir/* ${PI_USER}@${PI_HOST}:~/$APP_DIR/

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  File copy may have encountered issues" -ForegroundColor Yellow
    Write-Host "Consider using WinSCP for a more reliable transfer" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ Files copied!" -ForegroundColor Green
Write-Host ""

# Run setup script on Pi
Write-Host "🔧 Running setup script on Raspberry Pi..." -ForegroundColor Cyan
Write-Host "This will install Node.js, PM2, and configure the system..." -ForegroundColor Yellow
Write-Host ""

$setupCommands = @"
cd ~/spa-kiosk/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
"@

echo y | plink -ssh -pw $PI_PASSWORD $PI_USER@$PI_HOST $setupCommands

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Reboot the Raspberry Pi" -ForegroundColor White
Write-Host "2. After reboot, the kiosk will start automatically" -ForegroundColor White
Write-Host "3. Access admin panel: http://${PI_HOST}:3001/admin" -ForegroundColor White
Write-Host ""
Write-Host "🔍 To check status:" -ForegroundColor Cyan
Write-Host "   ssh ${PI_USER}@${PI_HOST}" -ForegroundColor White
Write-Host "   pm2 status" -ForegroundColor White
Write-Host ""
