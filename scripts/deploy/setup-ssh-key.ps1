# Setup SSH Key on Raspberry Pi
$PI_HOST = "192.168.1.5"
$PI_USER = "eform-kio"
$PI_PASS = "901801701"

Write-Host "Setting up SSH key authentication..." -ForegroundColor Cyan

# Read the public key
$pubKey = Get-Content ~/.ssh/id_rsa.pub

# Create .ssh directory and add key
$setupCmd = @"
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo '$pubKey' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo 'SSH key added successfully!'
"@

# Send commands
$setupCmd | ssh $PI_USER@$PI_HOST

Write-Host "`n✅ SSH key setup complete!" -ForegroundColor Green
Write-Host "You can now SSH without password: ssh $PI_USER@$PI_HOST" -ForegroundColor White
