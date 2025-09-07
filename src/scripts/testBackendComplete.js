import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import axios from 'axios';
import SalesMember from '../models/SalesMember.js';

async function testCompleteBackend() {
  console.log('=== Complete Backend Test ===\n');

  // 1. Test environment variables
  console.log('1. Environment Variables:');
  console.log('   PORT:', process.env.PORT || 5000);
  console.log('   CLIENT_URL:', process.env.CLIENT_URL);
  console.log('   MONGO_URI:', process.env.MONGO_URI);
  console.log('   JWT_SECRET:', !!process.env.JWT_SECRET);
  console.log('');

  // 2. Test MongoDB connection
  console.log('2. Testing MongoDB connection...');
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('   ✅ MongoDB connected successfully');
    console.log('   Database name:', mongoose.connection.db.databaseName);
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('   Collections:', collections.map(c => c.name));
    
    // Check if admin user exists
    const admin = await SalesMember.findOne({ email: 'admin@gmail.com' }).select('+password');
    console.log('   Admin user exists:', !!admin);
    if (admin) {
      console.log('      - Name:', admin.name);
      console.log('      - Email:', admin.email);
      console.log('      - IsActive:', admin.isActive);
      console.log('      - IsAdmin:', admin.isAdmin);
      console.log('      - Has Password:', !!admin.password);
    }
  } catch (error) {
    console.log('   ❌ MongoDB connection failed:', error.message);
    return;
  }
  console.log('');

  // 3. Test backend endpoints
  console.log('3. Testing Backend Endpoints...');
  const baseURL = `http://localhost:${process.env.PORT || 5001}`; // Updated to 5001
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Test health endpoint
    console.log('   Testing health endpoint...');
    const healthRes = await axios.get(`${baseURL}/health`, { timeout: 5000 });
    console.log('   ✅ Health endpoint working:', healthRes.data);
  } catch (error) {
    console.log('   ❌ Health endpoint failed:', error.code || error.message);
    console.log('      Make sure backend is running with: npm start');
    return;
  }

  try {
    // Test login endpoint with 'identifier' field (as frontend sends)
    console.log('   Testing login endpoint...');
    const loginRes = await axios.post(`${baseURL}/api/sales/auth/login`, {
      identifier: 'admin@gmail.com', // Changed from 'email' to 'identifier'
      password: 'Admin@123'
    }, {
      timeout: 10000,
      withCredentials: true
    });
    
    console.log('   ✅ Login endpoint working');
    console.log('      - Status:', loginRes.status);
    console.log('      - Message:', loginRes.data.message);
    console.log('      - Has Token:', !!loginRes.data.accessToken);
    console.log('      - User Name:', loginRes.data.user?.name);
    
    // Test sales members endpoint
    if (loginRes.data.accessToken) {
      try {
        const membersRes = await axios.get(`${baseURL}/api/admin/sales-members`, {
          headers: {
            'Authorization': `Bearer ${loginRes.data.accessToken}`
          },
          timeout: 5000
        });
        console.log('   ✅ Sales members endpoint working');
        console.log('      - Total members:', membersRes.data.total);
      } catch (error) {
        console.log('   ❌ Sales members endpoint failed:', error.response?.data?.message || error.message);
      }

      // Test invoices endpoint
      try {
        const invoicesRes = await axios.get(`${baseURL}/api/invoices?page=1&limit=5`, {
          headers: {
            'Authorization': `Bearer ${loginRes.data.accessToken}`
          },
          timeout: 5000
        });
        console.log('   ✅ Invoices endpoint working');
        console.log('      - Total invoices:', invoicesRes.data.pagination.total);
        console.log('      - Sample invoice customer:', invoicesRes.data.data[0]?.customer_name);
      } catch (error) {
        console.log('   ❌ Invoices endpoint failed:', error.response?.data?.message || error.message);
      }

      // Test purchase orders endpoint
      try {
        const poRes = await axios.get(`${baseURL}/api/purchaseorders?page=1&limit=5`, {
          headers: {
            'Authorization': `Bearer ${loginRes.data.accessToken}`
          },
          timeout: 5000
        });
        console.log('   ✅ Purchase orders endpoint working');
        console.log('      - Total purchase orders:', poRes.data.pagination.total);
        console.log('      - Sample PO company:', poRes.data.data[0]?.company_name);
      } catch (error) {
        console.log('   ❌ Purchase orders endpoint failed:', error.response?.data?.message || error.message);
      }

      // Test dashboard summary
      try {
        const summaryRes = await axios.get(`${baseURL}/api/dashboard/summary`, {
          headers: {
            'Authorization': `Bearer ${loginRes.data.accessToken}`
          },
          timeout: 5000
        });
        console.log('   ✅ Dashboard summary endpoint working');
        console.log('      - Invoice count:', summaryRes.data.data.invoices.count);
        console.log('      - PO count:', summaryRes.data.data.purchaseOrders.count);
      } catch (error) {
        console.log('   ❌ Dashboard summary endpoint failed:', error.response?.data?.message || error.message);
      }
    }
    
  } catch (error) {
    console.log('   ❌ Login endpoint failed:', error.response?.data?.message || error.code || error.message);
    if (error.response?.status === 404) {
      console.log('      Route not found - check your route definitions');
    }
    if (error.code === 'ECONNREFUSED') {
      console.log('      Connection refused - backend is not running');
    }
  }

  await mongoose.disconnect();
  console.log('\n=== Test Complete ===');
}

testCompleteBackend().catch(console.error);
