import Stripe from 'stripe';

export class StripePaymentService {
  constructor(stripeSecretKey) {
    this.stripe = new Stripe(stripeSecretKey);
  }

  async createPaymentIntent({
    amount,
    currency,
    paymentMethodId,
    customerId,
    metadata = {}
  }) {
    return await this.stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      customer: customerId,
      confirmation_method: 'manual',
      confirm: true,
      metadata,
      return_url: `${process.env.CLIENT_URL}/reservation/success`
    });
  }

  async createRefund({ paymentIntentId, amount, reason }) {
    return await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason
    });
  }

  async retrievePaymentIntent(paymentIntentId) {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }
} 