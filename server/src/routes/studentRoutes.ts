import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getMyMentors } from '../controllers/studentController';

const router = Router();

router.get('/mentors', authenticateToken, getMyMentors);

export default router;
