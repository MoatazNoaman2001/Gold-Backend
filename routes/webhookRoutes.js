import express from 'express';
import { StripeWebhookHandler } from '../Infrastructure/Webhooks/StripeWebhookHandler.js';

const router = express.Router();
const webhookHandler = new StripeWebhookHandler();

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Handle Stripe webhooks for payment confirmations
 * @access  Public (Stripe only)
 */
router.post('/stripe', 
  express.raw({ type: 'application/json' }), 
  webhookHandler.handleWebhook
);

export default router; 