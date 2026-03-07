#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
DB_PATH="${DB_PATH:-${APP_DIR}/data/kiosk.db}"
BACKEND_ENV_PATH="${BACKEND_ENV_PATH:-${APP_DIR}/backend/.env}"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/kio-backups/pre-feature}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

log() {
  printf '[snapshot] %s\n' "$1"
}

mkdir -p "${SNAPSHOT_DIR}"

log "Creating snapshot at ${SNAPSHOT_DIR}"

git -C "${APP_DIR}" rev-parse HEAD > "${SNAPSHOT_DIR}/git-head.txt"
git -C "${APP_DIR}" status --short > "${SNAPSHOT_DIR}/git-status.txt"
git -C "${APP_DIR}" log --oneline -5 > "${SNAPSHOT_DIR}/git-log.txt"

if [[ -f "${DB_PATH}" ]]; then
  log "Backing up SQLite database"
  python3 - "${DB_PATH}" "${SNAPSHOT_DIR}/kiosk.db" <<'PY'
import sqlite3
import sys

source_path, target_path = sys.argv[1], sys.argv[2]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
target = sqlite3.connect(target_path)
with target:
    source.backup(target)
target.close()
source.close()
PY
  gzip -f "${SNAPSHOT_DIR}/kiosk.db"
fi

if [[ -f "${BACKEND_ENV_PATH}" ]]; then
  log "Copying backend env"
  cp -p "${BACKEND_ENV_PATH}" "${SNAPSHOT_DIR}/backend.env"
fi

if [[ -d "${OPENCLAW_DIR}" ]]; then
  log "Archiving OpenClaw runtime"
  tar -czf "${SNAPSHOT_DIR}/openclaw-runtime.tgz" -C "$HOME" .openclaw
fi

if command -v pm2 >/dev/null 2>&1; then
  log "Capturing PM2 state"
  pm2 status > "${SNAPSHOT_DIR}/pm2-status.txt" || true
  pm2 jlist > "${SNAPSHOT_DIR}/pm2-jlist.json" || true
fi

if command -v curl >/dev/null 2>&1; then
  log "Capturing health endpoint"
  curl -sf http://localhost:3001/api/kiosk/health > "${SNAPSHOT_DIR}/health.json" || true
fi

cat > "${SNAPSHOT_DIR}/ROLLBACK_HINTS.txt" <<EOF
Snapshot directory: ${SNAPSHOT_DIR}
Git head:
$(cat "${SNAPSHOT_DIR}/git-head.txt")

Quick code rollback:
  cd ${APP_DIR}
  git fetch origin
  git switch --detach $(cat "${SNAPSHOT_DIR}/git-head.txt")

Database restore:
  cd ${APP_DIR}/deployment/raspberry-pi
  ./restore-backup.sh ${SNAPSHOT_DIR}/kiosk.db.gz

Runtime restore:
  tar -xzf ${SNAPSHOT_DIR}/openclaw-runtime.tgz -C \$HOME
EOF

log "Snapshot complete"
printf '%s\n' "${SNAPSHOT_DIR}"
