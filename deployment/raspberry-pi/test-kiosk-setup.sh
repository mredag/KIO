#!/bin/bash

################################################################################
# Kiosk Setup Test Script
# Tests all aspects of the Raspberry Pi kiosk configuration
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

log_test() { echo -e "${BLUE}[TEST]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; PASS=$((PASS+1)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; FAIL=$((FAIL+1)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; WARN=$((WARN+1)); }

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Raspberry Pi Kiosk Setup Test                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

################################################################################
# System Tests
################################################################################

echo "=== System Tests ==="
echo ""

# Test 1: Node.js
log_test "Checking Node.js installation..."
if command -v node &> /dev/null; then
    VERSION=$(node --version)
    log_pass "Node.js installed: $VERSION"
else
    log_fail "Node.js not installed"
fi

# Test 2: PM2
log_test "Checking PM2 installation..."
if command -v pm2 &> /dev/null; then
    VERSION=$(pm2 --version)
    log_pass "PM2 installed: $VERSION"
else
    log_fail "PM2 not installed"
fi

# Test 3: Chromium
log_test "Checking Chromium installation..."
if command -v chromium-browser &> /dev/null || command -v chromium &> /dev/null; then
    log_pass "Chromium installed"
else
    log_fail "Chromium not installed"
fi

# Test 4: Unclutter
log_test "Checking unclutter (cursor hider)..."
if command -v unclutter &> /dev/null; then
    log_pass "Unclutter installed"
else
    log_warn "Unclutter not installed (cursor will be visible)"
fi

echo ""

################################################################################
# Application Tests
################################################################################

echo "=== Application Tests ==="
echo ""

# Test 5: Application directory
log_test "Checking application directory..."
if [ -d "$HOME/spa-kiosk" ]; then
    log_pass "Application directory exists"
else
    log_fail "Application directory not found at $HOME/spa-kiosk"
fi

# Test 6: Backend build
log_test "Checking backend build..."
if [ -d "$HOME/spa-kiosk/backend/dist" ]; then
    log_pass "Backend built (dist folder exists)"
else
    log_fail "Backend not built (dist folder missing)"
fi

# Test 7: Frontend build
log_test "Checking frontend build..."
if [ -d "$HOME/spa-kiosk/backend/public" ]; then
    log_pass "Frontend built (public folder exists)"
else
    log_fail "Frontend not built (public folder missing)"
fi

# Test 8: Database
log_test "Checking database..."
if [ -f "$HOME/spa-kiosk/data/kiosk.db" ]; then
    SIZE=$(du -h "$HOME/spa-kiosk/data/kiosk.db" | cut -f1)
    log_pass "Database exists ($SIZE)"
else
    log_warn "Database not found (will be created on first run)"
fi

# Test 9: Backend .env
log_test "Checking backend configuration..."
if [ -f "$HOME/spa-kiosk/backend/.env" ]; then
    NODE_ENV=$(grep NODE_ENV "$HOME/spa-kiosk/backend/.env" | cut -d= -f2)
    PORT=$(grep PORT "$HOME/spa-kiosk/backend/.env" | cut -d= -f2)
    
    if [ "$NODE_ENV" = "production" ]; then
        log_pass "NODE_ENV=production ✓"
    else
        log_fail "NODE_ENV=$NODE_ENV (should be production)"
    fi
    
    if [ "$PORT" = "3001" ]; then
        log_pass "PORT=3001 ✓"
    else
        log_warn "PORT=$PORT (expected 3001)"
    fi
else
    log_fail "Backend .env not found"
fi

echo ""

################################################################################
# PM2 Tests
################################################################################

echo "=== PM2 Tests ==="
echo ""

# Test 10: PM2 process
log_test "Checking PM2 backend process..."
if pm2 list | grep -q "kiosk-backend"; then
    STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$STATUS" = "online" ]; then
        log_pass "Backend process running (status: online)"
    else
        log_fail "Backend process not running (status: $STATUS)"
    fi
else
    log_fail "Backend process not found in PM2"
fi

# Test 11: PM2 startup
log_test "Checking PM2 startup configuration..."
if pm2 startup | grep -q "already"; then
    log_pass "PM2 startup configured"
else
    log_warn "PM2 startup may not be configured"
fi

# Test 12: PM2 save
log_test "Checking PM2 saved processes..."
if [ -f "$HOME/.pm2/dump.pm2" ]; then
    log_pass "PM2 processes saved"
else
    log_warn "PM2 processes not saved (run: pm2 save)"
fi

echo ""

################################################################################
# Backend API Tests
################################################################################

echo "=== Backend API Tests ==="
echo ""

# Test 13: Backend health
log_test "Testing backend health endpoint..."
HEALTH=$(curl -s http://localhost:3001/api/kiosk/health 2>&1)
if echo "$HEALTH" | grep -q "ok"; then
    log_pass "Backend health check passed"
else
    log_fail "Backend health check failed: $HEALTH"
fi

# Test 14: Backend menu endpoint
log_test "Testing backend menu endpoint..."
MENU=$(curl -s http://localhost:3001/api/kiosk/menu 2>&1)
if echo "$MENU" | grep -q "featured\|regular"; then
    log_pass "Backend menu endpoint working"
else
    log_warn "Backend menu endpoint returned unexpected data"
fi

# Test 15: Frontend served
log_test "Testing frontend serving..."
FRONTEND=$(curl -s -I http://localhost:3001 2>&1 | head -1)
if echo "$FRONTEND" | grep -q "200"; then
    log_pass "Frontend served on port 3001"
else
    log_fail "Frontend not accessible: $FRONTEND"
fi

echo ""

################################################################################
# Kiosk Configuration Tests
################################################################################

echo "=== Kiosk Configuration Tests ==="
echo ""

# Test 16: Kiosk startup script
log_test "Checking kiosk startup script..."
if [ -f "$HOME/start-kiosk.sh" ]; then
    if [ -x "$HOME/start-kiosk.sh" ]; then
        log_pass "Kiosk startup script exists and is executable"
    else
        log_warn "Kiosk startup script exists but not executable"
    fi
    
    # Check if it uses correct URL
    if grep -q "localhost:3001" "$HOME/start-kiosk.sh"; then
        log_pass "Kiosk script uses correct URL (localhost:3001)"
    else
        log_fail "Kiosk script uses wrong URL (should be localhost:3001)"
    fi
else
    log_fail "Kiosk startup script not found"
fi

# Test 17: Autostart configuration
log_test "Checking autostart configuration..."
if [ -f "$HOME/.config/autostart/kiosk.desktop" ]; then
    log_pass "Autostart desktop file exists"
    
    if grep -q "start-kiosk.sh" "$HOME/.config/autostart/kiosk.desktop"; then
        log_pass "Autostart configured correctly"
    else
        log_warn "Autostart file may be misconfigured"
    fi
else
    log_fail "Autostart desktop file not found"
fi

# Test 18: Screen blanking disabled
log_test "Checking screen blanking configuration..."
if [ -f "/etc/X11/xorg.conf.d/10-monitor.conf" ]; then
    log_pass "Screen blanking configuration exists"
else
    log_warn "Screen blanking may not be disabled"
fi

echo ""

################################################################################
# Network Tests
################################################################################

echo "=== Network Tests ==="
echo ""

# Test 19: Static IP
log_test "Checking static IP configuration..."
if grep -q "static ip_address" /etc/dhcpcd.conf 2>/dev/null; then
    STATIC_IP=$(grep "static ip_address" /etc/dhcpcd.conf | head -1 | awk '{print $3}')
    log_pass "Static IP configured: $STATIC_IP"
else
    log_warn "Static IP may not be configured (using DHCP)"
fi

# Test 20: Current IP
log_test "Checking current IP address..."
CURRENT_IP=$(hostname -I | awk '{print $1}')
log_pass "Current IP: $CURRENT_IP"

echo ""

################################################################################
# Optional Features Tests
################################################################################

echo "=== Optional Features Tests ==="
echo ""

# Test 21: Watchdog service
log_test "Checking watchdog service..."
if systemctl is-active --quiet kiosk-watchdog 2>/dev/null; then
    log_pass "Watchdog service running"
elif [ -f "/etc/systemd/system/kiosk-watchdog.service" ]; then
    log_warn "Watchdog service exists but not running"
else
    log_warn "Watchdog service not configured"
fi

# Test 22: Backup cron job
log_test "Checking backup cron job..."
if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
    log_pass "Backup cron job configured"
else
    log_warn "Backup cron job not configured"
fi

# Test 23: Backup directory
log_test "Checking backup directory..."
if [ -d "$HOME/spa-kiosk/data/backups" ]; then
    BACKUP_COUNT=$(ls -1 "$HOME/spa-kiosk/data/backups" 2>/dev/null | wc -l)
    log_pass "Backup directory exists ($BACKUP_COUNT backups)"
else
    log_warn "Backup directory not found"
fi

echo ""

################################################################################
# Performance Tests
################################################################################

echo "=== Performance Tests ==="
echo ""

# Test 24: Memory usage
log_test "Checking memory usage..."
MEMORY=$(free -h | grep Mem | awk '{print $3 "/" $2}')
log_pass "Memory usage: $MEMORY"

# Test 25: Disk usage
log_test "Checking disk usage..."
DISK=$(df -h / | tail -1 | awk '{print $3 "/" $2 " (" $5 " used)"}')
log_pass "Disk usage: $DISK"

# Test 26: CPU temperature
log_test "Checking CPU temperature..."
if command -v vcgencmd &> /dev/null; then
    TEMP=$(vcgencmd measure_temp 2>/dev/null | cut -d= -f2)
    log_pass "CPU temperature: $TEMP"
else
    log_warn "Cannot check temperature (vcgencmd not available)"
fi

echo ""

################################################################################
# Summary
################################################################################

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Test Summary                                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}PASSED:${NC} $PASS"
echo -e "${YELLOW}WARNINGS:${NC} $WARN"
echo -e "${RED}FAILED:${NC} $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    echo ""
    echo "Kiosk is ready to use. Reboot to start kiosk mode:"
    echo "  sudo reboot"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Run setup script: ./setup-raspberry-pi.sh"
    echo "  - Rebuild application: ./deploy-pi.sh"
    echo "  - Check PM2 logs: pm2 logs kiosk-backend"
    exit 1
fi
