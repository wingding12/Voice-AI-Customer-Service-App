#!/bin/bash
# Test 3: Simulate DTMF Press (Switch to Human)
# Run: ./test-scripts/03-simulate-dtmf-switch.sh <call_id>

CALL_ID=${1:-"test-call-123"}

echo "🔢 Simulating DTMF press (0 = Human)..."
echo "Call ID: $CALL_ID"
echo ""

response=$(curl -s -X POST http://localhost:3001/webhooks/telnyx/gather \
  -H "Content-Type: application/json" \
  -d "{
    \"Digits\": \"0\",
    \"CallSessionId\": \"$CALL_ID\"
  }")

echo "Response (TeXML):"
echo "$response"
echo ""

echo "✅ DTMF switch complete"

