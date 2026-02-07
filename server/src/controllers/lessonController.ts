import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

export const getMyLessons = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR' && role !== 'STUDENT') return res.status(403).json({ error: 'Only tutors or students can view lessons here' });

        const fromStr = (req.query.from as string | undefined)?.trim();
        const toStr = (req.query.to as string | undefined)?.trim();

        if (!fromStr) return res.status(400).json({ error: 'from is required (ISO string)' });
        if (!toStr) return res.status(400).json({ error: 'to is required (ISO string)' });

        const from = new Date(fromStr);
        const to = new Date(toStr);

        if (Number.isNaN(from.getTime())) return res.status(400).json({ error: 'from is invalid' });
        if (Number.isNaN(to.getTime())) return res.status(400).json({ error: 'to is invalid' });
        if (from >= to) return res.status(400).json({ error: 'from must be before to' });

        let tutorId: string | null = null;
        let studentId: string | null = null;

        if (role === 'TUTOR') {
            const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
            if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });
            tutorId = tutor.id;
        }

        if (role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
            if (!student) return res.status(404).json({ error: 'Student profile not found' });
            studentId = student.id;
        }

        const lessons = await prisma.lesson.findMany({
            where: {
                ...(tutorId ? { tutor_id: tutorId } : {}),
                ...(studentId ? { student_id: studentId } : {}),
                start_time: { lt: to },
                end_time: { gt: from },
            },
            orderBy: { start_time: 'asc' },
            select: {
                id: true,
                tutor_id: true,
                student_id: true,
                start_time: true,
                end_time: true,
                status: true,
                billing_type: true,
                meeting_link: true,
                google_calendar_html_link: true,
                booking: {
                    select: {
                        frequency: true,
                    },
                },
                student: { select: { username: true } },
                tutor: { select: { username: true } },
            }
        });

        return res.json({ lessons });
    } catch (e) {
        console.error('getMyLessons error:', e);
        return res.status(500).json({ error: 'Failed to fetch lessons' });
    }
};

export const joinLesson = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const lessonId = (req.params.lessonId || '').trim();
        if (!lessonId) return res.status(400).json({ error: 'lessonId is required' });

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true,
                tutor_id: true,
                student_id: true,
                booking_id: true,
                start_time: true,
                meeting_link: true,
                google_calendar_html_link: true,
            },
        });

        if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

        if (!lesson.booking_id) {
            return res.status(400).json({ error: 'Lesson is not associated with a booking' });
        }

        // Authorize and resolve profile id
        let studentId: string | null = null;
        let tutorId: string | null = null;

        if (role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
            if (!student) return res.status(404).json({ error: 'Student profile not found' });
            studentId = student.id;
            if (lesson.student_id !== studentId) return res.status(403).json({ error: 'Forbidden' });
        } else if (role === 'TUTOR') {
            const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
            if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });
            tutorId = tutor.id;
            if (lesson.tutor_id !== tutorId) return res.status(403).json({ error: 'Forbidden' });
        } else {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // For students: enforce that the corresponding schedule row is paid
        if (role === 'STUDENT') {
            const dueDate = new Date(lesson.start_time.getTime() - 48 * 60 * 60 * 1000);
            const dueStart = new Date(dueDate.getTime() - 60 * 1000);
            const dueEnd = new Date(dueDate.getTime() + 60 * 1000);
            const schedule = await prisma.paymentSchedule.findFirst({
                where: {
                    booking_id: lesson.booking_id,
                    due_date: {
                        gte: dueStart,
                        lte: dueEnd,
                    },
                },
            });

            if (!schedule || schedule.status !== 'paid') {
                return res.status(402).json({
                    error: 'Payment required to join this session.',
                    bookingId: lesson.booking_id,
                    paymentStatus: schedule?.status || 'missing',
                });
            }
        }

        return res.json({
            meeting_link: lesson.meeting_link,
            google_calendar_html_link: lesson.google_calendar_html_link,
        });
    } catch (e) {
        console.error('joinLesson error:', e);
        return res.status(500).json({ error: 'Failed to join lesson' });
    }
};
