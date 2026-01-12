import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

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
                        tagline: true,
                        hourly_rate: true,
                        rating: true,
                        review_count: true,
                        is_verified: true,
                        tier: true,
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
                    tagline: string | null;
                    hourly_rate: any;
                    rating: number | null;
                    review_count: number | null;
                    is_verified: boolean;
                    tier: string | null;
                };
                totalLessons: number;
                nextSessionStart: Date | null;
                lastSessionStart: Date | null;
            }
        >();

        for (const l of lessons) {
            const tid = l.tutor_id;
            const start = l.start_time;
            const existing = byTutor.get(tid);

            if (!existing) {
                byTutor.set(tid, {
                    tutor: l.tutor,
                    totalLessons: 1,
                    nextSessionStart: start > now ? start : null,
                    lastSessionStart: start <= now ? start : null,
                });
                continue;
            }

            existing.totalLessons += 1;

            if (start > now) {
                if (!existing.nextSessionStart || start < existing.nextSessionStart) {
                    existing.nextSessionStart = start;
                }
            } else {
                if (!existing.lastSessionStart || start > existing.lastSessionStart) {
                    existing.lastSessionStart = start;
                }
            }
        }

        const mentors = Array.from(byTutor.values())
            .map((m) => ({
                ...m,
                nextSessionStart: m.nextSessionStart ? m.nextSessionStart.toISOString() : null,
                lastSessionStart: m.lastSessionStart ? m.lastSessionStart.toISOString() : null,
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
