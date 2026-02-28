# ============================================================
# Eform Kiosk — Dev Environment Startup Script
# Starts: cloudflared + OpenClaw + Backend (Node 18) + Frontend
# Smart port detection — only kills what's blocking, not everything.
# Usage: powershell -ExecutionPolicy Bypass -File deployment/start-dev-all.ps1
#        powershell -File deployment/start-dev-all.ps1 -Only backend,openclaw
#        powershell -File deployment/start-dev-all.ps1 -SkipCloudflared
# ============================================================

param(
  [switch]$SkipCloudflared,
  [switch]$SkipOpenClaw,
  [string[]]$Only,           # e.g. -Only backend,frontend — start only these
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 3000,
  [int]$OpenClawPort = 18789,
  [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# -- Helpers --
function Test-Port($port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  return ($null -ne $conn)
}

function Get-PortProcess($port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    return Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
  }
  return $null
}

function Stop-PortProcess($port, $name) {
  $proc = Get-PortProcess $port
  if ($proc) {
    Write-Host "  Killing $($proc.ProcessName) (PID $($proc.Id)) on port $port for $name" -ForegroundColor Yellow
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    if (Test-Port $port) {
      Write-Host "  WARNING: Port $port still occupied after kill!" -ForegroundColor Red
      return $false
    }
  }
  return $true
}

function Wait-ForPort($port, $name, $timeoutSec = 30) {
  $elapsed = 0
  while ($elapsed -lt $timeoutSec) {
    if (Test-Port $port) { return $true }
    Start-Sleep -Seconds 2
    $elapsed += 2
  }
  return $false
}

function Wait-ForHealth($url, $name, $timeoutSec = 20) {
  $elapsed = 0
  while ($elapsed -lt $timeoutSec) {
    try {
      $null = Invoke-RestMethod -Uri $url -TimeoutSec 3 -ErrorAction Stop
      return $true
    } catch { }
    Start-Sleep -Seconds 2
    $elapsed += 2
  }
  return $false
}

function Should-Start($service) {
  if ($Only -and $Only.Count -gt 0) {
    return ($Only -contains $service)
  }
  return $true
}

# -- Banner --
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Eform Kiosk — Dev Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Project: $ProjectRoot" -ForegroundColor DarkGray
if ($Only) { Write-Host "  Only: $($Only -join ', ')" -ForegroundColor DarkGray }
Write-Host ""

$results = @{}
$stepNum = 0
$totalSteps = @('cloudflared','openclaw','backend','frontend') | Where-Object { Should-Start $_ } | Measure-Object | Select-Object -ExpandProperty Count

# ============================================================
# Step: Cloudflared
# ============================================================
if ((Should-Start 'cloudflared') -and (-not $SkipCloudflared)) {
  $stepNum++
  $cfExisting = Get-Process cloudflared -ErrorAction SilentlyContinue
  if ($cfExisting) {
    Write-Host "[$stepNum/$totalSteps] Cloudflared already running (PID $($cfExisting[0].Id))" -ForegroundColor Green
    $results['Cloudflared'] = @{ Status = 'OK'; Detail = "PID $($cfExisting[0].Id) (reused)" }
  } else {
    Write-Host "[$stepNum/$totalSteps] Starting cloudflared tunnel..." -ForegroundColor Yellow
    Start-Process -FilePath "cloudflared" -ArgumentList "tunnel","run" -WindowStyle Hidden -WorkingDirectory $ProjectRoot
    Start-Sleep -Seconds 5
    $cfCheck = Get-Process cloudflared -ErrorAction SilentlyContinue
    if ($cfCheck) {
      Write-Host "  Cloudflared started (PID $($cfCheck[0].Id))" -ForegroundColor Green
      $results['Cloudflared'] = @{ Status = 'OK'; Detail = "PID $($cfCheck[0].Id)" }
    } else {
      Write-Host "  Cloudflared failed to start" -ForegroundColor Red
      $results['Cloudflared'] = @{ Status = 'FAIL'; Detail = "Process not found after launch" }
    }
  }
} elseif (Should-Start 'cloudflared') {
  $stepNum++
  Write-Host "[$stepNum/$totalSteps] Cloudflared skipped (-SkipCloudflared)" -ForegroundColor Gray
  $results['Cloudflared'] = @{ Status = 'SKIP'; Detail = "Flag" }
}

# ============================================================
# Step: OpenClaw Gateway
# ============================================================
if ((Should-Start 'openclaw') -and (-not $SkipOpenClaw)) {
  $stepNum++
  if (Test-Port $OpenClawPort) {
    Write-Host "[$stepNum/$totalSteps] OpenClaw already running on port $OpenClawPort" -ForegroundColor Green
    $results['OpenClaw'] = @{ Status = 'OK'; Detail = "Port $OpenClawPort (reused)" }
  } else {
    Write-Host "[$stepNum/$totalSteps] Starting OpenClaw gateway on port $OpenClawPort..." -ForegroundColor Yellow
    $npmGlobalPath = Join-Path $env:APPDATA "npm"
    Start-Process powershell -ArgumentList "-NoProfile","-Command",
      "`$env:PATH = '$npmGlobalPath;' + [System.Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'Machine'); openclaw gateway --port $OpenClawPort" `
      -WindowStyle Hidden -WorkingDirectory $ProjectRoot

    if (Wait-ForPort $OpenClawPort "OpenClaw" 30) {
      Write-Host "  OpenClaw ready" -ForegroundColor Green
      $results['OpenClaw'] = @{ Status = 'OK'; Detail = "Port $OpenClawPort" }
    } else {
      Write-Host "  OpenClaw failed to start within 30s" -ForegroundColor Red
      $results['OpenClaw'] = @{ Status = 'FAIL'; Detail = "Timeout on port $OpenClawPort" }
    }
  }
} elseif (Should-Start 'openclaw') {
  $stepNum++
  Write-Host "[$stepNum/$totalSteps] OpenClaw skipped (-SkipOpenClaw)" -ForegroundColor Gray
  $results['OpenClaw'] = @{ Status = 'SKIP'; Detail = "Flag" }
}

# ============================================================
# Step: Backend (Node 18 via fnm)
# ============================================================
if (Should-Start 'backend') {
  $stepNum++
  if (Test-Port $BackendPort) {
    # Check if it's healthy — if so, reuse
    $healthy = Wait-ForHealth "http://localhost:$BackendPort/api/kiosk/health" "Backend" 5
    if ($healthy) {
      Write-Host "[$stepNum/$totalSteps] Backend already running and healthy on port $BackendPort" -ForegroundColor Green
      $results['Backend'] = @{ Status = 'OK'; Detail = "Port $BackendPort (reused)" }
    } else {
      Write-Host "[$stepNum/$totalSteps] Port $BackendPort occupied but unhealthy — restarting..." -ForegroundColor Yellow
      Stop-PortProcess $BackendPort "Backend"
      # Fall through to start
      $startBackend = $true
    }
  } else {
    $startBackend = $true
  }

  if ($startBackend) {
    Write-Host "[$stepNum/$totalSteps] Starting backend (Node 18 via fnm)..." -ForegroundColor Yellow

    $backendTempScript = Join-Path $env:TEMP "eform-backend-start.ps1"
    $backendLogFile = Join-Path $ProjectRoot "backend\dev-startup.log"
@'
$ErrorActionPreference = "Continue"
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
fnm env --use-on-cd | Out-String -Stream | Where-Object { $_ -match '^\$env:' } | ForEach-Object { Invoke-Expression $_ }
fnm use 18
$nodeVersion = node --version
Write-Output "[$((Get-Date).ToString('HH:mm:ss'))] Node version: $nodeVersion" | Tee-Object -FilePath $env:EFORM_LOG -Append
Set-Location $env:EFORM_BACKEND_DIR
npx tsx watch src/index.ts 2>&1 | Tee-Object -FilePath $env:EFORM_LOG -Append
'@ | Set-Content -Path $backendTempScript -Encoding UTF8

    $envSetup = "`$env:EFORM_BACKEND_DIR = '$ProjectRoot\backend'; `$env:EFORM_LOG = '$backendLogFile'"
    Start-Process powershell -ArgumentList "-NoProfile","-Command","$envSetup; & '$backendTempScript'" -WindowStyle Hidden

    if (Wait-ForPort $BackendPort "Backend" 30) {
      # Extra: wait for health endpoint (DB init can take a moment)
      $healthy = Wait-ForHealth "http://localhost:$BackendPort/api/kiosk/health" "Backend" 15
      if ($healthy) {
        Write-Host "  Backend ready and healthy" -ForegroundColor Green
        $results['Backend'] = @{ Status = 'OK'; Detail = "Port $BackendPort" }
      } else {
        Write-Host "  Backend port open but health check failed" -ForegroundColor Yellow
        $results['Backend'] = @{ Status = 'WARN'; Detail = "Port open, health failed" }
      }
    } else {
      Write-Host "  Backend failed to start. Log: $backendLogFile" -ForegroundColor Red
      if (Test-Path $backendLogFile) {
        Get-Content $backendLogFile -Tail 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
      }
      $results['Backend'] = @{ Status = 'FAIL'; Detail = "Timeout — check $backendLogFile" }
    }
  }
}

# ============================================================
# Step: Frontend
# ============================================================
if (Should-Start 'frontend') {
  $stepNum++
  if (Test-Port $FrontendPort) {
    Write-Host "[$stepNum/$totalSteps] Frontend already running on port $FrontendPort" -ForegroundColor Green
    $results['Frontend'] = @{ Status = 'OK'; Detail = "Port $FrontendPort (reused)" }
  } else {
    Write-Host "[$stepNum/$totalSteps] Starting frontend dev server..." -ForegroundColor Yellow

    $frontendTempScript = Join-Path $env:TEMP "eform-frontend-start.ps1"
@'
$ErrorActionPreference = "Continue"
$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'User') + ';' + [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
fnm env --use-on-cd | Out-String -Stream | Where-Object { $_ -match '^\$env:' } | ForEach-Object { Invoke-Expression $_ }
fnm use 18
Set-Location $env:EFORM_PROJECT_ROOT
npm run dev --workspace=frontend
'@ | Set-Content -Path $frontendTempScript -Encoding UTF8

    Start-Process powershell -ArgumentList "-NoProfile","-Command","`$env:EFORM_PROJECT_ROOT = '$ProjectRoot'; & '$frontendTempScript'" -WindowStyle Hidden

    if (Wait-ForPort $FrontendPort "Frontend" 20) {
      Write-Host "  Frontend ready" -ForegroundColor Green
      $results['Frontend'] = @{ Status = 'OK'; Detail = "Port $FrontendPort" }
    } else {
      Write-Host "  Frontend failed to start" -ForegroundColor Red
      $results['Frontend'] = @{ Status = 'FAIL'; Detail = "Timeout on port $FrontendPort" }
    }
  }
}

# ============================================================
# Summary Table
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Status Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host ("  {0,-14} {1,-8} {2}" -f "SERVICE", "STATUS", "DETAIL") -ForegroundColor White
Write-Host ("  {0,-14} {1,-8} {2}" -f "-------", "------", "------") -ForegroundColor DarkGray

$serviceOrder = @('Cloudflared','OpenClaw','Backend','Frontend')
foreach ($svc in $serviceOrder) {
  if ($results.ContainsKey($svc)) {
    $r = $results[$svc]
    $color = switch ($r.Status) {
      'OK'   { 'Green' }
      'WARN' { 'Yellow' }
      'SKIP' { 'DarkGray' }
      'FAIL' { 'Red' }
      default { 'White' }
    }
    $icon = switch ($r.Status) {
      'OK'   { '[OK]' }
      'WARN' { '[!!]' }
      'SKIP' { '[--]' }
      'FAIL' { '[XX]' }
      default { '[??]' }
    }
    Write-Host ("  {0,-14} " -f $svc) -ForegroundColor White -NoNewline
    Write-Host ("{0,-8} " -f $icon) -ForegroundColor $color -NoNewline
    Write-Host $r.Detail -ForegroundColor DarkGray
  }
}

$failCount = ($results.Values | Where-Object { $_.Status -eq 'FAIL' }).Count

Write-Host ""
if ($failCount -eq 0) {
  Write-Host "  All services up!" -ForegroundColor Green
} else {
  Write-Host "  $failCount service(s) failed — check logs above" -ForegroundColor Red
}

Write-Host ""
Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Backend:  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Admin:    http://localhost:$FrontendPort/admin" -ForegroundColor White
Write-Host "  MC:       http://localhost:$FrontendPort/admin/mc" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
