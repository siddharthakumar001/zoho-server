import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// Simple CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test importing controllers one by one
console.log('Testing controller imports...');

try {
  console.log('1. Testing sales auth controller...');
  const salesAuth = await import("./src/controllers/salesAuthController.js");
  console.log('✅ Sales auth controller imported successfully');
  
  // Add basic auth routes
  app.post("/api/sales/auth/login", salesAuth.loginSales);
  app.post("/api/sales/auth/logout", salesAuth.logoutSales);
  console.log('✅ Auth routes added');
  
} catch (error) {
  console.log('❌ Error importing sales auth controller:', error.message);
}

try {
  console.log('2. Testing sales member controller...');
  const salesMember = await import("./src/controllers/salesMemberController.js");
  console.log('✅ Sales member controller imported successfully');
  
  // Add basic sales member routes (no parameters first)
  app.get("/api/admin/sales-members", salesMember.listSalesMembers);
  app.post("/api/admin/sales-members", salesMember.addSalesMember);
  console.log('✅ Sales member routes added');
  
} catch (error) {
  console.log('❌ Error importing sales member controller:', error.message);
}

try {
  console.log('3. Testing sales controller...');
  const salesController = await import("./src/controllers/salesController.js");
  console.log('✅ Sales controller imported successfully');
  
} catch (error) {
  console.log('❌ Error importing sales controller:', error.message);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`✅ Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /api/sales/auth/login`);
  console.log(`   GET  /api/admin/sales-members`);
});
