#!/usr/bin/env bash

################################################################################
# Raspberry Pi Deployment Script
# Bootstraps or refreshes the live kio-new deployment.
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
BACKEND_ENV="${APP_DIR}/backend/.env"
UPDATER="${APP_DIR}/deployment/raspberry-pi/update-pi.sh"

log_info "Starting deployment in ${APP_DIR}"

if [[ ! -d "${APP_DIR}" ]]; then
  log_error "Application directory not found: ${APP_DIR}"
  exit 1
fi

if [[ ! -f "${BACKEND_ENV}" ]]; then
  log_info "Creating backend/.env"
  cat > "${BACKEND_ENV}" <<EOF
PORT=3001
NODE_ENV=production
DATABASE_PATH=../data/kiosk.db
SESSION_SECRET=$(openssl rand -base64 32)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
MAX_VIDEO_SIZE=52428800
MAX_IMAGE_SIZE=5242880
EOF
  log_warning "Change ADMIN_PASSWORD in ${BACKEND_ENV} after deployment"
fi

if [[ ! -x "${UPDATER}" ]]; then
  chmod +x "${UPDATER}"
fi

log_info "Running standard updater..."
"${UPDATER}"

log_success "Deployment complete"
