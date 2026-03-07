#!/usr/bin/env bash

# Start backend with PM2 process manager

set -euo pipefail

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
BACKEND_PM2_NAME="${BACKEND_PM2_NAME:-kio-backend}"
BACKEND_DIR="${APP_DIR}/backend"

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "Backend directory not found: ${BACKEND_DIR}" >&2
  exit 1
fi

pm2 stop "${BACKEND_PM2_NAME}" 2>/dev/null || true
pm2 delete "${BACKEND_PM2_NAME}" 2>/dev/null || true

cd "${BACKEND_DIR}"
pm2 start npm --name "${BACKEND_PM2_NAME}" -- start

cat <<EOF
Backend started with PM2

Management commands:
  pm2 status
  pm2 logs ${BACKEND_PM2_NAME}
  pm2 restart ${BACKEND_PM2_NAME}
  pm2 stop ${BACKEND_PM2_NAME}
EOF
