import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import SalesMember from '../models/SalesMember.js';

async function resetPasswords() {
  try {
    console.log('🔑 Resetting passwords for imported sales members...');
    
    // Connect to MongoDB
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI missing from environment");
    
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully');

    // Define password mapping (using common pattern)
    const passwordMappings = {
      'vikas@gmail.com': 'Vikas@123',
      'pawan@gmail.com': 'Pawan@123', 
      'babita@gmail.com': 'Babita@123',
      'bibhas@gmail.com': 'Bibhas@123',
      'chirag@gmail.com': 'Chirag@123',
      'jyoti@gmail.com': 'Jyoti@123',
      'pankaj@gmail.com': 'Pankaj@123',
      'sonu@gmail.com': 'Sonu@123',
      'varun@gmail.com': 'Varun@123',
      'vikassingh@gmail.com': 'Vikash@123',
      'sejal@gmail.com': 'Sejal@123'
    };

    let updated = 0;

    for (const [email, newPassword] of Object.entries(passwordMappings)) {
      try {
        const member = await SalesMember.findOne({ email });
        
        if (member) {
          member.password = newPassword; // This will trigger the pre-save hook to hash it
          await member.save();
          console.log(`✅ Updated password for: ${member.name} (${email})`);
          updated++;
        } else {
          console.log(`⚠️  Member not found: ${email}`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${email}: ${error.message}`);
      }
    }

    console.log(`\n📊 Password Reset Summary:`);
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   📋 Total attempted: ${Object.keys(passwordMappings).length}`);
    
    console.log('\n🔑 New Password Pattern:');
    console.log('   Format: FirstName@123 (e.g., Vikas@123, Pawan@123)');

  } catch (error) {
    console.error('💥 Password reset failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

resetPasswords();
