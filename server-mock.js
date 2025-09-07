import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

console.log('Starting basic test server...');

const app = express();

// Enhanced CORS configuration for debugging
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS - Request origin:', origin || 'no-origin');
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS - Allowing request with no origin');
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      'https://127.0.0.1:3000',
      'http://localhost:3001', // In case frontend is on different port
      'http://127.0.0.1:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      console.log('CORS - Allowing origin:', origin);
      callback(null, true);
    } else {
      console.log('CORS - Unknown origin, allowing for development:', origin);
      // For development, allow all origins
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
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Add explicit preflight handling
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`\n📧 ${req.method} ${req.url}`);
  console.log('🌐 Origin:', req.headers.origin || 'no-origin');
  console.log('🔑 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body:', req.body);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mock login endpoint for testing
app.post('/api/sales/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('Login attempt:', email);
  
  if (email === 'admin@gmail.com' && password === 'Admin@123') {
    res.json({
      message: 'Login successful',
      user: { email, name: 'Admin' },
      accessToken: 'mock-token-123'
    });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Mock sales members endpoint
app.get('/api/admin/sales-members', (req, res) => {
  res.json({
    message: 'Sales members endpoint working',
    data: [
      { id: 1, name: 'Admin', email: 'admin@gmail.com', isActive: true }
    ]
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Mock server running on port ${PORT}`);
  console.log(`✅ Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/test`);
  console.log(`   POST /api/sales/auth/login`);
  console.log(`   GET  /api/admin/sales-members`);
  console.log('');
  console.log('🔧 Test your frontend with these endpoints!');
  console.log('   Frontend should connect to: http://localhost:5000');
});
