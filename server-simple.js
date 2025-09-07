import express from "express";

const app = express();

console.log('🚀 Starting ultra-simple server...');

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

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running perfectly!'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint requested');
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString()
  });
});

// Login endpoint with detailed logging
app.post('/api/sales/auth/login', (req, res) => {
  console.log('🔐 Login attempt received');
  console.log('📦 Request body:', req.body);
  console.log('🌐 Origin:', req.headers.origin);
  
  // Handle both 'email' and 'identifier' from frontend
  const { email, identifier, password } = req.body;
  const userEmail = email || identifier; // Support both field names
  
  console.log('📧 Email extracted:', userEmail);
  console.log('🔑 Password provided:', !!password);
  
  if (userEmail === 'admin@gmail.com' && password === 'Admin@123') {
    console.log('✅ Login successful for:', userEmail);
    res.json({
      success: true,
      message: 'Login successful',
      user: { 
        email: userEmail,
        name: 'Admin User',
        role: 'admin',
        isAdmin: true
      },
      accessToken: 'mock-jwt-token-' + Date.now()
    });
  } else {
    console.log('❌ Login failed for:', userEmail);
    console.log('❌ Expected: admin@gmail.com / Admin@123');
    console.log('❌ Received:', userEmail, '/', password);
    res.status(401).json({ 
      success: false,
      message: 'Invalid email or password',
      debug: {
        receivedEmail: userEmail,
        receivedPassword: password ? '[PROVIDED]' : '[MISSING]',
        expectedEmail: 'admin@gmail.com',
        expectedPassword: '[Admin@123]'
      }
    });
  }
});

// Sales members endpoint
app.get('/api/admin/sales-members', (req, res) => {
  console.log('👥 Sales members requested');
  res.json({
    success: true,
    message: 'Sales members retrieved',
    data: [
      { 
        id: 1, 
        name: 'Admin User', 
        email: 'admin@gmail.com', 
        isActive: true,
        role: 'admin'
      },
      { 
        id: 2, 
        name: 'Sales Rep 1', 
        email: 'sales1@example.com', 
        isActive: true,
        role: 'sales'
      }
    ],
    total: 2
  });
});

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

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎉 Server running successfully!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🌐 CORS: Accepting all origins for development`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   GET  /api/test`);
    console.log(`   POST /api/sales/auth/login`);
    console.log(`   GET  /api/admin/sales-members`);
    console.log(`\n🔧 Test your frontend now!`);
    console.log(`   Frontend should connect to: http://localhost:${PORT}`);
    console.log(`\n🔑 Login credentials:`);
    console.log(`   Email: admin@gmail.com`);
    console.log(`   Password: Admin@123`);
  });

}

export default app;