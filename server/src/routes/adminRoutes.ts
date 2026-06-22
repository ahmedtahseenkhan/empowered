import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/requireAdmin';
import { requirePermission, requireSuperAdmin } from '../middleware/requirePermission';
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
    adminSetMentorApproved,
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
    adminListSubAdmins,
    adminCreateSubAdmin,
    adminUpdateSubAdmin,
    adminDeleteSubAdmin,
} from '../controllers/adminController';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/analytics', requirePermission('dashboard'), adminGetAnalytics);

router.get('/mentors', requirePermission('mentors'), adminListMentors);
router.get('/mentors/:id', requirePermission('mentors'), adminGetMentor);
router.put('/mentors/:id/approved', requirePermission('mentors'), adminSetMentorApproved);

router.get('/students', requirePermission('students'), adminListStudents);
router.get('/students/:id', requirePermission('students'), adminGetStudent);

// Suspend/unsuspend is used from both mentor and student detail pages.
router.put('/users/:userId/suspended', requirePermission('mentors', 'students'), adminSetUserSuspended);

router.get('/approvals/certifications', requirePermission('approvals'), adminListCertificationRequests);
router.put('/approvals/certifications/:id/approve', requirePermission('approvals'), adminApproveCertification);
router.put('/approvals/certifications/:id/reject', requirePermission('approvals'), adminRejectCertification);

router.get('/approvals/external-reviews', requirePermission('approvals'), adminListExternalReviewRequests);
router.put('/approvals/external-reviews/:id/approve', requirePermission('approvals'), adminApproveExternalReview);
router.put('/approvals/external-reviews/:id/reject', requirePermission('approvals'), adminRejectExternalReview);

router.get('/subscriptions', requirePermission('subscriptions'), adminListSubscriptions);
router.get('/payments', requirePermission('payments'), adminListPayments);

router.get('/support', requirePermission('support'), adminListTickets);
router.put('/support/:id/reply', requirePermission('support'), adminReplyTicket);

router.get('/demo-bookings', requirePermission('demo-requests'), adminListDemoBookings);

router.get('/demo-availability', requirePermission('demo-availability'), adminGetDemoAvailability);
router.put('/demo-availability', requirePermission('demo-availability'), adminPutDemoAvailability);

router.get('/demo-blocks', requirePermission('demo-availability'), adminListDemoBlocks);
router.post('/demo-blocks', requirePermission('demo-availability'), adminCreateDemoBlock);
router.put('/demo-blocks/:id', requirePermission('demo-availability'), adminUpdateDemoBlock);
router.delete('/demo-blocks/:id', requirePermission('demo-availability'), adminDeleteDemoBlock);

router.get('/beta-applications', requirePermission('beta-applications'), adminListBetaApplications);
router.put('/beta-applications/:id/approve', requirePermission('beta-applications'), adminApproveBetaApplication);
router.put('/beta-applications/:id/reject', requirePermission('beta-applications'), adminRejectBetaApplication);

// Sub-admin management — super admin only
router.get('/sub-admins', requireSuperAdmin, adminListSubAdmins);
router.post('/sub-admins', requireSuperAdmin, adminCreateSubAdmin);
router.put('/sub-admins/:id', requireSuperAdmin, adminUpdateSubAdmin);
router.delete('/sub-admins/:id', requireSuperAdmin, adminDeleteSubAdmin);

export default router;
