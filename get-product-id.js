import mongoose from 'mongoose';
import Product from './models/productModel.js';

const getProductId = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gold-platform');
    console.log('✅ Connected to MongoDB');

    const product = await Product.findOne({ isAvailable: true });
    if (product) {
      console.log('📦 Product ID:', product._id.toString());
      console.log('📦 Product Name:', product.title);
      console.log('💰 Product Price:', product.price);
    } else {
      console.log('❌ No available products found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

getProductId();
