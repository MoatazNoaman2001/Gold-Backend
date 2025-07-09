import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "./models/shopModel.js";
import User from "./models/userModel.js";

// Load environment variables
dotenv.config();

const createTestShop = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find the seller user
    const seller = await User.findOne({ email: "seller@dibla.com" });
    
    if (!seller) {
      console.log("❌ Seller user not found. Please run create-admin.js first");
      return;
    }

    console.log("👤 Found seller:", seller.name, seller.email);

    // Check if test shop already exists
    const existingShop = await Shop.findOne({ name: "متجر الذهب التجريبي" });
    
    if (existingShop) {
      console.log("🏪 Test shop already exists");
      console.log("Shop ID:", existingShop._id);
      console.log("Shop Name:", existingShop.name);
      console.log("Is Approved:", existingShop.isApproved);
      
      // Update to not approved for testing
      if (existingShop.isApproved) {
        existingShop.isApproved = false;
        await existingShop.save();
        console.log("✅ Updated shop to not approved for testing");
      }
    } else {
      console.log("🏪 Creating test shop...");
      
      const testShop = new Shop({
        name: "متجر الذهب التجريبي",
        description: "متجر تجريبي لاختبار نظام الموافقة على المتاجر",
        city: "القاهرة",
        area: "مدينة نصر",
        address: "شارع التسعين الشمالي، مدينة نصر، القاهرة",
        phone: "01234567890",
        whatsapp: "01234567890",
        specialties: ["خواتم", "قلائد", "أساور", "ذهب"],
        workingHours: "9:00 ص - 9:00 م",
        subscriptionPlan: "Basic",
        isApproved: false, // Not approved initially
        averageRating: 0,
        rating: 0,
        owner: seller._id
      });
      
      await testShop.save();
      console.log("✅ Test shop created successfully");
      console.log("Shop ID:", testShop._id);
      console.log("Shop Name:", testShop.name);
      console.log("Owner:", seller.name);
      console.log("Is Approved:", testShop.isApproved);
    }

    console.log("\n🎉 Test shop setup complete!");
    console.log("\nNow you can:");
    console.log("1. Login as admin (admin@dibla.com / Admin123!)");
    console.log("2. Go to admin dashboard");
    console.log("3. Find the test shop in pending shops");
    console.log("4. Click approve to test the functionality");

  } catch (error) {
    console.error("❌ Error creating test shop:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the script
createTestShop();
