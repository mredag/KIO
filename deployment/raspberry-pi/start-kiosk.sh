#!/bin/bash

set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://localhost:3001/kiosk}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/kiosk/health}"
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
DISPLAY="${DISPLAY:-:0}"
XDG_SESSION_TYPE="${XDG_SESSION_TYPE:-wayland}"
DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"
LOG_DIR="${XDG_RUNTIME_DIR}/kio-kiosk"
LOCK_FILE="${LOG_DIR}/launch.lock"
LOG_FILE="${LOG_DIR}/launcher.log"
CHROMIUM_PATTERN="chromium.*http://localhost:3001/kiosk"

export XDG_RUNTIME_DIR
export WAYLAND_DISPLAY
export DISPLAY
export XDG_SESSION_TYPE
export DBUS_SESSION_BUS_ADDRESS

mkdir -p "${LOG_DIR}"
exec >>"${LOG_FILE}" 2>&1

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log() {
  echo "[$(timestamp)] $*"
}

wait_for_socket() {
  local socket_path="$1"
  local label="$2"
  local retries="${3:-40}"
  local delay="${4:-2}"
  local attempt=0

  until [ -S "${socket_path}" ]; do
    attempt=$((attempt + 1))
    if [ "${attempt}" -ge "${retries}" ]; then
      log "Timed out waiting for ${label} (${socket_path})"
      return 1
    fi
    sleep "${delay}"
  done
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local retries="${3:-40}"
  local delay="${4:-2}"
  local attempt=0

  until curl -fsS "${url}" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ "${attempt}" -ge "${retries}" ]; then
      log "Timed out waiting for ${label} (${url})"
      return 1
    fi
    sleep "${delay}"
  done
}

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "Another kiosk launcher instance already holds the lock; exiting"
  exit 0
fi

log "Starting kiosk launcher"
log "Environment: DISPLAY=${DISPLAY} WAYLAND_DISPLAY=${WAYLAND_DISPLAY} XDG_SESSION_TYPE=${XDG_SESSION_TYPE}"

if pgrep -f "${CHROMIUM_PATTERN}" >/dev/null 2>&1; then
  log "Kiosk Chromium already running; exiting"
  exit 0
fi

wait_for_socket "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" "Wayland socket"
wait_for_socket "${XDG_RUNTIME_DIR}/bus" "session bus"
wait_for_http "${HEALTH_URL}" "backend health"
wait_for_http "${KIOSK_URL}" "kiosk page"

# Allow the compositor and desktop shell to settle before opening Chromium.
sleep 8

CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "${CHROMIUM_BIN}" ]; then
  log "Chromium binary not found"
  exit 1
fi

log "Launching Chromium from ${CHROMIUM_BIN}"
exec "${CHROMIUM_BIN}" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-features=TranslateUI,CalculateNativeWinOcclusion \
  --enable-features=UseOzonePlatform \
  --ozone-platform=wayland \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-smooth-scrolling \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --no-first-run \
  --password-store=basic \
  --remote-debugging-port=9222 \
  "${KIOSK_URL}"
