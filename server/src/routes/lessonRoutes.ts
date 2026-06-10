import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getMyLessons, getLessonDetail, joinLesson, rescheduleLesson } from '../controllers/lessonController';

const router = Router();

router.get('/me', authenticateToken, getMyLessons);
router.get('/:lessonId/detail', authenticateToken, getLessonDetail);
router.get('/:lessonId/join', authenticateToken, joinLesson);
router.patch('/:lessonId/reschedule', authenticateToken, rescheduleLesson);

export default router;
