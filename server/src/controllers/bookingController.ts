import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { createMeetEventForLesson } from '../services/googleCalendar';
import { isTutorSlotAvailable } from '../services/availability';

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const createBooking = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can create bookings' });

        const { tutorId, startDate, durationMinutes, frequency } = req.body as {
            tutorId?: string;
            startDate?: string;
            durationMinutes?: number;
            frequency?: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';
        };

        if (!tutorId) return res.status(400).json({ error: 'tutorId is required' });
        if (!startDate) return res.status(400).json({ error: 'startDate is required' });

        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'startDate is invalid' });

        const dur = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 50;

        const tutor = await prisma.tutorProfile.findUnique({ where: { id: tutorId } });
        if (!tutor) return res.status(404).json({ error: 'Tutor not found' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const bookingFrequency = frequency || 'WEEKLY';

        const end = bookingFrequency === 'ONCE'
            ? addMinutes(start, dur)
            : addDays(start, 28);

        const lessonEnd = addMinutes(start, dur);

        const isAvailable = await isTutorSlotAvailable({ tutorId, start, end: lessonEnd });
        if (!isAvailable) {
            return res.status(409).json({ error: 'Selected time is not available' });
        }


        const booking = await prisma.$transaction(async (tx) => {
            const createdBooking = await tx.booking.create({
                data: {
                    student_id: student.id,
                    tutor_id: tutorId,
                    start_date: start,
                    end_date: end,
                    frequency: bookingFrequency,
                    status: 'pending'
                },
                include: {
                    tutor: {
                        select: { id: true, username: true, hourly_rate: true, rating: true, review_count: true }
                    }
                }
            });

            const createdLesson = await tx.lesson.create({
                data: {
                    tutor_id: tutorId,
                    student_id: student.id,
                    booking_id: createdBooking.id,
                    start_time: start,
                    end_time: lessonEnd,
                    duration: dur,
                    status: 'BOOKED',
                }
            });

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
                            start: start.toISOString(),
                            end: lessonEnd.toISOString(),
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
                            start: start.toISOString(),
                            end: lessonEnd.toISOString(),
                        },
                        idempotency_key: `booking:${createdBooking.id}:tutor`,
                    }
                });
            }

            return { createdBooking, createdLesson };
        });

        // Attempt Calendar event creation *after* DB commit.
        // If calendar is not connected, we still keep the booking+lesson.
        try {
            const studentUser = await prisma.user.findUnique({ where: { id: userId } });
            const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });

            const attendees = [studentUser?.email, tutorUser?.email].filter(Boolean) as string[];

            const event = await createMeetEventForLesson({
                tutorId,
                lessonId: booking.createdLesson.id,
                title: `Mentoring Session with ${tutor.username}`,
                description: 'Scheduled via Empowered Learnings',
                start,
                end: lessonEnd,
                attendeesEmails: attendees,
            });

            if (event?.eventId || event?.meetLink || event?.htmlLink) {
                await prisma.lesson.update({
                    where: { id: booking.createdLesson.id },
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
