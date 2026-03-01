#!/bin/bash
curl -s -X POST http://localhost:3001/api/workflow-test/simulate-agent \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=' \
  -d '{"message":"masaj fiyatlari ne kadar","senderId":"test_ui_001"}'
