#!/bin/bash
# Chromium autostart script for SPA Digital Kiosk
# This script launches Chromium in kiosk mode pointing to the local kiosk application

set -e

echo "Starting SPA Digital Kiosk..."

# Configuration
KIOSK_URL="http://localhost:3000/kiosk"
DISPLAY=":0"
WAIT_TIME=10
MAX_RETRIES=30

# Export display for X server
export DISPLAY=$DISPLAY

# Wait for backend to be ready
echo "Waiting for backend server to be ready..."
retry_count=0
while ! curl -s "$KIOSK_URL" > /dev/null; do
    if [ $retry_count -ge $MAX_RETRIES ]; then
        echo "Error: Backend server did not start within expected time"
        echo "Please check if the backend is running with: pm2 status"
        exit 1
    fi
    echo "Backend not ready yet, waiting... (attempt $((retry_count + 1))/$MAX_RETRIES)"
    sleep $WAIT_TIME
    retry_count=$((retry_count + 1))
done

echo "Backend is ready, launching Chromium..."

# Disable screen blanking and power management
xset s off
xset -dpms
xset s noblank

# Hide mouse cursor after 5 seconds of inactivity
unclutter -idle 5 &

# Launch Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-translate \
    --disable-features=TranslateUI \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --check-for-update-interval=31536000 \
    --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
    "$KIOSK_URL"
