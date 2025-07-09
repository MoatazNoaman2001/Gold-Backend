import mongoose from "mongoose";
import dotenv from "dotenv";
import Shop from "./models/shopModel.js";
import User from "./models/userModel.js";

// Load environment variables
dotenv.config();

const checkShops = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all shops
    const allShops = await Shop.find().populate("owner", "name email");

    console.log(`\n📊 Total shops in database: ${allShops.length}`);

    // Separate approved and pending shops
    const approvedShops = allShops.filter((shop) => shop.isApproved === true);
    const pendingShops = allShops.filter(
      (shop) => shop.isApproved === false || shop.isApproved === undefined
    );

    console.log(`✅ Approved shops: ${approvedShops.length}`);
    console.log(`⏳ Pending shops: ${pendingShops.length}`);

    console.log("\n📋 Pending Shops Details:");
    pendingShops.forEach((shop, index) => {
      console.log(`${index + 1}. ${shop.name}`);
      console.log(`   ID: ${shop._id}`);
      console.log(
        `   Owner: ${shop.owner ? shop.owner.name : "No owner"} (${
          shop.owner ? shop.owner.email : "No email"
        })`
      );
      console.log(`   isApproved: ${shop.isApproved}`);
      console.log(`   Created: ${shop.createdAt}`);
      console.log(`   ---`);
    });

    console.log("\n📋 Approved Shops Details:");
    approvedShops.slice(0, 5).forEach((shop, index) => {
      console.log(`${index + 1}. ${shop.name}`);
      console.log(`   ID: ${shop._id}`);
      console.log(`   Owner: ${shop.owner ? shop.owner.name : "No owner"}`);
      console.log(`   isApproved: ${shop.isApproved}`);
      console.log(`   ---`);
    });

    if (approvedShops.length > 5) {
      console.log(`   ... and ${approvedShops.length - 5} more approved shops`);
    }
  } catch (error) {
    console.error("❌ Error checking shops:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Run the script
checkShops();
