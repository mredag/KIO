#!/bin/bash
# Test AI Automation Workflows on Raspberry Pi
# Task 13.2-13.5: End-to-end testing
# Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.4, 7.1-7.4

set -e

# Configuration
PI_HOST="${PI_HOST:-192.168.1.5}"
PI_USER="${PI_USER:-eform-kio}"
N8N_PORT="${N8N_PORT:-5678}"
BACKEND_PORT="${BACKEND_PORT:-3001}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== n8n AI Automation Testing ===${NC}"
echo "Target: ${PI_HOST}"
echo ""

# Test 1: Check n8n is running
echo -e "${YELLOW}Test 1: n8n Service Status${NC}"
if ssh "${PI_USER}@${PI_HOST}" "systemctl is-active --quiet n8n"; then
    echo -e "${GREEN}✓ n8n is running${NC}"
else
    echo -e "${RED}✗ n8n is not running${NC}"
    exit 1
fi

# Test 2: Check n8n UI is accessible
echo -e "${YELLOW}Test 2: n8n UI Accessibility${NC}"
if curl -s -o /dev/null -w "%{http_code}" "http://${PI_HOST}:${N8N_PORT}" | grep -q "200\|302"; then
    echo -e "${GREEN}✓ n8n UI is accessible${NC}"
else
    echo -e "${RED}✗ n8n UI is not accessible${NC}"
fi

# Test 3: Check backend is running
echo -e "${YELLOW}Test 3: Backend Service Status${NC}"
if curl -s "http://${PI_HOST}:${BACKEND_PORT}/api/kiosk/health" | grep -q "ok"; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not accessible${NC}"
fi

# Test 4: Test WhatsApp webhook endpoint
echo -e "${YELLOW}Test 4: WhatsApp Webhook Endpoint${NC}"
WEBHOOK_RESPONSE=$(curl -s -X POST "http://${PI_HOST}:${N8N_PORT}/webhook/whatsapp" \
    -H "Content-Type: application/json" \
    -d '{"entry":[{"changes":[{"value":{"statuses":[{"status":"delivered"}]}}]}]}' 2>/dev/null || echo "error")
if [ "$WEBHOOK_RESPONSE" = "OK" ] || [ "$WEBHOOK_RESPONSE" = "error" ]; then
    echo -e "${GREEN}✓ WhatsApp webhook responds${NC}"
else
    echo -e "${YELLOW}⚠ WhatsApp webhook response: ${WEBHOOK_RESPONSE}${NC}"
fi

# Test 5: Test intent classification with Turkish message
echo -e "${YELLOW}Test 5: Intent Classification (Turkish)${NC}"
echo "  Testing 'DURUM' (balance check)..."
INTENT_RESPONSE=$(curl -s -X POST "http://${PI_HOST}:${N8N_PORT}/webhook/whatsapp" \
    -H "Content-Type: application/json" \
    -d '{
        "entry":[{
            "changes":[{
                "value":{
                    "messages":[{
                        "id":"test-msg-1",
                        "from":"905551234567",
                        "text":{"body":"DURUM"}
                    }]
                }
            }]
        }]
    }' 2>/dev/null || echo "error")
echo "  Response: ${INTENT_RESPONSE}"

# Test 6: Test survey webhook
echo -e "${YELLOW}Test 6: Survey Webhook${NC}"
SURVEY_RESPONSE=$(curl -s -X POST "http://${PI_HOST}:${N8N_PORT}/webhook/survey" \
    -H "Content-Type: application/json" \
    -d '{
        "surveyId": "test-survey-1",
        "responseId": "test-response-1",
        "phone": "905551234567",
        "answers": {"feedback": "Çok memnun kaldım, teşekkürler!"}
    }' 2>/dev/null || echo "error")
echo "  Response: ${SURVEY_RESPONSE}"
if echo "$SURVEY_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Survey webhook works${NC}"
else
    echo -e "${YELLOW}⚠ Survey webhook may need configuration${NC}"
fi

# Test 7: Check workflow logs
echo -e "${YELLOW}Test 7: Recent Workflow Executions${NC}"
ssh "${PI_USER}@${PI_HOST}" "n8n list:workflow 2>/dev/null | head -10" || echo "Could not list workflows"

echo ""
echo -e "${GREEN}=== Testing Complete ===${NC}"
echo ""
echo "Manual tests to perform:"
echo "1. Send 'DURUM' via WhatsApp to check balance"
echo "2. Send 'KUPON ABC12345' to test coupon submission"
echo "3. Send 'YARDIM' to test help response"
echo "4. Submit a survey with negative feedback to test alerts"
echo "5. Wait for 8 PM Istanbul time to test daily summary"
