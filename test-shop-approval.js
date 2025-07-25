import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from './models/shopModel.js';

// Load environment variables
dotenv.config();

const testShopApproval = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find the shop with the ID from the error
    const shopId = '68824dd7bee4ae54a49d46cb';
    
    console.log(`\n🔍 Looking for shop with ID: ${shopId}`);
    
    const shop = await Shop.findById(shopId);
    if (!shop) {
      console.log('❌ Shop not found');
      return;
    }

    console.log('📋 Current shop status:');
    console.log(`   Name: ${shop.name}`);
    console.log(`   Owner: ${shop.owner}`);
    console.log(`   isApproved: ${shop.isApproved}`);
    console.log(`   requestStatus: ${shop.requestStatus}`);
    console.log(`   rejectionReason: ${shop.rejectionReason}`);

    // Update the shop to approved status
    console.log('\n🔄 Updating shop to approved status...');
    
    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      {
        isApproved: true,
        requestStatus: 'approved'
      },
      { new: true }
    );

    if (updatedShop) {
      console.log('✅ Shop updated successfully!');
      console.log('📋 New shop status:');
      console.log(`   Name: ${updatedShop.name}`);
      console.log(`   isApproved: ${updatedShop.isApproved}`);
      console.log(`   requestStatus: ${updatedShop.requestStatus}`);
    } else {
      console.log('❌ Failed to update shop');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

testShopApproval();
