import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadBase64File, uploadBase64Image } from '../controllers/uploadController';
import { rateLimit, byUser } from '../middleware/rateLimiter';

const router = Router();

const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    keyGenerator: byUser,
    message: 'Too many uploads. Please try again in a few minutes.',
});

router.post('/base64', authenticateToken, uploadLimiter, uploadBase64File);
router.post('/image', authenticateToken, uploadLimiter, uploadBase64Image);

export default router;
