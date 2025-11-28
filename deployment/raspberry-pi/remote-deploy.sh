#!/bin/bash

# Remote Deployment Script for Raspberry Pi
# Connects to Raspberry Pi and deploys the application

set -e

# Configuration
PI_HOST="192.168.1.5"
PI_USER="eform-kio"
PI_PASSWORD="901801701"
APP_DIR="spa-kiosk"

echo "🚀 Starting remote deployment to Raspberry Pi..."
echo "Target: ${PI_USER}@${PI_HOST}"
echo ""

# Test connection
echo "📡 Testing SSH connection..."
sshpass -p "${PI_PASSWORD}" ssh -o StrictHostKeyChecking=no ${PI_USER}@${PI_HOST} "echo 'Connection successful!'" || {
    echo "❌ Failed to connect to Raspberry Pi"
    echo "Please check:"
    echo "  - IP address: ${PI_HOST}"
    echo "  - Username: ${PI_USER}"
    echo "  - Password"
    echo "  - Network connection"
    exit 1
}

echo "✅ Connection successful!"
echo ""

# Create app directory on Pi
echo "📁 Creating application directory..."
sshpass -p "${PI_PASSWORD}" ssh ${PI_USER}@${PI_HOST} "mkdir -p ~/${APP_DIR}"

# Copy project files to Pi
echo "📦 Copying project files to Raspberry Pi..."
echo "This may take a few minutes..."

# Exclude node_modules, dist, and other build artifacts
sshpass -p "${PI_PASSWORD}" rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude 'data/kiosk.db' \
    --exclude 'data/kiosk.db-wal' \
    --exclude 'data/kiosk.db-shm' \
    --exclude 'backend/test-kiosk.db' \
    --exclude 'logs' \
    --exclude '.kiro' \
    --exclude '*.log' \
    --exclude 'my-app-screenshots' \
    --exclude 'backend/screenshots' \
    ../../ ${PI_USER}@${PI_HOST}:~/${APP_DIR}/

echo "✅ Files copied successfully!"
echo ""

# Run setup script on Pi
echo "🔧 Running setup script on Raspberry Pi..."
echo "This will install Node.js, PM2, and configure the system..."
echo ""

sshpass -p "${PI_PASSWORD}" ssh ${PI_USER}@${PI_HOST} << 'ENDSSH'
cd ~/spa-kiosk/deployment/raspberry-pi
chmod +x setup-raspberry-pi.sh
./setup-raspberry-pi.sh
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Reboot the Raspberry Pi: ssh ${PI_USER}@${PI_HOST} 'sudo reboot'"
echo "2. After reboot, the kiosk will start automatically"
echo "3. Access admin panel: http://${PI_HOST}:3001/admin"
echo ""
echo "🔍 To check status:"
echo "   ssh ${PI_USER}@${PI_HOST} 'pm2 status'"
echo ""
