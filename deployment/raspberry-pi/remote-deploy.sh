#!/usr/bin/env bash

# Remote deploy helper for the live Pi.
# Preferred path: GitHub sync + remote updater. No password-based file copy.

set -euo pipefail

PI_HOST="${PI_HOST:-192.168.1.8}"
PI_USER="${PI_USER:-eform-kio}"
APP_DIR="${APP_DIR:-kio-new}"
SSH_TARGET="${PI_USER}@${PI_HOST}"

cat <<EOF
Remote deployment target: ${SSH_TARGET}
Remote app dir: ~/${APP_DIR}
EOF

ssh "${SSH_TARGET}" "cd ~/${APP_DIR} && git pull --ff-only origin master && ./deployment/raspberry-pi/update-pi.sh"

echo "Remote deployment complete"
