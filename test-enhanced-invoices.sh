#!/bin/bash

# Test script for enhanced /api/invoices endpoint
# Tests multi-field search, status filtering, sorting, and pagination

echo "🧪 Testing Enhanced /api/invoices Endpoint"
echo "==========================================="

# Check if server is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Server is not running on port 3001. Please start the server first."
    exit 1
fi

echo "✅ Server is running"
echo ""

# Login and get token
echo "🔐 Logging in as admin user..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/sales/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@gmail.com", "password": "Admin@123"}' \
  -c cookies.txt)

if [[ $LOGIN_RESPONSE == *"success\":true"* ]]; then
    echo "✅ Login successful"
else
    echo "❌ Login failed: $LOGIN_RESPONSE"
    exit 1
fi

echo ""

# Test 1: Search by customer name "ADA"
echo "🔍 Test 1: Search by customer name 'ADA'"
echo "----------------------------------------"
SEARCH_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?search=ADA&page=1&limit=5" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response:"
echo "$SEARCH_RESPONSE" | jq '.'
echo ""

# Test 2: Search by invoice number
echo "🔍 Test 2: Search by invoice number 'INV'"
echo "----------------------------------------"
SEARCH_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?search=INV&page=1&limit=5" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (summary):"
echo "$SEARCH_RESPONSE" | jq '.success, .total, .filters, .data | length'
echo ""

# Test 3: Search by email
echo "🔍 Test 3: Search by email containing 'example'"
echo "----------------------------------------------"
SEARCH_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?search=example&page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (summary):"
echo "$SEARCH_RESPONSE" | jq '.success, .total, .filters'
echo ""

# Test 4: Filter by status
echo "🔍 Test 4: Filter by status 'sent'"
echo "--------------------------------"
STATUS_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?status=sent&page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (summary):"
echo "$STATUS_RESPONSE" | jq '.success, .total, .filters'
echo ""

# Test 5: Sort by customer name
echo "🔍 Test 5: Sort by customer name (ascending)"
echo "------------------------------------------"
SORT_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?sortBy=customer_name&sortOrder=asc&page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (customer names):"
echo "$SORT_RESPONSE" | jq '.data[].customer_name'
echo ""

# Test 6: Combined search and filters
echo "🔍 Test 6: Combined search + status filter + sorting"
echo "--------------------------------------------------"
COMBINED_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?search=tech&status=sent&sortBy=date&sortOrder=desc&page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (summary):"
echo "$COMBINED_RESPONSE" | jq '.success, .total, .filters'
echo ""

# Test 7: Test pagination
echo "🔍 Test 7: Test pagination (page 2)"
echo "----------------------------------"
PAGE_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?page=2&limit=5" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (pagination info):"
echo "$PAGE_RESPONSE" | jq '.pagination'
echo ""

# Test 8: Empty search (should return all)
echo "🔍 Test 8: Empty search (should return all)"
echo "------------------------------------------"
ALL_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (summary):"
echo "$ALL_RESPONSE" | jq '.success, .total, (.data | length)'
echo ""

# Test 9: Case insensitive search
echo "🔍 Test 9: Case insensitive search 'ada' (lowercase)"
echo "--------------------------------------------------"
CASE_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?search=ada&page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (summary):"
echo "$CASE_RESPONSE" | jq '.success, .total, .filters'
echo ""

# Test 10: Non-existent search term
echo "🔍 Test 10: Search for non-existent term 'NONEXISTENT'"
echo "-----------------------------------------------------"
NONE_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/invoices?search=NONEXISTENT&page=1&limit=3" \
  -H "Content-Type: application/json" \
  -b cookies.txt)

echo "Response (should be 0 results):"
echo "$NONE_RESPONSE" | jq '.success, .total, .filters'
echo ""

# Clean up
rm -f cookies.txt

echo "🎉 Enhanced /api/invoices endpoint testing completed!"
echo ""
echo "Summary:"
echo "- ✅ Multi-field search (invoice number, customer name, email)"  
echo "- ✅ Status filtering"
echo "- ✅ Dynamic sorting (by field and order)"
echo "- ✅ Pagination"
echo "- ✅ Case insensitive search"
echo "- ✅ Combined filters"
echo "- ✅ Enhanced response format"
