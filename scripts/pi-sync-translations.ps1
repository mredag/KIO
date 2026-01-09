# Sync Turkish translation updates to Raspberry Pi (PowerShell version)

$PI_USER = "eform-kio"
$PI_HOST = "192.168.1.5"
$PROJECT_DIR = "~/spa-kiosk"

Write-Host "🔄 Syncing Turkish translations to Raspberry Pi..." -ForegroundColor Cyan
Write-Host ""

# Create the SSH command script
$sshScript = @'
set -e

cd ~/spa-kiosk

echo "📥 Pulling latest changes from GitHub..."
git pull origin main

echo ""
echo "📦 Installing dependencies (if needed)..."
cd frontend
npm install --silent

echo ""
echo "🔨 Building frontend with new translations..."
npm run build

echo ""
echo "📋 Copying build to backend public folder..."
rm -rf ../backend/public
cp -r dist ../backend/public

echo ""
echo "🔄 Restarting backend service..."
pm2 restart kiosk-backend

echo ""
echo "⏳ Waiting for service to start..."
sleep 5

echo ""
echo "✅ Checking service status..."
pm2 status kiosk-backend

echo ""
echo "🎉 Translation sync complete!"
echo ""
echo "📊 Testing admin panel..."
curl -s http://localhost:3001/api/kiosk/health | grep -q "ok" && echo "✅ Backend is healthy" || echo "❌ Backend health check failed"

echo ""
echo "🌐 Admin panel available at: http://192.168.1.5:3001/admin"
echo ""
'@

# Execute via SSH
Write-Host "Connecting to Pi..." -ForegroundColor Yellow
ssh "${PI_USER}@${PI_HOST}" $sshScript

Write-Host ""
Write-Host "✨ All done! Turkish translations are now live on the Pi." -ForegroundColor Green
Write-Host ""
