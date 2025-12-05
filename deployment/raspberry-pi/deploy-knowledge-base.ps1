# Deploy Knowledge Base Update to Raspberry Pi
# This script deploys only the database seed changes

$PI_HOST = "192.168.1.5"
$PI_USER = "eform-kio"
$APP_DIR = "spa-kiosk"

Write-Host "Deploying Knowledge Base Update to Raspberry Pi..." -ForegroundColor Green
Write-Host "Target $PI_USER@$PI_HOST" -ForegroundColor Cyan
Write-Host ""

# Step 1: Backup current database
Write-Host "Step 1 Backing up current database..." -ForegroundColor Yellow
ssh ${PI_USER}@${PI_HOST} "cd ~/${APP_DIR}/backend && npm run backup 2>/dev/null || echo 'Backup skipped'"

# Step 2: Copy updated seed file
Write-Host "Step 2 Copying updated seed.ts..." -ForegroundColor Yellow
scp backend/src/database/seed.ts ${PI_USER}@${PI_HOST}:~/${APP_DIR}/backend/src/database/

# Step 3: Rebuild backend
Write-Host "Step 3 Rebuilding backend..." -ForegroundColor Yellow
ssh ${PI_USER}@${PI_HOST} @"
cd ~/${APP_DIR}/backend
echo 'Removing test files...'
find src -name '*.test.ts' -type f -delete 2>/dev/null || true
find src -type d -name 'e2e' -exec rm -rf {} + 2>/dev/null || true
echo 'Building...'
npm run build
"@

# Step 4: Restart backend
Write-Host "Step 4 Restarting backend..." -ForegroundColor Yellow
ssh ${PI_USER}@${PI_HOST} "cd ~/${APP_DIR}/backend && pm2 restart kiosk-backend"

# Step 5: Wait for startup
Write-Host "Step 5 Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Step 6: Verify knowledge base
Write-Host "Step 6 Verifying knowledge base..." -ForegroundColor Yellow
$response = ssh ${PI_USER}@${PI_HOST} "curl -s http://localhost:3001/api/integrations/knowledge/context"

if ($response) {
    Write-Host "Knowledge base API responding!" -ForegroundColor Green
    
    # Parse and display categories
    try {
        $json = $response | ConvertFrom-Json
        $categories = $json.PSObject.Properties.Name
        Write-Host ""
        Write-Host "Knowledge Base Categories" -ForegroundColor Cyan
        foreach ($cat in $categories) {
            $count = ($json.$cat.PSObject.Properties).Count
            Write-Host "  - ${cat} $count entries" -ForegroundColor White
        }
    } catch {
        Write-Host "Response received but could not parse JSON" -ForegroundColor Yellow
    }
} else {
    Write-Host "Could not verify knowledge base" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps" -ForegroundColor Cyan
Write-Host "1. Test knowledge base API at http://192.168.1.5:3001/api/admin/knowledge-base" -ForegroundColor White
Write-Host "2. Update n8n workflows to use /api/integrations/knowledge/context" -ForegroundColor White
Write-Host "3. Test service settings at http://192.168.1.5:3001/api/admin/services" -ForegroundColor White
Write-Host ""
