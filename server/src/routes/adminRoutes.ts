import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { logAdminAction } from '../utils/auditLog';
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
    adminListDemoSlots,
    adminRescheduleDemoBooking,
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
    adminGetGoogleMeetStatus,
    adminUpgradeSessionsToOpenAccess,
    adminListAuditLogs,
} from '../controllers/adminController';
import {
    adminGetStudentWallet,
    adminAdjustStudentCredits,
    adminListDisputes,
    adminResolveDispute,
    adminListMentorEarnings,
    adminMarkMentorPaid,
    adminSetWalletFrozen,
    adminRunSettlement,
    adminListPayouts,
} from '../controllers/walletController';

const router = express.Router();

/**
 * Audit a mutation handled by a controller outside adminController (e.g. wallet): records the
 * action once the response has been sent, only when it succeeded (status < 400).
 */
const BODY_FIELDS_TO_AUDIT = ['amount', 'type', 'reason', 'action', 'note', 'frozen', 'method', 'force', 'proofUrl'];
const auditOnSuccess = (action: string, targetType: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        if (res.statusCode >= 400) return;
        const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
        const details: Record<string, unknown> = {};
        for (const key of BODY_FIELDS_TO_AUDIT) {
            const value = body[key];
            if (value === undefined) continue;
            details[key] = typeof value === 'string' ? value.slice(0, 500) : value;
        }
        void logAdminAction(req, action, { type: targetType, id: req.params.id ?? null }, details);
    });
    next();
};

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/analytics', requirePermission('dashboard'), adminGetAnalytics);

router.get('/mentors', requirePermission('mentors'), adminListMentors);
router.get('/mentors/:id', requirePermission('mentors'), adminGetMentor);
router.put('/mentors/:id/approved', requirePermission('mentors'), adminSetMentorApproved);

router.get('/students', requirePermission('students'), adminListStudents);
router.get('/students/:id', requirePermission('students'), adminGetStudent);
router.get('/students/:id/wallet', requirePermission('students', 'payments'), adminGetStudentWallet);
router.post('/students/:id/credits', requirePermission('students', 'payments'), auditOnSuccess('wallet.credits_adjust', 'student_profile'), adminAdjustStudentCredits);
router.put('/students/:id/wallet/freeze', requirePermission('students', 'payments'), auditOnSuccess('wallet.freeze_toggle', 'student_profile'), adminSetWalletFrozen);

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
router.get('/wallet/disputes', requirePermission('payments'), adminListDisputes);
router.put('/wallet/disputes/:id/resolve', requirePermission('payments'), auditOnSuccess('wallet.dispute_resolve', 'dispute'), adminResolveDispute);
router.get('/wallet/mentor-earnings', requirePermission('payments'), adminListMentorEarnings);
router.put('/wallet/mentors/:id/mark-paid', requirePermission('payments'), auditOnSuccess('wallet.mark_paid', 'tutor_profile'), adminMarkMentorPaid);
router.post('/wallet/settlement/run', requirePermission('payments'), auditOnSuccess('wallet.settlement_run', 'settlement'), adminRunSettlement);
router.get('/wallet/payouts', requirePermission('payments'), adminListPayouts);

router.get('/support', requirePermission('support'), adminListTickets);
router.put('/support/:id/reply', requirePermission('support'), adminReplyTicket);

router.get('/demo-bookings', requirePermission('demo-requests'), adminListDemoBookings);
router.get('/demo-slots', requirePermission('demo-requests'), adminListDemoSlots);
router.patch('/demo-bookings/:id/reschedule', requirePermission('demo-requests'), adminRescheduleDemoBooking);

router.get('/demo-availability', requirePermission('demo-availability'), adminGetDemoAvailability);
router.put('/demo-availability', requirePermission('demo-availability'), adminPutDemoAvailability);

router.get('/google-meet/status', requirePermission('demo-availability', 'demo-requests'), adminGetGoogleMeetStatus);
router.post('/google-meet/upgrade-sessions', requirePermission('demo-availability', 'demo-requests'), adminUpgradeSessionsToOpenAccess);

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

router.get('/audit-logs', requireSuperAdmin, adminListAuditLogs);

export default router;
