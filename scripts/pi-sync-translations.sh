#!/usr/bin/env bash
# Translation changes still require the standard live build/update path.

set -euo pipefail

PI_USER="${PI_USER:-eform-kio}"
PI_HOST="${PI_HOST:-192.168.1.8}"
APP_DIR="${APP_DIR:-kio-new}"

ssh "${PI_USER}@${PI_HOST}" "cd ~/${APP_DIR}/deployment/raspberry-pi && ./update-pi.sh"