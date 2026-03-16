#!/usr/bin/env bash

# Watchdog script for the Raspberry Pi kiosk
# Monitors backend and Chromium, restarts if they crash.

set -euo pipefail

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
BACKEND_PM2_NAME="${BACKEND_PM2_NAME:-kio-backend}"
LOG_FILE="${APP_DIR}/logs/watchdog.log"
START_BACKEND_SCRIPT="${APP_DIR}/deployment/raspberry-pi/start-backend-pm2.sh"
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

export XDG_RUNTIME_DIR
export DBUS_SESSION_BUS_ADDRESS

mkdir -p "$(dirname "${LOG_FILE}")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}"
}

if ! pm2 list | grep -q "${BACKEND_PM2_NAME}.*online"; then
  log "Backend not running, restarting ${BACKEND_PM2_NAME}..."
  "${START_BACKEND_SCRIPT}" >> "${LOG_FILE}" 2>&1
  log "Backend restarted"
fi

if ! pgrep -x "chromium-browser" >/dev/null && ! pgrep -x "chromium" >/dev/null; then
  log "Chromium not running, starting managed kiosk service..."
  systemctl --user start kio-kiosk.service >> "${LOG_FILE}" 2>&1 || true
  log "Kiosk service start requested"
fi

# Keep last 500 lines.
tail -n 500 "${LOG_FILE}" > "${LOG_FILE}.tmp" 2>/dev/null && mv "${LOG_FILE}.tmp" "${LOG_FILE}"
