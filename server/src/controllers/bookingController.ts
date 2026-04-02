import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { createMeetEventForLesson } from '../services/googleCalendar';
import { isTutorSlotAvailable, isFreeSessionSlotAvailable } from '../services/availability';

const FREE_SESSION_DURATION_MINUTES = 25;

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const requiredWeeklySlotsForFrequency = (frequency: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY') => {
    if (frequency === 'TWICE_WEEKLY') return 2;
    if (frequency === 'THRICE_WEEKLY') return 3;
    return 1;
};

export const createBooking = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can create bookings' });

        const { tutorId, startDate, slotStarts, durationMinutes, frequency, clientTimezone } = req.body as {
            tutorId?: string;
            startDate?: string;
            slotStarts?: string[];
            durationMinutes?: number;
            frequency?: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';
            clientTimezone?: string;
        };

        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });
        if (!startDate && (!slotStarts || slotStarts.length === 0)) return res.status(400).json({ error: 'startDate or slotStarts is required' });

        const dur = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;

        const tutor = await prisma.tutorProfile.findUnique({ where: { id: tutorId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const bookingFrequency = frequency || 'WEEKLY';
        const resolvedSlotStarts = (slotStarts && Array.isArray(slotStarts) && slotStarts.length > 0)
            ? slotStarts
            : [startDate as string];

        const starts = resolvedSlotStarts
            .map((s) => new Date(s))
            .filter((d) => !Number.isNaN(d.getTime()));

        if (starts.length !== resolvedSlotStarts.length) return res.status(400).json({ error: 'One or more slotStarts are invalid' });

        const requiredWeeklySlots = requiredWeeklySlotsForFrequency(bookingFrequency);

        if (bookingFrequency !== 'ONCE' && resolvedSlotStarts.length !== requiredWeeklySlots) {
            return res.status(400).json({ error: `Please select ${requiredWeeklySlots} weekly time slots` });
        }

        const bookingStart = starts.slice().sort((a, b) => a.getTime() - b.getTime())[0];
        const bookingEnd = bookingFrequency === 'ONCE'
            ? addMinutes(bookingStart, dur)
            : addDays(bookingStart, 28);

        const lessonsToCreate: Array<{ start: Date; end: Date }> = [];

        if (bookingFrequency === 'ONCE') {
            const s = bookingStart;
            lessonsToCreate.push({ start: s, end: addMinutes(s, dur) });
        } else {
            for (const baseStart of starts) {
                for (let week = 0; week < 4; week++) {
                    const s = addDays(baseStart, week * 7);
                    const e = addMinutes(s, dur);
                    lessonsToCreate.push({ start: s, end: e });
                }
            }
        }

        lessonsToCreate.sort((a, b) => a.start.getTime() - b.start.getTime());

        for (const l of lessonsToCreate) {
            const isAvailable = await isTutorSlotAvailable({ tutorId, start: l.start, end: l.end });
            if (!isAvailable) {
                return res.status(409).json({ error: 'Selected time is not available' });
            }
        }


        const booking = await prisma.$transaction(async (tx) => {
            const createdBooking = await tx.booking.create({
                data: {
                    student_id: student.id,
                    tutor_id: tutorId,
                    start_date: bookingStart,
                    end_date: bookingEnd,
                    frequency: bookingFrequency,
                    status: 'pending'
                },
                include: {
                    tutor: {
                        select: { id: true, username: true, hourly_rate: true, rating: true, review_count: true }
                    }
                }
            });

            const createdLessons = await Promise.all(
                lessonsToCreate.map((l, idx) => tx.lesson.create({
                    data: {
                        tutor_id: tutorId,
                        student_id: student.id,
                        booking_id: createdBooking.id,
                        start_time: l.start,
                        end_time: l.end,
                        duration: dur,
                        status: 'BOOKED',
                        // Mark the very first lesson in the VERY first booking
                        // between this student and tutor as a FREE_TRIAL.
                        billing_type: idx === 0 ? 'FREE_TRIAL' : 'PAID',
                    }
                }))
            );

            const firstLesson = createdLessons[0];

            const paymentRows = createdLessons.map((l) => ({
                booking_id: createdBooking.id,
                amount: tutor.hourly_rate,
                due_date: addDays(l.start_time, -1),
                status: 'pending',
            }));

            if (paymentRows.length > 0) {
                await tx.paymentSchedule.createMany({ data: paymentRows });
            }

            return { createdBooking, createdLessons };
        });

        // Create Google Meet for each lesson so student, mentor, and (in emails) admin get the link.
        try {
            const studentUser = await prisma.user.findUnique({ where: { id: userId } });
            const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });
            const attendees = [studentUser?.email, tutorUser?.email].filter(Boolean) as string[];

            for (const lesson of booking.createdLessons ?? []) {
                const event = await createMeetEventForLesson({
                    tutorId,
                    lessonId: lesson.id,
                    title: `Mentoring Session with ${tutor.username}`,
                    description: 'Scheduled via Empowered Learnings',
                    start: lesson.start_time,
                    end: lesson.end_time,
                    attendeesEmails: attendees,
                });
                if (event?.eventId || event?.meetLink || event?.htmlLink) {
                    await prisma.lesson.update({
                        where: { id: lesson.id },
                        data: {
                            meeting_link: event.meetLink || undefined,
                            google_calendar_event_id: event.eventId || undefined,
                            google_calendar_html_link: event.htmlLink || undefined,
                        },
                    });
                }
            }
        } catch (e) {
            console.error('Calendar event creation failed (non-fatal):', e);
        }

        // Queue confirmation emails after Meet links are set so both sides get the link
        const firstLesson = booking.createdLessons?.[0];
        const studentUser = await prisma.user.findUnique({ where: { id: userId } });
        const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });
        if (studentUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'BOOKING_CONFIRMATION_STUDENT',
                    to_email: studentUser.email,
                    payload: {
                        bookingId: booking.createdBooking.id,
                        tutorName: tutor.username,
                        clientTimezone: clientTimezone || undefined,
                        start: firstLesson?.start_time ? firstLesson.start_time.toISOString() : null,
                        end: firstLesson?.end_time ? firstLesson.end_time.toISOString() : null,
                    },
                    idempotency_key: `booking:${booking.createdBooking.id}:student`,
                },
            });
        }
        if (tutorUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'BOOKING_CONFIRMATION_TUTOR',
                    to_email: tutorUser.email,
                    payload: {
                        bookingId: booking.createdBooking.id,
                        studentId: student.id,
                        start: firstLesson?.start_time ? firstLesson.start_time.toISOString() : null,
                        end: firstLesson?.end_time ? firstLesson.end_time.toISOString() : null,
                    },
                    idempotency_key: `booking:${booking.createdBooking.id}:tutor`,
                },
            });
        }

        return res.status(201).json({ booking: booking.createdBooking });
    } catch (error) {
        console.error('Create booking error:', error);
        return res.status(500).json({ error: 'Failed to create booking' });
    }
};

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

        const { tutorId, slotStart, clientTimezone } = req.body as { tutorId?: string; slotStart?: string; clientTimezone?: string };

        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });
        if (!slotStart) return res.status(400).json({ error: 'slotStart is required (ISO string)' });

        const start = new Date(slotStart);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid slotStart' });

        const tutor = await prisma.tutorProfile.findUnique({ where: { id: tutorId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor not found' });
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
            const createdBooking = await tx.booking.create({
                data: {
                    student_id: student.id,
                    tutor_id: tutorId,
                    start_date: start,
                    end_date: end,
                    frequency: 'ONCE',
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
            const studentUser = await prisma.user.findUnique({ where: { id: userId } });
            const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });
            const attendees = [studentUser?.email, tutorUser?.email].filter(Boolean) as string[];
            const event = await createMeetEventForLesson({
                tutorId,
                lessonId: result.lesson.id,
                title: `Free intro session with ${tutor.username}`,
                description: 'Free 25-minute introductory session via Empowered Learnings',
                start: result.lesson.start_time,
                end: result.lesson.end_time,
                attendeesEmails: attendees,
            });
            if (event?.eventId || event?.meetLink || event?.htmlLink) {
                await prisma.lesson.update({
                    where: { id: result.lesson.id },
                    data: {
                        meeting_link: event.meetLink || undefined,
                        google_calendar_event_id: event.eventId || undefined,
                        google_calendar_html_link: event.htmlLink || undefined,
                    },
                });
            }
        } catch (e) {
            console.error('Calendar event for free session failed (non-fatal):', e);
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
        console.error('Create free session booking error:', error);
        return res.status(500).json({ error: 'Failed to create free session booking' });
    }
};
