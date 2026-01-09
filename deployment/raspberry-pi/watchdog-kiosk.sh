#!/bin/bash

# Watchdog script for SPA Digital Kiosk
# Monitors backend and Chromium, restarts if crashed
# Add to crontab: */5 * * * * /path/to/watchdog-kiosk.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/watchdog.log"

# Create log directory
mkdir -p "$PROJECT_ROOT/logs"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check backend
if ! pm2 list | grep -q "kiosk-backend.*online"; then
    log "Backend not running, restarting..."
    cd "$PROJECT_ROOT/deployment"
    ./start-backend-pm2.sh >> "$LOG_FILE" 2>&1
    log "Backend restarted"
fi

# Check Chromium
if ! pgrep -x "chromium-browser" > /dev/null; then
    log "Chromium not running, restarting..."
    export DISPLAY=:0
    cd "$PROJECT_ROOT/deployment"
    ./start-kiosk.sh >> "$LOG_FILE" 2>&1 &
    log "Chromium restarted"
fi

# Keep last 500 lines of log
tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && mv "$LOG_FILE.tmp" "$LOG_FILE"
