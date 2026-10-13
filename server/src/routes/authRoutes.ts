import { Router } from 'express';
import { register, login, logout, me, changePassword, updateDisplayName, forgotPassword, resetPassword, resendVerification, verifyEmailCode } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { rateLimit, byBodyEmail } from '../middleware/rateLimiter';
import { botGuard } from '../middleware/botGuard';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again in 15 minutes.' });
const loginAccountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyGenerator: byBodyEmail, message: 'Too many login attempts for this account. Please try again in 15 minutes.' });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please try again in 15 minutes.' });
const codeAccountLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyGenerator: byBodyEmail, message: 'Too many attempts. Please try again in 15 minutes.' });
const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many requests. Please try again later.' });
// Caps emails sent to any one inbox, however many IPs a bot uses (one limiter per route).
const inboxLimiter = () => rateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyGenerator: byBodyEmail, message: 'Too many emails requested for this address. Please try again later.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const registerBotGuard = botGuard({
    textFields: ['username'],
    fakeSuccess: { status: 201, body: { message: 'User registered successfully. Please check your email for a verification code.', requiresVerification: true } },
});
const emailBotGuard = botGuard({ fakeSuccess: { body: { message: 'If an account exists for that email, a code has been sent.' } } });

router.post('/register', registerLimiter, registerBotGuard, inboxLimiter(), register);
router.post('/login', loginLimiter, loginAccountLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticateToken, me);
router.post('/change-password', passwordLimiter, authenticateToken, changePassword);
router.put('/update-profile', authenticateToken, updateDisplayName);
router.post('/forgot-password', emailLimiter, emailBotGuard, inboxLimiter(), forgotPassword);
router.post('/reset-password', codeLimiter, codeAccountLimiter, resetPassword);
router.post('/resend-verification', emailLimiter, emailBotGuard, inboxLimiter(), resendVerification);
router.post('/verify-email-code', codeLimiter, codeAccountLimiter, verifyEmailCode);

export default router;
