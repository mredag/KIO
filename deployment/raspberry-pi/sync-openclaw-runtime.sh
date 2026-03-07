#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

usage() {
  cat <<'EOF'
Usage: sync-openclaw-runtime.sh [--dry-run] [--restart] [--no-delete]

Sync tracked OpenClaw workspace/transform files from the repo into ~/.openclaw
without touching openclaw.json or unrelated runtime-only files.

Options:
  --dry-run    Show what would change without writing files
  --restart    Restart pm2 process "kio-openclaw" after a real sync with changes
  --no-delete  Keep previously managed runtime files even if they were removed from git
  --help       Show this help
EOF
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SOURCE_ROOT="${REPO_ROOT}/openclaw-config"
OPENCLAW_HOME="${OPENCLAW_HOME:-${HOME}/.openclaw}"
TRANSFORMS_DEST="${OPENCLAW_TRANSFORMS_DIR:-${OPENCLAW_HOME}/hooks/transforms}"
MANAGED_DIR="${OPENCLAW_HOME}/.kio-managed"
MANIFEST_FILE="${MANAGED_DIR}/openclaw-runtime-files.txt"
BACKUP_ROOT="${OPENCLAW_SYNC_BACKUP_ROOT:-${HOME}/kio-backups/openclaw-runtime-sync}"

DRY_RUN=0
RESTART=0
DELETE_REMOVED=1
CHANGED=0
BACKUP_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --restart)
      RESTART=1
      ;;
    --no-delete)
      DELETE_REMOVED=0
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -d "${REPO_ROOT}/.git" ]]; then
  echo "Git repo not found at ${REPO_ROOT}" >&2
  exit 1
fi

if [[ ! -d "${SOURCE_ROOT}" ]]; then
  echo "Source directory not found: ${SOURCE_ROOT}" >&2
  exit 1
fi

declare -A desired_files=()

create_backup_dir() {
  if [[ -n "${BACKUP_DIR}" ]]; then
    return
  fi

  BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "${BACKUP_DIR}"
}

backup_runtime_file() {
  local runtime_path="$1"

  [[ -e "${runtime_path}" ]] || return

  create_backup_dir

  local relative_path="${runtime_path#${OPENCLAW_HOME}/}"
  local backup_path="${BACKUP_DIR}/${relative_path}"
  mkdir -p "$(dirname "${backup_path}")"
  cp -p "${runtime_path}" "${backup_path}"
}

map_runtime_path() {
  local git_path="$1"

  case "${git_path}" in
    openclaw-config/openclaw.json)
      return 1
      ;;
    openclaw-config/transforms/*)
      printf '%s/%s\n' "${TRANSFORMS_DEST}" "${git_path#openclaw-config/transforms/}"
      ;;
    openclaw-config/workspace/*)
      printf '%s/workspace/%s\n' "${OPENCLAW_HOME}" "${git_path#openclaw-config/workspace/}"
      ;;
    openclaw-config/workspace-whatsapp/*)
      printf '%s/workspace-whatsapp/%s\n' "${OPENCLAW_HOME}" "${git_path#openclaw-config/workspace-whatsapp/}"
      ;;
    openclaw-config/workspaces/*)
      printf '%s/workspaces/%s\n' "${OPENCLAW_HOME}" "${git_path#openclaw-config/workspaces/}"
      ;;
    *)
      return 1
      ;;
  esac
}

is_managed_runtime_path() {
  local runtime_path="$1"

  case "${runtime_path}" in
    "${OPENCLAW_HOME}/workspace/"* | \
    "${OPENCLAW_HOME}/workspace-whatsapp/"* | \
    "${OPENCLAW_HOME}/workspaces/"* | \
    "${TRANSFORMS_DEST}/"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

sync_file() {
  local source_path="$1"
  local runtime_path="$2"
  local action=""

  if [[ ! -e "${runtime_path}" ]]; then
    action="ADD"
  elif cmp -s "${source_path}" "${runtime_path}"; then
    return
  else
    action="UPDATE"
  fi

  CHANGED=1

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    log_info "[dry-run] ${action} ${runtime_path}"
    return
  fi

  mkdir -p "$(dirname "${runtime_path}")"

  if [[ -e "${runtime_path}" ]]; then
    backup_runtime_file "${runtime_path}"
  fi

  cp -f "${source_path}" "${runtime_path}"
  log_info "${action} ${runtime_path}"
}

remove_managed_file() {
  local runtime_path="$1"

  [[ -e "${runtime_path}" ]] || return

  CHANGED=1

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    log_info "[dry-run] REMOVE ${runtime_path}"
    return
  fi

  backup_runtime_file "${runtime_path}"
  rm -f "${runtime_path}"
  log_info "REMOVE ${runtime_path}"
}

log_info "Sync source: ${SOURCE_ROOT}"
log_info "Runtime root: ${OPENCLAW_HOME}"

while IFS= read -r git_path; do
  [[ -n "${git_path}" ]] || continue

  runtime_path="$(map_runtime_path "${git_path}" || true)"
  if [[ -z "${runtime_path}" ]]; then
    continue
  fi

  desired_files["${runtime_path}"]=1
  sync_file "${REPO_ROOT}/${git_path}" "${runtime_path}"
done < <(git -C "${REPO_ROOT}" ls-files -- openclaw-config)

if [[ "${DELETE_REMOVED}" -eq 1 && -f "${MANIFEST_FILE}" ]]; then
  while IFS= read -r managed_path; do
    [[ -n "${managed_path}" ]] || continue

    if [[ -n "${desired_files["${managed_path}"]+x}" ]]; then
      continue
    fi

    if ! is_managed_runtime_path "${managed_path}"; then
      log_warning "Skipping unmanaged path from manifest: ${managed_path}"
      continue
    fi

    remove_managed_file "${managed_path}"
  done < "${MANIFEST_FILE}"
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  if [[ "${CHANGED}" -eq 1 ]]; then
    log_success "Dry run complete. Changes detected."
  else
    log_success "Dry run complete. Runtime already matches tracked files."
  fi
  exit 0
fi

mkdir -p "${MANAGED_DIR}"
printf '%s\n' "${!desired_files[@]}" | sort > "${MANIFEST_FILE}"

if [[ "${CHANGED}" -eq 1 ]]; then
  log_success "OpenClaw runtime files synced."
  log_info "Managed manifest: ${MANIFEST_FILE}"
  if [[ -n "${BACKUP_DIR}" ]]; then
    log_info "Backup dir: ${BACKUP_DIR}"
  fi

  if [[ "${RESTART}" -eq 1 ]]; then
    log_info "Restarting kio-openclaw..."
    pm2 restart kio-openclaw >/dev/null
    log_success "kio-openclaw restarted."
  else
    log_warning "Files changed. Restart kio-openclaw if you need the new runtime immediately."
  fi
else
  log_success "Runtime already matches tracked OpenClaw files."
fi
