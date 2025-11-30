#!/bin/bash
# Deploy AI Automation Workflows to Raspberry Pi n8n
# Task 13.1: Deploy workflows to Raspberry Pi n8n
# Requirements: All

set -e

# Configuration
PI_HOST="${PI_HOST:-192.168.1.5}"
PI_USER="${PI_USER:-eform-kio}"
WORKFLOW_DIR="$(dirname "$0")/../workflows-v2"
TEMPLATE_DIR="$(dirname "$0")/../templates"
REMOTE_DIR="/home/${PI_USER}/n8n-workflows"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== n8n AI Automation Deployment ===${NC}"
echo "Target: ${PI_USER}@${PI_HOST}"
echo ""

# Check SSH connectivity
echo -e "${YELLOW}Checking SSH connectivity...${NC}"
if ! ssh -o ConnectTimeout=5 "${PI_USER}@${PI_HOST}" "echo 'Connected'" 2>/dev/null; then
    echo -e "${RED}ERROR: Cannot connect to ${PI_HOST}${NC}"
    echo "Make sure the Raspberry Pi is online and SSH is enabled."
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"

# Create remote directory
echo -e "${YELLOW}Creating remote directory...${NC}"
ssh "${PI_USER}@${PI_HOST}" "mkdir -p ${REMOTE_DIR}"

# List of workflows to deploy
WORKFLOWS=(
    "whatsapp-ai-integrated.json"
)

TEMPLATES=(
    "daily-summary.json"
    "sentiment-analysis.json"
    "survey-webhook-integration.json"
)

# Copy workflow files
echo -e "${YELLOW}Copying workflow files...${NC}"
for wf in "${WORKFLOWS[@]}"; do
    if [ -f "${WORKFLOW_DIR}/${wf}" ]; then
        echo "  Copying ${wf}..."
        scp "${WORKFLOW_DIR}/${wf}" "${PI_USER}@${PI_HOST}:${REMOTE_DIR}/"
    else
        echo -e "${RED}  WARNING: ${wf} not found${NC}"
    fi
done

for tpl in "${TEMPLATES[@]}"; do
    if [ -f "${TEMPLATE_DIR}/${tpl}" ]; then
        echo "  Copying ${tpl}..."
        scp "${TEMPLATE_DIR}/${tpl}" "${PI_USER}@${PI_HOST}:${REMOTE_DIR}/"
    else
        echo -e "${RED}  WARNING: ${tpl} not found${NC}"
    fi
done

echo -e "${GREEN}✓ Files copied${NC}"

# Deactivate existing workflows
echo -e "${YELLOW}Deactivating existing workflows...${NC}"
ssh "${PI_USER}@${PI_HOST}" "n8n update:workflow --all --active=false 2>/dev/null || true"

# Import workflows
echo -e "${YELLOW}Importing workflows...${NC}"
ssh "${PI_USER}@${PI_HOST}" << 'REMOTE_SCRIPT'
cd ~/n8n-workflows
for f in *.json; do
    if [ -f "$f" ]; then
        echo "  Importing $f..."
        n8n import:workflow --input="$f" 2>/dev/null || echo "    Warning: Import may have failed for $f"
    fi
done
REMOTE_SCRIPT

# Activate workflows
echo -e "${YELLOW}Activating workflows...${NC}"
ssh "${PI_USER}@${PI_HOST}" "n8n update:workflow --all --active=true 2>/dev/null || true"

# Restart n8n to apply changes
echo -e "${YELLOW}Restarting n8n service...${NC}"
ssh "${PI_USER}@${PI_HOST}" "sudo systemctl restart n8n"

# Wait for n8n to start
echo -e "${YELLOW}Waiting for n8n to start (15 seconds)...${NC}"
sleep 15

# Verify n8n is running
echo -e "${YELLOW}Verifying n8n status...${NC}"
if ssh "${PI_USER}@${PI_HOST}" "systemctl is-active --quiet n8n"; then
    echo -e "${GREEN}✓ n8n is running${NC}"
else
    echo -e "${RED}ERROR: n8n failed to start${NC}"
    ssh "${PI_USER}@${PI_HOST}" "sudo systemctl status n8n --no-pager"
    exit 1
fi

# List active workflows
echo -e "${YELLOW}Active workflows:${NC}"
ssh "${PI_USER}@${PI_HOST}" "n8n list:workflow 2>/dev/null | head -20" || echo "Could not list workflows"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Access n8n UI at http://${PI_HOST}:5678"
echo "2. Verify workflows are active"
echo "3. Update credentials (OpenRouter API key, WhatsApp token)"
echo "4. Test with real messages"
