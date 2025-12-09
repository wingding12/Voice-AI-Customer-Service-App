#!/bin/bash
# Test 6: Full Call Flow Simulation
# Run: ./test-scripts/06-full-call-flow.sh
#
# This simulates a complete customer call:
# 1. Incoming call → AI answers
# 2. Customer speaks → AI responds
# 3. Customer presses 0 → Switch to human
# 4. Call ends

CALL_ID="full-test-$(date +%s)"

echo "=========================================="
echo "🎬 FULL CALL FLOW SIMULATION"
echo "=========================================="
echo "Call ID: $CALL_ID"
echo ""

# Step 1: Incoming call
echo "📞 [1/6] Incoming call..."
curl -s -X POST http://localhost:3001/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"event_type\": \"call.initiated\",
      \"id\": \"event-1\",
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
  }" > /dev/null
echo "   ✓ Call initiated"
sleep 1

# Step 2: Call answered
echo "📞 [2/6] Call answered..."
curl -s -X POST http://localhost:3001/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"event_type\": \"call.answered\",
      \"id\": \"event-2\",
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
  }" > /dev/null
echo "   ✓ Call active (AI mode)"
sleep 1

# Step 3: Conversation
echo "💬 [3/6] Conversation (AI handling)..."
TIMESTAMP=$(date +%s)000

curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"transcript\",\"call_id\":\"$CALL_ID\",\"role\":\"user\",\"content\":\"Hi, I need to check my order status.\",\"timestamp\":$TIMESTAMP}" > /dev/null
echo "   Customer: Hi, I need to check my order status."
sleep 0.5

curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"transcript\",\"call_id\":\"$CALL_ID\",\"role\":\"agent\",\"content\":\"Hello! I'd be happy to help. What's your order number?\",\"timestamp\":$((TIMESTAMP + 2000))}" > /dev/null
echo "   AI Agent: Hello! I'd be happy to help. What's your order number?"
sleep 0.5

curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"transcript\",\"call_id\":\"$CALL_ID\",\"role\":\"user\",\"content\":\"Actually, I'd like to speak to a human please.\",\"timestamp\":$((TIMESTAMP + 5000))}" > /dev/null
echo "   Customer: Actually, I'd like to speak to a human please."
sleep 1

# Step 4: DTMF switch
echo "🔢 [4/6] Customer presses 0 (switch to human)..."
curl -s -X POST http://localhost:3001/webhooks/telnyx/gather \
  -H "Content-Type: application/json" \
  -d "{\"Digits\":\"0\",\"CallSessionId\":\"$CALL_ID\"}" > /dev/null
echo "   ✓ Switched to HUMAN mode"
sleep 1

# Step 5: Human conversation
echo "👤 [5/6] Human representative handling..."
curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"transcript\",\"call_id\":\"$CALL_ID\",\"role\":\"agent\",\"content\":\"Hi, this is Sarah. How can I help you today?\",\"timestamp\":$((TIMESTAMP + 10000))}" > /dev/null
echo "   Human: Hi, this is Sarah. How can I help you today?"
sleep 0.5

curl -s -X POST http://localhost:3001/webhooks/retell \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"transcript\",\"call_id\":\"$CALL_ID\",\"role\":\"user\",\"content\":\"Thanks for taking my call. I have a question about my refund.\",\"timestamp\":$((TIMESTAMP + 13000))}" > /dev/null
echo "   Customer: Thanks for taking my call. I have a question about my refund."
sleep 1

# Step 6: Call ends
echo "📞 [6/6] Call ending..."
curl -s -X POST http://localhost:3001/webhooks/telnyx \
  -H "Content-Type: application/json" \
  -d "{
    \"data\": {
      \"event_type\": \"call.hangup\",
      \"id\": \"event-end\",
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
  }" > /dev/null
echo "   ✓ Call ended"

echo ""
echo "=========================================="
echo "✅ FULL CALL FLOW COMPLETE"
echo "=========================================="
echo ""
echo "📊 Check the Agent Dashboard: http://localhost:5173/agent"
echo "📋 Check the database: npm run db:studio"
echo ""
echo "Expected results:"
echo "  - Call record in database with status ENDED"
echo "  - SwitchLog entry with direction AI_TO_HUMAN"
echo "  - Transcript with 5 entries"

