#!/bin/bash
# Test 5: Simulate Call End (Telnyx Hangup + Retell Call Ended)
# Run: ./test-scripts/05-simulate-call-end.sh <call_id>

CALL_ID=${1:-"test-call-123"}

echo "📞 Simulating call end..."
echo "Call ID: $CALL_ID"
echo ""

# Retell call_ended with transcript
echo "Step 1: Retell call_ended..."
curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"call_ended\",
    \"call\": {
      \"call_id\": \"retell-$CALL_ID\",
      \"agent_id\": \"test-agent\",
      \"call_status\": \"ended\",
      \"start_timestamp\": $(($(date +%s) - 120))000,
      \"end_timestamp\": $(date +%s)000,
      \"transcript\": \"Customer: Hi, I need help.\\nAgent: Hello! How can I assist you?\",
      \"transcript_object\": [
        {\"role\": \"user\", \"content\": \"Hi, I need help with my order.\"},
        {\"role\": \"agent\", \"content\": \"Hello! I'd be happy to help you.\"},
        {\"role\": \"user\", \"content\": \"My order number is ORD-12345.\"},
        {\"role\": \"agent\", \"content\": \"Let me look that up for you.\"}
      ],
      \"disconnection_reason\": \"user_hangup\",
      \"metadata\": {
        \"telnyx_call_id\": \"$CALL_ID\"
      }
    }
  }"
echo ""

# Telnyx hangup
echo "Step 2: Telnyx call.hangup..."
curl -s -X POST http://localhost:3001/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"event_type\": \"call.hangup\",
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
        \"state\": \"hangup\"
      }
    }
  }"
echo ""

echo "✅ Call ended"

