import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import SalesMember from '../models/SalesMember.js';

async function checkUser() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI missing");
    await mongoose.connect(uri);

    const admin = await SalesMember.findOne({ email: 'admin@gmail.com' }).select('+password');
    
    if (admin) {
      console.log('User found:', {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        isAdmin: admin.isAdmin,
        isActive: admin.isActive,
        hasPassword: !!admin.password,
        passwordLength: admin.password ? admin.password.length : 0,
        createdAt: admin.createdAt
      });
    } else {
      console.log('User not found!');
    }

  } catch (error) {
    console.error('Error checking user:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkUser();