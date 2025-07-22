import Stripe from 'stripe';
import { setupDIContainer } from '../DI/Container.js';

export class StripeWebhookHandler {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SCRETE);
    this.container = setupDIContainer();
    this.reservationRepository = this.container.resolve('reservationRepository');
    this.eventPublisher = this.container.resolve('eventPublisher');
  }

  handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req.body, 
        sig, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      await this.handleStripeEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };

  async handleStripeEvent(event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
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