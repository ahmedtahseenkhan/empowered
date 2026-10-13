import { Router } from 'express';
import { createTicket } from '../controllers/supportController';
import { optionalAuth } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';
import { botGuard } from '../middleware/botGuard';

const router = Router();

// Throttle the public contact form: max 5 submissions per IP per hour.
const supportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many submissions from this address. Please try again later.',
});

// Contact-form spam bots fill fields with random strings ("MzdcxDSaOXCSmjVWJbx").
const supportBotGuard = botGuard({
    textFields: ['subject', 'name', 'message'],
    fakeSuccess: { status: 201, body: { message: 'Your message has been sent. We will get back to you soon.' } },
});

router.post('/', supportLimiter, optionalAuth, supportBotGuard, createTicket);

export default router;
