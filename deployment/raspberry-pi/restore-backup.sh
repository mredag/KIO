#!/usr/bin/env bash

################################################################################
# Restore Database from Backup
################################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
BACKUP_DIR="${APP_DIR}/data/backups"
DB_PATH="${DB_PATH:-${APP_DIR}/data/kiosk.db}"
BACKEND_PM2_NAME="${BACKEND_PM2_NAME:-kio-backend}"

if [[ ! -d "${BACKUP_DIR}" ]]; then
  log_error "Backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

echo
log_info "Available backups:"
echo
ls -lh "${BACKUP_DIR}"/*.db* 2>/dev/null || {
  log_error "No backups found"
  exit 1
}
echo

if [[ -z "${1:-}" ]]; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.db* 2>/dev/null | head -1)
  log_info "Using most recent backup: $(basename "${BACKUP_FILE}")"
else
  if [[ -f "${BACKUP_DIR}/$1" ]]; then
    BACKUP_FILE="${BACKUP_DIR}/$1"
  elif [[ -f "$1" ]]; then
    BACKUP_FILE="$1"
  else
    log_error "Backup file not found: $1"
    exit 1
  fi
  log_info "Using specified backup: $(basename "${BACKUP_FILE}")"
fi

echo
log_warning "This will replace the current database at ${DB_PATH}"
read -r -p "Continue? (y/n) " -n 1
REPLY="$REPLY"
echo
if [[ ! ${REPLY} =~ ^[Yy]$ ]]; then
  log_info "Restore cancelled"
  exit 0
fi

log_info "Stopping ${BACKEND_PM2_NAME}..."
pm2 stop "${BACKEND_PM2_NAME}" 2>/dev/null || true
sleep 2

if [[ -f "${DB_PATH}" ]]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  SAFETY_BACKUP="${BACKUP_DIR}/before-restore-${TIMESTAMP}.db"
  cp -p "${DB_PATH}" "${SAFETY_BACKUP}"
  log_info "Current database backed up to: $(basename "${SAFETY_BACKUP}")"
fi

log_info "Restoring backup..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gzip -dc "${BACKUP_FILE}" > "${DB_PATH}"
else
  cp -p "${BACKUP_FILE}" "${DB_PATH}"
fi

rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

log_info "Restarting ${BACKEND_PM2_NAME}..."
pm2 restart "${BACKEND_PM2_NAME}" 2>/dev/null || true
sleep 3

HEALTH=$(curl -fsS http://localhost:3001/api/kiosk/health 2>/dev/null || echo failed)
if echo "${HEALTH}" | grep -q 'ok'; then
  log_success "Restore complete. Backend is healthy."
else
  log_error "Backend health check failed after restore"
  exit 1
fi

log_success "Database restored successfully"
