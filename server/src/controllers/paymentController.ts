import { Request, Response } from 'express';
import { StripeService } from '../services/stripeService';
import { PaymentAnalyticsService } from '../services/paymentAnalyticsService';
import prisma from '../config/db';
import { z } from 'zod';
import { handleCheckoutSessionCompleted } from './webhookController';

/** Mentor subscription plans: annual billing. Price IDs from env or fallback for backward compatibility. */
export const MENTOR_PLANS = [
    {
        id: 'STANDARD' as const,
        name: 'Standard',
        priceMonthly: 25,
        annualAmount: 300,
        priceId: process.env.STRIPE_PRICE_STANDARD_ANNUAL || 'price_1StboAByCQ0ee0A8u7BMs9cl',
    },
    {
        id: 'PRO' as const,
        name: 'Pro',
        priceMonthly: 45,
        annualAmount: 540,
        priceId: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_1StboXByCQ0ee0A8GeuDW77K',
    },
    {
        id: 'PREMIUM' as const,
        name: 'Premium',
        priceMonthly: 85,
        annualAmount: 1020,
        priceId: process.env.STRIPE_PRICE_PREMIUM_ANNUAL || 'price_1StbozByCQ0ee0A8vJMmBvce',
    },
];

export const getMentorPlans = async (_req: Request, res: Response) => {
    return res.json({ plans: MENTOR_PLANS });
};

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

/**
 * Returns a valid sub_... subscription ID for a tutor, auto-recovering from DB corruption
 * where a cus_... customer ID was accidentally stored in stripe_subscription_id.
 * Also heals the DB row so it won't happen again.
 */
async function resolveTutorSubId(tutor: {
    id: string;
    stripe_subscription_id?: string | null;
    stripe_customer_id?: string | null;
}): Promise<string | null> {
    // Already correct
    if (tutor.stripe_subscription_id?.startsWith('sub_')) {
        return tutor.stripe_subscription_id;
    }

    // Determine the customer ID — could be in stripe_customer_id or mistakenly in stripe_subscription_id
    const customerId = tutor.stripe_customer_id?.startsWith('cus_')
        ? tutor.stripe_customer_id
        : tutor.stripe_subscription_id?.startsWith('cus_')
            ? tutor.stripe_subscription_id
            : null;

    if (!customerId) return null;

    const subscriptions = await StripeService.listCustomerSubscriptions(customerId);
    const activeSub = subscriptions.find(
        (s) => s.status === 'active' || s.status === 'trialing'
    );
    if (!activeSub) return null;

    const trialEnd = (activeSub as any).trial_end as number | null;
    const currentPeriodEnd = (activeSub as any).current_period_end as number | null;
    const endEpoch = trialEnd || currentPeriodEnd;

    // Heal the DB row
    await prisma.tutorProfile.update({
        where: { id: tutor.id },
        data: {
            stripe_customer_id: customerId,
            stripe_subscription_id: activeSub.id,
            subscription_status: activeSub.status,
            subscription_end_date: endEpoch ? new Date(endEpoch * 1000) : undefined,
            ...(trialEnd ? { has_used_trial: true } : {}),
        },
    });
    console.log(`[ResolveSub] Healed tutor ${tutor.id}: set stripe_subscription_id=${activeSub.id}`);

    return activeSub.id;
}

export const createMentorSubscriptionCheckout = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { priceId, tier, successUrl, cancelUrl } = CreateSubscriptionSchema.parse(req.body);

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            include: { user: true }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        // Determine trial eligibility robustly, including older accounts created before has_used_trial existed.
        const hasTrialHistory = !!tutor.subscription_end_date
            || !!tutor.stripe_subscription_id
            || !!tutor.subscription_status;
        const trialAlreadyUsed = tutor.has_used_trial || hasTrialHistory;
        const trialEligible = !trialAlreadyUsed;

        // Persist inferred trial usage so future checks remain consistent.
        if (trialAlreadyUsed && !tutor.has_used_trial) {
            await prisma.tutorProfile.update({
                where: { id: tutor.id },
                data: { has_used_trial: true },
            });
        }

        // Reuse existing Stripe customer to prevent duplicate customers per tutor.
        let customerId = tutor.stripe_customer_id ?? '';
        if (!customerId) {
            const customer = await StripeService.createCustomer(tutor.user.email, tutor.username);
            customerId = customer.id;
            await prisma.tutorProfile.update({
                where: { id: tutor.id },
                data: { stripe_customer_id: customerId },
            });
        }

        // 2. Create Checkout Session — trial is always disabled for paid checkout
        console.log(`[Subscription Checkout] userId=${userId} tutorId=${tutor.id} tier=${tier} trialEligible=${trialEligible} customerId=${customerId} priceId=${priceId}`);
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
            },
            trialEligible
        );
        console.log(`[Subscription Checkout] Created session ${session.id}, url=${session.url}`);

        res.json({ url: session.url });
    } catch (error: any) {
        console.error('Create subscription checkout error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
};

/** Activate 1-month trial without Stripe (no payment collection). For use when Stripe checkout is disabled. */
const ActivateTrialSchema = z.object({
    tier: z.enum(['STANDARD', 'PRO', 'PREMIUM'] as const),
});

export const activateMentorTrial = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { tier } = ActivateTrialSchema.parse(req.body);

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            include: { user: { select: { email: true } } },
        });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        // Only approved beta applicants may activate the trial.
        // Match case-insensitively — application and account emails are not stored with consistent casing.
        const betaApproval = await prisma.betaApplication.findFirst({
            where: {
                email: { equals: tutor.user.email, mode: 'insensitive' },
                status: 'APPROVED',
            },
            select: { id: true },
        });
        if (!betaApproval) {
            return res.status(403).json({
                error: 'Beta access only. Apply at emplearnings.com/beta and wait for approval before activating your account.',
            });
        }

        // Gate only on the explicit flag for approved beta mentors. The broader "trial history"
        // heuristic (stripe_customer/subscription_status set during onboarding) produces false
        // positives that wrongly push approved beta mentors into paid checkout.
        if (tutor.has_used_trial) {
            return res.status(400).json({ error: 'You have already used your free trial. Please subscribe to continue.' });
        }

        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30); // 1-month free beta trial

        await prisma.tutorProfile.update({
            where: { id: tutor.id },
            data: {
                tier: 'PREMIUM' as any, // Beta users always receive the Premium plan
                subscription_status: 'trialing',
                subscription_end_date: trialEnd,
                has_used_trial: true,
                is_beta: true,
            },
        });

        return res.json({ success: true, subscription_status: 'trialing', subscription_end_date: trialEnd, tier: 'PREMIUM' });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        console.error('Activate trial error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to activate trial' });
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

        const subscriptionId = await resolveTutorSubId(tutor);
        if (!subscriptionId) {
            return res.status(400).json({ error: 'No active subscription found to update. Please subscribe first.' });
        }

        await StripeService.updateSubscription(subscriptionId, newPriceId);

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
                id: true,
                tier: true,
                stripe_subscription_id: true,
                stripe_customer_id: true,
                subscription_status: true,
                subscription_end_date: true,
                stripe_account_id: true,
                has_used_trial: true,
                is_beta: true
            }
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor found' });

        // Auto-heal if stripe_subscription_id is missing or holds a cus_ value by mistake
        if (!tutor.stripe_subscription_id?.startsWith('sub_') && (tutor.stripe_customer_id || tutor.stripe_subscription_id)) {
            await resolveTutorSubId(tutor).catch(() => null);
        }

        // Re-read fresh data so client always gets the corrected values
        const fresh = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: {
                tier: true,
                stripe_subscription_id: true,
                subscription_status: true,
                subscription_end_date: true,
                stripe_account_id: true,
                has_used_trial: true,
                is_beta: true
            }
        });

        res.json(fresh);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get status' });
    }
}

export const cancelMentorSubscription = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        // Resolve real subscription ID, healing corrupted records if needed
        const subscriptionId = await resolveTutorSubId(tutor);
        if (subscriptionId) {
            await StripeService.cancelSubscription(subscriptionId);

            // Update local status to reflect cancellation pending at period end
            await prisma.tutorProfile.update({
                where: { id: tutor.id },
                data: {
                    subscription_status: 'canceled',
                },
            });

            return res.json({ success: true, message: 'Subscription will be canceled at the end of the current billing period.' });
        }

        // If it's a local trial (no Stripe subscription), just cancel it
        if (tutor.subscription_status === 'trialing' || tutor.subscription_status === 'active') {
            await prisma.tutorProfile.update({
                where: { id: tutor.id },
                data: {
                    subscription_status: 'canceled',
                },
            });

            return res.json({ success: true, message: 'Subscription canceled.' });
        }

        return res.status(400).json({ error: 'No active subscription to cancel.' });
    } catch (error: any) {
        console.error('Cancel subscription error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to cancel subscription' });
    }
}

const FinalizeMentorSubscriptionSchema = z.object({
    sessionId: z.string().min(1),
});

/**
 * Fallback for when the Stripe webhook doesn't update the DB after a successful checkout.
 * Called from the client when the user is redirected back with ?session_id=...
 */
export const finalizeMentorSubscription = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { sessionId } = FinalizeMentorSubscriptionSchema.parse(req.body);
        console.log(`[Finalize Subscription] userId=${userId} sessionId=${sessionId}`);

        const session = await StripeService.getCheckoutSessionById(sessionId);

        if (!session) {
            console.error(`[Finalize Subscription] Session not found: ${sessionId}`);
            return res.status(404).json({ error: 'Checkout session not found' });
        }

        console.log(`[Finalize Subscription] session.payment_status=${session.payment_status} session.status=${session.status} session.subscription=${session.subscription} session.mode=${session.mode}`);
        console.log(`[Finalize Subscription] session.metadata=`, session.metadata);

        // Accept 'paid' or 'no_payment_required' (trial subscriptions have no_payment_required)
        if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
            console.error(`[Finalize Subscription] Unexpected payment_status: ${session.payment_status}`);
            return res.status(400).json({ error: 'Payment not completed' });
        }

        const metadata = session.metadata as Record<string, string> | null;
        if (!metadata || metadata.type !== 'mentor_subscription') {
            console.error(`[Finalize Subscription] Invalid metadata type: ${metadata?.type}`);
            return res.status(400).json({ error: 'Invalid session type' });
        }

        // Verify the session belongs to the authenticated user
        if (metadata.userId !== userId) {
            console.error(`[Finalize Subscription] User mismatch: metadata.userId=${metadata.userId} vs userId=${userId}`);
            return res.status(403).json({ error: 'Session does not belong to this user' });
        }

        await handleCheckoutSessionCompleted(session);
        console.log(`[Finalize Subscription] Successfully finalized for userId=${userId}`);

        return res.json({ success: true });
    } catch (error: any) {
        console.error('[Finalize Subscription] Error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        return res.status(500).json({ error: error?.message || 'Failed to finalize subscription' });
    }
};

/**
 * Manual verification: look up the Stripe customer's latest subscription and sync DB.
 * Fallback for when both webhook and session-based finalize fail.
 */
export const verifyMentorSubscription = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        console.log(`[Verify Subscription] userId=${userId}`);

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
        });
        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const customerId = tutor.stripe_customer_id;
        if (!customerId) {
            console.log(`[Verify Subscription] No stripe_customer_id for tutor ${tutor.id}`);
            return res.status(400).json({ error: 'No Stripe customer found. Please subscribe first.' });
        }

        console.log(`[Verify Subscription] Fetching subscriptions for customer ${customerId}`);
        const subscriptions = await StripeService.listCustomerSubscriptions(customerId);
        console.log(`[Verify Subscription] Found ${subscriptions.length} subscriptions`);

        // Find the most recent active or trialing subscription
        const activeSub = subscriptions.find(
            (s) => s.status === 'active' || s.status === 'trialing'
        );

        if (!activeSub) {
            console.log(`[Verify Subscription] No active/trialing subscription found. Statuses: ${subscriptions.map(s => s.status).join(', ')}`);
            return res.status(404).json({ error: 'No active subscription found on Stripe. Please subscribe first.' });
        }

        console.log(`[Verify Subscription] Found subscription ${activeSub.id}, status=${activeSub.status}, current_period_end=${(activeSub as any).current_period_end}`);

        const trialEnd = (activeSub as any).trial_end as number | null;
        const currentPeriodEnd = (activeSub as any).current_period_end as number | null;
        const endEpoch = trialEnd || currentPeriodEnd;

        // Determine tier from subscription metadata or existing profile
        const subMeta = activeSub.metadata as Record<string, string> | null;
        const tier = subMeta?.tier;

        await prisma.tutorProfile.update({
            where: { id: tutor.id },
            data: {
                stripe_subscription_id: activeSub.id,
                subscription_status: activeSub.status,
                subscription_end_date: endEpoch ? new Date(endEpoch * 1000) : undefined,
                ...(tier === 'STANDARD' || tier === 'PRO' || tier === 'PREMIUM'
                    ? { tier: tier as any }
                    : {}),
                ...(trialEnd ? { has_used_trial: true } : {}),
            },
        });

        console.log(`[Verify Subscription] Successfully synced tutor ${tutor.id}: sub=${activeSub.id}, status=${activeSub.status}`);
        return res.json({ success: true, subscription_status: activeSub.status });
    } catch (error: any) {
        console.error('[Verify Subscription] Error:', error);
        return res.status(500).json({ error: error?.message || 'Failed to verify subscription' });
    }
};

const CreateBookingSchema = z.object({
    tutorId: z.string().uuid(),
    frequency: z.enum(['ONCE', 'WEEKLY', 'TWICE_WEEKLY', 'THRICE_WEEKLY'] as const),
    slotStarts: z.array(z.string().datetime()),
    durationMinutes: z.number().int().positive().default(60),
    successUrl: z.string().url(),
    cancelUrl: z.string().url(),
    clientTimezone: z.string().optional(),
});

const FinalizeStudentBookingSchema = z.object({
    sessionId: z.string().min(1),
});

const PayNextBookingSessionSchema = z.object({
    lessonId: z.string().uuid().optional(),
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
        const { tutorId, frequency, slotStarts, durationMinutes, successUrl, cancelUrl, clientTimezone } = CreateBookingSchema.parse(req.body);

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
        const successUrlWithSession = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        const session = await StripeService.createBookingCheckoutSession(
            amountInCents,
            'usd',
            stripeCustomerId,
            tutor.stripe_account_id,
            platformFeeInCents,
            successUrlWithSession,
            cancelUrl,
            {
                type: 'student_booking',
                tutorId: tutor.id,
                studentId: student.id,
                frequency,
                durationMinutes,
                slotStarts: JSON.stringify(slotStarts),
                clientTimezone: clientTimezone || '',
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

export const finalizeStudentBookingCheckout = async (req: Request, res: Response) => {
    try {
        const { sessionId } = FinalizeStudentBookingSchema.parse(req.body);

        const session = await StripeService.getCheckoutSessionById(sessionId);
        if (!session) return res.status(404).json({ error: 'Checkout session not found' });
        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Checkout session is not paid yet' });
        }

        const metaType = (session.metadata as any)?.type;
        if (metaType !== 'student_booking' && metaType !== 'student_booking_payment') {
            return res.status(400).json({ error: 'Invalid checkout session type' });
        }

        // Idempotent: handler already guards against duplicate processing via payment_intent
        await handleCheckoutSessionCompleted(session as any);
        return res.json({ ok: true });
    } catch (error: any) {
        console.error('Finalize student booking checkout error:', error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        return res.status(500).json({ error: 'Failed to finalize booking checkout' });
    }
};

export const payNextStudentBookingSession = async (req: Request, res: Response) => {
    try {
        const studentUserId = (req as any).user.id;
        const { lessonId, bookingId, successUrl, cancelUrl } = PayNextBookingSessionSchema.parse(req.body);

        const student = await prisma.studentProfile.findUnique({
            where: { user_id: studentUserId },
        });

        if (!student) return res.status(404).json({ error: 'Student profile not found' });

        let schedule;

        if (lessonId) {
            // Find the PaymentSchedule for this specific lesson via its expected due_date
            const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
            if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
            if (!lesson.booking_id) return res.status(400).json({ error: 'Lesson is not part of a booking' });

            const expectedDue = new Date(lesson.start_time.getTime() - 48 * 60 * 60 * 1000);
            schedule = await prisma.paymentSchedule.findFirst({
                where: {
                    booking_id: lesson.booking_id,
                    status: 'pending',
                    due_date: {
                        gte: new Date(expectedDue.getTime() - 60 * 60 * 1000), // -1h grace
                        lte: new Date(expectedDue.getTime() + 60 * 60 * 1000), // +1h grace
                    },
                },
                include: { booking: { include: { tutor: true } } },
            });

            if (!schedule) {
                return res.status(404).json({ error: 'No pending payment found for this session.' });
            }
        } else {
            // Fallback: oldest pending PaymentSchedule for the booking (no time restriction)
            schedule = await prisma.paymentSchedule.findFirst({
                where: {
                    status: 'pending',
                    booking: {
                        student_id: student.id,
                        ...(bookingId ? { id: bookingId } : {}),
                    },
                },
                orderBy: { due_date: 'asc' },
                include: { booking: { include: { tutor: true } } },
            });

            if (!schedule) {
                return res.status(404).json({ error: 'No pending session payment found.' });
            }
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

        const successUrlWithSession = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        const session = await StripeService.createBookingCheckoutSession(
            amountInCents,
            'usd',
            stripeCustomerId,
            tutor.stripe_account_id,
            platformFeeInCents,
            successUrlWithSession,
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

// ============ TUTOR PAYMENT ANALYTICS ENDPOINTS ============

/**
 * Get tutor earnings overview
 */
export const getTutorEarningsOverview = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true },
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const overview = await PaymentAnalyticsService.getTutorEarningsOverview(tutor.id);
        res.json(overview);
    } catch (error: any) {
        console.error('Get earnings overview error:', error);
        res.status(500).json({ error: 'Failed to retrieve earnings overview' });
    }
};

/**
 * Get tutor payment history with pagination
 */
export const getTutorPaymentHistory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true },
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const history = await PaymentAnalyticsService.getTutorPaymentHistory(
            tutor.id,
            page,
            limit,
            startDate,
            endDate
        );
        res.json(history);
    } catch (error: any) {
        console.error('Get payment history error:', error);
        res.status(500).json({ error: 'Failed to retrieve payment history' });
    }
};

/**
 * Get upcoming expected payments for tutor
 */
export const getTutorUpcomingPayments = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true },
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const upcomingPayments = await PaymentAnalyticsService.getTutorUpcomingPayments(tutor.id);
        res.json(upcomingPayments);
    } catch (error: any) {
        console.error('Get upcoming payments error:', error);
        res.status(500).json({ error: 'Failed to retrieve upcoming payments' });
    }
};

/**
 * Get tutor subscription information
 */
export const getTutorSubscriptionInfo = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true },
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const subscriptionInfo = await PaymentAnalyticsService.getTutorSubscriptionInfo(tutor.id);
        res.json(subscriptionInfo);
    } catch (error: any) {
        console.error('Get subscription info error:', error);
        res.status(500).json({ error: 'Failed to retrieve subscription information' });
    }
};

/**
 * Export payment history as CSV
 */
export const exportPaymentHistoryCSV = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const tutor = await prisma.tutorProfile.findUnique({
            where: { user_id: userId },
            select: { id: true, username: true },
        });

        if (!tutor) return res.status(404).json({ error: 'Tutor profile not found' });

        const csvContent = await PaymentAnalyticsService.exportPaymentHistoryCSV(
            tutor.id,
            startDate,
            endDate
        );

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="payment-history-${tutor.username}-${new Date().toISOString().split('T')[0]}.csv"`
        );
        res.send(csvContent);
    } catch (error: any) {
        console.error('Export payment history error:', error);
        res.status(500).json({ error: 'Failed to export payment history' });
    }
};

