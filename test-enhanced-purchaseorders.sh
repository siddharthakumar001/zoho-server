#!/bin/bash

# Test script for enhanced purchase orders API endpoints
# Tests /api/purchaseorders and /api/purchaseorders-only with advanced filtering, sorting, and search

echo "🧪 Testing Enhanced Purchase Orders API Endpoints"
echo "================================================"

# Base URL and auth token (update as needed)
BASE_URL="http://localhost:3001"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3N2ZmZWMzNjFjYzZjNWI4ZTk5YzE4NyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNjYzNjYxMSwiZXhwIjoxNzM2NzIzMDExfQ.AajzH2fy3bZJxghjgQp7qSjbQQK--WiKIEhVRO76GqM"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API call and display results
test_api() {
    local endpoint="$1"
    local params="$2"
    local description="$3"
    
    echo -e "\n${BLUE}🔍 Testing: $description${NC}"
    echo -e "${YELLOW}Endpoint: $endpoint${NC}"
    echo -e "${YELLOW}Parameters: $params${NC}"
    
    local url="$BASE_URL$endpoint"
    if [ -n "$params" ]; then
        url="$url?$params"
    fi
    
    local response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$url")
    local success=$(echo "$response" | jq -r '.success // false')
    local count=$(echo "$response" | jq -r '.data | length // 0')
    local total=$(echo "$response" | jq -r '.total // 0')
    local message=$(echo "$response" | jq -r '.message // "No message"')
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✅ Success: $message${NC}"
        echo -e "${GREEN}📊 Found $count purchase orders (total: $total)${NC}"
        
        # Show sample data if available
        if [ "$count" -gt "0" ]; then
            echo -e "${BLUE}📋 Sample data:${NC}"
            echo "$response" | jq -r '.data[0] | {
                purchaseorder_number: .purchaseorder_number,
                vendor_name: .vendor_name,
                company_name: .company_name,
                total: .total,
                status: .status,
                date: .date,
                cf_sales_person: .cf_sales_person
            }' 2>/dev/null || echo "No sample data to display"
        fi
    else
        echo -e "${RED}❌ Failed: $message${NC}"
        echo -e "${RED}Response: $response${NC}"
    fi
}

echo -e "\n${BLUE}🚀 Starting Purchase Orders API Tests${NC}"

# Test 1: Basic retrieval (both endpoints)
test_api "/api/purchaseorders" "" "Basic purchase orders retrieval"
test_api "/api/purchaseorders-only" "" "Basic purchase orders-only retrieval"

# Test 2: Pagination
test_api "/api/purchaseorders" "page=1&limit=5" "Pagination (page 1, limit 5)"
test_api "/api/purchaseorders-only" "page=1&limit=5" "Pagination for purchaseorders-only"

# Test 3: Search functionality
test_api "/api/purchaseorders" "search=PO" "Search by PO number prefix"
test_api "/api/purchaseorders" "search=vendor" "Search by vendor name"
test_api "/api/purchaseorders-only" "search=PO" "Search in purchaseorders-only"

# Test 4: Status filtering
test_api "/api/purchaseorders" "status=open" "Filter by open status"
test_api "/api/purchaseorders" "status=billed" "Filter by billed status"
test_api "/api/purchaseorders-only" "status=open" "Status filter in purchaseorders-only"

# Test 5: Sorting
test_api "/api/purchaseorders" "sortBy=vendor_name&sortOrder=asc" "Sort by vendor name (ascending)"
test_api "/api/purchaseorders" "sortBy=total&sortOrder=desc" "Sort by total amount (descending)"
test_api "/api/purchaseorders" "sortBy=date&sortOrder=asc" "Sort by date (ascending)"
test_api "/api/purchaseorders-only" "sortBy=vendor_name&sortOrder=asc" "Sort in purchaseorders-only"

# Test 6: Date filtering
test_api "/api/purchaseorders" "date=2024-01-01" "Filter by specific date"
test_api "/api/purchaseorders" "date=2024-01-01" "Month filter (2024-01)"
test_api "/api/purchaseorders-only" "date=2024-01-01" "Date filter in purchaseorders-only"

# Test 7: Combined filters
test_api "/api/purchaseorders" "search=PO&status=open&sortBy=date&sortOrder=desc" "Combined: search + status + sort"
test_api "/api/purchaseorders" "search=vendor&sortBy=total&sortOrder=desc&limit=3" "Combined: search + sort + pagination"
test_api "/api/purchaseorders-only" "search=PO&status=open&sortBy=date&sortOrder=desc" "Combined filters in purchaseorders-only"

# Test 8: Admin-specific features (personName filtering)
test_api "/api/purchaseorders" "personName=John" "Admin: Filter by salesperson name"
test_api "/api/purchaseorders" "personName=Smith" "Admin: Filter by different salesperson"
test_api "/api/purchaseorders-only" "personName=John" "Admin: PersonName filter in purchaseorders-only"

# Test 9: Edge cases
test_api "/api/purchaseorders" "search=" "Empty search parameter"
test_api "/api/purchaseorders" "status=all" "Status filter with 'all'"
test_api "/api/purchaseorders" "personName=*" "PersonName filter with wildcard"
test_api "/api/purchaseorders" "limit=1000" "Large limit (should cap at 100)"
test_api "/api/purchaseorders-only" "search=&status=all" "Multiple empty parameters"

# Test 10: Error cases
test_api "/api/purchaseorders" "page=abc" "Invalid page parameter"
test_api "/api/purchaseorders" "sortBy=invalid_field" "Invalid sort field"
test_api "/api/purchaseorders-only" "limit=abc" "Invalid limit parameter"

echo -e "\n${GREEN}🎉 Purchase Orders API testing completed!${NC}"
echo -e "${BLUE}💡 Both /api/purchaseorders and /api/purchaseorders-only now support:${NC}"
echo -e "   • Multi-field search (PO number, vendor, company, salesperson, reference)"
echo -e "   • Status filtering (across multiple status fields)"
echo -e "   • Dynamic sorting (by date, vendor, company, amount, status, etc.)"
echo -e "   • Enhanced date filtering (month/day)"
echo -e "   • Role-based access and person filtering for admins"
echo -e "   • Pagination with comprehensive metadata"
