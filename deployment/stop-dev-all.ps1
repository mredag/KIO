# ============================================================
# Eform Kiosk — Dev Environment Stop Script
# Stops services by port — doesn't blindly kill all node processes.
# Usage: powershell -ExecutionPolicy Bypass -File deployment/stop-dev-all.ps1
#        powershell -File deployment/stop-dev-all.ps1 -Only backend,frontend
#        powershell -File deployment/stop-dev-all.ps1 -KeepCloudflared
# ============================================================

param(
  [switch]$KeepCloudflared,
  [string[]]$Only,           # e.g. -Only backend — stop only specific services
  [int]$BackendPort = 3001,
  [int]$FrontendPort = 3000,
  [int]$OpenClawPort = 18789
)

$ErrorActionPreference = "Continue"

function Should-Stop($service) {
  if ($Only -and $Only.Count -gt 0) { return ($Only -contains $service) }
  return $true
}

function Stop-ByPort($port, $name) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      Write-Host "  $name stopped ($($proc.ProcessName) PID $($proc.Id) on :$port)" -ForegroundColor Green
      return $true
    }
  }
  Write-Host "  $name not running on :$port" -ForegroundColor Gray
  return $false
}

Write-Host ""
Write-Host "Stopping dev services..." -ForegroundColor Yellow
Write-Host ""

if (Should-Stop 'frontend')    { Stop-ByPort $FrontendPort "Frontend" }
if (Should-Stop 'backend')     { Stop-ByPort $BackendPort "Backend" }
if (Should-Stop 'openclaw')    { Stop-ByPort $OpenClawPort "OpenClaw" }

if ((Should-Stop 'cloudflared') -and (-not $KeepCloudflared)) {
  $cf = Get-Process cloudflared -ErrorAction SilentlyContinue
  if ($cf) {
    $cf | Stop-Process -Force
    Write-Host "  Cloudflared stopped (PID $($cf[0].Id))" -ForegroundColor Green
  } else {
    Write-Host "  Cloudflared not running" -ForegroundColor Gray
  }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
