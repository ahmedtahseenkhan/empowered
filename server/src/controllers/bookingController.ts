import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { createMeetEventForLesson } from '../services/googleCalendar';
import { isTutorSlotAvailable } from '../services/availability';

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

        const { tutorId, startDate, slotStarts, durationMinutes, frequency } = req.body as {
            tutorId?: string;
            startDate?: string;
            slotStarts?: string[];
            durationMinutes?: number;
            frequency?: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';
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
                lessonsToCreate.map((l) => tx.lesson.create({
                    data: {
                        tutor_id: tutorId,
                        student_id: student.id,
                        booking_id: createdBooking.id,
                        start_time: l.start,
                        end_time: l.end,
                        duration: dur,
                        status: 'BOOKED',
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

            // Minimal notification outbox entries (provider wiring can be done later).
            const user = await tx.user.findUnique({ where: { id: userId } });
            const tutorUser = await tx.user.findUnique({ where: { id: tutor.user_id } });

            if (user?.email) {
                await tx.emailOutbox.create({
                    data: {
                        type: 'BOOKING_CONFIRMATION_STUDENT',
                        to_email: user.email,
                        payload: {
                            bookingId: createdBooking.id,
                            tutorName: tutor.username,
                            start: firstLesson?.start_time ? firstLesson.start_time.toISOString() : null,
                            end: firstLesson?.end_time ? firstLesson.end_time.toISOString() : null,
                        },
                        idempotency_key: `booking:${createdBooking.id}:student`,
                    }
                });
            }

            if (tutorUser?.email) {
                await tx.emailOutbox.create({
                    data: {
                        type: 'BOOKING_CONFIRMATION_TUTOR',
                        to_email: tutorUser.email,
                        payload: {
                            bookingId: createdBooking.id,
                            studentId: student.id,
                            start: firstLesson?.start_time ? firstLesson.start_time.toISOString() : null,
                            end: firstLesson?.end_time ? firstLesson.end_time.toISOString() : null,
                        },
                        idempotency_key: `booking:${createdBooking.id}:tutor`,
                    }
                });
            }

            return { createdBooking, createdLessons };
        });

        // Attempt Calendar event creation *after* DB commit.
        // If calendar is not connected, we still keep the booking+lesson.
        try {
            const studentUser = await prisma.user.findUnique({ where: { id: userId } });
            const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });

            const attendees = [studentUser?.email, tutorUser?.email].filter(Boolean) as string[];

            const firstLesson = booking.createdLessons?.[0];
            if (!firstLesson) return res.status(201).json({ booking: booking.createdBooking });

            const event = await createMeetEventForLesson({
                tutorId,
                lessonId: firstLesson.id,
                title: `Mentoring Session with ${tutor.username}`,
                description: 'Scheduled via Empowered Learnings',
                start: firstLesson.start_time,
                end: firstLesson.end_time,
                attendeesEmails: attendees,
            });

            if (event?.eventId || event?.meetLink || event?.htmlLink) {
                await prisma.lesson.update({
                    where: { id: firstLesson.id },
                    data: {
                        meeting_link: event.meetLink || undefined,
                        google_calendar_event_id: event.eventId || undefined,
                        google_calendar_html_link: event.htmlLink || undefined,
                    }
                });
            }
        } catch (e) {
            console.error('Calendar event creation failed (non-fatal):', e);
        }

        return res.status(201).json({ booking: booking.createdBooking });
    } catch (error) {
        console.error('Create booking error:', error);
        return res.status(500).json({ error: 'Failed to create booking' });
    }
};
