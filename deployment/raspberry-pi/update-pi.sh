#!/bin/bash

################################################################################
# Update Script for Raspberry Pi
# Updates the application to the latest version
################################################################################

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

APP_DIR="/home/$USER/spa-kiosk"

log_info "Updating application..."

# Stop backend
log_info "Stopping backend..."
pm2 stop kiosk-backend

# Backup database
log_info "Backing up database..."
BACKUP_FILE="$APP_DIR/data/kiosk.db.backup-$(date +%Y%m%d-%H%M%S)"
cp $APP_DIR/data/kiosk.db $BACKUP_FILE
log_success "Database backed up to: $BACKUP_FILE"

# Pull latest changes (if using git)
cd $APP_DIR
if [ -d .git ]; then
    log_info "Pulling latest changes..."
    git pull
fi

# Rebuild
log_info "Rebuilding backend..."
cd backend
find src -name "*.test.ts" -delete 2>/dev/null || true
find src -type d -name "e2e" -exec rm -rf {} + 2>/dev/null || true
npm install
npm run build

log_info "Rebuilding frontend..."
cd ../frontend
npm install
npx vite build
rm -rf ../backend/public
cp -r dist ../backend/public

# Restart backend
log_info "Restarting backend..."
pm2 restart kiosk-backend

log_success "Update complete!"
pm2 status
