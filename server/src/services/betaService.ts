import { TutorTier } from '@prisma/client';
import prisma from '../config/db';

const BETA_TRIAL_DAYS = 30;

/** Approved beta application for this email (case-insensitive), or null. */
export async function findApprovedBetaApplication(email: string) {
    const normalized = (email ?? '').trim();
    if (!normalized) return null;
    return prisma.betaApplication.findFirst({
        where: { email: { equals: normalized, mode: 'insensitive' }, status: 'APPROVED' },
        select: { id: true },
    });
}

export async function isApprovedBetaEmail(email: string): Promise<boolean> {
    return !!(await findApprovedBetaApplication(email));
}

/** Grants the free beta Premium plan to a tutor profile. */
export async function grantBetaPremium(tutorId: string) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + BETA_TRIAL_DAYS);
    return prisma.tutorProfile.update({
        where: { id: tutorId },
        data: {
            tier: TutorTier.PREMIUM, // Beta mentors always receive the Premium plan
            subscription_status: 'trialing',
            subscription_end_date: trialEnd,
            has_used_trial: true,
            is_beta: true,
        },
        select: { tier: true, subscription_status: true, subscription_end_date: true, is_beta: true },
    });
}

export interface BetaAccessResult {
    is_beta: boolean;
    tier: TutorTier;
}

/**
 * Auto-assigns the Premium beta plan to an approved beta applicant's tutor account so they
 * never have to pick (or pay for) a plan. Safe to call on every verification/login: it is a
 * no-op for non-beta tutors, tutors already flagged as beta, and tutors who hold a real
 * Stripe subscription (left for admins to reconcile).
 *
 * Returns the tutor's current beta flag + tier, or null when the user has no tutor profile.
 */
export async function ensureBetaPremiumAccess(userId: string): Promise<BetaAccessResult | null> {
    const tutor = await prisma.tutorProfile.findUnique({
        where: { user_id: userId },
        select: {
            id: true,
            tier: true,
            is_beta: true,
            stripe_subscription_id: true,
            user: { select: { email: true } },
        },
    });
    if (!tutor) return null;
    if (tutor.is_beta) return { is_beta: true, tier: tutor.tier };

    if (tutor.stripe_subscription_id?.startsWith('sub_')) {
        return { is_beta: false, tier: tutor.tier };
    }

    const approved = await findApprovedBetaApplication(tutor.user.email);
    if (!approved) return { is_beta: false, tier: tutor.tier };

    try {
        const updated = await grantBetaPremium(tutor.id);
        console.log(`[Beta] Auto-assigned Premium beta plan to tutor ${tutor.id} (${tutor.user.email})`);
        return { is_beta: true, tier: updated.tier };
    } catch (e) {
        console.error('[Beta] Failed to auto-assign Premium beta plan:', e);
        return { is_beta: false, tier: tutor.tier };
    }
}
