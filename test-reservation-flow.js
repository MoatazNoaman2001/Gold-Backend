import axios from 'axios';
import mongoose from 'mongoose';
import Product from './models/productModel.js';
import User from './models/userModel.js';
import SimpleReservation from './models/simpleReservationModel.js';
import Shop from './models/shopModel.js';

const BASE_URL = 'http://localhost:5010';

// اختبار تدفق الحجز الكامل
const testReservationFlow = async () => {
  try {
    console.log('🧪 Starting reservation flow test...');

    // الاتصال بقاعدة البيانات
    await mongoose.connect('mongodb://127.0.0.1:27017/gold-platform');
    console.log('✅ Connected to MongoDB');

    // البحث عن مستخدم موجود
    const user = await User.findOne({ email: 'mohamed@gmail.com' });
    if (!user) {
      console.error('❌ Test user not found');
      return;
    }
    console.log('✅ Found test user:', user.email);

    // البحث عن منتج متاح
    const product = await Product.findOne({ isAvailable: true }).populate('shop');
    if (!product) {
      console.error('❌ No available products found');
      return;
    }
    console.log('✅ Found test product:', product.title);

    // حساب مبلغ الحجز
    const totalAmount = parseFloat(product.price?.$numberDecimal || product.price || 0);
    const reservationAmount = totalAmount * 0.1;

    console.log('💰 Amounts:', {
      total: totalAmount,
      reservation: reservationAmount,
      remaining: totalAmount - reservationAmount
    });

    // 1. إنشاء جلسة دفع
    console.log('\n📝 Step 1: Creating payment session...');
    const sessionResponse = await axios.post(`${BASE_URL}/auth/create-reservation-payment-session`, {
      productId: product._id.toString(),
      reservationAmount: reservationAmount,
      email: user.email,
      productName: product.title
    });

    console.log('✅ Payment session created:', sessionResponse.data);
    const sessionUrl = sessionResponse.data;
    const sessionId = sessionUrl.split('session_id=')[1]?.split('&')[0];

    if (!sessionId) {
      console.error('❌ Could not extract session ID from URL');
      return;
    }

    console.log('🔑 Session ID:', sessionId);

    // 2. محاكاة إكمال الدفع عبر webhook
    console.log('\n📝 Step 2: Simulating payment completion via webhook...');
    const webhookData = {
      id: 'evt_test_webhook',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          customer_details: {
            email: user.email
          },
          metadata: {
            type: 'reservation',
            productId: product._id.toString(),
            reservationAmount: reservationAmount.toString()
          }
        }
      }
    };

    const webhookResponse = await axios.post(`${BASE_URL}/webhooks/stripe`, webhookData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Webhook processed:', webhookResponse.data);

    // 3. التحقق من إنشاء الحجز
    console.log('\n📝 Step 3: Verifying reservation creation...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // انتظار ثانية واحدة

    const reservation = await SimpleReservation.findOne({
      userId: user._id,
      productId: product._id
    }).populate(['productId', 'shopId', 'userId']);

    if (reservation) {
      console.log('✅ Reservation created successfully:', {
        id: reservation._id,
        status: reservation.status,
        totalAmount: reservation.totalAmount,
        reservationAmount: reservation.reservationAmount,
        remainingAmount: reservation.remainingAmount,
        expiryDate: reservation.expiryDate
      });
    } else {
      console.error('❌ Reservation not found in database');
    }

    // 4. التحقق من تحديث حالة المنتج
    const updatedProduct = await Product.findById(product._id);
    console.log('📦 Product availability updated:', !updatedProduct.isAvailable);

    console.log('\n🎉 Reservation flow test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// تشغيل الاختبار
testReservationFlow();
