import axios from 'axios';

// محاكاة webhook من Stripe
const testWebhook = async () => {
  const webhookData = {
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_session_123',
        object: 'checkout.session',
        payment_status: 'paid',
        customer_details: {
          email: 'mohamed@gmail.com'
        },
        metadata: {
          type: 'reservation',
          productId: '6762b8b8b8b8b8b8b8b8b8b8' // استبدل بـ product ID حقيقي
        }
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test_123',
      idempotency_key: null
    },
    type: 'checkout.session.completed'
  };

  try {
    console.log('🧪 Testing webhook...');
    
    const response = await axios.post('http://localhost:5010/webhooks/stripe', webhookData, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'test_signature'
      }
    });

    console.log('✅ Webhook test successful:', response.data);
  } catch (error) {
    console.error('❌ Webhook test failed:', error.response?.data || error.message);
  }
};

testWebhook();
