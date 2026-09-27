import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getMyMentors, getMyProfile } from '../controllers/studentController';

const router = Router();

router.get('/me', authenticateToken, getMyProfile);
router.get('/mentors', authenticateToken, getMyMentors);

export default router;
