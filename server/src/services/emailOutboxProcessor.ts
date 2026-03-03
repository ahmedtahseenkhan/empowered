import prisma from '../config/db';
import emailService from './emailService';

type OutboxRow = {
    id: string;
    type: string;
    to_email: string;
    payload: any;
    status: string;
    attempts: number;
};

const humanizeBookingFrequency = (frequency: unknown) => {
    const f = String(frequency || '').toUpperCase();
    if (f === 'WEEKLY') return 'Once weekly';
    if (f === 'TWICE_WEEKLY') return 'Twice weekly';
    if (f === 'THRICE_WEEKLY') return 'Thrice weekly';
    if (f === 'ONCE') return 'One time';
    return String(frequency || '');
};

const formatDatePart = (d: Date) => {
    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatTimePart = (d: Date) => {
    return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const computeNextRetryAt = (attempts: number) => {
    const cappedAttempts = Math.max(1, Math.min(attempts, 10));
    const delaySeconds = Math.min(3600, Math.pow(2, cappedAttempts) * 30);
    return new Date(Date.now() + delaySeconds * 1000);
};

async function sendOutboxRow(row: OutboxRow) {
    if (row.type === 'BOOKING_CONFIRMATION_STUDENT') {
        const bookingId = row.payload?.bookingId as string | undefined;
        const freeSession = row.payload?.freeSession === true;
        if (!bookingId) throw new Error('Missing bookingId in payload');

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                tutor: { select: { username: true } },
                student: { select: { username: true } },
                lessons: {
                    orderBy: { start_time: 'asc' },
                    select: { start_time: true, meeting_link: true },
                },
            },
        });

        if (!booking) throw new Error(`Booking not found: ${bookingId}`);
        const firstLesson = booking.lessons?.[0];
        const start = firstLesson?.start_time;

        if (freeSession) {
            await emailService.sendBookingConfirmationTrial({
                studentName: booking.student?.username || 'Student',
                studentEmail: row.to_email,
                mentorName: booking.tutor?.username || row.payload?.tutorName || 'Mentor',
                sessionDate: start ? formatDatePart(start) : '',
                sessionTime: start ? formatTimePart(start) : '',
                meetingLink: firstLesson?.meeting_link || '',
            });
        } else {
            await emailService.sendBookingConfirmationRegular({
                studentName: booking.student?.username || 'Student',
                studentEmail: row.to_email,
                mentorName: booking.tutor?.username || row.payload?.tutorName || 'Mentor',
                firstSessionDate: start ? formatDatePart(start) : '',
                firstSessionTime: start ? formatTimePart(start) : '',
                frequency: humanizeBookingFrequency(booking.frequency),
                totalSessions: Array.isArray(booking.lessons) ? booking.lessons.length : 0,
                meetingLink: firstLesson?.meeting_link || '',
            });
        }

        return;
    }

    if (row.type === 'BOOKING_CONFIRMATION_TUTOR') {
        const bookingId = row.payload?.bookingId as string | undefined;
        const freeSession = row.payload?.freeSession === true;
        if (!bookingId) throw new Error('Missing bookingId in payload');

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                tutor: { select: { username: true, user: { select: { email: true } } } },
                student: { select: { username: true } },
                lessons: {
                    orderBy: { start_time: 'asc' },
                    select: { start_time: true, meeting_link: true },
                },
            },
        });

        if (!booking) throw new Error(`Booking not found: ${bookingId}`);
        const firstLesson = booking.lessons?.[0];
        const start = firstLesson?.start_time;

        if (freeSession) {
            await emailService.sendNewTrialBookingMentor({
                mentorName: booking.tutor?.username || 'Mentor',
                mentorEmail: row.to_email,
                studentName: booking.student?.username || 'Student',
                sessionDate: start ? formatDatePart(start) : '',
                sessionTime: start ? formatTimePart(start) : '',
                meetingLink: firstLesson?.meeting_link || '',
            });
        } else {
            await emailService.sendNewRegularBookingMentor({
                mentorName: booking.tutor?.username || 'Mentor',
                mentorEmail: row.to_email,
                studentName: booking.student?.username || 'Student',
                firstSessionDate: start ? formatDatePart(start) : '',
                firstSessionTime: start ? formatTimePart(start) : '',
                frequency: humanizeBookingFrequency(booking.frequency),
                meetingLink: firstLesson?.meeting_link || '',
            });
        }

        return;
    }

    if (row.type === 'SESSION_REMINDER_STUDENT') {
        const lessonId = row.payload?.lessonId as string | undefined;
        if (!lessonId) throw new Error('Missing lessonId in payload');

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                student: { select: { username: true } },
                tutor: { select: { username: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        await emailService.sendSessionReminderStudent({
            studentName: lesson.student?.username || 'Student',
            studentEmail: row.to_email,
            mentorName: lesson.tutor?.username || 'Mentor',
            sessionDate: formatDatePart(lesson.start_time),
            sessionTime: formatTimePart(lesson.start_time),
            meetingLink: lesson.meeting_link || '',
        });

        return;
    }

    if (row.type === 'SESSION_REMINDER_TUTOR') {
        const lessonId = row.payload?.lessonId as string | undefined;
        if (!lessonId) throw new Error('Missing lessonId in payload');

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                student: { select: { username: true } },
                tutor: { select: { username: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        await emailService.sendSessionReminderMentor({
            mentorName: lesson.tutor?.username || 'Mentor',
            mentorEmail: row.to_email,
            studentName: lesson.student?.username || 'Student',
            sessionDate: formatDatePart(lesson.start_time),
            sessionTime: formatTimePart(lesson.start_time),
            meetingLink: lesson.meeting_link || '',
        });

        return;
    }

    if (row.type === 'PAYMENT_DUE_REMINDER') {
        const paymentId = row.payload?.paymentId as string | undefined;
        if (!paymentId) throw new Error('Missing paymentId in payload');

        const payment = await prisma.paymentSchedule.findUnique({
            where: { id: paymentId },
            include: {
                booking: {
                    include: {
                        student: { select: { username: true } },
                        tutor: { select: { username: true } },
                    },
                },
            },
        });

        if (!payment) throw new Error(`Payment not found: ${paymentId}`);

        const amountDollars = (payment.amount / 100).toFixed(2);

        await emailService.sendPaymentDueReminder({
            studentName: payment.booking.student?.username || 'Student',
            studentEmail: row.to_email,
            tutorName: payment.booking.tutor?.username || 'Mentor',
            amount: `$${amountDollars}`,
            dueDate: formatDatePart(payment.due_date),
            paymentLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payments`,
        });

        return;
    }

    if (row.type === 'DEMO_BOOKING_CONFIRMATION') {
        const p = row.payload as { fullName?: string; email?: string; callDate?: string; callTime?: string; meetingLink?: string; addToCalendarUrl?: string };
        // Mentor-style demo confirmation with meeting link (per System Generated Emails doc)
        await emailService.sendDemoCallConfirmation({
            mentorName: p.fullName || 'there',
            mentorEmail: row.to_email,
            callDate: p.callDate || '',
            callTime: p.callTime || '',
            meetingLink: p.meetingLink || '',
            addToCalendarUrl: p.addToCalendarUrl,
        });
        return;
    }

    if (row.type === 'DEMO_BOOKING_ADMIN') {
        const p = row.payload as {
            adminEmail?: string;
            fullName?: string;
            email?: string;
            phone?: string;
            categoryAlignment?: string;
            experienceYears?: string;
            incomeStatus?: string;
            lookingFor?: string;
            callDate?: string;
            callTime?: string;
            meetingLink?: string;
        };
        await emailService.sendDemoBookingAdminNotification({
            adminEmail: p.adminEmail || row.to_email,
            fullName: p.fullName || '—',
            email: p.email || '—',
            phone: p.phone ?? '—',
            categoryAlignment: p.categoryAlignment ?? '—',
            experienceYears: p.experienceYears ?? '—',
            incomeStatus: p.incomeStatus ?? '—',
            lookingFor: p.lookingFor ?? '—',
            callDate: p.callDate ?? '—',
            callTime: p.callTime ?? '—',
            meetingLink: p.meetingLink ?? '',
        });
        return;
    }

    throw new Error(`Unknown outbox type: ${row.type}`);
}

export function startEmailOutboxProcessor() {
    const enabled = (process.env.EMAIL_OUTBOX_ENABLED || 'true').toLowerCase() !== 'false';
    if (!enabled) {
        console.log('[EmailOutbox] Processor disabled by EMAIL_OUTBOX_ENABLED=false');
        return;
    }

    const intervalMs = Number(process.env.EMAIL_OUTBOX_INTERVAL_MS || 15000);
    const batchSize = Number(process.env.EMAIL_OUTBOX_BATCH_SIZE || 10);

    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;

        try {
            const now = new Date();
            const rows = await prisma.emailOutbox.findMany({
                where: {
                    status: { in: ['PENDING', 'RETRY'] },
                    OR: [{ next_retry_at: null }, { next_retry_at: { lte: now } }],
                },
                orderBy: { created_at: 'asc' },
                take: batchSize,
            });

            for (const row of rows) {
                console.log(`[EmailOutbox] Processing ${row.type} for ${row.to_email} (id=${row.id}, attempt=${row.attempts || 0})`);

                const claimed = await prisma.emailOutbox.updateMany({
                    where: { id: row.id, status: row.status },
                    data: {
                        status: 'SENDING',
                        attempts: { increment: 1 },
                        last_error: null,
                    },
                });

                if (claimed.count === 0) continue;

                const attemptNumber = (row.attempts || 0) + 1;

                try {
                    await sendOutboxRow(row as any);
                    await prisma.emailOutbox.update({
                        where: { id: row.id },
                        data: {
                            status: 'SENT',
                            sent_at: new Date(),
                            next_retry_at: null,
                            last_error: null,
                        },
                    });
                    console.log(`[EmailOutbox] ✅ Successfully sent ${row.type} to ${row.to_email} (id=${row.id})`);
                } catch (e: any) {
                    const msg = e?.message ? String(e.message) : String(e);
                    const isRetryable = attemptNumber < 8;

                    await prisma.emailOutbox.update({
                        where: { id: row.id },
                        data: {
                            status: isRetryable ? 'RETRY' : 'FAILED',
                            last_error: msg.slice(0, 1000),
                            next_retry_at: isRetryable ? computeNextRetryAt(attemptNumber) : null,
                        },
                    });
                    console.error(`[EmailOutbox] ❌ Failed to send ${row.type} to ${row.to_email} (id=${row.id}, attempt=${attemptNumber}):`, msg);
                }
            }
        } catch (e) {
            console.error('[EmailOutbox] Tick error:', e);
        } finally {
            running = false;
        }
    };

    setInterval(tick, intervalMs);
    tick();
    console.log(`[EmailOutbox] Processor started (intervalMs=${intervalMs}, batchSize=${batchSize})`);
}
