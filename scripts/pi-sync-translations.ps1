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

$remoteCommand = "cd ~/$AppDir/deployment/raspberry-pi && ./update-pi.sh"
ssh "$PiUser@$PiHost" $remoteCommand
if ($LASTEXITCODE -ne 0) {
  Write-Error "Remote update failed"
  exit $LASTEXITCODE
}