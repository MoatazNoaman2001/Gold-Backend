import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/userModel.js";
import bcrypt from "bcrypt";

// Load environment variables
dotenv.config();

const createTestSeller = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if test seller already exists
    const existingSeller = await User.findOne({ email: "testseller@dibla.com" });
    
    if (existingSeller) {
      console.log("👤 Test seller already exists:", existingSeller.name, existingSeller.email);
      console.log("Role:", existingSeller.role);
      console.log("You can login with:");
      console.log("Email: testseller@dibla.com");
      console.log("Password: TestSeller123!");
    } else {
      console.log("👤 Creating test seller user...");
      
      // Hash password
      const hashedPassword = await bcrypt.hash("TestSeller123!", 12);
      
      const testSeller = new User({
        name: "Test Seller User",
        email: "testseller@dibla.com",
        password: hashedPassword,
        role: "seller",
        phone: "01234567890",
      });
      
      await testSeller.save();
      console.log("✅ Test seller created successfully");
      console.log("Name:", testSeller.name);
      console.log("Email:", testSeller.email);
      console.log("Role:", testSeller.role);
      console.log("You can login with:");
      console.log("Email: testseller@dibla.com");
      console.log("Password: TestSeller123!");
    }

    console.log("\n🎉 Test seller setup complete!");
    console.log("\nNow you can:");
    console.log("1. Login with the seller account");
    console.log("2. Create a shop");
    console.log("3. Add products to the shop");

  } catch (error) {
    console.error("❌ Error creating test seller:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the script
createTestSeller();
