#!/bin/bash

################################################################################
# Restore Database from Backup
# Restores the most recent backup or a specific backup file
################################################################################

set -e

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
BACKUP_DIR="$APP_DIR/data/backups"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# List available backups
echo ""
log_info "Available backups:"
echo ""
ls -lh "$BACKUP_DIR"/*.db 2>/dev/null || {
    log_error "No backups found!"
    exit 1
}
echo ""

# Get backup file
if [ -z "$1" ]; then
    # Use most recent backup
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/*.db 2>/dev/null | head -1)
    log_info "Using most recent backup: $(basename $BACKUP_FILE)"
else
    # Use specified backup
    if [ -f "$BACKUP_DIR/$1" ]; then
        BACKUP_FILE="$BACKUP_DIR/$1"
    elif [ -f "$1" ]; then
        BACKUP_FILE="$1"
    else
        log_error "Backup file not found: $1"
        exit 1
    fi
    log_info "Using specified backup: $(basename $BACKUP_FILE)"
fi

# Confirm restore
echo ""
log_warning "This will replace the current database!"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Restore cancelled"
    exit 0
fi

# Stop backend
log_info "Stopping backend..."
pm2 stop kiosk-backend 2>/dev/null || true
sleep 2

# Backup current database before restore
if [ -f "$APP_DIR/backend/data/kiosk.db" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    SAFETY_BACKUP="$BACKUP_DIR/before-restore-${TIMESTAMP}.db"
    cp "$APP_DIR/backend/data/kiosk.db" "$SAFETY_BACKUP"
    log_info "Current database backed up to: $(basename $SAFETY_BACKUP)"
fi

# Restore backup
log_info "Restoring backup..."
cp "$BACKUP_FILE" "$APP_DIR/backend/data/kiosk.db"

# Remove WAL files
rm -f "$APP_DIR/backend/data/kiosk.db-wal"
rm -f "$APP_DIR/backend/data/kiosk.db-shm"

# Restart backend
log_info "Starting backend..."
pm2 start kiosk-backend 2>/dev/null || true
sleep 3

# Verify
log_info "Verifying restore..."
HEALTH=$(curl -s http://localhost:3001/api/kiosk/health 2>/dev/null || echo "failed")
if echo "$HEALTH" | grep -q "ok"; then
    log_success "Restore complete! Backend is healthy."
else
    log_error "Backend health check failed!"
    exit 1
fi

log_success "Database restored successfully!"
