# Enhanced Invoice API Documentation

## GET /api/invoices-only - Enhanced Filtering & Sorting

### Overview
The `/api/invoices-only` endpoint now supports comprehensive filtering, sorting, and search capabilities to match the enhanced frontend requirements.

### Base URL
```
http://localhost:5000/api/invoices-only
```

### Authentication
- **Required**: Bearer token or cookie authentication
- **Admin Users**: Full access to all invoices with filtering capabilities
- **Non-Admin Users**: Restricted to their own invoices only

---

## Parameters

### Pagination
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-based) |
| `limit` | integer | 25 | 100 | Items per page |

### Filtering
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | string | Search across invoice_number, customer_name, customer_email, salesperson_name | `search=ABC123` |
| `personName` | string | Filter by salesperson name (admin only) | `personName=John%20Smith` |
| `status` | string | Filter by invoice status | `status=paid` |
| `date` | string | Month filter (YYYY-MM-01) or day filter (YYYY-MM-DD) | `date=2024-09-01` |

### Sorting
| Parameter | Type | Options | Default | Description |
|-----------|------|---------|---------|-------------|
| `sortBy` | string | `date`, `customer_name`, `salesperson_name`, `amount`, `invoice_number`, `status` | `date` | Field to sort by |
| `sortOrder` | string | `asc`, `desc` | `desc` | Sort direction |

---

## API Examples

### 1. Basic Pagination
```bash
GET /api/invoices-only?page=1&limit=25
```

### 2. Enhanced Search
```bash
# Search across multiple fields
GET /api/invoices-only?search=John&page=1&limit=25

# Search for specific invoice
GET /api/invoices-only?search=INV-123&page=1&limit=25
```

### 3. Sorting Examples
```bash
# Sort by customer name (ascending)
GET /api/invoices-only?sortBy=customer_name&sortOrder=asc&page=1&limit=25

# Sort by amount (descending)
GET /api/invoices-only?sortBy=amount&sortOrder=desc&page=1&limit=25

# Sort by date (latest first)
GET /api/invoices-only?sortBy=date&sortOrder=desc&page=1&limit=25
```

### 4. Status Filtering
```bash
# Get only paid invoices
GET /api/invoices-only?status=paid&page=1&limit=25

# Get draft invoices
GET /api/invoices-only?status=draft&page=1&limit=25
```

### 5. PersonName Filtering (Admin Only)
```bash
# Filter by specific salesperson
GET /api/invoices-only?personName=John%20Doe&page=1&limit=25

# Get all salespeople (equivalent to no filter)
GET /api/invoices-only?personName=all&page=1&limit=25
```

### 6. Date Filtering
```bash
# Month filter (all invoices in September 2024)
GET /api/invoices-only?date=2024-09-01&page=1&limit=25

# Specific day filter
GET /api/invoices-only?date=2024-09-15&page=1&limit=25
```

### 7. Complex Queries
```bash
# Multiple filters combined
GET /api/invoices-only?search=ABC&personName=John%20Smith&status=paid&sortBy=amount&sortOrder=desc&page=1&limit=25

# Search + sorting + pagination
GET /api/invoices-only?search=customer&sortBy=customer_name&sortOrder=asc&page=2&limit=50
```

---

## Response Format

```json
{
  "success": true,
  "message": "Invoices retrieved successfully",
  "data": [
    {
      "_id": "60f7d1234567890123456789",
      "invoice_id": "INV123456",
      "invoice_number": "INV-2024-001",
      "customer_name": "ABC Corporation",
      "customer_email": "contact@abc.com",
      "salesperson_name": "John Smith",
      "salesperson": "John Smith",
      "status": "paid",
      "total": 1500.00,
      "date": "2024-09-15",
      "created_time": "2024-09-15T10:30:00.000Z"
    }
  ],
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
    "search": "ABC",
    "personName": "John Smith",
    "status": "paid",
    "sortBy": "amount",
    "sortOrder": "desc"
  }
}
```

### Response Fields

#### Main Response
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `message` | string | Response message |
| `data` | array | Array of invoice objects |
| `total` | number | Total number of matching invoices |
| `page` | number | Current page number |
| `limit` | number | Items per page |
| `pages` | number | Total number of pages |

#### Pagination Object
| Field | Type | Description |
|-------|------|-------------|
| `page` | number | Current page number |
| `limit` | number | Items per page |
| `total` | number | Total number of matching invoices |
| `totalPages` | number | Total number of pages |
| `hasNextPage` | boolean | Whether there are more pages |
| `hasPrevPage` | boolean | Whether there are previous pages |

#### Filters Object
| Field | Type | Description |
|-------|------|-------------|
| `search` | string/undefined | Applied search term |
| `personName` | string/undefined | Applied salesperson filter |
| `status` | string/undefined | Applied status filter |
| `date` | string/undefined | Applied date filter |
| `sortBy` | string | Applied sort field |
| `sortOrder` | string | Applied sort direction |

#### Invoice Object
| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | MongoDB document ID |
| `invoice_id` | string | Zoho invoice ID |
| `invoice_number` | string | Invoice number |
| `customer_name` | string | Customer name |
| `customer_email` | string | Customer email |
| `salesperson_name` | string | Salesperson name |
| `salesperson` | string | Alternative salesperson field |
| `status` | string | Invoice status |
| `total` | number | Invoice total amount |
| `date` | string | Invoice date (YYYY-MM-DD) |
| `created_time` | string | ISO timestamp |

---

## Frontend Integration

### JavaScript/Fetch Example
```javascript
class InvoiceAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async getInvoices(options = {}) {
    const {
      page = 1,
      limit = 25,
      search = '',
      personName = '',
      status = '',
      date = '',
      sortBy = 'date',
      sortOrder = 'desc'
    } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder
    });

    if (search) params.append('search', search);
    if (personName && personName !== 'all') params.append('personName', personName);
    if (status && status !== 'all') params.append('status', status);
    if (date) params.append('date', date);

    const response = await fetch(`${this.baseURL}/api/invoices-only?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Convenience methods
  async searchInvoices(searchTerm, options = {}) {
    return this.getInvoices({ search: searchTerm, ...options });
  }

  async getInvoicesByPerson(personName, options = {}) {
    return this.getInvoices({ personName, ...options });
  }

  async getInvoicesByStatus(status, options = {}) {
    return this.getInvoices({ status, ...options });
  }

  async getInvoicesByMonth(year, month, options = {}) {
    const date = `${year}-${month.toString().padStart(2, '0')}-01`;
    return this.getInvoices({ date, ...options });
  }
}

// Usage example
const api = new InvoiceAPI('http://localhost:5000', localStorage.getItem('token'));

// Get invoices with complex filtering
api.getInvoices({
  search: 'ABC Corp',
  personName: 'John Smith',
  status: 'paid',
  sortBy: 'amount',
  sortOrder: 'desc',
  page: 1,
  limit: 50
}).then(result => {
  console.log('Filtered invoices:', result.data);
  console.log('Applied filters:', result.filters);
  console.log('Pagination:', result.pagination);
}).catch(error => {
  console.error('Error:', error);
});
```

### React Hook Example
```jsx
import { useState, useEffect, useCallback } from 'react';

const useInvoices = (initialFilters = {}) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    search: '',
    personName: '',
    status: '',
    date: '',
    sortBy: 'date',
    sortOrder: 'desc',
    ...initialFilters
  });

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/invoices-only?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setInvoices(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page !== undefined ? newFilters.page : 1 // Reset to page 1 when filters change
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 25,
      search: '',
      personName: '',
      status: '',
      date: '',
      sortBy: 'date',
      sortOrder: 'desc'
    });
  }, []);

  return {
    invoices,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    clearFilters,
    refetch: fetchInvoices
  };
};

// Usage in component
const InvoiceList = () => {
  const {
    invoices,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    clearFilters
  } = useInvoices();

  const handleSearch = (search) => {
    updateFilters({ search });
  };

  const handleSort = (sortBy) => {
    const sortOrder = filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    updateFilters({ sortBy, sortOrder });
  };

  const handlePageChange = (page) => {
    updateFilters({ page });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div className="filters">
        <input
          type="text"
          placeholder="Search invoices..."
          value={filters.search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          value={filters.status}
          onChange={(e) => updateFilters({ status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
        <button onClick={clearFilters}>Clear Filters</button>
      </div>

      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort('invoice_number')}>
              Invoice # {filters.sortBy === 'invoice_number' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => handleSort('customer_name')}>
              Customer {filters.sortBy === 'customer_name' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => handleSort('amount')}>
              Amount {filters.sortBy === 'amount' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th onClick={() => handleSort('date')}>
              Date {filters.sortBy === 'date' ? (filters.sortOrder === 'asc' ? '↑' : '↓') : ''}
            </th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(invoice => (
            <tr key={invoice._id}>
              <td>{invoice.invoice_number}</td>
              <td>{invoice.customer_name}</td>
              <td>${invoice.total}</td>
              <td>{invoice.date}</td>
              <td>{invoice.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && (
        <div className="pagination">
          <button 
            disabled={!pagination.hasPrevPage}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages} 
            ({pagination.total} total)
          </span>
          <button 
            disabled={!pagination.hasNextPage}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## Access Control

### Admin Users
- ✅ Can filter by any salesperson using `personName`
- ✅ Can see all invoices
- ✅ Full access to all filtering and sorting options

### Non-Admin Users
- ✅ Automatically restricted to their own invoices
- ❌ `personName` parameter is ignored
- ✅ Can use search, sorting, and other filters on their own data

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized access",
  "error": "Invalid or missing token"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied - user not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error fetching invoices",
  "error": "Database connection failed"
}
```

---

## Testing

Run the comprehensive test script:
```bash
./test-enhanced-invoices-only.sh
```

This will test all the enhanced features including:
- ✅ Enhanced search functionality
- ✅ Dynamic sorting capabilities
- ✅ Status filtering
- ✅ PersonName filtering (admin only)
- ✅ Date/month filtering
- ✅ Complex multi-filter queries
- ✅ Pagination with filters
- ✅ Role-based access control
- ✅ Error handling

---

## Summary of Enhancements

### ✅ Implemented Features

1. **Enhanced Search**: Search across invoice_number, customer_name, customer_email, salesperson_name
2. **Dynamic Sorting**: Sort by date, customer_name, salesperson_name, amount, invoice_number, status
3. **Sort Direction**: Ascending/descending control
4. **Status Filtering**: Filter by invoice status (draft, sent, paid, overdue)
5. **PersonName Filtering**: Admin-only salesperson filtering
6. **Month Filtering**: Filter by month (YYYY-MM-01) or specific date
7. **Complex Queries**: Multiple filters can be combined
8. **Improved Pagination**: Enhanced pagination metadata
9. **Role-based Access**: Non-admin users restricted to own invoices
10. **Response Format**: Consistent structure with filter information
11. **Error Handling**: Proper validation and error responses

### 🔄 Backwards Compatibility
- All existing API calls continue to work
- Response format enhanced but maintains core structure
- Default values ensure smooth transition

The backend is now fully compatible with your enhanced frontend filtering and sorting requirements!
