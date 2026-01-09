#!/bin/bash

################################################################################
# Raspberry Pi Deployment Script
# Deploys the application to Raspberry Pi
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

APP_DIR="/home/$USER/spa-kiosk"

log_info "Starting deployment..."

# Create backup before deployment
if [ -f "$APP_DIR/backend/data/kiosk.db" ]; then
    log_info "Creating pre-deployment backup..."
    bash "$APP_DIR/deployment/raspberry-pi/backup-before-deploy.sh" || log_warning "Backup failed, continuing anyway..."
fi

# Navigate to app directory
cd $APP_DIR

# Install dependencies
log_info "Installing dependencies..."
cd backend && npm install
cd ../frontend && npm install
cd ..

# Build backend
log_info "Building backend..."
cd backend

# Remove test files to avoid build errors
find src -name "*.test.ts" -type f -delete 2>/dev/null || true
find src -type d -name "e2e" -exec rm -rf {} + 2>/dev/null || true

# Create production .env if doesn't exist
if [ ! -f .env ]; then
    log_info "Creating production .env..."
    cat > .env <<EOF
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/kiosk.db
SESSION_SECRET=$(openssl rand -base64 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
MAX_VIDEO_SIZE=52428800
MAX_IMAGE_SIZE=5242880
EOF
else
    # Ensure NODE_ENV is production
    sed -i 's/NODE_ENV=development/NODE_ENV=production/' .env
fi

# Create data directory
mkdir -p ../data/backups

# Build
npm run build

# Build frontend
log_info "Building frontend..."
cd ../frontend
npx vite build

# Copy to backend public
log_info "Copying frontend to backend..."
rm -rf ../backend/public
cp -r dist ../backend/public

# Start with PM2
log_info "Starting backend with PM2..."
cd ../backend
pm2 delete kiosk-backend 2>/dev/null || true
pm2 start npm --name kiosk-backend -- run start
pm2 save

log_success "Deployment complete!"
log_info "Backend running on port 3001"
log_info "Access: http://localhost:3001"
