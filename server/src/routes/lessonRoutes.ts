import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getMyLessons, getLessonDetail, joinLesson } from '../controllers/lessonController';

const router = Router();

router.get('/me', authenticateToken, getMyLessons);
router.get('/:lessonId/detail', authenticateToken, getLessonDetail);
router.get('/:lessonId/join', authenticateToken, joinLesson);

export default router;
