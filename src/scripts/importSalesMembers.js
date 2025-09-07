import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SalesMember from '../models/SalesMember.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importSalesMembers() {
  try {
    console.log('🚀 Starting sales members import...');
    
    // Connect to MongoDB
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI missing from environment");
    
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.db.databaseName);

    // Read the JSON file
    const jsonFilePath = path.join(__dirname, '../../salesmembers.json');
    
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`File not found: ${jsonFilePath}`);
    }

    const rawData = fs.readFileSync(jsonFilePath, 'utf8');
    const salesMembersData = JSON.parse(rawData);
    
    console.log(`📁 Found ${salesMembersData.length} sales members in JSON file`);

    // Check existing members to avoid duplicates
    const existingEmails = await SalesMember.find({}, 'email').lean();
    const existingEmailSet = new Set(existingEmails.map(member => member.email));
    
    console.log(`📋 Found ${existingEmails.length} existing sales members in database`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process each sales member
    for (const memberData of salesMembersData) {
      try {
        // Convert MongoDB JSON format to plain object
        const cleanMemberData = {
          name: memberData.name,
          email: memberData.email,
          phone: memberData.phone,
          password: memberData.password, // Already hashed in the JSON
          monthlyTarget: memberData.monthlyTarget || 0,
          topLine: memberData.topLine || 0,
          isActive: memberData.isActive !== false, // Default to true
          isAdmin: memberData.isAdmin || false,
          createdAt: memberData.createdAt?.$date ? new Date(memberData.createdAt.$date) : new Date(),
          updatedAt: memberData.updatedAt?.$date ? new Date(memberData.updatedAt.$date) : new Date()
        };

        // Check if member already exists
        if (existingEmailSet.has(cleanMemberData.email)) {
          console.log(`⏭️  Skipping ${cleanMemberData.name} (${cleanMemberData.email}) - already exists`);
          skipped++;
          continue;
        }

        // Create new sales member (skip password hashing since it's already hashed)
        const newMember = new SalesMember(cleanMemberData);
        
        // Set the password directly without re-hashing
        newMember.password = memberData.password;
        
        // Save without running pre-save middleware that would hash the password again
        await newMember.save({ validateBeforeSave: true });
        
        console.log(`✅ Imported: ${cleanMemberData.name} (${cleanMemberData.email})`);
        imported++;

      } catch (error) {
        console.error(`❌ Error importing ${memberData.name}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successfully imported: ${imported}`);
    console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📁 Total in file: ${salesMembersData.length}`);
    
    // Verify final count
    const finalCount = await SalesMember.countDocuments();
    console.log(`   📋 Total in database now: ${finalCount}`);

    if (imported > 0) {
      console.log('\n🎉 Sales members import completed successfully!');
    } else if (skipped === salesMembersData.length) {
      console.log('\n✨ All sales members already exist in database!');
    }

  } catch (error) {
    console.error('💥 Import failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the import
importSalesMembers();
