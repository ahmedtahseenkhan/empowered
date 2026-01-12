import { Router } from 'express';
import { getTutorAvailabilitySlots } from '../controllers/availabilityController';

const router = Router();

// Public endpoint for students to see tutor availability
// GET /api/availability/tutor/:tutorId/slots?from=...&to=...&durationMinutes=50&stepMinutes=15
router.get('/tutor/:tutorId/slots', getTutorAvailabilitySlots);

export default router;
