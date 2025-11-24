#!/bin/bash

# Raspberry Pi Deployment Script
# Automates the complete deployment process

set -e

echo "=========================================="
echo "SPA Digital Kiosk - Raspberry Pi Deployment"
echo "=========================================="
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check Node.js
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install --production
cd backend && npm install --production && cd ..
cd frontend && npm install && cd ..
echo "✅ Dependencies installed"

# Build frontend
echo ""
echo "Building frontend..."
cd frontend
npm run build
cd ..
echo "✅ Frontend built"

# Initialize database
echo ""
echo "Initializing database..."
cd backend
if [ ! -f "../data/kiosk.db" ]; then
    npm run db:init
    npm run db:seed
    echo "✅ Database initialized with sample data"
else
    echo "⚠️  Database already exists, skipping initialization"
fi
cd ..

# Install PM2 if not installed
echo ""
echo "Checking PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
    echo "✅ PM2 installed"
else
    echo "✅ PM2 already installed"
fi

# Start backend with PM2
echo ""
echo "Starting backend..."
cd deployment
chmod +x start-backend-pm2.sh
./start-backend-pm2.sh
cd ..

# Wait for backend to start
echo ""
echo "Waiting for backend to start..."
sleep 5

# Check backend health
if curl -s http://localhost:3001/api/kiosk/health > /dev/null; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend may not be running properly"
    echo "Check logs with: pm2 logs kiosk-backend"
fi

# Setup PM2 startup
echo ""
echo "Configuring auto-start..."
pm2 save
echo "✅ PM2 process list saved"
echo ""
echo "To enable auto-start on boot, run:"
echo "  pm2 startup"
echo "  Then copy and run the command shown"

# Setup kiosk autostart
echo ""
echo "Setting up kiosk autostart..."
mkdir -p ~/.config/autostart
cp deployment/raspberry-pi/kiosk-autostart.desktop ~/.config/autostart/
chmod +x ~/.config/autostart/kiosk-autostart.desktop
echo "✅ Kiosk will start automatically on login"

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Access the application:"
echo "  Kiosk: http://localhost:3000"
echo "  Admin: http://localhost:3000/admin"
echo ""
echo "Default credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "⚠️  Change the password after first login!"
echo ""
echo "Management commands:"
echo "  pm2 status              - Check backend status"
echo "  pm2 logs kiosk-backend  - View logs"
echo "  pm2 restart kiosk-backend - Restart backend"
echo ""
echo "To start kiosk now:"
echo "  cd deployment && ./start-kiosk.sh"
echo ""
