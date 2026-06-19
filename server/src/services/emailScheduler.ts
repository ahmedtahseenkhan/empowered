import prisma from '../config/db';

const SCHEDULER_ENABLED = (process.env.EMAIL_SCHEDULER_ENABLED || 'true').toLowerCase() !== 'false';
const SCHEDULER_INTERVAL_MS = Number(process.env.EMAIL_SCHEDULER_INTERVAL_MS || 3600000); // 1 hour
const SESSION_REMINDER_HOURS = Number(process.env.SESSION_REMINDER_HOURS || 24);
const DEMO_REMINDER_HOURS = Number(process.env.DEMO_REMINDER_HOURS || 6);
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
                            payload: { lessonId: lesson.id, reminderType: '24h' },
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
                            payload: { lessonId: lesson.id, reminderType: '24h' },
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

async function check4HourSessionReminders() {
    try {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);
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
                student: { include: { user: { select: { email: true } } } },
                tutor: { include: { user: { select: { email: true } } } },
            },
        });

        for (const lesson of upcomingLessons) {
            // Student 4h reminder
            if (lesson.student.user.email) {
                try {
                    await prisma.emailOutbox.create({
                        data: {
                            type: 'SESSION_REMINDER_STUDENT',
                            to_email: lesson.student.user.email,
                            payload: { lessonId: lesson.id, reminderType: '4h' },
                            idempotency_key: `session-reminder-4h-student:${lesson.id}`,
                        },
                    });
                    console.log(`[EmailScheduler] Queued 4h session reminder for student: ${lesson.student.user.email}`);
                } catch (e: any) {
                    if (e.code !== 'P2002') console.error(`[EmailScheduler] Failed to queue 4h student reminder:`, e);
                }
            }

            // Tutor 4h reminder
            if (lesson.tutor.user.email) {
                try {
                    await prisma.emailOutbox.create({
                        data: {
                            type: 'SESSION_REMINDER_TUTOR',
                            to_email: lesson.tutor.user.email,
                            payload: { lessonId: lesson.id, reminderType: '4h' },
                            idempotency_key: `session-reminder-4h-tutor:${lesson.id}`,
                        },
                    });
                    console.log(`[EmailScheduler] Queued 4h session reminder for tutor: ${lesson.tutor.user.email}`);
                } catch (e: any) {
                    if (e.code !== 'P2002') console.error(`[EmailScheduler] Failed to queue 4h tutor reminder:`, e);
                }
            }
        }

        if (upcomingLessons.length > 0) {
            console.log(`[EmailScheduler] Processed ${upcomingLessons.length} 4h session reminders`);
        }
    } catch (error) {
        console.error('[EmailScheduler] Error checking 4h session reminders:', error);
    }
}

async function checkDemoCallReminders() {
    try {
        const now = new Date();
        const reminderTime = new Date(now.getTime() + DEMO_REMINDER_HOURS * 60 * 60 * 1000);
        const windowEnd = new Date(reminderTime.getTime() + 60 * 60 * 1000); // 1-hour window

        const upcomingDemos = await prisma.demoBooking.findMany({
            where: {
                slot_start_time: {
                    gte: reminderTime,
                    lte: windowEnd,
                },
            },
        });

        for (const demo of upcomingDemos) {
            try {
                await prisma.emailOutbox.create({
                    data: {
                        type: 'DEMO_CALL_REMINDER_MENTOR',
                        to_email: demo.email,
                        payload: { demoBookingId: demo.id },
                        idempotency_key: `demo-call-reminder-mentor:${demo.id}`,
                    },
                });
                console.log(`[EmailScheduler] Queued demo call reminder for: ${demo.email}`);
            } catch (e: any) {
                if (e.code !== 'P2002') {
                    console.error(`[EmailScheduler] Failed to queue demo call reminder:`, e);
                }
            }
        }

        if (upcomingDemos.length > 0) {
            console.log(`[EmailScheduler] Processed ${upcomingDemos.length} demo call reminders`);
        }
    } catch (error) {
        console.error('[EmailScheduler] Error checking demo call reminders:', error);
    }
}

// Auto-cancel lessons whose payment is still pending 24 h before start time.
// Queries lessons directly so each lesson is matched to its own PaymentSchedule only.
// Previous bug: querying via PaymentSchedule→booking incorrectly marked ALL pending payments
// in a booking as failed when only one lesson was within the 24h window.
async function autoCancelUnpaidLessons() {
    try {
        const now = new Date();
        const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 h from now

        // Find BOOKED paid lessons that start within the next 24 h
        const dueLessons = await prisma.lesson.findMany({
            where: {
                status: 'BOOKED',
                billing_type: 'PAID',
                start_time: {
                    gte: now,
                    lte: cutoff,
                },
            },
            include: {
                student: { include: { user: { select: { email: true } } } },
                tutor: { include: { user: { select: { email: true } } } },
            },
        });

        let cancelledCount = 0;

        for (const lesson of dueLessons) {
            if (!lesson.booking_id) continue;

            // Find the PaymentSchedule that belongs to THIS specific lesson.
            // due_date is set to start_time - 48h with a ±2h tolerance window.
            const dueDate = new Date(lesson.start_time.getTime() - 48 * 60 * 60 * 1000);
            const schedule = await prisma.paymentSchedule.findFirst({
                where: {
                    booking_id: lesson.booking_id,
                    status: 'pending',
                    due_date: {
                        gte: new Date(dueDate.getTime() - 2 * 60 * 60 * 1000),
                        lte: new Date(dueDate.getTime() + 2 * 60 * 60 * 1000),
                    },
                },
            });

            if (!schedule) continue; // Already paid or free — skip

            // Cancel only this lesson
            await prisma.lesson.update({
                where: { id: lesson.id },
                data: { status: 'CANCELLED' },
            });

            // Mark only this lesson's payment as failed
            await prisma.paymentSchedule.update({
                where: { id: schedule.id },
                data: { status: 'failed' },
            });

            // Notify student
            if (lesson.student.user.email) {
                try {
                    await prisma.emailOutbox.create({
                        data: {
                            type: 'SESSION_CANCELLED_UNPAID_STUDENT',
                            to_email: lesson.student.user.email,
                            payload: {
                                lessonId: lesson.id,
                                lessonStart: lesson.start_time.toISOString(),
                                amount: schedule.amount,
                            },
                            idempotency_key: `session-cancelled-unpaid-student:${lesson.id}`,
                        },
                    });
                } catch (e: any) {
                    if (e.code !== 'P2002') console.error('[EmailScheduler] Failed to queue cancellation email (student):', e);
                }
            }

            // Notify tutor
            if (lesson.tutor.user.email) {
                try {
                    await prisma.emailOutbox.create({
                        data: {
                            type: 'SESSION_CANCELLED_UNPAID_TUTOR',
                            to_email: lesson.tutor.user.email,
                            payload: {
                                lessonId: lesson.id,
                                lessonStart: lesson.start_time.toISOString(),
                                studentName: lesson.student.username || 'Student',
                            },
                            idempotency_key: `session-cancelled-unpaid-tutor:${lesson.id}`,
                        },
                    });
                } catch (e: any) {
                    if (e.code !== 'P2002') console.error('[EmailScheduler] Failed to queue cancellation email (tutor):', e);
                }
            }

            console.log(`[EmailScheduler] Auto-cancelled unpaid lesson ${lesson.id} (starts ${lesson.start_time.toISOString()})`);
            cancelledCount++;
        }

        if (cancelledCount > 0) {
            console.log(`[EmailScheduler] Auto-cancelled ${cancelledCount} unpaid lesson(s)`);
        }
    } catch (error) {
        console.error('[EmailScheduler] Error in autoCancelUnpaidLessons:', error);
    }
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

async function checkBetaEndingReminders() {
    try {
        const now = new Date();
        // Window: tutors whose beta (trialing) ends between 20h and 28h from now (catches a single scheduler tick per tutor)
        const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);

        const expiringTutors = await prisma.tutorProfile.findMany({
            where: {
                // Beta mentors have unlimited access — never warn them their access is ending.
                is_beta: false,
                subscription_status: 'trialing',
                subscription_end_date: {
                    gte: windowStart,
                    lte: windowEnd,
                },
            },
            include: {
                user: { select: { email: true } },
            },
        });

        for (const tutor of expiringTutors) {
            if (!tutor.user?.email) continue;
            try {
                await prisma.emailOutbox.create({
                    data: {
                        type: 'BETA_ENDING_REMINDER',
                        to_email: tutor.user.email,
                        payload: { tutorId: tutor.id, tutorName: tutor.username },
                        idempotency_key: `beta-ending-reminder:${tutor.id}:${tutor.subscription_end_date?.toISOString().slice(0, 10)}`,
                    },
                });
                console.log(`[EmailScheduler] Queued beta ending reminder for tutor ${tutor.id}`);
            } catch (e: any) {
                if (e.code !== 'P2002') console.error('[EmailScheduler] Failed to queue beta ending reminder:', e);
            }
        }
    } catch (error) {
        console.error('[EmailScheduler] Error in checkBetaEndingReminders:', error);
    }
}

async function runScheduler() {
    console.log('[EmailScheduler] Running scheduled check...');
    await Promise.all([
        checkSessionReminders(),
        check4HourSessionReminders(),
        checkDemoCallReminders(),
        checkPaymentReminders(),
        autoCancelUnpaidLessons(),
        checkBetaEndingReminders(),
    ]);
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

    console.log(`[EmailScheduler] Starting scheduler (interval=${SCHEDULER_INTERVAL_MS}ms, sessionReminder=${SESSION_REMINDER_HOURS}h, demoReminder=${DEMO_REMINDER_HOURS}h, paymentReminder=${PAYMENT_REMINDER_HOURS}h, earlyPaymentReminder=${PAYMENT_EARLY_REMINDER_HOURS}h)`);

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
