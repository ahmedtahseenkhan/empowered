import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    createMentorSubscriptionCheckout,
    activateMentorTrial,
    cancelMentorSubscription,
    finalizeMentorSubscription,
    verifyMentorSubscription,
    createConnectOnboardingLink,
    createConnectLoginLink,
    getConnectAccountStatus,
    getSubscriptionStatus,
    createStudentBookingCheckout,
    finalizeStudentBookingCheckout,
    payNextStudentBookingSession,
    updateMentorSubscription,
    disconnectStripeAccount,
    getTutorEarningsOverview,
    getTutorPaymentHistory,
    getTutorUpcomingPayments,
    getTutorSubscriptionInfo,
    exportPaymentHistoryCSV,
    getMentorPlans,
} from '../controllers/paymentController';

const router = express.Router();

// Public: mentor plan config (price IDs, annual amounts) for pricing pages and checkout
router.get('/plans', getMentorPlans);

// All other routes require authentication
router.use(authenticateToken);

// Mentor Subscription
router.post('/mentor/subscription', createMentorSubscriptionCheckout);
router.post('/mentor/subscription/activate-trial', activateMentorTrial);
router.post('/mentor/subscription/cancel', cancelMentorSubscription);
router.post('/mentor/subscription/finalize', finalizeMentorSubscription);
router.post('/mentor/subscription/verify', verifyMentorSubscription);
router.put('/mentor/subscription', updateMentorSubscription);
router.get('/mentor/status', getSubscriptionStatus);

// Mentor Connect (Payouts)
router.post('/mentor/onboard', createConnectOnboardingLink);
router.post('/mentor/express-login', createConnectLoginLink);
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
router.post('/student/booking/finalize', finalizeStudentBookingCheckout);
router.post('/student/booking/pay-next', payNextStudentBookingSession);

export default router;

