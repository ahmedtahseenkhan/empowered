import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { createBooking, createFreeSessionBooking } from '../controllers/bookingController';

const router = Router();

router.post('/', authenticateToken, createBooking);
router.post('/free-session', authenticateToken, createFreeSessionBooking);

export default router;
