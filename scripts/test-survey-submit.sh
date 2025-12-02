#!/bin/bash
# Test survey submission with Turkish characters

SURVEY_ID="f37bf3ce-95c3-4909-b810-0c7f9a69912e"

# Create test JSON file
cat > /tmp/test-survey.json << 'EOF'
{
  "surveyId": "f37bf3ce-95c3-4909-b810-0c7f9a69912e",
  "answers": {
    "q1": "Kesinlikle evet"
  },
  "timestamp": "2025-12-01T18:12:00.000Z"
}
EOF

echo "Test JSON content:"
cat /tmp/test-survey.json

echo ""
echo "Submitting survey..."
curl -s -X POST http://localhost:3001/api/kiosk/survey-response \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @/tmp/test-survey.json

echo ""
echo ""
echo "Checking database for recent responses..."
sqlite3 ~/spa-kiosk/data/kiosk.db "SELECT id, answers, created_at FROM survey_responses ORDER BY created_at DESC LIMIT 3;"
