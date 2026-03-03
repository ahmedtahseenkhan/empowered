import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { createBooking, createFreeSessionBooking, getFreeSessionEligibility } from '../controllers/bookingController';

const router = Router();

router.post('/', authenticateToken, createBooking);
router.get('/free-session/eligibility', authenticateToken, getFreeSessionEligibility);
router.post('/free-session', authenticateToken, createFreeSessionBooking);

export default router;
