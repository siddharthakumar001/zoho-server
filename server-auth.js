import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import SalesMember from "./src/models/SalesMember.js";
import Invoice from "./src/models/Invoice.js";
import PurchaseOrder from "./src/models/PurchaseOrder.js";
import { listPiSummaryOnly } from "./src/controllers/salesController.js";
import { updateSalesMember, listSalesMembers } from "./src/controllers/salesMemberController.js";

dotenv.config();

const app = express();

console.log('🚀 Starting authentication server with database...');

// Connect to MongoDB
try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database:', mongoose.connection.db.databaseName);
} catch (error) {
  console.error('❌ MongoDB connection failed:', error.message);
  process.exit(1);
}

// Most permissive CORS setup for testing
app.use((req, res, next) => {
  console.log(`📧 ${req.method} ${req.url} from ${req.headers.origin || 'no-origin'}`);
  
  // Set CORS headers manually
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling preflight request');
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Add cookie parser middleware

// Authentication middleware
function authenticateToken(req, res, next) {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.accessTokenSales;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      console.log('❌ No authentication token provided for:', req.originalUrl);
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('✅ Authenticated user:', decoded.email, 'for:', req.originalUrl);
    next();
    
  } catch (error) {
    console.log('❌ Authentication failed for:', req.originalUrl, error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server with database authentication is running!',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Real login endpoint with database authentication
app.post('/api/sales/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    console.log('📦 Request body:', req.body);
    console.log('🌐 Origin:', req.headers.origin);
    
    // Handle both 'email' and 'identifier' from frontend
    const { email, identifier, password } = req.body;
    const userEmail = email || identifier; // Support both field names
    
    console.log('📧 Email extracted:', userEmail);
    console.log('🔑 Password provided:', !!password);
    
    if (!userEmail || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required',
        debug: {
          email: !!userEmail,
          password: !!password
        }
      });
    }

    // Find user in database
    console.log('🔍 Looking for user in database...');
    const user = await SalesMember.findOne({ 
      email: userEmail.toLowerCase() 
    }).select('+password');
    
    if (!user) {
      console.log('❌ User not found:', userEmail);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password',
        debug: { userFound: false }
      });
    }

    console.log('✅ User found:', user.email);
    console.log('👤 User details:', {
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      isAdmin: user.isAdmin
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User is inactive');
      return res.status(401).json({ 
        success: false,
        message: 'Account is inactive. Please contact administrator.',
        debug: { userActive: false }
      });
    }

    // Compare password
    console.log('🔐 Comparing password...');
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password',
        debug: { passwordMatch: false }
      });
    }

    console.log('✅ Password matches');

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        type: 'sales',
        role: user.isAdmin ? 'admin' : 'sales'
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ Login successful for:', userEmail);

    // Set the accessTokenSales cookie
    res.cookie('accessTokenSales', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    console.log('🍪 Cookie set: accessTokenSales');

    res.json({
      success: true,
      message: 'Login successful',
      user: { 
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.isAdmin ? 'admin' : 'sales',
        isAdmin: user.isAdmin,
        phone: user.phone
      },
      accessToken: token
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Logout endpoint to clear the cookie
app.post('/api/sales/auth/logout', (req, res) => {
  console.log('🚪 Logout request received');
  
  // Clear the accessTokenSales cookie
  res.clearCookie('accessTokenSales', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  console.log('🍪 Cookie cleared: accessTokenSales');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Protected endpoint that checks for cookie authentication
app.get('/api/sales/auth/me', (req, res) => {
  try {
    console.log('👤 Me endpoint requested');
    
    // Get token from cookie or Authorization header
    let token = req.cookies?.accessTokenSales;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    console.log('🔍 Token source:', req.cookies?.accessTokenSales ? 'cookie' : 'header');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified for user:', decoded.email);
    
    res.json({
      success: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        type: decoded.type
      }
    });
    
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
});

// Sales members endpoint with authentication and pagination
app.get('/api/admin/sales-members', authenticateToken, listSalesMembers);

// Update sales member endpoint
app.put('/api/admin/sales-members/:id', authenticateToken, updateSalesMember);

// Invoices endpoint with pagination and filtering
app.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    console.log('📄 Invoices requested with params:', req.query);
    console.log('👤 User role:', req.user.role, 'User ID:', req.user.id);
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Extract all filter parameters
    const {
      date,
      personName,
      search,
      status,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter
    let filter = {};
    
    // Role-based access control
    if (req.user.role !== 'admin') {
      // Non-admin users can only see their own invoices
      const salesMember = await SalesMember.findById(req.user.id);
      if (!salesMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user not found'
        });
      }
      
      // Filter by salesperson - check multiple fields
      const userFilter = {
        $or: [
          { salesperson_id: salesMember.zoho_id || req.user.id },
          { salesperson_name: salesMember.name },
          { salesperson: salesMember.name }
        ]
      };
      filter = { ...filter, ...userFilter };
      console.log('🔒 Non-admin user, filtering by salesperson:', salesMember.name);
    } else {
      console.log('👑 Admin user - access to all invoices');
      
      // Admin users can filter by personName/salesperson
      if (personName && personName.trim() && !['all', '*', ''].includes(personName.trim().toLowerCase())) {
        const nameRegex = new RegExp(`^\\s*${personName.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}\\s*$`, 'i');
        filter.$or = [
          { salesperson_name: nameRegex },
          { salesperson: nameRegex },
          { cf_sales_person: nameRegex },
          { cf_sales_person_unformatted: nameRegex }
        ];
        console.log('🔍 Admin filtering by salesperson:', personName.trim());
      }
    }
    
    // Date filtering (month filter)
    if (date) {
      let startDate, endDate;
      
      if (date.includes('-01')) {
        // Month format: YYYY-MM-01
        const [year, month] = date.split('-');
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 1); // First day of next month
      } else {
        // Day format: YYYY-MM-DD
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
      }
      
      filter.date = {
        $gte: startDate.toISOString().split('T')[0],
        $lt: endDate.toISOString().split('T')[0]
      };
      console.log('📅 Date filter applied:', filter.date);
    }
    
    // Status filtering
    if (status && status.trim() && status.toLowerCase() !== 'all') {
      filter.status = status.trim();
      console.log('� Status filter applied:', status.trim());
    }
    
    // Enhanced search across multiple fields
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { invoice_number: searchRegex },
        { customer_name: searchRegex },
        { customer_email: searchRegex },
        { email: searchRegex },
        { salesperson_name: searchRegex },
        { salesperson: searchRegex }
      ];
      
      if (filter.$or) {
        // If we already have $or for personName, we need to use $and
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
      console.log('�🔍 Search filter applied for:', search.trim());
    }

    // Dynamic sorting
    const sortOptions = {
      date: 'date',
      customer_name: 'customer_name',
      customer: 'customer_name', // fallback
      salesperson_name: 'salesperson_name',
      salesperson: 'salesperson_name', // fallback
      amount: 'total',
      invoice_number: 'invoice_number',
      status: 'status',
      created_time: 'created_time'
    };
    
    const sortField = sortOptions[sortBy] || 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortQuery = { [sortField]: sortDirection };
    
    // Add secondary sort for consistency
    if (sortField !== '_id') {
      sortQuery._id = sortDirection;
    }
    
    console.log('🔍 Final query filter:', filter);
    console.log('📊 Sort query:', sortQuery);

    // Get invoices with pagination and sorting
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    // Build pagination metadata
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    console.log(`✅ Found ${invoices.length} invoices (${total} total)`);

    res.json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: invoices,
      total,
      page,
      limit,
      pages: totalPages,
      pagination,
      filters: {
        date: date || undefined,
        personName: (req.user.role === 'admin' && personName && !['all', '*', ''].includes(personName?.toLowerCase())) ? personName : undefined,
        search: search || undefined,
        status: status && status.toLowerCase() !== 'all' ? status : undefined,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('❌ Error fetching invoices:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
});

// Purchase Orders endpoint with pagination and filtering
app.get('/api/purchaseorders', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Purchase orders requested with params:', req.query);
    console.log('👤 User role:', req.user.role, 'User ID:', req.user.id);
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Extract all filter parameters
    const {
      date,
      personName,
      search,
      status,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter using $and to combine all conditions properly
    let andConditions = [];
    
    // Role-based access control
    if (req.user.role !== 'admin') {
      // Non-admin users can only see their own purchase orders
      const salesMember = await SalesMember.findById(req.user.id);
      if (!salesMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user not found'
        });
      }
      
      // Filter by salesperson - check multiple fields
      andConditions.push({
        $or: [
          { cf_sales_person_unformatted: salesMember.zoho_id || req.user.id },
          { cf_sales_person: salesMember.name },
          { salesperson_name: salesMember.name },
          { salesperson: salesMember.name }
        ]
      });
      console.log('🔒 Non-admin user, filtering by salesperson:', salesMember.name);
    } else {
      console.log('👑 Admin user - access to all purchase orders');
      
      // Admin users can filter by personName/salesperson
      if (personName && personName.trim() && !['all', '*', ''].includes(personName.trim().toLowerCase())) {
        const nameRegex = new RegExp(`^\\s*${personName.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}\\s*$`, 'i');
        andConditions.push({
          $or: [
            { cf_sales_person: nameRegex },
            { cf_sales_person_unformatted: nameRegex },
            { salesperson_name: nameRegex },
            { salesperson: nameRegex }
          ]
        });
        console.log('🔍 Admin filtering by salesperson:', personName.trim());
      }
    }
    
    // Date filtering
    if (date) {
      let startDate, endDate;
      
      if (date.includes('-01')) {
        // Month format: YYYY-MM-01
        const [year, month] = date.split('-');
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 1); // First day of next month
      } else {
        // Day format: YYYY-MM-DD
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
      }
      
      andConditions.push({
        date: {
          $gte: startDate.toISOString().split('T')[0],
          $lt: endDate.toISOString().split('T')[0]
        }
      });
      console.log('📅 Date filter applied for:', date);
    }
    
    // Status filtering
    if (status && status.trim() && status.toLowerCase() !== 'all') {
      andConditions.push({
        $or: [
          { status: status.trim() },
          { order_status: status.trim() },
          { billed_status: status.trim() },
          { received_status: status.trim() }
        ]
      });
      console.log('📊 Status filter applied:', status.trim());
    }
    
    // Enhanced search across multiple fields
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andConditions.push({
        $or: [
          { purchaseorder_number: searchRegex },
          { vendor_name: searchRegex },
          { company_name: searchRegex },
          { cf_sales_person: searchRegex },
          { cf_sales_person_unformatted: searchRegex },
          { reference_number: searchRegex }
        ]
      });
      console.log('🔍 Search filter applied for:', search.trim());
    }

    // Build final filter
    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    // Dynamic sorting
    const sortOptions = {
      date: 'date',
      vendor_name: 'vendor_name',
      vendor: 'vendor_name', // fallback
      company_name: 'company_name',
      company: 'company_name', // fallback
      salesperson_name: 'cf_sales_person',
      salesperson: 'cf_sales_person', // fallback
      amount: 'total',
      total: 'total',
      purchaseorder_number: 'purchaseorder_number',
      po_number: 'purchaseorder_number', // fallback
      status: 'status',
      order_status: 'order_status',
      created_time: 'created_time',
      delivery_date: 'delivery_date'
    };
    
    const sortField = sortOptions[sortBy] || 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortQuery = { [sortField]: sortDirection };
    
    // Add secondary sort for consistency
    if (sortField !== '_id') {
      sortQuery._id = sortDirection;
    }
    
    console.log('🔍 Final query filter:', JSON.stringify(filter, null, 2));
    console.log('📊 Sort query:', sortQuery);

    // Get purchase orders with pagination and sorting
    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(filter)
    ]);

    // Build pagination metadata
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    console.log(`✅ Found ${purchaseOrders.length} purchase orders (${total} total)`);

    res.json({
      success: true,
      message: 'Purchase orders retrieved successfully',
      data: purchaseOrders,
      total,
      page,
      limit,
      pages: totalPages,
      pagination,
      filters: {
        date: date || undefined,
        personName: (req.user.role === 'admin' && personName && !['all', '*', ''].includes(personName?.toLowerCase())) ? personName : undefined,
        search: search || undefined,
        status: status && status.toLowerCase() !== 'all' ? status : undefined,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('❌ Error fetching purchase orders:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
});

// Get invoice by ID
// Single invoice endpoint
app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    console.log('📄 Invoice by ID requested:', req.params.id);
    
    const invoice = await Invoice.findOne({ 
      $or: [
        { invoice_id: req.params.id },
        { _id: req.params.id }
      ]
    }).lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    console.log('✅ Invoice found:', invoice.invoice_number);

    res.json({
      success: true,
      message: 'Invoice retrieved successfully',
      data: invoice
    });

  } catch (error) {
    console.error('❌ Error fetching invoice:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error.message
    });
  }
});

// Get purchase order by ID
// Single purchase order endpoint
app.get('/api/purchaseorders/:id', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Purchase order by ID requested:', req.params.id);
    
    const purchaseOrder = await PurchaseOrder.findOne({ 
      $or: [
        { purchaseorder_id: req.params.id },
        { _id: req.params.id }
      ]
    }).lean();

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    console.log('✅ Purchase order found:', purchaseOrder.purchaseorder_number);

    res.json({
      success: true,
      message: 'Purchase order retrieved successfully',
      data: purchaseOrder
    });

  } catch (error) {
    console.error('❌ Error fetching purchase order:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase order',
      error: error.message
    });
  }
});

// Dashboard summary endpoint
// Dashboard summary endpoint
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Dashboard summary requested');

    // Get counts and basic stats
    const [invoiceCount, purchaseOrderCount, totalInvoiceValue, totalPOValue] = await Promise.all([
      Invoice.countDocuments(),
      PurchaseOrder.countDocuments(),
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
      PurchaseOrder.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }])
    ]);

    const summary = {
      invoices: {
        count: invoiceCount,
        totalValue: totalInvoiceValue[0]?.total || 0
      },
      purchaseOrders: {
        count: purchaseOrderCount,
        totalValue: totalPOValue[0]?.total || 0
      }
    };

    console.log('✅ Dashboard summary generated:', summary);

    res.json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: summary
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard summary:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard summary',
      error: error.message
    });
  }
});

// Debug endpoint to check salesperson mappings
app.get('/api/debug/salespeople', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Debug salespeople mapping requested');
    
    // Get unique salespeople from invoices and purchase orders
    const [invoiceSalespeople, poSalespeople] = await Promise.all([
      Invoice.aggregate([
        { $group: { 
          _id: '$salesperson_id', 
          name: { $first: '$salesperson_name' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      PurchaseOrder.aggregate([
        { $group: { 
          _id: '$cf_sales_person_unformatted', 
          name: { $first: '$cf_sales_person' },
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      data: {
        invoiceSalespeople,
        poSalespeople,
        currentUser: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in debug salespeople:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching debug data',
      error: error.message
    });
  }
});

// Invoices-only endpoint (alternative endpoint name for frontend compatibility)
app.get('/api/invoices-only', authenticateToken, async (req, res) => {
  try {
    console.log('📄 Invoices-only requested with params:', req.query);
    console.log('👤 User role:', req.user.role, 'User ID:', req.user.id);
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Extract all filter parameters
    const {
      date,
      personName,
      search,
      status,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter
    let filter = {};
    
    // Role-based access control
    if (req.user.role !== 'admin') {
      // Non-admin users can only see their own invoices
      const salesMember = await SalesMember.findById(req.user.id);
      if (!salesMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user not found'
        });
      }
      
      // Filter by salesperson - check multiple fields
      const userFilter = {
        $or: [
          { salesperson_id: salesMember.zoho_id || req.user.id },
          { salesperson_name: salesMember.name },
          { salesperson: salesMember.name }
        ]
      };
      filter = { ...filter, ...userFilter };
      console.log('🔒 Non-admin user, filtering by salesperson:', salesMember.name);
    } else {
      console.log('👑 Admin user - access to all invoices');
      
      // Admin users can filter by personName/salesperson
      if (personName && personName.trim() && !['all', '*', ''].includes(personName.trim().toLowerCase())) {
        const nameRegex = new RegExp(`^\\s*${personName.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}\\s*$`, 'i');
        filter.$or = [
          { salesperson_name: nameRegex },
          { salesperson: nameRegex },
          { cf_sales_person: nameRegex },
          { cf_sales_person_unformatted: nameRegex }
        ];
        console.log('🔍 Admin filtering by salesperson:', personName.trim());
      }
    }
    
    // Date filtering (month filter)
    if (date) {
      let startDate, endDate;
      
      if (date.includes('-01')) {
        // Month format: YYYY-MM-01
        const [year, month] = date.split('-');
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 1); // First day of next month
      } else {
        // Day format: YYYY-MM-DD
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
      }
      
      filter.date = {
        $gte: startDate.toISOString().split('T')[0],
        $lt: endDate.toISOString().split('T')[0]
      };
      console.log('📅 Date filter applied:', filter.date);
    }
    
    // Status filtering
    if (status && status.trim() && status.toLowerCase() !== 'all') {
      filter.status = status.trim();
      console.log('📊 Status filter applied:', status.trim());
    }
    
    // Enhanced search across multiple fields
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { invoice_number: searchRegex },
        { customer_name: searchRegex },
        { customer_email: searchRegex },
        { email: searchRegex },
        { salesperson_name: searchRegex },
        { salesperson: searchRegex }
      ];
      
      if (filter.$or) {
        // If we already have $or for personName, we need to use $and
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
      console.log('🔍 Search filter applied for:', search.trim());
    }

    // Dynamic sorting
    const sortOptions = {
      date: 'date',
      customer_name: 'customer_name',
      customer: 'customer_name', // fallback
      salesperson_name: 'salesperson_name',
      salesperson: 'salesperson_name', // fallback
      amount: 'total',
      invoice_number: 'invoice_number',
      status: 'status',
      created_time: 'created_time'
    };
    
    const sortField = sortOptions[sortBy] || 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortQuery = { [sortField]: sortDirection };
    
    // Add secondary sort for consistency
    if (sortField !== '_id') {
      sortQuery._id = sortDirection;
    }
    
    console.log('🔍 Final query filter:', filter);
    console.log('📊 Sort query:', sortQuery);

    // Get invoices with pagination and sorting
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    // Build pagination metadata
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    console.log(`✅ Found ${invoices.length} invoices (${total} total)`);

    res.json({
      success: true,
      message: 'Invoices retrieved successfully',
      data: invoices,
      total,
      page,
      limit,
      pages: totalPages,
      pagination,
      filters: {
        date: date || undefined,
        personName: (req.user.role === 'admin' && personName && !['all', '*', ''].includes(personName?.toLowerCase())) ? personName : undefined,
        search: search || undefined,
        status: status && status.toLowerCase() !== 'all' ? status : undefined,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('❌ Error fetching invoices-only:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
});

// Purchase orders-only endpoint (alternative endpoint name for frontend compatibility)
app.get('/api/purchaseorders-only', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Purchase orders-only requested with params:', req.query);
    console.log('👤 User role:', req.user.role, 'User ID:', req.user.id);
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Extract all filter parameters
    const {
      date,
      personName,
      search,
      status,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter
    let filter = {};
    
    // Role-based access control
    if (req.user.role !== 'admin') {
      // Non-admin users can only see their own purchase orders
      const salesMember = await SalesMember.findById(req.user.id);
      if (!salesMember) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user not found'
        });
      }
      
      // Filter by salesperson - check multiple fields
      const userFilter = {
        $or: [
          { cf_sales_person_unformatted: salesMember.zoho_id || req.user.id },
          { cf_sales_person: salesMember.name },
          { salesperson_name: salesMember.name },
          { salesperson: salesMember.name }
        ]
      };
      filter = { ...filter, ...userFilter };
      console.log('🔒 Non-admin user, filtering by salesperson:', salesMember.name);
    } else {
      console.log('👑 Admin user - access to all purchase orders');
      
      // Admin users can filter by personName/salesperson
      if (personName && personName.trim() && !['all', '*', ''].includes(personName.trim().toLowerCase())) {
        const nameRegex = new RegExp(`^\\s*${personName.trim().split(/\s+/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}\\s*$`, 'i');
        filter.$or = [
          { cf_sales_person: nameRegex },
          { cf_sales_person_unformatted: nameRegex },
          { salesperson_name: nameRegex },
          { salesperson: nameRegex }
        ];
        console.log('🔍 Admin filtering by salesperson:', personName.trim());
      }
    }
    
    // Date filtering (month filter)
    if (date) {
      let startDate, endDate;
      
      if (date.includes('-01')) {
        // Month format: YYYY-MM-01
        const [year, month] = date.split('-');
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 1); // First day of next month
      } else {
        // Day format: YYYY-MM-DD
        startDate = new Date(date);
        endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
      }
      
      filter.date = {
        $gte: startDate.toISOString().split('T')[0],
        $lt: endDate.toISOString().split('T')[0]
      };
      console.log('� Date filter applied:', filter.date);
    }
    
    // Status filtering
    if (status && status.trim() && status.toLowerCase() !== 'all') {
      // Check multiple status fields
      filter.$or = filter.$or ? filter.$or : [];
      const statusFilter = [
        { status: status.trim() },
        { order_status: status.trim() },
        { billed_status: status.trim() },
        { received_status: status.trim() }
      ];
      
      if (filter.$or.length > 0) {
        // If we already have $or for personName, we need to use $and
        filter.$and = [
          { $or: filter.$or },
          { $or: statusFilter }
        ];
        delete filter.$or;
      } else {
        filter.$or = statusFilter;
      }
      console.log('📊 Status filter applied:', status.trim());
    }
    
    // Enhanced search across multiple fields
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { purchaseorder_number: searchRegex },
        { vendor_name: searchRegex },
        { company_name: searchRegex },
        { cf_sales_person: searchRegex },
        { cf_sales_person_unformatted: searchRegex },
        { reference_number: searchRegex }
      ];
      
      if (filter.$or && !filter.$and) {
        // If we already have $or for personName or status, we need to use $and
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions }
        ];
        delete filter.$or;
      } else if (filter.$and) {
        // If we already have $and, add to it
        filter.$and.push({ $or: searchConditions });
      } else {
        filter.$or = searchConditions;
      }
      console.log('🔍 Search filter applied for:', search.trim());
    }

    // Dynamic sorting
    const sortOptions = {
      date: 'date',
      vendor_name: 'vendor_name',
      vendor: 'vendor_name', // fallback
      company_name: 'company_name',
      company: 'company_name', // fallback
      salesperson_name: 'cf_sales_person',
      salesperson: 'cf_sales_person', // fallback
      amount: 'total',
      total: 'total',
      purchaseorder_number: 'purchaseorder_number',
      po_number: 'purchaseorder_number', // fallback
      status: 'status',
      order_status: 'order_status',
      created_time: 'created_time',
      delivery_date: 'delivery_date'
    };
    
    const sortField = sortOptions[sortBy] || 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortQuery = { [sortField]: sortDirection };
    
    // Add secondary sort for consistency
    if (sortField !== '_id') {
      sortQuery._id = sortDirection;
    }
    
    console.log('🔍 Final query filter:', filter);
    console.log('📊 Sort query:', sortQuery);

    // Get purchase orders with pagination and sorting
    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseOrder.countDocuments(filter)
    ]);

    // Build pagination metadata
    const totalPages = Math.ceil(total / limit);
    const pagination = {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    console.log(`✅ Found ${purchaseOrders.length} purchase orders (${total} total)`);

    res.json({
      success: true,
      message: 'Purchase orders retrieved successfully',
      data: purchaseOrders,
      total,
      page,
      limit,
      pages: totalPages,
      pagination,
      filters: {
        date: date || undefined,
        personName: (req.user.role === 'admin' && personName && !['all', '*', ''].includes(personName?.toLowerCase())) ? personName : undefined,
        search: search || undefined,
        status: status && status.toLowerCase() !== 'all' ? status : undefined,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    console.error('❌ Error fetching purchase orders-only:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
});

// PI Summary endpoint
app.get('/api/pi-summary', authenticateToken, listPiSummaryOnly(Invoice, PurchaseOrder));

// Catch all route for debugging
app.use('*', (req, res) => {
  console.log('❓ Unknown route requested:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    message: 'The requested endpoint does not exist'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎉 Server running successfully!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🌐 CORS: Accepting all origins for development`);
  console.log(`💾 Database: ${mongoose.connection.db.databaseName}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/test`);
  console.log(`   GET  /api/debug/users`);
  console.log(`   POST /api/sales/auth/login`);
  console.log(`   GET  /api/admin/sales-members`);
  console.log(`   PUT  /api/admin/sales-members/:id`);
  console.log(`   GET  /api/invoices`);
  console.log(`   GET  /api/purchaseorders`);
  console.log(`   GET  /api/dashboard/summary`);
  console.log(`\n🔧 Test your frontend now!`);
  console.log(`   Frontend should connect to: http://localhost:${PORT}`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`   Email: admin@gmail.com`);
  console.log(`   Password: Admin@123`);
  console.log(`\n🐛 Debug users: http://localhost:${PORT}/api/debug/users`);
});
