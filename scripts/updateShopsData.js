import mongoose from 'mongoose';
import Shop from '../models/shopModel.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gold-platform');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Update shops with missing data
const updateShopsData = async () => {
  try {
    console.log('🔄 Starting shops data update...');
    
    // Get all shops
    const shops = await Shop.find({});
    console.log(`📊 Found ${shops.length} shops to update`);

    const sampleAddresses = [
      'شارع الجمهورية، وسط البلد، القاهرة',
      'شارع التحرير، الدقي، الجيزة',
      'شارع فيصل، الهرم، الجيزة',
      'شارع الهرم، الجيزة',
      'شارع النصر، مدينة نصر، القاهرة',
      'شارع العروبة، مصر الجديدة، القاهرة',
      'شارع الثورة، الإسكندرية',
      'كورنيش النيل، المعادي، القاهرة'
    ];

    const sampleSpecialties = [
      ['خواتم ذهب', 'دبل زفاف', 'مجوهرات نسائية'],
      ['قلائد ذهب', 'أساور', 'حلق ذهب'],
      ['ساعات ذهبية', 'خواتم رجالية', 'سلاسل ذهب'],
      ['مجوهرات أطفال', 'دلايات', 'خواتم خطوبة'],
      ['أساور ذهب', 'توينز ذهب', 'غوايش'],
      ['مجوهرات مرصعة', 'ألماس', 'أحجار كريمة']
    ];

    const samplePhones = [
      '01012345678',
      '01123456789',
      '01234567890',
      '01098765432',
      '01187654321',
      '01076543210'
    ];

    // Update each shop
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      const updates = {};

      // Add address if missing
      if (!shop.address && !shop.area) {
        updates.address = sampleAddresses[i % sampleAddresses.length];
      }

      // Add phone if missing
      if (!shop.phone && !shop.whatsapp) {
        updates.phone = samplePhones[i % samplePhones.length];
      }

      // Add specialties if missing
      if (!shop.specialties || shop.specialties.length === 0) {
        updates.specialties = sampleSpecialties[i % sampleSpecialties.length];
      }

      // Add working hours if missing
      if (!shop.workingHours) {
        updates.workingHours = '9:00 ص - 9:00 م';
      }

      // Add rating if missing
      if (!shop.rating && !shop.averageRating) {
        updates.rating = 4.0 + Math.random() * 1; // Random rating between 4.0 and 5.0
        updates.averageRating = updates.rating;
      }

      // Add review count if missing
      if (!shop.reviewCount) {
        updates.reviewCount = Math.floor(Math.random() * 50) + 5; // Random between 5 and 55
      }

      // Add description if missing
      if (!shop.description) {
        updates.description = `متجر ${shop.name || 'مجوهرات'} - نقدم أفضل المجوهرات والذهب عالي الجودة بأسعار مناسبة`;
      }

      // Update the shop if there are changes
      if (Object.keys(updates).length > 0) {
        await Shop.findByIdAndUpdate(shop._id, updates);
        console.log(`✅ Updated shop: ${shop.name || shop._id}`);
      }
    }

    console.log('🎉 All shops updated successfully!');
  } catch (error) {
    console.error('❌ Error updating shops:', error);
  }
};

// Run the update
const runUpdate = async () => {
  await connectDB();
  await updateShopsData();
  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
  process.exit(0);
};

runUpdate();
