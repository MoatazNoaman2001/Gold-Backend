import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from './models/shopModel.js';
import ShopRating from './models/shopRatingModel.js';
import User from './models/userModel.js';

// Load environment variables
dotenv.config();

const addSampleRatings = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all shops
    const shops = await Shop.find({}).limit(5);
    console.log(`📋 Found ${shops.length} shops`);

    // Get some users to create ratings
    const users = await User.find({ role: 'customer' }).limit(10);
    console.log(`👥 Found ${users.length} users`);

    if (users.length === 0) {
      console.log('❌ No users found. Creating sample users...');
      
      // Create sample users
      const sampleUsers = [
        { name: 'أحمد محمد', email: 'ahmed@test.com', role: 'customer' },
        { name: 'فاطمة علي', email: 'fatma@test.com', role: 'customer' },
        { name: 'محمد حسن', email: 'mohamed@test.com', role: 'customer' },
        { name: 'نور الدين', email: 'nour@test.com', role: 'customer' },
        { name: 'سارة أحمد', email: 'sara@test.com', role: 'customer' }
      ];

      for (const userData of sampleUsers) {
        const user = new User(userData);
        await user.save();
        users.push(user);
      }
      console.log('✅ Created sample users');
    }

    // Add ratings for each shop
    for (const shop of shops) {
      console.log(`\n🏪 Adding ratings for shop: ${shop.name}`);
      
      // Clear existing ratings for this shop
      await ShopRating.deleteMany({ shop: shop._id });
      
      // Add 3-7 random ratings per shop
      const numRatings = Math.floor(Math.random() * 5) + 3; // 3-7 ratings
      
      for (let i = 0; i < numRatings; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const rating = Math.floor(Math.random() * 5) + 1; // 1-5 stars
        
        const comments = [
          'متجر ممتاز وخدمة رائعة',
          'جودة عالية وأسعار مناسبة',
          'تعامل محترم وصدق في التعامل',
          'منتجات جميلة ومتنوعة',
          'أنصح بالتعامل مع هذا المتجر',
          'خدمة سريعة وموثوقة',
          'تشكيلة رائعة من المجوهرات'
        ];
        
        const randomComment = comments[Math.floor(Math.random() * comments.length)];
        
        try {
          const shopRating = new ShopRating({
            shop: shop._id,
            user: randomUser._id,
            rating: rating,
            comment: randomComment
          });
          
          await shopRating.save();
          console.log(`   ⭐ Added ${rating}-star rating from ${randomUser.name}`);
        } catch (error) {
          if (error.code === 11000) {
            console.log(`   ⚠️ User ${randomUser.name} already rated this shop`);
          } else {
            console.error(`   ❌ Error adding rating:`, error.message);
          }
        }
      }
      
      // Calculate and update average rating
      const ratings = await ShopRating.find({ shop: shop._id });
      const validRatings = ratings.map(r => r.rating).filter(r => r >= 1 && r <= 5);
      
      const average = validRatings.length > 0 
        ? Math.round((validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length) * 10) / 10
        : 0;
      
      await Shop.findByIdAndUpdate(shop._id, {
        averageRating: average,
        rating: average,
        reviewCount: validRatings.length
      });
      
      console.log(`   📊 Updated shop average rating: ${average} (${validRatings.length} reviews)`);
    }

    console.log('\n🎉 Sample ratings added successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

addSampleRatings();
