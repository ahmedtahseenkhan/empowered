import express from 'express';
import { getDemoSlots, createDemoBooking, demoOAuthStart, demoOAuthCallback } from '../controllers/demoController';

const router = express.Router();

router.get('/slots', getDemoSlots);
router.post('/bookings', createDemoBooking);

// One-time OAuth flow to obtain GOOGLE_DEMO_REFRESH_TOKEN (add redirect URI to Google Console)
router.get('/oauth-start', demoOAuthStart);
router.get('/oauth-callback', demoOAuthCallback);

export default router;
