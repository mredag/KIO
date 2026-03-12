#!/usr/bin/env bash

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

usage() {
  cat <<'EOF'
Usage: upgrade-openclaw.sh [options]

Upgrade the Pi OpenClaw runtime through the package-manager path, with
snapshot/backup, preflight checks, PM2 restart, and post-upgrade verification.

Options:
  --dry-run         Show planned actions and run read-only checks only
  --no-snapshot     Skip pre-feature snapshot creation
  --no-restart      Skip PM2 restart of the OpenClaw process
  --skip-upgrade    Skip npm upgrade and only run backup/check flow
  --sync-runtime    Sync tracked OpenClaw workspace/transform files before restart
  --target <spec>   npm package spec to install (default: openclaw@latest)
  --help            Show this help
EOF
}

run_check() {
  local label="$1"
  shift

  if "$@"; then
    log_success "${label}"
  else
    log_warning "${label} failed"
  fi
}

maybe_openclaw_backup() {
  if ! command -v openclaw >/dev/null 2>&1; then
    log_warning "openclaw CLI not found; skipping OpenClaw runtime backup"
    return 0
  fi

  if ! openclaw backup create --help >/dev/null 2>&1; then
    log_warning "This OpenClaw version does not support backup create; skipping OpenClaw runtime backup"
    return 0
  fi

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    log_info "Previewing OpenClaw backup plan..."
    openclaw backup create --dry-run --json || true
    return 0
  fi

  mkdir -p "${OPENCLAW_BACKUP_OUTPUT}"
  log_info "Creating verified OpenClaw backup in ${OPENCLAW_BACKUP_OUTPUT}..."
  openclaw backup create --verify --output "${OPENCLAW_BACKUP_OUTPUT}"
  log_success "OpenClaw backup created"
}

capture_version() {
  if ! command -v openclaw >/dev/null 2>&1; then
    echo "not-installed"
    return 0
  fi

  openclaw --version 2>/dev/null || echo "unavailable"
}

APP_DIR="${APP_DIR:-/home/$USER/kio-new}"
SNAPSHOT_SCRIPT="${APP_DIR}/deployment/raspberry-pi/pre-feature-snapshot.sh"
SYNC_SCRIPT="${APP_DIR}/deployment/raspberry-pi/sync-openclaw-runtime.sh"
OPENCLAW_PM2_NAME="${OPENCLAW_PM2_NAME:-kio-openclaw}"
OPENCLAW_BACKUP_OUTPUT="${OPENCLAW_BACKUP_OUTPUT:-$HOME/kio-backups/openclaw-cli}"
TARGET_SPEC="${TARGET_SPEC:-openclaw@latest}"

DRY_RUN=0
SKIP_SNAPSHOT=0
SKIP_RESTART=0
SKIP_UPGRADE=0
SYNC_RUNTIME=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --no-snapshot)
      SKIP_SNAPSHOT=1
      ;;
    --no-restart)
      SKIP_RESTART=1
      ;;
    --skip-upgrade)
      SKIP_UPGRADE=1
      ;;
    --sync-runtime)
      SYNC_RUNTIME=1
      ;;
    --target)
      shift
      TARGET_SPEC="${1:-}"
      if [[ -z "${TARGET_SPEC}" ]]; then
        log_error "--target requires a package spec"
        exit 1
      fi
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -d "${APP_DIR}/.git" ]]; then
  log_error "App directory is not a git repo: ${APP_DIR}"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  log_error "npm is required but not found"
  exit 1
fi

BEFORE_VERSION="$(capture_version)"

log_info "App directory: ${APP_DIR}"
log_info "Target OpenClaw package: ${TARGET_SPEC}"
log_info "Current OpenClaw version: ${BEFORE_VERSION}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  log_info "Dry run only. No files or services will be changed."
  if [[ "${SKIP_SNAPSHOT}" -eq 0 ]]; then
    log_info "Would create a pre-feature snapshot with ${SNAPSHOT_SCRIPT}"
  fi
  log_info "Would run preflight doctor/security/gateway checks"
  log_info "Would back up OpenClaw runtime if supported"
  if [[ "${SKIP_UPGRADE}" -eq 0 ]]; then
    log_info "Would run: npm i -g ${TARGET_SPEC}"
  fi
  if [[ "${SYNC_RUNTIME}" -eq 1 ]]; then
    log_info "Would sync tracked OpenClaw workspace/transform files"
  fi
  if [[ "${SKIP_RESTART}" -eq 0 ]]; then
    log_info "Would restart PM2 process: ${OPENCLAW_PM2_NAME}"
  fi

  maybe_openclaw_backup
  run_check "Preflight doctor" openclaw doctor
  run_check "Preflight security audit" openclaw security audit
  run_check "Preflight gateway status" openclaw gateway status
  exit 0
fi

if [[ "${SKIP_SNAPSHOT}" -eq 0 ]]; then
  if [[ ! -x "${SNAPSHOT_SCRIPT}" ]]; then
    log_warning "Snapshot script is not executable; running through bash"
    SNAPSHOT_OUTPUT="$(bash "${SNAPSHOT_SCRIPT}")"
  else
    SNAPSHOT_OUTPUT="$("${SNAPSHOT_SCRIPT}")"
  fi
  printf '%s\n' "${SNAPSHOT_OUTPUT}"
  SNAPSHOT_DIR="$(printf '%s\n' "${SNAPSHOT_OUTPUT}" | tail -n 1)"
  log_success "Pre-feature snapshot created: ${SNAPSHOT_DIR}"
fi

maybe_openclaw_backup

run_check "Preflight doctor" openclaw doctor
run_check "Preflight security audit" openclaw security audit
run_check "Preflight gateway status" openclaw gateway status

if [[ "${SKIP_UPGRADE}" -eq 0 ]]; then
  log_info "Upgrading OpenClaw via npm..."
  npm i -g "${TARGET_SPEC}"
  log_success "npm upgrade completed"
else
  log_warning "Skipping npm upgrade by request"
fi

if [[ "${SYNC_RUNTIME}" -eq 1 ]]; then
  if [[ ! -f "${SYNC_SCRIPT}" ]]; then
    log_error "Missing sync script: ${SYNC_SCRIPT}"
    exit 1
  fi
  log_info "Syncing tracked OpenClaw runtime files..."
  "${SYNC_SCRIPT}"
  log_success "OpenClaw runtime files synced"
fi

if [[ "${SKIP_RESTART}" -eq 0 ]]; then
  if command -v pm2 >/dev/null 2>&1 && pm2 describe "${OPENCLAW_PM2_NAME}" >/dev/null 2>&1; then
    log_info "Restarting ${OPENCLAW_PM2_NAME} via PM2..."
    pm2 restart "${OPENCLAW_PM2_NAME}" >/dev/null
    log_success "${OPENCLAW_PM2_NAME} restarted"
  else
    log_warning "PM2 process not found: ${OPENCLAW_PM2_NAME}"
  fi
else
  log_warning "Skipping PM2 restart by request"
fi

AFTER_VERSION="$(capture_version)"
log_success "OpenClaw version after upgrade: ${AFTER_VERSION}"

run_check "Post-upgrade doctor" openclaw doctor
run_check "Post-upgrade security audit" openclaw security audit
run_check "Post-upgrade gateway status" openclaw gateway status
run_check "Post-upgrade gateway health" openclaw gateway health

log_success "OpenClaw upgrade flow complete"
