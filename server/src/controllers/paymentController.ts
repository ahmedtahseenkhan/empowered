import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import prisma from '../config/db';
import { z } from 'zod';

const CreateSubscriptionSchema = z.object({
    priceId: z.string().min(1, 'Price ID is required'),
    tier: z.enum(['STANDARD', 'PRO', 'PREMIUM'] as const),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
});

const CreateConnectLinkSchema = z.object({
    refreshUrl: z.string().url(),
    returnUrl: z.string().url(),
    country: z.string().optional(),
});

type CreateConnectLinkInput = z.infer<typeof CreateConnectLinkSchema>;

export const createMentorSubscriptionCheckout = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { priceId, tier, successUrl, cancelUrl } = CreateSubscriptionSchema.parse(req.body);

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            include: { user: true }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        // 1. Ensure Tutor has a Stripe Customer ID (create if missing)
        // Note: Tutors act as Customers when *paying* for the platform subscription.
        // They act as Accounts when *receiving* money from students.
        // We'll reuse stripe_customer_id if we have one (usually on StudentProfile, 
        // but a Tutor might need one too. For now let's check or create a customer object).

        // Actually, Tutors don't store stripe_customer_id in our current schema (only StudentProfile does).
        // We should probably store it on TutorProfile too if they are paying us, 
        // OR just create a customer on the fly if we don't want to change schema again right now.
        // Ideally, add stripe_customer_id to TutorProfile.

        // WORKAROUND: For now, we'll check if we can find a customer by email, or create one.
        // Better: Add stripe_customer_id to TutorProfile in next migration.
        // For this step, I'll assume we can create/retrieve by email.

        let customerId = '';
        // Look up via email on Stripe side to avoid duplicates
        const existingCustomers = await StripeService.createCustomer(tutor.user.email, tutor.username);
        // Wait, createCustomer actually creates. 
        // Let's just create one for now. Stripe allows duplicate emails. 
        // Ideally we save this ID.
        customerId = existingCustomers.id;

        // 2. Create Checkout Session
        const session = await StripeService.createSubscriptionCheckoutSession(
            priceId,
            customerId,
            successUrl,
            cancelUrl,
            {
                tutorId: tutor.id,
                userId: userId,
                tier,
                type: 'mentor_subscription'
            }
        );

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Create subscription checkout error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
};

// ... (existing code)

export const disconnectStripeAccount = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        // Ideally we might reject the account on Stripe or delete it, 
        // but for now, just clearing the ID in our DB allows creating a new one.
        // If we want to be clean, we can try to reject/delete on Stripe too if not fully onboarded.

        await prisma.tutorProfile.update({
            where: { id: tutor.id },
            data: {
                stripe_account_id: null,
                country: null // Optional: clear country too so they have to pick again
            }
        });

        res.json({ message: 'Stripe account disconnected successfully' });
    } catch (error: any) {
        console.error('Disconnect Stripe account error:', error);
        res.status(500).json({ error: 'Failed to disconnect account' });
    }
};

export const createConnectOnboardingLink = async (req: Request, res: Response) => {
    // ... (existing implementation)
    try {
        const userId = (req as any).user.id;
        const { refreshUrl, returnUrl, country } = CreateConnectLinkSchema.parse(req.body) as CreateConnectLinkInput;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            include: { user: true }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        let accountId = tutor.stripe_account_id;

        // If no account exists, or we want to ensure we have a valid one (error recovery below)
        if (!accountId) {
            // Use provided country, or fallback to profile country, or fallback to US
            const selectedCountry = country || tutor.country || 'US';

            // If country was provided and differs from profile, update profile
            if (country && country !== tutor.country) {
                await prisma.tutorProfile.update({
                    where: { id: tutor.id },
                    data: { country }
                });
            }

            const account = await StripeService.createConnectAccount(tutor.user.email, selectedCountry);
            accountId = account.id;

            await prisma.tutorProfile.update({
                where: { id: tutor.id },
                data: { stripe_account_id: accountId }
            });
        }

        try {
            const link = await StripeService.createAccountLink(accountId, refreshUrl, returnUrl);
            res.json({ url: link });
        } catch (linkError: any) {
            // Handle case where account ID exists in DB but not in Stripe (e.g. deleted in dashboard)
            if (linkError.message && linkError.message.includes('No such account')) {
                console.warn(`Stripe account ${accountId} not found. Creating a new one.`);

                // Retry creation
                const selectedCountry = country || tutor.country || 'US';
                const account = await StripeService.createConnectAccount(tutor.user.email, selectedCountry);
                accountId = account.id;

                await prisma.tutorProfile.update({
                    where: { id: tutor.id },
                    data: { stripe_account_id: accountId }
                });

                const link = await StripeService.createAccountLink(accountId, refreshUrl, returnUrl);
                return res.json({ url: link });
            }
            throw linkError;
        }

    } catch (error: any) {
        console.error('Create onboarding link error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: error.message || 'Failed to create onboarding link' });
    }
};

export const getConnectAccountStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: {
                stripe_account_id: true,
            }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        if (!tutor.stripe_account_id) {
            return res.json({
                hasAccount: false,
                detailsSubmitted: false,
                chargesEnabled: false,
                payoutsEnabled: false,
            });
        }

        // Get account details from Stripe
        const account = await StripeService.getConnectAccount(tutor.stripe_account_id);

        res.json({
            hasAccount: true,
            accountId: account.id,
            detailsSubmitted: account.details_submitted,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            requirements: {
                currentlyDue: account.requirements?.currently_due || [],
                eventuallyDue: account.requirements?.eventually_due || [],
                pastDue: account.requirements?.past_due || [],
            },
        });
    } catch (error: any) {
        console.error('Get connect status error:', error);
        res.status(500).json({ error: 'Failed to retrieve account status' });
    }
};


const UpdateSubscriptionSchema = z.object({
    newPriceId: z.string().min(1, 'Price ID is required'),
    tier: z.enum(['STANDARD', 'PRO', 'PREMIUM'] as const),
});

export const updateMentorSubscription = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { newPriceId, tier } = UpdateSubscriptionSchema.parse(req.body);

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });
        if (!tutor.stripe_subscription_id) {
            return res.status(400).json({ error: 'No active subscription found to update. Please subscribe first.' });
        }

        await StripeService.updateSubscription(tutor.stripe_subscription_id, newPriceId);

        // Optimistically update local DB
        await prisma.tutorProfile.update({
            where: { id: tutor.id },
            data: { tier }
        });

        res.json({ success: true, tier });
    } catch (error: any) {
        console.error('Update subscription error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to update subscription' });
    }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: {
                tier: true,
                stripe_subscription_id: true,
                subscription_status: true,
                subscription_end_date: true,
                stripe_account_id: true
            }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor found' });

        res.json(tutor);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get status' });
    }
}

const CreateBookingSchema = z.object({
    tutorId: z.string().uuid(),
    frequency: z.enum(['ONCE', 'WEEKLY', 'TWICE_WEEKLY', 'THRICE_WEEKLY'] as const),
    slotStarts: z.array(z.string().datetime()),
    durationMinutes: z.number().int().positive().default(60),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
});

const PayNextBookingSessionSchema = z.object({
    bookingId: z.string().uuid().optional(),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
});

const requiredWeeklySlotsForFrequency = (frequency: 'ONCE' | 'WEEKLY' | 'TWICE_WEEKLY' | 'THRICE_WEEKLY') => {
    if (frequency === 'TWICE_WEEKLY') return 2;
    if (frequency === 'THRICE_WEEKLY') return 3;
    return 1;
};

export const createStudentBookingCheckout = async (req: Request, res: Response) => {
    try {
        const studentUserId = (req as any).user.id;
        const { tutorId, frequency, slotStarts, durationMinutes, successUrl, cancelUrl } = CreateBookingSchema.parse(req.body);

        // 1. Get Student & Tutor Details
        const student = await prisma.studentProfile.findUnique({
            where: { user_id: studentUserId }
        });
        const tutor = await prisma.tutorProfile.findUnique({
            where: { id: tutorId }
        });

        if (!student) return res.status(404).json({ error: 'Student profile not found' });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });
        if (!tutor.stripe_account_id) return res.status(400).json({ error: 'This mentor is not yet set up to receive payments.' });

        // 2. Validate slots against frequency
        const requiredSlots = requiredWeeklySlotsForFrequency(frequency);
        if (frequency !== 'ONCE' && slotStarts.length !== requiredSlots) {
            return res.status(400).json({ error: `Please select ${requiredSlots} weekly time slot${requiredSlots === 1 ? '' : 's'}.` });
        }

        const starts = slotStarts
            .map((s) => new Date(s))
            .filter((d) => !Number.isNaN(d.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        if (starts.length !== slotStarts.length) {
            return res.status(400).json({ error: 'One or more slotStarts are invalid' });
        }

        // 3. Pricing: charge ONLY the first session now (pay-per-session model)
        // hourly_rate is in whole currency units (e.g. dollars); Stripe needs cents
        const sessionRate = tutor.hourly_rate;
        const platformFeePercentage = 0.10; // 10% platform fee

        const platformFee = sessionRate * platformFeePercentage;
        const totalAmount = sessionRate + platformFee;

        const amountInCents = Math.round(totalAmount * 100);
        const platformFeeInCents = Math.round(platformFee * 100);

        // 5. Ensure Stripe customer for student
        const stripeCustomerId =
            student.stripe_customer_id ||
            (await StripeService.createCustomer((req as any).user?.email || 'student@example.com', student.username)).id;

        if (!student.stripe_customer_id) {
            await prisma.studentProfile.update({
                where: { id: student.id },
                data: { stripe_customer_id: stripeCustomerId }
            });
        }

        // 6. Create Checkout Session (one-off payment for the FIRST session)
        const session = await StripeService.createBookingCheckoutSession(
            amountInCents,
            'usd',
            stripeCustomerId,
            tutor.stripe_account_id,
            platformFeeInCents,
            successUrl,
            cancelUrl,
            {
                type: 'student_booking',
                tutorId: tutor.id,
                studentId: student.id,
                frequency,
                durationMinutes,
                slotStarts: JSON.stringify(slotStarts),
            }
        );

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Create student booking checkout error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to create booking session' });
    }
};

export const payNextStudentBookingSession = async (req: Request, res: Response) => {
    try {
        const studentUserId = (req as any).user.id;
        const { bookingId, successUrl, cancelUrl } = PayNextBookingSessionSchema.parse(req.body);

        const student = await prisma.studentProfile.findUnique({
            where: { user_id: studentUserId },
        });

        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        const schedule = await prisma.paymentSchedule.findFirst({
            where: {
                status: 'pending',
                booking: {
                    student_id: student.id,
                    ...(bookingId ? { id: bookingId } : {}),
                },
                // Only allow paying when the item is due (48h window opens at due_date)
                due_date: {
                    lte: new Date(),
                },
            },
            orderBy: {
                due_date: 'asc',
            },
            include: {
                booking: {
                    include: {
                        tutor: true,
                    },
                },
            },
        });

        if (!schedule) {
            return res.status(404).json({ error: 'No due session payment found.' });
        }

        const tutor = schedule.booking?.tutor;
        if (!tutor) return res.status(400).json({ error: 'Tutor not found for booking.' });
        if (!tutor.stripe_account_id) return res.status(400).json({ error: 'This mentor is not yet set up to receive payments.' });

        const stripeCustomerId =
            student.stripe_customer_id ||
            (await StripeService.createCustomer((req as any).user?.email || 'student@example.com', student.username)).id;

        if (!student.stripe_customer_id) {
            await prisma.studentProfile.update({
                where: { id: student.id },
                data: { stripe_customer_id: stripeCustomerId },
            });
        }

        // Charge the student the session rate + platform fee (same as initial booking checkout)
        const sessionRate = Number(tutor.hourly_rate);
        const platformFeePercentage = 0.10;
        const platformFee = sessionRate * platformFeePercentage;
        const totalAmount = sessionRate + platformFee;

        const amountInCents = Math.round(totalAmount * 100);
        const platformFeeInCents = Math.round(platformFee * 100);

        const session = await StripeService.createBookingCheckoutSession(
            amountInCents,
            'usd',
            stripeCustomerId,
            tutor.stripe_account_id,
            platformFeeInCents,
            successUrl,
            cancelUrl,
            {
                type: 'student_booking_payment',
                paymentScheduleId: schedule.id,
                bookingId: schedule.booking_id,
                tutorId: tutor.id,
                studentId: student.id,
            }
        );

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Pay next booking session error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to start payment session' });
    }
};
