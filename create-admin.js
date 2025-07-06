import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/userModel.js";

// Load environment variables
dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@dibla.com" });
    
    if (existingAdmin) {
      console.log("👤 Admin user already exists");
      console.log("Email:", existingAdmin.email);
      console.log("Role:", existingAdmin.role);
      
      // Update role to admin if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log("✅ Updated existing user to admin role");
      }
    } else {
      console.log("👤 Creating new admin user...");
      
      const adminUser = new User({
        name: "Admin User",
        email: "admin@dibla.com",
        password: "Admin123!", // Must contain uppercase, lowercase, and number
        role: "admin",
        phone: "01000000000",
        isVerified: true
      });
      
      await adminUser.save();
      console.log("✅ Admin user created successfully");
      console.log("Email: admin@dibla.com");
      console.log("Password: Admin123!");
      console.log("Role: admin");
    }

    // Also create a seller user for testing
    const existingSeller = await User.findOne({ email: "seller@dibla.com" });
    
    if (!existingSeller) {
      console.log("👤 Creating seller user for testing...");
      
      const sellerUser = new User({
        name: "Shop Owner",
        email: "seller@dibla.com",
        password: "Seller123!",
        role: "seller",
        phone: "01111111111",
        isVerified: true
      });
      
      await sellerUser.save();
      console.log("✅ Seller user created successfully");
      console.log("Email: seller@dibla.com");
      console.log("Password: Seller123!");
      console.log("Role: seller");
    } else {
      console.log("👤 Seller user already exists");
    }

    console.log("\n🎉 Setup complete!");
    console.log("\nAdmin Login:");
    console.log("Email: admin@dibla.com");
    console.log("Password: Admin123!");
    console.log("\nSeller Login:");
    console.log("Email: seller@dibla.com");
    console.log("Password: Seller123!");

  } catch (error) {
    console.error("❌ Error creating admin:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the script
createAdmin();
