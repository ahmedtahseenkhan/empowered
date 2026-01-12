import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    startConnectGoogleCalendar,
    googleCalendarOAuthCallback,
    disconnectGoogleCalendar,
    getTutorFreeBusy,
} from '../controllers/googleCalendarController';

const router = Router();

router.get('/connect', authenticateToken, startConnectGoogleCalendar);
router.get('/callback', googleCalendarOAuthCallback);
router.post('/disconnect', authenticateToken, disconnectGoogleCalendar);

// Public endpoint used by booking UI to mask availability
router.get('/tutor/:tutorId/freebusy', getTutorFreeBusy);

export default router;
