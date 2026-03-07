#!/usr/bin/env bash

################################################################################
# Backup Database Before Deployment
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log_info "Creating pre-deployment backup..."
mkdir -p "${BACKUP_DIR}"

if [[ -f "${DB_PATH}" ]]; then
  log_info "Stopping ${BACKEND_PM2_NAME}..."
  pm2 stop "${BACKEND_PM2_NAME}" 2>/dev/null || true
  sleep 2

  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
  fi

  BACKUP_FILE="${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.db"
  cp -p "${DB_PATH}" "${BACKUP_FILE}"

  if [[ -f "${BACKUP_FILE}" ]]; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_success "Backup created: ${BACKUP_FILE} (${SIZE})"
    cd "${BACKUP_DIR}"
    ls -t pre-deploy-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
    BACKUP_COUNT=$(ls -1 pre-deploy-*.db 2>/dev/null | wc -l)
    log_info "Total backups: ${BACKUP_COUNT}"
  else
    log_error "Backup failed"
    exit 1
  fi

  log_info "Restarting ${BACKEND_PM2_NAME}..."
  pm2 restart "${BACKEND_PM2_NAME}" 2>/dev/null || true
else
  log_warning "No database found at ${DB_PATH}"
fi

log_success "Backup complete"
