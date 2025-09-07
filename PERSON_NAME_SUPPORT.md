# PersonName Parameter Support Documentation

## Overview
The backend now supports the `personName` parameter in both `/api/invoices` and `/api/purchaseorders` endpoints, allowing admin users to filter results by salesperson name.

## Supported Endpoints

### 1. GET /api/invoices
**Purpose**: Retrieve invoices with optional salesperson filtering

**Authentication**: Required (Bearer token or cookie)

**Authorization**: 
- **Admin users**: Can filter by any salesperson using `personName`
- **Non-admin users**: Can only see their own invoices (personName ignored)

#### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `personName` | string | No | Filter by salesperson name (admin only) |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `date` | string | No | Filter by date (YYYY-MM-DD format) |

#### Example Requests

```bash
# Get all invoices (admin)
GET /api/invoices?page=1&limit=10

# Filter by specific salesperson (admin only)
GET /api/invoices?personName=John%20Smith&page=1&limit=10

# Get all invoices (personName=all is same as no filter)
GET /api/invoices?personName=all&page=1&limit=10

# Combine filters
GET /api/invoices?personName=John%20Smith&date=2024-01-15&page=1&limit=10
```

### 2. GET /api/purchaseorders
**Purpose**: Retrieve purchase orders with optional salesperson filtering

**Same parameters and behavior as `/api/invoices`**

#### Example Requests

```bash
# Filter purchase orders by salesperson (admin only)
GET /api/purchaseorders?personName=Jane%20Doe&page=1&limit=10
```

## Implementation Details

### Salesperson Field Mapping
The system searches across multiple fields to find matching salespeople:
- `salesperson_name`
- `salesperson`
- `cf_sales_person`
- `cf_sales_person_unformatted`

### Name Matching
- **Case-insensitive**: "john smith" matches "John Smith"
- **Space-tolerant**: Handles extra spaces in names
- **Exact matching**: Uses regex for precise name matching
- **Special values**: 'all', '*', or empty string returns all records

### Access Control
- **Admin users**: Can filter by any salesperson name
- **Non-admin users**: Always restricted to their own records, `personName` parameter is ignored

## Response Format

```json
{
  "success": true,
  "message": "Invoices retrieved successfully",
  "data": [
    {
      "invoice_id": "12345",
      "invoice_number": "INV-001",
      "customer_name": "ABC Corp",
      "salesperson_name": "John Smith",
      "salesperson": "John Smith",
      "total": 1500.00,
      "date": "2024-01-15",
      "status": "paid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## Frontend Integration

### JavaScript/Fetch Example
```javascript
async function getInvoicesByPerson(personName, page = 1) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '10'
  });
  
  if (personName && personName !== 'all') {
    params.append('personName', personName);
  }
  
  const response = await fetch(`/api/invoices?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// Usage examples
getInvoicesByPerson('John Smith', 1)
  .then(result => console.log('Filtered invoices:', result.data))
  .catch(error => console.error('Error:', error));

getInvoicesByPerson('all', 1)
  .then(result => console.log('All invoices:', result.data))
  .catch(error => console.error('Error:', error));
```

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';

const InvoicesList = () => {
  const [invoices, setInvoices] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState('all');
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(null);

  const loadInvoices = async (personName = 'all', page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (personName && personName !== 'all') {
        params.append('personName', personName);
      }
      
      const response = await fetch(`/api/invoices?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        }
      });
      
      const data = await response.json();
      setInvoices(data.data || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices(selectedPerson);
  }, [selectedPerson]);

  const handlePersonChange = (e) => {
    setSelectedPerson(e.target.value);
  };

  return (
    <div>
      <div className="filters">
        <label>
          Filter by Salesperson:
          <select value={selectedPerson} onChange={handlePersonChange}>
            <option value="all">All Salespeople</option>
            <option value="John Smith">John Smith</option>
            <option value="Jane Doe">Jane Doe</option>
            <option value="Admin User">Admin User</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="invoices-list">
            {invoices.map(invoice => (
              <div key={invoice.invoice_id} className="invoice-card">
                <h3>{invoice.invoice_number}</h3>
                <p>Customer: {invoice.customer_name}</p>
                <p>Salesperson: {invoice.salesperson_name || invoice.salesperson}</p>
                <p>Total: {invoice.total}</p>
                <p>Date: {invoice.date}</p>
                <p>Status: {invoice.status}</p>
              </div>
            ))}
          </div>

          {pagination && (
            <div className="pagination">
              <span>
                Page {pagination.page} of {pagination.pages} 
                ({pagination.total} total)
              </span>
              <button 
                disabled={pagination.page <= 1}
                onClick={() => loadInvoices(selectedPerson, pagination.page - 1)}
              >
                Previous
              </button>
              <button 
                disabled={pagination.page >= pagination.pages}
                onClick={() => loadInvoices(selectedPerson, pagination.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InvoicesList;
```

## Testing

### Manual Testing with cURL
```bash
# Test with admin token
ADMIN_TOKEN="your_admin_token_here"

# Get all invoices
curl -X GET "http://localhost:3000/api/invoices?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by salesperson
curl -X GET "http://localhost:3000/api/invoices?personName=John%20Smith&page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test purchase orders
curl -X GET "http://localhost:3000/api/purchaseorders?personName=Jane%20Doe&page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Automated Testing
Run the provided test script:
```bash
./test-person-name-filter.sh
```

## Error Handling

### Common Responses

#### Success (200)
```json
{
  "success": true,
  "message": "Invoices retrieved successfully",
  "data": [...],
  "pagination": {...}
}
```

#### Unauthorized (401)
```json
{
  "success": false,
  "message": "Unauthorized access",
  "error": "Invalid or missing token"
}
```

#### Forbidden (403) - Non-admin trying to access others' data
```json
{
  "success": false,
  "message": "Access denied - user not found"
}
```

#### Server Error (500)
```json
{
  "success": false,
  "message": "Error fetching invoices",
  "error": "Database connection failed"
}
```

## Migration Notes

### From Previous Implementation
- The `personName` parameter is now supported (previously missing)
- Backwards compatible - existing calls without `personName` continue to work
- Admin users get full filtering capabilities
- Non-admin users maintain their restricted access

### Database Considerations
- No schema changes required
- Searches across existing salesperson fields
- Performance optimized with proper indexing

### Frontend Compatibility
The backend is now fully compatible with frontend implementations that expect `personName` parameter support. Your frontend can immediately start using this filtering without any backend changes.

---

## Summary

✅ **SUPPORTED**: The backend now fully supports the `personName` parameter in `/api/invoices` and `/api/purchaseorders` endpoints

✅ **ADMIN ONLY**: Filtering by `personName` is restricted to admin users only

✅ **BACKWARDS COMPATIBLE**: Existing API calls continue to work unchanged

✅ **SECURE**: Non-admin users are always restricted to their own records

✅ **FLEXIBLE**: Supports multiple salesperson field names and case-insensitive matching

The implementation is ready for immediate use with your frontend filtering requirements.
