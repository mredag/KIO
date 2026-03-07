#!/usr/bin/env bash
# Wrapper for the maintained Raspberry Pi updater.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
UPDATER="${PROJECT_DIR}/deployment/raspberry-pi/update-pi.sh"

if [[ ! -x "${UPDATER}" ]]; then
  chmod +x "${UPDATER}"
fi

exec "${UPDATER}" "$@"