# Enhanced Purchase Orders API Documentation

## Overview

The purchase orders API endpoints provide comprehensive access to purchase order data with advanced filtering, searching, and sorting capabilities. This document describes the enhanced features available in both `/api/purchaseorders` and `/api/purchaseorders-only` endpoints.

## Endpoints

### GET /api/purchaseorders
### GET /api/purchaseorders-only

Both endpoints provide identical functionality with enhanced filtering, searching, and sorting capabilities.

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <your-jwt-token>
```

## Query Parameters

### Core Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 25 | Items per page (max 100) |
| `search` | string | - | Multi-field search term |
| `status` | string | - | Filter by status |
| `date` | string | - | Filter by date (YYYY-MM-DD or YYYY-MM-01) |
| `personName` | string | - | Filter by salesperson (admin only) |
| `sortBy` | string | date | Field to sort by |
| `sortOrder` | string | desc | Sort direction (asc/desc) |

### Search Fields

The `search` parameter performs case-insensitive search across:
- `purchaseorder_number` - Purchase order number
- `vendor_name` - Vendor/supplier name
- `company_name` - Company name
- `cf_sales_person` - Salesperson name
- `reference_number` - Reference number

### Status Filtering

The `status` parameter checks multiple status fields:
- `status` - General status
- `order_status` - Order status
- `billed_status` - Billing status
- `received_status` - Received status

Special values:
- `all` - Returns all statuses (same as omitting parameter)

### Sort Fields

Available `sortBy` options:
- `date` - Purchase order date
- `vendor_name`, `vendor` - Vendor name
- `company_name`, `company` - Company name
- `salesperson_name`, `salesperson` - Salesperson
- `amount`, `total` - Total amount
- `purchaseorder_number`, `po_number` - PO number
- `status` - Status
- `order_status` - Order status
- `created_time` - Creation time
- `delivery_date` - Delivery date

### Date Filtering

The `date` parameter supports:
- **Specific day**: `2024-01-15` (returns POs for that day)
- **Full month**: `2024-01-01` (returns POs for entire month)

## Role-Based Access

### Admin Users
- Access to all purchase orders
- Can use `personName` parameter to filter by salesperson
- Full search and filtering capabilities

### Non-Admin Users
- Only see purchase orders assigned to them
- Access based on salesperson fields matching their profile
- All other filtering capabilities available

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Purchase orders retrieved successfully",
  "data": [...], // Array of purchase order objects
  "total": 150,
  "page": 1,
  "limit": 25,
  "pages": 6,
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "filters": {
    "date": "2024-01-01",
    "personName": "John Smith",
    "search": "PO123",
    "status": "open",
    "sortBy": "date",
    "sortOrder": "desc"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Example Usage

### Basic Retrieval
```
GET /api/purchaseorders
```

### Search for Purchase Orders
```
GET /api/purchaseorders?search=PO123
GET /api/purchaseorders?search=Acme
```

### Filter by Status
```
GET /api/purchaseorders?status=open
GET /api/purchaseorders?status=billed
```

### Sort Purchase Orders
```
GET /api/purchaseorders?sortBy=vendor_name&sortOrder=asc
GET /api/purchaseorders?sortBy=total&sortOrder=desc
```

### Date Filtering
```
GET /api/purchaseorders?date=2024-01-15  # Specific day
GET /api/purchaseorders?date=2024-01-01  # Full month
```

### Pagination
```
GET /api/purchaseorders?page=2&limit=10
```

### Combined Filters
```
GET /api/purchaseorders?search=vendor&status=open&sortBy=date&sortOrder=desc&limit=20
```

### Admin: Filter by Salesperson
```
GET /api/purchaseorders?personName=John Smith
```

## Purchase Order Data Structure

Each purchase order object contains fields such as:
- `purchaseorder_number` - PO number
- `vendor_name` - Vendor/supplier name
- `company_name` - Company name
- `total` - Total amount
- `status` - Various status fields
- `date` - Purchase order date
- `cf_sales_person` - Salesperson information
- `delivery_date` - Expected delivery date
- `reference_number` - Reference number

## Error Handling

The API handles various error conditions:
- Invalid authentication tokens (401)
- Access denied for non-admin users (403)
- Invalid query parameters (graceful fallbacks)
- Database connection issues (500)

## Rate Limiting

- Maximum 100 items per page (enforced by `limit` parameter)
- Efficient database queries with proper indexing
- Pagination recommended for large datasets

## Testing

Use the provided test script to verify functionality:
```bash
./test-enhanced-purchaseorders.sh
```

The test script covers:
- Basic retrieval
- Search functionality
- Status filtering
- Sorting options
- Date filtering
- Combined filters
- Role-based access
- Error conditions
