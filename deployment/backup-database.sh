#!/bin/bash

# Backup database script for Raspberry Pi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/kiosk_backup_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Copy database
echo "Creating backup..."
cp "$PROJECT_ROOT/data/kiosk.db" "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo "✅ Backup created: ${BACKUP_FILE}.gz"

# Keep only last 7 backups
echo "Cleaning old backups..."
cd "$BACKUP_DIR"
ls -t kiosk_backup_*.db.gz | tail -n +8 | xargs -r rm
echo "✅ Old backups cleaned"
