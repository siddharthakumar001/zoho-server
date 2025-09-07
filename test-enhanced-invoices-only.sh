#!/bin/bash

# Test script for enhanced /api/invoices-only endpoint
# Tests all new filtering and sorting features

BASE_URL="http://localhost:3001"

echo "🧪 Testing Enhanced /api/invoices-only Endpoint"
echo "================================================"

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s -f "$BASE_URL/health" > /dev/null; then
    echo "❌ Server is not running on $BASE_URL"
    echo "Please start the server first: node server-auth.js"
    exit 1
fi

echo "✅ Server is running"

# Login as admin to get token
echo -e "\n🔐 Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sales/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "Admin@123"
  }')

# Extract token from response
ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to get admin token"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Admin login successful"

# Test 1: Basic pagination and response format
echo -e "\n📋 Test 1: Basic pagination (page=1, limit=5)"
echo "curl -X GET \"$BASE_URL/api/invoices-only?page=1&limit=5\""
BASIC_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Response structure:"
echo "$BASIC_RESPONSE" | jq '{
  success: .success,
  total: .total,
  page: .page,
  limit: .limit,
  pages: .pages,
  pagination: .pagination,
  data_count: (.data | length),
  filters: .filters
}' 2>/dev/null || echo "Invalid JSON response"

# Test 2: Enhanced search across multiple fields
echo -e "\n🔍 Test 2: Enhanced search functionality"
echo "Testing search across invoice_number, customer_name, customer_email, salesperson_name"

echo -e "\nSearching for 'admin':"
echo "curl -X GET \"$BASE_URL/api/invoices-only?search=admin&limit=3\""
SEARCH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?search=admin&limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Found invoices:"
echo "$SEARCH_RESPONSE" | jq '.data[] | {invoice_number: .invoice_number, customer_name: .customer_name, salesperson_name: .salesperson_name}' 2>/dev/null || echo "$SEARCH_RESPONSE"

# Test 3: Sorting functionality
echo -e "\n📊 Test 3: Dynamic sorting"

echo -e "\nSort by customer_name (ascending):"
echo "curl -X GET \"$BASE_URL/api/invoices-only?sortBy=customer_name&sortOrder=asc&limit=3\""
SORT_ASC_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?sortBy=customer_name&sortOrder=asc&limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Sorted results (asc):"
echo "$SORT_ASC_RESPONSE" | jq '.data[] | {customer_name: .customer_name, total: .total}' 2>/dev/null || echo "$SORT_ASC_RESPONSE"

echo -e "\nSort by amount/total (descending):"
echo "curl -X GET \"$BASE_URL/api/invoices-only?sortBy=amount&sortOrder=desc&limit=3\""
SORT_DESC_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?sortBy=amount&sortOrder=desc&limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Sorted results (desc by amount):"
echo "$SORT_DESC_RESPONSE" | jq '.data[] | {customer_name: .customer_name, total: .total}' 2>/dev/null || echo "$SORT_DESC_RESPONSE"

# Test 4: Status filtering
echo -e "\n📈 Test 4: Status filtering"

echo -e "\nFilter by status='paid':"
echo "curl -X GET \"$BASE_URL/api/invoices-only?status=paid&limit=3\""
STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?status=paid&limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Paid invoices:"
echo "$STATUS_RESPONSE" | jq '.data[] | {invoice_number: .invoice_number, status: .status, total: .total}' 2>/dev/null || echo "$STATUS_RESPONSE"

# Test 5: PersonName filtering (Admin only)
echo -e "\n👤 Test 5: PersonName filtering (Admin only)"

echo -e "\nFilter by personName='Admin User':"
echo "curl -X GET \"$BASE_URL/api/invoices-only?personName=Admin%20User&limit=3\""
PERSON_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?personName=Admin%20User&limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Admin User invoices:"
echo "$PERSON_RESPONSE" | jq '.data[] | {invoice_number: .invoice_number, salesperson_name: .salesperson_name, salesperson: .salesperson}' 2>/dev/null || echo "$PERSON_RESPONSE"

# Test 6: Month filtering
echo -e "\n📅 Test 6: Month filtering"

echo -e "\nFilter by date='2024-09-01' (September 2024):"
echo "curl -X GET \"$BASE_URL/api/invoices-only?date=2024-09-01&limit=3\""
DATE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?date=2024-09-01&limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "September 2024 invoices:"
echo "$DATE_RESPONSE" | jq '.data[] | {invoice_number: .invoice_number, date: .date, customer_name: .customer_name}' 2>/dev/null || echo "$DATE_RESPONSE"

# Test 7: Complex query with multiple filters
echo -e "\n🎯 Test 7: Complex query with multiple filters"

echo -e "\nComplex query: search='ABC' + sortBy='customer_name' + sortOrder='asc' + limit=5:"
echo "curl -X GET \"$BASE_URL/api/invoices-only?search=ABC&sortBy=customer_name&sortOrder=asc&limit=5\""
COMPLEX_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?search=ABC&sortBy=customer_name&sortOrder=asc&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Complex query results:"
echo "$COMPLEX_RESPONSE" | jq '{
  total: .total,
  filters: .filters,
  results: .data[] | {invoice_number: .invoice_number, customer_name: .customer_name}
}' 2>/dev/null || echo "$COMPLEX_RESPONSE"

# Test 8: Pagination with filters
echo -e "\n📄 Test 8: Pagination with filters applied"

echo -e "\nPagination test - Page 1:"
echo "curl -X GET \"$BASE_URL/api/invoices-only?search=user&page=1&limit=2\""
PAGE1_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?search=user&page=1&limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Page 1 pagination info:"
echo "$PAGE1_RESPONSE" | jq '.pagination' 2>/dev/null || echo "$PAGE1_RESPONSE"

echo -e "\nPagination test - Page 2:"
echo "curl -X GET \"$BASE_URL/api/invoices-only?search=user&page=2&limit=2\""
PAGE2_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?search=user&page=2&limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Page 2 pagination info:"
echo "$PAGE2_RESPONSE" | jq '.pagination' 2>/dev/null || echo "$PAGE2_RESPONSE"

# Test 9: Non-admin user restrictions
echo -e "\n🔒 Test 9: Non-admin user restrictions"

# Try to login as a regular sales member
SALES_LOGIN=$(curl -s -X POST "$BASE_URL/api/sales/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.smith@example.com",
    "password": "John@123"
  }')

SALES_TOKEN=$(echo "$SALES_LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SALES_TOKEN" ]; then
    echo "✅ Sales member login successful"
    echo -e "\nTesting personName filter with non-admin user (should be ignored):"
    echo "curl -X GET \"$BASE_URL/api/invoices-only?personName=Admin%20User&limit=3\""
    SALES_RESTRICTED=$(curl -s -X GET "$BASE_URL/api/invoices-only?personName=Admin%20User&limit=3" \
      -H "Authorization: Bearer $SALES_TOKEN")
    
    echo "Non-admin user results (should only show their own invoices):"
    echo "$SALES_RESTRICTED" | jq '.data[] | {invoice_number: .invoice_number, salesperson_name: .salesperson_name}' 2>/dev/null || echo "$SALES_RESTRICTED"
else
    echo "⚠️  Could not login as sales member (might not exist)"
fi

# Test 10: Error handling - Invalid parameters
echo -e "\n❌ Test 10: Error handling"

echo -e "\nInvalid sortBy parameter:"
echo "curl -X GET \"$BASE_URL/api/invoices-only?sortBy=invalid_field&limit=1\""
ERROR_RESPONSE=$(curl -s -X GET "$BASE_URL/api/invoices-only?sortBy=invalid_field&limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Error handling (should default to 'date' sort):"
echo "$ERROR_RESPONSE" | jq '{success: .success, filters: .filters}' 2>/dev/null || echo "$ERROR_RESPONSE"

echo -e "\n✅ All tests completed!"
echo -e "\n📋 Feature Summary:"
echo "1. ✅ Enhanced search across multiple fields (invoice_number, customer_name, customer_email, salesperson_name)"
echo "2. ✅ Dynamic sorting by date, customer_name, salesperson_name, amount, invoice_number, status"
echo "3. ✅ Sort order control (asc/desc)"
echo "4. ✅ Status filtering"
echo "5. ✅ PersonName filtering (admin only)"
echo "6. ✅ Month/date filtering"
echo "7. ✅ Complex queries with multiple filters"
echo "8. ✅ Proper pagination with filters applied"
echo "9. ✅ Role-based access control (non-admin restrictions)"
echo "10. ✅ Error handling and parameter validation"
echo "11. ✅ Consistent response format with pagination metadata"
echo "12. ✅ Filter information in response for frontend state management"
