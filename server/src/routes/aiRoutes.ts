import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { chat } from '../controllers/aiController';
import { rateLimit, byUser } from '../middleware/rateLimiter';

const router = Router();

const aiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    keyGenerator: byUser,
    message: 'You are sending messages too quickly. Please wait a few minutes and try again.',
});

// POST /api/ai/chat — send conversation history, get AI reply
router.post('/chat', authenticateToken, aiLimiter, chat);

export default router;
