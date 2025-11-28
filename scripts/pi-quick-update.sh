#!/bin/bash
# Raspberry Pi Quick Update Script
# For minor updates (code changes only, no dependency changes)

set -e  # Exit on error

echo "⚡ Starting quick update process..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${BLUE}📍 Working directory: $PROJECT_DIR${NC}"

# Step 1: Pull latest changes
echo -e "\n${BLUE}1️⃣  Pulling latest changes...${NC}"
git pull origin main

# Step 2: Rebuild backend
echo -e "\n${BLUE}2️⃣  Building backend...${NC}"
cd backend
npm run build
cd ..

# Step 3: Rebuild frontend
echo -e "\n${BLUE}3️⃣  Building frontend...${NC}"
cd frontend
npm run build
rm -rf ../backend/public
cp -r dist ../backend/public
cd ..

# Step 4: Restart
echo -e "\n${BLUE}4️⃣  Restarting service...${NC}"
pm2 restart kiosk-backend

# Step 5: Quick verify
echo -e "\n${BLUE}5️⃣  Verifying...${NC}"
sleep 2
pm2 status

echo -e "\n${GREEN}✅ Quick update complete!${NC}"
