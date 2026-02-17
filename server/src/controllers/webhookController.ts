import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import prisma from '../config/db';
import { isTutorSlotAvailable } from '../services/availability';
import { createMeetEventForLesson } from '../services/googleCalendar';

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
        return res.status(400).send('Missing signature or secret');
    }

    let event;

    try {
        // Use raw body (needs express.raw() middleware in route)
        event = StripeService.constructEvent(req.body, sig as string, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Log event (optional, for debugging)
    console.log(`[Stripe Webhook] Received event: ${event.type}`);
    // await prisma.stripeEvent.create({ data: { id: event.id, type: event.type, data: event.data.object as any } });

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;
            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Return 200 to Stripe to avoid retries if it's an application error? 
        // Or 500 to retry? Usually 200 if we caught it and don't want strict retry logic yet.
        // For now, allow retry on fail.
        return res.status(500).send('Processing error');
    }

    res.json({ received: true });
};

async function handlePaymentIntentSucceeded(paymentIntent: any) {
    const piId = paymentIntent?.id as string | undefined;
    if (!piId) return;

    // If your Stripe webhook isn't configured to send `checkout.session.completed`,
    // reconcile the booking by finding the associated Checkout Session.
    const session = await StripeService.getCheckoutSessionByPaymentIntent(piId);
    if (!session) {
        console.warn(`[Stripe Webhook] payment_intent.succeeded ${piId} has no related checkout session.`);
        return;
    }

    await handleCheckoutSessionCompleted(session);
}

async function handleCheckoutSessionCompleted(session: any) {
    console.log(`[Stripe Webhook] Processing checkout.session.completed: ${session.id}`);
    const metadata = session.metadata;
    console.log('[Stripe Webhook] Metadata:', metadata);
    if (!metadata) {
        console.warn('[Stripe Webhook] No metadata found in session');
        return;
    }

    if (metadata.type === 'mentor_subscription') {
        const { tutorId, tier } = metadata as { tutorId?: string; tier?: string };
        const subscriptionId = session.subscription as string | null;

        console.log(`[Stripe Webhook] Mentor Subscription flow. TutorID: ${tutorId}, Tier: ${tier}, SubID: ${subscriptionId}`);

        if (!tutorId || !subscriptionId) {
            console.error('[Stripe Webhook] Missing tutorId or subscriptionId');
            return;
        }

        const subscription = await StripeService.getSubscription(subscriptionId);
        const trialEnd = (subscription as any).trial_end as number | null;
        const currentPeriodEnd = (subscription as any).current_period_end as number | null;
        const endEpoch = trialEnd || currentPeriodEnd;

        await prisma.tutorProfile.update({
            where: { id: tutorId },
            data: {
                stripe_subscription_id: subscriptionId,
                subscription_status: (subscription as any).status || 'active',
                subscription_end_date: endEpoch ? new Date(endEpoch * 1000) : undefined,
                tier: (tier === 'STANDARD' || tier === 'PRO' || tier === 'PREMIUM') ? (tier as any) : undefined,
            }
        });
        console.log(`[Stripe Webhook] Successfully updated TutorProfile ${tutorId} for subscription.`);
    } else if (metadata.type === 'student_booking_payment') {
        const paymentScheduleId = metadata.paymentScheduleId as string | undefined;
        if (!paymentScheduleId) {
            console.error('[Stripe Webhook] Missing paymentScheduleId for student_booking_payment');
            return;
        }

        const amountTotal = session.amount_total as number | null;
        await prisma.paymentSchedule.update({
            where: { id: paymentScheduleId },
            data: {
                status: 'paid',
                stripe_pi_id: session.payment_intent as string,
                // store the amount paid in whole currency units if Stripe provides it
                ...(amountTotal && !Number.isNaN(amountTotal) ? { amount: Math.round(amountTotal / 100) } : {}),
            },
        });
        console.log(`[Stripe Webhook] Marked PaymentSchedule ${paymentScheduleId} as paid.`);
    } else if (metadata.type === 'student_booking') {
        // Handle Student Booking payment success -> create Booking + Lessons atomically
        const paymentIntentId = session.payment_intent as string | null;
        if (paymentIntentId) {
            const existing = await prisma.paymentSchedule.findFirst({
                where: {
                    stripe_pi_id: paymentIntentId,
                },
                select: { id: true },
            });
            if (existing) {
                console.log(`[Stripe Webhook] student_booking already processed for PI ${paymentIntentId}. Skipping.`);
                return;
            }
        }

        const tutorId = metadata.tutorId as string;
        const studentId = metadata.studentId as string;
        const frequency = metadata.frequency as 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY';
        const durationMinutes = Number(metadata.durationMinutes || 60);

        let slotStarts: string[] = [];
        try {
            slotStarts = JSON.parse(metadata.slotStarts || '[]');
        } catch {
            console.error('Invalid slotStarts metadata in student_booking');
            return;
        }

        if (!tutorId || !studentId || !frequency || !Array.isArray(slotStarts) || slotStarts.length === 0) {
            console.error('Missing required metadata for student_booking');
            return;
        }

        const requiredWeeklySlotsForFrequency = (f: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY') => {
            if (f === 'TWICE_WEEKLY') return 2;
            if (f === 'THRICE_WEEKLY') return 3;
            return 1;
        };

        const requiredSlots = requiredWeeklySlotsForFrequency(frequency);
        if (frequency !== 'ONCE' && slotStarts.length !== requiredSlots) {
            console.error('Slot count does not match frequency for student_booking');
            return;
        }

        const starts = slotStarts
            .map((s) => new Date(s))
            .filter((d) => !Number.isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        if (starts.length !== slotStarts.length) {
            console.error('One or more slotStarts invalid in student_booking');
            return;
        }

        const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);
        const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

        const bookingStart = starts[0];
        const bookingEnd = frequency === 'ONCE'
            ? addMinutes(bookingStart, durationMinutes)
            : addDays(bookingStart, 28);

        const lessonsToCreate: Array<{ start: Date; end: Date }> = [];

        if (frequency === 'ONCE') {
            const s = bookingStart;
            lessonsToCreate.push({ start: s, end: addMinutes(s, durationMinutes) });
        } else {
            for (const baseStart of starts) {
                for (let week = 0; week < 4; week++) {
                    const s = addDays(baseStart, week * 7);
                    const e = addMinutes(s, durationMinutes);
                    lessonsToCreate.push({ start: s, end: e });
                }
            }
        }

        lessonsToCreate.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Ensure tutor & student still exist
        const tutor = await prisma.tutorProfile.findUnique({ where: { id: tutorId } });
        const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
        if (!tutor || !student) {
            console.error('Tutor or student not found for student_booking');
            return;
        }

        // Create Booking, Lessons and PaymentSchedule inside a transaction
        const result = await prisma.$transaction(async (tx) => {
            const createdBooking = await tx.booking.create({
                data: {
                    student_id: student.id,
                    tutor_id: tutorId,
                    start_date: bookingStart,
                    end_date: bookingEnd,
                    frequency,
                    status: 'active',
                },
            });

            const createdLessons = await Promise.all(
                lessonsToCreate.map((l, idx) =>
                    tx.lesson.create({
                        data: {
                            tutor_id: tutorId,
                            student_id: student.id,
                            booking_id: createdBooking.id,
                            start_time: l.start,
                            end_time: l.end,
                            duration: durationMinutes,
                            status: 'BOOKED',
                            billing_type: 'PAID',
                        },
                    })
                )
            );

            // Payment schedule:
            // - First lesson is paid immediately by this Checkout Session
            // - Remaining lessons are due 48 hours before start
            const amountTotal = session.amount_total as number | null;
            const paidAmount = amountTotal && !Number.isNaN(amountTotal) ? Math.round(amountTotal / 100) : tutor.hourly_rate;

            const scheduleRows = createdLessons.map((lesson, idx) => {
                const dueDate = new Date(lesson.start_time.getTime() - 48 * 60 * 60 * 1000);
                if (idx === 0) {
                    return {
                        booking_id: createdBooking.id,
                        amount: paidAmount,
                        due_date: dueDate,
                        status: 'paid',
                        stripe_pi_id: session.payment_intent as string,
                    };
                }
                return {
                    booking_id: createdBooking.id,
                    amount: tutor.hourly_rate,
                    due_date: dueDate,
                    status: 'pending',
                };
            });

            if (scheduleRows.length > 0) {
                await tx.paymentSchedule.createMany({ data: scheduleRows });
            }

            return { createdBooking, createdLessons };
        });

        // Try to create Google Calendar event for first lesson (non-fatal if fails)
        try {
            const firstLesson = result.createdLessons[0];
            if (!firstLesson) return;

            const studentUser = await prisma.user.findUnique({ where: { id: (await prisma.user.findFirst({ where: { student_profile: { id: studentId } } }))?.id } });
            const tutorUser = await prisma.user.findUnique({ where: { id: tutor.user_id } });

            const attendeesEmails = [studentUser?.email, tutorUser?.email].filter(Boolean) as string[];

            const event = await createMeetEventForLesson({
                tutorId,
                lessonId: firstLesson.id,
                title: `Mentoring Session with ${tutor.username}`,
                description: 'Scheduled via Empowered Learnings',
                start: firstLesson.start_time,
                end: firstLesson.end_time,
                attendeesEmails,
            });

            if (event?.eventId || event?.meetLink || event?.htmlLink) {
                await prisma.lesson.update({
                    where: { id: firstLesson.id },
                    data: {
                        meeting_link: event.meetLink || undefined,
                        google_calendar_event_id: event.eventId || undefined,
                        google_calendar_html_link: event.htmlLink || undefined,
                    },
                });
            }
        } catch (e) {
            console.error('Calendar event creation for student_booking failed (non-fatal):', e);
        }
    }
}

async function handleInvoicePaid(invoice: any) {
    // Handle Recurring Payments success
    console.log('[Stripe Webhook] Invoice Object:', JSON.stringify(invoice, null, 2));

    let subscriptionId = invoice.subscription;

    // Fallback search for subscription ID (newer Stripe API versions nest it)
    if (!subscriptionId && invoice.parent?.subscription_details?.subscription) {
        subscriptionId = invoice.parent.subscription_details.subscription;
    }

    // Checking lines if still not found
    if (!subscriptionId && invoice.lines?.data?.[0]?.subscription) {
        subscriptionId = invoice.lines.data[0].subscription;
    }

    console.log(`[Stripe Webhook] Invoice Paid for subscription: ${subscriptionId}`);

    if (!subscriptionId) {
        console.warn('[Stripe Webhook] invoice.paid received without subscription id. Skipping.');
        return;
    }

    // Check if it's a mentor
    const tutor = await prisma.tutorProfile.findFirst({ where: { stripe_subscription_id: subscriptionId } });
    if (tutor) {
        const linePeriodEnd = invoice?.lines?.data?.[0]?.period?.end as number | undefined;
        await prisma.tutorProfile.update({
            where: { id: tutor.id },
            data: {
                subscription_status: 'active',
                subscription_end_date: linePeriodEnd ? new Date(linePeriodEnd * 1000) : undefined
            }
        });
        console.log(`[Stripe Webhook] Updated subscription for Tutor ${tutor.id}`);
    } else {
        // If checkout.session.completed didn't run (or ran late), reconcile from Subscription metadata.
        try {
            const subscription = await StripeService.getSubscription(subscriptionId);
            const metadata = (subscription as any)?.metadata as Record<string, string> | undefined;
            const metaTutorId = metadata?.tutorId;
            const metaTier = metadata?.tier;

            const trialEnd = (subscription as any).trial_end as number | null;
            const currentPeriodEnd = (subscription as any).current_period_end as number | null;
            const endEpoch = trialEnd || currentPeriodEnd;

            if (metaTutorId) {
                await prisma.tutorProfile.update({
                    where: { id: metaTutorId },
                    data: {
                        stripe_subscription_id: subscriptionId,
                        subscription_status: (subscription as any).status || 'active',
                        subscription_end_date: endEpoch ? new Date(endEpoch * 1000) : undefined,
                        tier: (metaTier === 'STANDARD' || metaTier === 'PRO' || metaTier === 'PREMIUM') ? (metaTier as any) : undefined,
                    },
                });
                console.log(`[Stripe Webhook] Reconciled TutorProfile ${metaTutorId} from invoice.paid via subscription metadata.`);
                return;
            }

            // Fallback: try mapping by email if metadata is missing.
            const customerEmail = invoice.customer_email as string | undefined;
            if (customerEmail) {
                const tutorByEmail = await prisma.tutorProfile.findFirst({
                    where: {
                        user: {
                            email: customerEmail,
                        },
                    },
                });

                if (tutorByEmail) {
                    await prisma.tutorProfile.update({
                        where: { id: tutorByEmail.id },
                        data: {
                            stripe_subscription_id: subscriptionId,
                            subscription_status: (subscription as any).status || 'active',
                            subscription_end_date: endEpoch ? new Date(endEpoch * 1000) : undefined,
                        },
                    });
                    console.log(`[Stripe Webhook] Reconciled TutorProfile ${tutorByEmail.id} from invoice.paid via customer_email.`);
                    return;
                }
            }

            console.warn(`[Stripe Webhook] No Tutor found for subscription ${subscriptionId}. Missing metadata and no email match.`);
        } catch (e) {
            console.warn(`[Stripe Webhook] No Tutor found with subscription ID: ${subscriptionId}. This is expected for the first invoice if 'checkout.session.completed' hasn't processed yet, OR if the subscription was created manually without metadata.`);
            console.error('[Stripe Webhook] invoice.paid reconcile failed:', e);
        }
    }

    // Check if it's a student (if we implemented student subscriptions)
}

async function handleSubscriptionDeleted(subscription: any) {
    // Handle Cancellation
    const subscriptionId = subscription.id;

    const tutor = await prisma.tutorProfile.findFirst({ where: { stripe_subscription_id: subscriptionId } });
    if (tutor) {
        await prisma.tutorProfile.update({
            where: { id: tutor.id },
            data: { subscription_status: 'canceled' }
        });
    }
}
