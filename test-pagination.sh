#!/bin/bash

echo "🧪 Testing Sales Members Pagination"
echo "==================================="
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
else
  echo "❌ Login failed"
  exit 1
fi
echo ""

echo "2. Testing page 1 with limit 10..."
PAGE1_RESPONSE=$(curl -s "$BASE_URL/api/admin/sales-members?page=1&limit=10" \
  -H "Authorization: Bearer $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')")

PAGE1_COUNT=$(echo "$PAGE1_RESPONSE" | jq '.data | length')
PAGE1_TOTAL=$(echo "$PAGE1_RESPONSE" | jq '.pagination.total')
echo "   Records on page 1: $PAGE1_COUNT"
echo "   Total records: $PAGE1_TOTAL"

if [ "$PAGE1_COUNT" -eq 10 ]; then
  echo "✅ Page 1 pagination working correctly"
else
  echo "❌ Page 1 pagination failed"
fi
echo ""

echo "3. Testing page 2 with limit 10..."
PAGE2_RESPONSE=$(curl -s "$BASE_URL/api/admin/sales-members?page=2&limit=10" \
  -H "Authorization: Bearer $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')")

PAGE2_COUNT=$(echo "$PAGE2_RESPONSE" | jq '.data | length')
PAGE2_TOTAL=$(echo "$PAGE2_RESPONSE" | jq '.pagination.total')
EXPECTED_PAGE2=$(($PAGE1_TOTAL - 10))

echo "   Records on page 2: $PAGE2_COUNT"
echo "   Expected on page 2: $EXPECTED_PAGE2"

if [ "$PAGE2_COUNT" -eq "$EXPECTED_PAGE2" ]; then
  echo "✅ Page 2 pagination working correctly"
else
  echo "❌ Page 2 pagination failed"
fi
echo ""

echo "4. Testing pagination metadata..."
echo "$PAGE2_RESPONSE" | jq '.pagination'
echo ""

echo "5. Testing smaller page size (limit=5)..."
PAGE1_SMALL=$(curl -s "$BASE_URL/api/admin/sales-members?page=1&limit=5" \
  -H "Authorization: Bearer $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')")

SMALL_COUNT=$(echo "$PAGE1_SMALL" | jq '.data | length')
SMALL_PAGES=$(echo "$PAGE1_SMALL" | jq '.pagination.totalPages')

echo "   Records with limit 5: $SMALL_COUNT"
echo "   Total pages with limit 5: $SMALL_PAGES"

if [ "$SMALL_COUNT" -eq 5 ] && [ "$SMALL_PAGES" -eq 3 ]; then
  echo "✅ Small page size working correctly"
else
  echo "❌ Small page size failed"
fi
echo ""

echo "6. Testing search functionality..."
SEARCH_RESPONSE=$(curl -s "$BASE_URL/api/admin/sales-members?page=1&limit=10&search=admin" \
  -H "Authorization: Bearer $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')")

SEARCH_COUNT=$(echo "$SEARCH_RESPONSE" | jq '.data | length')
SEARCH_TOTAL=$(echo "$SEARCH_RESPONSE" | jq '.pagination.total')

echo "   Search results for 'admin': $SEARCH_COUNT"
echo "   Search total: $SEARCH_TOTAL"

if [ "$SEARCH_COUNT" -eq 1 ] && [ "$SEARCH_TOTAL" -eq 1 ]; then
  echo "✅ Search functionality working correctly"
else
  echo "❌ Search functionality failed"
fi
echo ""

echo "7. Testing original problematic URL..."
ORIGINAL_URL="$BASE_URL/api/admin/sales-members?page=2&limit=10&sort=-createdAt&from=2025-08-09T18%3A29%3A59.999Z&to=2025-09-07T18%3A29%3A59.999Z"
ORIGINAL_RESPONSE=$(curl -s "$ORIGINAL_URL" \
  -H "Authorization: Bearer $(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')")

ORIGINAL_COUNT=$(echo "$ORIGINAL_RESPONSE" | jq '.data | length')
ORIGINAL_PAGE=$(echo "$ORIGINAL_RESPONSE" | jq '.pagination.page')

echo "   Original URL page 2 count: $ORIGINAL_COUNT"
echo "   Original URL page number: $ORIGINAL_PAGE"

if [ "$ORIGINAL_COUNT" -eq 2 ] && [ "$ORIGINAL_PAGE" -eq 2 ]; then
  echo "✅ Original problematic URL now working correctly"
else
  echo "❌ Original URL still has issues"
fi
echo ""

echo "🎉 Pagination test complete!"

# Cleanup
rm -f cookies.txt
