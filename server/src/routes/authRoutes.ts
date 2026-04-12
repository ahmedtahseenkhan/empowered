import { Router } from 'express';
import { register, login, me, changePassword, updateDisplayName, forgotPassword, resetPassword, verifyEmail, resendVerification, verifyEmailCode } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, me);
router.post('/change-password', authenticateToken, changePassword);
router.put('/update-profile', authenticateToken, updateDisplayName);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/verify-email-code', verifyEmailCode);

export default router;
