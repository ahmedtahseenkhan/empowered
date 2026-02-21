import express from 'express';
import { getDemoSlots, createDemoBooking } from '../controllers/demoController';

const router = express.Router();

router.get('/slots', getDemoSlots);
router.post('/bookings', createDemoBooking);

export default router;
