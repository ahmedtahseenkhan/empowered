import express, { NextFunction, Request, Response } from 'express';
import { getDemoSlots, createDemoBooking, demoOAuthStart, demoOAuthCallback } from '../controllers/demoController';
import { rateLimit, byBodyEmail } from '../middleware/rateLimiter';
import { botGuard } from '../middleware/botGuard';
import { authenticateAnySession, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

const slotsLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 120 });
const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many booking attempts from this address. Please try again later.',
});
const bookingInboxLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyGenerator: byBodyEmail,
    message: 'Too many bookings for this email address. Please try again later.',
});
const bookingBotGuard = botGuard({
    textFields: ['full_name'],
    fakeSuccess: {
        status: 201,
        body: { booking: { id: '00000000-0000-4000-8000-000000000000', slot_start_time: null, slot_end_time: null, meeting_link: null } },
    },
});

router.get('/slots', slotsLimiter, getDemoSlots);
router.post('/bookings', bookingLimiter, bookingBotGuard, bookingInboxLimiter, createDemoBooking);

/**
 * Admin tool to obtain GOOGLE_DEMO_REFRESH_TOKEN. Open to anyone only while
 * ENABLE_DEMO_OAUTH_SETUP=true (first-time setup); otherwise only a signed-in admin
 * (the admin panel's "Reconnect" button) can reach it — everyone else gets a 404.
 */
const demoOAuthGate = (req: Request, res: Response, next: NextFunction) => {
    if (process.env.ENABLE_DEMO_OAUTH_SETUP === 'true') return next();
    const notFound = () => {
        if (!res.headersSent) res.status(404).json({ error: 'Not found' });
    };
    // authenticateAnySession answers failures via res.status().json(); turn those into a 404.
    const quietRes = { status: () => ({ json: notFound }) } as unknown as Response;
    void authenticateAnySession(req as AuthRequest, quietRes, () =>
        (req as AuthRequest).user?.role === 'ADMIN' ? next() : notFound()
    );
};

router.get('/oauth-start', demoOAuthGate, demoOAuthStart);
router.get('/oauth-callback', demoOAuthGate, demoOAuthCallback);

export default router;
