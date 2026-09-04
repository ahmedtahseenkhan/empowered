import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import emailService from '../services/emailService';
import { hashPassword } from '../utils/auth';
import { ADMIN_PERMISSION_KEYS, isValidPermissionKey, formatPermissionList } from '../constants/adminPermissions';
import {
    ADMIN_TIMEZONE,
    SLOT_DURATION_MINUTES,
    checkDemoSlotAvailable,
    getAvailableDemoSlots,
} from '../services/demoAvailability';
import { createDemoMeetEvent, updateDemoMeetEvent } from '../services/googleCalendar';

export const adminListMentors = async (req: AuthRequest, res: Response) => {
    try {
        const q = (req.query.q as string | undefined)?.trim();

        const mentors = await prisma.tutorProfile.findMany({
            where: q
                ? {
                    OR: [
                        { username: { contains: q, mode: 'insensitive' } },
                        { user: { email: { contains: q, mode: 'insensitive' } } },
                    ],
                }
                : undefined,
            select: {
                id: true,
                username: true,
                profile_photo: true,
                tier: true,
                is_verified: true,
                user: { select: { id: true, email: true, is_suspended: true, created_at: true } },
            },
            orderBy: { user: { created_at: 'desc' } },
            take: 200,
        });

        return res.json({ mentors });
    } catch (error) {
        console.error('adminListMentors error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminGetMentor = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Mentor id is required' });

        const mentor = await prisma.tutorProfile.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, email: true, is_suspended: true, is_verified: true } },
                certifications: true,
                external_reviews: true,
                categories: { include: { category: true } },
                education: true,
                experience: true,
            },
        });

        if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
        return res.json({ mentor });
    } catch (error) {
        console.error('adminGetMentor error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListStudents = async (req: AuthRequest, res: Response) => {
    try {
        const q = (req.query.q as string | undefined)?.trim();

        const students = await prisma.studentProfile.findMany({
            where: q
                ? {
                    OR: [
                        { username: { contains: q, mode: 'insensitive' } },
                        { user: { email: { contains: q, mode: 'insensitive' } } },
                    ],
                }
                : undefined,
            select: {
                id: true,
                username: true,
                profile_photo: true,
                grade_level: true,
                user: { select: { id: true, email: true, is_suspended: true, created_at: true } },
            },
            orderBy: { user: { created_at: 'desc' } },
            take: 200,
        });

        return res.json({ students });
    } catch (error) {
        console.error('adminListStudents error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminGetStudent = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Student id is required' });

        const student = await prisma.studentProfile.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, email: true, is_suspended: true } },
                lessons: { take: 50, orderBy: { start_time: 'desc' } },
                bookings: { take: 50, orderBy: { created_at: 'desc' } },
            },
        });

        if (!student) return res.status(404).json({ error: 'Student not found' });
        return res.json({ student });
    } catch (error) {
        console.error('adminGetStudent error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminSetUserSuspended = async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { is_suspended } = req.body as { is_suspended?: boolean };

        if (!userId) return res.status(400).json({ error: 'userId is required' });
        if (typeof is_suspended !== 'boolean') return res.status(400).json({ error: 'is_suspended must be a boolean' });

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { is_suspended },
            select: { id: true, email: true, role: true, is_suspended: true },
        });

        return res.json({ user: updated });
    } catch (error) {
        console.error('adminSetUserSuspended error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

// Approve (or revoke approval of) a mentor. Sets TutorProfile.is_verified, which
// gates whether the mentor appears in the public listing / profile pages.
export const adminSetMentorApproved = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // tutor profile id
        const { is_verified } = req.body as { is_verified?: boolean };

        if (!id) return res.status(400).json({ error: 'Mentor id is required' });
        if (typeof is_verified !== 'boolean') return res.status(400).json({ error: 'is_verified must be a boolean' });

        // Read the current state so we only send the "profile is now live" email
        // on the transition from unverified → verified (not on repeated saves).
        const existing = await prisma.tutorProfile.findUnique({
            where: { id },
            select: { is_verified: true },
        });
        if (!existing) return res.status(404).json({ error: 'Mentor not found' });

        const updated = await prisma.tutorProfile.update({
            where: { id },
            data: { is_verified },
            select: { id: true, username: true, is_verified: true, user: { select: { email: true } } },
        });

        if (is_verified && !existing.is_verified && updated.user?.email) {
            const baseUrl = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').replace(/\/+$/, '');
            try {
                await emailService.sendMentorProfileLive({
                    mentorName: updated.username || 'there',
                    mentorEmail: updated.user.email,
                    profileUrl: `${baseUrl}/mentors/${updated.id}`,
                    dashboardUrl: `${baseUrl}/dashboard`,
                });
            } catch (e) {
                console.error('Failed to send mentor profile-live email:', e);
            }
        }

        return res.json({ mentor: { id: updated.id, username: updated.username, is_verified: updated.is_verified } });
    } catch (error) {
        console.error('adminSetMentorApproved error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListCertificationRequests = async (req: AuthRequest, res: Response) => {
    try {
        const status = (req.query.status as string | undefined) || 'PENDING';

        const certifications = await prisma.tutorCertification.findMany({
            where: {
                verification_status: status as any,
            },
            include: {
                tutor: { select: { id: true, username: true, user: { select: { email: true } } } },
            },
            orderBy: { created_at: 'desc' },
            take: 500,
        });

        return res.json({ certifications });
    } catch (error) {
        console.error('adminListCertificationRequests error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminApproveCertification = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Certification id is required' });

        const updated = await prisma.tutorCertification.update({
            where: { id },
            data: {
                is_verified: true,
                verification_status: 'APPROVED',
                rejection_reason: null,
                reviewed_at: new Date(),
            },
        });

        return res.json({ certification: updated });
    } catch (error) {
        console.error('adminApproveCertification error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminRejectCertification = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body as { reason?: string };
        if (!id) return res.status(400).json({ error: 'Certification id is required' });
        if (!reason || typeof reason !== 'string') return res.status(400).json({ error: 'reason is required' });

        const updated = await prisma.tutorCertification.update({
            where: { id },
            data: {
                is_verified: false,
                verification_status: 'REJECTED',
                rejection_reason: reason,
                reviewed_at: new Date(),
            },
        });

        return res.json({ certification: updated });
    } catch (error) {
        console.error('adminRejectCertification error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListExternalReviewRequests = async (req: AuthRequest, res: Response) => {
    try {
        const status = (req.query.status as string | undefined) || 'PENDING';

        const reviews = await prisma.tutorExternalReview.findMany({
            where: {
                verification_status: status as any,
            },
            include: {
                tutor: { select: { id: true, username: true, user: { select: { email: true } } } },
            },
            orderBy: { created_at: 'desc' },
            take: 500,
        });

        return res.json({ reviews });
    } catch (error) {
        console.error('adminListExternalReviewRequests error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminApproveExternalReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Review id is required' });

        const updated = await prisma.tutorExternalReview.update({
            where: { id },
            data: {
                is_verified: true,
                verification_status: 'APPROVED',
                rejection_reason: null,
                reviewed_at: new Date(),
            },
        });

        return res.json({ review: updated });
    } catch (error) {
        console.error('adminApproveExternalReview error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminRejectExternalReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body as { reason?: string };
        if (!id) return res.status(400).json({ error: 'Review id is required' });
        if (!reason || typeof reason !== 'string') return res.status(400).json({ error: 'reason is required' });

        const updated = await prisma.tutorExternalReview.update({
            where: { id },
            data: {
                is_verified: false,
                verification_status: 'REJECTED',
                rejection_reason: reason,
                reviewed_at: new Date(),
            },
        });

        return res.json({ review: updated });
    } catch (error) {
        console.error('adminRejectExternalReview error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListSubscriptions = async (req: AuthRequest, res: Response) => {
    try {
        const tier = req.query.tier as string | undefined;

        const mentors = await prisma.tutorProfile.findMany({
            where: tier ? { tier: tier as any } : undefined,
            select: {
                id: true,
                username: true,
                profile_photo: true,
                tier: true,
                is_verified: true,
                user: { select: { email: true, created_at: true } },
            },
            orderBy: { user: { created_at: 'desc' } },
            take: 200,
        });

        // Mock subscription status data
        const subscriptions = mentors.map(m => ({
            id: m.id,
            username: m.username,
            email: m.user.email,
            tier: m.tier,
            status: 'ACTIVE', // Mocked as active for now
            joined_at: m.user.created_at,
            next_billing_date: new Date(new Date().setDate(new Date().getDate() + 30)),
            amount: m.tier === 'PREMIUM' ? 135 : m.tier === 'PRO' ? 65 : 35,
        }));

        return res.json({ subscriptions });
    } catch (error) {
        console.error('adminListSubscriptions error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListPayments = async (req: AuthRequest, res: Response) => {
    try {
        // In the future, this will fetch from Stripe or Payment table
        const mockPayments = [
            { id: '1', tutor: 'John Doe', type: 'SUBSCRIPTION', amount: 3500, status: 'SUCCEEDED', date: new Date() },
            { id: '2', tutor: 'Jane Smith', type: 'COURSE_SALE', amount: 4999, status: 'SUCCEEDED', date: new Date(Date.now() - 86400000) },
            { id: '3', tutor: 'Bob Jones', type: 'SUBSCRIPTION', amount: 3500, status: 'FAILED', date: new Date(Date.now() - 172800000) },
        ];

        return res.json({ payments: mockPayments });
    } catch (error) {
        console.error('adminListPayments error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListTickets = async (req: AuthRequest, res: Response) => {
    try {
        const { status, priority, q } = req.query;
        const qStr = (q as string)?.trim();

        const tickets = await prisma.supportTicket.findMany({
            where: {
                status: status ? (status as any) : undefined,
                priority: priority ? (priority as any) : undefined,
                OR: qStr
                    ? [
                        { subject: { contains: qStr, mode: 'insensitive' } },
                        { submitter_name: { contains: qStr, mode: 'insensitive' } },
                        { submitter_email: { contains: qStr, mode: 'insensitive' } },
                        { user: { email: { contains: qStr, mode: 'insensitive' } } },
                        { user: { student_profile: { username: { contains: qStr, mode: 'insensitive' } } } },
                        { user: { tutor_profile: { username: { contains: qStr, mode: 'insensitive' } } } },
                    ]
                    : undefined,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        student_profile: { select: { username: true } },
                        tutor_profile: { select: { username: true } },
                    },
                },
            },
            orderBy: { created_at: 'desc' },
            take: 100,
        });

        const formattedTickets = tickets.map(t => ({
            id: t.id,
            subject: t.subject,
            message: t.message,
            status: t.status,
            priority: t.priority,
            created_at: t.created_at,
            user_name: t.submitter_name ?? (t.user?.role === 'STUDENT' ? t.user.student_profile?.username : t.user?.tutor_profile?.username) ?? '—',
            user_email: t.submitter_email ?? t.user?.email ?? '—',
            user_role: t.user?.role ?? 'GUEST',
        }));

        return res.json({ tickets: formattedTickets });
    } catch (error) {
        console.error('adminListTickets error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminReplyTicket = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { message, status } = req.body;

        if (!id) return res.status(400).json({ error: 'Ticket ID required' });
        if (!message) return res.status(400).json({ error: 'Reply message required' });

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: {
                status: status || 'RESOLVED',
                admin_replies: {
                    create: { message },
                },
            },
            include: {
                user: {
                    select: {
                        email: true,
                        student_profile: { select: { username: true } },
                        tutor_profile: { select: { username: true } },
                        role: true,
                    }
                }
            },
        });

        const replyEmail = ticket.submitter_email ?? ticket.user?.email;
        const replyName = ticket.submitter_name ?? (ticket.user?.role === 'STUDENT' ? ticket.user.student_profile?.username : ticket.user?.tutor_profile?.username);

        if (replyEmail) {
            try {
                await emailService.sendSupportTicketReply({
                    userName: replyName || 'User',
                    userEmail: replyEmail,
                    ticketSubject: ticket.subject,
                    replyMessage: message,
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
            }
        }

        return res.json({ ticket });
    } catch (error) {
        console.error('adminReplyTicket error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminGetAnalytics = async (req: AuthRequest, res: Response) => {
    try {
        // Get current date and date 30 days ago for trend calculations
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // Total counts
        const [totalMentors, totalStudents, totalLessons, totalBookings] = await Promise.all([
            prisma.tutorProfile.count(),
            prisma.studentProfile.count(),
            prisma.lesson.count(),
            prisma.booking.count(),
        ]);

        // Counts from last 30 days for growth calculation
        const [mentorsLast30, studentsLast30, lessonsLast30] = await Promise.all([
            prisma.tutorProfile.count({ where: { user: { created_at: { gte: thirtyDaysAgo } } } }),
            prisma.studentProfile.count({ where: { user: { created_at: { gte: thirtyDaysAgo } } } }),
            prisma.lesson.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
        ]);

        // Counts from 30-60 days ago for trend comparison
        const [mentorsPrevious30, studentsPrevious30] = await Promise.all([
            prisma.tutorProfile.count({
                where: { user: { created_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }
            }),
            prisma.studentProfile.count({
                where: { user: { created_at: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }
            }),
        ]);

        // Calculate growth percentages
        const mentorGrowth = mentorsPrevious30 > 0
            ? ((mentorsLast30 - mentorsPrevious30) / mentorsPrevious30 * 100).toFixed(1)
            : mentorsLast30 > 0 ? '100' : '0';

        const studentGrowth = studentsPrevious30 > 0
            ? ((studentsLast30 - studentsPrevious30) / studentsPrevious30 * 100).toFixed(1)
            : studentsLast30 > 0 ? '100' : '0';

        // Pending approvals
        const [pendingCertifications, pendingReviews, pendingTickets] = await Promise.all([
            prisma.tutorCertification.count({ where: { verification_status: 'PENDING' } }),
            prisma.tutorExternalReview.count({ where: { verification_status: 'PENDING' } }),
            prisma.supportTicket.count({ where: { status: 'OPEN' } }),
        ]);

        const totalPendingApprovals = pendingCertifications + pendingReviews;

        // Revenue calculation (mock for now, will be real when Stripe is integrated)
        // For now, calculate based on mentor tiers
        const mentorsByTier = await prisma.tutorProfile.groupBy({
            by: ['tier'],
            _count: true,
        });

        let monthlyRevenue = 0;
        mentorsByTier.forEach(group => {
            const price = group.tier === 'PREMIUM' ? 135 : group.tier === 'PRO' ? 65 : 35;
            monthlyRevenue += price * group._count;
        });

        // Recent activity - last 10 lessons
        const recentLessons = await prisma.lesson.findMany({
            take: 10,
            orderBy: { created_at: 'desc' },
            include: {
                tutor: { select: { username: true } },
                student: { select: { username: true } },
            },
        });

        // Booking statistics
        const completedLessons = await prisma.lesson.count({ where: { status: 'COMPLETED' } });
        const cancelledLessons = await prisma.lesson.count({ where: { status: 'CANCELLED' } });
        const upcomingLessons = await prisma.lesson.count({
            where: {
                status: 'BOOKED',
                start_time: { gte: now }
            }
        });

        // Mentor tier distribution
        const tierDistribution = mentorsByTier.map(g => ({
            tier: g.tier,
            count: g._count,
        }));

        // Recent certifications
        const recentCertifications = await prisma.tutorCertification.findMany({
            take: 5,
            orderBy: { created_at: 'desc' },
            where: { verification_status: 'PENDING' },
            include: {
                tutor: { select: { username: true, user: { select: { email: true } } } },
            },
        });

        return res.json({
            overview: {
                totalMentors,
                totalStudents,
                totalLessons,
                totalBookings,
                monthlyRevenue,
                pendingApprovals: totalPendingApprovals,
                openTickets: pendingTickets,
            },
            growth: {
                mentors: {
                    current: totalMentors,
                    last30Days: mentorsLast30,
                    growthPercentage: parseFloat(mentorGrowth),
                },
                students: {
                    current: totalStudents,
                    last30Days: studentsLast30,
                    growthPercentage: parseFloat(studentGrowth),
                },
                lessons: {
                    total: totalLessons,
                    last30Days: lessonsLast30,
                },
            },
            lessons: {
                completed: completedLessons,
                cancelled: cancelledLessons,
                upcoming: upcomingLessons,
            },
            tierDistribution,
            recentActivity: recentLessons.map(l => ({
                id: l.id,
                tutor: l.tutor.username,
                student: l.student.username,
                status: l.status,
                startTime: l.start_time,
                createdAt: l.created_at,
            })),
            recentCertifications: recentCertifications.map(c => ({
                id: c.id,
                tutorName: c.tutor.username,
                tutorEmail: c.tutor.user.email,
                certificationName: c.name,
                issuer: c.issuer,
                createdAt: c.created_at,
            })),
        });
    } catch (error) {
        console.error('adminGetAnalytics error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminListDemoBookings = async (req: AuthRequest, res: Response) => {
    try {
        const fromStr = (req.query.from as string)?.trim();
        const toStr = (req.query.to as string)?.trim();

        const slotFilter: { gte?: Date; lte?: Date } = {};
        if (fromStr) {
            const from = new Date(fromStr);
            if (!Number.isNaN(from.getTime())) slotFilter.gte = from;
        }
        if (toStr) {
            const to = new Date(toStr);
            if (!Number.isNaN(to.getTime())) slotFilter.lte = to;
        }
        const where = Object.keys(slotFilter).length ? { slot_start_time: slotFilter } : undefined;

        const bookings = await prisma.demoBooking.findMany({
            where,
            orderBy: { slot_start_time: 'asc' },
        });

        return res.json({ bookings });
    } catch (error) {
        console.error('adminListDemoBookings error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

function formatDemoSlotDallas(d: Date): { date: string; time: string } {
    return {
        date: d.toLocaleDateString('en-US', { timeZone: ADMIN_TIMEZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { timeZone: ADMIN_TIMEZONE, hour: 'numeric', minute: '2-digit', hour12: true }),
    };
}

/**
 * GET /api/admin/demo-slots?from&to&exclude_booking_id
 * Open demo slots for the reschedule picker. `exclude_booking_id` keeps the slot the
 * booking currently occupies in the list instead of hiding it as "taken".
 */
export const adminListDemoSlots = async (req: AuthRequest, res: Response) => {
    try {
        const fromStr = (req.query.from as string)?.trim();
        const toStr = (req.query.to as string)?.trim();
        if (!fromStr || !toStr) {
            return res.status(400).json({ error: 'from and to (ISO date) are required' });
        }
        const from = new Date(fromStr);
        const to = new Date(toStr);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return res.status(400).json({ error: 'Invalid from or to date' });
        }

        const excludeBookingId = (req.query.exclude_booking_id as string)?.trim() || undefined;
        const slots = await getAvailableDemoSlots(from, to, excludeBookingId);
        return res.json({ slots });
    } catch (error) {
        console.error('adminListDemoSlots error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

/**
 * PATCH /api/admin/demo-bookings/:id/reschedule
 * Moves a demo call to a new slot: validates the slot, moves the Google Calendar event
 * (keeping the existing Meet link) and emails the mentor the new time.
 */
export const adminRescheduleDemoBooking = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const slotStartStr = (req.body?.slot_start_time as string | undefined)?.trim();
        const allowOutsideHours = req.body?.allow_outside_hours === true;
        const note = (req.body?.note as string | undefined)?.trim() || '';

        if (!id) return res.status(400).json({ error: 'Booking id is required' });
        if (!slotStartStr) return res.status(400).json({ error: 'Pick a new time for the demo call' });

        const start = new Date(slotStartStr);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid slot time' });
        const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

        const booking = await prisma.demoBooking.findUnique({ where: { id } });
        if (!booking) return res.status(404).json({ error: 'Demo booking not found' });

        if (booking.slot_start_time.getTime() === start.getTime()) {
            return res.status(400).json({ error: 'That is the time the demo is already booked for.' });
        }

        const check = await checkDemoSlotAvailable({
            start,
            end,
            excludeBookingId: id,
            allowOutsideHours,
        });
        if (!check.ok) return res.status(409).json({ error: check.error });

        const previousStart = booking.slot_start_time;

        // Move the calendar event so the Meet link stays valid. Bookings made before
        // event ids were stored (or whose event was deleted) get a fresh event.
        let meetingLink = booking.meeting_link;
        let googleEventId = booking.google_event_id;
        try {
            const moved = booking.google_event_id
                ? await updateDemoMeetEvent({
                    eventId: booking.google_event_id,
                    prospectName: booking.full_name,
                    start,
                    end,
                })
                : null;

            if (moved) {
                meetingLink = moved.meetLink || booking.meeting_link;
                googleEventId = moved.eventId || booking.google_event_id;
            } else {
                const created = await createDemoMeetEvent({
                    prospectEmail: booking.email,
                    prospectName: booking.full_name,
                    start,
                    end,
                });
                meetingLink = created.meetLink;
                googleEventId = created.eventId;
            }
        } catch (e) {
            console.error('Demo Meet reschedule failed:', e);
            return res.status(503).json({
                error: 'Could not move the Google Calendar event. Check the demo calendar connection and try again.',
            });
        }

        const updated = await prisma.demoBooking.update({
            where: { id },
            data: {
                slot_start_time: start,
                slot_end_time: end,
                meeting_link: meetingLink,
                google_event_id: googleEventId,
                rescheduled_at: new Date(),
            },
        });

        const previous = formatDemoSlotDallas(previousStart);
        const next = formatDemoSlotDallas(start);
        const formatForGoogleCalendar = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        await prisma.emailOutbox.create({
            data: {
                type: 'DEMO_BOOKING_RESCHEDULED',
                to_email: updated.email,
                payload: {
                    fullName: updated.full_name,
                    previousDate: previous.date,
                    previousTime: previous.time,
                    callDate: next.date,
                    callTime: next.time,
                    meetingLink: updated.meeting_link || '',
                    note,
                    addToCalendarUrl: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=EmpowerEd+Demo&dates=${formatForGoogleCalendar(updated.slot_start_time)}/${formatForGoogleCalendar(updated.slot_end_time)}`,
                },
                status: 'PENDING',
            },
        });

        return res.json({ booking: updated });
    } catch (error) {
        console.error('adminRescheduleDemoBooking error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

// --- Demo availability (admin configurable hours per day, e.g. Mon 9–11 & 3–5) ---
const TIME_RE = /^\d{1,2}:\d{2}$/;

export const adminGetDemoAvailability = async (_req: AuthRequest, res: Response) => {
    try {
        const rules = await prisma.adminDemoAvailability.findMany({
            orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        });
        return res.json({ rules });
    } catch (error) {
        console.error('adminGetDemoAvailability error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminPutDemoAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const rules = req.body?.rules as Array<{ day_of_week: number; start_time: string; end_time: string }> | undefined;
        if (!Array.isArray(rules)) {
            return res.status(400).json({ error: 'rules must be an array' });
        }
        for (const r of rules) {
            if (typeof r.day_of_week !== 'number' || r.day_of_week < 0 || r.day_of_week > 6) {
                return res.status(400).json({ error: 'day_of_week must be 0–6 (Sun–Sat)' });
            }
            if (!TIME_RE.test(r.start_time) || !TIME_RE.test(r.end_time)) {
                return res.status(400).json({ error: 'start_time and end_time must be HH:MM' });
            }
            const [sh, sm] = r.start_time.split(':').map(Number);
            const [eh, em] = r.end_time.split(':').map(Number);
            if (sh * 60 + sm >= eh * 60 + em) {
                return res.status(400).json({ error: 'start_time must be before end_time' });
            }
        }

        await prisma.adminDemoAvailability.deleteMany({});
        if (rules.length > 0) {
            await prisma.adminDemoAvailability.createMany({
                data: rules.map((r) => ({
                    day_of_week: r.day_of_week,
                    start_time: r.start_time,
                    end_time: r.end_time,
                })),
            });
        }

        const updated = await prisma.adminDemoAvailability.findMany({
            orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        });
        return res.json({ rules: updated });
    } catch (error) {
        console.error('adminPutDemoAvailability error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

// --- Demo time blocks (block specific times when admin is not available) ---
export const adminListDemoBlocks = async (req: AuthRequest, res: Response) => {
    try {
        const fromStr = (req.query.from as string)?.trim();
        const toStr = (req.query.to as string)?.trim();
        const where: { start_time?: { gte?: Date }; end_time?: { lte?: Date } } = {};
        if (fromStr) {
            const from = new Date(fromStr);
            if (!Number.isNaN(from.getTime())) where.start_time = { gte: from };
        }
        if (toStr) {
            const to = new Date(toStr);
            if (!Number.isNaN(to.getTime())) where.end_time = { lte: to };
        }

        const blocks = await prisma.adminDemoTimeBlock.findMany({
            where: Object.keys(where).length ? where : undefined,
            orderBy: { start_time: 'asc' },
        });
        return res.json({ blocks });
    } catch (error) {
        console.error('adminListDemoBlocks error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminCreateDemoBlock = async (req: AuthRequest, res: Response) => {
    try {
        const { start_time, end_time, reason } = req.body as { start_time?: string; end_time?: string; reason?: string };
        if (!start_time || !end_time) {
            return res.status(400).json({ error: 'start_time and end_time (ISO strings) are required' });
        }
        const start = new Date(start_time);
        const end = new Date(end_time);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid start_time or end_time' });
        }
        if (start >= end) {
            return res.status(400).json({ error: 'start_time must be before end_time' });
        }

        const block = await prisma.adminDemoTimeBlock.create({
            data: { start_time: start, end_time: end, reason: reason?.trim() || null },
        });
        return res.status(201).json({ block });
    } catch (error) {
        console.error('adminCreateDemoBlock error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminUpdateDemoBlock = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { start_time, end_time, reason } = req.body as { start_time?: string; end_time?: string; reason?: string };
        if (!id) return res.status(400).json({ error: 'Block id is required' });

        const update: { start_time?: Date; end_time?: Date; reason?: string | null } = {};
        if (start_time !== undefined) {
            const start = new Date(start_time);
            if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid start_time' });
            update.start_time = start;
        }
        if (end_time !== undefined) {
            const end = new Date(end_time);
            if (Number.isNaN(end.getTime())) return res.status(400).json({ error: 'Invalid end_time' });
            update.end_time = end;
        }
        if (reason !== undefined) update.reason = reason?.trim() || null;

        const block = await prisma.adminDemoTimeBlock.update({
            where: { id },
            data: update,
        });
        return res.json({ block });
    } catch (error: any) {
        if (error?.code === 'P2025') return res.status(404).json({ error: 'Block not found' });
        console.error('adminUpdateDemoBlock error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminDeleteDemoBlock = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Block id is required' });
        await prisma.adminDemoTimeBlock.delete({ where: { id } });
        return res.status(204).send();
    } catch (error: any) {
        if (error?.code === 'P2025') return res.status(404).json({ error: 'Block not found' });
        console.error('adminDeleteDemoBlock error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

// ── Beta Applications ────────────────────────────────────────────────────────

export const adminListBetaApplications = async (req: AuthRequest, res: Response) => {
    try {
        const status = req.query.status as string | undefined;
        const where = status ? { status: status as any } : {};
        const applications = await prisma.betaApplication.findMany({
            where,
            orderBy: { created_at: 'desc' },
        });
        return res.json({ applications });
    } catch (error) {
        console.error('adminListBetaApplications error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminApproveBetaApplication = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const application = await prisma.betaApplication.findUnique({ where: { id } });
        if (!application) return res.status(404).json({ error: 'Application not found' });
        if (application.status !== 'PENDING') {
            return res.status(400).json({ error: `Application is already ${application.status.toLowerCase()}` });
        }

        const updated = await prisma.betaApplication.update({
            where: { id },
            data: { status: 'APPROVED', actioned_at: new Date() },
        });

        try {
            await emailService.sendBetaApplicationAccepted({
                full_name: application.full_name,
                email: application.email,
            });
        } catch (e) {
            console.error('Failed to send beta acceptance email:', e);
        }

        return res.json({ application: updated });
    } catch (error) {
        console.error('adminApproveBetaApplication error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminRejectBetaApplication = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const application = await prisma.betaApplication.findUnique({ where: { id } });
        if (!application) return res.status(404).json({ error: 'Application not found' });
        if (application.status !== 'PENDING') {
            return res.status(400).json({ error: `Application is already ${application.status.toLowerCase()}` });
        }

        const updated = await prisma.betaApplication.update({
            where: { id },
            data: { status: 'REJECTED', actioned_at: new Date() },
        });

        return res.json({ application: updated });
    } catch (error) {
        console.error('adminRejectBetaApplication error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

// ── Sub-admin management (super admin only) ───────────────────────────────────

const sanitizePermissions = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    return Array.from(new Set(input.filter(isValidPermissionKey)));
};

export const adminListSubAdmins = async (_req: AuthRequest, res: Response) => {
    try {
        const subAdmins = await prisma.adminProfile.findMany({
            where: { is_super_admin: false },
            select: {
                id: true,
                username: true,
                permissions: true,
                user: { select: { id: true, email: true, is_suspended: true, created_at: true } },
            },
            orderBy: { user: { created_at: 'desc' } },
        });

        return res.json({
            subAdmins: subAdmins.map((a) => ({
                id: a.id,
                userId: a.user.id,
                email: a.user.email,
                username: a.username,
                permissions: a.permissions,
                isSuspended: a.user.is_suspended,
                createdAt: a.user.created_at,
            })),
            availablePermissions: ADMIN_PERMISSION_KEYS,
        });
    } catch (error) {
        console.error('adminListSubAdmins error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminCreateSubAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { email, password, username, permissions } = req.body as {
            email?: string;
            password?: string;
            username?: string;
            permissions?: unknown;
        };

        const trimmedEmail = email?.trim().toLowerCase();
        const trimmedUsername = username?.trim();

        if (!trimmedEmail || !password || !trimmedUsername) {
            return res.status(400).json({ error: 'email, password, and username are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
        if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

        const password_hash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                email: trimmedEmail,
                password_hash,
                role: 'ADMIN',
                is_verified: true,
                admin_profile: {
                    create: {
                        username: trimmedUsername,
                        is_super_admin: false,
                        permissions: sanitizePermissions(permissions),
                    },
                },
            },
            select: {
                id: true,
                email: true,
                admin_profile: { select: { id: true, username: true, permissions: true } },
            },
        });

        // Email the new sub-admin their credentials. Best-effort: the account is
        // already created, so don't fail the request if the email can't be sent.
        let emailSent = true;
        try {
            await emailService.sendSubAdminWelcome({
                email: user.email,
                username: user.admin_profile!.username,
                password,
                permissionsList: formatPermissionList(user.admin_profile!.permissions),
            });
        } catch (e) {
            emailSent = false;
            console.error('adminCreateSubAdmin: failed to send welcome email:', e);
        }

        return res.status(201).json({
            subAdmin: {
                id: user.admin_profile!.id,
                userId: user.id,
                email: user.email,
                username: user.admin_profile!.username,
                permissions: user.admin_profile!.permissions,
                isSuspended: false,
            },
            emailSent,
        });
    } catch (error) {
        console.error('adminCreateSubAdmin error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminUpdateSubAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { username, permissions, isSuspended } = req.body as {
            username?: string;
            permissions?: unknown;
            isSuspended?: boolean;
        };

        const profile = await prisma.adminProfile.findUnique({
            where: { id },
            select: { id: true, is_super_admin: true, user_id: true },
        });
        if (!profile) return res.status(404).json({ error: 'Sub-admin not found' });
        if (profile.is_super_admin) return res.status(403).json({ error: 'Cannot modify a super admin' });

        const data: { username?: string; permissions?: string[] } = {};
        if (typeof username === 'string' && username.trim()) data.username = username.trim();
        if (permissions !== undefined) data.permissions = sanitizePermissions(permissions);

        if (Object.keys(data).length > 0) {
            await prisma.adminProfile.update({ where: { id }, data });
        }
        if (typeof isSuspended === 'boolean') {
            await prisma.user.update({ where: { id: profile.user_id }, data: { is_suspended: isSuspended } });
        }

        const updated = await prisma.adminProfile.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                permissions: true,
                user: { select: { id: true, email: true, is_suspended: true } },
            },
        });

        return res.json({
            subAdmin: {
                id: updated!.id,
                userId: updated!.user.id,
                email: updated!.user.email,
                username: updated!.username,
                permissions: updated!.permissions,
                isSuspended: updated!.user.is_suspended,
            },
        });
    } catch (error) {
        console.error('adminUpdateSubAdmin error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

export const adminDeleteSubAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const profile = await prisma.adminProfile.findUnique({
            where: { id },
            select: { id: true, is_super_admin: true, user_id: true },
        });
        if (!profile) return res.status(404).json({ error: 'Sub-admin not found' });
        if (profile.is_super_admin) return res.status(403).json({ error: 'Cannot delete a super admin' });
        if (profile.user_id === req.user?.id) return res.status(403).json({ error: 'You cannot delete yourself' });

        // Remove the admin profile then the user account.
        await prisma.adminProfile.delete({ where: { id } });
        await prisma.user.delete({ where: { id: profile.user_id } });

        return res.json({ message: 'Sub-admin removed' });
    } catch (error) {
        console.error('adminDeleteSubAdmin error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};
