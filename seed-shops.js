import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "./models/shopModel.js";
import User from "./models/userModel.js";

// Load environment variables
dotenv.config();

const seedShops = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if shops already exist
    const existingShops = await Shop.find();
    console.log(`📊 Current shops in database: ${existingShops.length}`);

    // Find or create a test user (seller)
    let testUser = await User.findOne({ email: "seller@test.com" });

    if (!testUser) {
      console.log("👤 Creating test seller user...");
      testUser = new User({
        name: "Test Seller",
        email: "seller@test.com",
        password: "Password123!", // Must contain uppercase, lowercase, and number
        role: "seller",
        phone: "01234567890",
      });
      await testUser.save();
      console.log("✅ Test seller created");
    } else {
      console.log("👤 Test seller already exists");
    }

    // Sample shops data
    const sampleShops = [
      {
        name: "متجر الذهب الملكي",
        description:
          "متجر متخصص في المجوهرات الذهبية الفاخرة والتصاميم الحديثة",
        area: "القاهرة - مدينة نصر",
        phone: "01012345678",
        workingHours: "من 9 صباحاً إلى 10 مساءً",
        specialties: ["خواتم", "أساور", "قلائد"],
        logoUrl: "https://via.placeholder.com/300x200?text=Royal+Gold",
        isApproved: true,
        averageRating: 4.8,
        owner: testUser._id,
      },
      {
        name: "مجوهرات الأناقة",
        description: "تشكيلة واسعة من المجوهرات العصرية والكلاسيكية",
        area: "الإسكندرية - سيدي جابر",
        phone: "01098765432",
        workingHours: "من 10 صباحاً إلى 9 مساءً",
        specialties: ["أقراط", "دبل", "مجموعات"],
        logoUrl: "https://via.placeholder.com/300x200?text=Elegance+Jewelry",
        isApproved: true,
        averageRating: 4.6,
        owner: testUser._id,
      },
      {
        name: "بيت الذهب العربي",
        description: "متجر تراثي متخصص في التصاميم العربية الأصيلة",
        area: "الجيزة - الهرم",
        phone: "01156789012",
        workingHours: "من 8 صباحاً إلى 11 مساءً",
        specialties: ["تصاميم تراثية", "ذهب عيار 21", "قطع مميزة"],
        logoUrl: "https://via.placeholder.com/300x200?text=Arabic+Gold+House",
        isApproved: true,
        averageRating: 4.9,
        owner: testUser._id,
      },
      {
        name: "متجر الماس الأزرق",
        description: "متخصصون في الماس والأحجار الكريمة",
        area: "القاهرة - مصر الجديدة",
        phone: "01234567891",
        workingHours: "من 11 صباحاً إلى 8 مساءً",
        specialties: ["ماس", "أحجار كريمة", "تصاميم فاخرة"],
        logoUrl: "https://via.placeholder.com/300x200?text=Blue+Diamond",
        isApproved: true,
        averageRating: 4.7,
        owner: testUser._id,
      },
      {
        name: "ورشة الذهب الحديثة",
        description: "تصنيع وتصميم المجوهرات حسب الطلب",
        area: "الإسكندرية - المنتزه",
        phone: "01087654321",
        workingHours: "من 9 صباحاً إلى 7 مساءً",
        specialties: ["تصنيع حسب الطلب", "إصلاح", "تصاميم مبتكرة"],
        logoUrl:
          "https://via.placeholder.com/300x200?text=Modern+Gold+Workshop",
        isApproved: false, // This one is pending approval
        averageRating: 4.5,
        owner: testUser._id,
      },
    ];

    // Add shops if they don't exist
    for (const shopData of sampleShops) {
      const existingShop = await Shop.findOne({ name: shopData.name });

      if (!existingShop) {
        const shop = new Shop(shopData);
        await shop.save();
        console.log(
          `✅ Created shop: ${shopData.name} (Approved: ${shopData.isApproved})`
        );
      } else {
        console.log(`⏭️ Shop already exists: ${shopData.name}`);
      }
    }

    // Display summary
    const totalShops = await Shop.countDocuments();
    const approvedShops = await Shop.countDocuments({ isApproved: true });
    const pendingShops = await Shop.countDocuments({ isApproved: false });

    console.log("\n📊 Database Summary:");
    console.log(`Total shops: ${totalShops}`);
    console.log(`Approved shops: ${approvedShops}`);
    console.log(`Pending shops: ${pendingShops}`);

    console.log("\n🎉 Seed completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding shops:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the seed function
seedShops();
