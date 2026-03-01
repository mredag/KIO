#!/bin/bash
curl -v -X POST http://localhost:3001/api/intent/classify-sexual \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dwsQf8q0BpFWXPqMhwy2SGLG/wHIw1hKyjW8eI4Cgd8=" \
  -d '{"messageText":"merhaba masaj fiyatlari"}'
