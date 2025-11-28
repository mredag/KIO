# Quick Deployment to Raspberry Pi

$PI_HOST = "192.168.1.5"
$PI_USER = "eform-kio"
$PI_PASS = "901801701"

Write-Host "Deploying to Raspberry Pi at $PI_HOST..." -ForegroundColor Green

# Create deployment script on Pi
$deployScript = @'
#!/bin/bash
set -e

echo "=== Installing Node.js ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git chromium-browser unclutter xdotool

echo "=== Installing PM2 ==="
sudo npm install -g pm2

echo "=== Creating app directory ==="
mkdir -p ~/spa-kiosk
cd ~/spa-kiosk

echo "=== Deployment ready ==="
echo "Now copy your files to ~/spa-kiosk"
'@

# Send script to Pi
Write-Host "Sending deployment script..." -ForegroundColor Cyan
$deployScript | ssh $PI_USER@$PI_HOST "cat > ~/deploy-setup.sh && chmod +x ~/deploy-setup.sh"

# Run setup
Write-Host "Running setup on Pi..." -ForegroundColor Cyan
ssh $PI_USER@$PI_HOST "~/deploy-setup.sh"

Write-Host "`nSetup complete! Now copying files..." -ForegroundColor Green
Write-Host "This may take several minutes..." -ForegroundColor Yellow

# Create archive locally
Write-Host "Creating archive..." -ForegroundColor Cyan
if (Test-Path spa-kiosk.zip) { Remove-Item spa-kiosk.zip }

# Use 7zip or built-in compression
$compress = @{
    Path = "backend", "frontend", "package.json", "package-lock.json", "deployment", "data", "public", "README.md"
    DestinationPath = "spa-kiosk.zip"
    CompressionLevel = "Fastest"
}
Compress-Archive @compress

Write-Host "Uploading to Pi..." -ForegroundColor Cyan
scp spa-kiosk.zip ${PI_USER}@${PI_HOST}:~/

Write-Host "Extracting on Pi..." -ForegroundColor Cyan
ssh $PI_USER@$PI_HOST "cd ~ && unzip -o spa-kiosk.zip -d spa-kiosk && rm spa-kiosk.zip"

# Clean up
Remove-Item spa-kiosk.zip

# Build and start
Write-Host "`nBuilding application..." -ForegroundColor Cyan
$buildScript = @'
#!/bin/bash
set -e
cd ~/spa-kiosk

echo "=== Installing root dependencies ==="
npm install

echo "=== Building backend ==="
cd backend
npm install
if [ ! -f .env ]; then
    cp .env.example .env
fi
mkdir -p ../data/backups
npm run build

echo "=== Building frontend ==="
cd ../frontend
npm install
npm run build
rm -rf ../backend/public
cp -r dist ../backend/public

echo "=== Starting with PM2 ==="
cd ../backend
pm2 delete kiosk-backend 2>/dev/null || true
pm2 start npm --name kiosk-backend -- run start
pm2 save
pm2 startup systemd -u eform-kio --hp /home/eform-kio

echo "=== Creating kiosk startup script ==="
cat > ~/start-kiosk.sh << 'EOFKIOSK'
#!/bin/bash
sleep 10
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.1 -root &
while ! curl -s http://localhost:3001/api/kiosk/health > /dev/null; do
    sleep 2
done
chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:3000
EOFKIOSK
chmod +x ~/start-kiosk.sh

mkdir -p ~/.config/autostart
cat > ~/.config/autostart/kiosk.desktop << 'EOFDESK'
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=/home/eform-kio/start-kiosk.sh
X-GNOME-Autostart-enabled=true
EOFDESK

echo "=== Done ==="
pm2 status
'@

$buildScript | ssh $PI_USER@$PI_HOST "cat > ~/build-and-start.sh && chmod +x ~/build-and-start.sh && ~/build-and-start.sh"

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "`nAccess points:" -ForegroundColor Cyan
Write-Host "  Admin: http://$PI_HOST:3001/admin"
Write-Host "  API: http://$PI_HOST:3001/api"
Write-Host "`nTo enable kiosk autostart, reboot the Pi:"
Write-Host "  ssh $PI_USER@$PI_HOST 'sudo reboot'"
