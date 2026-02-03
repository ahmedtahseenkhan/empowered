import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
    createMentorSubscriptionCheckout,
    createConnectOnboardingLink,
    getConnectAccountStatus,
    getSubscriptionStatus,
    createStudentBookingCheckout,
    updateMentorSubscription,
    disconnectStripeAccount
} from '../controllers/paymentController';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Mentor Subscription
// Mentor Subscription
router.post('/mentor/subscription', createMentorSubscriptionCheckout);
router.put('/mentor/subscription', updateMentorSubscription);
router.get('/mentor/status', getSubscriptionStatus);

// Mentor Connect (Payouts)
router.post('/mentor/onboard', createConnectOnboardingLink);
router.get('/mentor/connect-status', getConnectAccountStatus);
router.delete('/mentor/connect-account', disconnectStripeAccount);

// Student Booking
router.post('/student/booking', createStudentBookingCheckout);

export default router;
