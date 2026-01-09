# Deploy AI Automation Workflows to Raspberry Pi n8n
# Task 13.1: Deploy workflows to Raspberry Pi n8n
# Requirements: All

param(
    [string]$PiHost = "192.168.1.5",
    [string]$PiUser = "eform-kio"
)

$ErrorActionPreference = "Stop"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkflowDir = Join-Path $ScriptDir "..\workflows-v2"
$TemplateDir = Join-Path $ScriptDir "..\templates"
$RemoteDir = "/home/$PiUser/n8n-workflows"

Write-Host "=== n8n AI Automation Deployment ===" -ForegroundColor Green
Write-Host "Target: $PiUser@$PiHost"
Write-Host ""

# Check SSH connectivity
Write-Host "Checking SSH connectivity..." -ForegroundColor Yellow
try {
    $result = ssh -o ConnectTimeout=5 "$PiUser@$PiHost" "echo Connected" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SSH failed" }
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Cannot connect to $PiHost" -ForegroundColor Red
    Write-Host "Make sure the Raspberry Pi is online and SSH is enabled."
    exit 1
}

# Create remote directory
Write-Host "Creating remote directory..." -ForegroundColor Yellow
ssh "$PiUser@$PiHost" "mkdir -p $RemoteDir"

# Workflows to deploy
$Workflows = @(
    "whatsapp-ai-integrated.json"
)

$Templates = @(
    "daily-summary.json",
    "sentiment-analysis.json", 
    "survey-webhook-integration.json"
)

# Copy workflow files
Write-Host "Copying workflow files..." -ForegroundColor Yellow
foreach ($wf in $Workflows) {
    $path = Join-Path $WorkflowDir $wf
    if (Test-Path $path) {
        Write-Host "  Copying $wf..."
        scp $path "${PiUser}@${PiHost}:${RemoteDir}/"
    } else {
        Write-Host "  WARNING: $wf not found" -ForegroundColor Red
    }
}

foreach ($tpl in $Templates) {
    $path = Join-Path $TemplateDir $tpl
    if (Test-Path $path) {
        Write-Host "  Copying $tpl..."
        scp $path "${PiUser}@${PiHost}:${RemoteDir}/"
    } else {
        Write-Host "  WARNING: $tpl not found" -ForegroundColor Red
    }
}
Write-Host "✓ Files copied" -ForegroundColor Green

# Deactivate existing workflows
Write-Host "Deactivating existing workflows..." -ForegroundColor Yellow
ssh "$PiUser@$PiHost" "n8n update:workflow --all --active=false 2>/dev/null; exit 0"

# Import workflows
Write-Host "Importing workflows..." -ForegroundColor Yellow
ssh "$PiUser@$PiHost" @"
cd ~/n8n-workflows
for f in *.json; do
    if [ -f "\$f" ]; then
        echo "  Importing \$f..."
        n8n import:workflow --input="\$f" 2>/dev/null || echo "    Warning: Import may have failed"
    fi
done
"@

# Activate workflows
Write-Host "Activating workflows..." -ForegroundColor Yellow
ssh "$PiUser@$PiHost" "n8n update:workflow --all --active=true 2>/dev/null; exit 0"

# Restart n8n
Write-Host "Restarting n8n service..." -ForegroundColor Yellow
ssh "$PiUser@$PiHost" "sudo systemctl restart n8n"

# Wait for n8n to start
Write-Host "Waiting for n8n to start (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Verify n8n is running
Write-Host "Verifying n8n status..." -ForegroundColor Yellow
$status = ssh "$PiUser@$PiHost" "systemctl is-active n8n"
if ($status -eq "active") {
    Write-Host "✓ n8n is running" -ForegroundColor Green
} else {
    Write-Host "ERROR: n8n failed to start" -ForegroundColor Red
    ssh "$PiUser@$PiHost" "sudo systemctl status n8n --no-pager"
    exit 1
}

# List active workflows
Write-Host "Active workflows:" -ForegroundColor Yellow
ssh "$PiUser@$PiHost" "n8n list:workflow 2>/dev/null | head -20"

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Access n8n UI at http://${PiHost}:5678"
Write-Host "2. Verify workflows are active"
Write-Host "3. Update credentials (OpenRouter API key, WhatsApp token)"
Write-Host "4. Test with real messages"
