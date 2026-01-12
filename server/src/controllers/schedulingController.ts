import { Request, Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const parseISO = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
    return d;
};

const getTutorIdForUser = async (userId: string) => {
    const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
    return tutor?.id || null;
};

export const getMyScheduling = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can access scheduling' });

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        const profile = await prisma.tutorProfile.findUnique({
            where: { id: tutorId },
            select: {
                id: true,
                timezone: true,
                availabilities: { orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }] },
                time_blocks: { orderBy: { start_time: 'asc' } },
            }
        });

        return res.json(profile);
    } catch (e) {
        console.error('getMyScheduling error:', e);
        return res.status(500).json({ error: 'Failed to fetch scheduling' });
    }
};

export const setMyTimezone = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can update timezone' });

        const timezone = (req.body?.timezone as string | undefined)?.trim();
        if (!timezone) return res.status(400).json({ error: 'timezone is required' });

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        const updated = await prisma.tutorProfile.update({
            where: { id: tutorId },
            data: { timezone },
            select: { id: true, timezone: true }
        });

        return res.json(updated);
    } catch (e) {
        console.error('setMyTimezone error:', e);
        return res.status(500).json({ error: 'Failed to update timezone' });
    }
};

export const replaceMyWeeklyAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can update availability' });

        const rules = req.body?.rules as Array<{ day_of_week: number; start_time: string; end_time: string }> | undefined;
        if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules must be an array' });

        for (const r of rules) {
            if (typeof r.day_of_week !== 'number' || r.day_of_week < 0 || r.day_of_week > 6) {
                return res.status(400).json({ error: 'day_of_week must be between 0 and 6' });
            }
            if (!TIME_RE.test(r.start_time) || !TIME_RE.test(r.end_time)) {
                return res.status(400).json({ error: 'start_time and end_time must be HH:MM' });
            }
            if (r.start_time >= r.end_time) {
                return res.status(400).json({ error: 'start_time must be before end_time' });
            }
        }

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        await prisma.$transaction(async (tx) => {
            await tx.availability.deleteMany({ where: { tutor_id: tutorId } });
            if (rules.length > 0) {
                await tx.availability.createMany({
                    data: rules.map(r => ({
                        tutor_id: tutorId,
                        day_of_week: r.day_of_week,
                        start_time: r.start_time,
                        end_time: r.end_time,
                    }))
                });
            }
        });

        const updated = await prisma.availability.findMany({
            where: { tutor_id: tutorId },
            orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }]
        });

        return res.json({ availabilities: updated });
    } catch (e) {
        console.error('replaceMyWeeklyAvailability error:', e);
        return res.status(500).json({ error: 'Failed to update availability' });
    }
};

export const createMyTimeBlock = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can create time blocks' });

        const startStr = (req.body?.start_time as string | undefined)?.trim();
        const endStr = (req.body?.end_time as string | undefined)?.trim();
        const reason = (req.body?.reason as string | undefined)?.trim();

        if (!startStr) return res.status(400).json({ error: 'start_time is required' });
        if (!endStr) return res.status(400).json({ error: 'end_time is required' });

        const start = parseISO(startStr);
        const end = parseISO(endStr);
        if (start >= end) return res.status(400).json({ error: 'start_time must be before end_time' });

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        const block = await prisma.tutorTimeBlock.create({
            data: {
                tutor_id: tutorId,
                start_time: start,
                end_time: end,
                reason: reason || null,
            }
        });

        return res.status(201).json({ block });
    } catch (e) {
        console.error('createMyTimeBlock error:', e);
        return res.status(500).json({ error: 'Failed to create time block' });
    }
};

export const deleteMyTimeBlock = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can delete time blocks' });

        const id = (req.params.id as string | undefined)?.trim();
        if (!id) return res.status(400).json({ error: 'id is required' });

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        const existing = await prisma.tutorTimeBlock.findUnique({ where: { id } });
        if (!existing || existing.tutor_id !== tutorId) {
            return res.status(404).json({ error: 'Time block not found' });
        }

        await prisma.tutorTimeBlock.delete({ where: { id } });
        return res.json({ success: true });
    } catch (e) {
        console.error('deleteMyTimeBlock error:', e);
        return res.status(500).json({ error: 'Failed to delete time block' });
    }
};

export const updateMyTimeBlock = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can update time blocks' });

        const id = (req.params.id as string | undefined)?.trim();
        if (!id) return res.status(400).json({ error: 'id is required' });

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        const existing = await prisma.tutorTimeBlock.findUnique({ where: { id } });
        if (!existing || existing.tutor_id !== tutorId) {
            return res.status(404).json({ error: 'Time block not found' });
        }

        const startStr = (req.body?.start_time as string | undefined)?.trim();
        const endStr = (req.body?.end_time as string | undefined)?.trim();
        const reason = (req.body?.reason as string | undefined)?.trim();

        const start = startStr ? parseISO(startStr) : existing.start_time;
        const end = endStr ? parseISO(endStr) : existing.end_time;
        if (start >= end) return res.status(400).json({ error: 'start_time must be before end_time' });

        const updated = await prisma.tutorTimeBlock.update({
            where: { id },
            data: {
                start_time: start,
                end_time: end,
                reason: reason === undefined ? existing.reason : (reason || null),
            }
        });

        return res.json({ block: updated });
    } catch (e) {
        console.error('updateMyTimeBlock error:', e);
        return res.status(500).json({ error: 'Failed to update time block' });
    }
};

export const listMyTimeBlocks = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'TUTOR') return res.status(403).json({ error: 'Only tutors can view time blocks' });

        const tutorId = await getTutorIdForUser(userId);
        if (!tutorId) return res.status(404).json({ error: 'Tutor profile not found' });

        const fromStr = (req.query.from as string | undefined)?.trim();
        const toStr = (req.query.to as string | undefined)?.trim();

        const where: any = { tutor_id: tutorId };

        if (fromStr) {
            const from = parseISO(fromStr);
            where.end_time = { ...(where.end_time || {}), gt: from };
        }
        if (toStr) {
            const to = parseISO(toStr);
            where.start_time = { ...(where.start_time || {}), lt: to };
        }

        const blocks = await prisma.tutorTimeBlock.findMany({
            where,
            orderBy: { start_time: 'asc' },
        });

        return res.json({ blocks });
    } catch (e) {
        console.error('listMyTimeBlocks error:', e);
        return res.status(500).json({ error: 'Failed to fetch time blocks' });
    }
};
