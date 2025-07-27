import axios from 'axios';

const BASE_URL = 'http://localhost:5010';

// اختبار التدفق الكامل للحجز
const testCompleteReservationFlow = async () => {
  try {
    console.log('🧪 Starting complete reservation flow test...');

    const productId = '6882592352749dd641d1bd6a';
    const userEmail = 'mohamed@gmail.com';
    const reservationAmount = 2327.18;

    // 1. إنشاء جلسة دفع
    console.log('\n📝 Step 1: Creating payment session...');
    const sessionResponse = await axios.post(`${BASE_URL}/auth/create-reservation-payment-session`, {
      productId,
      reservationAmount,
      email: userEmail,
      productName: 'سلسلة'
    });

    console.log('✅ Payment session created');
    const sessionUrl = sessionResponse.data;
    const sessionId = sessionUrl.split('cs_test_')[1].split('#')[0];
    const fullSessionId = 'cs_test_' + sessionId;

    console.log('🔑 Session ID:', fullSessionId);

    // 2. محاكاة إكمال الدفع عبر webhook
    console.log('\n📝 Step 2: Simulating payment completion via webhook...');
    const webhookData = {
      id: 'evt_test_complete_flow',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: fullSessionId,
          object: 'checkout.session',
          payment_status: 'paid',
          customer_details: {
            email: userEmail
          },
          metadata: {
            type: 'reservation',
            productId: productId,
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

    // 3. التحقق من الدفع وإنشاء الحجز (محاكاة ما يحدث في الفرونت اند)
    console.log('\n📝 Step 3: Verifying payment and creating reservation...');
    
    // انتظار ثانية واحدة للتأكد من معالجة الـ webhook
    await new Promise(resolve => setTimeout(resolve, 1000));

    const verificationResponse = await axios.post(`${BASE_URL}/auth/verify-reservation-payment-public`, {
      sessionId: fullSessionId,
      productId: productId
    });

    console.log('✅ Payment verification response:', verificationResponse.data);

    if (verificationResponse.data.status === 'success') {
      console.log('\n🎉 Complete reservation flow test PASSED!');
      console.log('📋 Reservation details:', {
        id: verificationResponse.data.data.reservation._id,
        status: verificationResponse.data.data.reservation.status,
        totalAmount: verificationResponse.data.data.reservation.totalAmount,
        reservationAmount: verificationResponse.data.data.reservation.reservationAmount
      });
    } else {
      console.log('\n❌ Verification failed:', verificationResponse.data.message);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
};

// تشغيل الاختبار
testCompleteReservationFlow();
