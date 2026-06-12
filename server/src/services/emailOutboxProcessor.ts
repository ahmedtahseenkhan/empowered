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

const formatDatePart = (d: Date, timeZone?: string) => {
    return d.toLocaleDateString('en-US', {
        ...(timeZone ? { timeZone } : { timeZone: 'UTC' }),
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatTimePart = (d: Date, timeZone?: string) => {
    return d.toLocaleTimeString('en-US', {
        ...(timeZone ? { timeZone } : { timeZone: 'UTC' }),
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
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
                tutor: { select: { username: true, timezone: true } },
                student: { select: { username: true } },
                lessons: {
                    orderBy: { start_time: 'asc' },
                    select: { id: true, start_time: true, meeting_link: true },
                },
            },
        });

        if (!booking) throw new Error(`Booking not found: ${bookingId}`);
        const firstLesson = booking.lessons?.[0];
        const start = firstLesson?.start_time;
        const studentTimeZone = (row.payload?.clientTimezone as string | undefined) || booking.tutor?.timezone || 'UTC';
        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const dashboardUrl = firstLesson ? `${clientBase}/student/sessions/${firstLesson.id}` : `${clientBase}/student/sessions`;

        if (freeSession) {
            await emailService.sendBookingConfirmationTrial({
                studentName: booking.student?.username || 'Student',
                studentEmail: row.to_email,
                mentorName: booking.tutor?.username || row.payload?.tutorName || 'Mentor',
                sessionDate: start ? formatDatePart(start, studentTimeZone) : '',
                sessionTime: start ? formatTimePart(start, studentTimeZone) : '',
                meetingLink: firstLesson?.meeting_link || '',
                dashboardUrl,
            });
        } else {
            await emailService.sendBookingConfirmationRegular({
                studentName: booking.student?.username || 'Student',
                studentEmail: row.to_email,
                mentorName: booking.tutor?.username || row.payload?.tutorName || 'Mentor',
                firstSessionDate: start ? formatDatePart(start, studentTimeZone) : '',
                firstSessionTime: start ? formatTimePart(start, studentTimeZone) : '',
                frequency: humanizeBookingFrequency(booking.frequency),
                totalSessions: Array.isArray(booking.lessons) ? booking.lessons.length : 0,
                meetingLink: firstLesson?.meeting_link || '',
                dashboardUrl,
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
                tutor: { select: { username: true, timezone: true, user: { select: { email: true } } } },
                student: { select: { username: true } },
                lessons: {
                    orderBy: { start_time: 'asc' },
                    select: { id: true, start_time: true, meeting_link: true },
                },
            },
        });

        if (!booking) throw new Error(`Booking not found: ${bookingId}`);
        const firstLesson = booking.lessons?.[0];
        const start = firstLesson?.start_time;
        const timeZone = booking.tutor?.timezone || 'UTC';
        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const dashboardUrl = firstLesson ? `${clientBase}/sessions/${firstLesson.id}` : `${clientBase}/sessions`;

        if (freeSession) {
            await emailService.sendNewTrialBookingMentor({
                mentorName: booking.tutor?.username || 'Mentor',
                mentorEmail: row.to_email,
                studentName: booking.student?.username || 'Student',
                sessionDate: start ? formatDatePart(start, timeZone) : '',
                sessionTime: start ? formatTimePart(start, timeZone) : '',
                meetingLink: firstLesson?.meeting_link || '',
                dashboardUrl,
            });
        } else {
            await emailService.sendNewRegularBookingMentor({
                mentorName: booking.tutor?.username || 'Mentor',
                mentorEmail: row.to_email,
                studentName: booking.student?.username || 'Student',
                firstSessionDate: start ? formatDatePart(start, timeZone) : '',
                firstSessionTime: start ? formatTimePart(start, timeZone) : '',
                frequency: humanizeBookingFrequency(booking.frequency),
                meetingLink: firstLesson?.meeting_link || '',
                dashboardUrl,
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
                tutor: { select: { username: true, timezone: true } },
                booking: { select: { client_timezone: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const studentTimeZone = lesson.booking?.client_timezone || lesson.tutor?.timezone || 'UTC';
        await emailService.sendSessionReminderStudent({
            studentName: lesson.student?.username || 'Student',
            studentEmail: row.to_email,
            mentorName: lesson.tutor?.username || 'Mentor',
            sessionDate: formatDatePart(lesson.start_time, studentTimeZone),
            sessionTime: formatTimePart(lesson.start_time, studentTimeZone),
            meetingLink: lesson.meeting_link || '',
            dashboardUrl: `${clientBase}/student/sessions/${lesson.id}`,
            reminderType: row.payload?.reminderType === '4h' ? '4h' : '24h',
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
                tutor: { select: { username: true, timezone: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const timeZone = lesson.tutor?.timezone || 'UTC';
        await emailService.sendSessionReminderMentor({
            mentorName: lesson.tutor?.username || 'Mentor',
            mentorEmail: row.to_email,
            studentName: lesson.student?.username || 'Student',
            sessionDate: formatDatePart(lesson.start_time, timeZone),
            sessionTime: formatTimePart(lesson.start_time, timeZone),
            meetingLink: lesson.meeting_link || '',
            dashboardUrl: `${clientBase}/sessions/${lesson.id}`,
            reminderType: row.payload?.reminderType === '4h' ? '4h' : '24h',
        });

        return;
    }

    if (row.type === 'SESSION_RESCHEDULED_STUDENT') {
        const lessonId = row.payload?.lessonId as string | undefined;
        if (!lessonId) throw new Error('Missing lessonId in payload');

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                student: { select: { username: true } },
                tutor: { select: { username: true, timezone: true } },
                booking: { select: { client_timezone: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const studentTimeZone = (row.payload?.clientTimezone as string | undefined) || lesson.booking?.client_timezone || lesson.tutor?.timezone || 'UTC';
        const prevStartStudent = row.payload?.previousStart ? new Date(row.payload.previousStart as string) : null;
        await emailService.sendSessionRescheduledStudent({
            studentName: lesson.student?.username || 'Student',
            studentEmail: row.to_email,
            mentorName: lesson.tutor?.username || 'Mentor',
            previousDate: prevStartStudent ? formatDatePart(prevStartStudent, studentTimeZone) : '',
            previousTime: prevStartStudent ? formatTimePart(prevStartStudent, studentTimeZone) : '',
            sessionDate: formatDatePart(lesson.start_time, studentTimeZone),
            sessionTime: formatTimePart(lesson.start_time, studentTimeZone),
            meetingLink: lesson.meeting_link || '',
            dashboardUrl: `${clientBase}/student/sessions/${lesson.id}`,
        });

        return;
    }

    if (row.type === 'SESSION_RESCHEDULED_TUTOR') {
        const lessonId = row.payload?.lessonId as string | undefined;
        if (!lessonId) throw new Error('Missing lessonId in payload');

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                student: { select: { username: true } },
                tutor: { select: { username: true, timezone: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const timeZone = lesson.tutor?.timezone || 'UTC';
        const prevStartTutor = row.payload?.previousStart ? new Date(row.payload.previousStart as string) : null;
        await emailService.sendSessionRescheduledMentor({
            mentorName: lesson.tutor?.username || 'Mentor',
            mentorEmail: row.to_email,
            studentName: lesson.student?.username || 'Student',
            previousDate: prevStartTutor ? formatDatePart(prevStartTutor, timeZone) : '',
            previousTime: prevStartTutor ? formatTimePart(prevStartTutor, timeZone) : '',
            sessionDate: formatDatePart(lesson.start_time, timeZone),
            sessionTime: formatTimePart(lesson.start_time, timeZone),
            meetingLink: lesson.meeting_link || '',
            dashboardUrl: `${clientBase}/sessions/${lesson.id}`,
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
                        tutor: { select: { username: true, timezone: true } },
                        lessons: {
                            orderBy: { start_time: 'asc' },
                            select: { id: true, start_time: true },
                        },
                    },
                },
            },
        });

        if (!payment) throw new Error(`Payment not found: ${paymentId}`);

        const timeZone = payment.booking.tutor?.timezone || 'UTC';
        const amountDollars = Number(payment.amount).toFixed(2);

        // Find the lesson that matches this payment schedule's due_date (due_date = lesson.start_time - 48h)
        const expectedStart = new Date(payment.due_date.getTime() + 48 * 60 * 60 * 1000);
        const matchedLesson = payment.booking.lessons.find((l) => {
            return Math.abs(l.start_time.getTime() - expectedStart.getTime()) < 2 * 60 * 60 * 1000;
        });

        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const paymentLink = matchedLesson
            ? `${clientBase}/student/sessions/${matchedLesson.id}`
            : `${clientBase}/student/sessions`;

        await emailService.sendPaymentDueReminder({
            studentName: payment.booking.student?.username || 'Student',
            studentEmail: row.to_email,
            tutorName: payment.booking.tutor?.username || 'Mentor',
            amount: `$${amountDollars}`,
            dueDate: formatDatePart(payment.due_date, timeZone),
            paymentLink,
            sessionDate: matchedLesson ? formatDatePart(matchedLesson.start_time, timeZone) : undefined,
            sessionTime: matchedLesson ? formatTimePart(matchedLesson.start_time, timeZone) : undefined,
        });

        return;
    }

    if (row.type === 'SESSION_CANCELLED_UNPAID_STUDENT') {
        const lessonId = row.payload?.lessonId as string | undefined;
        if (!lessonId) throw new Error('Missing lessonId in payload');

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                student: { select: { username: true } },
                tutor: { select: { username: true, timezone: true } },
                booking: { select: { client_timezone: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        const clientBase = (process.env.CLIENT_URL || process.env.CLIENT_BASE_URL || 'https://emplearnings.com').trim().replace(/\/+$/, '');
        const timeZone = lesson.booking?.client_timezone || lesson.tutor?.timezone || 'UTC';
        const amountDollars = Number(row.payload?.amount || 0).toFixed(2);

        await emailService.sendStudentSessionCancelledUnpaid({
            studentName: lesson.student?.username || 'Student',
            studentEmail: row.to_email,
            mentorName: lesson.tutor?.username || 'Mentor',
            sessionDate: formatDatePart(lesson.start_time, timeZone),
            sessionTime: formatTimePart(lesson.start_time, timeZone),
            amount: `$${amountDollars}`,
            dashboardUrl: `${clientBase}/student/sessions`,
        });
        return;
    }

    if (row.type === 'SESSION_CANCELLED_UNPAID_TUTOR') {
        const lessonId = row.payload?.lessonId as string | undefined;
        if (!lessonId) throw new Error('Missing lessonId in payload');

        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                student: { select: { username: true } },
                tutor: { select: { username: true, timezone: true } },
            },
        });

        if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

        const timeZone = lesson.tutor?.timezone || 'UTC';
        const studentName = (row.payload?.studentName as string | undefined) || lesson.student?.username || 'A student';

        await emailService.sendMentorSessionCancelledUnpaid({
            mentorName: lesson.tutor?.username || 'Mentor',
            mentorEmail: row.to_email,
            studentName,
            sessionDate: formatDatePart(lesson.start_time, timeZone),
            sessionTime: formatTimePart(lesson.start_time, timeZone),
            timezone: timeZone,
        });
        return;
    }

    if (row.type === 'SESSION_PAYMENT_CONFIRMED_STUDENT') {
        const p = row.payload as { tutorName?: string; studentName?: string; lessonStart?: string; lessonId?: string; amount?: number };
        const lessonStart = p.lessonStart ? new Date(p.lessonStart) : null;
        const amountDollars = p.amount ? Number(p.amount).toFixed(2) : '0.00';

        let studentTimeZone = 'UTC';
        if (p.lessonId) {
            const lesson = await prisma.lesson.findUnique({
                where: { id: p.lessonId },
                select: { booking: { select: { client_timezone: true } } },
            });
            studentTimeZone = lesson?.booking?.client_timezone || 'UTC';
        }

        await emailService.sendEmail({
            to: row.to_email,
            subject: 'Payment Confirmed for Upcoming Session',
            html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#222">
  <h2 style="color:#4A1D96;margin:0 0 16px 0">Payment Confirmed</h2>
  <p style="margin:0 0 12px 0">Hi ${p.studentName || 'there'},</p>
  <p style="margin:0 0 12px 0">Your payment of <strong>$${amountDollars}</strong> has been successfully received for your upcoming session with <strong>${p.tutorName || 'your mentor'}</strong>.</p>
  ${lessonStart ? `<p style="margin:0 0 12px 0">📅 Session: <strong>${formatDatePart(lessonStart, studentTimeZone)} at ${formatTimePart(lessonStart, studentTimeZone)}</strong></p>` : ''}
  <p style="margin:0 0 24px 0">The session is fully confirmed. See you then!</p>
  <p style="margin:0;color:#999;font-size:12px">Team EmpowerEd Learnings</p>
</div>`,
        });
        return;
    }

    if (row.type === 'SESSION_PAYMENT_CONFIRMED_TUTOR') {
        const p = row.payload as { tutorName?: string; studentName?: string; lessonStart?: string; amount?: number; timezone?: string };
        const lessonStart = p.lessonStart ? new Date(p.lessonStart) : null;
        const timeZone = p.timezone || 'UTC';
        await emailService.sendMentorPaymentReceived({
            mentorName: p.tutorName || 'Mentor',
            mentorEmail: row.to_email,
            studentName: p.studentName || 'Student',
            sessionDate: lessonStart ? formatDatePart(lessonStart, timeZone) : '—',
            sessionTime: lessonStart ? formatTimePart(lessonStart, timeZone) : '—',
        });
        return;
    }

    if (row.type === 'BETA_ENDING_REMINDER') {
        const p = row.payload as { tutorName?: string };
        await emailService.sendBetaEndingReminder({
            tutorName: p.tutorName || 'there',
            email: row.to_email,
        });
        return;
    }

    if (row.type === 'SUBSCRIPTION_ACTIVATED') {
        const p = row.payload as { mentorName?: string; planName?: string; amount?: string; nextBillingDate?: string; dashboardUrl?: string };
        await emailService.sendEmail({
            to: row.to_email,
            subject: `Your ${p.planName || 'Subscription'} Plan is Now Active`,
            html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#222">
  <h2 style="color:#7c3aed;margin:0 0 16px 0">🎉 Your ${p.planName || 'Subscription'} Plan is Active</h2>
  <p style="margin:0 0 12px 0">Hi <strong>${p.mentorName || 'there'}</strong>,</p>
  <p style="margin:0 0 12px 0">Your <strong>${p.planName || 'subscription'}</strong> is now active.</p>
  <div style="background:#f5f3ff;border-radius:8px;padding:16px;margin:0 0 20px 0">
    <p style="margin:0 0 8px 0;font-size:14px;color:#4c1d95">💳 <strong>Plan:</strong> ${p.planName || '—'}</p>
    <p style="margin:0 0 8px 0;font-size:14px;color:#4c1d95">💰 <strong>Amount Paid:</strong> ${p.amount || '—'}</p>
    <p style="margin:0;font-size:14px;color:#4c1d95">📅 <strong>Next Billing Date:</strong> ${p.nextBillingDate || '—'}</p>
  </div>
  <p style="margin:0 0 24px 0">You now have full access to all <strong>${p.planName || 'plan'}</strong> features. Log in to your dashboard to get started.</p>
  <p style="margin:0;color:#999;font-size:12px">Team EmpowerEd Learnings</p>
</div>`,
        });
        return;
    }

    if (row.type === 'SUBSCRIPTION_RENEWED') {
        const p = row.payload as { mentorName?: string; planName?: string; amount?: string; periodStart?: string; periodEnd?: string; dashboardUrl?: string };
        await emailService.sendEmail({
            to: row.to_email,
            subject: `Your ${p.planName || 'Subscription'} Has Been Renewed`,
            html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#222">
  <h2 style="color:#059669;margin:0 0 16px 0">✅ Subscription Renewed</h2>
  <p style="margin:0 0 12px 0">Hi <strong>${p.mentorName || 'there'}</strong>,</p>
  <p style="margin:0 0 12px 0">Your <strong>${p.planName || 'subscription'}</strong> has been successfully renewed.</p>
  <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:0 0 20px 0">
    <p style="margin:0 0 8px 0;font-size:14px;color:#166534">💳 <strong>Plan:</strong> ${p.planName || '—'}</p>
    <p style="margin:0 0 8px 0;font-size:14px;color:#166534">💰 <strong>Amount Charged:</strong> ${p.amount || '—'}</p>
    <p style="margin:0 0 8px 0;font-size:14px;color:#166534">📅 <strong>Period:</strong> ${p.periodStart || '—'} – ${p.periodEnd || '—'}</p>
    <p style="margin:0;font-size:14px;color:#166534">🔄 <strong>Next Renewal:</strong> ${p.periodEnd || '—'}</p>
  </div>
  <p style="margin:0 0 24px 0">Your access continues uninterrupted. Thank you for staying with EmpowerEd Learnings!</p>
  <p style="margin:0;color:#999;font-size:12px">Team EmpowerEd Learnings</p>
</div>`,
        });
        return;
    }

    if (row.type === 'STUDENT_PAYMENT_RECEIPT') {
        const p = row.payload as { studentName?: string; tutorName?: string; sessionDate?: string; sessionTime?: string; amount?: string; paymentDate?: string; dashboardUrl?: string };
        await emailService.sendStudentPaymentReceipt({
            studentName: p.studentName || 'Student',
            studentEmail: row.to_email,
            tutorName: p.tutorName || 'Mentor',
            sessionDate: p.sessionDate || '—',
            sessionTime: p.sessionTime || '—',
            amount: p.amount || '—',
            paymentDate: p.paymentDate || '—',
            dashboardUrl: p.dashboardUrl,
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

    if (row.type === 'DEMO_CALL_REMINDER_MENTOR') {
        const demoBookingId = row.payload?.demoBookingId as string | undefined;
        if (!demoBookingId) throw new Error('Missing demoBookingId in payload');

        const demoBooking = await prisma.demoBooking.findUnique({
            where: { id: demoBookingId },
        });

        if (!demoBooking) throw new Error(`DemoBooking not found: ${demoBookingId}`);

        const timeZone = demoBooking.timezone || 'America/Chicago';
        await emailService.sendDemoCallReminder({
            mentorName: demoBooking.full_name,
            mentorEmail: row.to_email,
            callDate: formatDatePart(demoBooking.slot_start_time, timeZone),
            callTime: formatTimePart(demoBooking.slot_start_time, timeZone),
            meetingLink: demoBooking.meeting_link || '',
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
