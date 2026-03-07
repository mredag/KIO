#!/usr/bin/env bash
# Legacy wrapper kept for convenience. Uses the standard Pi updater.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPDATER="${PROJECT_DIR}/deployment/raspberry-pi/update-pi.sh"

if [[ ! -x "${UPDATER}" ]]; then
  chmod +x "${UPDATER}"
fi

echo "[INFO] pi-quick-update.sh now forwards to deployment/raspberry-pi/update-pi.sh"
exec "${UPDATER}" "$@"