#!/bin/bash

echo "🧪 Testing PI Summary Integration"
echo "================================"
echo ""

# Set base URL
BASE_URL="http://localhost:3001"

echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq .status || echo "❌ Health check failed"
echo ""

echo "2. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sales/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"Admin@123"}' \
  -c cookies.txt)

if echo "$LOGIN_RESPONSE" | jq -e '.accessToken' > /dev/null; then
  echo "✅ Login successful"
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
else
  echo "❌ Login failed:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi
echo ""

echo "3. Testing PI Summary endpoint..."
PI_RESPONSE=$(curl -s "$BASE_URL/api/pi-summary?date=2024-01-01&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PI_RESPONSE" | jq -e '.data' > /dev/null; then
  echo "✅ PI Summary endpoint working"
  echo "Response preview:"
  echo "$PI_RESPONSE" | jq '.data | length' | xargs echo "  - Found data items:"
  echo "$PI_RESPONSE" | jq '.pagination' | sed 's/^/  /'
else
  echo "❌ PI Summary endpoint failed:"
  echo "$PI_RESPONSE" | jq .
fi
echo ""

echo "4. Testing with cookie authentication..."
PI_RESPONSE_COOKIE=$(curl -s "$BASE_URL/api/pi-summary?date=2024-01-01&page=1&limit=5" \
  -b cookies.txt)

if echo "$PI_RESPONSE_COOKIE" | jq -e '.data' > /dev/null; then
  echo "✅ PI Summary with cookie auth working"
else
  echo "❌ PI Summary with cookie auth failed:"
  echo "$PI_RESPONSE_COOKIE" | jq .
fi
echo ""

echo "🎉 Integration test complete!"

# Cleanup
rm -f cookies.txt
