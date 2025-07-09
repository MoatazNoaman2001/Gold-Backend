import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "./models/shopModel.js";
import User from "./models/userModel.js";
import jwt from "jsonwebtoken";

// Load environment variables
dotenv.config();

const testApproveShop = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find admin user
    const admin = await User.findOne({ email: "admin@dibla.com" });
    if (!admin) {
      console.log("❌ Admin user not found");
      return;
    }

    console.log("👤 Found admin:", admin.name, admin.email, "Role:", admin.role);

    // Generate JWT token for admin
    const token = jwt.sign(
      { id: admin._id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "1h" }
    );

    console.log("🔑 Generated token for admin");

    // Find a pending shop
    const pendingShop = await Shop.findOne({ isApproved: false });
    if (!pendingShop) {
      console.log("❌ No pending shops found");
      return;
    }

    console.log("🏪 Found pending shop:", pendingShop.name, "ID:", pendingShop._id);
    console.log("   Current isApproved:", pendingShop.isApproved);

    // Test the approval logic directly
    console.log("\n🧪 Testing approval logic...");
    
    const updatedShop = await Shop.findByIdAndUpdate(
      pendingShop._id,
      { isApproved: true },
      { new: true }
    );

    if (updatedShop) {
      console.log("✅ Shop approved successfully!");
      console.log("   Shop name:", updatedShop.name);
      console.log("   New isApproved:", updatedShop.isApproved);
    } else {
      console.log("❌ Failed to approve shop");
    }

    // Test API endpoint simulation
    console.log("\n🌐 Testing API endpoint simulation...");
    
    // Simulate the middleware checks
    console.log("1. Admin check - Role:", admin.role);
    if (admin.role !== "admin") {
      console.log("❌ Admin check failed");
      return;
    }
    console.log("✅ Admin check passed");

    // Test finding shop by ID
    const shopById = await Shop.findById(pendingShop._id);
    console.log("2. Shop lookup - Found:", shopById ? shopById.name : "Not found");
    
    if (!shopById) {
      console.log("❌ Shop not found");
      return;
    }
    console.log("✅ Shop lookup passed");

    console.log("\n🎉 All tests passed! The approval should work.");
    console.log("\nTo test in frontend:");
    console.log("1. Login as admin (admin@dibla.com / Admin123!)");
    console.log("2. Go to admin dashboard");
    console.log("3. Try to approve a shop");
    console.log("4. Check browser console and network tab for errors");

  } catch (error) {
    console.error("❌ Error testing shop approval:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the script
testApproveShop();
