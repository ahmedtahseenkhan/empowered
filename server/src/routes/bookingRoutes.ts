import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { createBooking } from '../controllers/bookingController';

const router = Router();

router.post('/', authenticateToken, createBooking);

export default router;
