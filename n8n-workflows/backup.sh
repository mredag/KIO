#!/bin/bash

# n8n Workflow Backup Script
# Backs up n8n database and exports workflows to JSON files
# Designed to run as a cron job at 2:30 AM Istanbul time

set -e

# Configuration
N8N_DATA_DIR="${N8N_DATA_DIR:-/var/lib/n8n}"
BACKUP_BASE_DIR="$(dirname "$0")/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
WORKFLOW_BACKUP_DIR="${BACKUP_BASE_DIR}/workflows-${TIMESTAMP}"
DATABASE_BACKUP_PATH="${BACKUP_BASE_DIR}/database-${TIMESTAMP}.sqlite3"
RETENTION_DAYS=30

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Create backup directories
log "Creating backup directories..."
mkdir -p "${BACKUP_BASE_DIR}"
mkdir -p "${WORKFLOW_BACKUP_DIR}"

# Check if n8n database exists
N8N_DB_PATH="${N8N_DATA_DIR}/.n8n/database.sqlite"
if [ ! -f "${N8N_DB_PATH}" ]; then
    error "n8n database not found at ${N8N_DB_PATH}"
    exit 1
fi

# Backup n8n database
log "Backing up n8n database..."
if cp "${N8N_DB_PATH}" "${DATABASE_BACKUP_PATH}"; then
    log "Database backup created: ${DATABASE_BACKUP_PATH}"
    DB_SIZE=$(du -h "${DATABASE_BACKUP_PATH}" | cut -f1)
    log "Database backup size: ${DB_SIZE}"
else
    error "Failed to backup n8n database"
    exit 1
fi

# Export workflows from database
log "Exporting workflows from database..."
WORKFLOW_COUNT=0

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    warn "sqlite3 command not found. Skipping workflow JSON export."
    warn "Install sqlite3 to enable workflow JSON exports: sudo apt-get install sqlite3"
else
    # Query workflow IDs and names from database
    WORKFLOWS=$(sqlite3 "${N8N_DB_PATH}" "SELECT id, name FROM workflow_entity;" 2>/dev/null || echo "")
    
    if [ -z "${WORKFLOWS}" ]; then
        warn "No workflows found in database or unable to query"
    else
        # Export each workflow to JSON
        while IFS='|' read -r workflow_id workflow_name; do
            if [ -n "${workflow_id}" ]; then
                # Sanitize workflow name for filename
                SAFE_NAME=$(echo "${workflow_name}" | tr ' ' '_' | tr -cd '[:alnum:]_-')
                WORKFLOW_FILE="${WORKFLOW_BACKUP_DIR}/${SAFE_NAME}_${workflow_id}.json"
                
                # Extract workflow data
                sqlite3 "${N8N_DB_PATH}" "SELECT data FROM workflow_entity WHERE id = ${workflow_id};" > "${WORKFLOW_FILE}" 2>/dev/null || true
                
                if [ -f "${WORKFLOW_FILE}" ] && [ -s "${WORKFLOW_FILE}" ]; then
                    log "Exported workflow: ${workflow_name} (ID: ${workflow_id})"
                    WORKFLOW_COUNT=$((WORKFLOW_COUNT + 1))
                else
                    warn "Failed to export workflow: ${workflow_name} (ID: ${workflow_id})"
                    rm -f "${WORKFLOW_FILE}"
                fi
            fi
        done <<< "${WORKFLOWS}"
    fi
fi

log "Exported ${WORKFLOW_COUNT} workflows to ${WORKFLOW_BACKUP_DIR}"

# Create backup manifest
MANIFEST_FILE="${BACKUP_BASE_DIR}/manifest-${TIMESTAMP}.txt"
cat > "${MANIFEST_FILE}" << EOF
n8n Backup Manifest
===================
Timestamp: ${TIMESTAMP}
Date: $(date +'%Y-%m-%d %H:%M:%S %Z')

Database Backup:
  Path: ${DATABASE_BACKUP_PATH}
  Size: $(du -h "${DATABASE_BACKUP_PATH}" | cut -f1)

Workflow Exports:
  Directory: ${WORKFLOW_BACKUP_DIR}
  Count: ${WORKFLOW_COUNT}

Retention Policy:
  Days: ${RETENTION_DAYS}
  
Restore Instructions:
  1. Stop n8n service: sudo systemctl stop n8n
  2. Backup current database: cp ${N8N_DB_PATH} ${N8N_DB_PATH}.backup
  3. Restore database: cp ${DATABASE_BACKUP_PATH} ${N8N_DB_PATH}
  4. Start n8n service: sudo systemctl start n8n
  5. Import workflows manually via n8n UI if needed
EOF

log "Backup manifest created: ${MANIFEST_FILE}"

# Clean up old backups (older than retention period)
log "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
DELETED_COUNT=0

# Find and delete old database backups
while IFS= read -r -d '' old_backup; do
    rm -f "${old_backup}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
    log "Deleted old database backup: $(basename "${old_backup}")"
done < <(find "${BACKUP_BASE_DIR}" -name "database-*.sqlite3" -type f -mtime +${RETENTION_DAYS} -print0 2>/dev/null)

# Find and delete old workflow directories
while IFS= read -r -d '' old_dir; do
    rm -rf "${old_dir}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
    log "Deleted old workflow backup: $(basename "${old_dir}")"
done < <(find "${BACKUP_BASE_DIR}" -name "workflows-*" -type d -mtime +${RETENTION_DAYS} -print0 2>/dev/null)

# Find and delete old manifest files
while IFS= read -r -d '' old_manifest; do
    rm -f "${old_manifest}"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "${BACKUP_BASE_DIR}" -name "manifest-*.txt" -type f -mtime +${RETENTION_DAYS} -print0 2>/dev/null)

if [ ${DELETED_COUNT} -gt 0 ]; then
    log "Deleted ${DELETED_COUNT} old backup files/directories"
else
    log "No old backups to clean up"
fi

# Summary
log "=========================================="
log "n8n Backup Complete!"
log "=========================================="
log "Database: ${DATABASE_BACKUP_PATH}"
log "Workflows: ${WORKFLOW_BACKUP_DIR} (${WORKFLOW_COUNT} workflows)"
log "Manifest: ${MANIFEST_FILE}"
log "=========================================="

exit 0
