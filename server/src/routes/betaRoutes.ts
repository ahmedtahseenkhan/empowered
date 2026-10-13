import { Router } from 'express';
import { submitBetaApplication, BETA_SUBMITTED_MESSAGE } from '../controllers/betaController';
import { rateLimit, byBodyEmail } from '../middleware/rateLimiter';
import { botGuard } from '../middleware/botGuard';

const router = Router();

const betaLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many submissions from this address. Please try again later.',
});
const betaInboxLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyGenerator: byBodyEmail,
    message: 'Too many submissions for this email address. Please try again later.',
});
const betaBotGuard = botGuard({
    textFields: ['full_name', 'service_description', 'biggest_challenge', 'referral_source'],
    fakeSuccess: { status: 201, body: { message: BETA_SUBMITTED_MESSAGE } },
});

router.post('/', betaLimiter, betaBotGuard, betaInboxLimiter, submitBetaApplication);

export default router;
