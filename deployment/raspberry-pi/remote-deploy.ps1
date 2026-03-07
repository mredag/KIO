# Remote deploy helper for the live Pi.
# Preferred path: GitHub sync + remote updater. No password-based copy.

param(
  [string]$PiHost = "192.168.1.8",
  [string]$PiUser = "eform-kio",
  [string]$AppDir = "kio-new"
)

$sshPath = Get-Command ssh -ErrorAction SilentlyContinue
if (-not $sshPath) {
  Write-Error "ssh is required. Install OpenSSH client or use another terminal."
  exit 1
}

$target = "$PiUser@$PiHost"
Write-Host "Remote deployment target: $target" -ForegroundColor Cyan
Write-Host "Remote app dir: ~/$AppDir" -ForegroundColor Cyan

$remoteCommand = "cd ~/$AppDir && git pull --ff-only origin master && ./deployment/raspberry-pi/update-pi.sh"
ssh $target $remoteCommand
if ($LASTEXITCODE -ne 0) {
  Write-Error "Remote deployment failed"
  exit $LASTEXITCODE
}

Write-Host "Remote deployment complete" -ForegroundColor Green
