#!/bin/bash

################################################################################
# Backup Database Before Deployment
# Creates a timestamped backup of the database before any deployment
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log_info "Creating pre-deployment backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ -f "$APP_DIR/backend/data/kiosk.db" ]; then
    # Stop backend to ensure clean backup
    log_info "Stopping backend..."
    pm2 stop kiosk-backend 2>/dev/null || true
    sleep 2
    
    # Checkpoint WAL to main database
    if command -v sqlite3 &> /dev/null; then
        sqlite3 "$APP_DIR/backend/data/kiosk.db" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    fi
    
    # Create backup
    BACKUP_FILE="$BACKUP_DIR/pre-deploy-${TIMESTAMP}.db"
    cp "$APP_DIR/backend/data/kiosk.db" "$BACKUP_FILE"
    
    # Verify backup
    if [ -f "$BACKUP_FILE" ]; then
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_success "Backup created: $BACKUP_FILE ($SIZE)"
        
        # Keep only last 10 backups
        cd "$BACKUP_DIR"
        ls -t pre-deploy-*.db 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
        
        BACKUP_COUNT=$(ls -1 pre-deploy-*.db 2>/dev/null | wc -l)
        log_info "Total backups: $BACKUP_COUNT"
    else
        log_error "Backup failed!"
        exit 1
    fi
    
    # Restart backend
    log_info "Restarting backend..."
    pm2 start kiosk-backend 2>/dev/null || true
else
    log_warning "No database found to backup"
fi

log_success "Backup complete!"
