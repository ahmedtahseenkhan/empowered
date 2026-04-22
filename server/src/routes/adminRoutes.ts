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
    adminListDemoBookings,
    adminGetDemoAvailability,
    adminPutDemoAvailability,
    adminListDemoBlocks,
    adminCreateDemoBlock,
    adminUpdateDemoBlock,
    adminDeleteDemoBlock,
    adminListBetaApplications,
    adminApproveBetaApplication,
    adminRejectBetaApplication,
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

router.get('/demo-bookings', adminListDemoBookings);

router.get('/demo-availability', adminGetDemoAvailability);
router.put('/demo-availability', adminPutDemoAvailability);

router.get('/demo-blocks', adminListDemoBlocks);
router.post('/demo-blocks', adminCreateDemoBlock);
router.put('/demo-blocks/:id', adminUpdateDemoBlock);
router.delete('/demo-blocks/:id', adminDeleteDemoBlock);

router.get('/beta-applications', adminListBetaApplications);
router.put('/beta-applications/:id/approve', adminApproveBetaApplication);
router.put('/beta-applications/:id/reject', adminRejectBetaApplication);

export default router;
