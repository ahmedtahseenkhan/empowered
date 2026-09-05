import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { isTutorSlotAvailable } from '../services/availability';
import { updateMeetEventForLesson, ensureMeetLinkForLesson } from '../services/googleCalendar';
import { completeLessonNow, WalletError } from '../services/walletService';

// Student-initiated reschedule policy
const RESCHEDULE_CUTOFF_HOURS = 24; // cannot reschedule within 24h of start
const MAX_RESCHEDULES = 1; // each session can be moved once

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
                booking_id: true,
                start_time: true,
                end_time: true,
                duration: true,
                status: true,
                billing_type: true,
                reschedule_count: true,
                student_confirmed_at: true,
                tutor_confirmed_at: true,
                meeting_link: true,
                google_calendar_html_link: true,
                created_at: true,
                booking: {
                    select: {
                        id: true,
                        frequency: true,
                        created_at: true,
                        funding: true,
                    },
                },
                reservation: { select: { status: true, credits: true } },
                earning: { select: { status: true, available_at: true } },
                dispute: { select: { status: true } },
                student: { select: { username: true } },
                tutor: { select: { username: true } },
            }
        });

        // Enrich each lesson with its payment schedule status
        const enriched = await Promise.all(
            lessons.map(async (lesson) => {
                if (lesson.billing_type === 'FREE_INTRO' || lesson.billing_type === 'FREE_TRIAL') {
                    return { ...lesson, payment_status: 'not_required' as const };
                }

                // Sessions reserved with Learning Credits are paid up front — no PaymentSchedule rows exist.
                if (lesson.booking?.funding === 'CREDITS') {
                    return { ...lesson, payment_status: 'paid' as const };
                }

                if (!lesson.booking_id) {
                    return { ...lesson, payment_status: 'unknown' as const };
                }

                const dueDate = new Date(lesson.start_time.getTime() - 48 * 60 * 60 * 1000);
                const dueStart = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
                const dueEnd = new Date(dueDate.getTime() + 2 * 60 * 60 * 1000);

                const schedule = await prisma.paymentSchedule.findFirst({
                    where: {
                        booking_id: lesson.booking_id,
                        due_date: { gte: dueStart, lte: dueEnd },
                    },
                    select: { status: true },
                });

                if (!schedule) {
                    // First session in a booking is paid at checkout — no schedule row means it was paid upfront
                    return { ...lesson, payment_status: 'paid' as const };
                }

                return { ...lesson, payment_status: schedule.status as 'paid' | 'pending' | 'failed' };
            })
        );

        return res.json({ lessons: enriched });
    } catch (e) {
        console.error('getMyLessons error:', e);
        return res.status(500).json({ error: 'Failed to fetch lessons' });
    }
};

export const getLessonDetail = async (req: AuthRequest, res: Response) => {
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
                end_time: true,
                duration: true,
                status: true,
                billing_type: true,
                student_confirmed_at: true,
                tutor_confirmed_at: true,
                meeting_link: true,
                google_calendar_html_link: true,
                category: true,
                created_at: true,
                booking: {
                    select: {
                        id: true,
                        frequency: true,
                        created_at: true,
                        funding: true,
                    },
                },
                reservation: { select: { status: true, credits: true } },
                earning: { select: { status: true, available_at: true } },
                dispute: { select: { status: true } },
                student: { select: { username: true } },
                tutor: { select: { username: true, timezone: true } },
            },
        });

        if (!lesson) return res.status(404).json({ error: 'Session not found' });

        // Authorize: user must own this lesson
        if (role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
            if (!student || lesson.student_id !== student.id) return res.status(403).json({ error: 'Forbidden' });
        } else if (role === 'TUTOR') {
            const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
            if (!tutor || lesson.tutor_id !== tutor.id) return res.status(403).json({ error: 'Forbidden' });
        } else {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Enrich with payment status
        let payment_status: 'paid' | 'pending' | 'failed' | 'not_required' | 'unknown' = 'unknown';

        if (lesson.billing_type === 'FREE_INTRO' || lesson.billing_type === 'FREE_TRIAL') {
            payment_status = 'not_required';
        } else if (lesson.booking?.funding === 'CREDITS') {
            payment_status = 'paid';
        } else if (lesson.booking_id) {
            const dueDate = new Date(lesson.start_time.getTime() - 48 * 60 * 60 * 1000);
            const dueStart = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
            const dueEnd = new Date(dueDate.getTime() + 2 * 60 * 60 * 1000);

            const schedule = await prisma.paymentSchedule.findFirst({
                where: {
                    booking_id: lesson.booking_id,
                    due_date: { gte: dueStart, lte: dueEnd },
                },
                select: { status: true },
            });

            if (!schedule) {
                payment_status = 'paid';
            } else {
                payment_status = schedule.status as 'paid' | 'pending' | 'failed';
            }
        }

        return res.json({ lesson: { ...lesson, payment_status } });
    } catch (e) {
        console.error('getLessonDetail error:', e);
        return res.status(500).json({ error: 'Failed to fetch session details' });
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
                end_time: true,
                meeting_link: true,
                google_calendar_html_link: true,
                booking: { select: { funding: true } },
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

        // For students: enforce payment check only while session is still joinable.
        // Credit-funded sessions were paid (reserved) at booking time — no per-session payment exists.
        if (role === 'STUDENT' && lesson.booking?.funding !== 'CREDITS') {
            const now = new Date();
            const sessionEnd = new Date(lesson.end_time.getTime() + 15 * 60 * 1000); // real end + grace

            // Session already over — allow access without payment check (completed session)
            if (now > sessionEnd) {
                return res.json({
                    meeting_link: lesson.meeting_link,
                    google_calendar_html_link: lesson.google_calendar_html_link,
                });
            }

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

        // Booking-time calendar creation can fail (e.g. mentor never connected Google
        // Calendar before the fallback existed). Create the Meet link on demand so
        // nobody is ever stuck at session time without one.
        let meetingLink = lesson.meeting_link;
        if (!meetingLink) {
            try {
                meetingLink = await ensureMeetLinkForLesson(lesson.id);
            } catch (err) {
                console.error(`joinLesson: on-demand meet link failed for ${lesson.id}:`, err);
            }
        }

        return res.json({
            meeting_link: meetingLink,
            google_calendar_html_link: lesson.google_calendar_html_link,
        });
    } catch (e) {
        console.error('joinLesson error:', e);
        return res.status(500).json({ error: 'Failed to join lesson' });
    }
};

/**
 * Two-sided completion confirmation. The student (who pays) confirms first;
 * the mentor's confirmation then finalizes the session as COMPLETED and, for
 * credit-funded sessions, releases the reserved credits into pending earnings.
 * If neither side confirms, the wallet scheduler still auto-completes
 * credit-funded sessions after the grace window as a backstop.
 */
export const confirmLessonComplete = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT' && role !== 'TUTOR') return res.status(403).json({ error: 'Forbidden' });

        const lessonId = (req.params.lessonId || '').trim();
        if (!lessonId) return res.status(400).json({ error: 'lessonId is required' });

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true, tutor_id: true, student_id: true, status: true,
                start_time: true, end_time: true,
                student_confirmed_at: true, tutor_confirmed_at: true,
            },
        });
        if (!lesson) return res.status(404).json({ error: 'Session not found' });

        if (role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
            if (!student || lesson.student_id !== student.id) return res.status(403).json({ error: 'Forbidden' });
        } else {
            const tutor = await prisma.tutorProfile.findUnique({ where: { user_id: userId } });
            if (!tutor || lesson.tutor_id !== tutor.id) return res.status(403).json({ error: 'Forbidden' });
        }

        if (lesson.status === 'CANCELLED' || lesson.status === 'MISSED') {
            return res.status(400).json({ error: 'This session was not held, so it cannot be confirmed as completed.' });
        }
        if (Date.now() < lesson.end_time.getTime()) {
            return res.status(400).json({ error: 'You can confirm completion once the session has ended.' });
        }

        let updated = lesson;
        if (role === 'STUDENT') {
            if (!lesson.student_confirmed_at) {
                updated = await prisma.lesson.update({
                    where: { id: lesson.id },
                    data: { student_confirmed_at: new Date() },
                    select: {
                        id: true, tutor_id: true, student_id: true, status: true,
                        start_time: true, end_time: true,
                        student_confirmed_at: true, tutor_confirmed_at: true,
                    },
                });
            }
        } else {
            if (!lesson.student_confirmed_at) {
                return res.status(400).json({ error: 'The student has not confirmed this session yet. They confirm first.' });
            }
            if (!lesson.tutor_confirmed_at) {
                await prisma.lesson.update({ where: { id: lesson.id }, data: { tutor_confirmed_at: new Date() } });
                await completeLessonNow(lesson.id); // marks COMPLETED + releases credits for credit-funded sessions
                updated = (await prisma.lesson.findUnique({
                    where: { id: lesson.id },
                    select: {
                        id: true, tutor_id: true, student_id: true, status: true,
                        start_time: true, end_time: true,
                        student_confirmed_at: true, tutor_confirmed_at: true,
                    },
                }))!;
            }
        }

        return res.json({
            lesson: {
                id: updated.id,
                status: updated.status,
                student_confirmed_at: updated.student_confirmed_at,
                tutor_confirmed_at: updated.tutor_confirmed_at,
            },
        });
    } catch (e) {
        if (e instanceof WalletError) return res.status(e.status).json({ error: e.message });
        console.error('confirmLessonComplete error:', e);
        return res.status(500).json({ error: 'Failed to confirm session completion' });
    }
};

/**
 * Student-initiated reschedule. Moves a BOOKED lesson to a new start time if the
 * tutor slot is free, the session is more than 24h away, and it hasn't already been
 * rescheduled. Auto-confirms (no tutor approval). Keeps the linked payment schedule
 * row and Google Calendar event in sync.
 */
export const rescheduleLesson = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (role !== 'STUDENT') return res.status(403).json({ error: 'Only students can reschedule their sessions' });

        const lessonId = (req.params.lessonId || '').trim();
        if (!lessonId) return res.status(400).json({ error: 'lessonId is required' });

        const { newStart, clientTimezone } = req.body as { newStart?: string; clientTimezone?: string };
        if (!newStart) return res.status(400).json({ error: 'newStart is required (ISO string)' });

        const newStartDate = new Date(newStart);
        if (Number.isNaN(newStartDate.getTime())) return res.status(400).json({ error: 'newStart is invalid' });

        const student = await prisma.studentProfile.findUnique({ where: { user_id: userId } });
        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            select: {
                id: true,
                tutor_id: true,
                student_id: true,
                booking_id: true,
                start_time: true,
                end_time: true,
                duration: true,
                status: true,
                reschedule_count: true,
                google_calendar_event_id: true,
            },
        });

        if (!lesson) return res.status(404).json({ error: 'Session not found' });
        if (lesson.student_id !== student.id) return res.status(403).json({ error: 'Forbidden' });

        if (lesson.status !== 'BOOKED') {
            return res.status(400).json({ error: 'Only upcoming booked sessions can be rescheduled' });
        }
        if (lesson.reschedule_count >= MAX_RESCHEDULES) {
            return res.status(400).json({ error: 'This session has already been rescheduled and cannot be moved again' });
        }

        const now = new Date();
        const cutoffMs = RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000;
        if (lesson.start_time.getTime() - now.getTime() < cutoffMs) {
            return res.status(400).json({ error: `Sessions can only be rescheduled more than ${RESCHEDULE_CUTOFF_HOURS} hours before they start` });
        }
        // New time must also be far enough out that the student can still pay before it.
        if (newStartDate.getTime() - now.getTime() < cutoffMs) {
            return res.status(400).json({ error: `New time must be more than ${RESCHEDULE_CUTOFF_HOURS} hours from now` });
        }

        const newEndDate = new Date(newStartDate.getTime() + lesson.duration * 60 * 1000);

        const available = await isTutorSlotAvailable({
            tutorId: lesson.tutor_id,
            start: newStartDate,
            end: newEndDate,
            excludeLessonId: lesson.id,
        });
        if (!available) return res.status(409).json({ error: 'Selected time is no longer available' });

        // Payment rows are keyed to lessons by due_date = start_time - 48h (the convention
        // used across the webhook, payment, and reminder code). Realign this lesson's row to
        // the new start so the payment status keeps tracking the same row instead of looking
        // empty (which the reader treats as "paid").
        const DUE_OFFSET_MS = 48 * 60 * 60 * 1000;
        const oldDue = new Date(lesson.start_time.getTime() - DUE_OFFSET_MS);
        const newDue = new Date(newStartDate.getTime() - DUE_OFFSET_MS);
        const dueWindowMs = 2 * 60 * 60 * 1000;

        await prisma.$transaction(async (tx) => {
            await tx.lesson.update({
                where: { id: lesson.id },
                data: {
                    start_time: newStartDate,
                    end_time: newEndDate,
                    reschedule_count: { increment: 1 },
                },
            });

            if (lesson.booking_id) {
                const schedule = await tx.paymentSchedule.findFirst({
                    where: {
                        booking_id: lesson.booking_id,
                        due_date: {
                            gte: new Date(oldDue.getTime() - dueWindowMs),
                            lte: new Date(oldDue.getTime() + dueWindowMs),
                        },
                    },
                });
                if (schedule) {
                    await tx.paymentSchedule.update({
                        where: { id: schedule.id },
                        data: { due_date: newDue },
                    });
                }
            }
        });

        // Move the calendar event (non-fatal if calendar is not connected)
        if (lesson.google_calendar_event_id) {
            try {
                await updateMeetEventForLesson({
                    tutorId: lesson.tutor_id,
                    eventId: lesson.google_calendar_event_id,
                    start: newStartDate,
                    end: newEndDate,
                });
            } catch (e) {
                console.error('Calendar event reschedule failed (non-fatal):', e);
            }
        }

        // Notify both sides
        const tutor = await prisma.tutorProfile.findUnique({
            where: { id: lesson.tutor_id },
            select: { user_id: true },
        });
        const studentUser = await prisma.user.findUnique({ where: { id: userId } });
        const tutorUser = tutor ? await prisma.user.findUnique({ where: { id: tutor.user_id } }) : null;
        const stamp = newStartDate.getTime();

        const previousStart = lesson.start_time.toISOString();

        if (studentUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'SESSION_RESCHEDULED_STUDENT',
                    to_email: studentUser.email,
                    payload: { lessonId: lesson.id, previousStart, clientTimezone: clientTimezone || undefined },
                    idempotency_key: `reschedule:${lesson.id}:${stamp}:student`,
                },
            });
        }
        if (tutorUser?.email) {
            await prisma.emailOutbox.create({
                data: {
                    type: 'SESSION_RESCHEDULED_TUTOR',
                    to_email: tutorUser.email,
                    payload: { lessonId: lesson.id, previousStart },
                    idempotency_key: `reschedule:${lesson.id}:${stamp}:tutor`,
                },
            });
        }

        return res.json({
            lesson: {
                id: lesson.id,
                start_time: newStartDate.toISOString(),
                end_time: newEndDate.toISOString(),
                reschedule_count: lesson.reschedule_count + 1,
            },
        });
    } catch (e) {
        console.error('rescheduleLesson error:', e);
        return res.status(500).json({ error: 'Failed to reschedule session' });
    }
};
