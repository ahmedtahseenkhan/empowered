import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';

const router = express.Router();

// Webhook route - needs raw body, so we don't use the global express.json() here if possible, 
// OR we ensure we can get the raw body.
// In index.ts, we should mount this BEFORE the global json middleware or manage it carefully.
// Standard pattern: 
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
