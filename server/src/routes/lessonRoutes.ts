import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getMyLessons } from '../controllers/lessonController';

const router = Router();

router.get('/me', authenticateToken, getMyLessons);

export default router;
