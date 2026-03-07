#!/usr/bin/env bash

# Backup database script for Raspberry Pi

set -euo pipefail

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
BACKUP_DIR="${APP_DIR}/data/backups"
DB_PATH="${DB_PATH:-${APP_DIR}/data/kiosk.db}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/kiosk_backup_${TIMESTAMP}.db"

mkdir -p "${BACKUP_DIR}"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "Database not found: ${DB_PATH}" >&2
  exit 1
fi

echo "Creating backup..."
cp -p "${DB_PATH}" "${BACKUP_FILE}"
gzip -f "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}.gz"

echo "Cleaning old backups..."
cd "${BACKUP_DIR}"
ls -t kiosk_backup_*.db.gz 2>/dev/null | tail -n +8 | xargs -r rm -f

echo "Old backups cleaned"
