#!/bin/bash

################################################################################
# Raspberry Pi Kiosk Update Script
# Updates the application to the latest version
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/home/pi/spa-kiosk"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Raspberry Pi Kiosk Update Script                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    log_error "Application directory not found: $APP_DIR"
    exit 1
fi

cd $APP_DIR

# Backup database
log_info "Creating database backup..."
./deployment/backup-database.sh
log_success "Database backed up"

# Pull latest code
log_info "Pulling latest code from repository..."
git pull
log_success "Code updated"

# Update backend
log_info "Updating backend..."
cd backend
npm install --production
npm run build
log_success "Backend updated"

# Update frontend
log_info "Updating frontend..."
cd ../frontend
npm install
npm run build
log_success "Frontend built"

# Deploy frontend
log_info "Deploying frontend..."
rm -rf ../backend/public
cp -r dist ../backend/public
log_success "Frontend deployed"

# Restart backend
log_info "Restarting backend..."
pm2 restart kiosk-backend
log_success "Backend restarted"

# Wait for backend to be ready
log_info "Waiting for backend to be ready..."
sleep 5

# Check backend health
if curl -s http://localhost:3001/api/kiosk/health > /dev/null; then
    log_success "Backend is healthy"
else
    log_error "Backend health check failed"
    log_info "Check logs with: pm2 logs kiosk-backend"
    exit 1
fi

# Restart kiosk display
log_info "Restarting kiosk display..."
pkill chromium || true
log_success "Kiosk display will restart automatically"

echo ""
log_success "═══════════════════════════════════════════════════════════"
log_success "Update complete!"
log_success "═══════════════════════════════════════════════════════════"
echo ""
log_info "Application updated to latest version"
log_info "Kiosk display will restart in a few seconds"
echo ""
