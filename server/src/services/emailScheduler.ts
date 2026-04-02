import prisma from '../config/db';

const SCHEDULER_ENABLED = (process.env.EMAIL_SCHEDULER_ENABLED || 'true').toLowerCase() !== 'false';
const SCHEDULER_INTERVAL_MS = Number(process.env.EMAIL_SCHEDULER_INTERVAL_MS || 3600000); // 1 hour
const SESSION_REMINDER_HOURS = Number(process.env.SESSION_REMINDER_HOURS || 24);
const PAYMENT_REMINDER_HOURS = Number(process.env.PAYMENT_REMINDER_HOURS || 24); // final nudge (default 24h before due_date)
const PAYMENT_EARLY_REMINDER_HOURS = Number(process.env.PAYMENT_EARLY_REMINDER_HOURS || 168); // early reminder (default 7 days before session)

let schedulerInterval: NodeJS.Timeout | null = null;

async function checkSessionReminders() {
    try {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + SESSION_REMINDER_HOURS * 60 * 60 * 1000);
        const windowEnd = new Date(reminderTime.getTime() + 60 * 60 * 1000); // 1-hour window

        const upcomingLessons = await prisma.lesson.findMany({
            where: {
                status: 'BOOKED',
                start_time: {
                    gte: reminderTime,
                    lte: windowEnd,
                },
            },
            include: {
                student: {
                    include: {
                        user: { select: { email: true } },
                    },
                },
                tutor: {
                    include: {
                        user: { select: { email: true } },
                    },
                },
            },
        });

        for (const lesson of upcomingLessons) {
            // Student reminder
            if (lesson.student.user.email) {
                try {
                    await prisma.emailOutbox.create({
                        data: {
                            type: 'SESSION_REMINDER_STUDENT',
                            to_email: lesson.student.user.email,
                            payload: { lessonId: lesson.id },
                            idempotency_key: `session-reminder-student:${lesson.id}`,
                        },
                    });
                    console.log(`[EmailScheduler] Queued session reminder for student: ${lesson.student.user.email}`);
                } catch (e: any) {
                    if (e.code !== 'P2002') {
                        console.error(`[EmailScheduler] Failed to queue student reminder:`, e);
                    }
                }
            }

            // Tutor reminder
            if (lesson.tutor.user.email) {
                try {
                    await prisma.emailOutbox.create({
                        data: {
                            type: 'SESSION_REMINDER_TUTOR',
                            to_email: lesson.tutor.user.email,
                            payload: { lessonId: lesson.id },
                            idempotency_key: `session-reminder-tutor:${lesson.id}`,
                        },
                    });
                    console.log(`[EmailScheduler] Queued session reminder for tutor: ${lesson.tutor.user.email}`);
                } catch (e: any) {
                    if (e.code !== 'P2002') {
                        console.error(`[EmailScheduler] Failed to queue tutor reminder:`, e);
                    }
                }
            }
        }

        if (upcomingLessons.length > 0) {
            console.log(`[EmailScheduler] Processed ${upcomingLessons.length} session reminders`);
        }
    } catch (error) {
        console.error('[EmailScheduler] Error checking session reminders:', error);
    }
}

async function queuePaymentRemindersForWindow(hoursAhead: number, idempotencyPrefix: string) {
    const now = new Date();
    // For early reminder: fire when session start_time is ~hoursAhead away.
    // due_date = start_time - 48h, so look for due_date ~(hoursAhead - 48h) away.
    const dueLookup = new Date(now.getTime() + (hoursAhead - 48) * 60 * 60 * 1000);
    const windowEnd = new Date(dueLookup.getTime() + 60 * 60 * 1000); // 1-hour window

    const upcomingPayments = await prisma.paymentSchedule.findMany({
        where: {
            status: 'pending',
            due_date: {
                gte: dueLookup,
                lte: windowEnd,
            },
        },
        include: {
            booking: {
                include: {
                    student: {
                        include: {
                            user: { select: { email: true } },
                        },
                    },
                    tutor: {
                        select: { username: true },
                    },
                },
            },
        },
    });

    for (const payment of upcomingPayments) {
        if (payment.booking.student.user.email) {
            try {
                await prisma.emailOutbox.create({
                    data: {
                        type: 'PAYMENT_DUE_REMINDER',
                        to_email: payment.booking.student.user.email,
                        payload: {
                            paymentId: payment.id,
                            bookingId: payment.booking_id,
                            amount: payment.amount,
                            dueDate: payment.due_date.toISOString(),
                        },
                        idempotency_key: `${idempotencyPrefix}:${payment.id}`,
                    },
                });
                console.log(`[EmailScheduler] Queued payment reminder (${idempotencyPrefix}) for: ${payment.booking.student.user.email}`);
            } catch (e: any) {
                if (e.code !== 'P2002') {
                    console.error(`[EmailScheduler] Failed to queue payment reminder (${idempotencyPrefix}):`, e);
                }
            }
        }
    }

    return upcomingPayments.length;
}

async function checkPaymentReminders() {
    try {
        // Final nudge: fires ~PAYMENT_REMINDER_HOURS (24h) before due_date (72h before session)
        const finalCount = await queuePaymentRemindersForWindow(
            PAYMENT_REMINDER_HOURS + 48,
            'payment-reminder'
        );

        // Early reminder: fires ~PAYMENT_EARLY_REMINDER_HOURS (168h = 7 days) before session start
        const earlyCount = await queuePaymentRemindersForWindow(
            PAYMENT_EARLY_REMINDER_HOURS,
            'payment-early-reminder'
        );

        if (finalCount + earlyCount > 0) {
            console.log(`[EmailScheduler] Processed ${finalCount} final + ${earlyCount} early payment reminders`);
        }
    } catch (error) {
        console.error('[EmailScheduler] Error checking payment reminders:', error);
    }
}

async function runScheduler() {
    console.log('[EmailScheduler] Running scheduled check...');
    await Promise.all([checkSessionReminders(), checkPaymentReminders()]);
}

export function startEmailScheduler() {
    if (!SCHEDULER_ENABLED) {
        console.log('[EmailScheduler] Scheduler disabled by EMAIL_SCHEDULER_ENABLED=false');
        return;
    }

    if (schedulerInterval) {
        console.log('[EmailScheduler] Scheduler already running');
        return;
    }

    console.log(`[EmailScheduler] Starting scheduler (interval=${SCHEDULER_INTERVAL_MS}ms, sessionReminder=${SESSION_REMINDER_HOURS}h, paymentReminder=${PAYMENT_REMINDER_HOURS}h, earlyPaymentReminder=${PAYMENT_EARLY_REMINDER_HOURS}h)`);

    // Run immediately on startup
    runScheduler();

    // Then run on interval
    schedulerInterval = setInterval(runScheduler, SCHEDULER_INTERVAL_MS);
}

export function stopEmailScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('[EmailScheduler] Scheduler stopped');
    }
}
