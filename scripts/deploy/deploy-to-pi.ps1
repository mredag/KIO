param(
  [string]$PiHost = "192.168.1.8",
  [string]$PiUser = "eform-kio",
  [string]$AppDir = "kio-new"
)

$scriptPath = Join-Path $PSScriptRoot "..\..\deployment\raspberry-pi\remote-deploy.ps1"
if (-not (Test-Path $scriptPath)) {
  Write-Error "Maintained remote deploy helper not found: $scriptPath"
  exit 1
}

& $scriptPath -PiHost $PiHost -PiUser $PiUser -AppDir $AppDir
exit $LASTEXITCODE