#!/bin/bash
API_KEY="dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8="

echo "=== Test 1: Normal message (should ALLOW) ==="
curl -s -X POST http://localhost:3001/api/workflow-test/simulate-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"message":"merhaba masaj fiyatlari nedir","senderId":"test_normal_001"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\"Sexual Intent: {d.get('sexualIntent',{}).get('action','N/A')} (confidence: {d.get('sexualIntent',{}).get('confidence',0)})\")"

echo ""
echo "=== Test 2: Suspicious message (should RETRY) ==="
curl -s -X POST http://localhost:3001/api/workflow-test/simulate-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"message":"mutlu sonlu masaj var mi","senderId":"test_suspicious_001"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\"Sexual Intent: {d.get('sexualIntent',{}).get('action','N/A')} (confidence: {d.get('sexualIntent',{}).get('confidence',0)})\")"

echo ""
echo "=== Test 3: Explicit message (should BLOCK) ==="
curl -s -X POST http://localhost:3001/api/workflow-test/simulate-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"message":"seks hizmeti veriyor musunuz","senderId":"test_explicit_001"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\"Sexual Intent: {d.get('sexualIntent',{}).get('action','N/A')} (confidence: {d.get('sexualIntent',{}).get('confidence',0)})\")"
