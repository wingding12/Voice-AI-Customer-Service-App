#!/bin/bash
# Test 4: Simulate Retell Transcript Update
# Run: ./test-scripts/04-simulate-retell-transcript.sh <call_id>

CALL_ID=${1:-"test-call-123"}
TIMESTAMP=$(date +%s)000

echo "📝 Simulating Retell transcript update..."
echo "Call ID: $CALL_ID"
echo ""

# Customer speaks
echo "Sending: Customer message..."
curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"transcript\",
    \"call_id\": \"$CALL_ID\",
    \"role\": \"user\",
    \"content\": \"Hi, I need help with my order. It hasn't arrived yet.\",
    \"timestamp\": $TIMESTAMP
  }"
echo ""

sleep 1

# AI responds
echo "Sending: AI response..."
curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"transcript\",
    \"call_id\": \"$CALL_ID\",
    \"role\": \"agent\",
    \"content\": \"I'd be happy to help you track your order. Could you please provide your order number?\",
    \"timestamp\": $((TIMESTAMP + 2000))
  }"
echo ""

sleep 1

# Customer responds
echo "Sending: Customer follow-up..."
curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"transcript\",
    \"call_id\": \"$CALL_ID\",
    \"role\": \"user\",
    \"content\": \"Sure, it's ORD-12345.\",
    \"timestamp\": $((TIMESTAMP + 5000))
  }"
echo ""

echo "✅ Transcript updates sent"
echo ""
echo "Check the Agent Dashboard at http://localhost:5173/agent"

