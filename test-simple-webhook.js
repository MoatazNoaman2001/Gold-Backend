import axios from 'axios';

// اختبار بسيط للـ webhook
const testSimpleWebhook = async () => {
  try {
    console.log('🧪 Testing simple webhook...');

    // بيانات webhook مبسطة
    const webhookData = {
      id: 'evt_test_simple',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_simple_session',
          object: 'checkout.session',
          payment_status: 'paid',
          customer_details: {
            email: 'mohamed@gmail.com'
          },
          metadata: {
            type: 'reservation',
            productId: '6762b8b8b8b8b8b8b8b8b8b8', // ID وهمي
            reservationAmount: '100'
          }
        }
      }
    };

    console.log('📤 Sending webhook data:', JSON.stringify(webhookData, null, 2));

    const response = await axios.post('http://localhost:5010/webhooks/stripe', webhookData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Webhook response:', response.data);
    console.log('📊 Status:', response.status);

  } catch (error) {
    console.error('❌ Webhook test failed:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  }
};

testSimpleWebhook();
