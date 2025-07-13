import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "./models/shopModel.js";
import User from "./models/userModel.js";

// Load environment variables
dotenv.config();

const createShopWithLocation = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find or create a seller user
    let seller = await User.findOne({ email: "seller@dibla.com" });
    
    if (!seller) {
      console.log("👤 Creating seller user...");
      seller = new User({
        name: "Test Seller",
        email: "seller@dibla.com",
        password: "Seller123!",
        role: "seller",
        phone: "01234567890",
      });
      await seller.save();
      console.log("✅ Seller user created");
    } else {
      console.log("👤 Found existing seller:", seller.name, seller.email);
    }

    // Check if test shop already exists
    const existingShop = await Shop.findOne({ name: "متجر الذهب مع الخريطة" });
    
    if (existingShop) {
      console.log("🏪 Test shop already exists:", existingShop.name);
      console.log("Shop ID:", existingShop._id);
      console.log("Location:", existingShop.location);
      
      // Update the shop to add location if it doesn't have one
      if (!existingShop.location || !existingShop.location.coordinates) {
        console.log("📍 Adding location to existing shop...");
        existingShop.location = {
          type: "Point",
          coordinates: [31.2357, 30.0444] // [longitude, latitude] - Cairo coordinates
        };
        existingShop.isApproved = true; // Make sure it's approved for public viewing
        await existingShop.save();
        console.log("✅ Location added to existing shop");
      }
    } else {
      console.log("🏪 Creating test shop with location...");
      
      const testShop = new Shop({
        name: "متجر الذهب مع الخريطة",
        description: "متجر تجريبي لاختبار عرض الخريطة للمستخدمين العاديين",
        city: "القاهرة",
        area: "وسط البلد",
        address: "شارع طلعت حرب، وسط البلد، القاهرة",
        phone: "01234567890",
        whatsapp: "01234567890",
        specialties: ["خواتم", "قلائد", "أساور", "ذهب"],
        workingHours: "9:00 ص - 9:00 م",
        subscriptionPlan: "Basic",
        isApproved: true, // Approved for public viewing
        averageRating: 4.5,
        rating: 4.5,
        reviewCount: 10,
        owner: seller._id,
        // Add location in GeoJSON format
        location: {
          type: "Point",
          coordinates: [31.2357, 30.0444] // [longitude, latitude] - Cairo coordinates
        }
      });
      
      await testShop.save();
      console.log("✅ Test shop with location created successfully");
      console.log("Shop ID:", testShop._id);
      console.log("Shop Name:", testShop.name);
      console.log("Location:", testShop.location);
      console.log("Owner:", seller.name);
      console.log("Is Approved:", testShop.isApproved);
    }

    // Create another shop without location for comparison
    const shopWithoutLocation = await Shop.findOne({ name: "متجر بدون خريطة" });
    
    if (!shopWithoutLocation) {
      console.log("🏪 Creating shop without location for comparison...");
      
      const testShop2 = new Shop({
        name: "متجر بدون خريطة",
        description: "متجر تجريبي بدون بيانات موقع لاختبار عدم ظهور تبويب الخريطة",
        city: "الإسكندرية",
        area: "سيدي جابر",
        address: "شارع الجيش، سيدي جابر، الإسكندرية",
        phone: "01098765432",
        whatsapp: "01098765432",
        specialties: ["مجوهرات", "فضة"],
        workingHours: "10:00 ص - 8:00 م",
        subscriptionPlan: "Basic",
        isApproved: true, // Approved for public viewing
        averageRating: 4.2,
        rating: 4.2,
        reviewCount: 5,
        owner: seller._id,
        // No location data
      });
      
      await testShop2.save();
      console.log("✅ Shop without location created successfully");
      console.log("Shop ID:", testShop2._id);
      console.log("Shop Name:", testShop2.name);
    }

    console.log("\n🎉 Test shops setup complete!");
    console.log("\nNow you can:");
    console.log("1. Visit the frontend application");
    console.log("2. Browse shops as a regular user");
    console.log("3. Click on 'متجر الذهب مع الخريطة' to see the location tab");
    console.log("4. Click on 'متجر بدون خريطة' to see that location tab is hidden");

  } catch (error) {
    console.error("❌ Error creating test shops:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the script
createShopWithLocation();
