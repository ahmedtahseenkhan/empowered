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

        await emailService.sendBookingConfirmationRegular({
            studentName: booking.student?.username || 'Student',
            studentEmail: row.to_email,
            mentorName: booking.tutor?.username || row.payload?.tutorName || 'Mentor',
            firstSessionDate: start ? formatDatePart(start) : '',
            firstSessionTime: start ? formatTimePart(start) : '',
            frequency: String(booking.frequency || ''),
            totalSessions: Array.isArray(booking.lessons) ? booking.lessons.length : 0,
            meetingLink: firstLesson?.meeting_link || '',
        });

        return;
    }

    if (row.type === 'BOOKING_CONFIRMATION_TUTOR') {
        const bookingId = row.payload?.bookingId as string | undefined;
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

        await emailService.sendNewRegularBookingMentor({
            mentorName: booking.tutor?.username || 'Mentor',
            mentorEmail: row.to_email,
            studentName: booking.student?.username || 'Student',
            firstSessionDate: start ? formatDatePart(start) : '',
            firstSessionTime: start ? formatTimePart(start) : '',
            frequency: String(booking.frequency || ''),
            meetingLink: firstLesson?.meeting_link || '',
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
                    console.log(`[EmailOutbox] Sent ${row.type} to ${row.to_email} (id=${row.id})`);
                } catch (e: any) {
                    const msg = e?.message ? String(e.message) : String(e);
                    await prisma.emailOutbox.update({
                        where: { id: row.id },
                        data: {
                            status: attemptNumber >= 8 ? 'FAILED' : 'RETRY',
                            last_error: msg.slice(0, 1000),
                            next_retry_at: attemptNumber >= 8 ? null : computeNextRetryAt(attemptNumber),
                        },
                    });
                    console.error(`[EmailOutbox] Failed ${row.type} to ${row.to_email} (id=${row.id}, attempt=${attemptNumber}):`, msg);
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
