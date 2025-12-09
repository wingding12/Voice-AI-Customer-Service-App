#!/bin/bash
# Test 1: Health Check
# Run: ./test-scripts/01-health-check.sh

echo "🔍 Testing Backend Health..."
echo ""

response=$(curl -s http://localhost:3001/health)

echo "Response:"
echo "$response" | jq .

echo ""
echo "✅ Health check complete"

