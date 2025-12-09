#!/bin/bash
# Test 2: Simulate Incoming Call (Telnyx Webhook)
# Run: ./test-scripts/02-simulate-incoming-call.sh

CALL_ID="test-call-$(date +%s)"

echo "📞 Simulating incoming call..."
echo "Call ID: $CALL_ID"
echo ""

# Step 1: Call Initiated
echo "Step 1: call.initiated"
response=$(curl -s -X POST http://localhost:3001/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"event_type\": \"call.initiated\",
      \"id\": \"event-$(date +%s)\",
      \"occurred_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"payload\": {
        \"call_control_id\": \"ctrl-$CALL_ID\",
        \"call_leg_id\": \"leg-$CALL_ID\",
        \"call_session_id\": \"$CALL_ID\",
        \"connection_id\": \"conn-123\",
        \"from\": \"+15551234567\",
        \"to\": \"+15559876543\",
        \"direction\": \"incoming\",
        \"state\": \"ringing\"
      }
    }
  }")

echo "Response (TeXML):"
echo "$response" | head -20
echo ""

# Step 2: Call Answered
echo "Step 2: call.answered"
curl -s -X POST http://localhost:3001/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"event_type\": \"call.answered\",
      \"id\": \"event-$(date +%s)-2\",
      \"occurred_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"payload\": {
        \"call_control_id\": \"ctrl-$CALL_ID\",
        \"call_leg_id\": \"leg-$CALL_ID\",
        \"call_session_id\": \"$CALL_ID\",
        \"connection_id\": \"conn-123\",
        \"from\": \"+15551234567\",
        \"to\": \"+15559876543\",
        \"direction\": \"incoming\",
        \"state\": \"answered\"
      }
    }
  }"

echo ""
echo "✅ Call initiated and answered"
echo ""
echo "Call ID for further tests: $CALL_ID"

