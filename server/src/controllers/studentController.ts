import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { LessonSummary, emptyLessonSummary, addLessonToSummary, serializeLessonSummary } from '../utils/lessonSummary';

export const getMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (req.user?.role !== 'STUDENT') return res.status(403).json({ error: 'Only students can access this resource' });

        const student = await prisma.studentProfile.findUnique({
            where: { user_id: userId },
            select: {
                id: true,
                username: true,
                profile_photo: true,
                learning_goals: true,
                grade_level: true,
                date_of_birth: true,
                preferences: true,
            },
        });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        return res.json(student);
    } catch (e) {
        console.error('getMyProfile error:', e);
        return res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

export const getMyMentors = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can view mentors here' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const lessons = await prisma.lesson.findMany({
            where: { student_id: student.id },
            select: {
                tutor_id: true,
                start_time: true,
                status: true,
                tutor: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true,
                        tagline: true,
                        hourly_rate: true,
                        rating: true,
                        review_count: true,
                        is_verified: true,
                        tier: true,
                        user: {
                            select: {
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { start_time: 'desc' },
            take: 500,
        });

        const now = new Date();

        const byTutor = new Map<
            string,
            {
                tutor: {
                    id: string;
                    username: string;
                    profile_photo: string | null;
                    tagline: string | null;
                    hourly_rate: any;
                    rating: number | null;
                    review_count: number | null;
                    is_verified: boolean;
                    tier: string | null;
                    email: string | null;
                };
                summary: LessonSummary;
            }
        >();

        for (const l of lessons) {
            let entry = byTutor.get(l.tutor_id);
            if (!entry) {
                entry = {
                    tutor: {
                        ...l.tutor,
                        email: l.tutor.user.email
                    },
                    summary: emptyLessonSummary(),
                };
                byTutor.set(l.tutor_id, entry);
            }
            addLessonToSummary(entry.summary, l, now);
        }

        const mentors = Array.from(byTutor.values())
            .map((m) => ({
                tutor: m.tutor,
                ...serializeLessonSummary(m.summary),
            }))
            .sort((a, b) => {
                const aNext = a.nextSessionStart ? new Date(a.nextSessionStart).getTime() : Infinity;
                const bNext = b.nextSessionStart ? new Date(b.nextSessionStart).getTime() : Infinity;

                if (aNext !== bNext) return aNext - bNext;

                const aLast = a.lastSessionStart ? new Date(a.lastSessionStart).getTime() : -Infinity;
                const bLast = b.lastSessionStart ? new Date(b.lastSessionStart).getTime() : -Infinity;

                return bLast - aLast;
            });

        return res.json({ mentors });
    } catch (e) {
        console.error('getMyMentors error:', e);
        return res.status(500).json({ error: 'Failed to fetch mentors' });
    }
};
