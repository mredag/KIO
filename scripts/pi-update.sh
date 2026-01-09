#!/bin/bash
# Raspberry Pi Update Script
# Updates the application after pulling new code from repository

set -e  # Exit on error

echo "🔄 Starting Raspberry Pi update process..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${BLUE}📍 Working directory: $PROJECT_DIR${NC}"

# Step 1: Pull latest changes
echo -e "\n${BLUE}1️⃣  Pulling latest changes from repository...${NC}"
git pull origin main

# Step 2: Check if package.json changed
echo -e "\n${BLUE}2️⃣  Checking for dependency changes...${NC}"
if git diff HEAD@{1} --name-only | grep -q "package.json\|package-lock.json"; then
    echo -e "${YELLOW}📦 Dependencies changed, installing...${NC}"
    npm install
    cd backend && npm install && cd ..
    cd frontend && npm install && cd ..
else
    echo -e "${GREEN}✓ No dependency changes detected${NC}"
fi

# Step 3: Rebuild backend
echo -e "\n${BLUE}3️⃣  Building backend...${NC}"
cd backend
npm run build
cd ..

# Step 4: Rebuild frontend
echo -e "\n${BLUE}4️⃣  Building frontend...${NC}"
cd frontend
npm run build

# Step 5: Copy frontend to backend public
echo -e "\n${BLUE}5️⃣  Deploying frontend...${NC}"
rm -rf ../backend/public
cp -r dist ../backend/public
cd ..

# Step 6: Restart PM2 service
echo -e "\n${BLUE}6️⃣  Restarting backend service...${NC}"
pm2 restart kiosk-backend

# Step 7: Verify
echo -e "\n${BLUE}7️⃣  Verifying deployment...${NC}"
sleep 3

# Check PM2 status
echo -e "\n${YELLOW}PM2 Status:${NC}"
pm2 status

# Check health endpoint
echo -e "\n${YELLOW}Health Check:${NC}"
if curl -s http://localhost:3001/api/kiosk/health | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${YELLOW}⚠ Backend health check failed, checking logs...${NC}"
    pm2 logs kiosk-backend --lines 20 --nostream
fi

echo -e "\n${GREEN}✅ Update complete!${NC}"
echo -e "${BLUE}📊 View logs: pm2 logs kiosk-backend${NC}"
echo -e "${BLUE}🔍 Check status: pm2 status${NC}"
