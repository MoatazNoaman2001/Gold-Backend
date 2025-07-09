import mongoose from 'mongoose';
import Shop from './models/shopModel.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gold-platform');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Update shops with better data
const updateShopsData = async () => {
  try {
    const shops = await Shop.find({});
    console.log(`Found ${shops.length} shops to update`);

    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      
      // Update shop with better data
      const updatedData = {
        isApproved: true,
        description: shop.description || 'متجر مجوهرات وذهب عالي الجودة مع تشكيلة واسعة من القطع الفاخرة',
        specialties: shop.specialties || ['مجوهرات', 'ذهب', 'فضة', 'أحجار كريمة'],
        workingHours: shop.workingHours || 'السبت - الخميس: 9:00 ص - 9:00 م',
        phone: shop.phone || shop.whatsapp || '01000000000',
        rating: shop.rating || shop.averageRating || (4 + Math.random()).toFixed(1),
        reviewCount: shop.reviewCount || Math.floor(Math.random() * 50) + 10,
        address: shop.address || shop.area || shop.city || 'القاهرة، مصر'
      };

      await Shop.findByIdAndUpdate(shop._id, updatedData);
      console.log(`Updated shop: ${shop.name}`);
    }

    console.log('All shops updated successfully!');
  } catch (error) {
    console.error('Error updating shops:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await updateShopsData();
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
  process.exit(0);
};

main();
