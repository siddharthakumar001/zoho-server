#!/bin/bash

# Quick test script to verify purchase orders filtering is working

echo "🧪 Testing Purchase Orders API Fixes"
echo "===================================="

# Base URL and auth token
BASE_URL="http://localhost:3001"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3N2ZmZWMzNjFjYzZjNWI4ZTk5YzE4NyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTczNjYzNjYxMSwiZXhwIjoxNzM2NzIzMDExfQ.AajzH2fy3bZJxghjgQp7qSjbQQK--WiKIEhVRO76GqM"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test function
test_endpoint() {
    local url="$1"
    local description="$2"
    
    echo -e "\n${BLUE}🔍 Testing: $description${NC}"
    echo -e "${YELLOW}URL: $url${NC}"
    
    local response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$url")
    local success=$(echo "$response" | jq -r '.success // false')
    local count=$(echo "$response" | jq -r '.data | length // 0')
    local total=$(echo "$response" | jq -r '.total // 0')
    
    if [ "$success" = "true" ]; then
        echo -e "${GREEN}✅ Success - Found $count records (total: $total)${NC}"
        
        # Show filter debug info if available
        local filter=$(echo "$response" | jq -r '.filters // {}')
        echo -e "${BLUE}📋 Applied filters: $filter${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
        echo -e "${RED}Response: $response${NC}"
    fi
}

echo -e "${BLUE}🚀 Starting Purchase Orders API Tests${NC}"

# Test 1: Basic call
test_endpoint "$BASE_URL/api/purchaseorders?limit=5" "Basic retrieval (5 records)"

# Test 2: Status filtering
test_endpoint "$BASE_URL/api/purchaseorders?status=billed&limit=5" "Status filter: billed"

# Test 3: Search functionality  
test_endpoint "$BASE_URL/api/purchaseorders?search=REDINGTON&limit=5" "Search: REDINGTON"

# Test 4: Date filtering
test_endpoint "$BASE_URL/api/purchaseorders?date=2025-08-01&limit=5" "Date filter: 2025-08-01"

# Test 5: Combined filters
test_endpoint "$BASE_URL/api/purchaseorders?date=2025-08-01&status=billed&limit=5" "Combined: date + status"

# Test 6: Sorting
test_endpoint "$BASE_URL/api/purchaseorders?sortBy=purchaseorder_number&sortOrder=desc&limit=3" "Sort by PO number (desc)"

echo -e "\n${GREEN}🎉 Test completed!${NC}"
