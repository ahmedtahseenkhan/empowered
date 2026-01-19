import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import emailService from '../services/emailService';

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
                user: { select: { id: true, email: true, is_suspended: true } },
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

        const tickets = await prisma.supportTicket.findMany({
            where: {
                status: status ? (status as any) : undefined,
                priority: priority ? (priority as any) : undefined,
                OR: q
                    ? [
                        { subject: { contains: q as string, mode: 'insensitive' } },
                        { user: { email: { contains: q as string, mode: 'insensitive' } } },
                        { user: { student_profile: { username: { contains: q as string, mode: 'insensitive' } } } },
                        { user: { tutor_profile: { username: { contains: q as string, mode: 'insensitive' } } } },
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
            user_name: t.user.role === 'STUDENT' ? t.user.student_profile?.username : t.user.tutor_profile?.username,
            user_email: t.user.email,
            user_role: t.user.role,
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

        // Send email notification to user
        try {
            const userName = ticket.user.role === 'STUDENT'
                ? ticket.user.student_profile?.username
                : ticket.user.tutor_profile?.username;

            await emailService.sendSupportTicketReply({
                userName: userName || 'User',
                userEmail: ticket.user.email,
                ticketSubject: ticket.subject,
                replyMessage: message,
            });
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
            // Don't fail the request if email fails
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
