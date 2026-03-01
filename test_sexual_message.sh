#!/bin/bash
echo "=== Test 1: Normal message ==="
curl -s -X POST http://localhost:3001/api/intent/classify-sexual \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  -d '{"messageText":"merhaba masaj fiyatlari"}' | jq '.decision.action, .decision.confidence'

echo ""
echo "=== Test 2: Suspicious message ==="
curl -s -X POST http://localhost:3001/api/intent/classify-sexual \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  -d '{"messageText":"mutlu sonlu masaj var mi"}' | jq '.decision.action, .decision.confidence'
