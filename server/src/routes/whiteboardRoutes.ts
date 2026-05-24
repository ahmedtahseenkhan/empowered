import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    listWhiteboards,
    getWhiteboard,
    createWhiteboard,
    updateWhiteboard,
    deleteWhiteboard,
    getOrCreateLessonWhiteboard,
} from '../controllers/whiteboardController';

const router = Router();

router.use(authenticateToken);

router.get('/lesson/:lessonId', getOrCreateLessonWhiteboard);
router.get('/', listWhiteboards);
router.get('/:id', getWhiteboard);
router.post('/', createWhiteboard);
router.put('/:id', updateWhiteboard);
router.delete('/:id', deleteWhiteboard);

export default router;
