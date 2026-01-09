#!/bin/bash
# Test OpenRouter API connectivity
# Usage: ./test-openrouter.sh <API_KEY>
# Requirements: 6.1 - Test API connectivity with simple request

set -e

API_KEY="${1:-$OPENROUTER_API_KEY}"

if [ -z "$API_KEY" ]; then
    echo "❌ Error: OpenRouter API key required"
    echo "Usage: ./test-openrouter.sh <API_KEY>"
    echo "   or: OPENROUTER_API_KEY=sk-or-v1-xxx ./test-openrouter.sh"
    exit 1
fi

echo "🔄 Testing OpenRouter API connectivity..."
echo "   Model: openai/gpt-4o-mini"
echo "   Timeout: 3 seconds"
echo ""

# Make API request with 3-second timeout
RESPONSE=$(curl -s --max-time 3 \
    -X POST "https://openrouter.ai/api/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "HTTP-Referer: https://spa-kiosk.local" \
    -H "X-Title: SPA Digital Kiosk" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "openai/gpt-4o-mini",
        "messages": [{"role": "user", "content": "Say OK in Turkish"}],
        "temperature": 0.1,
        "max_tokens": 10
    }' 2>&1)

# Check for curl errors
if [ $? -ne 0 ]; then
    echo "❌ Connection failed (timeout or network error)"
    exit 1
fi

# Check for API errors
if echo "$RESPONSE" | grep -q '"error"'; then
    ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "❌ API Error: $ERROR_MSG"
    exit 1
fi

# Extract response content
CONTENT=$(echo "$RESPONSE" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4)
MODEL=$(echo "$RESPONSE" | grep -o '"model":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$CONTENT" ]; then
    echo "✅ API Connection Successful!"
    echo "   Response: $CONTENT"
    echo "   Model: $MODEL"
    exit 0
else
    echo "❌ Unexpected response format"
    echo "   Raw: ${RESPONSE:0:200}"
    exit 1
fi
