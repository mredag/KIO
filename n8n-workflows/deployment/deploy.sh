#!/bin/bash

# n8n Workflow Deployment Script
# Imports workflows from JSON files to production n8n instance

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_USER="${N8N_USER:-admin}"
N8N_PASSWORD="${N8N_PASSWORD}"
WORKFLOWS_DIR="$(dirname "$0")/../workflows"

echo -e "${GREEN}=== n8n Workflow Deployment ===${NC}"
echo ""

# Check if password is provided
if [ -z "$N8N_PASSWORD" ]; then
    echo -e "${RED}Error: N8N_PASSWORD environment variable not set${NC}"
    echo "Usage: N8N_PASSWORD=your_password ./deploy.sh"
    exit 1
fi

# Check if workflows directory exists
if [ ! -d "$WORKFLOWS_DIR" ]; then
    echo -e "${RED}Error: Workflows directory not found: $WORKFLOWS_DIR${NC}"
    exit 1
fi

# Check if n8n is accessible
echo "Checking n8n availability at $N8N_URL..."
if ! curl -s -f "$N8N_URL" > /dev/null; then
    echo -e "${RED}Error: Cannot connect to n8n at $N8N_URL${NC}"
    echo "Make sure n8n is running and accessible"
    exit 1
fi
echo -e "${GREEN}✓ n8n is accessible${NC}"
echo ""

# Function to import workflow
import_workflow() {
    local workflow_file="$1"
    local workflow_name=$(basename "$workflow_file" .json)
    
    echo "Importing workflow: $workflow_name"
    
    # Note: n8n doesn't have a direct API for importing workflows
    # This is a placeholder for manual import instructions
    echo -e "${YELLOW}  → Manual import required:${NC}"
    echo "     1. Open n8n UI at $N8N_URL"
    echo "     2. Click 'Import from File'"
    echo "     3. Select: $workflow_file"
    echo "     4. Click 'Import'"
    echo ""
}

# Import all workflows
echo "Found workflows:"
for workflow in "$WORKFLOWS_DIR"/*.json; do
    if [ -f "$workflow" ]; then
        import_workflow "$workflow"
    fi
done

echo -e "${GREEN}=== Deployment Instructions Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Import workflows manually in n8n UI"
echo "2. Configure credentials (see docs/credentials-setup.md)"
echo "3. Test each workflow with sample data"
echo "4. Activate workflows"
echo "5. Configure webhooks in Meta dashboard"
echo ""
echo "For automated deployment, consider using n8n API or CLI tools"
echo "See: https://docs.n8n.io/api/"
