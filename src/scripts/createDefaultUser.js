import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User.js';

async function createDefaultUser() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI missing");
    await mongoose.connect(uri);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: 'user@gmail.com' 
    });

    if (existingAdmin) {
      console.log('Default user admin already exists');
      return;
    }

    // Generate unique IDs
    const customerId = 'CUST' + Date.now();
    const accountNumber = 'ACC' + Date.now();

    // Create default user admin
    const admin = await User.create({
      name: 'Admin',
      email: 'user@gmail.com',
      password: 'Admin@123',
      mobile: '9999999999',
      customerId,
      accountNumber,
      companyName: 'Admin Company',
      country: {
        label: 'India',
        value: 'IN'
      },
      address: {
        street: 'Admin Street',
        city: 'Admin City',
        state: 'Admin State',
        pinCode: '123456'
      },
      contactPerson: {
        name: 'Admin Contact',
        email: 'admin@gmail.com',
        phone: '9999999999'
      },
      isAdmin: true,
      role: 'admin',
      isActive: true,
      kycStatus: 'approved'
    });

    console.log('Default user admin created successfully:', {
      id: admin._id,
      email: admin.email,
      customerId: admin.customerId
    });

  } catch (error) {
    console.error('Error creating default user admin:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createDefaultUser();