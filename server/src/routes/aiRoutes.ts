import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { chat } from '../controllers/aiController';

const router = Router();

// POST /api/ai/chat — send conversation history, get AI reply
router.post('/chat', authenticateToken, chat);

export default router;
