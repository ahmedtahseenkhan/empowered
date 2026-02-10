import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    createMentorSubscriptionCheckout,
    createConnectOnboardingLink,
    getConnectAccountStatus,
    getSubscriptionStatus,
    createStudentBookingCheckout,
    payNextStudentBookingSession,
    updateMentorSubscription,
    disconnectStripeAccount,
    getTutorEarningsOverview,
    getTutorPaymentHistory,
    getTutorUpcomingPayments,
    getTutorSubscriptionInfo,
    exportPaymentHistoryCSV,
} from '../controllers/paymentController';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Mentor Subscription
router.post('/mentor/subscription', createMentorSubscriptionCheckout);
router.put('/mentor/subscription', updateMentorSubscription);
router.get('/mentor/status', getSubscriptionStatus);

// Mentor Connect (Payouts)
router.post('/mentor/onboard', createConnectOnboardingLink);
router.get('/mentor/connect-status', getConnectAccountStatus);
router.delete('/mentor/connect-account', disconnectStripeAccount);

// Tutor Payment Analytics
router.get('/tutor/earnings/overview', getTutorEarningsOverview);
router.get('/tutor/earnings/history', getTutorPaymentHistory);
router.get('/tutor/earnings/upcoming', getTutorUpcomingPayments);
router.get('/tutor/subscription-info', getTutorSubscriptionInfo);
router.get('/tutor/earnings/export', exportPaymentHistoryCSV);

// Student Booking
router.post('/student/booking', createStudentBookingCheckout);
router.post('/student/booking/pay-next', payNextStudentBookingSession);

export default router;

