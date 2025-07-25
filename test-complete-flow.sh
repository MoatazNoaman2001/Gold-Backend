#!/bin/bash

echo "🧪 Starting complete reservation flow test..."

BASE_URL="http://localhost:5010"
PRODUCT_ID="6882592352749dd641d1bd6a"
USER_EMAIL="mohamed@gmail.com"
RESERVATION_AMOUNT="2327.18"

# 1. إنشاء جلسة دفع
echo ""
echo "📝 Step 1: Creating payment session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/create-reservation-payment-session" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PRODUCT_ID\",\"reservationAmount\":$RESERVATION_AMOUNT,\"email\":\"$USER_EMAIL\",\"productName\":\"سلسلة\"}")

echo "✅ Payment session created"

# استخراج session ID من الـ URL
SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o 'cs_test_[^#]*' | head -1)
echo "🔑 Session ID: $SESSION_ID"

# 2. محاكاة إكمال الدفع عبر webhook
echo ""
echo "📝 Step 2: Simulating payment completion via webhook..."

WEBHOOK_DATA="{
  \"id\": \"evt_test_complete_flow\",
  \"object\": \"event\",
  \"type\": \"checkout.session.completed\",
  \"data\": {
    \"object\": {
      \"id\": \"$SESSION_ID\",
      \"object\": \"checkout.session\",
      \"payment_status\": \"paid\",
      \"customer_details\": {
        \"email\": \"$USER_EMAIL\"
      },
      \"metadata\": {
        \"type\": \"reservation\",
        \"productId\": \"$PRODUCT_ID\",
        \"reservationAmount\": \"$RESERVATION_AMOUNT\"
      }
    }
  }
}"

WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_DATA")

echo "✅ Webhook processed: $WEBHOOK_RESPONSE"

# انتظار ثانية واحدة
sleep 1

# 3. التحقق من الدفع وإنشاء الحجز
echo ""
echo "📝 Step 3: Verifying payment and creating reservation..."

VERIFICATION_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/verify-reservation-payment-public" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productId\":\"$PRODUCT_ID\"}")

echo "✅ Payment verification response: $VERIFICATION_RESPONSE"

# التحقق من النجاح
if echo "$VERIFICATION_RESPONSE" | grep -q '"status":"success"'; then
  echo ""
  echo "🎉 Complete reservation flow test PASSED!"
else
  echo ""
  echo "❌ Test failed - verification response: $VERIFICATION_RESPONSE"
fi
