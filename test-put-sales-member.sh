#!/bin/bash

echo "🧪 Testing PUT /api/admin/sales-members/:id Endpoint"
echo "=================================================="
echo ""

# Set base URL
BASE_URL="http://localhost:3001"

echo "1. Testing login..."
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

echo "2. Getting sales members list..."
MEMBERS_RESPONSE=$(curl -s "$BASE_URL/api/admin/sales-members?limit=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$MEMBERS_RESPONSE" | jq -e '.data' > /dev/null; then
  echo "✅ Sales members retrieved"
  # Get a non-admin member ID for testing
  MEMBER_ID=$(echo "$MEMBERS_RESPONSE" | jq -r '.data[] | select(.isAdmin == false) | ._id' | head -1)
  MEMBER_NAME=$(echo "$MEMBERS_RESPONSE" | jq -r '.data[] | select(.isAdmin == false) | .name' | head -1)
  echo "   Using member: $MEMBER_NAME (ID: $MEMBER_ID)"
else
  echo "❌ Failed to get sales members"
  exit 1
fi
echo ""

echo "3. Testing successful update..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/sales-members/$MEMBER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Updated Test User",
    "phone": "9876543210",
    "topLine": 1500000,
    "monthlyTarget": 75000,
    "isActive": true
  }')

if echo "$UPDATE_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Update successful"
  echo "Response:"
  echo "$UPDATE_RESPONSE" | jq '{success: .success, message: .message, name: .data.name, monthlyTarget: .data.monthlyTarget, topLine: .data.topLine}'
else
  echo "❌ Update failed:"
  echo "$UPDATE_RESPONSE"
fi
echo ""

echo "4. Testing validation (duplicate email)..."
VALIDATION_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/sales-members/$MEMBER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "admin@gmail.com"
  }')

if echo "$VALIDATION_RESPONSE" | grep -q "Email already in use"; then
  echo "✅ Email validation working"
else
  echo "❌ Email validation failed"
  echo "$VALIDATION_RESPONSE"
fi
echo ""

echo "5. Testing non-existent ID..."
NOTFOUND_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/sales-members/999999999999999999999999" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test"}')

if echo "$NOTFOUND_RESPONSE" | grep -q "Sales member not found"; then
  echo "✅ Not found handling working"
else
  echo "❌ Not found handling failed"
  echo "$NOTFOUND_RESPONSE"
fi
echo ""

echo "6. Testing authentication requirement..."
AUTH_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/sales-members/$MEMBER_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}')

if echo "$AUTH_RESPONSE" | jq -e '.success == false' > /dev/null; then
  echo "✅ Authentication protection working"
else
  echo "❌ Authentication protection failed"
  echo "$AUTH_RESPONSE"
fi
echo ""

echo "7. Testing with Bearer token (alternative auth method)..."
BEARER_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/sales-members/$MEMBER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Bearer Token Test",
    "monthlyTarget": 80000
  }')

if echo "$BEARER_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Bearer token authentication working"
  echo "Updated name: $(echo "$BEARER_RESPONSE" | jq -r '.data.name')"
else
  echo "❌ Bearer token authentication failed"
  echo "$BEARER_RESPONSE"
fi
echo ""

echo "🎉 PUT endpoint test complete!"

# Cleanup
rm -f cookies.txt
