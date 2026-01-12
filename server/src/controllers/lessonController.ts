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
                meeting_link: true,
                google_calendar_html_link: true,
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
