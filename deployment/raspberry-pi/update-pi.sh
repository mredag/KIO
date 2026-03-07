#!/usr/bin/env bash

################################################################################
# Update Script for Raspberry Pi (current kio-new deployment)
# Pulls latest code, rebuilds backend/frontend, syncs OpenClaw runtime, and
# restarts the live PM2 services.
################################################################################

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

wait_for_health() {
  local url="$1"
  local attempts="${2:-20}"
  local sleep_seconds="${3:-2}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "${url}" >/dev/null; then
      return 0
    fi
    sleep "${sleep_seconds}"
  done

  return 1
}

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
DATA_DIR="${APP_DIR}/data"
DB_PATH="${DB_PATH:-${DATA_DIR}/kiosk.db}"
BACKEND_PM2_NAME="${BACKEND_PM2_NAME:-kio-backend}"
OPENCLAW_PM2_NAME="${OPENCLAW_PM2_NAME:-kio-openclaw}"
SYNC_SCRIPT="${APP_DIR}/deployment/raspberry-pi/sync-openclaw-runtime.sh"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/kiosk/health}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  log_error "App directory is not a git repo: ${APP_DIR}"
  exit 1
fi

if [[ ! -f "${SYNC_SCRIPT}" ]]; then
  log_error "Missing sync script: ${SYNC_SCRIPT}"
  exit 1
fi

if ! pm2 describe "${BACKEND_PM2_NAME}" >/dev/null 2>&1; then
  log_error "PM2 process not found: ${BACKEND_PM2_NAME}"
  exit 1
fi

if ! pm2 describe "${OPENCLAW_PM2_NAME}" >/dev/null 2>&1; then
  log_error "PM2 process not found: ${OPENCLAW_PM2_NAME}"
  exit 1
fi

log_info "Updating live Pi deployment at ${APP_DIR}"

mkdir -p "${DATA_DIR}/backups"

if [[ -f "${DB_PATH}" ]]; then
  BACKUP_FILE="${DATA_DIR}/backups/kiosk.db.pre-update-$(date +%Y%m%d-%H%M%S)"
  cp -p "${DB_PATH}" "${BACKUP_FILE}"
  log_success "Database backed up to: ${BACKUP_FILE}"
else
  log_warning "Database not found at ${DB_PATH}; continuing without DB backup"
fi

cd "${APP_DIR}"

log_info "Pulling latest code..."
git pull --ff-only origin master

log_info "Installing workspace dependencies with npm ci..."
npm ci --no-audit --no-fund

log_info "Building backend with tsconfig.build.json..."
cd "${BACKEND_DIR}"
npx tsc -p tsconfig.build.json
mkdir -p dist/database
cp src/database/*.sql dist/database/

log_info "Building frontend..."
cd "${FRONTEND_DIR}"
npx vite build

log_info "Copying frontend build into backend/public..."
rm -rf "${BACKEND_DIR}/public"
cp -r dist "${BACKEND_DIR}/public"

log_info "Restarting ${BACKEND_PM2_NAME}..."
pm2 restart "${BACKEND_PM2_NAME}" >/dev/null
log_success "${BACKEND_PM2_NAME} restarted"

log_info "Syncing OpenClaw runtime and restarting ${OPENCLAW_PM2_NAME} if needed..."
cd "${APP_DIR}"
"${SYNC_SCRIPT}" --restart

if command -v curl >/dev/null 2>&1; then
  log_info "Running backend health check with retry..."
  if wait_for_health "${HEALTH_URL}" 20 2; then
    log_success "Health check passed: ${HEALTH_URL}"
  else
    log_error "Health check failed after retries: ${HEALTH_URL}"
    exit 1
  fi
else
  log_warning "curl not found; skipping backend health check"
fi

log_success "Update complete"
pm2 status "${BACKEND_PM2_NAME}" "${OPENCLAW_PM2_NAME}"
