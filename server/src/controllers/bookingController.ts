import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { ensureMeetLinkForLesson } from '../services/googleCalendar';
import { z } from 'zod';
import { isFreeSessionSlotAvailable, isTutorSlotFreeTx, lockTutorSchedule } from '../services/availability';
import { firstIssue } from '../utils/validation';

const FREE_SESSION_DURATION_MINUTES = 25;

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const FreeSessionSchema = z.object({
    tutorId: z.string().min(1).max(64),
    slotStart: z.string().max(64),
    clientTimezone: z.string().max(64).optional(),
});

class SlotTakenError extends Error {}

export const getFreeSessionEligibility = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can view free session eligibility' });

        const tutorId = (req.query?.tutorId as string | undefined)?.trim();
        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const existing = await prisma.lesson.findFirst({
            where: {
                tutor_id: tutorId,
                student_id: student.id,
                billing_type: 'FREE_INTRO',
            },
            select: { id: true, status: true, start_time: true },
        });

        return res.json({
            eligible: !existing,
            existing_free_session: existing
                ? { id: existing.id, status: existing.status, start_time: existing.start_time.toISOString() }
                : null,
        });
    } catch (e) {
        console.error('getFreeSessionEligibility error:', e);
        return res.status(500).json({ error: 'Failed to check free session eligibility' });
    }
};

/** Create a free 25-min introductory session. No payment; booking is auto-confirmed. */
export const createFreeSessionBooking = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can book free sessions' });

        const parsed = FreeSessionSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
        const { tutorId, slotStart, clientTimezone } = parsed.data;

        const start = new Date(slotStart);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid slotStart' });
        if (start.getTime() < Date.now()) return res.status(400).json({ error: 'Selected time is in the past' });

        const tutor = await prisma.tutorProfile.findUnique({
            where: { id: tutorId },
            include: { user: { select: { is_suspended: true } } },
        });
        if (!tutor || !tutor.is_verified || tutor.user.is_suspended) return res.status(404).json({ error: 'Tutor not found' });
        if (!tutor.free_session_enabled) return res.status(400).json({ error: 'This tutor does not offer free sessions' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const existingFreeSession = await prisma.lesson.findFirst({
            where: {
                tutor_id: tutorId,
                student_id: student.id,
                billing_type: 'FREE_INTRO',
            },
            select: { id: true },
        });

        if (existingFreeSession) {
            return res.status(409).json({ error: 'You have already booked a free session with this mentor.' });
        }

        const available = await isFreeSessionSlotAvailable({ tutorId, start });
        if (!available) return res.status(409).json({ error: 'Selected time is no longer available' });

        const end = addMinutes(start, FREE_SESSION_DURATION_MINUTES);

        const result = await prisma.$transaction(async (tx) => {
            await lockTutorSchedule(tx, tutorId);
            if (!(await isTutorSlotFreeTx(tx, { tutorId, start, end }))) throw new SlotTakenError();
            const alreadyBooked = await tx.lesson.findFirst({
                where: { tutor_id: tutorId, student_id: student.id, billing_type: 'FREE_INTRO' },
                select: { id: true },
            });
            if (alreadyBooked) throw new SlotTakenError('duplicate');

            const createdBooking = await tx.booking.create({
                data: {
                    student_id: student.id,
                    tutor_id: tutorId,
                    start_date: start,
                    end_date: end,
                    frequency: 'ONCE',
                    client_timezone: clientTimezone || 'UTC',
                    status: 'active',
                },
                include: {
                    tutor: { select: { id: true, username: true } },
                },
            });

            const lesson = await tx.lesson.create({
                data: {
                    tutor_id: tutorId,
                    student_id: student.id,
                    booking_id: createdBooking.id,
                    start_time: start,
                    end_time: end,
                    duration: FREE_SESSION_DURATION_MINUTES,
                    status: 'BOOKED',
                    billing_type: 'FREE_INTRO',
                },
            });

            return { createdBooking, lesson };
        });

        try {
            await ensureMeetLinkForLesson(result.lesson.id);
        } catch (e) {
            console.error('Meeting link for free session failed (non-fatal):', e);
        }

        // Queue confirmation emails after Meet link is set so both sides get the link
        const studentUser = await prisma.user.findUnique({ where: { id: userId } });
        const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });
        if (studentUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'BOOKING_CONFIRMATION_STUDENT',
                    to_email: studentUser.email,
                    payload: {
                        bookingId: result.createdBooking.id,
                        tutorName: tutor.username,
                        clientTimezone: clientTimezone || undefined,
                        start: result.lesson.start_time.toISOString(),
                        end: result.lesson.end_time.toISOString(),
                        freeSession: true,
                    },
                    idempotency_key: `free-booking:${result.createdBooking.id}:student`,
                },
            });
        }
        if (tutorUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'BOOKING_CONFIRMATION_TUTOR',
                    to_email: tutorUser.email,
                    payload: {
                        bookingId: result.createdBooking.id,
                        studentId: student.id,
                        start: result.lesson.start_time.toISOString(),
                        end: result.lesson.end_time.toISOString(),
                        freeSession: true,
                    },
                    idempotency_key: `free-booking:${result.createdBooking.id}:tutor`,
                },
            });
        }

        return res.status(201).json({ booking: result.createdBooking, lesson: result.lesson });
    } catch (error) {
        if (error instanceof SlotTakenError) {
            return error.message === 'duplicate'
                ? res.status(409).json({ error: 'You have already booked a free session with this mentor.' })
                : res.status(409).json({ error: 'Selected time is no longer available' });
        }
        console.error('Create free session booking error:', error);
        return res.status(500).json({ error: 'Failed to create free session booking' });
    }
};
