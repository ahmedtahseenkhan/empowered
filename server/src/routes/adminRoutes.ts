import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import {
    adminApproveCertification,
    adminApproveExternalReview,
    adminGetMentor,
    adminGetStudent,
    adminListCertificationRequests,
    adminListExternalReviewRequests,
    adminListMentors,
    adminListStudents,
    adminRejectCertification,
    adminRejectExternalReview,
    adminSetUserSuspended,
    adminListSubscriptions,
    adminListPayments,
    adminListTickets,
    adminReplyTicket,
    adminGetAnalytics,
} from '../controllers/adminController';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/analytics', adminGetAnalytics);

router.get('/mentors', adminListMentors);
router.get('/mentors/:id', adminGetMentor);

router.get('/students', adminListStudents);
router.get('/students/:id', adminGetStudent);

router.put('/users/:userId/suspended', adminSetUserSuspended);

router.get('/approvals/certifications', adminListCertificationRequests);
router.put('/approvals/certifications/:id/approve', adminApproveCertification);
router.put('/approvals/certifications/:id/reject', adminRejectCertification);

router.get('/approvals/external-reviews', adminListExternalReviewRequests);
router.put('/approvals/external-reviews/:id/approve', adminApproveExternalReview);
router.put('/approvals/external-reviews/:id/reject', adminRejectExternalReview);

router.get('/subscriptions', adminListSubscriptions);
router.get('/payments', adminListPayments);

router.get('/support', adminListTickets);
router.put('/support/:id/reply', adminReplyTicket);

export default router;
