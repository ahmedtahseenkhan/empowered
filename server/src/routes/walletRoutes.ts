import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    getMyWallet,
    getMyWalletHistory,
    getBookingQuote,
    createCreditsBooking,
    cancelCreditsLesson,
    reportSessionProblem,
    getMentorWalletEarnings,
} from '../controllers/walletController';

const router = express.Router();

router.use(authenticateToken);

// Student
router.get('/me', getMyWallet);
router.get('/me/history', getMyWalletHistory);
router.get('/quote', getBookingQuote);
router.post('/bookings', createCreditsBooking);
router.post('/lessons/:lessonId/cancel', cancelCreditsLesson);
router.post('/lessons/:lessonId/report', reportSessionProblem);

// Mentor
router.get('/mentor/earnings', getMentorWalletEarnings);

export default router;
