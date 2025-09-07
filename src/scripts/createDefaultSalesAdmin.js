import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import SalesMember from '../models/SalesMember.js';

async function createDefaultSalesAdmin() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI missing");
    await mongoose.connect(uri);

    // Check if admin already exists
    const existingAdmin = await SalesMember.findOne({ 
      email: 'admin@gmail.com' 
    });

    if (existingAdmin) {
      console.log('Default admin already exists');
      return;
    }

    // Create default sales admin
    const admin = await SalesMember.create({
      name: 'Admin',
      email: 'admin@gmail.com',
      phone: '9999999999',
      password: 'Admin@123',
      isAdmin: true,
      isActive: true,
      monthlyTarget: 0,
      topLine: 0
    });

    console.log('Default sales admin created successfully:', {
      id: admin._id,
      email: admin.email,
      name: admin.name
    });

  } catch (error) {
    console.error('Error creating default admin:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createDefaultSalesAdmin();