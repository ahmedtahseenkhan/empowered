import { Router } from 'express';
import { createTicket } from '../controllers/supportController';
import { optionalAuth } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';

const router = Router();

// Throttle the public contact form: max 5 submissions per IP per hour.
const supportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many submissions from this address. Please try again later.',
});

router.post('/', supportLimiter, optionalAuth, createTicket);

export default router;
