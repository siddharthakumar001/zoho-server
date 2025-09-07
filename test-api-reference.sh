#!/bin/bash

echo "📚 Sales Members API Quick Reference & Test"
echo "=========================================="
echo ""

# Configuration
BASE_URL="http://localhost:3001"
EMAIL="admin@gmail.com"
PASSWORD="Admin@123"

# Get token
echo "🔐 Getting authentication token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sales/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.accessToken')

if [ "$TOKEN" == "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✅ Authentication successful"
echo ""

# Test all API features
echo "📋 API Test Examples:"
echo "===================="
echo ""

echo "1. Basic Pagination (Page 1, Limit 5)"
echo "--------------------------------------"
echo "Request: GET /api/admin/sales-members?page=1&limit=5"
curl -s "$BASE_URL/api/admin/sales-members?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{page: .pagination.page, limit: .pagination.limit, total: .pagination.total, count: (.data | length), users: [.data[].name]}'
echo ""

echo "2. Page 2 with Same Limit"
echo "-------------------------"
echo "Request: GET /api/admin/sales-members?page=2&limit=5"
curl -s "$BASE_URL/api/admin/sales-members?page=2&limit=5" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{page: .pagination.page, limit: .pagination.limit, total: .pagination.total, count: (.data | length), users: [.data[].name]}'
echo ""

echo "3. Search Functionality"
echo "----------------------"
echo "Request: GET /api/admin/sales-members?search=admin"
curl -s "$BASE_URL/api/admin/sales-members?search=admin" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{search_term: "admin", total_found: .pagination.total, users: [.data[].name]}'
echo ""

echo "4. Filter by Active Status"
echo "--------------------------"
echo "Request: GET /api/admin/sales-members?isActive=true&limit=3"
curl -s "$BASE_URL/api/admin/sales-members?isActive=true&limit=3" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{filter: "isActive=true", total: .pagination.total, users: [.data[] | {name: .name, isActive: .isActive}]}'
echo ""

echo "5. Custom Sorting (by Name, Ascending)"
echo "--------------------------------------"
echo "Request: GET /api/admin/sales-members?sortBy=name&sortOrder=asc&limit=5"
curl -s "$BASE_URL/api/admin/sales-members?sortBy=name&sortOrder=asc&limit=5" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{sort: "name ASC", users: [.data[].name]}'
echo ""

echo "6. Combined Parameters"
echo "---------------------"
echo "Request: GET /api/admin/sales-members?page=1&limit=3&search=a&sortBy=name&sortOrder=asc"
curl -s "$BASE_URL/api/admin/sales-members?page=1&limit=3&search=a&sortBy=name&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{page: .pagination.page, limit: .pagination.limit, search: "a", sort: "name ASC", total: .pagination.total, users: [.data[].name]}'
echo ""

echo "7. Edge Case: Large Page Number"
echo "-------------------------------"
echo "Request: GET /api/admin/sales-members?page=999&limit=10"
curl -s "$BASE_URL/api/admin/sales-members?page=999&limit=10" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{page: .pagination.page, total: .pagination.total, count: (.data | length), hasNextPage: .pagination.hasNextPage}'
echo ""

echo "8. Full Response Structure Example"
echo "----------------------------------"
echo "Request: GET /api/admin/sales-members?page=1&limit=2"
echo "Response structure:"
curl -s "$BASE_URL/api/admin/sales-members?page=1&limit=2" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '{
    pagination: .pagination,
    data_sample: .data[0],
    backward_compatibility: {
      page: .page,
      limit: .limit,
      count: .count,
      has_items_array: (.items != null)
    }
  }'
echo ""

echo "✨ API Reference Complete!"
echo ""
echo "📖 For full documentation, see: SALES_MEMBERS_API.md"
echo "🔗 Base URL: $BASE_URL"
echo "🔑 Authentication: Bearer token or cookie required"
echo "👤 Authorization: Admin role required"
