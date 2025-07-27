import Stripe from 'stripe';
import { setupDIContainer } from '../DI/Container.js';
import SimpleReservation from '../../models/simpleReservationModel.js';
import Product from '../../models/productModel.js';
import User from '../../models/userModel.js';

export class StripeWebhookHandler {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SCRETE);
    this.container = setupDIContainer();
    this.reservationRepository = this.container.resolve('reservationRepository');
    this.eventPublisher = this.container.resolve('eventPublisher');
  }

  handleWebhook = async (req, res) => {x
    const sig = req.headers['stripe-signature'];
    let event;

    // في البيئة التطويرية، يمكن تخطي التحقق من التوقيع
    if (process.env.NODE_ENV === 'development' && (!sig || !process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET === 'whsec_test_webhook_secret_placeholder')) {
      console.log('⚠️ Development mode: Skipping webhook signature verification');
      // تحويل Buffer إلى JSON إذا لزم الأمر
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    } else {
      try {
        event = this.stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log('✅ Webhook signature verified');
      } catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    }

    try {
      console.log('📋 Event received:', JSON.stringify(event, null, 2));
      await this.handleStripeEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };

  async handleStripeEvent(event) {
    console.log(`🔔 Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }
  }

  async handleCheckoutSessionCompleted(session) {
    console.log(`💳 Checkout session completed: ${session.id}`);

    try {
      // التحقق من نوع الجلسة من metadata
      if (session.metadata && session.metadata.type === 'reservation') {
        console.log('📦 Processing reservation payment completion');
        await this.handleReservationCheckoutCompleted(session);
      } else {
        console.log('💼 Processing subscription payment completion');
        // معالجة اشتراكات البائعين
        if (session.customer) {
          const customer = await this.stripe.customers.retrieve(session.customer);
          const email = customer.email;
          if (email) {
            const user = await User.findOne({ email, role: 'seller' });
            if (user && !user.paid) {
              user.paid = true;
              await user.save();
              console.log(`✅ Set paid=true for seller user ${email}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error handling checkout session:', error);
    }
  }

  async handlePaymentSuccess(paymentIntent) {
    const { metadata } = paymentIntent;
    if (metadata.type === 'reservation') {
      await this.handleReservationPaymentSuccess(paymentIntent, metadata);
    } else if (metadata.type === 'reservation_confirmation') {
      await this.handleConfirmationPaymentSuccess(paymentIntent, metadata);
    }
  }

  async handleReservationCheckoutCompleted(session) {
    try {
      const { productId } = session.metadata;
      const customerEmail = session.customer_details?.email;

      console.log('🔄 Processing reservation checkout completion:', {
        sessionId: session.id,
        productId,
        customerEmail,
        paymentStatus: session.payment_status
      });

      if (session.payment_status !== 'paid') {
        console.log('⚠️ Payment not completed, skipping reservation creation');
        return;
      }

      // البحث عن المستخدم بالإيميل
      const user = await User.findOne({ email: customerEmail });
      if (!user) {
        console.error('❌ User not found for email:', customerEmail);
        return;
      }

      // التحقق من وجود حجز موجود للمستخدم
      const existingReservation = await SimpleReservation.findOne({
        productId,
        userId: user._id,
        status: { $in: ['active', 'confirmed'] }
      });

      if (existingReservation) {
        console.log('✅ Reservation already exists:', existingReservation._id);
        return;
      }

      // التحقق من وجود حجوزات نشطة أخرى للمنتج
      const activeReservationForProduct = await SimpleReservation.findOne({
        productId,
        status: { $in: ['active', 'confirmed'] }
      });

      if (activeReservationForProduct) {
        console.log('⚠️ Product already reserved by another user');
        return;
      }

      // الحصول على تفاصيل المنتج
      const product = await Product.findById(productId);
      if (!product) {
        console.error('❌ Product not found:', productId);
        return;
      }

      // إعادة تعيين حالة المنتج إذا لم توجد حجوزات نشطة
      if (!product.isAvailable) {
        product.isAvailable = true;
        console.log('✅ Product availability reset to true for webhook processing');
      }

      // حساب المبالغ
      const totalAmount = parseFloat(product.price?.$numberDecimal || product.price || 0);
      const reservationAmount = totalAmount * 0.10; // 10%
      const remainingAmount = totalAmount - reservationAmount;

      // إنشاء الحجز
      const reservation = await SimpleReservation.create({
        userId: user._id,
        productId,
        shopId: product.shop,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        reservationAmount: parseFloat(reservationAmount.toFixed(2)),
        remainingAmount: parseFloat(remainingAmount.toFixed(2)),
        status: 'active',
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
        paymentMethodId: session.id // استخدام session ID
      });

      // تحديث حالة المنتج إلى غير متاح
      product.isAvailable = false;
      await product.save();

      console.log('✅ Reservation created via webhook:', reservation._id);

    } catch (error) {
      console.error('❌ Error in handleReservationCheckoutCompleted:', error);
    }
  }

  async handleReservationPaymentSuccess(paymentIntent, metadata) {
    try {
      const reservation = await this.reservationRepository.findByStripePaymentIntent(
        paymentIntent.id
      );
      if (reservation && reservation.status === 'PENDING') {
        reservation.status = 'ACTIVE';
        await this.reservationRepository.save(reservation);
        await this.eventPublisher.publish('ReservationActivated', {
          reservationId: reservation.id,
          userId: reservation.userId,
          productId: reservation.productId
        });
      }
    } catch (error) {
      console.error('Error handling reservation payment success:', error);
    }
  }

  async handleConfirmationPaymentSuccess(paymentIntent, metadata) {
    try {
      const reservation = await this.reservationRepository.findById(
        metadata.reservationId
      );
      if (reservation && reservation.status === 'CONFIRMED') {
        reservation.status = 'COMPLETED';
        await this.reservationRepository.save(reservation);
        await this.eventPublisher.publish('ReservationCompleted', {
          reservationId: reservation.id,
          userId: reservation.userId,
          productId: reservation.productId,
          totalAmount: reservation.totalAmount
        });
      }
    } catch (error) {
      console.error('Error handling confirmation payment success:', error);
    }
  }

  async handlePaymentFailure(paymentIntent) {
    const { metadata } = paymentIntent;
    try {
      if (metadata.type === 'reservation') {
        const reservation = await this.reservationRepository.findByStripePaymentIntent(
          paymentIntent.id
        );
        if (reservation) {
          reservation.status = 'CANCELLED';
          reservation.cancelationReason = 'Payment failed';
          reservation.cancelationDate = new Date();
          await this.reservationRepository.save(reservation);
          await this.eventPublisher.publish('ReservationPaymentFailed', {
            reservationId: reservation.id,
            userId: reservation.userId,
            reason: 'Payment failed'
          });
        }
      }
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }
} 