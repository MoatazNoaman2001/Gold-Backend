import mongoose from 'mongoose';
import Shop from './models/shopModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkShops = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all shops
    const allShops = await Shop.find({});
    console.log(`\n📊 Total shops in database: ${allShops.length}`);

    // Get shops by status
    const pendingShops = await Shop.find({ status: 'pending' });
    const approvedShops = await Shop.find({ status: 'approved' });
    const activeShops = await Shop.find({ status: 'active' });
    const rejectedShops = await Shop.find({ status: 'rejected' });

    console.log(`\n📋 Shops by status:`);
    console.log(`   ⏳ Pending: ${pendingShops.length}`);
    console.log(`   ✅ Approved: ${approvedShops.length}`);
    console.log(`   🟢 Active: ${activeShops.length}`);
    console.log(`   ❌ Rejected: ${rejectedShops.length}`);

    // Get shops by old fields
    const isApprovedShops = await Shop.find({ isApproved: true });
    console.log(`\n📋 Shops with isApproved=true: ${isApprovedShops.length}`);

    // Show some active shops
    if (activeShops.length > 0) {
      console.log(`\n🏪 Active shops:`);
      activeShops.slice(0, 5).forEach(shop => {
        console.log(`   - ${shop.name} (${shop.city || 'No city'})`);
      });
    }

    // Show some approved shops
    if (approvedShops.length > 0) {
      console.log(`\n✅ Approved shops:`);
      approvedShops.slice(0, 5).forEach(shop => {
        console.log(`   - ${shop.name} (${shop.city || 'No city'})`);
      });
    }

    // Show some isApproved shops
    if (isApprovedShops.length > 0) {
      console.log(`\n✅ isApproved=true shops:`);
      isApprovedShops.slice(0, 5).forEach(shop => {
        console.log(`   - ${shop.name} (status: ${shop.status}, isApproved: ${shop.isApproved})`);
      });
    }

    // If no active shops, let's activate some approved shops
    if (activeShops.length === 0 && (approvedShops.length > 0 || isApprovedShops.length > 0)) {
      console.log(`\n🔧 No active shops found. Activating some shops...`);
      
      // Activate shops that are approved or have isApproved=true
      const shopsToActivate = await Shop.find({
        $or: [
          { status: 'approved' },
          { isApproved: true }
        ]
      });

      if (shopsToActivate.length > 0) {
        const result = await Shop.updateMany(
          {
            $or: [
              { status: 'approved' },
              { isApproved: true }
            ]
          },
          { 
            status: 'active',
            isApproved: true
          }
        );
        console.log(`   ✅ Activated ${result.modifiedCount} shops`);
      }
    }

    // Final count
    const finalActiveShops = await Shop.find({ status: 'active' });
    console.log(`\n🎯 Final active shops count: ${finalActiveShops.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

checkShops();
