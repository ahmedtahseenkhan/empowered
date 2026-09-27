import { Router } from 'express';
import { register, login, me, changePassword, updateDisplayName, forgotPassword, resetPassword, verifyEmail, resendVerification, verifyEmailCode } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again in 15 minutes.' });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many attempts. Please try again in 15 minutes.' });
const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many requests. Please try again later.' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticateToken, me);
router.post('/change-password', passwordLimiter, authenticateToken, changePassword);
router.put('/update-profile', authenticateToken, updateDisplayName);
router.post('/forgot-password', emailLimiter, forgotPassword);
router.post('/reset-password', codeLimiter, resetPassword);
router.post('/verify-email', codeLimiter, verifyEmail);
router.post('/resend-verification', emailLimiter, resendVerification);
router.post('/verify-email-code', codeLimiter, verifyEmailCode);

export default router;
