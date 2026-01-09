#!/bin/bash

# Start backend with PM2 process manager

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Stop existing process if running
pm2 stop kiosk-backend 2>/dev/null || true
pm2 delete kiosk-backend 2>/dev/null || true

# Start backend
cd "$PROJECT_ROOT/backend"
pm2 start npm --name "kiosk-backend" -- start

echo "✅ Backend started with PM2"
echo ""
echo "Management commands:"
echo "  pm2 status              - Check status"
echo "  pm2 logs kiosk-backend  - View logs"
echo "  pm2 restart kiosk-backend - Restart"
echo "  pm2 stop kiosk-backend  - Stop"
