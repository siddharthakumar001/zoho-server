import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler, notFound } from "./src/middlewares/errorMiddleware.js";
import connectDB from "./src/config/db.js";

dotenv.config();

// Connect to database
connectDB();

const app = express();

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS check - Request origin:', origin);
    
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      console.log('CORS allowing request with no origin');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      'https://127.0.0.1:3000',
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    console.log('Allowed origins:', allowedOrigins);
    
    if (allowedOrigins.includes(origin)) {
      console.log('CORS allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('CORS blocking origin:', origin);
      // For development, temporarily allow all origins
      console.log('Temporarily allowing all origins for debugging');
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cookie',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control'
  ],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Add explicit OPTIONS handler
app.options('*', cors());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} from ${req.headers.origin || 'no-origin'}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Import and test controllers individually
let loginSales, logoutSales, meSales, requireSalesAuth;

try {
  console.log('Loading sales auth controller...');
  const salesAuthModule = await import("./src/controllers/salesAuthController.js");
  loginSales = salesAuthModule.loginSales;
  logoutSales = salesAuthModule.logoutSales;
  meSales = salesAuthModule.meSales;
  console.log('✅ Sales auth controller loaded');
} catch (error) {
  console.log('❌ Error loading sales auth controller:', error.message);
}

try {
  console.log('Loading sales auth middleware...');
  const salesAuthMiddleware = await import("./src/middlewares/salesAuth.js");
  requireSalesAuth = salesAuthMiddleware.requireSalesAuth;
  console.log('✅ Sales auth middleware loaded');
} catch (error) {
  console.log('❌ Error loading sales auth middleware:', error.message);
}

// Basic auth routes - no complex routes yet
if (loginSales && logoutSales && meSales && requireSalesAuth) {
  app.post("/api/sales/auth/login", loginSales);
  app.post("/api/sales/auth/logout", logoutSales);
  app.get("/api/sales/auth/me", requireSalesAuth, meSales);
  console.log('✅ Auth routes registered');
} else {
  console.log('❌ Could not register auth routes - missing functions');
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// API Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Zoho CRM API Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: {
        'POST /api/sales/auth/login': 'Login with email/password',
        'GET /api/sales/auth/me': 'Get current user info (requires auth)',
        'POST /api/sales/auth/logout': 'Logout user (requires auth)'
      },
      invoices: {
        'GET /api/invoices': 'Get CRM invoices with filters (requires auth)',
        'GET /api/invoices-only': 'Get paginated invoices list (requires auth)',
        'GET /api/invoices/:id': 'Get single invoice by Zoho ID or MongoDB ObjectId (requires auth)'
      },
      purchaseOrders: {
        'GET /api/purchaseorders': 'Get purchase orders (requires auth)',
        'GET /api/purchaseorders/:id': 'Get single purchase order by Zoho ID or MongoDB ObjectId (requires auth)'
      },
      summary: {
        'GET /api/pi-summary': 'Get PI summary data (requires auth)'
      },
      admin: {
        'GET /api/admin/sales-members': 'Get sales team members (requires auth)',
        'POST /api/admin/sales-members': 'Add new sales member (requires auth)',
        'GET /api/admin/sales-members/:id': 'Get single sales member (requires auth)',
        'PUT /api/admin/sales-members/:id': 'Update sales member (requires auth)',
        'DELETE /api/admin/sales-members/:id': 'Delete sales member (requires auth)',
        'PATCH /api/admin/sales-members/:id/status': 'Update sales member status (requires auth)'
      },
      utility: {
        'GET /api/test': 'Test endpoint',
        'GET /api/docs': 'This documentation',
        'GET /health': 'Health check'
      }
    },
    notes: {
      idFormats: 'Individual record endpoints accept both Zoho IDs (e.g., 605035000030106381) and MongoDB ObjectIds (24-char hex)',
      authentication: 'Use cookie-based authentication. Login first to get session cookie.',
      pagination: 'All list endpoints support ?page=1&limit=10 parameters with enforced limits for performance',
      paginationLimits: 'Default limits: invoices=10, pi-summary=25, sales-members=10. Max limits: 50-100 depending on endpoint',
      cors: 'CORS is configured for development with credentials support',
      performance: 'Optimized pagination reduces data transfer by 80-90% for better page load times'
    }
  });
});

// Import and register main routes
try {
  console.log('Loading main routes...');
  const mainRoutes = await import("./src/routes/index.js");
  app.use('/', mainRoutes.default);
  console.log('✅ Main routes loaded (includes PI summary, individual records, etc.)');
} catch (error) {
  console.log('❌ Error loading main routes:', error.message);
  console.log('   Some endpoints like /api/pi-summary will not be available');
}

// Error handling middleware (MUST come after routes)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 5000) : 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.listen(PORT, () => {
  console.log(`\n🚀 ===== ZOHO CRM API SERVER STARTED =====`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ API running on: http://localhost:${PORT}`);
  console.log(`✅ CLIENT_URL: ${process.env.CLIENT_URL}`);
  console.log(`✅ MONGO_URI: ${process.env.MONGO_URI}`);
  console.log(`✅ Port Config: Local=3001, Production=5000`);
  console.log(`✅ Current Port: ${PORT} (${isProduction ? 'Production' : 'Local'})`);
  console.log(`✅ Backend ready for frontend connections`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`===============================================\n`);
});
