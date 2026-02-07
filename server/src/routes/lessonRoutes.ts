import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getMyLessons, joinLesson } from '../controllers/lessonController';

const router = Router();

router.get('/me', authenticateToken, getMyLessons);
router.get('/:lessonId/join', authenticateToken, joinLesson);

export default router;
