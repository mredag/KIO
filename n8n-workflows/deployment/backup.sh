#!/bin/bash

# n8n Workflow Backup Script
# Exports workflows and database from n8n instance

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
N8N_DATA_DIR="${N8N_DATA_DIR:-$HOME/.n8n}"
BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="n8n-backup-$TIMESTAMP"

echo -e "${GREEN}=== n8n Backup Script ===${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Check if n8n data directory exists
if [ ! -d "$N8N_DATA_DIR" ]; then
    echo -e "${RED}Error: n8n data directory not found: $N8N_DATA_DIR${NC}"
    echo "Set N8N_DATA_DIR environment variable if using custom location"
    exit 1
fi

echo "Backing up n8n data from: $N8N_DATA_DIR"
echo "Backup destination: $BACKUP_DIR/$BACKUP_NAME"
echo ""

# Backup database
if [ -f "$N8N_DATA_DIR/database.sqlite" ]; then
    echo "Backing up SQLite database..."
    cp "$N8N_DATA_DIR/database.sqlite" "$BACKUP_DIR/$BACKUP_NAME/"
    echo -e "${GREEN}✓ Database backed up${NC}"
else
    echo -e "${YELLOW}⚠ SQLite database not found (may be using PostgreSQL)${NC}"
fi

# Backup workflows (if exported)
if [ -d "$(dirname "$0")/../workflows" ]; then
    echo "Backing up workflow JSON files..."
    cp -r "$(dirname "$0")/../workflows" "$BACKUP_DIR/$BACKUP_NAME/"
    echo -e "${GREEN}✓ Workflows backed up${NC}"
fi

# Backup credentials template (not actual credentials)
if [ -f "$(dirname "$0")/../credentials/credentials-template.json" ]; then
    echo "Backing up credentials template..."
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/credentials"
    cp "$(dirname "$0")/../credentials/credentials-template.json" "$BACKUP_DIR/$BACKUP_NAME/credentials/"
    echo -e "${GREEN}✓ Credentials template backed up${NC}"
fi

# Create backup info file
cat > "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt" << EOF
n8n Backup Information
======================
Backup Date: $(date)
Backup Name: $BACKUP_NAME
n8n Data Directory: $N8N_DATA_DIR
Hostname: $(hostname)

Contents:
- database.sqlite (if SQLite)
- workflows/ (JSON exports)
- credentials/ (template only, no secrets)

Restore Instructions:
1. Stop n8n service
2. Restore database.sqlite to n8n data directory
3. Import workflows via n8n UI
4. Reconfigure credentials in n8n UI
5. Start n8n service
EOF

echo -e "${GREEN}✓ Backup info created${NC}"
echo ""

# Compress backup
echo "Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"
echo -e "${GREEN}✓ Backup compressed: $BACKUP_NAME.tar.gz${NC}"
echo ""

# Calculate size
BACKUP_SIZE=$(du -h "$BACKUP_NAME.tar.gz" | cut -f1)
echo "Backup size: $BACKUP_SIZE"
echo "Backup location: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo ""

# Cleanup old backups (keep last 30 days)
echo "Cleaning up old backups (keeping last 30 days)..."
find "$BACKUP_DIR" -name "n8n-backup-*.tar.gz" -mtime +30 -delete
echo -e "${GREEN}✓ Old backups cleaned up${NC}"
echo ""

echo -e "${GREEN}=== Backup Complete ===${NC}"
echo ""
echo "To restore this backup:"
echo "  tar -xzf $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "  # Follow instructions in backup-info.txt"
