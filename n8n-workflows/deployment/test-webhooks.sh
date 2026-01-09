#!/bin/bash

# n8n Webhook Testing Script
# Tests all webhook endpoints with sample payloads

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
N8N_URL="${N8N_URL:-http://localhost:5678}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-test_secret_123}"
TEST_PHONE="${TEST_PHONE:-905551234567}"

echo -e "${GREEN}=== n8n Webhook Testing ===${NC}"
echo ""
echo "Configuration:"
echo "  n8n URL: $N8N_URL"
echo "  Test Phone: $TEST_PHONE"
echo ""

# Function to calculate webhook signature
calculate_signature() {
    local payload="$1"
    local secret="$2"
    echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | sed 's/^.* //'
}

# Function to test webhook
test_webhook() {
    local webhook_path="$1"
    local payload="$2"
    local description="$3"
    
    echo -e "${BLUE}Testing: $description${NC}"
    echo "  Endpoint: $N8N_URL/$webhook_path"
    
    # Calculate signature
    local signature=$(calculate_signature "$payload" "$WEBHOOK_SECRET")
    
    # Send request
    local response=$(curl -s -w "\n%{http_code}" -X POST "$N8N_URL/$webhook_path" \
        -H "Content-Type: application/json" \
        -H "x-hub-signature-256: sha256=$signature" \
        -d "$payload")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✓ Success (200)${NC}"
        echo "  Response: $body"
    else
        echo -e "  ${RED}✗ Failed ($http_code)${NC}"
        echo "  Response: $body"
    fi
    echo ""
}

# Test 1: Coupon Capture - Valid Token
echo -e "${YELLOW}=== Test 1: Coupon Capture (Valid Token) ===${NC}"
PAYLOAD1='{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "'$TEST_PHONE'",
          "text": {
            "body": "KUPON ABC123DEF456"
          }
        }]
      }
    }]
  }]
}'
test_webhook "webhook/whatsapp-coupon" "$PAYLOAD1" "Valid coupon token"

# Test 2: Coupon Capture - Invalid Format
echo -e "${YELLOW}=== Test 2: Coupon Capture (Invalid Format) ===${NC}"
PAYLOAD2='{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "'$TEST_PHONE'",
          "text": {
            "body": "KUPON INVALID"
          }
        }]
      }
    }]
  }]
}'
test_webhook "webhook/whatsapp-coupon" "$PAYLOAD2" "Invalid token format"

# Test 3: Claim Redemption
echo -e "${YELLOW}=== Test 3: Claim Redemption ===${NC}"
PAYLOAD3='{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "'$TEST_PHONE'",
          "text": {
            "body": "kupon kullan"
          }
        }]
      }
    }]
  }]
}'
test_webhook "webhook/whatsapp-claim" "$PAYLOAD3" "Claim redemption"

# Test 4: Balance Check
echo -e "${YELLOW}=== Test 4: Balance Check ===${NC}"
PAYLOAD4='{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "'$TEST_PHONE'",
          "text": {
            "body": "durum"
          }
        }]
      }
    }]
  }]
}'
test_webhook "webhook/whatsapp-balance" "$PAYLOAD4" "Balance check"

# Test 5: Opt-Out
echo -e "${YELLOW}=== Test 5: Opt-Out ===${NC}"
PAYLOAD5='{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "'$TEST_PHONE'",
          "text": {
            "body": "iptal"
          }
        }]
      }
    }]
  }]
}'
test_webhook "webhook/whatsapp-optout" "$PAYLOAD5" "Opt-out"

# Test 6: Invalid Signature
echo -e "${YELLOW}=== Test 6: Invalid Signature ===${NC}"
echo -e "${BLUE}Testing: Invalid webhook signature${NC}"
echo "  Endpoint: $N8N_URL/webhook/whatsapp-coupon"

response=$(curl -s -w "\n%{http_code}" -X POST "$N8N_URL/webhook/whatsapp-coupon" \
    -H "Content-Type: application/json" \
    -H "x-hub-signature-256: sha256=invalid_signature" \
    -d "$PAYLOAD1")

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "403" ] || [ "$http_code" = "401" ]; then
    echo -e "  ${GREEN}✓ Correctly rejected ($http_code)${NC}"
else
    echo -e "  ${RED}✗ Should have rejected but got ($http_code)${NC}"
fi
echo ""

echo -e "${GREEN}=== Testing Complete ===${NC}"
echo ""
echo "Notes:"
echo "  - Signature verification may not work if workflows don't implement it"
echo "  - Some tests may fail if backend is not running"
echo "  - Some tests may fail if test data doesn't exist in database"
echo "  - Check n8n execution history for detailed error messages"
echo ""
echo "Next steps:"
echo "  1. Review n8n execution history in UI"
echo "  2. Check backend logs for API calls"
echo "  3. Verify database state after tests"
echo "  4. Test with real WhatsApp messages"
